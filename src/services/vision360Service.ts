/*
-- ===================================================
-- Código             : /src/services/vision360Service.ts
-- Versão (.v20)      : 3.0.1
-- Data/Hora          : 2025-12-03 17:05 (America/Sao_Paulo)
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Serviços da Visão 360 + montagem do payload para IA.
-- Fluxo              : UI → services/vision360Service → ai/vision360AiService → Gemini
-- Alterações (3.0.1) :
--   • Tornado getVision360CompanyAiPayload um export explícito (export async function)
--     para evitar qualquer conflito de build/import.
-- Alterações (3.0.0) :
--   • Criada função getVision360CompanyAiPayload() que monta o JSON enviado à IA.
--   • Derivação de métricas: abertas vs concluídas, completion_rate, temperatura.
--   • Derivação de tags, budgets_summary e sample de ações (com budgets).
--   • Padronização completa seguindo Vision360CompanyAiPayload (types/vision360).
--   • 100% compatível com Supabase RLS via JWT.
-- Dependências        : @/lib/supabaseClient, @/types/vision360, @/types/company, @/types/chat
-- ===================================================
*/

import { supabase } from '@/lib/supabaseClient';

import type {
  CustomerDetails,
  DealWithChats,
  Vision360BudgetForAi,
  Vision360CompanyActionForAi,
  Vision360CompanyAiPayload,
} from '@/types/vision360';

import type { Company } from '@/types/company';
import type { Chat } from '@/types/chat';

/* ============================================================
 * SEARCH COMPANIES
 * ========================================================== */
export const searchCompanies = async (query: string): Promise<Company[]> => {
  if (!query || query.trim().length < 2) return [];

  const { data, error } = await supabase
    .rpc('search_companies_vision360', { p_term: query.trim() });

  if (error) {
    console.error('[vision360Service] Erro ao buscar empresas para Visão 360:', error);
    throw error;
  }
  return (data as Company[]) || [];
};

/* ============================================================
 * CUSTOMER DETAILS (EMPRESA + CONTATOS + RESPONSÁVEL)
 * ========================================================== */
export const getCustomerDetails = async (companyId: string): Promise<CustomerDetails | null> => {
  if (!companyId) return null;

  const { data, error } = await supabase
    .from('companies')
    .select(`
      *,
      contacts(
        *,
        channels:contacts_channel(*)
      )
    `)
    .eq('id', companyId)
    .single();

  if (error) {
    console.error(`[vision360Service] Erro ao buscar detalhes do cliente ${companyId}:`, error);
    if ((error as any).code === 'PGRST116') return null;
    throw error;
  }

  const company = data as any;

  // Resolve owner_name via profiles.full_name
  if (company.owner && company.tenant_id) {
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('auth_user_id', company.owner)
      .eq('tenant_id', company.tenant_id)
      .eq('status', 'active')
      .maybeSingle();

    company.owner_name = ownerProfile?.full_name ?? null;
  }

  return company as CustomerDetails;
};

/* ============================================================
 * CHATS COM BUDGETS (ORÇAMENTOS ANINHADOS)
 * ========================================================== */

type ChatWithBudgets = Chat & {
  budgets?: Array<{
    id?: string;
    description?: string;
    amount?: number;
    status?: string;
    loss_reason?: string | null;
    created_at?: string;
    updated_at?: string;
  }>;
};

export const getDealsAndChatsByCompany = async (companyId: string): Promise<DealWithChats[]> => {
  if (!companyId) return [];

  const { data, error } = await supabase
    .from('chats')
    .select(`
      id, tenant_id, company_id, contact_id, deal_id,
      kind, direction, channel_type,
      subject, body, temperature, priority,
      calendar_at, on_time, timezone,
      is_done, done_at,
      created_at, updated_at,
      budgets
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[vision360Service] Erro ao buscar chats (com budgets) para Visão 360:', error);
    throw error;
  }

  const chats = (data as ChatWithBudgets[]) || [];

  const result: DealWithChats[] = [];
  for (const chat of chats) {
    const list = Array.isArray(chat.budgets) ? chat.budgets : [];
    if (list.length === 0) continue;

    list.forEach((b, idx) => {
      const dealId = b?.id || `${chat.id}::${idx}`;

      result.push({
        id: dealId as string,
        company_id: chat.company_id || null,
        name: b?.description?.trim() || 'Orçamento',
        status: b?.status || 'aberta',
        amount: typeof b?.amount === 'number' ? b.amount : 0,
        currency: 'BRL',
        pipeline_stage: '-',
        description: b?.description || null,
        loss_reason: b?.loss_reason ?? null,
        origin_chat_id: chat.id,
        created_at: b?.created_at || chat.created_at,
        updated_at: b?.updated_at || chat.updated_at,
        chats: [
          {
            ...chat,
            channel_type: chat.channel_type ?? null,
            direction: chat.direction ?? null,
          } as Chat,
        ],
      } as unknown as DealWithChats);
    });
  }

  result.sort((a, b) => {
    const ta = new Date(a.updated_at || a.created_at || 0).getTime();
    const tb = new Date(b.updated_at || b.created_at || 0).getTime();
    return tb - ta;
  });

  return result;
};

/* ============================================================
 * FUNÇÃO NOVA: getVision360CompanyAiPayload (EXPORT EXPLÍCITO)
 * ========================================================== */

export async function getVision360CompanyAiPayload(
  companyId: string,
  period: { startDate: string; endDate: string }
): Promise<Vision360CompanyAiPayload | null> {
  if (!companyId) return null;

  /* -----------------------------------------------------------
   * 1) PEGAR DETALHES DA EMPRESA
   * --------------------------------------------------------- */
  const company = await getCustomerDetails(companyId);
  if (!company) return null;

  /* -----------------------------------------------------------
   * 2) PEGAR TODAS AS AÇÕES (chats) DA EMPRESA NO PERÍODO
   * --------------------------------------------------------- */
  const { data: chats, error: chatsError } = await supabase
    .from('chats')
    .select(`
      id, company_id, contact_id,
      kind, channel_type, direction,
      body, subject, temperature, priority,
      is_done, created_at, updated_at,
      tags, budgets
    `)
    .eq('company_id', companyId)
    .gte('created_at', period.startDate)
    .lte('created_at', period.endDate)
    .order('created_at', { ascending: false });

  if (chatsError) {
    console.error('[vision360Service] Erro ao buscar ações para IA:', chatsError);
    throw chatsError;
  }

  const rows = (chats as ChatWithBudgets[]) || [];

  /* -----------------------------------------------------------
   * 3) MÉTRICAS: ABERTAS x CONCLUÍDAS
   * --------------------------------------------------------- */
  let actions_open = 0;
  let actions_closed = 0;

  rows.forEach((c) => {
    if (c.is_done) actions_closed++;
    else actions_open++;
  });

  const total = actions_open + actions_closed;
  const completion_rate = total > 0 ? actions_closed / total : 0;

  /* -----------------------------------------------------------
   * 4) TEMPERATURA (DISTRIBUIÇÃO)
   * --------------------------------------------------------- */
  const temperature_distribution: Record<string, number> = {};

  rows.forEach((c) => {
    const t = (c.temperature || 'neutra').toString().toLowerCase();
    temperature_distribution[t] = (temperature_distribution[t] || 0) + 1;
  });

  /* -----------------------------------------------------------
   * 5) TAGS (TOP E CONTAGEM)
   * --------------------------------------------------------- */
  const tagCounter: Record<string, number> = {};

  rows.forEach((c) => {
    const chatTags = Array.isArray(c.tags) ? c.tags : [];
    chatTags.forEach((t) => {
      tagCounter[t] = (tagCounter[t] || 0) + 1;
    });
  });

  const top_tags = Object.entries(tagCounter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag]) => tag);

  const total_distinct_tags = Object.keys(tagCounter).length;

  /* -----------------------------------------------------------
   * 6) ORÇAMENTOS (BUDGET SUMMARY)
   * --------------------------------------------------------- */
  let total_amount = 0;
  let total_open_amount = 0;
  let total_won_amount = 0;
  let total_lost_amount = 0;

  let count_open = 0;
  let count_won = 0;
  let count_lost = 0;

  rows.forEach((c) => {
    const list = Array.isArray(c.budgets) ? c.budgets : [];
    list.forEach((b) => {
      const amount = typeof b?.amount === 'number' ? b.amount : 0;
      const status = (b?.status || 'aberta').toLowerCase();

      total_amount += amount;

      if (status === 'aberta') {
        count_open++;
        total_open_amount += amount;
      } else if (status === 'ganha') {
        count_won++;
        total_won_amount += amount;
      } else if (status === 'perdida') {
        count_lost++;
        total_lost_amount += amount;
      }
    });
  });

  /* -----------------------------------------------------------
   * 7) ACTIONS_SAMPLE (LIMITAR 30)
   * --------------------------------------------------------- */
  const MAX_ACTIONS = 30;

  const actions_sample: Vision360CompanyActionForAi[] = rows.slice(0, MAX_ACTIONS).map((c) => ({
    id: c.id,
    created_at: c.created_at,
    is_done: c.is_done,
    kind: c.kind,
    channel_type: c.channel_type,
    direction: c.direction,
    priority: c.priority,
    temperature: c.temperature,
    tags: Array.isArray(c.tags) ? c.tags : [],
    body: (c.body || '').substring(0, 1500),
    budgets: (Array.isArray(c.budgets) ? c.budgets : []).map(
      (b): Vision360BudgetForAi => ({
        id: b.id || `${c.id}::b`,
        amount: typeof b.amount === 'number' ? b.amount : null,
        status: b.status || 'aberta',
        updated_at: b.updated_at || c.updated_at,
        description: b.description || '',
        loss_reason: b.loss_reason ?? null,
      })
    ),
  }));

  /* -----------------------------------------------------------
   * 8) MONTAR PAYLOAD FINAL
   * --------------------------------------------------------- */
  const payload: Vision360CompanyAiPayload = {
    company: {
      id: company.id,
      trade_name: company.trade_name,
      kind: (company as any).kind || null,
      segment: (company as any).segment || null,
      status: (company as any).status || null,
    },

    period: {
      start_date: period.startDate,
      end_date: period.endDate,
    },

    metrics: {
      actions_open,
      actions_closed,
      completion_rate,
      temperature_distribution,
    },

    budget_summary: {
      total_amount,
      total_open_amount,
      total_won_amount,
      total_lost_amount,
      count_open,
      count_won,
      count_lost,
    },

    tags_summary: {
      top_tags,
      total_distinct_tags,
    },

    actions_sample,
  };

  return payload;
}

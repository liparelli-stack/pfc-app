/*
-- ===================================================
-- Código             : /src/services/clientDetailService.ts
-- Versão             : 1.0.0
-- Data/Hora          : 2026-03-28 America/Sao_Paulo
-- Autor              : FL / Claude
-- Objetivo           : Busca detalhes comportamentais de um cliente via RPC.
-- Fluxo              :
--   fetchClientDetail(companyId, tenantId)
--     → supabase.rpc('get_client_detail', { p_company_id, p_tenant_id })
--     → data[0].get_client_detail (JSONB)
--     → mapeia snake_case → ClientDetail (camelCase)
-- Observações        :
--   • A RPC retorna 1 linha com coluna JSONB 'get_client_detail'.
--   • Erros: console.error + throw.
-- ===================================================
*/

import { supabase } from '@/lib/supabaseClient';

/* ========================================================= */
/* Tipos públicos                                            */
/* ========================================================= */

export interface ClientDetail {
  companyId: string;
  firstChatAt: string;
  lastChatAt: string;
  daysSilent: number;
  avgIntervalDays: number | null;
  currentTemp: string;
  currentTempScore: number;
  peakTemp: string;
  peakTempScore: number;
  tempTimeline: Array<{ ts: string; date: string; score: number; temperature: string }>;
  lastBudgetAt: string | null;
  daysNoBudget: number | null;
  totalBudgets: number;
  lostBudgets: number;
  openActions: number;
  overdueActions: number;
  nextAction: {
    id: string;
    kind: string;
    channelType: string;
    calendarAt: string;
    isDone: boolean;
  } | null;
  channelMix: Record<string, number>;
  riskScore: number;
  riskLabel: 'Saudável' | 'Atenção' | 'Risco';
  riskBreakdown: {
    silence: number;
    cooling: number;
    no_budget: number;
    loss_rate: number;
    overdue: number;
  };
  chats: Array<{
    id: string;
    kind: string;
    isDone: boolean;
    createdAt: string;
    updatedAt: string;
    calendarAt: string;
    temperature: string;
    budgetCount: number;
    channelType: string;
  }>;
}

/* ========================================================= */
/* Mapper                                                    */
/* ========================================================= */

function mapDetail(raw: any): ClientDetail {
  const na = raw.next_action;
  return {
    companyId:        String(raw.company_id ?? ''),
    firstChatAt:      String(raw.first_chat_at ?? ''),
    lastChatAt:       String(raw.last_chat_at ?? ''),
    daysSilent:       Number(raw.days_silent ?? 0),
    avgIntervalDays:  raw.avg_interval_days != null ? Number(raw.avg_interval_days) : null,
    currentTemp:      String(raw.current_temp ?? ''),
    currentTempScore: Number(raw.current_temp_score ?? 0),
    peakTemp:         String(raw.peak_temp ?? ''),
    peakTempScore:    Number(raw.peak_temp_score ?? 0),
    tempTimeline: Array.isArray(raw.temp_timeline)
      ? raw.temp_timeline.map((t: any) => ({
          ts:          String(t.ts ?? t.date ?? ''),
          date:        String(t.date ?? ''),
          score:       Number(t.score ?? 0),
          temperature: String(t.temperature ?? ''),
        }))
      : [],
    lastBudgetAt:  raw.last_budget_at != null ? String(raw.last_budget_at) : null,
    daysNoBudget:  raw.days_no_budget != null ? Number(raw.days_no_budget) : null,
    totalBudgets:  Number(raw.total_budgets ?? 0),
    lostBudgets:   Number(raw.lost_budgets ?? 0),
    openActions:    Number(raw.open_actions ?? 0),
    overdueActions: Number(raw.overdue_actions ?? 0),
    nextAction: na ? {
      id:          String(na.id ?? ''),
      kind:        String(na.kind ?? ''),
      channelType: String(na.channel_type ?? ''),
      calendarAt:  String(na.calendar_at ?? ''),
      isDone:      Boolean(na.is_done),
    } : null,
    channelMix: raw.channel_mix && typeof raw.channel_mix === 'object'
      ? Object.fromEntries(
          Object.entries(raw.channel_mix).map(([k, v]) => [k, Number(v)])
        )
      : {},
    riskScore: Number(raw.risk_score ?? 0),
    riskLabel: (raw.risk_label ?? 'Saudável') as ClientDetail['riskLabel'],
    riskBreakdown: {
      silence:   Number(raw.risk_breakdown?.silence   ?? 0),
      cooling:   Number(raw.risk_breakdown?.cooling   ?? 0),
      no_budget: Number(raw.risk_breakdown?.no_budget ?? 0),
      loss_rate: Number(raw.risk_breakdown?.loss_rate ?? 0),
      overdue:   Number(raw.risk_breakdown?.overdue   ?? 0),
    },
    chats: Array.isArray(raw.chats)
      ? raw.chats.map((c: any) => ({
          id:          String(c.id ?? ''),
          kind:        String(c.kind ?? ''),
          isDone:      Boolean(c.is_done),
          createdAt:   String(c.created_at ?? ''),
          updatedAt:   String(c.updated_at ?? ''),
          calendarAt:  String(c.calendar_at ?? ''),
          temperature: String(c.temperature ?? ''),
          budgetCount: Number(c.budget_count ?? 0),
          channelType: String(c.channel_type ?? ''),
        }))
      : [],
  };
}

/* ========================================================= */
/* Função principal                                          */
/* ========================================================= */

export async function fetchClientDetail(
  companyId: string,
  tenantId: string
): Promise<ClientDetail> {
  const { data, error } = await supabase.rpc('get_client_detail', {
    p_company_id: companyId,
    p_tenant_id:  tenantId,
  });

  if (error) {
    console.error('[clientDetailService] get_client_detail error:', error);
    throw new Error(error.message ?? 'Falha ao buscar detalhe do cliente.');
  }

  const d = data as any;
  const raw =
    d && typeof d === 'object' && !Array.isArray(d)
      ? d                                      // objeto direto
      : Array.isArray(d) && d[0]?.get_client_detail
      ? d[0].get_client_detail                 // array com chave nomeada
      : Array.isArray(d) && d[0]
      ? d[0]                                   // array direto
      : null;

  if (!raw || typeof raw !== 'object') throw new Error('get_client_detail não retornou dados.');

  return mapDetail(raw);
}

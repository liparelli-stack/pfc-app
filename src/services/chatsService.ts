// ===================================================
// Código             : /src/services/chatsService.ts
// Versão (.v20)      : 2.6.2
// Data/Hora          : 2025-12-18 00:00 America/Sao_Paulo
// Autor              : FL / Execução via você EVA
// Objetivo           : Listagem de ações (chats) com filtros corretos:
//                      - filtro por empresa deve filtrar LINHAS (chats), não apenas o embed
//                      - busca por empresa acento/ç/case-insensitive via companies.trade_name_search
//                      - mantém modelo MA via código, sem interferir no RLS
// Fluxo              : AcoesListTab -> useAcoesList -> listChats -> DB
// Alterações (2.6.2) :
//   • [FIX] companyName agora filtra linhas de chats (INNER JOIN em companies via !inner)
//   • [FIX] companyName agora usa companies.trade_name_search (acentos/ç OK)
//   • [FIX] Normalização do termo de companyName no service para alinhar com *_search
//   • [KEEP] Mantido escopo MA/user/admin como estava (RLS + filtro por author_user_id quando não-MA)
// ===================================================

import { supabase } from "@/lib/supabaseClient";
import { ChatListItem } from '@/types/chat';
import { getCurrentProfile } from '@/services/profilesService';

export type BudgetDraft = {
  id?: string;
  description: string;
  amount: number;
  status: "aberta" | "ganha" | "perdida";
  loss_reason?: string | null;
};

const CHAT_COLUMNS = new Set([
  "id", "tenant_id", "company_id", "contact_id", "deal_id", "owner_user_id",
  "author_user_id", "thread_id", "reply_to_id", "kind", "direction", "channel_type",
  "subject", "body", "temperature", "priority", "calendar_at", "on_time",
  "timezone", "is_done", "done_at", "created_at", "updated_at", "tags", "budgets",
]);

function normalizeChatPayload(input: any) {
  const out: any = {};
  for (const k of Object.keys(input ?? {})) {
    if (CHAT_COLUMNS.has(k)) {
      out[k] = input[k];
    }
  }
  return out;
}

function requireCompany(payload: any) {
  if (!payload || typeof payload !== "object") throw new Error("Payload ausente.");
  const cid = String(payload.company_id ?? "").trim();
  if (!cid) throw new Error("Empresa inválida: company_id ausente.");
}

/**
 * Normaliza termo para bater com colunas *_search no DB:
 * - lower
 * - remove diacríticos (São -> sao, ação -> acao, ç -> c)
 */
function normalizeSearchTerm(value: string) {
  const v = (value ?? '').trim().toLowerCase();
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export async function createChat(payload: any) {
  requireCompany(payload);
  const normalized = normalizeChatPayload(payload);
  const { data, error } = await supabase
    .from("chats")
    .insert(normalized)
    .select()
    .single();

  if (error) throw new Error("Erro ao criar ação: " + error.message);
  return data;
}

export async function updateChat(chatId: string, payload: any) {
  if (!chatId) throw new Error("ID do chat ausente para atualização.");
  requireCompany(payload);
  const normalized = normalizeChatPayload(payload);
  const { data, error } = await supabase
    .from("chats")
    .update(normalized)
    .eq("id", chatId)
    .select()
    .single();

  if (error) throw new Error("Erro ao atualizar ação: " + error.message);
  return data;
}

export async function upsertChat(payload: any) {
  payload.temperature = payload?.temperature || "Neutra";
  const hasId = Boolean(payload?.id);
  return hasId ? updateChat(payload.id, payload) : createChat(payload);
}

export async function getChatById(chatId: string) {
  if (!chatId) throw new Error("ID do chat ausente para busca.");

  const { data, error } = await supabase
    .from("chats")
    .select(`
      id,
      tenant_id,
      company_id,
      contact_id,
      kind,
      direction,
      channel_type,
      subject,
      body,
      temperature,
      priority,
      calendar_at,
      on_time,
      timezone,
      is_done,
      done_at,
      created_at,
      updated_at,
      deal_id,
      budgets,
      tags
    `)
    .eq("id", chatId)
    .single();

  if (error) throw new Error("Erro ao buscar chat: " + error.message);
  return data;
}

export async function appendBudget(chatId: string, draft: BudgetDraft) {
  if (!chatId) throw new Error("ID do chat ausente para criar orçamento.");

  const { data, error } = await supabase.rpc("chats_append_budget", {
    p_chat_id: chatId,
    p_budget: {
      description: draft.description,
      amount: draft.amount,
      status: draft.status,
      loss_reason: draft.loss_reason ?? null,
    },
  });

  if (error) throw new Error("Erro ao criar orçamento: " + error.message);
  return data;
}

export async function updateBudget(chatId: string, draft: BudgetDraft) {
  if (!chatId) throw new Error("ID do chat ausente para atualizar orçamento.");
  if (!draft?.id) throw new Error("BudgetDraft.id obrigatório para atualização.");

  const { data, error } = await supabase.rpc("chats_update_budget", {
    p_chat_id: chatId,
    p_budget_id: draft.id,
    p_budget: {
      description: draft.description,
      amount: draft.amount,
      status: draft.status,
      loss_reason: draft.loss_reason ?? null,
    },
  });

  if (error) throw new Error("Erro ao atualizar orçamento: " + error.message);
  return data;
}

export async function attachDeal(chatId: string, dealId: string) {
  if (!chatId) throw new Error("ID do chat ausente para vínculo com deal.");
  if (!dealId) throw new Error("ID do deal ausente para vínculo.");

  const { data: chat, error: chatErr } = await supabase
    .from("chats")
    .select("id, tenant_id, deal_id")
    .eq("id", chatId)
    .single();

  if (chatErr) throw new Error("Erro ao verificar chat: " + chatErr.message);
  if (!chat) throw new Error("Chat não encontrado.");
  if (chat.deal_id) throw new Error("Este chat já está vinculado a um deal.");

  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .select("id, tenant_id")
    .eq("id", dealId)
    .single();

  if (dealErr) throw new Error("Erro ao verificar deal: " + dealErr.message);
  if (!deal) throw new Error("Deal não encontrado.");
  if (deal.tenant_id !== chat.tenant_id) {
    throw new Error("O chat e o deal pertencem a tenants diferentes.");
  }

  const { error: updateErr } = await supabase
    .from("chats")
    .update({ deal_id: dealId })
    .eq("id", chatId);

  if (updateErr) throw new Error("Erro ao vincular chat: " + updateErr.message);
  return true;
}

// Nova função para a listagem de ações
export interface ListChatsParams {
  q?: string;
  status?: 'true' | 'false' | 'all';
  type?: string;
  channel?: string;
  companyName?: string;
  contactName?: string;
  temperature?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export async function listChats(
  params: ListChatsParams
): Promise<{ items: ChatListItem[]; total: number }> {
  const {
    q,
    status = 'all',
    type,
    channel,
    companyName,
    contactName,
    temperature,
    sortBy = 'calendar_at',
    sortOrder = 'desc',
    page = 1,
    pageSize = 15,
  } = params;

  // -------------------------------------------
  // [SECURITY + MA] Escopo lógico de dono
  // RLS continua responsável por tenant.
  // -------------------------------------------
  const profile = await getCurrentProfile();
  if (!profile || !profile.id) {
    throw new Error('Perfil atual não encontrado para carregar ações.');
  }

  /**
   * PONTO CRÍTICO:
   * - Para que filtros em "company" e "contact" filtrem as LINHAS (chats),
   *   precisamos usar !inner no embed quando o filtro estiver ativo.
   *
   * Caso contrário, o PostgREST apenas filtra o objeto embutido e mantém a linha,
   * causando "empresa sumindo" sem remover a linha.
   */
  const companyEmbed = companyName
    ? `company:companies!inner(trade_name, trade_name_search)`
    : `company:companies(trade_name)`;

  const contactEmbed = contactName
    ? `contact:contacts!inner(full_name)`
    : `contact:contacts(full_name)`;

  let query = supabase
    .from('chats')
    .select(
      `
      id,
      tenant_id,
      kind,
      channel_type,
      calendar_at,
      on_time,
      subject,
      body,
      priority,
      temperature,
      is_done,
      done_at,
      tags,
      budgets,
      updated_at,
      ${companyEmbed},
      ${contactEmbed},
      author:profiles!chats_author_user_id_fkey(full_name)
    `,
      { count: 'exact' }
    );

  // user/admin (is_master_admin !== true) → mantém filtro por responsável
  // MA (is_master_admin === true) → vê todos os chats permitidos pelo RLS
  if (!profile.is_master_admin) {
    query = query.eq('author_user_id', profile.id);
  }

  if (q) {
    query = query.or(`subject.ilike.%${q}%,body.ilike.%${q}%`);
  }

  if (status !== 'all') {
    query = query.eq('is_done', status === 'true');
  }

  if (type) {
    query = query.eq('kind', type);
  }

  if (channel) {
    query = query.eq('channel_type', channel);
  }

  // ✅ Empresa: usa coluna materializada sem acento/ç e filtra LINHAS (via !inner)
  if (companyName && companyName.trim()) {
    const term = normalizeSearchTerm(companyName);
    query = query.ilike('company.trade_name_search', `%${term}%`);
  }

  // Contato: permanece como estava (se quiser acento/ç aqui também, recomendo criar contacts.full_name_search)
  if (contactName && contactName.trim()) {
    query = query.ilike('contact.full_name', `%${contactName.trim()}%`);
  }

  if (temperature) {
    query = query.eq('temperature', temperature);
  }

  if (sortBy) {
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
  }

  const offset = (page - 1) * pageSize;
  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching chats:', error);
    throw new Error('Falha ao carregar ações.');
  }

  const items: ChatListItem[] = (data || []).map((row: any) => ({
    id: row.id,
    kind: row.kind,
    channel_type: row.channel_type,
    calendar_at: row.calendar_at,
    on_time: row.on_time,
    company_name: row.company?.trade_name || null,
    contact_name: row.contact?.full_name || null,
    author_name: row.author?.full_name || null,
    priority: row.priority,
    temperature: row.temperature,
    is_done: row.is_done,
    done_at: row.done_at,
    tags: row.tags,
    subject: row.subject,
    body: row.body,
    updated_at: row.updated_at,
    budgets: row.budgets ?? null,
  }));

  return { items, total: count || 0 };
}

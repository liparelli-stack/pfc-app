/*
-- ===================================================
-- Código             : /src/services/agendaXBridge.ts
-- Versão (.v24)      : 1.8.7
-- Data/Hora          : 2025-12-17 12:10 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Camada de leitura agregada da Agenda X (read-only),
--                      com contagens diárias e perfil completo da empresa enriquecido.
--                      + NOVO: funções globais (tenant/RLS) para Timeline V1 (Modo Agenda).
-- Fluxo              : AgendaXPage -> DayContextPanel -> (company|agenda) -> agendaXBridge -> Supabase (RLS)
-- Alterações (1.8.7) :
--   • [NEW] getTimelineChatsByDay(dayISO) (global, sem companyId)
--   • [NEW] getTimelineChatsHistory({dayISO, search, limit}) (global, sem paginação)
--   • [SAFE] Reusa fallback progressivo e enrich de contatos.
-- ===================================================
*/

import { supabase } from '@/lib/supabaseClient';

/* =========================
 * Tipos compartilhados
 * ========================= */
export interface AXCompanyFull {
  company: {
    id: string;
    trade_name: string;
    legal_name?: string | null;
    tax_id?: string | null;
    segment?: string | null;
    source_company?: string | null;
    status: string;
    qualification?: number | null;
    owner?: string | null;
    kind?: string | null;
    responsible_full_name?: string | null;

    website?: string | null;
    email?: string | null;
    phone?: string | null;
    address_line?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;

    notes?: any[];
  };
  contacts: Array<{
    id: string;
    full_name: string;
    email?: string | null;
    phone?: string | null;

    is_primary?: boolean | null;

    position?: string | null;
    department?: string | null;
    status?: string | null;
    contact_guard?: string | null;
    channels_json?: any[] | null;
  }>;
  channels?: Array<{ id: string; type: string; value: string }>;
  deals: Array<{
    id: string;
    name: string | null;
    pipeline_stage: string | null;
    status: string | null;
    amount?: number | null;
    currency?: string | null;
  }>;
  tickets?: Array<{ id: string; status: string | null; subject: string | null }>;
}

export interface AXChat {
  id: string;

  company_id?: string | null;
  company_trade_name?: string | null;

  contact_id?: string | null;
  contact_full_name?: string | null;

  kind: string;
  subject: string | null;
  body?: string | null;
  temperature?: string | null;
  priority?: string | null;

  is_done?: boolean | null;
  calendar_at?: string | null;
  on_time?: string | null;

  direction?: 'inbound' | 'outbound' | 'internal' | 'inout' | null;
  channel_type?: string | null;

  budgets?: any[] | null;
  updated_at: string;
  created_at?: string;
}

export interface DayCompanyContext {
  id: string;
  trade_name: string;
  contacts: any[];
  chats: any[];
  deals: any[];
  errors?: string[];
}

/* =========================
 * Utils internos
 * ========================= */
function toIsoYmdUTC(d: Date): string {
  const tz = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return tz.toISOString().slice(0, 10);
}
function toIsoYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function monthRange(year: number, monthZeroBased: number): { from: string; to: string } {
  const from = new Date(Date.UTC(year, monthZeroBased, 1));
  const to = new Date(Date.UTC(year, monthZeroBased + 1, 1)); // exclusivo
  return { from: toIsoYmdUTC(from), to: toIsoYmdUTC(to) };
}
function normalizeJsonbArray(raw: unknown): any[] {
  if (raw == null) return [];
  try {
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/* ================
 * Helpers Channels
 * ================ */
type AXChannelLike = { type: string; value: string; is_preferred?: boolean };

function channelKey(c: AXChannelLike) {
  const t = String(c.type || '').trim().toLowerCase();
  const v = String(c.value || '').trim().toLowerCase();
  return `${t}::${v}`;
}

function mergeChannels(a: AXChannelLike[], b: AXChannelLike[]): AXChannelLike[] {
  const map = new Map<string, AXChannelLike>();

  for (const c of a ?? []) {
    if (!c?.type || !c?.value) continue;
    map.set(channelKey(c), { type: c.type, value: c.value, is_preferred: !!c.is_preferred });
  }
  for (const c of b ?? []) {
    if (!c?.type || !c?.value) continue;
    const k = channelKey(c);
    const prev = map.get(k);
    if (!prev) {
      map.set(k, { type: c.type, value: c.value, is_preferred: !!c.is_preferred });
    } else {
      map.set(k, { ...prev, is_preferred: !!prev.is_preferred || !!c.is_preferred });
    }
  }

  const out = Array.from(map.values());
  out.sort((x, y) => {
    const px = x.is_preferred ? 1 : 0;
    const py = y.is_preferred ? 1 : 0;
    if (px !== py) return py - px;
    const tx = String(x.type || '').localeCompare(String(y.type || ''));
    if (tx !== 0) return tx;
    return String(x.value || '').localeCompare(String(y.value || ''));
  });
  return out;
}

/* =========================
 * Helper: enrich contact_full_name
 * ========================= */
async function enrichChatsWithContactNames(items: AXChat[]): Promise<AXChat[]> {
  const need = items
    .filter((c) => !!c.contact_id && (!c.contact_full_name || String(c.contact_full_name).trim() === ''))
    .map((c) => String(c.contact_id));

  const ids = Array.from(new Set(need));
  if (ids.length === 0) return items;

  const { data, error } = await supabase
    .from('contacts')
    .select('id, full_name')
    .in('id', ids);

  if (error) {
    console.warn('[AgendaXBridge] enrichChatsWithContactNames erro:', error);
    return items;
  }

  const map = new Map<string, string>();
  for (const r of (data as any[]) ?? []) {
    if (r?.id && r?.full_name) map.set(String(r.id), String(r.full_name));
  }

  return items.map((c) => {
    if (!c.contact_id) return c;
    if (c.contact_full_name && String(c.contact_full_name).trim()) return c;
    const fullName = map.get(String(c.contact_id)) ?? null;
    return { ...c, contact_full_name: fullName };
  });
}

/* =========================
 * Helper: select com fallback progressivo (por company)
 * ========================= */
async function selectAgendaxChatsProgressive(
  companyId: string,
  baseWhere: (q: any) => any,
  withCount: boolean
): Promise<{ data: any[]; count?: number; error: any | null }> {
  const selectFull = [
    'id',
    'company_id',
    'company_trade_name',
    'contact_id',
    'contact_full_name',
    'kind',
    'direction',
    'channel_type',
    'subject',
    'body',
    'temperature',
    'priority',
    'is_done',
    'calendar_at',
    'on_time',
    'budgets',
    'updated_at',
    'created_at',
  ].join(', ');

  const selectPartial = [
    'id',
    'company_id',
    'company_trade_name',
    'contact_id',
    'kind',
    'direction',
    'channel_type',
    'subject',
    'body',
    'temperature',
    'priority',
    'is_done',
    'calendar_at',
    'on_time',
    'budgets',
    'updated_at',
    'created_at',
  ].join(', ');

  const selectLegacy = [
    'id',
    'kind',
    'direction',
    'channel_type',
    'subject',
    'body',
    'temperature',
    'priority',
    'is_done',
    'calendar_at',
    'on_time',
    'budgets',
    'updated_at',
    'created_at',
  ].join(', ');

  const trySelect = async (columns: string) => {
    let q = supabase
      .from('vw_agendax_chats')
      .select(columns, withCount ? { count: 'exact' } : undefined)
      .eq('company_id', companyId);

    q = baseWhere(q);
    return await q;
  };

  // 1) full
  try {
    const r1 = await trySelect(selectFull);
    if (!r1.error) return { data: (r1.data as any[]) ?? [], count: (r1 as any).count, error: null };
    console.warn('[AgendaXBridge] vw_agendax_chats selectFull falhou; tentando partial.', r1.error);
  } catch (e) {
    console.warn('[AgendaXBridge] vw_agendax_chats selectFull exception; tentando partial.', e);
  }

  // 2) partial
  try {
    const r2 = await trySelect(selectPartial);
    if (!r2.error) return { data: (r2.data as any[]) ?? [], count: (r2 as any).count, error: null };
    console.warn('[AgendaXBridge] vw_agendax_chats selectPartial falhou; usando legacy.', r2.error);
  } catch (e) {
    console.warn('[AgendaXBridge] vw_agendax_chats selectPartial exception; usando legacy.', e);
  }

  // 3) legacy
  const r3 = await trySelect(selectLegacy);
  return { data: (r3.data as any[]) ?? [], count: (r3 as any).count, error: r3.error ?? null };
}

/* =========================
 * Helper: select com fallback progressivo (GLOBAL / tenant via RLS)
 * ========================= */
async function selectAgendaxChatsProgressiveGlobal(
  baseWhere: (q: any) => any
): Promise<{ data: any[]; error: any | null }> {
  const selectFull = [
    'id',
    'company_id',
    'company_trade_name',
    'contact_id',
    'contact_full_name',
    'kind',
    'direction',
    'channel_type',
    'subject',
    'body',
    'temperature',
    'priority',
    'is_done',
    'calendar_at',
    'on_time',
    'budgets',
    'updated_at',
    'created_at',
  ].join(', ');

  const selectPartial = [
    'id',
    'company_id',
    'company_trade_name',
    'contact_id',
    'kind',
    'direction',
    'channel_type',
    'subject',
    'body',
    'temperature',
    'priority',
    'is_done',
    'calendar_at',
    'on_time',
    'budgets',
    'updated_at',
    'created_at',
  ].join(', ');

  const selectLegacy = [
    'id',
    'kind',
    'direction',
    'channel_type',
    'subject',
    'body',
    'temperature',
    'priority',
    'is_done',
    'calendar_at',
    'on_time',
    'budgets',
    'updated_at',
    'created_at',
  ].join(', ');

  const trySelect = async (columns: string) => {
    let q = supabase.from('vw_agendax_chats').select(columns);
    q = baseWhere(q);
    return await q;
  };

  // 1) full
  try {
    const r1 = await trySelect(selectFull);
    if (!r1.error) return { data: (r1.data as any[]) ?? [], error: null };
    console.warn('[AgendaXBridge] GLOBAL selectFull falhou; tentando partial.', r1.error);
  } catch (e) {
    console.warn('[AgendaXBridge] GLOBAL selectFull exception; tentando partial.', e);
  }

  // 2) partial
  try {
    const r2 = await trySelect(selectPartial);
    if (!r2.error) return { data: (r2.data as any[]) ?? [], error: null };
    console.warn('[AgendaXBridge] GLOBAL selectPartial falhou; usando legacy.', r2.error);
  } catch (e) {
    console.warn('[AgendaXBridge] GLOBAL selectPartial exception; usando legacy.', e);
  }

  // 3) legacy
  const r3 = await trySelect(selectLegacy);
  return { data: (r3.data as any[]) ?? [], error: r3.error ?? null };
}

/* ==========================================================
 * 1) Empresas do dia com contagem (agenda diária)
 * ========================================================== */
export async function getCompaniesByDayWithCounts(
  dayISO: string
): Promise<Array<{ id: string; trade_name: string; counts: { today: number } }>> {
  const { data, error } = await supabase
    .from('vw_agendax_chats')
    .select('company_id, company_trade_name')
    .eq('calendar_at', dayISO)
    .not('company_id', 'is', null);

  if (error) {
    console.warn('[AgendaXBridge] getCompaniesByDayWithCounts erro:', error);
    return [];
  }

  const map = new Map<string, { trade_name: string; count: number }>();
  for (const row of data as any[]) {
    const id = row.company_id as string;
    const name = (row.company_trade_name as string) || '(Sem nome)';
    const prev = map.get(id);
    map.set(id, { trade_name: name, count: (prev?.count ?? 0) + 1 });
  }

  return Array.from(map.entries()).map(([id, v]) => ({
    id,
    trade_name: v.trade_name,
    counts: { today: v.count },
  }));
}

/* ==========================================================
 * 2) Perfil completo da empresa (sem gráficos)
 * ========================================================== */
export async function getCompanyFull(companyId: string) {
  const [companyRes, dealsRes] = await Promise.all([
    supabase
      .from('companies')
      .select(
        'id, trade_name, legal_name, tax_id, segment, source_company, status, qualification, owner, kind, website, email, phone, address_line, city, state, zip_code, notes'
      )
      .eq('id', companyId)
      .limit(1)
      .single(),
    supabase
      .from('deals')
      .select('id, name, pipeline_stage, status, amount, currency')
      .eq('company_id', companyId)
      .order('updated_at', { ascending: false }),
  ]);

  if (companyRes.error) console.warn('[AgendaXBridge] getCompanyFull company erro:', companyRes.error);
  if (dealsRes.error) console.warn('[AgendaXBridge] getCompanyFull deals erro:', dealsRes.error);

  const companyRow =
    (companyRes.data as any) ?? { id: companyId, trade_name: '(Desconhecida)', status: 'active' };

  const notesNormalized = normalizeJsonbArray(companyRow?.notes);

  const company = {
    id: companyRow.id as string,
    trade_name: companyRow.trade_name as string,
    legal_name: companyRow.legal_name ?? null,
    tax_id: companyRow.tax_id ?? null,
    segment: companyRow.segment ?? null,
    source_company: companyRow.source_company ?? null,
    status: companyRow.status as string,
    qualification: companyRow.qualification ?? null,
    owner: companyRow.owner ?? null,
    kind: companyRow.kind ?? null,
    website: companyRow.website ?? null,
    email: companyRow.email ?? null,
    phone: companyRow.phone ?? null,
    address_line: companyRow.address_line ?? null,
    city: companyRow.city ?? null,
    state: companyRow.state ?? null,
    zip_code: companyRow.zip_code ?? null,
    notes: notesNormalized,
  } as AXCompanyFull['company'];

  const embedRes = await supabase
    .from('contacts')
    .select(
      `
      id,
      full_name,
      email,
      phone,
      is_primary,
      position,
      department,
      status,
      contact_guard,
      channels_json,
      channels:contacts_channel!contacts_channel_contact_id_fkey (
        type,
        value,
        is_preferred
      )
    `
    )
    .eq('company_id', companyId)
    .order('is_primary', { ascending: false })
    .order('full_name', { ascending: true });

  if (embedRes.error) {
    console.warn('[AgendaXBridge] getCompanyFull contacts(embed) erro:', embedRes.error);
  }

  const rawContacts = (Array.isArray(embedRes.data) ? (embedRes.data as any[]) : []) ?? [];

  const contactsEnriched = rawContacts.map((c: any) => {
    const existing: AXChannelLike[] = normalizeJsonbArray(c?.channels_json)
      .map((x: any) => ({
        type: x?.type ?? x?.channel_type ?? '',
        value: x?.value ?? '',
        is_preferred: !!x?.is_preferred,
      }))
      .filter((x: any) => x.type && x.value);

    const fromEmbed: AXChannelLike[] = (Array.isArray(c?.channels) ? c.channels : [])
      .map((x: any) => ({
        type: String(x?.type ?? ''),
        value: String(x?.value ?? ''),
        is_preferred: !!x?.is_preferred,
      }))
      .filter((x: any) => x.type && x.value);

    let channels_json = mergeChannels(existing, fromEmbed);

    if ((!channels_json || channels_json.length === 0) && (c.email || c.phone)) {
      const fb: AXChannelLike[] = [];
      if (c.phone) fb.push({ type: 'phone', value: String(c.phone), is_preferred: false });
      if (c.email) fb.push({ type: 'email', value: String(c.email), is_preferred: false });
      channels_json = mergeChannels([], fb);
    }

    return {
      id: c.id as string,
      full_name: c.full_name as string,
      email: c.email ?? null,
      phone: c.phone ?? null,
      is_primary: c.is_primary ?? null,
      position: c.position ?? null,
      department: c.department ?? null,
      status: c.status ?? null,
      contact_guard: c.contact_guard ?? null,
      channels_json,
    };
  });

  let responsible_full_name: string | null = null;
  if (company?.owner) {
    try {
      const { data: profile, error: pErr } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', company.owner)
        .limit(1)
        .single();

      if (!pErr && profile?.full_name) {
        responsible_full_name = profile.full_name as string;
      }
    } catch (e) {
      console.warn('[AgendaXBridge] getCompanyFull resolver responsável erro:', e);
    }
  }

  return {
    company: {
      ...company,
      responsible_full_name,
    },
    contacts: contactsEnriched,
    deals: (dealsRes.data as any[]) ?? [],
  };
}

/* ==========================================================
 * 3) Chats do dia — vw_agendax_chats (por empresa)
 * ========================================================== */
export async function getCompanyChatsByDay(companyId: string, dayISO: string): Promise<AXChat[]> {
  const res = await selectAgendaxChatsProgressive(
    companyId,
    (q) => q.eq('calendar_at', dayISO).order('updated_at', { ascending: false }),
    false
  );

  if (res.error) {
    console.warn('[AgendaXBridge] getCompanyChatsByDay erro:', res.error);
    return [];
  }

  const items = (res.data as AXChat[]) ?? [];
  return await enrichChatsWithContactNames(items);
}

/* ==========================================================
 * 4) Histórico de chats — vw_agendax_chats (por empresa)
 * ========================================================== */
export async function getCompanyChatsHistory(
  companyId: string,
  opts: { page: number; pageSize: number; search?: string; dayISO?: string }
): Promise<{ items: AXChat[]; total: number }> {
  const page = Math.max(1, opts.page);
  const pageSize = Math.max(1, Math.min(100, opts.pageSize));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const res = await selectAgendaxChatsProgressive(
    companyId,
    (q) => {
      let query = q.order('updated_at', { ascending: false });

      if (opts.dayISO) query = query.neq('calendar_at', opts.dayISO);
      if (opts.search && opts.search.trim().length > 0) {
        const s = `%${opts.search.trim()}%`;
        query = query.or(`subject.ilike.${s},body.ilike.${s}`);
      }

      return query.range(from, to);
    },
    true
  );

  if (res.error) {
    console.warn('[AgendaXBridge] getCompanyChatsHistory erro:', res.error);
    return { items: [], total: 0 };
  }

  const items = await enrichChatsWithContactNames(((res.data as AXChat[]) ?? []));
  return { items, total: res.count ?? 0 };
}

/* ==========================================================
 * 4.9) NOVO — Chats do dia (GLOBAL / tenant via RLS) — V1
 * ========================================================== */
export async function getTimelineChatsByDay(dayISO: string): Promise<AXChat[]> {
  const res = await selectAgendaxChatsProgressiveGlobal((q) =>
    q.eq('calendar_at', dayISO).order('updated_at', { ascending: false })
  );

  if (res.error) {
    console.warn('[AgendaXBridge] getTimelineChatsByDay erro:', res.error);
    return [];
  }

  const items = (res.data as AXChat[]) ?? [];
  return await enrichChatsWithContactNames(items);
}

/* ==========================================================
 * 4.10) NOVO — Histórico (GLOBAL / tenant via RLS) — V1 (sem paginação)
 * ========================================================== */
export async function getTimelineChatsHistory(opts: {
  dayISO?: string;
  search?: string;
  limit?: number; // default 500
}): Promise<AXChat[]> {
  const limit = Math.max(1, Math.min(2000, opts.limit ?? 500));

  const res = await selectAgendaxChatsProgressiveGlobal((q) => {
    let query = q.order('updated_at', { ascending: false });

    if (opts.dayISO) query = query.neq('calendar_at', opts.dayISO);
    if (opts.search && opts.search.trim().length > 0) {
      const s = `%${opts.search.trim()}%`;
      query = query.or(`subject.ilike.${s},body.ilike.${s}`);
    }

    return query.limit(limit);
  });

  if (res.error) {
    console.warn('[AgendaXBridge] getTimelineChatsHistory erro:', res.error);
    return [];
  }

  const items = (res.data as AXChat[]) ?? [];
  return await enrichChatsWithContactNames(items);
}

/* ==========================================================
 * 5) Contagem simples por dia (legado)
 * ========================================================== */
export async function getDayCountsForMonth(
  year: number,
  monthZeroBased: number
): Promise<Record<string, number>> {
  const { from, to } = monthRange(year, monthZeroBased);
  const { data, error } = await supabase
    .from('vw_agendax_chats')
    .select('calendar_at')
    .gte('calendar_at', from)
    .lt('calendar_at', to)
    .eq('is_done', false);

  if (error) {
    console.warn('[AgendaXBridge] getDayCountsForMonth erro:', error);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data as Array<{ calendar_at: string | null }>) {
    const d = row.calendar_at;
    if (!d) continue;
    counts[d] = (counts[d] ?? 0) + 1;
  }
  return counts;
}

/* ==========================================================
 * 5.1) Contagem dividida por dia (AgendaX – mini calendário)
 * ========================================================== */
export async function getDaySplitCountsForMonth(
  year: number,
  monthZeroBased: number
): Promise<Record<string, { todayActive: number; overdue: number; done: number }>> {
  const { from, to } = monthRange(year, monthZeroBased);

  const { data, error } = await supabase
    .from('vw_agendax_chats')
    .select('calendar_at, is_done')
    .gte('calendar_at', from)
    .lt('calendar_at', to);

  if (error) {
    console.warn('[AgendaXBridge] getDaySplitCountsForMonth erro:', error);
    return {};
  }

  const todayYmd = toIsoYmdLocal(new Date());
  const perDay: Record<string, { todayActive: number; overdue: number; done: number }> = {};

  for (const row of (data as Array<{ calendar_at: string | null; is_done: boolean | null }>) ?? []) {
    const ymd = row.calendar_at;
    if (!ymd) continue;

    if (!perDay[ymd]) perDay[ymd] = { todayActive: 0, overdue: 0, done: 0 };

    const isDone = !!row.is_done;
    if (isDone) {
      perDay[ymd].done += 1;
      continue;
    }

    if (ymd < todayYmd) perDay[ymd].overdue += 1;
    else perDay[ymd].todayActive += 1;
  }

  return perDay;
}

/* ==========================================================
 * 6) Retrocompatibilidade: getDayContext(date) (legado)
 * ========================================================== */
export async function getDayContext(date: string): Promise<DayCompanyContext[]> {
  const { data: chats, error } = await supabase
    .from('vw_agendax_chats')
    .select('id, company_id, company_trade_name, subject, temperature, priority')
    .eq('calendar_at', date)
    .eq('is_done', false)
    .not('company_id', 'is', null);

  if (error) {
    console.warn('[AgendaXBridge] getDayContext erro:', error);
    return [];
  }

  const chatsArr = (chats as any[]) ?? [];

  const uniqueCompanies = Array.from(
    new Map(chatsArr.map((c: any) => [c.company_id, c.company_trade_name])).entries()
  ).map(([id, trade_name]) => ({ id, trade_name }));

  const results: DayCompanyContext[] = [];
  const settled = await Promise.allSettled(
    uniqueCompanies.map(async (company) => {
      const [contacts, deals] = await Promise.allSettled([
        supabase
          .from('contacts')
          .select('id, full_name, phone, email')
          .eq('company_id', company.id)
          .eq('is_primary', true),
        supabase
          .from('deals')
          .select('id, name, amount, currency, pipeline_stage, status')
          .eq('company_id', company.id),
      ]);

      const errors: string[] = [];
      const contactsData = contacts.status === 'fulfilled' ? (contacts.value.data as any[]) ?? [] : [];
      const dealsData = deals.status === 'fulfilled' ? (deals.value.data as any[]) ?? [] : [];
      if (contacts.status === 'rejected') errors.push('contatos');
      if (deals.status === 'rejected') errors.push('negócios');

      results.push({
        id: company.id as string,
        trade_name: (company.trade_name as string) || '(Sem nome)',
        contacts: contactsData,
        chats: chatsArr.filter((c) => c.company_id === company.id),
        deals: dealsData,
        errors,
      });
    })
  );

  if (settled.some((s) => s.status === 'rejected')) {
    console.warn('[AgendaXBridge] getDayContext: falhas parciais no carregamento.');
  }

  return results;
}

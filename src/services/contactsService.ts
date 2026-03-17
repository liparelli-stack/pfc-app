/*
-- ===================================================
-- Código                 : /src/services/contactsService.ts
-- Versão (.v20)          : 3.7.1
-- Data/Hora              : 2025-12-18 00:00 America/Sao_Paulo
-- Autor                  : FL/Eva GPT
-- Objetivo               : Corrigir filtro "Empresa" em Listas > Contatos:
--                          - filtrar LINHAS (contacts) e não apenas o embed
--                          - tornar busca acento/ç/case-insensitive via *_search
--                          - aplicar somente com mínimo de 3 letras
-- Alterações (3.7.1) :
--   • [FIX] companyName agora usa companies!inner(...) para filtrar linhas.
--   • [FIX] companyName agora filtra por companies.trade_name_search (acentos/ç OK).
--   • [UX] companyName só aplica quando tiver >= 3 caracteres.
-- Dependências           : @/lib/supabaseClient, @/types/contact
-- ===================================================
*/

import { supabase } from '@/lib/supabaseClient';
import type { Contact, ContactWithCompany } from '@/types/contact';

// ... (Manter código existente de antiflicker, constants e CRUD básico inalterado) ...
/* =============================================================================
[--BLOCO--] Estado interno (antiflicker) - preservado
============================================================================= */
const inflight = new Map<string, Promise<Contact[]>>();   // por companyId
const lastSuccess = new Map<string, Contact[]>();         // cache de sucesso
const lastErrorAt = new Map<string, number>();            // timestamp ms por companyId

const COOLDOWN_MS = 20_000; // 20s após erro
const TIMEOUT_MS  = 5_000;  // timeout por tentativa
const MAX_TRIES   = 3;      // 3 tentativas
const BACKOFF_MS  = [500, 1000, 2000];

function now() { return Date.now(); }
function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label = 'contacts:listByCompany'
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label}: timeout after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(id); resolve(v); })
     .catch((e) => { clearTimeout(id); reject(e); });
  });
}

const CONTACTS_TABLE = 'contacts';
const CONTACTS_WITH_CHANNELS_SELECT =
  'id, tenant_id, company_id, full_name, position, department, contact_guard, status, notes, export_state, created_at, updated_at, birth_day_month, channels:contacts_channel(id, type, value, label_custom, is_preferred)';

/* =============================================================================
[--BLOCO--] Helpers
============================================================================= */

/**
 * Normaliza termo para bater com colunas *_search no DB:
 * - lower
 * - remove diacríticos (São -> sao, ação -> acao, ç -> c)
 */
function normalizeSearchTerm(value: string) {
  const v = (value ?? '').trim().toLowerCase();
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/* =============================================================================
[--BLOCO--] LIST (com breaker) — TABELA `contacts`
============================================================================= */
export const listByCompany = async (companyId: string): Promise<Contact[]> => {
  if (!companyId) return [];

  const lastErr = lastErrorAt.get(companyId) ?? 0;
  if (lastErr && now() - lastErr < COOLDOWN_MS) {
    const cached = lastSuccess.get(companyId);
    if (cached) return cached;
    throw new Error('contacts:listByCompany em cooldown de erro. Tente novamente em alguns segundos.');
  }

  const inflightExisting = inflight.get(companyId);
  if (inflightExisting) return inflightExisting;

  const job = (async (): Promise<Contact[]> => {
    let lastErrObj: unknown = null;

    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      try {
        const { data, error } = await withTimeout(
          supabase
            .from(CONTACTS_TABLE)
            .select(CONTACTS_WITH_CHANNELS_SELECT)
            .eq('company_id', companyId)
            .order('full_name', { ascending: true }),
          TIMEOUT_MS,
          'contacts:listByCompany(table)'
        );

        if (error) throw error;

        const rows = (data || []) as Contact[];
        lastSuccess.set(companyId, rows);
        lastErrorAt.delete(companyId);
        return rows;
      } catch (err: any) {
        lastErrObj = err;
        lastErrorAt.set(companyId, now());

        if (attempt < MAX_TRIES - 1) {
          await sleep(BACKOFF_MS[attempt] ?? 1000);
          continue;
        }

        const cached = lastSuccess.get(companyId);
        if (cached) return cached;
        throw new Error(err?.message || 'Falha ao carregar contatos (rede).');
      }
    }

    const cached = lastSuccess.get(companyId);
    if (cached) return cached;
    throw lastErrObj ?? new Error('Falha desconhecida em listByCompany.');
  })();

  inflight.set(companyId, job);
  try {
    return await job;
  } finally {
    inflight.delete(companyId);
  }
};

export const getById = async (contactId: string): Promise<Contact | null> => {
  if (!contactId) return null;

  const { data, error } = await supabase
    .from(CONTACTS_TABLE)
    .select(CONTACTS_WITH_CHANNELS_SELECT)
    .eq('id', contactId)
    .maybeSingle();

  if (error) {
    console.error('[contactsService.getById(table)] error:', error);
    return null;
  }

  return (data as unknown as Contact) ?? null;
};

/* =============================================================================
[--BLOCO--] CRUD (TABELA `contacts`) — SANITIZAÇÃO
============================================================================= */
const toNullIfEmpty = (v: unknown) => (v === '' ? null : v);
const CONTACT_TABLE_COLUMNS: Array<keyof Partial<Contact>> = [
  'id', 'company_id', 'full_name', 'position', 'department', 'contact_guard', 'status', 'notes', 'export_state', 'birth_day_month',
];

function sanitizeToContactsTable(input: Partial<Contact>) {
  const out: Record<string, unknown> = {};
  for (const k of CONTACT_TABLE_COLUMNS) {
    if (k in input) {
      // @ts-expect-error compat
      out[k] = input[k];
    }
  }
  if ('company_id' in out) out['company_id'] = toNullIfEmpty(out['company_id']);
  delete (out as any).tenant_id;
  delete (out as any).channels;
  delete (out as any).channels_count;
  delete (out as any).created_at;
  delete (out as any).updated_at;
  return out;
}

const BASE_SELECT =
  'id, tenant_id, company_id, full_name, position, department, contact_guard, status, notes, export_state, created_at, updated_at, birth_day_month';

export const createContact = async (contactData: Partial<Contact>): Promise<Contact> => {
  const payload = sanitizeToContactsTable(contactData);
  const { data, error } = await supabase
    .from(CONTACTS_TABLE)
    .insert(payload)
    .select(BASE_SELECT)
    .single();

  if (error) {
    console.error('Error creating contact:', { payload, error });
    throw error;
  }
  const view = await getById((data as any).id);
  return (view as Contact) ?? (data as Contact);
};

export const updateContact = async (id: string, contactData: Partial<Contact>): Promise<Contact> => {
  if (!id) throw new Error('updateContact: id é obrigatório.');
  const payload = sanitizeToContactsTable(contactData);
  const { data, error } = await supabase
    .from(CONTACTS_TABLE)
    .update(payload)
    .eq('id', id)
    .select(BASE_SELECT)
    .single();

  if (error) {
    console.error('Error updating contact:', { id, payload, error });
    throw error;
  }
  const view = await getById(id);
  return (view as Contact) ?? (data as Contact);
};

export const deleteContact = async (id: string): Promise<void> => {
  const { error } = await supabase.from(CONTACTS_TABLE).delete().eq('id', id);
  if (error) {
    console.error('Error deleting contact:', { id, error });
    throw error;
  }
};

/* =============================================================================
[--BLOCO--] LISTAGEM GERAL (com company + canais)
============================================================================= */

export interface ListContactsParams {
  contactName?: string;
  companyName?: string;
  channelType?: 'email' | 'phone' | 'messaging' | 'all';
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  q?: string; // Mantido para compatibilidade
  // Novos filtros avançados
  email?: string;
  phone?: string;
  position?: string;
  department?: string;
}

export async function listContacts(
  params: ListContactsParams
): Promise<{ items: ContactWithCompany[]; total: number }> {
  const {
    contactName,
    companyName,
    q,
    channelType = 'all',
    page = 1,
    pageSize = 15,
    sortBy = 'full_name',
    sortOrder = 'asc',
    email,
    phone,
    position,
    department,
  } = params;

  // Regra: só aplica filtro de empresa com >= 3 letras
  const rawCompany = (companyName ?? '').trim();
  const hasCompanyFilter = rawCompany.length >= 3;

  /**
   * PONTO CRÍTICO:
   * - quando houver filtro por empresa, precisamos usar companies!inner(...)
   *   para que o filtro elimine LINHAS (contacts), não só o objeto embutido.
   * - também incluímos trade_name_search para filtro acento/ç-insensitive.
   */
  const companyEmbed = hasCompanyFilter
    ? 'company:companies!inner(id, trade_name, trade_name_search)'
    : 'company:companies(id, trade_name)';

  let query = supabase.from(CONTACTS_TABLE).select(
    `
    id,
    full_name,
    position,
    department,
    status,
    notes,
    birth_day_month,
    ${companyEmbed},
    channels:contacts_channel(id, type, value, label_custom, is_preferred)
  `,
    { count: 'exact' }
  );

  // Filtro por nome do contato (ou q genérico)
  const nameFilter = contactName?.trim() || q?.trim();
  if (nameFilter) {
    query = query.ilike('full_name', `%${nameFilter}%`);
  }

  // ✅ Filtro por nome da empresa (acentos/ç OK + filtra LINHAS via !inner)
  if (hasCompanyFilter) {
    const term = normalizeSearchTerm(rawCompany);
    query = query.ilike('company.trade_name_search', `%${term}%`);
  }

  // Filtro por Cargo
  if (position && position.trim()) {
    query = query.ilike('position', `%${position.trim()}%`);
  }

  // Filtro por Departamento
  if (department && department.trim()) {
    query = query.ilike('department', `%${department.trim()}%`);
  }

  // Filtro por Email (via contacts_channel)
  if (email && email.trim()) {
    const { data: emailIds } = await supabase
      .from('contacts_channel')
      .select('contact_id')
      .eq('type', 'email')
      .ilike('value', `%${email.trim()}%`);

    const ids = (emailIds || []).map((x: any) => x.contact_id);
    if (ids.length > 0) {
      query = query.in('id', ids);
    } else {
      return { items: [], total: 0 };
    }
  }

  // Filtro por Telefone (via contacts_channel)
  if (phone && phone.trim()) {
    const { data: phoneIds } = await supabase
      .from('contacts_channel')
      .select('contact_id')
      .eq('type', 'phone')
      .ilike('value', `%${phone.trim()}%`);

    const ids = (phoneIds || []).map((x: any) => x.contact_id);
    if (ids.length > 0) {
      query = query.in('id', ids);
    } else {
      return { items: [], total: 0 };
    }
  }

  // Filtro por tipo de canal (genérico)
  if (channelType !== 'all') {
    const { data: channelData, error: channelError } = await supabase
      .from('contacts_channel')
      .select('contact_id')
      .eq('type', channelType);

    if (channelError) {
      console.error('Error filtering by channel type:', channelError);
      throw new Error('Falha ao filtrar por canal.');
    }

    const contactIds = (channelData || []).map((c: any) => c.contact_id);
    if (contactIds.length > 0) {
      query = query.in('id', contactIds);
    } else {
      return { items: [], total: 0 };
    }
  }

  // Ordenação
  if (sortBy === 'company.trade_name') {
    // mantém a intenção original (ordenar pela empresa do embed)
    query = query.order('trade_name', { foreignTable: 'company', ascending: sortOrder === 'asc' });
  } else {
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
  }

  const offset = (page - 1) * pageSize;
  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching contacts:', error);
    throw new Error('Falha ao carregar contatos.');
  }

  return {
    items: (data as ContactWithCompany[]) || [],
    total: count || 0,
  };
}

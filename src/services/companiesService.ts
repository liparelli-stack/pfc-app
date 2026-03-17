/*
-- ===================================================
-- Código             : /src/services/companiesService.ts
-- Versão (.v20)      : 3.3.2
-- Data/Hora          : 2025-12-18 00:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Serviço de empresas (CRM) com listagem, CRUD, notas
--                      e filtro por responsável (owner = profiles.auth_user_id ou profiles.id).
-- Fluxo              : UI → services → Supabase → RLS
-- Alterações (3.3.2) :
--  • [FIX] Busca (q) agora é acento/ç/case-insensitive usando colunas materializadas:
--          trade_name_search / legal_name_search / tax_id_search.
--  • [FIX] Normalização do termo de busca no front (remove acentos e aplica lower),
--          alinhando com o padrão do banco.
--  • [KEEP] Mantida compatibilidade do enrichWithOwnerNames (auth_user_id ou profiles.id).
-- Dependências       : @/lib/supabaseClient, @/types/company, @/services/profilesService
-- ===================================================
*/

import { supabase } from '@/lib/supabaseClient';
import type {
  Company,
  CompanyWithContacts,
  CompanyWithContactsAndOwner,
  CompanyNote,
} from '@/types/company';
import { getCurrentProfile } from '@/services/profilesService';

/* --------------------------- Utilitários --------------------------- */

const sanitizeTaxId = (taxId: string | null | undefined): string | null => {
  if (!taxId) return null;
  const cleaned = taxId.replace(/[^\d]/g, '');
  if (cleaned.length === 11 || cleaned.length === 14) return cleaned;
  return null;
};

const sanitizeWebsite = (website: string | null | undefined): string | null => {
  if (!website) return null;
  if (website.startsWith('http://') || website.startsWith('https://')) return website;
  return `https://${website}`;
};

const sanitizeOwner = (owner: string | null | undefined): string | null => {
  if (!owner) return null;
  // owner armazena profiles.auth_user_id OU profiles.id (UUID em texto) ou outro valor de domínio controlado
  return owner.trim() || null;
};

/**
 * Normaliza texto para busca acento/ç/case-insensitive.
 * Alinhado com o padrão do banco: unaccent(lower(...))
 */
const normalizeSearchTerm = (value: string): string => {
  const v = value.trim().toLowerCase();
  // Remove diacríticos: "ação" -> "acao", "São" -> "sao", "ç" -> "c"
  // (NFD separa letras e acentos; a regex remove os acentos)
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

/* --------------------------- Tipos de Listagem --------------------------- */

type ListCompaniesParams = {
  q?: string;
  tradeName?: string;
  status?: 'active' | 'inactive' | 'all';
  city?: string;
  state?: string;
  /** ownerId representa profiles.auth_user_id (preferencial) ou profiles.id, compatível com companies.owner */
  ownerId?: string | null;
  limit?: number;
  offset?: number;
};

/* --------------------------- Lista de Responsáveis --------------------------- */

export type CompanyOwnerDTO = {
  id: string; // profiles.id (apenas para chave de option)
  full_name: string;
  auth_user_id: string; // usado para filtrar companies.owner quando for auth_user_id
};

export async function listCompanyOwners(): Promise<CompanyOwnerDTO[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, auth_user_id')
    .eq('status', 'active')
    .not('auth_user_id', 'is', null)
    .order('full_name', { ascending: true });

  if (error) {
    console.error('[companiesService] Error fetching owners list:', error);
    throw error;
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    full_name: row.full_name,
    auth_user_id: row.auth_user_id,
  })) as CompanyOwnerDTO[];
}

/* --------------------------- Enriquecimento de owners --------------------------- */

/**
 * Recebe a lista de empresas e resolve o nome do responsável.
 *
 * Compatibilidade:
 *  - Se companies.owner armazenar profiles.auth_user_id → match direto.
 *  - Se companies.owner armazenar profiles.id → match por id.
 *
 * owner_name é sempre preenchido quando houver match; caso contrário, permanece null
 * e a UI pode decidir exibir o valor bruto de owner.
 */
const enrichWithOwnerNames = async (
  companies: CompanyWithContacts[]
): Promise<CompanyWithContactsAndOwner[]> => {
  if (!companies.length) return companies as CompanyWithContactsAndOwner[];

  const ownerIds = Array.from(
    new Set(
      companies
        .map((c) => (c.owner ?? '').trim())
        .filter((val): val is string => !!val)
    )
  );

  if (!ownerIds.length) {
    return companies.map((c) => ({ ...c, owner_name: null }));
  }

  const ownerMap = new Map<string, string>();

  /* 1) Tenta resolver por auth_user_id */
  try {
    const { data: byAuth, error: errAuth } = await supabase
      .from('profiles')
      .select('auth_user_id, full_name')
      .in('auth_user_id', ownerIds);

    if (errAuth) {
      console.error('[companiesService] Error fetching owners by auth_user_id:', errAuth);
    } else {
      (byAuth ?? []).forEach((row: any) => {
        if (row.auth_user_id) {
          ownerMap.set(String(row.auth_user_id), row.full_name ?? '');
        }
      });
    }
  } catch (e) {
    console.error('[companiesService] Exception resolving owners by auth_user_id:', e);
  }

  /* 2) Para os que sobraram sem match, tenta resolver por profiles.id */
  const missingIds = ownerIds.filter((id) => !ownerMap.has(id));
  if (missingIds.length > 0) {
    try {
      const { data: byId, error: errId } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', missingIds);

      if (errId) {
        console.error('[companiesService] Error fetching owners by profile.id:', errId);
      } else {
        (byId ?? []).forEach((row: any) => {
          if (row.id) {
            ownerMap.set(String(row.id), row.full_name ?? '');
          }
        });
      }
    } catch (e) {
      console.error('[companiesService] Exception resolving owners by profile.id:', e);
    }
  }

  // 3) Aplica o mapa nos itens
  return companies.map((company) => {
    const rawOwner = (company.owner ?? '').trim();
    const owner_name = rawOwner ? ownerMap.get(rawOwner) ?? null : null;
    return {
      ...company,
      owner_name,
    };
  });
};

/* --------------------------- Query Base --------------------------- */

const buildListQuery = (params: ListCompaniesParams) => {
  const { q, tradeName, status = 'all', city, state, ownerId } = params;

  // Mantém o retorno compatível com a UI (contacts incluído)
  let query = supabase.from('companies').select('*, contacts(*)', { count: 'exact' });

  /**
   * Busca rápida (acento/ç/case-insensitive)
   * - no DB: *_search é materializado como unaccent(lower(...))
   * - no front: normalizamos o termo para alinhar com o banco
   *
   * Observação:
   *  - `.or()` no PostgREST faz OR entre colunas.
   *  - `ilike` funciona bem com índices trigram (se você criou).
   */
  if (q && q.trim()) {
    const term = normalizeSearchTerm(q);

    // Monta o filtro OR nos campos de busca
    // Ex.: trade_name_search ilike %term% OR legal_name_search ilike %term% OR tax_id_search ilike %term%
    query = query.or(
      [
        `trade_name_search.ilike.%${term}%`,
        `legal_name_search.ilike.%${term}%`,
        `tax_id_search.ilike.%${term}%`,
      ].join(',')
    );
  }

  /**
   * tradeName (igualdade estrita) — mantido para compat com UI atual.
   * Se você quiser que tradeName também seja acento-insensível, me diga que eu
   * adapto para usar trade_name_search + normalizeSearchTerm(tradeName).
   */
  if (tradeName && tradeName.trim()) {
    query = query.eq('trade_name', tradeName.trim());
  }

  if (status !== 'all') query = query.eq('status', status);

  // city/state mantidos como estavam (se quiser 100% acento-insensível aqui também,
  // recomendo criar city_search/state_search no DB)
  if (city && city.trim()) query = query.ilike('city', `%${city.trim()}%`);
  if (state && state.trim()) query = query.ilike('state', `%${state.trim()}%`);

  // Filtro por responsável (companies.owner = profiles.auth_user_id OU profiles.id)
  if (ownerId && ownerId.trim()) {
    query = query.eq('owner', ownerId.trim());
  }

  return query;
};

/* --------------------------- Listagem com paginação --------------------------- */

export const listCompanies = async (
  params: ListCompaniesParams
): Promise<{
  items: CompanyWithContactsAndOwner[];
  total: number;
  page: number;
  pageSize: number;
}> => {
  const limit = params.limit ?? 15;
  const offset = params.offset ?? 0;

  const { data, error, count } = await buildListQuery(params)
    .order('trade_name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[companiesService] Error fetching companies:', error);
    throw error;
  }

  const baseItems: CompanyWithContacts[] = (data as CompanyWithContacts[]) || [];
  const items = await enrichWithOwnerNames(baseItems);

  return {
    items,
    total: count || 0,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
  };
};

/* --------------------------- Exportação (sem paginação) --------------------------- */

export const listAllCompaniesForExport = async (
  params: ListCompaniesParams
): Promise<CompanyWithContactsAndOwner[]> => {
  const { data, error } = await buildListQuery(params).order('trade_name', {
    ascending: true,
  });

  if (error) {
    console.error('[companiesService] Error fetching all companies for export:', error);
    throw error;
  }

  const baseItems: CompanyWithContacts[] = (data as CompanyWithContacts[]) || [];
  const items = await enrichWithOwnerNames(baseItems);

  return items;
};

/* --------------------------- Lista simples --------------------------- */

export const listSimpleCompanies = async (params: {
  status?: 'active' | 'inactive' | 'all';
}): Promise<Company[]> => {
  const { status = 'active' } = params;

  let query = supabase.from('companies').select('id, trade_name');
  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query.order('trade_name', { ascending: true });
  if (error) {
    console.error('[companiesService] Error fetching simple companies:', error);
    throw error;
  }

  return (data as Company[]) || [];
};

/* --------------------------- Listar empresas com notas --------------------------- */

export const listCompaniesWithNotes = async (): Promise<Company[]> => {
  const { data, error } = await supabase
    .from('companies')
    .select('id, trade_name, notes')
    .order('trade_name', { ascending: true });

  if (error) {
    console.error('[companiesService] Error fetching companies with notes:', error);
    throw error;
  }
  return (data as Company[]) || [];
};

/* --------------------------- CRUD --------------------------- */

export const getCompany = async (id: string): Promise<Company | null> => {
  const { data, error } = await supabase.from('companies').select('*').eq('id', id).single();

  if (error) {
    console.error('[companiesService] Error fetching company:', error);
    throw error;
  }

  return data ?? null;
};

export const createCompany = async (companyData: Partial<Company>): Promise<Company> => {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('Sessão válida, mas nenhum profile ativo foi encontrado.');

  const { notes: _ignoredNotes, ...rest } = companyData as any;

  const payload = {
    ...rest,
    tenant_id: profile.tenant_id,
    tax_id: sanitizeTaxId(companyData.tax_id),
    website: sanitizeWebsite(companyData.website),
    owner: sanitizeOwner(companyData.owner),
  };

  const { data, error } = await supabase.from('companies').insert(payload).select().single();

  if (error) {
    console.error('[companiesService] Error creating company:', error);
    throw error;
  }

  return data as Company;
};

export const updateCompany = async (
  id: string,
  companyData: Partial<Company>
): Promise<Company> => {
  const { tenant_id, notes: _ignoredNotes, ...rest } = companyData as any;

  const payload = {
    ...rest,
    tax_id: sanitizeTaxId(companyData.tax_id),
    website: sanitizeWebsite(companyData.website),
    owner: sanitizeOwner(companyData.owner),
  };

  const { data, error } = await supabase
    .from('companies')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[companiesService] Error updating company:', error);
    throw error;
  }

  return data as Company;
};

export const deleteCompany = async (id: string): Promise<void> => {
  const { error } = await supabase.from('companies').delete().eq('id', id);
  if (error) {
    console.error('[companiesService] Error deleting company:', error);
    throw error;
  }
};

/* --------------------------- CRUD de Notas via RPC --------------------------- */

export const appendCompanyNote = async (
  companyId: string,
  text: string
): Promise<CompanyNote[]> => {
  const { data, error } = await supabase.rpc('company_notes_append', {
    p_company_id: companyId,
    p_text: text,
  });

  if (error) {
    console.error('[companiesService] Error appending company note:', error);
    throw error;
  }

  return (data as CompanyNote[]) ?? [];
};

export const updateCompanyNoteAt = async (
  companyId: string,
  index: number,
  patch: Partial<CompanyNote>,
  recomputeAssunto = true
): Promise<CompanyNote[]> => {
  const { data, error } = await supabase.rpc('company_notes_update_at', {
    p_company_id: companyId,
    p_index: index,
    p_patch: patch as any,
    p_recompute_assunto: recomputeAssunto,
  });

  if (error) {
    console.error('[companiesService] Error updating note:', error);
    throw error;
  }

  return (data as CompanyNote[]) ?? [];
};

export const deleteCompanyNoteAt = async (
  companyId: string,
  index: number
): Promise<CompanyNote[]> => {
  const { data, error } = await supabase.rpc('company_notes_delete_at', {
    p_company_id: companyId,
    p_index: index,
  });

  if (error) {
    console.error('[companiesService] Error deleting note:', error);
    throw error;
  }

  return (data as CompanyNote[]) ?? [];
};

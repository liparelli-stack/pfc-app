/*
-- ===================================================
-- Código             : /src/services/cockpitService.ts
-- Versão (.v20)      : 2.6.3
-- Data/Hora          : 2025-11-25  America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Serviços do Cockpit com listagem, detalhes de empresa e busca.
-- Fluxo              : Cockpit → services → Supabase (RLS → tenant → views por usuário)
--
-- Alterações (2.6.3) :
--   • [SEC/SCOPING] listCompaniesWithActiveActions passou a consumir
--     vw_cockpit_active_companies em vez de companies + chats:
--         - Isola automaticamente as empresas com ações ativas do usuário logado
--           (via filtro de usuário já aplicado na view).
--         - Mantém o shape de retorno { id, trade_name, action_count } usado no Cockpit.
--
-- Alterações (2.6.2) :
--   • [FIX] getCompanyDetails agora embute canais de contato:
--     contacts(
--       ...,
--       channels:contacts_channel(...)
--     )
--     permitindo que o CompanyDetailsCard exiba telefones/emails dos contatos.
--
-- Alterações (2.6.1) :
--   • [FIX] Substituído contacts:view_contacts_clean(*) por contacts(*)
--     para remover erro PGRST200 e alinhar companies ↔ contacts via FK direta.
--
-- Alterações (2.6.0) :
--   • searchCompaniesByName aumentou limite de 10 → 25.
--
-- Dependências       : @/lib/supabaseClient, @/types/cockpit
-- ===================================================
*/

import { supabase } from '@/lib/supabaseClient';
import type { CompanyWithActionCount, CompanyDetails, CompanyMinimal } from '@/types/cockpit';

/**
 * Lista empresas com ações ativas do usuário logado,
 * baseada na view vw_cockpit_active_companies.
 */
export const listCompaniesWithActiveActions = async (): Promise<CompanyWithActionCount[]> => {
  const { data, error } = await supabase
    .from('vw_cockpit_active_companies')
    .select(
      `
      company_id,
      company_trade_name,
      active_actions_count,
      last_action_at,
      valor_total_orcamentos
    `
    );

  if (error) {
    console.error('[cockpitService] Error fetching companies with active actions:', error);
    throw error;
  }

  if (!data) return [];

  const transformed = (data as any[])
    .map((row) => ({
      id: row.company_id as string,
      trade_name: row.company_trade_name as string,
      action_count: (row.active_actions_count as number) || 0,
      valor_total_orcamentos: (row.valor_total_orcamentos as number) || 0,
    }))
    .filter((c) => c.action_count > 0)
    .sort((a, b) => a.trade_name.localeCompare(b.trade_name));

  return transformed;
};

/**
 * Detalhes da empresa + contatos + canais.
 */
export const getCompanyDetails = async (companyId: string): Promise<CompanyDetails | null> => {
  const { data, error } = await supabase
    .from('companies')
    .select(
      `
      *,
      contacts(
        id,
        tenant_id,
        company_id,
        full_name,
        position,
        department,
        contact_guard,
        status,
        notes,
        export_state,
        created_at,
        updated_at,
        birth_day_month,
        channels:contacts_channel(
          id,
          type,
          value,
          label_custom,
          is_preferred,
          notes,
          verified_at,
          created_at,
          updated_at,
          export_state
        )
      )
    `
    )
    .eq('id', companyId)
    .single();

  if (error) {
    console.error(`[cockpitService] Error fetching company details for ID ${companyId}:`, error);
    if ((error as any).code === 'PGRST116') return null;
    throw error;
  }

  return data as unknown as CompanyDetails;
};

/**
 * Busca por nome — mantém a lógica atual.
 */
export const searchCompaniesByName = async (term: string, tenantId: string): Promise<CompanyMinimal[]> => {
  const q = (term ?? '').trim();
  if (q.length < 2) return [];

  const { data, error } = await supabase
    .rpc('search_companies_by_name', { p_term: q, p_tenant_id: tenantId });

  if (error) {
    console.error('[cockpitService] Error searching companies by name:', error);
    throw error;
  }

  return (data ?? []).map((c: any) => ({
    id: c.id as string,
    trade_name: c.trade_name as string,
  }));
};

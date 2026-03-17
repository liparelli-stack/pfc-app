/*
-- ===================================================
-- Código             : /src/services/tenantService.ts
-- Versão (.v20)      : 1.5.0
-- Data/Hora          : 2025-11-16 15:35
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Serviços de leitura/escrita da entidade Tenant (org_tenants),
--                      alinhados ao comportamento real do Supabase (update/insert com select).
-- Fluxo              : TenantForm / OrganizationSettings -> tenantService -> Supabase (org_tenants)
-- Alterações (1.5.0) :
--   • createTenant: usa .select().single() e confia apenas em error.
--   • updateTenant: usa .select().single() e NÃO faz mais checagem manual de data.length === 0.
--   • Removido erro "Nenhuma organização foi atualizada..." que estava sendo disparado
--     mesmo quando o UPDATE acontecia com sucesso.
-- Dependências       : /src/types/tenant.ts, /src/lib/supabaseClient.ts
-- ===================================================
*/

import { Tenant } from '../types/tenant';
import { supabase } from '../lib/supabaseClient';

const normalizeTaxId = (taxId: string) => taxId.replace(/[^\d]/g, '');
const normalizeState = (state: string) => state.toUpperCase();
const normalizeCity = (city: string) =>
  city
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

/**
 * Lista de tenants visíveis para o JWT atual (hoje RLS está permissiva).
 * Mantido por compatibilidade, mas a UI deve usar getCurrentTenant().
 */
export const getTenants = async (): Promise<Tenant[]> => {
  const { data, error } = await supabase
    .from('org_tenants')
    .select('*')
    .order('company_name', { ascending: true });

  if (error) {
    console.error('Error fetching tenants:', error);
    throw error;
  }

  return (data as Tenant[]) || [];
};

/**
 * Retorna o "tenant corrente" visível para o JWT atual.
 * Com RLS por tenant, isso naturalmente vira o tenant único.
 */
export const getCurrentTenant = async (): Promise<Tenant | null> => {
  const { data, error } = await supabase
    .from('org_tenants')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching current tenant:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0] as Tenant;
};

export const createTenant = async (
  formData: Omit<Tenant, 'id'>
): Promise<Tenant> => {
  const normalizedData = {
    ...formData,
    tax_id: normalizeTaxId(formData.tax_id),
    state: formData.state ? normalizeState(formData.state) : undefined,
    city: formData.city ? normalizeCity(formData.city) : undefined,
    // created_by / updated_by podem ficar null; FK permite
  };

  const { data, error } = await supabase
    .from('org_tenants')
    .insert([normalizedData])
    .select('*')
    .single();

  if (error) {
    console.error('Error creating tenant:', error);
    throw error;
  }

  // Aqui data SEMPRE é um objeto único (single)
  return data as Tenant;
};

export const updateTenant = async (formData: Tenant): Promise<Tenant> => {
  if (!formData.id) {
    throw new Error('ID do tenant não informado para atualização.');
  }

  const { id, ...updateData } = formData;

  const normalizedData = {
    ...updateData,
    tax_id: normalizeTaxId(formData.tax_id),
    state: formData.state ? normalizeState(formData.state) : undefined,
    city: formData.city ? normalizeCity(formData.city) : undefined,
    // updated_by pode ficar null; FK permite
  };

  const { data, error } = await supabase
    .from('org_tenants')
    .update(normalizedData)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating tenant:', error);
    throw error;
  }

  // Se RLS bloquear ou não existir linha, o Supabase tende a retornar erro aqui.
  // Não fazemos mais checagem manual de "0 linhas" baseada em data.
  return data as Tenant;
};

export const deleteTenant = async (
  id: string
): Promise<{ success: boolean }> => {
  const { error } = await supabase
    .from('org_tenants')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting tenant:', error);
    throw error;
  }

  return { success: true };
};

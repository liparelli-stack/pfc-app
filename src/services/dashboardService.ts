/*
-- ===================================================
-- Código             : /src/services/dashboardService.ts
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-11-06 22:48 America/Sao_Paulo
-- Autor              : FL / Execução via E.V.A.
-- Objetivo do código : Consultar views vw_company_mix e vw_company_by_state_top6
-- ===================================================
*/

import { supabase } from '@/lib/supabaseClient';
import { CompanyMix, CompanyByState } from '@/types/dashboard';

export async function getCompanyMix(): Promise<CompanyMix[]> {
  const { data, error } = await supabase.from('vw_company_mix').select('*');
  if (error) throw error;
  return data ?? [];
}

export async function getCompanyByStateTop6(): Promise<CompanyByState[]> {
  const { data, error } = await supabase.from('vw_company_by_state_top6').select('*');
  if (error) throw error;
  return data ?? [];
}

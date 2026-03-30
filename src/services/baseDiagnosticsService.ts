/*
-- ===================================================
-- Código             : src/services/baseDiagnosticsService.ts
-- Versão             : 1.0.0
-- Data/Hora          : 2026-03-29 America/Sao_Paulo
-- Autor              : FL / Claude
-- Objetivo           : Busca diagnóstico da base via RPC get_base_diagnostics.
-- ===================================================
*/

import { supabase } from '@/lib/supabaseClient';

export interface BaseDiagnosticsData {
  totals: Record<'lead' | 'prospect' | 'client', { active: number; inactive: number }>;
  coverage: Record<'lead' | 'prospect' | 'client', { total: number; with_contact: number; never_contacted: number; pct_covered: number }>;
  activity_buckets: {
    never?: number;
    last_30d?: number;
    '31_60d'?: number;
    '61_90d'?: number;
    '91_180d'?: number;
    over_180d?: number;
  };
  budgets: Array<{ kind: string; status: string; qty: number; amount: number }>;
  abc: Array<{ kind: string; abc_analysis: string; total: number }>;
  generated_at: string;
}

export async function getBaseDiagnostics(tenantId: string): Promise<BaseDiagnosticsData> {
  const { data, error } = await supabase.rpc('get_base_diagnostics', { p_tenant_id: tenantId });

  console.log('[BaseDiagnostics] raw data:', JSON.stringify(data));
  console.log('[BaseDiagnostics] error:', JSON.stringify(error));
  if (error) throw error;
  const raw = data as unknown;
  const result = Array.isArray(raw)
    ? (raw[0]?.get_base_diagnostics ?? raw[0])
    : raw;
  console.log('[BaseDiagnostics] result:', JSON.stringify(result));
  return result as BaseDiagnosticsData;
}

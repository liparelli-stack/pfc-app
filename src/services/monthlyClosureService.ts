/*
-- =====================================================================================================
-- Código             : src/services/monthlyClosureService.ts
-- Versão (.v20)      : 0.1.0
-- Data/Hora          : 2026-03-24 19:00 America/Sao_Paulo
-- Autor              : FL / Execução via (Eva Claude Modelo) (Alpha Dualite modelo LLM)
-- Objetivo do codigo : Serviço de fechamento mensal de orçamentos:
--                      • getMonthData  — retorna snapshot (se fechado) ou dados ao vivo via RPC
--                      • isMonthClosed — verifica se um mês já foi fechado
--                      • closeMonth    — fecha o mês criando snapshot imutável
--                      • upsertGoal    — define/atualiza meta mensal de um vendedor
-- Dependências       : @/lib/supabaseClient
--                      DB: monthly_goals, monthly_closure, RPC get_monthly_live_data
-- Versão/Alteração   :
-- [ 0.1.0 ]          : Versão inicial - SUP-000004
-- =====================================================================================================
*/

import { supabase } from '@/lib/supabaseClient';

/* ============================================================
   Tipos públicos
   ============================================================ */

export interface SellerRow {
  profile_id: string;
  seller_name: string;
  goal: number;
  realized: number;
  count: number;
  lost: number;
  /** Calculado em runtime: realized / goal * 100 (0 se meta = 0) */
  performance: number;
}

export interface MonthData {
  mes: string;
  is_closed: boolean;
  closed_at: string | null;
  sellers: SellerRow[];
  total_realized: number;
  total_goal: number;
  total_lost: number;
  /** Performance geral: total_realized / total_goal * 100 */
  performance: number;
}

/* ============================================================
   Helpers internos
   ============================================================ */

function toSellerRows(raw: any[]): SellerRow[] {
  return (raw ?? []).map((r) => {
    const goal     = Number(r.goal)     || 0;
    const realized = Number(r.realized) || 0;
    return {
      profile_id:  String(r.profile_id ?? ''),
      seller_name: String(r.seller_name ?? 'Vendedor'),
      goal,
      realized,
      count:       Number(r.count) || 0,
      lost:        Number(r.lost)  || 0,
      performance: goal > 0 ? Math.round((realized / goal) * 100) : 0,
    };
  });
}

function buildTotals(sellers: SellerRow[]) {
  const total_realized = sellers.reduce((s, r) => s + r.realized, 0);
  const total_goal     = sellers.reduce((s, r) => s + r.goal,     0);
  const total_lost     = sellers.reduce((s, r) => s + r.lost,     0);
  const performance    = total_goal > 0
    ? Math.round((total_realized / total_goal) * 100)
    : 0;
  return { total_realized, total_goal, total_lost, performance };
}

/* ============================================================
   API pública
   ============================================================ */

/**
 * Verifica se um mês já possui fechamento registrado.
 */
export async function isMonthClosed(mes: string): Promise<boolean> {
  const { data } = await supabase
    .from('monthly_closure')
    .select('closed_at')
    .eq('mes', mes)
    .maybeSingle();
  return !!data?.closed_at;
}

/**
 * Retorna os dados do mês:
 * - Se fechado: lê o snapshot persistido (dados imutáveis)
 * - Se aberto:  chama a RPC SECURITY DEFINER para agregar todos os vendedores
 */
export async function getMonthData(mes: string): Promise<MonthData> {
  // 1. Verificar se o mês está fechado
  const { data: closure, error: closureErr } = await supabase
    .from('monthly_closure')
    .select('closed_at, snapshot')
    .eq('mes', mes)
    .maybeSingle();

  if (closureErr) throw new Error(closureErr.message);

  if (closure?.closed_at && Array.isArray(closure.snapshot)) {
    const sellers = toSellerRows(closure.snapshot);
    return {
      mes,
      is_closed: true,
      closed_at: closure.closed_at,
      sellers,
      ...buildTotals(sellers),
    };
  }

  // 2. Dados ao vivo via RPC (bypassa RLS de chats para exibir todos os vendedores)
  const { data, error } = await supabase.rpc('get_monthly_live_data', { p_mes: mes });
  if (error) throw new Error(error.message);

  const sellers = toSellerRows((data as any[]) ?? []);
  return {
    mes,
    is_closed: false,
    closed_at: null,
    sellers,
    ...buildTotals(sellers),
  };
}

/**
 * Fecha o mês: persiste snapshot dos dados atuais + registra closed_at/closed_by.
 * @param mes        YYYY-MM do mês a fechar
 * @param tenantId   tenant_id do usuário autenticado
 * @param profileId  profiles.id do usuário que está fechando
 */
export async function closeMonth(
  mes: string,
  tenantId: string,
  profileId: string,
): Promise<void> {
  // Verifica se já está fechado
  const already = await isMonthClosed(mes);
  if (already) throw new Error('Este mês já foi fechado.');

  // Obtém dados ao vivo para snapshot
  const live = await getMonthData(mes);

  // Serializa snapshot sem o campo calculado `performance`
  const snapshot = live.sellers.map(({ performance: _perf, ...rest }) => rest);

  const { error } = await supabase
    .from('monthly_closure')
    .upsert(
      {
        tenant_id: tenantId,
        mes,
        closed_at: new Date().toISOString(),
        closed_by: profileId,
        snapshot,
      },
      { onConflict: 'tenant_id,mes' },
    );

  if (error) throw new Error(error.message);
}

/**
 * Define ou atualiza a meta mensal de um vendedor.
 * @param tenantId   tenant_id
 * @param profileId  profiles.id do vendedor
 * @param mes        YYYY-MM
 * @param goalAmount Valor em R$
 */
export async function upsertGoal(
  tenantId: string,
  profileId: string,
  mes: string,
  goalAmount: number,
): Promise<void> {
  const { error } = await supabase
    .from('monthly_goals')
    .upsert(
      { tenant_id: tenantId, profile_id: profileId, mes, goal_amount: goalAmount },
      { onConflict: 'tenant_id,profile_id,mes' },
    );
  if (error) throw new Error(error.message);
}

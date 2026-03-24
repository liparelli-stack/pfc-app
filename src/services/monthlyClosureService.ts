/*
-- =====================================================================================================
-- Código             : src/services/monthlyClosureService.ts
-- Versão (.v20)      : 0.2.0
-- Data/Hora          : 2026-03-24 19:00 America/Sao_Paulo
-- Autor              : FL / Execução via (Eva Claude Modelo) (Alpha Dualite modelo LLM)
-- Objetivo do codigo : Serviço de fechamento mensal de orçamentos:
--                      • getMonthData  — lê colunas reais da tabela (se fechado) ou agrega
--                                        dados ao vivo via RPC get_monthly_live_data
--                      • isMonthClosed — verifica closed_at NOT NULL em budget_monthly_closures
--                      • closeMonth    — upserta colunas agregadas + closed_at/closed_by
--                      • upsertGoal    — define/atualiza meta mensal em sales_monthly_targets
-- Dependências       : @/lib/supabaseClient
--                      DB: budget_monthly_closures, sales_monthly_targets,
--                          RPC get_monthly_live_data
-- Versão/Alteração   :
-- [ 0.1.0 ]          : Versão inicial
-- [ 0.2.0 ]          : Ajuste de schema — remove snapshot JSONB; usa colunas agregadas reais:
--                        qty_X/total_X por status, target_amount/quantity, performance_pct,
--                        closed_by, closed_at, auto_closed
-- =====================================================================================================
*/

import { supabase } from '@/lib/supabaseClient';

/* ============================================================
   Tipos públicos
   ============================================================ */

/**
 * Reflete a estrutura real da tabela budget_monthly_closures.
 * Usado tanto para dados ao vivo (is_closed=false) quanto para snapshot fechado (is_closed=true).
 */
export interface MonthData {
  mes: string;
  is_closed: boolean;
  closed_at: string | null;
  auto_closed: boolean;
  /** Orçamentos em aberto */
  qty_aberta: number;
  total_aberta: number;
  /** Orçamentos ganhos */
  qty_ganha: number;
  total_ganha: number;
  /** Orçamentos perdidos */
  qty_perdida: number;
  total_perdida: number;
  /** Orçamentos encerrados */
  qty_encerrada: number;
  total_encerrada: number;
  /** Metas do período */
  target_amount: number;
  target_quantity: number;
  /** Performance calculada: total_ganha / target_amount × 100 */
  performance_pct: number;
}

/* ============================================================
   Helpers internos
   ============================================================ */

const SELECT_COLS = [
  'qty_aberta', 'total_aberta',
  'qty_ganha',  'total_ganha',
  'qty_perdida', 'total_perdida',
  'qty_encerrada', 'total_encerrada',
  'target_amount', 'target_quantity', 'performance_pct',
  'closed_by', 'closed_at', 'auto_closed',
].join(', ');

/** Converte uma linha raw da tabela para MonthData */
function rowToMonthData(mes: string, row: any): MonthData {
  return {
    mes,
    is_closed:      !!row.closed_at,
    closed_at:      row.closed_at ?? null,
    auto_closed:    !!row.auto_closed,
    qty_aberta:     Number(row.qty_aberta)    || 0,
    total_aberta:   Number(row.total_aberta)  || 0,
    qty_ganha:      Number(row.qty_ganha)     || 0,
    total_ganha:    Number(row.total_ganha)   || 0,
    qty_perdida:    Number(row.qty_perdida)   || 0,
    total_perdida:  Number(row.total_perdida) || 0,
    qty_encerrada:  Number(row.qty_encerrada) || 0,
    total_encerrada:Number(row.total_encerrada) || 0,
    target_amount:  Number(row.target_amount)   || 0,
    target_quantity:Number(row.target_quantity) || 0,
    performance_pct:Number(row.performance_pct) || 0,
  };
}

/**
 * Agrega os dados por-vendedor retornados pela RPC no shape de MonthData.
 * A RPC retorna: { goal, realized, count, lost } por vendedor.
 * qty_aberta/encerrada ficam em 0 — a RPC atual não fornece esses valores.
 */
function rpcRowsToMonthData(mes: string, rows: any[]): MonthData {
  const total_ganha    = rows.reduce((s, r) => s + (Number(r.realized) || 0), 0);
  const qty_ganha      = rows.reduce((s, r) => s + (Number(r.count)    || 0), 0);
  const total_perdida  = rows.reduce((s, r) => s + (Number(r.lost)     || 0), 0);
  const target_amount  = rows.reduce((s, r) => s + (Number(r.goal)     || 0), 0);
  const performance_pct = target_amount > 0
    ? Math.round((total_ganha / target_amount) * 100)
    : 0;

  return {
    mes,
    is_closed:       false,
    closed_at:       null,
    auto_closed:     false,
    qty_aberta:      0,
    total_aberta:    0,
    qty_ganha,
    total_ganha,
    qty_perdida:     rows.length > 0 ? rows.length - qty_ganha : 0,
    total_perdida,
    qty_encerrada:   0,
    total_encerrada: 0,
    target_amount,
    target_quantity: 0,
    performance_pct,
  };
}

/* ============================================================
   API pública
   ============================================================ */

/**
 * Verifica se um mês já foi fechado (closed_at NOT NULL).
 */
export async function isMonthClosed(mes: string): Promise<boolean> {
  const { data } = await supabase
    .from('budget_monthly_closures')
    .select('closed_at')
    .eq('mes', mes)
    .maybeSingle();
  return !!data?.closed_at;
}

/**
 * Retorna os dados do mês:
 * - Se fechado: lê colunas agregadas de budget_monthly_closures
 * - Se aberto:  chama RPC SECURITY DEFINER e agrega em MonthData
 */
export async function getMonthData(mes: string): Promise<MonthData> {
  // 1. Tenta ler registro existente em budget_monthly_closures
  const { data: row, error: rowErr } = await supabase
    .from('budget_monthly_closures')
    .select(SELECT_COLS)
    .eq('mes', mes)
    .maybeSingle();

  if (rowErr) throw new Error(rowErr.message);

  // Mês fechado → retorna dados do registro persistido
  if (row?.closed_at) {
    return rowToMonthData(mes, row);
  }

  // 2. Mês aberto → dados ao vivo via RPC (cross-user, SECURITY DEFINER)
  const { data: rpcData, error: rpcErr } = await supabase
    .rpc('get_monthly_live_data', { p_mes: mes });

  if (rpcErr) throw new Error(rpcErr.message);

  return rpcRowsToMonthData(mes, (rpcData as any[]) ?? []);
}

/**
 * Fecha o mês: persiste as colunas agregadas atuais + registra closed_at/closed_by.
 * @param mes        YYYY-MM do mês a fechar
 * @param tenantId   tenant_id do usuário autenticado
 * @param profileId  profiles.id do usuário que está fechando
 */
export async function closeMonth(
  mes: string,
  tenantId: string,
  profileId: string,
): Promise<void> {
  const already = await isMonthClosed(mes);
  if (already) throw new Error('Este mês já foi fechado.');

  const live = await getMonthData(mes);

  const { error } = await supabase
    .from('budget_monthly_closures')
    .upsert(
      {
        tenant_id:       tenantId,
        mes,
        qty_aberta:      live.qty_aberta,
        total_aberta:    live.total_aberta,
        qty_ganha:       live.qty_ganha,
        total_ganha:     live.total_ganha,
        qty_perdida:     live.qty_perdida,
        total_perdida:   live.total_perdida,
        qty_encerrada:   live.qty_encerrada,
        total_encerrada: live.total_encerrada,
        target_amount:   live.target_amount,
        target_quantity: live.target_quantity,
        performance_pct: live.performance_pct,
        closed_at:       new Date().toISOString(),
        closed_by:       profileId,
        auto_closed:     false,
      },
      { onConflict: 'tenant_id,mes' },
    );

  if (error) throw new Error(error.message);
}

/**
 * Define ou atualiza a meta mensal de um vendedor em sales_monthly_targets.
 * @param tenantId   tenant_id
 * @param profileId  profiles.id do vendedor
 * @param mes        YYYY-MM
 * @param goalAmount Valor alvo em R$
 */
export async function upsertGoal(
  tenantId: string,
  profileId: string,
  mes: string,
  goalAmount: number,
): Promise<void> {
  const { error } = await supabase
    .from('sales_monthly_targets')
    .upsert(
      { tenant_id: tenantId, profile_id: profileId, mes, goal_amount: goalAmount },
      { onConflict: 'tenant_id,profile_id,mes' },
    );
  if (error) throw new Error(error.message);
}

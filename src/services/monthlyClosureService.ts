/*
-- =====================================================================================================
-- Código             : src/services/monthlyClosureService.ts
-- Versão (.v20)      : 0.3.0
-- Data/Hora          : 2026-03-24 19:00 America/Sao_Paulo
-- Autor              : FL / Execução via (Eva Claude Modelo) (Alpha Dualite modelo LLM)
-- Objetivo do codigo : Serviço de fechamento mensal de orçamentos.
-- Dependências       : @/lib/supabaseClient
--                      DB: budget_monthly_closures, sales_monthly_targets,
--                          RPC get_monthly_live_data
-- Versão/Alteração   :
-- [ 0.1.0 ]          : Versão inicial
-- [ 0.2.0 ]          : Ajuste de schema — remove snapshot JSONB; usa colunas agregadas
-- [ 0.3.0 ]          : Alinhamento com schema real do banco:
--                        • coluna 'month' (date), não 'mes' (text) — usa '${mes}-01'
--                        • tabela tem 1 linha POR VENDEDOR (salesperson_id), não por tenant
--                        • closed_at NOT NULL — existência de rows = mês fechado
--                        • upsertGoal: salesperson_id + month (date)
-- =====================================================================================================
*/

import { supabase } from '@/lib/supabaseClient';

/* ============================================================
   Tipos públicos
   ============================================================ */

export interface MonthData {
  mes: string;
  is_closed: boolean;
  closed_at: string | null;
  auto_closed: boolean;
  qty_aberta: number;
  total_aberta: number;
  qty_ganha: number;
  total_ganha: number;
  qty_perdida: number;
  total_perdida: number;
  qty_encerrada: number;
  total_encerrada: number;
  target_amount: number;
  target_quantity: number;
  performance_pct: number;
}

/* ============================================================
   Helpers internos
   ============================================================ */

/** Converte 'YYYY-MM' → 'YYYY-MM-01' (date esperado pelo banco) */
const toMonthDate = (mes: string) => `${mes}-01`;

const SELECT_COLS = [
  'salesperson_id',
  'qty_aberta',    'total_aberta',
  'qty_ganha',     'total_ganha',
  'qty_perdida',   'total_perdida',
  'qty_encerrada', 'total_encerrada',
  'target_amount', 'target_quantity', 'performance_pct',
  'auto_closed',   'closed_by',       'closed_at',
].join(', ');

/** Agrega N linhas (uma por vendedor) em totais únicos */
function aggregateRows(rows: any[]) {
  const sum = (field: string) => rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
  const total_ganha   = sum('total_ganha');
  const target_amount = sum('target_amount');
  return {
    qty_aberta:      sum('qty_aberta'),
    total_aberta:    sum('total_aberta'),
    qty_ganha:       sum('qty_ganha'),
    total_ganha,
    qty_perdida:     sum('qty_perdida'),
    total_perdida:   sum('total_perdida'),
    qty_encerrada:   sum('qty_encerrada'),
    total_encerrada: sum('total_encerrada'),
    target_amount,
    target_quantity: sum('target_quantity'),
    performance_pct: target_amount > 0
      ? Math.round((total_ganha / target_amount) * 100)
      : 0,
  };
}

/** Converte resultado da RPC (por vendedor) em MonthData agregado */
function rpcRowsToMonthData(mes: string, rows: any[]): MonthData {
  const total_ganha   = rows.reduce((s, r) => s + (Number(r.realized) || 0), 0);
  const qty_ganha     = rows.reduce((s, r) => s + (Number(r.count)    || 0), 0);
  const total_perdida = rows.reduce((s, r) => s + (Number(r.lost)     || 0), 0);
  const target_amount = rows.reduce((s, r) => s + (Number(r.goal)     || 0), 0);
  return {
    mes,
    is_closed:       false,
    closed_at:       null,
    auto_closed:     false,
    qty_aberta:      0,
    total_aberta:    0,
    qty_ganha,
    total_ganha,
    qty_perdida:     0,
    total_perdida,
    qty_encerrada:   0,
    total_encerrada: 0,
    target_amount,
    target_quantity: 0,
    performance_pct: target_amount > 0
      ? Math.round((total_ganha / target_amount) * 100)
      : 0,
  };
}

/* ============================================================
   API pública
   ============================================================ */

/**
 * Verifica se o mês já foi fechado.
 * Como closed_at é NOT NULL na tabela, basta checar se existem linhas para o mês.
 */
export async function isMonthClosed(mes: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('budget_monthly_closures')
    .select('id', { count: 'exact', head: true })
    .eq('month', toMonthDate(mes));
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/**
 * Retorna os dados do mês:
 * - Se fechado (linhas existem em budget_monthly_closures): agrega as linhas por vendedor
 * - Se aberto: chama RPC SECURITY DEFINER e agrega em MonthData
 */
export async function getMonthData(mes: string): Promise<MonthData> {
  const { data: rows, error: rowErr } = await supabase
    .from('budget_monthly_closures')
    .select(SELECT_COLS)
    .eq('month', toMonthDate(mes));

  if (rowErr) throw new Error(rowErr.message);

  if (rows && rows.length > 0) {
    return {
      mes,
      is_closed:  true,
      closed_at:  rows[0].closed_at,
      auto_closed: rows.some((r) => r.auto_closed),
      ...aggregateRows(rows),
    };
  }

  // Mês aberto — dados ao vivo via RPC (SECURITY DEFINER, cross-user)
  const { data: rpcData, error: rpcErr } = await supabase
    .rpc('get_monthly_live_data', { p_mes: mes });
  if (rpcErr) throw new Error(rpcErr.message);

  return rpcRowsToMonthData(mes, (rpcData as any[]) ?? []);
}

/**
 * Fecha o mês: insere uma linha por vendedor em budget_monthly_closures.
 * @param mes        YYYY-MM
 * @param tenantId   tenant_id do usuário autenticado
 * @param profileId  profiles.id de quem está fechando (closed_by)
 */
export async function closeMonth(
  mes: string,
  tenantId: string,
  profileId: string,
): Promise<void> {
  const already = await isMonthClosed(mes);
  if (already) throw new Error('Este mês já foi fechado.');

  const { data: rpcData, error: rpcErr } = await supabase
    .rpc('get_monthly_live_data', { p_mes: mes });
  if (rpcErr) throw new Error(rpcErr.message);

  const sellers = (rpcData as any[]) ?? [];
  if (sellers.length === 0) throw new Error('Nenhum dado encontrado para fechar este mês.');

  const now = new Date().toISOString();
  const inserts = sellers.map((r) => {
    const total_ganha   = Number(r.realized) || 0;
    const target_amount = Number(r.goal)     || 0;
    return {
      tenant_id:       tenantId,
      salesperson_id:  r.profile_id,
      month:           toMonthDate(mes),
      qty_aberta:      0,
      total_aberta:    0,
      qty_ganha:       Number(r.count) || 0,
      total_ganha,
      qty_perdida:     0,
      total_perdida:   Number(r.lost) || 0,
      qty_encerrada:   0,
      total_encerrada: 0,
      target_amount,
      target_quantity: 0,
      performance_pct: target_amount > 0
        ? Math.round((total_ganha / target_amount) * 100)
        : 0,
      auto_closed: false,
      closed_by:   profileId,
      closed_at:   now,
    };
  });

  const { error } = await supabase
    .from('budget_monthly_closures')
    .insert(inserts);
  if (error) throw new Error(error.message);
}

/**
 * Define ou atualiza a meta mensal de um vendedor em sales_monthly_targets.
 */
export async function upsertGoal(
  tenantId: string,
  salespersonId: string,
  mes: string,
  goalAmount: number,
  goalQuantity = 0,
): Promise<void> {
  const { error } = await supabase
    .from('sales_monthly_targets')
    .upsert(
      {
        tenant_id:      tenantId,
        salesperson_id: salespersonId,
        month:          toMonthDate(mes),
        target_amount:  goalAmount,
        target_quantity: goalQuantity,
      },
      { onConflict: 'tenant_id,salesperson_id,month' },
    );
  if (error) throw new Error(error.message);
}

/*
-- =====================================================================================================
-- Código             : src/services/monthlyClosureService.ts
-- Versão (.v20)      : 0.4.0
-- Data/Hora          : 2026-03-24 19:00 America/Sao_Paulo
-- Autor              : FL / Execução via (Eva Claude Modelo) (Alpha Dualite modelo LLM)
-- Objetivo do codigo : Serviço de fechamento mensal — delega inteiramente às RPCs do banco.
-- Dependências       : @/lib/supabaseClient
--                      RPCs (SECURITY DEFINER):
--                        • get_month_data(p_month date, p_salesperson_id uuid DEFAULT NULL)
--                        • is_month_closed(p_month date) → boolean
--                        • close_month(p_month date, p_salesperson_id uuid DEFAULT NULL)
--                      Tabela direta: sales_monthly_targets (upsertGoal)
-- Versão/Alteração   :
-- [ 0.1.0 ]          : Versão inicial
-- [ 0.2.0 ]          : Ajuste de schema — remove snapshot JSONB
-- [ 0.3.0 ]          : Alinhamento coluna month (date), salesperson_id
-- [ 0.4.0 ]          : Remove RPC inexistente (get_monthly_live_data); usa RPCs reais
--                        do banco: get_month_data, is_month_closed, close_month
-- =====================================================================================================
*/

import { supabase } from '@/lib/supabaseClient';

/* ============================================================
   Tipos públicos
   ============================================================ */

/** Uma linha retornada pela RPC get_month_data (por vendedor) */
export interface SellerRow {
  salesperson_id:  string;
  salesperson_name: string;
  is_closed:       boolean;
  qty_aberta:      number;
  total_aberta:    number;
  qty_ganha:       number;
  total_ganha:     number;
  qty_perdida:     number;
  total_perdida:   number;
  qty_encerrada:   number;
  total_encerrada: number;
  target_amount:   number;
  target_quantity: number;
  performance_pct: number;
  closed_at:       string | null;
  closed_by_name:  string | null;
}

/** Totais agregados do mês (soma de todos os vendedores) */
export interface MonthData {
  mes:             string;
  is_closed:       boolean;
  closed_at:       string | null;
  auto_closed:     boolean;
  qty_aberta:      number;
  total_aberta:    number;
  qty_ganha:       number;
  total_ganha:     number;
  qty_perdida:     number;
  total_perdida:   number;
  qty_encerrada:   number;
  total_encerrada: number;
  target_amount:   number;
  target_quantity: number;
  performance_pct: number;
  /** Detalhe por vendedor (para tabela expandida, se necessário) */
  sellers:         SellerRow[];
}

/* ============================================================
   Helpers internos
   ============================================================ */

/** 'YYYY-MM' → 'YYYY-MM-01' (tipo date esperado pelas RPCs) */
const toMonthDate = (mes: string) => `${mes}-01`;

function toSellerRow(r: any): SellerRow {
  return {
    salesperson_id:   String(r.salesperson_id  ?? ''),
    salesperson_name: String(r.salesperson_name ?? 'Vendedor'),
    is_closed:        !!r.is_closed,
    qty_aberta:       Number(r.qty_aberta)      || 0,
    total_aberta:     Number(r.total_aberta)    || 0,
    qty_ganha:        Number(r.qty_ganha)       || 0,
    total_ganha:      Number(r.total_ganha)     || 0,
    qty_perdida:      Number(r.qty_perdida)     || 0,
    total_perdida:    Number(r.total_perdida)   || 0,
    qty_encerrada:    Number(r.qty_encerrada)   || 0,
    total_encerrada:  Number(r.total_encerrada) || 0,
    target_amount:    Number(r.target_amount)   || 0,
    target_quantity:  Number(r.target_quantity) || 0,
    performance_pct:  Number(r.performance_pct) || 0,
    closed_at:        r.closed_at  ?? null,
    closed_by_name:   r.closed_by_name ?? null,
  };
}

function buildMonthData(mes: string, sellers: SellerRow[]): MonthData {
  const sum = (f: keyof SellerRow) =>
    sellers.reduce((s, r) => s + (Number(r[f]) || 0), 0);

  const total_ganha   = sum('total_ganha');
  const qty_ganha     = sum('qty_ganha');
  const target_amount = sum('target_amount');
  const is_closed     = sellers.length > 0 && sellers.every((s) => s.is_closed);
  const closed_at     = is_closed ? (sellers[0].closed_at ?? null) : null;

  return {
    mes,
    is_closed,
    closed_at,
    auto_closed:     false, // campo não exposto pela RPC; padrão conservador
    qty_aberta:      sum('qty_aberta'),
    total_aberta:    sum('total_aberta'),
    qty_ganha,
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
    sellers,
  };
}

/* ============================================================
   API pública
   ============================================================ */

/**
 * Verifica se o mês já foi fechado via RPC is_month_closed.
 */
export async function isMonthClosed(mes: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('is_month_closed', { p_month: toMonthDate(mes) });
  if (error) throw new Error(error.message);
  return !!data;
}

/**
 * Retorna dados do mês (aberto ou fechado) via RPC get_month_data.
 * A RPC retorna uma linha por vendedor; aqui agregamos em MonthData.
 */
export async function getMonthData(mes: string): Promise<MonthData> {
  const { data, error } = await supabase
    .rpc('get_month_data', { p_month: toMonthDate(mes) });
  if (error) throw new Error(error.message);

  const sellers = ((data as any[]) ?? []).map(toSellerRow);
  return buildMonthData(mes, sellers);
}

/**
 * Fecha o mês via RPC close_month (SECURITY DEFINER).
 * A RPC lida com a lógica de inserção por vendedor internamente.
 */
export async function closeMonth(
  mes: string,
  _tenantId: string,
  _profileId: string,
): Promise<void> {
  const already = await isMonthClosed(mes);
  if (already) throw new Error('Este mês já foi fechado.');

  const { error } = await supabase
    .rpc('close_month', { p_month: toMonthDate(mes) });
  if (error) throw new Error(error.message);
}

/**
 * Define/atualiza meta mensal de um vendedor em sales_monthly_targets.
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
        tenant_id:       tenantId,
        salesperson_id:  salespersonId,
        month:           toMonthDate(mes),
        target_amount:   goalAmount,
        target_quantity: goalQuantity,
      },
      { onConflict: 'tenant_id,salesperson_id,month' },
    );
  if (error) throw new Error(error.message);
}

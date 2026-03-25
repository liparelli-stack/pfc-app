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
export async function isMonthClosed(mes: string, tenantId: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('is_month_closed', { p_tenant_id: tenantId, p_month: toMonthDate(mes) });
  if (error) throw new Error(error.message);
  return !!data;
}

/**
 * Retorna dados do mês (aberto ou fechado) via RPC get_month_data.
 * A RPC retorna uma linha por vendedor; aqui agregamos em MonthData.
 */
export async function getMonthData(mes: string, tenantId: string): Promise<MonthData> {
  const { data, error } = await supabase
    .rpc('get_month_data', { p_tenant_id: tenantId, p_month: toMonthDate(mes) });
  if (error) throw new Error(error.message);

  const sellers = ((data as any[]) ?? []).map(toSellerRow);

  console.log('=== DEBUG GET_MONTH_DATA ===');
  console.log('Mês solicitado:', mes);
  console.log('Data enviada RPC:', toMonthDate(mes));
  console.log('Response data:', data);
  console.log('Response error:', error);
  console.log('Sellers mapeados:', sellers);
  console.log('MonthData final:', buildMonthData(mes, sellers));

  return buildMonthData(mes, sellers);
}

/**
 * Fecha o mês via RPC close_month (SECURITY DEFINER).
 * A RPC lida com a lógica de inserção por vendedor internamente.
 */
export async function closeMonth(
  mes: string,
  tenantId: string,
  profileId: string,
): Promise<void> {
  const already = await isMonthClosed(mes, tenantId);
  if (already) throw new Error('Este mês já foi fechado.');

  const { error } = await supabase
    .rpc('close_month', { p_tenant_id: tenantId, p_month: toMonthDate(mes), p_closed_by: profileId });
  if (error) throw new Error(error.message);
}

/* ============================================================
   Dados por vendedor (para exportação detalhada)
   ============================================================ */

export interface VendedorRow {
  vendedor:           string;
  meta:               number;
  ganhos:             number;
  percentualAtingido: number;
  participacao:       number;
  qtdGanhos:          number;
  ticketMedio:        number;
  emEspera:           number;
  qtdEspera:          number;
  perdidos:           number;
  percentualPerda:    number;
  qtdPerdidos:        number;
}

/**
 * Busca dados de orçamentos agrupados por vendedor para um mês/ano.
 * Meses fechados usam budget_monthly_closures; meses abertos processam chats.budgets (JSONB).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getVendedorData = async (
  selectedMonth: string,
  selectedYear: number,
  supabaseClient: any,
): Promise<VendedorRow[]> => {
  // 1. Profiles
  const { data: profiles, error: profilesError } = await supabaseClient
    .from('profiles')
    .select('id, full_name')
    .order('full_name');

  if (profilesError) throw profilesError;
  if (!profiles) return [];

  const monthDate = `${selectedYear}-${selectedMonth.padStart(2, '0')}-01`;

  // 2. Closures (snapshot se mês fechado)
  const { data: closures } = await supabaseClient
    .from('budget_monthly_closures')
    .select('*')
    .eq('month', monthDate);

  // 3. Metas do mês (coluna month é date 'YYYY-MM-01')
  const { data: targets } = await supabaseClient
    .from('sales_monthly_targets')
    .select('salesperson_id, target_amount')
    .eq('month', monthDate);

  // 4. Todos os chats com budgets (sem filtro de data — filtramos por budget.updated_at abaixo)
  const { data: allChats } = await supabaseClient
    .from('chats')
    .select('author_user_id, budgets')
    .not('budgets', 'eq', '[]');

  const targetMonth = parseInt(selectedMonth, 10);

  const vendedorData = profiles.map((profile: { id: string; full_name: string }) => {
    const closure = closures?.find((c: any) => c.salesperson_id === profile.id);

    let dados = {
      vendedor: profile.full_name,
      meta: 0, ganhos: 0, qtdGanhos: 0,
      emEspera: 0, qtdEspera: 0,
      perdidos: 0, qtdPerdidos: 0,
    };

    if (closure) {
      // Mês fechado — usa snapshot
      dados = {
        vendedor:    profile.full_name,
        meta:        Number(closure.target_amount) || 0,
        ganhos:      Number(closure.total_ganha)   || 0,
        qtdGanhos:   closure.qty_ganha             || 0,
        emEspera:    Number(closure.total_aberta)  || 0,
        qtdEspera:   closure.qty_aberta            || 0,
        perdidos:    Number(closure.total_perdida) || 0,
        qtdPerdidos: closure.qty_perdida           || 0,
      };
    } else {
      // Mês aberto — meta da tabela de targets
      const target = (targets as any[])?.find((t: any) => t.salesperson_id === profile.id);
      dados.meta = Number(target?.target_amount) || 0;

      // Itera chats filtrando budgets pelo mês/ano do budget (updated_at ou created_at)
      if (allChats) {
        (allChats as any[]).forEach((chat: any) => {
          if (chat.author_user_id !== profile.id) return;
          const budgets = Array.isArray(chat.budgets) ? chat.budgets : [];
          budgets.forEach((budget: any) => {
            const rawDate = budget.updated_at ?? budget.created_at;
            if (rawDate) {
              const d = new Date(rawDate);
              if (d.getMonth() + 1 !== targetMonth || d.getFullYear() !== selectedYear) return;
            }
            const amount = Number(budget.amount ?? budget.value ?? 0);
            const status = (budget.status ?? '').toLowerCase();
            if (status === 'ganha') {
              dados.ganhos += amount; dados.qtdGanhos += 1;
            } else if (status === 'em_espera' || status === 'aberta') {
              dados.emEspera += amount; dados.qtdEspera += 1;
            } else if (status === 'perdida') {
              dados.perdidos += amount; dados.qtdPerdidos += 1;
            }
          });
        });
      }
    }

    const ticketMedio        = dados.qtdGanhos > 0 ? dados.ganhos / dados.qtdGanhos : 0;
    const percentualAtingido = dados.meta      > 0 ? (dados.ganhos / dados.meta) : 0; // fração pura
    const percentualPerda    = dados.ganhos    > 0 ? (dados.perdidos / dados.ganhos) : 0; // fração pura
    const participacao       = 0; // calculado abaixo

    return { ...dados, ticketMedio, percentualAtingido, percentualPerda, participacao };
  });

  // Participação = fração pura (0–1); Excel formata como %
  const totalGeralGanhos = vendedorData.reduce((s: number, v: VendedorRow) => s + v.ganhos, 0);

  return vendedorData.map((v: VendedorRow) => ({
    ...v,
    participacao: totalGeralGanhos > 0 ? v.ganhos / totalGeralGanhos : 0,
  }));
};

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

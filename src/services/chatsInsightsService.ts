/*
-- ===================================================
-- Código             : /src/services/chatsInsightsService.ts
-- Versão (.v20)      : 1.2.1
-- Data/Hora          : 2025-12-03 15:30 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Serviço de agregação de Insights (KPIs + séries) a partir de `chats`
-- Fluxo              : UI/Hook → getChatsInsights(params) → Supabase (RLS) → agregação em memória
-- Alterações (1.2.1) :
--  • FIX budgets: inclusão de mapeamento explícito para status "aberta"/"aberto"/"em aberto"
--    como estágio em_espera e "ganha"/"fechada" como estágio ganha.
--  • Garante alinhamento com DealWithChats (status: 'aberta' | 'ganha' | 'perdida').
-- Alterações (1.2.0) :
--  • FIX budgets: mapeamento por `status` do JSON (em_espera | fechada→ganha | perdida).
--  • parseAmount robusto (number | string com vírgula/ponto).
--  • Removida dependência de `isBudgetChat`; agrega sempre que existir budgets[].
--  • Mantidos KPIs e séries originais (sem alteração de layout/contrato).
-- Dependências       : @/lib/supabaseClient, /src/types/insights
-- ===================================================
*/

import { supabase } from '@/lib/supabaseClient';
import type {
  ChatsInsights,
  ChatsInsightsRequest,
  BreakdownItem,
  SeriesPoint,
  DateRange,
  BudgetStagesAggregate,
} from '@/types/insights';

// ---------- Helpers de data ----------
function toStartOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}
function addDaysUTC(d: Date, days: number): Date {
  const nd = new Date(d.getTime());
  nd.setUTCDate(nd.getUTCDate() + days);
  return nd;
}
function fmtISO(date: Date): string {
  return date.toISOString();
}
function eachDaySeries(range: DateRange): Date[] {
  const start = new Date(range.start);
  const end = new Date(range.end);
  const days: Date[] = [];
  let cursor = toStartOfDayUTC(start);
  const endDay = toStartOfDayUTC(end);
  while (cursor.getTime() <= endDay.getTime()) {
    days.push(new Date(cursor));
    cursor = addDaysUTC(cursor, 1);
  }
  return days;
}
function dayKeyUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// ---------- Normalizações ----------
function normKey(value: string | null | undefined, fallback = 'desconhecido'): string {
  return (value ?? '').toString().trim().toLowerCase() || fallback;
}

// Novo: mapeia primeiro por `status`, depois por `pipeline_stage` (fallback)
function stageKeyFromBudget(b: any): 'em_espera' | 'ganha' | 'perdida' | null {
  const s = normKey(b?.status, '');

  if (s) {
    // Aberta / Em aberto → em_espera
    if (s === 'em_espera' || s === 'aberta' || s === 'aberto' || s === 'em aberto') {
      return 'em_espera';
    }

    // Ganha / Fechada → ganha
    if (
      s === 'ganha' ||
      s === 'fechada' ||
      s === 'fechado' ||
      s === 'fechamento'
    ) {
      return 'ganha';
    }

    // Perdida
    if (s === 'perdida' || s === 'perdido') {
      return 'perdida';
    }
  }

  // Fallback via pipeline_stage (mantém compatibilidade antiga)
  const p = normKey(b?.pipeline_stage, '');
  if (!p) return null;
  if (p.includes('espera')) return 'em_espera';
  if (p.includes('fech')) return 'ganha'; // Fechamento / Fechada
  if (p.includes('perd')) return 'perdida';
  return null;
}

function parseAmount(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (typeof raw === 'string') {
    // remove separador de milhar '.' e usa ',' como decimal
    const n = Number(raw.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// ---------- Tipos de linha mínima de `chats` ----------
type ChatRow = {
  id: string;
  created_at: string | null;
  calendar_at: string | null;
  is_done: boolean | null;
  kind: string | null;
  temperature: string | null;
  company_id: string | null;
  budgets?: any; // JSONB
};

// ---------- Serviço principal ----------
export async function getChatsInsights(params: ChatsInsightsRequest): Promise<ChatsInsights> {
  const { range, companyId } = params;

  // Consulta mínima: traz apenas colunas necessárias no período (inclui budgets)
  let query = supabase
    .from('chats')
    .select('id,created_at,calendar_at,is_done,kind,temperature,company_id,budgets')
    .gte('created_at', range.start)
    .lte('created_at', range.end);

  if (companyId) {
    query = query.eq('company_id', companyId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[getChatsInsights] erro supabase:', error);
    return emptyInsights(range, companyId ?? null);
  }

  const rows: ChatRow[] = data ?? [];

  // Totais básicos
  let total = 0;
  let concluidas = 0;
  let abertas = 0;

  // Quebras
  const porTipoMap = new Map<string, number>();
  const porTempMap = new Map<string, number>();

  // Tendências (por dia)
  const byDayTotal = new Map<string, number>();
  const byDayDone = new Map<string, number>();

  // SLA/agendamento
  const todayUTC = toStartOfDayUTC(new Date());
  const next7UTC = addDaysUTC(todayUTC, 7);
  let atrasadas = 0;
  let agendadas7d = 0;

  // ===== Orçamentos (budgets em chats) =====
  const budgetsCount: BudgetStagesAggregate<number> = { em_espera: 0, ganha: 0, perdida: 0 };
  const budgetsValue: BudgetStagesAggregate<number> = { em_espera: 0, ganha: 0, perdida: 0 };

  for (const r of rows) {
    total++;

    const done = !!r.is_done;
    if (done) concluidas++;
    else abertas++;

    // kind
    const k = normKey(r.kind);
    porTipoMap.set(k, (porTipoMap.get(k) ?? 0) + 1);

    // temperature
    const t = normKey(r.temperature);
    porTempMap.set(t, (porTempMap.get(t) ?? 0) + 1);

    // tendências por dia (com base em created_at)
    if (r.created_at) {
      const created = toStartOfDayUTC(new Date(r.created_at));
      const key = dayKeyUTC(created);
      byDayTotal.set(key, (byDayTotal.get(key) ?? 0) + 1);
      if (done) byDayDone.set(key, (byDayDone.get(key) ?? 0) + 1);
    }

    // atrasadas/agendadas (com base em calendar_at)
    if (!done && r.calendar_at) {
      const cal = toStartOfDayUTC(new Date(r.calendar_at));
      if (cal.getTime() < todayUTC.getTime()) {
        atrasadas++;
      } else if (cal.getTime() >= todayUTC.getTime() && cal.getTime() <= next7UTC.getTime()) {
        agendadas7d++;
      }
    }

    // ===== Agregação de budgets por estágio (status primeiro; fallback pipeline_stage) =====
    const budgetsArr = Array.isArray(r.budgets) ? r.budgets : null;
    if (budgetsArr && budgetsArr.length > 0) {
      for (const b of budgetsArr) {
        const stage = stageKeyFromBudget(b);
        if (!stage) continue;
        const amountNum = parseAmount(b?.amount);
        budgetsCount[stage] += 1;
        budgetsValue[stage] += amountNum;
      }
    }
  }

  const diasNoPeriodo = Math.max(1, eachDaySeries(range).length);
  const taxaConclusao = total > 0 ? concluidas / total : 0;
  const mediaPorDia = total / diasNoPeriodo;

  const porTipo = mapToBreakdown(porTipoMap);
  const porTemperatura = mapToBreakdown(porTempMap);

  // Série contínua por dia no período (preenche zeros)
  const tendenciaDiaria: SeriesPoint[] = [];
  const tendenciaConcluidasDiaria: SeriesPoint[] = [];

  for (const d of eachDaySeries(range)) {
    const key = dayKeyUTC(d);
    tendenciaDiaria.push({ x: fmtISO(d), y: byDayTotal.get(key) ?? 0 });
    tendenciaConcluidasDiaria.push({ x: fmtISO(d), y: byDayDone.get(key) ?? 0 });
  }

  return {
    total,
    abertas,
    concluidas,
    taxaConclusao,

    porTipo,
    porTemperatura,

    atrasadas,
    agendadas7d,

    tendenciaDiaria,
    tendenciaConcluidasDiaria,

    mediaPorDia,
    range,
    companyId: companyId ?? null,

    budgetsPorEstagioCount: budgetsCount,
    budgetsPorEstagioValue: budgetsValue,
  };
}

// ---------- Utilidades ----------
function mapToBreakdown(m: Map<string, number>): BreakdownItem[] {
  return Array.from(m.entries())
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value);
}

function emptyInsights(range: DateRange, companyId: string | null): ChatsInsights {
  return {
    total: 0,
    abertas: 0,
    concluidas: 0,
    taxaConclusao: 0,
    porTipo: [],
    porTemperatura: [],
    atrasadas: 0,
    agendadas7d: 0,
    tendenciaDiaria: [],
    tendenciaConcluidasDiaria: [],
    mediaPorDia: 0,
    range,
    companyId,
    budgetsPorEstagioCount: { em_espera: 0, ganha: 0, perdida: 0 },
    budgetsPorEstagioValue: { em_espera: 0, ganha: 0, perdida: 0 },
  };
}

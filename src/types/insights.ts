/*
-- ===================================================
-- Código             : /src/types/insights.ts
-- Versão (.v20)      : 1.1.0
-- Data/Hora          : 2025-11-05 20:22 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Tipos compartilhados para Insights de chats (Visão 360)
-- Fluxo              : UI → hooks/useChatsInsights → services/chatsInsightsService
-- Alterações (1.1.0) :
--  • Adicionados agregados de orçamentos por estágio (count e value em BRL)
-- Dependências       : (apenas TS)
*/

export type IsoDate = string; // ISO-8601

export type InsightsPreset =
  | 'LAST_15_DAYS'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_YEAR'
  | 'LAST_YEAR'
  | 'CUSTOM';

export interface DateRange {
  start: IsoDate; // inclusive
  end: IsoDate;   // inclusive
}

export interface ChatsInsightsRequest {
  range: DateRange;
  companyId?: string | null;
}

export interface SeriesPoint {
  x: IsoDate; // dia (YYYY-MM-DDT00:00:00Z)
  y: number;
}

export interface BreakdownItem {
  key: string; // ex.: 'ligacao' | 'tarefa' | 'fria' | 'morna' | 'quente' | 'desconhecido'
  value: number;
}

export type BudgetStageKey = 'em_espera' | 'ganha' | 'perdida';

export interface BudgetStagesAggregate<T = number> {
  em_espera: T;
  ganha: T;
  perdida: T;
}

export interface ChatsInsights {
  // Totais
  total: number;
  abertas: number;
  concluidas: number;
  taxaConclusao: number; // 0..1

  // Quebras
  porTipo: BreakdownItem[];
  porTemperatura: BreakdownItem[];

  // SLA/agendamento
  atrasadas: number;     // calendar_at < hoje e is_done=false
  agendadas7d: number;   // calendar_at entre hoje..+7d e is_done=false

  // Tendências
  tendenciaDiaria: SeriesPoint[];           // count por dia (criação)
  tendenciaConcluidasDiaria: SeriesPoint[]; // concluidas por dia

  // Auxiliares
  mediaPorDia: number; // total / dias no range
  range: DateRange;
  companyId?: string | null;

  // ===== Orçamentos (budgets em chats) =====
  budgetsPorEstagioCount: BudgetStagesAggregate; // contagem de orçamentos por estágio
  budgetsPorEstagioValue: BudgetStagesAggregate; // soma de valores (BRL) por estágio
}

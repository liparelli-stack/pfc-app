/*
-- ===================================================
-- Código             : /src/hooks/useChatsInsights.ts
-- Versão (.v20)      : 1.2.3
-- Data/Hora          : 2025-11-05 23:14 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo           : Hook de Insights com TIPOS INLINE (evita dependência de exports externos)
-- Fluxo              : InsightsStrip → useChatsInsights → getChatsInsights (service)
-- Alterações (1.2.3) :
--  • Export público `computeRangeByPreset` (alias de `presetToRange`) para compatibilidade com InsightsFilter.
-- Alterações (1.2.2) :
--  • Removidas importações de tipos. Pass-through de budgets* garantido.
-- Dependências       : /src/services/chatsInsightsService.getChatsInsights
-- ===================================================
*/

import * as React from 'react';
import { getChatsInsights } from '@/services/chatsInsightsService';

/** Tipos INLINE (somente o que o app usa) */
export type InsightsPreset =
  | 'LAST_15_DAYS'
  | 'THIS_MONTH'
  | 'LAST_MONTH'
  | 'THIS_YEAR'
  | 'LAST_YEAR'
  | 'CUSTOM';

export type DateRange = { start: string; end: string };

export type BreakdownItem = { key: string; value: number };

export type ChatsInsights = {
  total: number;
  concluidas: number;
  abertas: number;
  taxaConclusao: number;
  mediaPorDia: number;
  tendenciaDiaria?: { x: string | number | Date; y: number }[];
  porTemperatura?: BreakdownItem[];
  atrasadas?: number;
  agendadas7d?: number;

  budgetsPorEstagioValue?: { em_espera: number; ganha: number; perdida: number };
  budgetsPorEstagioCount?: { em_espera: number; ganha: number; perdida: number };
};

export type ChatsInsightsRequest = {
  range: DateRange;
  companyId: string | null;
};

function presetToRange(preset: InsightsPreset): DateRange {
  const now = new Date();
  // janela até o fim do dia UTC
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  const start = new Date(end);

  switch (preset) {
    case 'LAST_15_DAYS':
      start.setUTCDate(start.getUTCDate() - 14);
      break;
    case 'THIS_MONTH':
      start.setUTCDate(1);
      break;
    case 'LAST_MONTH': {
      const m = new Date(end);
      m.setUTCMonth(m.getUTCMonth() - 1, 1);
      const lastDay = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      return { start: m.toISOString(), end: lastDay.toISOString() };
    }
    case 'THIS_YEAR':
      start.setUTCMonth(0, 1);
      break;
    case 'LAST_YEAR': {
      const y = end.getUTCFullYear() - 1;
      const s = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
      const e = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
      return { start: s.toISOString(), end: e.toISOString() };
    }
    case 'CUSTOM':
    default:
      // será definido externamente por setCustomRange
      break;
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

/** ⬅️ Export público para o InsightsFilter */
export function computeRangeByPreset(preset: InsightsPreset): DateRange {
  return presetToRange(preset);
}

type UseChatsInsightsOpts = {
  initialCompanyId?: string | null;
  initialPreset?: InsightsPreset;
  initialCustomRange?: DateRange;
};

type UseChatsInsights = {
  insights: ChatsInsights | null;
  loading: boolean;
  error: string | null;

  preset: InsightsPreset;
  range: DateRange;

  setPreset: (p: InsightsPreset) => void;
  setCustomRange: (r: DateRange) => void;
  setCompanyId: (id: string | null) => void;

  refetch: () => void;
};

export default function useChatsInsights(opts?: UseChatsInsightsOpts): UseChatsInsights {
  const [companyId, setCompanyId] = React.useState<string | null>(opts?.initialCompanyId ?? null);
  const [preset, setPreset] = React.useState<InsightsPreset>(opts?.initialPreset ?? 'LAST_15_DAYS');
  const [range, setRange] = React.useState<DateRange>(
    opts?.initialCustomRange ?? presetToRange(opts?.initialPreset ?? 'LAST_15_DAYS')
  );

  const [insights, setInsights] = React.useState<ChatsInsights | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Atualiza o range quando o preset muda (exceto CUSTOM)
  React.useEffect(() => {
    if (preset !== 'CUSTOM') setRange(presetToRange(preset));
  }, [preset]);

  const fetcher = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: ChatsInsightsRequest = { range, companyId };
      const data = (await getChatsInsights(payload)) as ChatsInsights;

      // Pass-through TOTAL (inclui budgetsPorEstagioCount e budgetsPorEstagioValue)
      setInsights(data ?? null);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar insights');
      setInsights(null);
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end, companyId]);

  React.useEffect(() => {
    fetcher();
  }, [fetcher]);

  return {
    insights,
    loading,
    error,

    preset,
    range,

    setPreset,
    setCustomRange: setRange,
    setCompanyId,

    refetch: fetcher,
  };
}

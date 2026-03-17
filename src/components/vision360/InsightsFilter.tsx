/*
-- ===================================================
-- Código             : /src/components/vision360/InsightsFilter.tsx
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-11-05 17:12 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Filtro de período (presets + personalizado) para Insights da Visão 360
-- Fluxo              : InsightsFilter → emite onChange({ preset, range })
-- Alterações (1.0.0) :
--  • Dropdown com presets e controles para range customizado (dois inputs type=date)
-- Dependências       : /src/types/insights
*/

import React, { useEffect, useMemo, useState } from 'react';
import type { DateRange, InsightsPreset } from '@/types/insights';
import { computeRangeByPreset } from '@/hooks/useChatsInsights';

type Props = {
  valuePreset: InsightsPreset;
  valueRange: DateRange;
  onChange: (next: { preset: InsightsPreset; range: DateRange }) => void;
  className?: string;
};

const presetLabels: Record<InsightsPreset, string> = {
  LAST_15_DAYS: 'Últimos 15 dias',
  THIS_MONTH: 'Mês atual',
  LAST_MONTH: 'Mês passado',
  THIS_YEAR: 'Este ano',
  LAST_YEAR: 'Ano passado',
  CUSTOM: 'Personalizado',
};

function toLocalDateInputValue(iso: string) {
  // extrai YYYY-MM-DD do ISO (UTC) para o <input type="date">
  return (iso ?? '').slice(0, 10);
}
function fromLocalDateToISO(localDate: string, endOfDay = false) {
  if (!localDate) return '';
  const [y, m, d] = localDate.split('-').map((v) => parseInt(v, 10));
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return '';
  const base = endOfDay
    ? new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
    : new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  return base.toISOString();
}

const InsightsFilter: React.FC<Props> = ({ valuePreset, valueRange, onChange, className }) => {
  const [preset, setPreset] = useState<InsightsPreset>(valuePreset);
  const [startLocal, setStartLocal] = useState<string>(toLocalDateInputValue(valueRange.start));
  const [endLocal, setEndLocal] = useState<string>(toLocalDateInputValue(valueRange.end));

  // Mantém sincronizado com props externas
  useEffect(() => setPreset(valuePreset), [valuePreset]);
  useEffect(() => {
    setStartLocal(toLocalDateInputValue(valueRange.start));
    setEndLocal(toLocalDateInputValue(valueRange.end));
  }, [valueRange.start, valueRange.end]);

  // Ao trocar preset (não custom), recalcula e emite
  useEffect(() => {
    if (preset !== 'CUSTOM') {
      const nextRange = computeRangeByPreset(preset);
      onChange({ preset, range: nextRange });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const isCustom = useMemo(() => preset === 'CUSTOM', [preset]);

  // Submit de custom range
  const applyCustom = () => {
    const startISO = fromLocalDateToISO(startLocal, false);
    const endISO = fromLocalDateToISO(endLocal, true);
    if (!startISO || !endISO) return;
    onChange({ preset: 'CUSTOM', range: { start: startISO, end: endISO } });
  };

  return (
    <div className={`flex flex-col gap-2 sm:flex-row sm:items-end ${className ?? ''}`}>
      {/* Presets */}
      <div className="flex flex-col">
        <label className="text-xs text-gray-500 mb-1">Período</label>
        <select
          className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-zinc-900"
          value={preset}
          onChange={(e) => setPreset(e.target.value as InsightsPreset)}
        >
          <option value="LAST_15_DAYS">{presetLabels.LAST_15_DAYS}</option>
          <option value="THIS_MONTH">{presetLabels.THIS_MONTH}</option>
          <option value="LAST_MONTH">{presetLabels.LAST_MONTH}</option>
          <option value="THIS_YEAR">{presetLabels.THIS_YEAR}</option>
          <option value="LAST_YEAR">{presetLabels.LAST_YEAR}</option>
          <option value="CUSTOM">{presetLabels.CUSTOM}</option>
        </select>
      </div>

      {/* Custom range */}
      {isCustom && (
        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Início</label>
            <input
              type="date"
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-zinc-900"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-gray-500 mb-1">Fim</label>
            <input
              type="date"
              className="rounded-xl border px-3 py-2 text-sm bg-white dark:bg-zinc-900"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
            />
          </div>
          <button
            className="h-10 px-4 rounded-xl border text-sm bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition"
            onClick={applyCustom}
            title="Aplicar período personalizado"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
};

export default InsightsFilter;

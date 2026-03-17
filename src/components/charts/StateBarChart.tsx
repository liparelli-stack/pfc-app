/*
-- ===================================================
-- Código             : /src/components/charts/StateBarChart.tsx
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-11-06 22:48 America/Sao_Paulo
-- Autor              : FL / Execução via E.V.A.
-- Objetivo do código : Renderizar barras horizontais (Top 6 + Outros)
-- ===================================================
*/

import React from 'react';
import { CompanyByState } from '@/types/dashboard';

interface Props {
  data: CompanyByState[];
}

const colorMap: Record<string, string> = {
  SP: '#4F46E5',
  RJ: '#F59E0B',
  MG: '#10B981',
  PR: '#8B5CF6',
  RS: '#EF4444',
  Outros: '#14B8A6',
};

export const StateBarChart: React.FC<Props> = ({ data }) => {
  if (!data?.length) return <p className="text-sm text-muted-foreground">Sem dados regionais</p>;

  const maxTotal = Math.max(...data.map(d => d.total));

  return (
    <div className="flex flex-col gap-2 mt-3">
      {data.map(({ label, total, pct }) => {
        const width = (total / maxTotal) * 100;
        const color = colorMap[label] || '#6B7280';
        return (
          <div key={label} className="flex items-center gap-2">
            <span className="w-12 text-sm font-medium">{label}</span>
            <div className="flex-1 h-2 rounded-full bg-gray-200 relative">
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${width}%`, backgroundColor: color }}
              />
            </div>
            <span className="w-24 text-right text-sm text-muted-foreground">
              {total} · {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
};

/*
-- ===================================================
-- Código             : /src/components/vision360/mini/MiniBar.tsx
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-11-05 17:25 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Mini gráfico de barras verticais em SVG
-- Fluxo              : InsightsStrip → MiniBar (ex.: Abertas vs Concluídas, por tipo)
-- Alterações (1.0.0) :
--  • Barras proporcionais ao valor (auto-fit)
-- Dependências       : react
*/

import React, { useMemo } from 'react';
import type { BreakdownItem } from '@/types/insights';

type Props = {
  items: BreakdownItem[]; // usa os N primeiros
  maxBars?: number;
  width?: number;
  height?: number;
  className?: string;
  showLabels?: boolean;
};

const MiniBar: React.FC<Props> = ({
  items,
  maxBars = 5,
  width = 160,
  height = 50,
  className,
  showLabels = false,
}) => {
  const top = useMemo(() => (items ?? []).slice(0, maxBars), [items, maxBars]);
  const maxV = useMemo(() => Math.max(1, ...top.map((i) => i.value)), [top]);
  const barW = useMemo(() => (width / Math.max(1, top.length)) * 0.6, [width, top.length]);
  const gap = useMemo(() => (width / Math.max(1, top.length)) * 0.4, [width, top.length]);

  return (
    <div className={className}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="mini-bar">
        {top.map((it, idx) => {
          const h = (it.value / maxV) * (height - 8);
          const x = idx * (barW + gap) + gap / 2;
          const y = height - h;
          return <rect key={it.key} x={x} y={y} width={barW} height={h} fill="currentColor" rx={2} />;
        })}
      </svg>
      {showLabels && (
        <div className="grid grid-cols-2 gap-1 mt-1 text-[10px] text-gray-500 dark:text-dark-t2">
          {top.map((it) => (
            <div key={it.key} className="truncate">{`${it.key} · ${it.value}`}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MiniBar;

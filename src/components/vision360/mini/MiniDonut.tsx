/*
-- ===================================================
-- Código             : /src/components/vision360/mini/MiniDonut.tsx
-- Versão (.v20)      : 1.1.0
-- Data/Hora          : 2025-12-03 15:30 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Mini-rosca (donut) em SVG para breakdown percentual
-- Fluxo              : InsightsStrip → MiniDonut (ex.: por temperatura)
-- Alterações (1.1.0) :
--  • Adicionado tooltip nativo (<title>) em cada segmento com label + percentual + valor.
--  • aria-label descritivo com distribuição percentual.
-- Alterações (1.0.0) :
--  • Render com múltiplos segmentos usando stroke-dasharray
-- Dependências       : react
-- ===================================================
*/

import React, { useMemo } from 'react';
import type { BreakdownItem } from '@/types/insights';

type Props = {
  items: BreakdownItem[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
  // cores opcionais por chave, senão usa cor atual
  colorForKey?: (key: string, index: number) => string | undefined;
};

const MiniDonut: React.FC<Props> = ({
  items,
  width = 72,
  height = 72,
  strokeWidth = 8,
  className,
  colorForKey,
}) => {
  const totalRaw = items.reduce((acc, it) => acc + it.value, 0);
  const total = Math.max(1, totalRaw); // evita divisão por zero

  const radius = Math.min(width, height) / 2 - strokeWidth;
  const cx = width / 2;
  const cy = height / 2;
  const circumference = 2 * Math.PI * radius;

  const segments = useMemo(() => {
    let acc = 0;
    return items.map((it, idx) => {
      const frac = it.value / total;
      const dash = frac * circumference;
      const gap = circumference - dash;
      const offset = circumference * (1 - acc);
      acc += frac;

      const pct = frac * 100;

      return {
        key: it.key,
        idx,
        dash,
        gap,
        offset,
        value: it.value,
        pct,
      };
    });
  }, [items, circumference, total]);

  const ariaLabel = useMemo(() => {
    if (!items.length || totalRaw <= 0) return 'Distribuição vazia';
    const parts = items.map((it) => {
      const pct = (it.value / total) * 100;
      return `${it.key}: ${pct.toFixed(1)}%`;
    });
    return `Distribuição por categoria: ${parts.join(', ')}`;
  }, [items, total, totalRaw]);

  return (
    <svg
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {/* Trilha de fundo */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.2}
        />
        {/* Segmentos */}
        {segments.map((s) => (
          <circle
            key={s.key}
            cx={cx}
            cy={cy}
            r={radius}
            stroke={colorForKey?.(s.key, s.idx) ?? 'currentColor'}
            strokeWidth={strokeWidth}
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={s.offset}
            fill="none"
          >
            {/* Tooltip nativo do browser: label + percentual + valor bruto */}
            <title>
              {`${s.key}: ${s.pct.toFixed(1)}% (${s.value})`}
            </title>
          </circle>
        ))}
      </g>
    </svg>
  );
};

export default MiniDonut;

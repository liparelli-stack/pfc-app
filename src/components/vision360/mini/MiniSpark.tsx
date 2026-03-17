/*
-- ===================================================
-- Código             : /src/components/vision360/mini/MiniSpark.tsx
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-11-05 17:25 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Sparkline simples em SVG para séries diárias
-- Fluxo              : InsightsStrip → MiniSpark (série tendência)
-- Alterações (1.0.0) :
--  • Render de linha contínua com preenchimento condicional (opcional)
-- Dependências       : react, tailwindcss
*/

import React, { useMemo } from 'react';
import type { SeriesPoint } from '@/types/insights';

type Props = {
  data: SeriesPoint[];
  width?: number;
  height?: number;
  className?: string;
};

const MiniSpark: React.FC<Props> = ({ data, width = 120, height = 36, className }) => {
  const path = useMemo(() => {
    if (!data?.length) return '';
    const xs = data.map((_, i) => i);
    const ys = data.map((p) => p.y);
    const minY = Math.min(...ys, 0);
    const maxY = Math.max(...ys, 1);
    const dx = width / Math.max(1, data.length - 1);
    const norm = (v: number) => {
      if (maxY === minY) return height / 2;
      return height - ((v - minY) / (maxY - minY)) * height;
    };
    return xs
      .map((i) => `${i === 0 ? 'M' : 'L'} ${i * dx},${norm(ys[i])}`)
      .join(' ');
  }, [data, width, height]);

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="sparkline"
    >
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.8} />
    </svg>
  );
};

export default MiniSpark;

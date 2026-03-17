/*
-- ===================================================
-- Código             : /src/components/vision360/mini/MiniTrendDot.tsx
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-11-05 17:25 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Indicador de tendência (seta ↑/↓) com % e cor semântica
-- Fluxo              : InsightsStrip → MiniTrendDot
-- Alterações (1.0.0) :
--  • Cálculo e apresentação simples de variação
-- Dependências       : react, tailwindcss
*/

import React from 'react';

type Props = {
  deltaPct: number; // ex.: +12.3 ou -5.1
  label?: string;
};

const MiniTrendDot: React.FC<Props> = ({ deltaPct, label }) => {
  const up = deltaPct >= 0;
  const cls = up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  const arrow = up ? '↑' : '↓';
  const pct = Math.abs(deltaPct).toFixed(1);

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs ${cls} border-current`}>
      <span aria-hidden>{arrow}</span>
      <span>{pct}%</span>
      {label ? <span className="text-[10px] opacity-80">{label}</span> : null}
    </div>
  );
};

export default MiniTrendDot;

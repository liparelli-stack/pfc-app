/*
-- ===================================================
-- Código             : /src/components/vision360/kpis/KpiCard.tsx
-- Versão (.v20)      : 1.1.0
-- Data/Hora          : 2025-12-03 15:45 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Card KPI genérico com slot para mini-gráfico/indicador
-- Fluxo              : InsightsStrip → KpiCard (children para gráfico/indicador)
-- Alterações (1.1.0) :
--  • title passou a aceitar React.ReactNode (permite ícones/tooltip embutidos, ex.: (i) de ajuda).
-- Alterações (1.0.0) :
--  • Criação do card base com título, valor e slot
-- Dependências       : react, tailwindcss
*/

import React from 'react';

type Props = {
  title: React.ReactNode;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
  children?: React.ReactNode; // mini-chart / indicador
};

const KpiCard: React.FC<Props> = ({ title, value, subtitle, className, children }) => {
  return (
    <div
      className={
        'rounded-2xl border shadow-sm p-4 bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 ' +
        (className ?? '')
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-gray-500 dark:text-dark-t2 truncate">
            {title}
          </div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-dark-t1">{value}</div>
          {subtitle ? (
            <div className="mt-1 text-xs text-gray-500 dark:text-dark-t2">{subtitle}</div>
          ) : null}
        </div>
        {children ? <div className="shrink-0">{children}</div> : null}
      </div>
    </div>
  );
};

export default KpiCard;

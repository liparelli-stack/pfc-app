/*
-- ===================================================
-- Código             : /src/components/dashboard/CompanyMixCard.tsx
-- Versão (.v20)      : 1.1.0
-- Data/Hora          : 2025-11-23 17:30 America/Sao_Paulo
-- Autor              : FL / Execução via E.V.A.
-- Objetivo do código : Exibir lista C/P/L + gráfico Top 6 Estados no mesmo quadro
-- Fluxo              : Dashboard -> CompanyMixCard -> useDashboardQuadro2 -> dashboardService
-- Alterações (1.1.0) :
--   • [FIX] Troca do hook para useDashboardQuadro2, que expõe mixQuery/stateQuery
--     conectados às views vw_company_mix e vw_company_by_state_top6.
--   • Mantido layout e lógica de exibição originais.
-- Dependências       : @/hooks/useDashboardQuadro2, @/components/charts/StateBarChart
-- ===================================================
*/

import React from 'react';
import { useDashboardQuadro2 } from '@/hooks/useDashboardQuadro2';
import { StateBarChart } from '@/components/charts/StateBarChart';

export const CompanyMixCard: React.FC = () => {
  const { mixQuery, stateQuery } = useDashboardQuadro2();
  const isLoading = mixQuery.isLoading || stateQuery.isLoading;

  if (isLoading) return <div className="p-4 animate-pulse">Carregando...</div>;
  if (mixQuery.error || stateQuery.error)
    return <div className="p-4 text-red-500">Erro ao carregar dados.</div>;

  const mix = mixQuery.data ?? [];
  const states = stateQuery.data ?? [];
  const totalBase = mix[0]?.total_base ?? 0;

  const colorMap: Record<string, string> = {
    client: '#10B981',
    prospect: '#F59E0B',
    lead: '#3B82F6',
  };

  return (
    <div className="p-4 rounded-2xl shadow-sm bg-card">
      <h2 className="text-lg font-semibold mb-3">Distribuição de Empresas</h2>

      {/* Lista C/P/L */}
      <div className="flex flex-col gap-2">
        {mix.map(({ kind, qtd, pct }) => {
          const color = colorMap[kind] || '#6B7280';
          return (
            <div key={kind} className="flex items-center gap-2">
              <span className="w-24 text-sm font-medium capitalize">{kind}</span>
              <div className="flex-1 h-2 bg-gray-200 rounded-full relative">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
              <span className="w-24 text-right text-sm text-muted-foreground">
                {qtd} · {pct}%
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-2 text-right">
        Base total: {totalBase.toLocaleString()} empresas
      </p>

      {/* Top 6 Estados */}
      <h3 className="text-sm font-medium mt-4 mb-1">Top 6 Estados · Qtd · %</h3>
      <StateBarChart data={states} />
    </div>
  );
};

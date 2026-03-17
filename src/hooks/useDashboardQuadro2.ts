/*
-- ===================================================
-- Código             : /src/hooks/useDashboardQuadro2.ts
-- Versão (.v20)      : 1.2.0
-- Data/Hora          : 2025-11-24 10:30 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Hook para dados do Quadro 2 do Dashboard
--                      (Distribuição de Empresas C/P/L + Top 6 Estados),
--                      consumindo views vw_company_mix e vw_company_by_state_top6,
--                      com cache sensível ao usuário autenticado.
-- Fluxo              : Dashboard -> CompanyMixCard -> useDashboardQuadro2 -> dashboardService
-- Alterações (1.2.0) :
--   • queryKey agora inclui user.id para evitar reaproveitar cache
--     entre usuários/tenants diferentes.
--   • enabled condicionado à existência de user (Auth pronto).
-- Dependências       : @tanstack/react-query, @/services/dashboardService,
--                      @/contexts/AuthContext
-- ===================================================
*/

import { useQuery } from '@tanstack/react-query';
import { getCompanyMix, getCompanyByStateTop6 } from '@/services/dashboardService';
import { useAuth } from '@/contexts/AuthContext';

export function useDashboardQuadro2() {
  const { user } = useAuth();
  const userId = user?.id;

  const mixQuery = useQuery({
    queryKey: ['dashboard', 'companyMix', userId],
    queryFn: getCompanyMix,
    enabled: !!userId,
  });

  const stateQuery = useQuery({
    queryKey: ['dashboard', 'companyByStateTop6', userId],
    queryFn: getCompanyByStateTop6,
    enabled: !!userId,
  });

  return { mixQuery, stateQuery };
}

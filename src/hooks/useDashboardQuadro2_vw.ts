/*
-- ===================================================
-- Código             : /src/hooks/useDashboardQuadro2_vw.ts
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-11-24 16:10 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Hook alternativo para o Quadro 2 do Dashboard,
--                      focado na agenda do usuário logado ("minhas ações"),
--                      usando a view vw_dashboard_user_agenda via
--                      dashboardService_vw, sem impactar o código atual.
-- Fluxo              : Dashboard -> UserAgendaCard_vw
--                      -> useDashboardQuadro2_vw -> dashboardService_vw
--                      -> vw_dashboard_user_agenda
-- Alterações (1.0.0) :
--   • Criação do hook useDashboardQuadro2_vw com cache isolado por user.id.
-- Dependências       : @tanstack/react-query, @/contexts/AuthContext,
--                      @/services/dashboardService_vw
-- ===================================================
*/

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getDashboardUserAgenda } from "@/services/dashboardService_vw";

type UseDashboardQuadro2VwResult = {
  agendaQuery: {
    data: unknown;
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => void;
  };
};

/**
 * Hook para consumir a agenda do usuário logado no Dashboard (versão view).
 *
 * Características:
 *  - Usa React Query com queryKey incluindo user.id
 *    para evitar reaproveitar cache entre usuários diferentes.
 *  - Só é habilitado quando o user do AuthContext estiver pronto.
 *  - Não interfere no useDashboardQuadro2 original.
 */
export function useDashboardQuadro2_vw(): UseDashboardQuadro2VwResult {
  const { user } = useAuth() as { user: { id?: string | null } | null };
  const userId = user?.id ?? null;

  const agendaQuery = useQuery({
    queryKey: ["dashboard", "userAgenda_vw", userId],
    queryFn: getDashboardUserAgenda,
    enabled: !!userId,
  });

  return {
    agendaQuery: {
      data: agendaQuery.data,
      isLoading: agendaQuery.isLoading,
      isError: agendaQuery.isError,
      error: agendaQuery.error,
      refetch: agendaQuery.refetch,
    },
  };
}

/*
-- =====================================================================================================
-- Código             : src/hooks/useMonthlyClosureData.ts
-- Versão (.v20)      : 0.1.0
-- Data/Hora          : 2026-03-24 19:00 America/Sao_Paulo
-- Autor              : FL / Execução via (Eva Claude Modelo) (Alpha Dualite modelo LLM)
-- Objetivo do codigo : Hook customizado para dados de fechamento mensal:
--                      • useQuery com refetch automático (30s se mês aberto)
--                      • useMutation para fechamento manual
--                      • Invalidação de cache após fechar
-- Dependências       : monthlyClosureService.ts → useMonthlyClosureData.ts
-- Versão/Alteração   :
-- [ 0.1.0 ]          : Versão inicial - SUP-000004
-- =====================================================================================================
*/

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getMonthData,
  closeMonth,
  type MonthData,
} from '@/services/monthlyClosureService';

/* ============================================================
   Tipos
   ============================================================ */

interface UseMonthlyClosureDataReturn {
  data: MonthData | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isClosed: boolean;
  /** Fechar o mês atual */
  closeMutation: {
    mutate: () => void;
    isPending: boolean;
    isError: boolean;
    error: Error | null;
  };
}

/* ============================================================
   Hook
   ============================================================ */

export function useMonthlyClosureData(mes: string): UseMonthlyClosureDataReturn {
  const queryClient = useQueryClient();
  const { currentProfileLite } = useAuth();
  const tenantId  = currentProfileLite?.tenantId  ?? '';
  const profileId = currentProfileLite?.id        ?? '';

  /* ---- Query principal ---- */
  const queryKey = ['monthly-closure', mes];

  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery<MonthData, Error>({
    queryKey,
    queryFn: () => getMonthData(mes, tenantId),
    enabled: !!mes,
    // Mês fechado: dados imutáveis — sem refetch automático
    // Mês aberto:  refetch a cada 30s para refletir novos orçamentos em tempo real
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return false;
      return d.is_closed ? false : 30_000;
    },
    staleTime: (query) => {
      const d = query.state.data as MonthData | undefined;
      return d?.is_closed ? Infinity : 0;
    },
  });

  /* ---- Mutation: fechar mês ---- */
  const mutation = useMutation<void, Error, void>({
    mutationFn: () => closeMonth(mes, tenantId, profileId),
    onSuccess: () => {
      // Invalida o cache do mês fechado para forçar releitura do snapshot
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    data,
    isLoading,
    isError,
    error: error ?? null,
    isClosed: data?.is_closed ?? false,
    closeMutation: {
      mutate:     () => mutation.mutate(),
      isPending:  mutation.isPending,
      isError:    mutation.isError,
      error:      mutation.error ?? null,
    },
  };
}

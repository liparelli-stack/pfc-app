/*
-- =====================================================================================================
-- Código             : src/hooks/useSalesTargets.ts
-- Versão (.v20)      : 0.1.0
-- Data/Hora          : 2026-03-24 19:00 America/Sao_Paulo
-- Autor              : FL / Execução via (Eva Claude Modelo) (Alpha Dualite modelo LLM)
-- Objetivo do codigo : Hook customizado para metas mensais por vendedor:
--                      • sellers: lista de profiles ativos do tenant
--                      • targetMap: mapa {sellerId|YYYY-MM → valor}
--                      • saveMutation: upsert via monthlyClosureService.upsertGoal
-- Dependências       : monthlyClosureService.upsertGoal, supabaseClient, AuthContext
-- Versão/Alteração   :
-- [ 0.1.0 ]          : Versão inicial
-- =====================================================================================================
*/

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { upsertGoal } from '@/services/monthlyClosureService';

/* ============================================================
   Tipos públicos
   ============================================================ */

export interface SellerTarget {
  id: string;
  full_name: string;
}

/** Chave: `${sellerId}|${YYYY-MM}` → valor em reais */
export type TargetMap = Record<string, number>;

/* ============================================================
   Helpers
   ============================================================ */

/** Jan a Dez do ano corrente como YYYY-MM-DD (dia fixo 01), em ordem crescente */
export function buildMonths(): string[] {
  const year = new Date().getFullYear();
  return Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  });
}

/* ============================================================
   Hook
   ============================================================ */

export function useSalesTargets() {
  const { currentProfileLite } = useAuth();
  const tenantId = currentProfileLite?.tenantId ?? '';
  const queryClient = useQueryClient();

  // months = ['2026-01-01', ..., '2026-12-01'] — formato já pronto para o banco
  const months = buildMonths();

  /* ---- Query: lista de vendedores (profiles ativos com job_title vendedor/a) ---- */
  const sellersQuery = useQuery<SellerTarget[]>({
    queryKey: ['sales-targets-sellers', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, position')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .ilike('position', '%vendedor%')
        .order('full_name');
      if (error) throw error;
      console.log('✅ Sellers filtrados:', data);
      return (data ?? []).map((r) => ({
        id: r.id as string,
        full_name: (r.full_name as string) || 'Usuário',
      }));
    },
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
  });

  /* ---- Query: metas Jan-Dez do ano corrente ---- */
  const year = new Date().getFullYear();
  const targetsQuery = useQuery<TargetMap>({
    queryKey: ['sales-targets', tenantId, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_monthly_targets')
        .select('salesperson_id, month, target_amount')
        .eq('tenant_id', tenantId)
        .gte('month', `${year}-01-01`)
        .lte('month', `${year}-12-31`);
      if (error) throw error;
      console.log('✅ Targets carregados:', data);
      const map: TargetMap = {};
      for (const r of data ?? []) {
        // month vem como 'YYYY-MM-DD' — chave bate direto com months[]
        const mes = (r.month as string).slice(0, 10); // garante YYYY-MM-DD
        map[`${r.salesperson_id}|${mes}`] = Number(r.target_amount) || 0;
      }
      return map;
    },
    enabled: !!tenantId,
  });

  /* ---- Mutation: upsert de meta ---- */
  const saveMutation = useMutation<
    void,
    Error,
    { sellerId: string; mes: string; amount: number }
  >({
    mutationFn: ({ sellerId, mes, amount }) =>
      // upsertGoal espera YYYY-MM; mes aqui é YYYY-MM-DD → slice(0,7)
      upsertGoal(tenantId, sellerId, mes.slice(0, 7), amount, 0),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-targets', tenantId] });
      // Invalida dados de fechamento mensal para refletir nova meta
      queryClient.invalidateQueries({ queryKey: ['monthly-closure'] });
    },
  });

  return {
    sellers: sellersQuery.data ?? [],
    months,
    targetMap: targetsQuery.data ?? {},
    isLoading: sellersQuery.isLoading || targetsQuery.isLoading,
    isError: sellersQuery.isError || targetsQuery.isError,
    saveMutation,
  };
}

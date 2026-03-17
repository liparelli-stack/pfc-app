/*
================================================================================
Código             : /src/hooks/useDashboardQuadro1.ts
Versão (.v20)      : 1.9.0
Data/Hora          : 2025-12-01 21:40 America/Sao_Paulo
Autor              : FL / Eva (E.V.A.)
Objetivo           : Hook de métricas gerais do Dashboard (Quadro 1), calculando:
                     • companies por tipo (client/lead/prospect) e por status
                       (active/inactive) para o dono da carteira;
                     • totais do tenant (via RLS);
                     • ações (chats) ativas vs concluídas, por tipo de empresa.
Fluxo              : Dashboard.tsx (Card "Métricas Gerais")
                     -> useDashboardQuadro1(authUserId?)
                     -> Supabase
Alterações (1.9.0) :
  • [FIX] Unificação da lógica de carteira com companiesService:
       - Em vez de buscar todas as companies do tenant e filtrar em memória
         por owner, o hook agora usa:
             .eq('owner', effectiveOwnerId)
       - effectiveOwnerId é resolvido a partir de:
             authUserId (parâmetro) ||
             profile.auth_user_id ||
             profile.id
       - Isso garante que o número de clientes no Dashboard bata com:
         • módulo de listagem por owner; e
         • relatório de exportação.
Dependências       : supabaseClient, profilesService.getCurrentProfile
================================================================================
*/

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getCurrentProfile } from '@/services/profilesService';

/* [--BLOCO--] Tipos internos do hook ---------------------------------------- */

export interface DashboardQuadro1Metrics {
  // Companies por tipo (owner vs total)
  clientsOwner: number;
  clientsTotal: number;
  leadsOwner: number;
  leadsTotal: number;
  prospectsOwner: number;
  prospectsTotal: number;

  // Companies por status (owner vs total)
  activeOwner: number;
  activeTotal: number;
  inactiveOwner: number;
  inactiveTotal: number;

  // Ações (chats) por tipo de empresa (escopo: carteira do owner)
  clientsActiveActions: number;
  clientsTotalActions: number;
  leadsActiveActions: number;
  leadsTotalActions: number;
  prospectsActiveActions: number;
  prospectsTotalActions: number;
}

interface State {
  metrics: DashboardQuadro1Metrics | null;
  loading: boolean;
  error: string | null;
}

interface HookResult {
  metrics: DashboardQuadro1Metrics | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/* [--BLOCO--] Helpers internos ---------------------------------------------- */

async function countByKind(kind: 'client' | 'lead' | 'prospect'): Promise<number> {
  const { count, error } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .eq('kind', kind);

  if (error) throw error;
  return count ?? 0;
}

async function countByStatus(status: 'active' | 'inactive'): Promise<number> {
  const { count, error } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .eq('status', status);

  if (error) throw error;
  return count ?? 0;
}

/* [--BLOCO--] Hook principal ------------------------------------------------- */
/**
 * IMPORTANTE:
 *  - authUserId DEVE ser, preferencialmente, o auth_user_id do Supabase
 *    (user.id / profiles.auth_user_id).
 *  - companies.owner é filtrado diretamente no banco com:
 *        .eq('owner', effectiveOwnerId)
 *    onde effectiveOwnerId é:
 *        authUserId || profile.auth_user_id || profile.id.
 *  - Se não for possível resolver effectiveOwnerId, as métricas de carteira
 *    retornam zeradas e apenas os totais do tenant são preenchidos.
 */
export function useDashboardQuadro1(authUserId?: string): HookResult {
  const [st, setSt] = useState<State>({
    metrics: null,
    loading: true,
    error: null,
  });

  const fetchMetrics = useCallback(async () => {
    setSt({
      metrics: null,
      loading: true,
      error: null,
    });

    try {
      // 0) Resolve effectiveOwnerId
      let effectiveOwnerId: string | null = authUserId?.trim() || null;

      try {
        const profile = await getCurrentProfile();
        if (!effectiveOwnerId && profile) {
          if (profile.auth_user_id && profile.auth_user_id.trim()) {
            effectiveOwnerId = profile.auth_user_id.trim();
          } else if (profile.id && String(profile.id).trim()) {
            effectiveOwnerId = String(profile.id).trim();
          }
        }
      } catch (profileError) {
        console.warn('[useDashboardQuadro1] Falha ao obter profile atual:', profileError);
      }

      // Se não tiver owner, zera carteira mas segue com totais do tenant
      let clientsOwner = 0;
      let leadsOwner = 0;
      let prospectsOwner = 0;
      let activeOwner = 0;
      let inactiveOwner = 0;

      if (effectiveOwnerId) {
        // 1) Companies da CARTEIRA (owner = effectiveOwnerId)
        const { data, error } = await supabase
          .from('companies')
          .select('id, kind, status')
          .eq('owner', effectiveOwnerId)
          .limit(5000);

        if (error) throw error;

        (data ?? []).forEach((row: any) => {
          const kind = row.kind as string | null;
          const status = row.status as string | null;

          if (kind === 'client') {
            clientsOwner++;
          } else if (kind === 'lead') {
            leadsOwner++;
          } else if (kind === 'prospect') {
            prospectsOwner++;
          }

          if (status === 'active') {
            activeOwner++;
          } else if (status === 'inactive') {
            inactiveOwner++;
          }
        });
      }

      // 2) Companies → totais exatos do tenant (RLS aplica o tenant_id)
      const [
        clientsTotal,
        leadsTotal,
        prospectsTotal,
        activeTotal,
        inactiveTotal,
      ] = await Promise.all([
        countByKind('client'),
        countByKind('lead'),
        countByKind('prospect'),
        countByStatus('active'),
        countByStatus('inactive'),
      ]);

      // 3) Chats → ações por tipo de empresa (restritas à carteira do owner)
      let clientsActiveActions = 0;
      let clientsTotalActions = 0;
      let leadsActiveActions = 0;
      let leadsTotalActions = 0;
      let prospectsActiveActions = 0;
      let prospectsTotalActions = 0;

      if (effectiveOwnerId) {
        const { data: chatsData, error: chatsError } = await supabase
          .from('chats')
          .select('id, is_done, company:companies(kind, owner)')
          .eq('company.owner', effectiveOwnerId)
          .limit(5000);

        if (chatsError) throw chatsError;

        (chatsData ?? []).forEach((row: any) => {
          const company = (row.company ?? null) as { kind?: string } | null;
          const kind = company?.kind as string | undefined;
          const isDone = !!row.is_done;

          if (!kind) return;

          if (kind === 'client') {
            clientsTotalActions++;
            if (!isDone) clientsActiveActions++;
          } else if (kind === 'lead') {
            leadsTotalActions++;
            if (!isDone) leadsActiveActions++;
          } else if (kind === 'prospect') {
            prospectsTotalActions++;
            if (!isDone) prospectsActiveActions++;
          }
        });
      }

      const metrics: DashboardQuadro1Metrics = {
        clientsOwner,
        clientsTotal,
        leadsOwner,
        leadsTotal,
        prospectsOwner,
        prospectsTotal,
        activeOwner,
        activeTotal,
        inactiveOwner,
        inactiveTotal,
        clientsActiveActions,
        clientsTotalActions,
        leadsActiveActions,
        leadsTotalActions,
        prospectsActiveActions,
        prospectsTotalActions,
      };

      setSt({
        metrics,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setSt({
        metrics: null,
        loading: false,
        error: err?.message ?? 'Erro ao carregar as métricas gerais.',
      });
    }
  }, [authUserId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await fetchMetrics();
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchMetrics]);

  return {
    metrics: st.metrics,
    loading: st.loading,
    error: st.error,
    refetch: fetchMetrics,
  };
}

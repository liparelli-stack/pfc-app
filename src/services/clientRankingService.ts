/*
-- ===================================================
-- Código             : /src/services/clientRankingService.ts
-- Versão             : 1.0.0
-- Data/Hora          : 2026-03-28 America/Sao_Paulo
-- Autor              : FL / Claude
-- Objetivo           : Busca ranking de clientes via RPC get_client_ranking.
-- Fluxo              :
--   fetchClientRanking(params)
--     → supabase.rpc('get_client_ranking', { p_tenant_id, ... })
--     → map r_* → ClientRankingRow[]
-- Colunas esperadas da RPC (prefixo r_):
--   r_company_id, r_company_name, r_owner_name,
--   r_last_interaction, r_total_chats,
--   -- espera
--   r_espera_total, r_espera_qty, r_espera_tkm, r_espera_pct, r_espera_tme_days,
--   -- ganha
--   r_ganha_total, r_ganha_qty, r_ganha_tkm, r_ganha_pct, r_ganha_tma_days,
--   -- perdida
--   r_perdida_total, r_perdida_qty, r_perdida_pct,
--   -- encerrado
--   r_encerrado_total, r_encerrado_qty, r_encerrado_pct
-- Observações        :
--   • Campos numéricos retornados como string pelo Postgres (numeric) —
--     convertidos com parseFloat(); null permanece null.
-- ===================================================
*/

import { supabase } from "@/lib/supabaseClient";

/* ========================================================= */
/* Tipos públicos                                            */
/* ========================================================= */

export interface ClientRankingParams {
  tenantId: string;
  authorUserId?: string;
  periodStart?: string; // ISO string
  periodEnd?: string;   // ISO string
}

export interface ClientRankingRow {
  companyId: string;
  companyName: string;
  ownerName: string | null;
  lastInteraction: string;
  totalChats: number;
  chatsWithBudget: number;
  espera: {
    total: number;
    qty: number;
    tkm: number | null;
    pct: number;
    tmeDays: number | null;
  };
  ganha: {
    total: number;
    qty: number;
    tkm: number | null;
    pct: number;
    tmaDays: number | null;
  };
  perdida: {
    total: number;
    qty: number;
    pct: number;
  };
  encerrado: {
    total: number;
    qty: number;
    pct: number;
  };
  healthScore: number;
}

/* ========================================================= */
/* Helpers                                                   */
/* ========================================================= */

function toFloat(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

function toFloatOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function mapRow(r: Record<string, unknown>): ClientRankingRow {
  return {
    companyId:       String(r.r_company_id ?? ""),
    companyName:     String(r.r_company_name ?? ""),
    ownerName:       r.r_owner_name != null ? String(r.r_owner_name) : null,
    lastInteraction:  String(r.r_last_interaction ?? ""),
    totalChats:       toFloat(r.r_total_chats),
    chatsWithBudget:  toFloat(r.r_chats_with_budget),
    espera: {
      total:    toFloat(r.r_espera_total),
      qty:      toFloat(r.r_espera_qty),
      tkm:      toFloatOrNull(r.r_espera_tkm),
      pct:      toFloat(r.r_espera_pct),
      tmeDays:  toFloatOrNull(r.r_espera_tme_days),
    },
    ganha: {
      total:    toFloat(r.r_ganha_total),
      qty:      toFloat(r.r_ganha_qty),
      tkm:      toFloatOrNull(r.r_ganha_tkm),
      pct:      toFloat(r.r_ganha_pct),
      tmaDays:  toFloatOrNull(r.r_ganha_tma_days),
    },
    perdida: {
      total:    toFloat(r.r_perdida_total),
      qty:      toFloat(r.r_perdida_qty),
      pct:      toFloat(r.r_perdida_pct),
    },
    encerrado: {
      total:    toFloat(r.r_encerrado_total),
      qty:      toFloat(r.r_encerrado_qty),
      pct:      toFloat(r.r_encerrado_pct),
    },
    healthScore: toFloat(r.r_health_score),
  };
}

/* ========================================================= */
/* Função principal                                          */
/* ========================================================= */

export async function fetchClientRanking(
  params: ClientRankingParams
): Promise<ClientRankingRow[]> {
  const rpcParams: Record<string, string> = {
    p_tenant_id: params.tenantId,
  };

  if (params.authorUserId !== undefined) {
    rpcParams.p_author_user_id = params.authorUserId;
  }
  if (params.periodStart !== undefined) {
    rpcParams.p_period_start = params.periodStart;
  }
  if (params.periodEnd !== undefined) {
    rpcParams.p_period_end = params.periodEnd;
  }

  const { data, error } = await supabase.rpc("get_client_ranking", rpcParams);

  if (error) {
    console.error("[clientRankingService] get_client_ranking error:", error);
    throw new Error(error.message ?? "Falha ao buscar ranking de clientes.");
  }

  if (!Array.isArray(data)) return [];

  return (data as Record<string, unknown>[]).map(mapRow);
}

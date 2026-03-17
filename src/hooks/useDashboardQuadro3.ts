/*
================================================================================
Código: /src/hooks/useDashboardQuadro3.ts
Versão: 1.3.0
Data/Hora: 2025-11-14 17:45 -03
Autor: FL / Eva (E.V.A.)
Objetivo: Hook para métricas do Quadro 3 do Dashboard, focado em temperaturas:
          • Distribuição de ações por temperatura (total, done/pending, %)
          • Volume de empresas por temperatura predominante
            (agora com TOP 5 empresas por temperatura para tooltip)
          • Distribuição temporal (passado / hoje / futuro) por temperatura
          Sempre no escopo do tenant + usuário logado (JWT / RLS).
          Janela:
            - Últimos 30 dias
            - Hoje
            - Próximos 45 dias
Fluxo: Dashboard.tsx (Card "Temperaturas") → useDashboardQuadro3 → RPC public.dashboard_quadro3_metrics
Dependências: supabaseClient, função RPC public.dashboard_quadro3_metrics(date, date)
Histórico:
  - 1.3.0 (Eva):
      • Inclusão de topCompanies (string[]) em companiesByTemperature,
        consumindo field "top_companies" do RPC.
  - 1.2.0 (Eva):
      • Janela temporal estendida (−30 dias até +45 dias).
  - 1.1.0 (Eva):
      • Implementação completa do hook chamando RPC.
================================================================================
*/

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

/* [--BLOCO--] Tipos internos ------------------------------------------------- */

export type TemperatureKey = "hot" | "warm" | "neutral" | "cold";

export interface TemperatureActionsDistribution {
  key: TemperatureKey;
  actionsTotal: number;
  actionsDone: number;
  actionsPending: number;
  actionsPct: number; // 0–100
}

export interface TemperatureCompaniesDistribution {
  key: TemperatureKey;
  companiesCount: number;
  topCompanies: string[]; // nomes das TOP 5 empresas predominantes
}

export interface TemperatureTimelineDistribution {
  key: TemperatureKey;
  pastCount: number;
  todayCount: number;
  futureCount: number;
}

export interface DashboardQuadro3Metrics {
  actionsByTemperature: TemperatureActionsDistribution[];
  companiesByTemperature: TemperatureCompaniesDistribution[];
  timelineByTemperature: TemperatureTimelineDistribution[];
}

interface State {
  metrics: DashboardQuadro3Metrics | null;
  loading: boolean;
  error: string | null;
}

export interface UseDashboardQuadro3Result {
  metrics: DashboardQuadro3Metrics | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/* [--BLOCO--] Tipos "crus" vindos da RPC ------------------------------------- */

interface RawCompanyRef {
  company_id: string | null;
  company_name: string | null;
}

interface RawActionsByTemperature {
  temperature: string | null;
  actions_total: number | null;
  actions_done: number | null;
  actions_pending: number | null;
  actions_pct: number | null;
}

interface RawCompaniesByTemperature {
  temperature: string | null;
  companies_count: number | null;
  top_companies: RawCompanyRef[] | null;
}

interface RawTimelineByTemperature {
  temperature: string | null;
  past_count: number | null;
  today_count: number | null;
  future_count: number | null;
}

interface DashboardQuadro3RawResponse {
  actions_by_temperature: RawActionsByTemperature[] | null;
  companies_by_temperature: RawCompaniesByTemperature[] | null;
  timeline_by_temperature: RawTimelineByTemperature[] | null;
}

/* [--BLOCO--] Helpers internos ---------------------------------------------- */

const ALL_TEMPERATURE_KEYS: TemperatureKey[] = ["hot", "warm", "neutral", "cold"];

/**
 * Normaliza o texto vindo do banco ("Quente", "Morna", "Neutra", "Fria")
 * para a chave interna (hot/warm/neutral/cold).
 */
function normalizeTemperatureLabel(label: string | null | undefined): TemperatureKey | null {
  if (!label) return null;

  const normalized = label.trim().toLowerCase();

  switch (normalized) {
    case "quente":
      return "hot";
    case "morna":
      return "warm";
    case "neutra":
      return "neutral";
    case "fria":
      return "cold";
    default:
      return null;
  }
}

/**
 * Garante que todas as 4 temperaturas existam no array, preenchendo com zeros
 * quando não houver dados para alguma delas.
 */
function ensureAllTemperatureActions(
  partial: Map<TemperatureKey, TemperatureActionsDistribution>
): TemperatureActionsDistribution[] {
  return ALL_TEMPERATURE_KEYS.map((key) => {
    const existing = partial.get(key);
    if (existing) return existing;
    return {
      key,
      actionsTotal: 0,
      actionsDone: 0,
      actionsPending: 0,
      actionsPct: 0,
    };
  });
}

function ensureAllTemperatureCompanies(
  partial: Map<TemperatureKey, TemperatureCompaniesDistribution>
): TemperatureCompaniesDistribution[] {
  return ALL_TEMPERATURE_KEYS.map((key) => {
    const existing = partial.get(key);
    if (existing) return existing;
    return {
      key,
      companiesCount: 0,
      topCompanies: [],
    };
  });
}

function ensureAllTemperatureTimeline(
  partial: Map<TemperatureKey, TemperatureTimelineDistribution>
): TemperatureTimelineDistribution[] {
  return ALL_TEMPERATURE_KEYS.map((key) => {
    const existing = partial.get(key);
    if (existing) return existing;
    return {
      key,
      pastCount: 0,
      todayCount: 0,
      futureCount: 0,
    };
  });
}

/**
 * Calcula o intervalo:
 *  - startDate = hoje - 30 dias
 *  - endDate   = hoje + 45 dias
 * em formato YYYY-MM-DD.
 */
function computeExtendedDateRange(): { startDate: string; endDate: string } {
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const start = new Date(base);
  start.setDate(base.getDate() - 30);

  const end = new Date(base);
  end.setDate(base.getDate() + 45);

  const toYMD = (d: Date) => d.toISOString().slice(0, 10);

  return {
    startDate: toYMD(start),
    endDate: toYMD(end),
  };
}

/* [--BLOCO--] Hook principal ------------------------------------------------- */

export function useDashboardQuadro3(): UseDashboardQuadro3Result {
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
      const { startDate, endDate } = computeExtendedDateRange();

      const { data, error } = await supabase.rpc("dashboard_quadro3_metrics", {
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (error) {
        throw error;
      }

      const raw = (data ?? {}) as DashboardQuadro3RawResponse;

      const actionsMap = new Map<TemperatureKey, TemperatureActionsDistribution>();
      const companiesMap = new Map<TemperatureKey, TemperatureCompaniesDistribution>();
      const timelineMap = new Map<TemperatureKey, TemperatureTimelineDistribution>();

      // A) Ações por temperatura
      if (Array.isArray(raw.actions_by_temperature)) {
        for (const item of raw.actions_by_temperature) {
          const key = normalizeTemperatureLabel(item.temperature);
          if (!key) continue;

          actionsMap.set(key, {
            key,
            actionsTotal: item.actions_total ?? 0,
            actionsDone: item.actions_done ?? 0,
            actionsPending: item.actions_pending ?? 0,
            actionsPct: item.actions_pct ?? 0,
          });
        }
      }

      // B) Empresas por temperatura predominante (com TOP 5)
      if (Array.isArray(raw.companies_by_temperature)) {
        for (const item of raw.companies_by_temperature) {
          const key = normalizeTemperatureLabel(item.temperature);
          if (!key) continue;

          const topCompanies: string[] = Array.isArray(item.top_companies)
            ? item.top_companies
                .map((c) => (c && c.company_name ? c.company_name.trim() : ""))
                .filter((name): name is string => !!name)
                .slice(0, 5)
            : [];

          companiesMap.set(key, {
            key,
            companiesCount: item.companies_count ?? 0,
            topCompanies,
          });
        }
      }

      // C) Timeline por temperatura
      if (Array.isArray(raw.timeline_by_temperature)) {
        for (const item of raw.timeline_by_temperature) {
          const key = normalizeTemperatureLabel(item.temperature);
          if (!key) continue;

          timelineMap.set(key, {
            key,
            pastCount: item.past_count ?? 0,
            todayCount: item.today_count ?? 0,
            futureCount: item.future_count ?? 0,
          });
        }
      }

      const metrics: DashboardQuadro3Metrics = {
        actionsByTemperature: ensureAllTemperatureActions(actionsMap),
        companiesByTemperature: ensureAllTemperatureCompanies(companiesMap),
        timelineByTemperature: ensureAllTemperatureTimeline(timelineMap),
      };

      setSt({
        metrics,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      console.error("[useDashboardQuadro3] Failed to load metrics:", err);
      setSt({
        metrics: null,
        loading: false,
        error: err?.message ?? "Erro ao carregar métricas do Quadro 3.",
      });
    }
  }, []);

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

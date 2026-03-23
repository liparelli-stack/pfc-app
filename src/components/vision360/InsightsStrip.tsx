/*
-- ===================================================
-- Código             : /src/components/vision360/InsightsStrip.tsx
-- Versão (.v20)      : 1.5.2
-- Data/Hora          : 2025-12-04 06:25 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Compositor da faixa de insights (filtro + KPIs + mini-gráficos)
--                      a partir de `chats`, com gatilho de IA ao lado do seletor de período
--                      e container dedicado da análise logo abaixo do card.
-- Fluxo              : Página Visão 360 → InsightsStrip
--                      → useChatsInsights (KPIs) + useVision360Ai (análise IA)
--                      → BudgetStageValueCard + Vision360AiInsightsPanel
-- Alterações (1.5.2) :
--   • Ajuste visual e alinhamento do ícone de IA para seguir o padrão global:
--     botão circular cinza-claro com ícone azul (Sparkles, lucide-react),
--     alinhado ao seletor de "Período".
-- Alterações (1.5.1) :
--   • Botão-ícone da IA passa a ser clicável sempre que houver companyId e período
--     válidos (independente de showEmpty / error dos insights).
--     Desabilita apenas enquanto aiLoading = true.
-- Alterações (1.5.0) :
--   • useVision360Ai passa a ser consumido aqui (camada de lógica) em vez de
--     dentro do Vision360AiInsightsPanel.
-- ===================================================
*/

import React, { useMemo, useEffect } from 'react';
import useChatsInsights from '@/hooks/useChatsInsights';
import { useVision360Ai } from '@/hooks/useVision360Ai';
import type { DateRange, BreakdownItem } from '@/types/insights';
import InsightsFilter from './InsightsFilter';
import KpiCard from './kpis/KpiCard';
import MiniSpark from './mini/MiniSpark';
import MiniBar from './mini/MiniBar';
import MiniDonut from './mini/MiniDonut';
import MiniTrendDot from './mini/MiniTrendDot';
import BudgetStageValueCard from './cards/BudgetStageValueCard';
import { Vision360AiInsightsPanel } from './Vision360AiInsightsPanel';
import { Sparkles } from 'lucide-react';

type Props = { companyId?: string | null; className?: string };

function pct(n: number) {
  return (n * 100).toFixed(1) + '%';
}

function seriesSplitDeltaPct(series: { y: number }[] = []) {
  if (series.length < 2) return 0;
  const mid = Math.floor(series.length / 2);
  const a = series.slice(0, mid).reduce((acc, p) => acc + p.y, 0) / Math.max(1, mid);
  const b =
    series.slice(mid).reduce((acc, p) => acc + p.y, 0) /
    Math.max(1, series.length - mid);
  if (a === 0 && b === 0) return 0;
  if (a === 0) return 100;
  return ((b - a) / a) * 100;
}

const tempColor = (key: string) => {
  const k = (key || '').toLowerCase();
  if (k.includes('fria')) return '#60a5fa';
  if (k.includes('morna')) return '#f59e0b';
  if (k.includes('quente')) return '#ef4444';
  return undefined;
};

const normalizeDateRangeToPeriod = (
  range: DateRange | null | undefined
):
  | {
      startDate: string;
      endDate: string;
    }
  | null => {
  if (!range || !range.start || !range.end) return null;

  const toIso = (value: any) => {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    try {
      return new Date(value).toISOString();
    } catch {
      return '';
    }
  };

  const startDate = toIso(range.start);
  const endDate = toIso(range.end);

  if (!startDate || !endDate) return null;

  return { startDate, endDate };
};

const InsightsStrip: React.FC<Props> = ({ companyId = null, className }) => {
  // --- Insights a partir de chats (KPIs) ---
  const {
    insights,
    loading,
    error,
    preset,
    range,
    setPreset,
    setCustomRange,
    setCompanyId,
    refetch,
  } = useChatsInsights({ initialCompanyId: companyId, initialPreset: 'LAST_15_DAYS' });

  useEffect(() => {
    setCompanyId(companyId ?? null);
  }, [companyId, setCompanyId]);

  const totalFmt = insights ? insights.total.toLocaleString() : '—';
  const conclFmt = insights ? insights.concluidas.toLocaleString() : '—';
  const abertasFmt = insights ? insights.abertas.toLocaleString() : '—';
  const taxaFmt = insights ? pct(insights.taxaConclusao) : '—';

  const deltaTendencia = useMemo(
    () => seriesSplitDeltaPct(insights?.tendenciaDiaria),
    [insights?.tendenciaDiaria]
  );

  const abertasVsConcluidas: BreakdownItem[] = useMemo(() => {
    if (!insights) return [];
    return [
      { key: 'abertas', value: insights.abertas },
      { key: 'concluídas', value: insights.concluidas },
    ];
  }, [insights]);

  const tempBreakdown = useMemo<BreakdownItem[]>(
    () => (insights?.porTemperatura ?? []).slice(0, 3),
    [insights?.porTemperatura]
  );

  const handleFilterChange = (next: { preset: any; range: DateRange }) => {
    if (next.preset === 'CUSTOM') setCustomRange(next.range);
    else setPreset(next.preset);
  };

  // valores em BRL por estágio
  const valuesBRL = useMemo(() => {
    const v = insights?.budgetsPorEstagioValue;
    return {
      em_espera: v?.em_espera ?? 0,
      ganha: v?.ganha ?? 0,
      perdida: v?.perdida ?? 0,
    };
  }, [insights?.budgetsPorEstagioValue]);

  // contagens por estágio
  const counts = useMemo(() => {
    const c = insights?.budgetsPorEstagioCount;
    return {
      em_espera: c?.em_espera ?? 0,
      ganha: c?.ganha ?? 0,
      perdida: c?.perdida ?? 0,
    };
  }, [insights?.budgetsPorEstagioCount]);

  const total = insights?.total ?? 0;
  const showEmpty = !loading && !error && insights && total < 5;

  // --- Período normalizado para IA da Visão 360 ---
  const periodForAi = useMemo(
    () => normalizeDateRangeToPeriod(range),
    [range]
  );

  // --- Hook de IA: análise Visão 360 ---
  const {
    analysis: aiAnalysis,
    loading: aiLoading,
    error: aiError,
    savingNote: aiSavingNote,
    generate: aiGenerate,
    saveNote: aiSaveNote,
    highlightedActionsView,
  } = useVision360Ai(
    companyId ?? '',
    periodForAi ?? { startDate: '', endDate: '' }
  );

  // botão de IA fica ativo sempre que existir companyId + período válido
  const canClickAi = !!companyId && !!periodForAi;

  return (
    <section className={className}>
      {/* Header: título + filtro + ÍCONE de IA ao lado do período */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-t1">
          Insights Rápidos - Ações e Orçamentos
        </h2>

        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <InsightsFilter
            valuePreset={preset}
            valueRange={range}
            onChange={handleFilterChange}
          />

          {companyId && periodForAi && (
            <button
              type="button"
              onClick={aiGenerate}
              disabled={aiLoading || !canClickAi}
              title="Analisar Visão 360 do cliente com IA"
              className={[
                'flex h-8 w-8 items-center justify-center rounded-full border sm:ml-2',
                'transition-all duration-150 shadow-sm',
                aiLoading || !canClickAi
                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300'
                  : 'cursor-pointer border-slate-200 bg-slate-100 text-sky-600 hover:bg-slate-200 hover:border-slate-300',
              ].join(' ')}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Erro dos insights (chats) */}
      {error && (
        <div className="mb-3 text-sm text-rose-600 dark:text-rose-400">
          Ocorreu um erro ao carregar insights.{' '}
          <button className="underline" onClick={refetch}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* Card principal de KPIs */}
      {showEmpty ? (
        <div className="neumorphic-convex flex h-40 items-center justify-center rounded-2xl bg-plate text-gray-500 dark:bg-dark-s1">
          Por enquanto, sem informações suficientes aqui. Número de 'Ações Registradas' deve igual ou maior que 5.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              title="Ações no período"
              value={loading ? '—' : totalFmt}
              subtitle={
                insights
                  ? `Média/dia: ${insights.mediaPorDia.toFixed(1)}`
                  : undefined
              }
            >
              <MiniSpark data={insights?.tendenciaDiaria ?? []} />
            </KpiCard>

            {/* Taxa de conclusão com tooltip no chip de tendência */}
            <KpiCard title="Taxa de conclusão" value={loading ? '—' : taxaFmt}>
              <div
                title="Tendência de Atividade — Mostra quanto a atividade aumentou ou diminuiu na segunda metade do período em comparação com a primeira metade."
                aria-label="Tendência de Atividade: mostra quanto a atividade aumentou ou diminuiu na segunda metade do período em comparação com a primeira metade."
              >
                <MiniTrendDot deltaPct={deltaTendencia} label="tendência" />
              </div>
            </KpiCard>

            <KpiCard
              title="Abertas vs Concluídas"
              value={loading ? '—' : `${abertasFmt} · ${conclFmt}`}
            >
              <MiniBar items={abertasVsConcluidas} width={120} height={36} />
            </KpiCard>

            <KpiCard title="Por temperatura" value="">
              <MiniDonut
                items={tempBreakdown}
                width={80}
                height={80}
                colorForKey={(k) => tempColor(k)}
              />
            </KpiCard>

            <KpiCard
              title="Atrasadas"
              value={loading ? '—' : insights?.atrasadas ?? '—'}
            />
            <KpiCard
              title="Agendadas (7d)"
              value={loading ? '—' : insights?.agendadas7d ?? '—'}
            />
          </div>

          <div className="mt-4">
            <BudgetStageValueCard
              valuesBRL={valuesBRL}
              counts={counts}
              defaultThousands={false}
              className="w-full"
            />
          </div>
        </>
      )}

      {/* Container DEDICADO da análise da IA – logo abaixo do card de insights */}
      <Vision360AiInsightsPanel
        loading={aiLoading}
        error={aiError}
        savingNote={aiSavingNote}
        analysis={aiAnalysis}
        highlightedActionsView={highlightedActionsView}
        onSaveNote={aiSaveNote}
      />
    </section>
  );
};

export default InsightsStrip;

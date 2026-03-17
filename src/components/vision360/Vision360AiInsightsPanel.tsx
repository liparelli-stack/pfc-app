/*
-- ===================================================
-- Código             : /src/components/vision360/Vision360AiInsightsPanel.tsx
-- Versão (.v20)      : 1.2.0
-- Data/Hora          : 2025-12-04 05:40 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Container dedicado para exibir a análise de IA da Visão 360,
--                      abaixo do card de "Insights Rápidos - Ações e Orçamentos".
--                      Não dispara a análise (isso é feito pelo ícone ao lado do
--                      seletor de período em InsightsStrip).
-- Fluxo              : InsightsStrip (lógica: useVision360Ai)
--                      → Vision360AiInsightsPanel (apenas renderização).
-- Alterações (1.2.0) :
--   • Removida a responsabilidade de disparar a análise via botão; o gatilho
--     agora fica em InsightsStrip, ao lado do seletor de período.
--   • Passa a ser um componente puramente de apresentação, recebendo via props:
--     loading, error, analysis, savingNote, highlightedActionsView, onSaveNote.
--   • Renderiza um novo container logo abaixo do card principal, com estados:
--       - loading: "Análise da IA ... Processando..."
--       - analysis pronta: painel completo + botão "Gravar nota da IA".
-- Alterações (1.1.0) :
--   • Uso de highlightedActionsView para unificar rótulos em tela e na nota.
-- Alterações (1.0.0) :
--   • Criação inicial do painel com botão de disparo e conteúdo completo.
-- Dependências        :
--   • React / Tailwind CSS (estilos utilitários)
--   • Estruturas de dados da análise (qualquer tipo compatível).
-- Camadas             :
--   • Lógica  : (fora daqui) useVision360Ai no InsightsStrip.
--   • Serviço : (fora daqui) vision360Service + vision360AiService.
--   • Dados   : análise e ações destacadas recebidas por props.
-- ===================================================
*/

import React from 'react';

interface Vision360AiInsightsPanelProps {
  loading: boolean;
  error?: string | null;
  savingNote: boolean;
  analysis: any | null;
  highlightedActionsView: any[];
  onSaveNote: () => void;
}

/**
 * Painel de Insights da IA para a Visão 360 (somente container).
 *
 * Este componente deve ser posicionado logo abaixo do card de Insights Rápidos.
 * O disparo da análise via IA é feito externamente; aqui apenas exibimos:
 * - estado "Processando..." enquanto loading;
 * - análise completa quando disponível (analysis);
 * - botão "Gravar nota da IA" quando houver note_template.
 */
export const Vision360AiInsightsPanel: React.FC<Vision360AiInsightsPanelProps> = ({
  loading,
  error,
  savingNote,
  analysis,
  highlightedActionsView,
  onSaveNote,
}) => {
  const hasAnalysis = !!analysis;
  const hasError = !!error;

  // Só abre o container se houver algo acontecendo:
  // - carregando (após clique no ícone)
  // - análise pronta
  // - erro ao tentar gerar
  const shouldShowContainer = loading || hasAnalysis || hasError;

  if (!shouldShowContainer) {
    return null;
  }

  return (
    <div className="mt-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      {/* Cabeçalho do container: título + estado de processamento */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 text-sm">
            <span>✨</span>
          </div>
          <span className="text-sm font-semibold text-slate-800">
            Análise da IA
          </span>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-sky-400" />
            <span>Processando...</span>
          </div>
        )}

        {!loading && hasAnalysis && (
          <span className="rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            Análise pronta
          </span>
        )}

        {!loading && !hasAnalysis && hasError && (
          <span className="text-xs font-medium text-red-600">
            Erro ao gerar análise
          </span>
        )}
      </div>

      {/* Erro detalhado da IA (se existir) */}
      {hasError && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Se ainda não há análise (apenas loading/erro), não renderiza o miolo */}
      {!hasAnalysis && !loading && (
        <p className="text-xs text-slate-500">
          Tente gerar novamente a análise clicando no ícone de IA ao lado do período.
        </p>
      )}

      {!hasAnalysis || !analysis ? null : (
        <>
          {/* Período + saúde da conta */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-slate-500">
                Período analisado:{' '}
                <span className="font-medium text-slate-700">
                  {analysis.period?.start_date} &rarr; {analysis.period?.end_date}
                </span>
              </p>
            </div>

            <div className="flex flex-col items-end gap-1 text-right">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Saúde da conta
                </span>
                <span className="text-lg font-bold text-emerald-600">
                  {Math.round(analysis.health_score)}%
                </span>
              </div>
              <span
                className={[
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                  analysis.risk_level === 'alto'
                    ? 'bg-red-50 text-red-700 border border-red-100'
                    : analysis.risk_level === 'medio'
                    ? 'bg-amber-50 text-amber-700 border border-amber-100'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-100',
                ].join(' ')}
              >
                Risco:{' '}
                {analysis.risk_level === 'medio' ? 'médio' : analysis.risk_level}
              </span>
            </div>
          </div>

          {/* Resumo executivo */}
          <section className="mb-4">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Resumo executivo
            </h4>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800">
              {analysis.executive_summary}
            </p>
          </section>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Pontos fortes */}
            <section className="md:col-span-1">
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Pontos fortes
              </h4>
              {analysis.key_strengths?.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Nenhum ponto forte destacado.
                </p>
              ) : (
                <ul className="space-y-1 text-xs text-slate-700">
                  {analysis.key_strengths?.map((item: string, idx: number) => (
                    <li key={idx} className="flex gap-1">
                      <span className="mt-[2px] text-emerald-500">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Riscos */}
            <section className="md:col-span-1">
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-600">
                Riscos e pontos de atenção
              </h4>
              {analysis.key_risks?.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Nenhum risco crítico destacado.
                </p>
              ) : (
                <ul className="space-y-1 text-xs text-slate-700">
                  {analysis.key_risks?.map((item: string, idx: number) => (
                    <li key={idx} className="flex gap-1">
                      <span className="mt-[2px] text-red-500">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Próximas ações */}
            <section className="md:col-span-1">
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-600">
                Próximas ações recomendadas
              </h4>
              {analysis.recommended_next_steps?.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Nenhuma próxima ação específica sugerida.
                </p>
              ) : (
                <ul className="space-y-1 text-xs text-slate-700">
                  {analysis.recommended_next_steps?.map(
                    (item: string, idx: number) => (
                      <li key={idx} className="flex gap-1">
                        <span className="mt-[2px] text-amber-500">•</span>
                        <span>{item}</span>
                      </li>
                    )
                  )}
                </ul>
              )}
            </section>
          </div>

          {/* Tags + Orçamentos + Checklist */}
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {/* Tags */}
            <section className="md:col-span-1">
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tags e temas principais
              </h4>
              <div className="flex flex-wrap gap-1">
                {analysis.tags_insights?.core_tags?.length === 0 ? (
                  <span className="text-xs text-slate-400">
                    Nenhum tema principal identificado.
                  </span>
                ) : (
                  analysis.tags_insights?.core_tags?.map(
                    (tag: string, idx: number) => (
                      <span
                        key={idx}
                        className="rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700"
                      >
                        #{tag}
                      </span>
                    )
                  )
                )}
              </div>
            </section>

            {/* Orçamentos */}
            <section className="md:col-span-1">
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Orçamentos e oportunidades
              </h4>
              <p className="text-xs text-slate-700">
                {analysis.budgets_insights?.commentary}
              </p>
              {analysis.budgets_insights?.opportunities?.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-emerald-700">
                  {analysis.budgets_insights?.opportunities?.map(
                    (op: string, idx: number) => (
                      <li key={idx} className="flex gap-1">
                        <span className="mt-[2px] text-emerald-500">+</span>
                        <span>{op}</span>
                      </li>
                    )
                  )}
                </ul>
              )}
              {analysis.budgets_insights?.risks?.length > 0 && (
                <ul className="mt-1 space-y-1 text-xs text-red-700">
                  {analysis.budgets_insights?.risks?.map(
                    (r: string, idx: number) => (
                      <li key={idx} className="flex gap-1">
                        <span className="mt-[2px] text-red-500">!</span>
                        <span>{r}</span>
                      </li>
                    )
                  )}
                </ul>
              )}
            </section>

            {/* Checklist */}
            <section className="md:col-span-1">
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Checklist da conta
              </h4>
              {analysis.followup_checklist?.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Nenhum item de checklist específico.
                </p>
              ) : (
                <ul className="space-y-1 text-xs text-slate-700">
                  {analysis.followup_checklist?.map(
                    (item: string, idx: number) => (
                      <li key={idx} className="flex gap-1">
                        <span className="mt-[2px] text-slate-500">□</span>
                        <span>{item}</span>
                      </li>
                    )
                  )}
                </ul>
              )}
            </section>
          </div>

          {/* Ações em destaque + botão de nota */}
          <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              {highlightedActionsView?.length > 0 && (
                <>
                  <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ações em destaque
                  </h4>
                  <ul className="space-y-1 text-xs text-slate-700">
                    {highlightedActionsView.map((item: any, idx: number) => (
                      <li key={idx} className="flex gap-1">
                        <span className="mt-[2px] text-slate-400">•</span>
                        <span>
                          <span className="font-semibold">{item.label}:</span>{' '}
                          {item.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* Botão para gravar nota baseada na IA */}
            {analysis.note_template && (
              <div className="flex flex-col items-end gap-1">
                <button
                  type="button"
                  onClick={onSaveNote}
                  disabled={savingNote}
                  className={[
                    'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium',
                    'transition-colors duration-150',
                    savingNote
                      ? 'cursor-wait border-slate-200 bg-slate-50 text-slate-400'
                      : 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:border-sky-400',
                  ].join(' ')}
                >
                  <span>📝</span>
                  <span>Gravar nota da IA</span>
                  {savingNote && (
                    <span className="ml-1 text-[10px] italic text-sky-600">
                      salvando...
                    </span>
                  )}
                </button>
                <span className="text-[10px] text-slate-400">
                  Uma nota interna será criada para esta empresa.
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

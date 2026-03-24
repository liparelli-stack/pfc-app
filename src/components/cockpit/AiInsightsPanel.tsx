import React from "react";
import { Button } from "@/components/ui/Button";
import type { ActionAiAnalysis } from "@/services/ai/actionsAiService";

interface AiInsightsPanelProps {
  aiRequested: boolean;
  aiLoading: boolean;
  aiError: string | null;
  aiResult: ActionAiAnalysis | null;
  sentimentToLabel: (s: ActionAiAnalysis["sentiment"]) => string;
  urgencyToLabel: (u: ActionAiAnalysis["urgency"]) => string;
  onPasteFromAi: () => void;
}

const AiInsightsPanel: React.FC<AiInsightsPanelProps> = ({
  aiRequested,
  aiLoading,
  aiError,
  aiResult,
  sentimentToLabel,
  urgencyToLabel,
  onPasteFromAi,
}) => {
  if (!aiRequested) return null;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 px-4 py-3 text-sm space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          Sugestões da IA
        </span>
        <div className="flex items-center gap-2">
          {aiLoading && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Analisando...
            </span>
          )}
          {aiError && !aiLoading && (
            <span className="text-[11px] text-red-500">{aiError}</span>
          )}
          {aiResult && !aiLoading && (
            <Button
              type="button"
              variant="secondary"
              className="px-2 py-1 text-xs h-7"
              onClick={onPasteFromAi}
            >
              Colar ✨
            </Button>
          )}
        </div>
      </div>

      {aiResult && !aiLoading && (
        <div className="space-y-2">
          {aiResult.summary && (
            <p className="text-[13px] text-slate-700 dark:text-slate-200">
              {aiResult.summary}
            </p>
          )}

          <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
            <span className="px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800/80">
              {sentimentToLabel(aiResult.sentiment)}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800/80">
              {urgencyToLabel(aiResult.urgency)}
            </span>
          </div>

          {aiResult.next_steps?.length > 0 && (
            <div className="mt-1">
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-0.5">
                Próximas ações sugeridas
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-[12px] text-slate-700 dark:text-slate-200">
                {aiResult.next_steps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ul>
            </div>
          )}

          {aiResult.checklist?.length > 0 && (
            <div className="mt-1">
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-0.5">
                Pontos importantes
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-[12px] text-slate-700 dark:text-slate-200">
                {aiResult.checklist.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {aiResult.suggested_tags?.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {aiResult.suggested_tags.map((t, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center rounded-full border border-slate-300 dark:border-slate-700 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-200 bg-slate-100/70 dark:bg-slate-800/70"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AiInsightsPanel;

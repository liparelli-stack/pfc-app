/*
-- ===================================================
-- Código             : /src/hooks/useVision360Ai.ts
-- Versão (.v20)      : 1.10.1
-- Data/Hora          : 2025-12-18 22:10 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Hook React para integrar Visão 360 com IA (Gemini),
--                      exibindo o painel de insights e permitindo gravar
--                      uma nota COMPLETA em companies.notes (JSONB).
--                      + Auto-save em Notas da IA (background).
-- Fluxo              : UI -> useVision360Ai -> vision360Service
--                      -> vision360AiService -> Gemini
--                      -> auto-save ai_notes (background)
--                      -> saveNote() -> companies (opcional)
-- Alterações (1.10.1):
--   • Adicionado auto-save silencioso em ai_notes após geração da IA
--   • Nenhuma linha removida ou refatorada
-- ===================================================
*/

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getVision360CompanyAiPayload } from '@/services/vision360Service';
import { analyzeCompanyVision360 } from '@/services/ai/vision360AiService';
import { createAiNote } from '@/services/aiNotesService'; // ← ADIÇÃO CONTROLADA
import type { Vision360AiAnalysis } from '@/types/vision360';
import type { CompanyNote } from '@/types/company';

interface UseVision360AiOptions {
  auto?: boolean;
}

type ActionSubjectsById = Record<string, string>;

function formatPercent(n?: number | null): string {
  if (n == null || Number.isNaN(n)) return '—';
  return `${Math.round(n)}%`;
}

/**
 * Monta a nota COMPLETA a partir da análise da IA.
 * Aqui é onde garantimos que "a nota que está na memória" vire um texto único.
 */
function buildFullNoteFromAnalysis(
  analysis: Vision360AiAnalysis,
  opts?: { actionSubjectsById?: ActionSubjectsById }
): { assunto: string; nota: string } {
  const parts: string[] = [];

  const periodStart =
    (analysis as any).period?.start_date ??
    (analysis as any).note_template?.period?.start_date;
  const periodEnd =
    (analysis as any).period?.end_date ??
    (analysis as any).note_template?.period?.end_date;

  // Cabeçalho / título interno
  parts.push('Insights da IA sobre esta conta');

  if (periodStart && periodEnd) {
    parts.push(`Período analisado: ${periodStart} → ${periodEnd}`);
  }

  // Saúde da conta
  const health = (analysis as any).health_score as number | undefined;
  const risk = (analysis as any).risk_level as string | undefined;

  const healthLines: string[] = [];
  if (typeof health === 'number') {
    healthLines.push(`Saúde da conta: ${formatPercent(health)}`);
  }
  if (risk) {
    healthLines.push(`Risco: ${risk}`);
  }
  if (healthLines.length) {
    parts.push(healthLines.join('\n'));
  }

  // Resumo executivo
  if (analysis.executive_summary?.trim()) {
    parts.push(`Resumo executivo\n${analysis.executive_summary.trim()}`);
  }

  // Pontos fortes
  const strengths = (analysis.key_strengths ?? []).filter(Boolean);
  if (strengths.length) {
    parts.push(
      ['Pontos fortes', ...strengths.map((s) => `• ${s}`)].join('\n')
    );
  }

  // Riscos e pontos de atenção
  const risks = (analysis.key_risks ?? []).filter(Boolean);
  const budgetsRisks = (analysis as any).budgets_insights?.risks ?? [];
  const allRisks = [...risks, ...budgetsRisks].filter(Boolean);

  if (allRisks.length) {
    parts.push(
      ['Riscos e pontos de atenção', ...allRisks.map((r: string) => `• ${r}`)].join(
        '\n'
      )
    );
  }

  // Próximas ações recomendadas
  const nextSteps = (analysis.recommended_next_steps ?? []).filter(Boolean);
  if (nextSteps.length) {
    parts.push(
      [
        'Próximas ações recomendadas',
        ...nextSteps.map((s, idx) => `${idx + 1}. ${s}`),
      ].join('\n')
    );
  }

  // Checklist
  const checklist = (analysis.followup_checklist ?? []).filter(Boolean);
  if (checklist.length) {
    parts.push(
      ['Checklist da conta', ...checklist.map((c) => `□ ${c}`)].join('\n')
    );
  }

  // Tags & temas principais
  const tagsInsights = (analysis as any).tags_insights ?? {};
  const coreTags: string[] = tagsInsights.core_tags ?? [];
  const riskTags: string[] = tagsInsights.risk_tags ?? [];
  const oppTags: string[] = tagsInsights.opportunity_tags ?? [];

  const tagLines: string[] = [];
  if (coreTags.length) tagLines.push(`Principais temas: ${coreTags.join(', ')}`);
  if (riskTags.length) tagLines.push(`Tags de risco: ${riskTags.join(', ')}`);
  if (oppTags.length) tagLines.push(`Tags de oportunidade: ${oppTags.join(', ')}`);

  if (tagLines.length) {
    parts.push(['Tags e temas principais', ...tagLines].join('\n'));
  }

  // Orçamentos e oportunidades
  const budgets = (analysis as any).budgets_insights ?? {};
  const budgetsLines: string[] = [];
  if (budgets.commentary) {
    budgetsLines.push(String(budgets.commentary));
  }
  if (Array.isArray(budgets.opportunities) && budgets.opportunities.length) {
    budgetsLines.push(
      [
        'Oportunidades financeiras:',
        ...budgets.opportunities.map((o: string) => `+ ${o}`),
      ].join('\n')
    );
  }
  if (Array.isArray(budgets.risks) && budgets.risks.length) {
    budgetsLines.push(
      [
        'Riscos financeiros:',
        ...budgets.risks.map((r: string) => `! ${r}`),
      ].join('\n')
    );
  }
  if (budgetsLines.length) {
    parts.push(['Orçamentos e oportunidades', ...budgetsLines].join('\n\n'));
  }

  // Ações em destaque
  const highlights = (analysis.highlighted_actions ?? []).filter(Boolean);
  if (highlights.length) {
    const lines: string[] = ['Ações em destaque'];
    for (const h of highlights as any[]) {
      const id = h.action_id || h.id;
      const subjectFromDb =
        id && opts?.actionSubjectsById
          ? opts.actionSubjectsById[id as string]
          : undefined;
      const subjectFromIa =
        h.action_subject ||
        h.subject ||
        h.title ||
        null;

      const label =
        subjectFromDb ||
        subjectFromIa ||
        id ||
        'Ação sem título';

      const reason = h.reason || h.justification;
      lines.push(
        `• ${label}: ${
          reason || 'Ação relevante para o contexto da conta.'
        }`
      );
    }
    parts.push(lines.join('\n'));
  }

  // Assunto (título curto)
  const assunto =
    (analysis as any).note_template?.title?.trim() ||
    'Insights da IA – Visão 360';

  const nota = parts.join('\n\n');

  return { assunto, nota };
}

/* ============================================================
 * AUTO-SAVE EM NOTAS DA IA (BACKGROUND)
 * ========================================================== */
async function saveAiNoteInBackground(
  analysis: Vision360AiAnalysis,
  payload: any
) {
  try {
    const { assunto, nota } = buildFullNoteFromAnalysis(analysis);

    await createAiNote({
      title: assunto,
      body: nota,
      tags: analysis.tags_insights?.core_tags ?? [],
      metadata: {
        origin: 'Visão 360 - Insights Rápidos',
        company: payload.company,
        period: analysis.period,
        generated_at: new Date().toISOString(),
      },
    });
  } catch {
    // falha silenciosa: não impacta UX nem fluxo principal
  }
}

export function useVision360Ai(
  companyId: string,
  period: { startDate: string; endDate: string },
  _options?: UseVision360AiOptions
) {
  const [analysis, setAnalysis] = useState<Vision360AiAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // subjects de ações em destaque resolvidos via chats
  const [highlightActionSubjectsById, setHighlightActionSubjectsById] =
    useState<ActionSubjectsById>({});

  // Helper para resolver subjects de ações em destaque a partir de chats
  const resolveHighlightSubjects = async (
    currentAnalysis: Vision360AiAnalysis
  ) => {
    try {
      const rawHighlights = (currentAnalysis as any).highlighted_actions ?? [];
      const highlightIds = (Array.isArray(rawHighlights) ? rawHighlights : [])
        .map((h: any) => h?.action_id || h?.id)
        .filter(Boolean) as string[];

      const uniqueIds = Array.from(new Set(highlightIds));

      if (uniqueIds.length === 0) {
        setHighlightActionSubjectsById({});
        return;
      }

      const { data: chatsRows, error: chatsError } = await supabase
        .from('chats')
        .select('id, subject')
        .in('id', uniqueIds);

      if (chatsError) {
        setHighlightActionSubjectsById({});
        return;
      }

      const map: ActionSubjectsById = {};
      if (Array.isArray(chatsRows)) {
        for (const row of chatsRows as any[]) {
          if (row?.id && row?.subject) {
            map[row.id as string] = String(row.subject);
          }
        }
      }
      setHighlightActionSubjectsById(map);
    } catch {
      setHighlightActionSubjectsById({});
    }
  };

  // View model para Ações em destaque (usado na UI)
  const highlightedActionsView =
    (analysis?.highlighted_actions ?? [])
      .filter(Boolean)
      .map((h: any) => {
        const id = h.action_id || h.id;
        const subjectFromDb =
          id && highlightActionSubjectsById
            ? highlightActionSubjectsById[id as string]
            : undefined;
        const subjectFromIa =
          h.action_subject ||
          h.subject ||
          h.title ||
          null;

        const label =
          subjectFromDb ||
          subjectFromIa ||
          id ||
          'Ação sem título';

        const reason = h.reason || h.justification;

        return {
          ...h,
          label,
          reason,
        };
      }) ?? [];

  // ------------------ IA: gerar análise da Visão 360 ------------------ //
  const generate = async () => {
    if (!companyId) return null;

    setLoading(true);
    setError(null);

    try {
      const payload = await getVision360CompanyAiPayload(companyId, period);
      if (!payload) {
        setAnalysis(null);
        setHighlightActionSubjectsById({});
        setError('Não foi possível montar o payload para IA.');
        setLoading(false);
        return null;
      }

      const result = await analyzeCompanyVision360(payload);

      setAnalysis(result || null);
      setLoading(false);

      if (result) {
        // resolve subjects de ações em destaque logo após gerar a análise
        resolveHighlightSubjects(result);

        // 🔥 AUTO-SAVE EM NOTAS DA IA (BACKGROUND)
        saveAiNoteInBackground(result, payload);
      } else {
        setHighlightActionSubjectsById({});
      }

      return result;
    } catch (err: any) {
      setAnalysis(null);
      setHighlightActionSubjectsById({});
      setError('Erro ao gerar análise da IA.');
      setLoading(false);
      return null;
    }
  };

  // ------------------ IA: salvar nota COMPLETA em companies.notes ------------------ //
  const saveNote = async () => {
    if (!analysis) return null;

    setSavingNote(true);
    setError(null);

    try {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const nowIso = now.toISOString();

      const { assunto, nota } = buildFullNoteFromAnalysis(analysis, {
        actionSubjectsById: highlightActionSubjectsById,
      });

      const value = `${assunto} | ${nota}`;
      const key = `Vision360_AI_${today}`;
      const source = 'Visao360_AI';

      const tpl = (analysis as any).note_template;
      const companyIdForNote =
        tpl?.company_id || (analysis as any).company_id || companyId;

      const { data, error: selectError } = await supabase
        .from('companies')
        .select('notes')
        .eq('id', companyIdForNote)
        .maybeSingle();

      if (selectError) {
        setError('Erro ao buscar notas atuais da empresa.');
        setSavingNote(false);
        return null;
      }

      const rawNotes = (data as any)?.notes;
      let notesArray: CompanyNote[];

      if (rawNotes == null) {
        notesArray = [];
      } else if (Array.isArray(rawNotes)) {
        notesArray = rawNotes as CompanyNote[];
      } else {
        setError(
          'O formato atual das notas desta empresa é diferente do esperado.'
        );
        setSavingNote(false);
        return null;
      }

      const newEntry: CompanyNote = {
        data: nowIso,
        nota,
        assunto,
        key,
        value,
        source,
      };

      const nextNotes: CompanyNote[] = [...notesArray, newEntry];

      const { data: updatedRow } = await supabase
        .from('companies')
        .update({ notes: nextNotes })
        .eq('id', companyIdForNote)
        .select('id')
        .maybeSingle();

      if (!updatedRow) {
        setError('Não foi possível salvar a nota da IA.');
        setSavingNote(false);
        return null;
      }

      setSavingNote(false);
      return true;
    } catch {
      setError('Erro inesperado ao salvar nota.');
      setSavingNote(false);
      return null;
    }
  };

  return {
    analysis,
    loading,
    error,
    savingNote,
    generate,
    saveNote,
    highlightedActionsView,
  };
}

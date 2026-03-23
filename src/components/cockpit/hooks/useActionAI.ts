import { useState, useRef, useEffect } from "react";
import type { ContactWithChannels } from "@/types/cockpit";
import type { ActionFormData } from "@/types/chat";
import { PRIORITY_OPTIONS } from "@/types/chat";
import {
  analyzeRegisterActionWithAi,
  type RegisterActionPayload,
  type ActionAiAnalysis,
} from "@/services/ai/actionsAiService";
import { createAiNote } from "@/services/aiNotesService";
import { resolveActionLabel } from "@/utils/actionHelpers";

// ---- tipos mínimos para desacoplar do RHF ----
type GetValues = () => ActionFormData;
type GetBodyValue = () => string;
type SetBodyValue = (value: string) => void;
type AddToast = (message: string, type: string) => void;

interface UseActionAIParams {
  aiTrigger: number | undefined;
  getValues: GetValues;
  getBodyValue: GetBodyValue;
  setBodyValue: SetBodyValue;
  contacts: ContactWithChannels[];
  tags: string[];
  addToast: AddToast;
}

export interface UseActionAIReturn {
  aiRequested: boolean;
  aiLoading: boolean;
  aiError: string | null;
  aiResult: ActionAiAnalysis | null;
  sentimentToLabel: (s: ActionAiAnalysis["sentiment"]) => string;
  urgencyToLabel: (u: ActionAiAnalysis["urgency"]) => string;
  handlePasteFromAi: () => void;
}

// ---- helpers puros (não dependem de estado) ----

function normalizePriority(p: string | null | undefined): string {
  if (!p) return "Normal";
  return PRIORITY_OPTIONS.includes(p as any) ? p : "Normal";
}

function resolveStatusLabel(isDone: boolean | undefined | null): string {
  return isDone ? "Concluída" : "Andamento";
}

function buildFingerprint(input: string): string {
  try {
    return btoa(unescape(encodeURIComponent(input))).slice(0, 120);
  } catch {
    return String(Date.now());
  }
}

function sentimentPlainLabel(s: ActionAiAnalysis["sentiment"]): string {
  if (s === "positivo") return "Positivo";
  if (s === "negativo") return "Negativo";
  if (s === "neutro") return "Neutro";
  return "n/d";
}

function urgencyPlainLabel(u: ActionAiAnalysis["urgency"]): string {
  if (u === "alta") return "Alta";
  if (u === "media") return "Média";
  if (u === "baixa") return "Baixa";
  return "n/d";
}

function buildAiPasteBlock(analysis: ActionAiAnalysis): string {
  const parts: string[] = [];

  parts.push("---");
  parts.push("");
  parts.push("✨");
  parts.push(`Sentimento: ${sentimentPlainLabel(analysis.sentiment)}`);
  parts.push(`Urgência: ${urgencyPlainLabel(analysis.urgency)}`);
  parts.push("");

  if (analysis.summary?.trim()) {
    parts.push(analysis.summary.trim());
    parts.push("");
  }

  if (analysis.next_steps?.length > 0) {
    parts.push("Próximas ações:");
    analysis.next_steps.forEach((step) => {
      if (step?.trim()) parts.push(`- ${step.trim()}`);
    });
    parts.push("");
  }

  if (analysis.checklist?.length > 0) {
    parts.push("Checklist:");
    analysis.checklist.forEach((item) => {
      if (item?.trim()) parts.push(`- ${item.trim()}`);
    });
    parts.push("");
  }

  if (analysis.suggested_tags?.length > 0) {
    const formattedTags = analysis.suggested_tags
      .map((t) => (t || "").trim())
      .filter((t) => t.length > 0)
      .join(", ");
    if (formattedTags) {
      parts.push(`Tags sugeridas: ${formattedTags}`);
      parts.push("");
    }
  }

  parts.push("---");
  return parts.join("\n");
}

// ---- hook ----

export function useActionAI({
  aiTrigger,
  getValues,
  getBodyValue,
  setBodyValue,
  contacts,
  tags,
  addToast,
}: UseActionAIParams): UseActionAIReturn {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<ActionAiAnalysis | null>(null);
  const [aiRequested, setAiRequested] = useState(false);
  const lastAiTriggerRef = useRef<number | undefined>(undefined);

  const resolveContatoNome = (contactId: string | null | undefined): string => {
    if (!contactId) return "";
    const c = contacts.find((ct) => ct.id === contactId);
    return c?.full_name ?? "";
  };

  // [3.11.1] Persistência silenciosa em ai_notes após análise
  const persistAiAnalysisToNotes = async (
    payload: RegisterActionPayload,
    analysis: ActionAiAnalysis
  ) => {
    try {
      const parts: string[] = [];
      parts.push("✨");
      parts.push(`Sentimento: ${sentimentPlainLabel(analysis.sentiment)}`);
      parts.push(`Urgência: ${urgencyPlainLabel(analysis.urgency)}`);
      parts.push("");

      if (analysis.summary?.trim()) {
        parts.push(analysis.summary.trim());
        parts.push("");
      }

      if (analysis.next_steps?.length) {
        parts.push("Próximas ações:");
        analysis.next_steps.forEach((s) => {
          if (s?.trim()) parts.push(`- ${s.trim()}`);
        });
        parts.push("");
      }

      if (analysis.checklist?.length) {
        parts.push("Checklist:");
        analysis.checklist.forEach((c) => {
          if (c?.trim()) parts.push(`- ${c.trim()}`);
        });
        parts.push("");
      }

      if (analysis.suggested_tags?.length) {
        const formatted = analysis.suggested_tags
          .map((t) => (t || "").trim())
          .filter((t) => t.length > 0)
          .join(", ");
        if (formatted) parts.push(`Tags sugeridas: ${formatted}`);
      }

      const body =
        parts.join("\n").trim() ||
        payload.descricao?.trim() ||
        "Análise gerada automaticamente pela IA.";

      const fingerprintSource = [
        payload.assunto,
        payload.descricao,
        analysis.summary,
        (analysis.next_steps || []).join("|"),
        (analysis.checklist || []).join("|"),
        (analysis.suggested_tags || []).join("|"),
      ].join("::");

      await createAiNote({
        title: payload.assunto?.trim() || "Análise de Ação",
        body,
        tags: analysis.suggested_tags ?? [],
        metadata: {
          origin: "cockpit_register_action_ai",
          acao: payload.acaoLabel,
          status: payload.status,
          contato: payload.contatoNome,
          data: payload.data,
          hora: payload.hora,
          temperatura: payload.temperatura,
          prioridade: payload.prioridade,
          fingerprint: buildFingerprint(fingerprintSource),
        },
      } as any);
    } catch (err) {
      // Falha silenciosa: não afetar UX
      console.error("Falha ao persistir AI Note automaticamente:", err);
    }
  };

  // Dispara análise sempre que o gatilho externo mudar
  useEffect(() => {
    if (aiTrigger === undefined) return;
    if (lastAiTriggerRef.current === aiTrigger) return;
    lastAiTriggerRef.current = aiTrigger;

    const runAi = async () => {
      const data = getValues();

      if (!data.body || !data.body.trim()) {
        addToast(
          "Preencha ao menos alguns detalhes em 'Descreva a Ação ou Conversa' para uma análise melhor.",
          "info"
        );
      }

      const payload: RegisterActionPayload = {
        acaoLabel: resolveActionLabel(data.action),
        status: resolveStatusLabel(data.is_done),
        contatoNome: resolveContatoNome(data.contact_id),
        assunto: data.subject || "",
        etiquetas: tags,
        data: data.calendar_at || "",
        hora: data.on_time || "",
        temperatura: data.temperature || "Neutra",
        prioridade: normalizePriority(data.priority),
        descricao: data.body || "",
      };

      setAiRequested(true);
      setAiLoading(true);
      setAiError(null);

      try {
        const result = await analyzeRegisterActionWithAi(payload);
        if (!result) {
          setAiError("Não foi possível obter análise da IA.");
          setAiResult(null);
          addToast("Não foi possível obter análise da IA.", "error");
          return;
        }
        setAiResult(result);

        // Auto-save silencioso em ai_notes
        await persistAiAnalysisToNotes(payload, result);
      } catch (err: any) {
        console.error("Erro na análise de IA:", err);
        setAiError("Erro ao analisar a ação com IA.");
        setAiResult(null);
        addToast("Erro ao analisar a ação com IA.", "error");
      } finally {
        setAiLoading(false);
      }
    };

    void runAi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiTrigger]);

  const sentimentToLabel = (s: ActionAiAnalysis["sentiment"]): string => {
    if (s === "positivo") return "Sentimento: Positivo";
    if (s === "negativo") return "Sentimento: Negativo";
    if (s === "neutro") return "Sentimento: Neutro";
    return "Sentimento: n/d";
  };

  const urgencyToLabel = (u: ActionAiAnalysis["urgency"]): string => {
    if (u === "alta") return "Urgência: Alta";
    if (u === "media") return "Urgência: Média";
    if (u === "baixa") return "Urgência: Baixa";
    return "Urgência: n/d";
  };

  const handlePasteFromAi = () => {
    if (!aiResult) {
      addToast("Nenhuma sugestão da IA disponível para colar.", "info");
      return;
    }
    const currentBody = getBodyValue() ?? "";
    const block = buildAiPasteBlock(aiResult);
    setBodyValue(`${currentBody}\n\n${block}`);
  };

  return {
    aiRequested,
    aiLoading,
    aiError,
    aiResult,
    sentimentToLabel,
    urgencyToLabel,
    handlePasteFromAi,
  };
}

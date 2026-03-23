/*
-- ===================================================
-- Código             : /src/components/cockpit/EditActionForm.tsx
-- Versão (.v20)      : 3.11.1
-- Data/Hora          : 2025-12-18 00:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Formulário "Registrar Ação" (criar/editar) padronizado:
--                      • Temperatura TitleCase: "Neutra" | "Fria" | "Morna" | "Quente"
--                      • Defaults/Select/Submit coerentes (sem alerts)
--                      • Integração com Etiquetas (chats.tags jsonb - slugs string[])
--                      • Tagging por janela não-modal ancorada no botão de etiqueta
--                      • Em edição, recupera nome/cor das tags via public.tags (getTagsBySlugs)
--                      • [3.9.0] Integração com IA: gatilho externo (aiTrigger) monta
--                        payload da ação/conversa e chama analyzeRegisterActionWithAi,
--                        exibindo painel de insights abaixo do campo de descrição.
--                      • [3.10.0] Botão "Colar ✨" no painel da IA que insere bloco
--                        formatado no campo "body" sem apagar o texto existente.
--                      • [3.11.0] Persistência automática (silenciosa) do resultado da IA
--                        em ai_notes logo após analyzeRegisterActionWithAi (sem depender
--                        do botão "Colar ✨" e sem alterar aiNotesService).
--                      • [3.11.1] AI Note grava mensagem COMPLETA (não só summary),
--                        mantendo metadata/fingerprint e sem alterar layout.
-- Fluxo              : UI (EditActionForm)
--                      → chatsService.upsertChat (+ ScheduleActionModal)
--                      → grava também tags: string[] (slugs) em public.chats.tags
--                      → analyzeRegisterActionWithAi (IA) para insights da conversa.
--                      → aiNotesService.createAiNote (auto-save da análise em ai_notes)
-- Alterações (3.6.0) :
--   • [TAG] Mantido modelo normalizado: chats.tags armazena apenas slugs (string[]).
--   • [TAG] Em edição, usa getTagsBySlugs(slugs) para recuperar cor/nome das tags e
--           popular tagEntities, permitindo chips coloridos sem desnormalizar o chat.
-- Alterações (3.6.1) :
--   • [PRIORIDADE] Dropdown de prioridade agora reflete PRIORITY_OPTIONS de @/types/chat
--                  ("Normal" | "Alta"), mantendo default em "Normal".
-- Alterações (3.6.2) :
--   • [LAYOUT] Ajuste fino de layout (Etiquetas, Data/Hora/Temperatura/Prioridade,
--              rodapé com "+ Próxima ação" / Cancelar / Salvar).
-- Alterações (3.8.0) :
--   • [BUDGET] Suportado novo status interno "terminado" (Encerrado) para orçamentos.
--   • [BUDGET] Orçamentos com status "terminado" deixam de ser carregados/exibidos/
--              editados no formulário (deleção fria na UI, preservando JSON para auditoria).
-- Alterações (3.8.2) :
--   • [LAYOUT] Restauração do layout completo após o campo "Descreva a Ação ou Conversa"
--              com base na 3.6.2 (Etiquetas, Data/Hora/Temperatura/Prioridade e rodapé).
--   • [BUDGET] Filtro explícito para não exibir orçamentos com status "terminado" e
--              tratamento seguro em criação/edição, mantendo o JSON de auditoria.
-- Alterações (3.8.3) :
--   • [UX] Padronização do botão principal do formulário:
--          - Texto fixo "Salvar ação".
--          - Tooltip dinâmico: "Registrar nova ação" (criação) e "Editar ação existente" (edição).
-- Alterações (3.9.0) :
--   • [IA] Novo prop opcional aiTrigger (número incremental) vindo do RegisterActionCard.
--   • [IA] Ao detectar mudança no aiTrigger, monta RegisterActionPayload a partir do form
--          atual e chama analyzeRegisterActionWithAi (serviço de IA).
--   • [IA] Exibe painel "Sugestões da IA" logo abaixo do campo "Descreva a Ação ou Conversa"
--          com resumo, sentimento, urgência, próximos passos, checklist e etiquetas sugeridas.
-- Alterações (3.10.0) :
--   • [IA] Adicionado botão "Colar ✨" no painel de Sugestões da IA.
--   • [IA] Botão monta bloco formatado e o acrescenta ao campo body via setValue,
--           sempre após duas quebras de linha, sem apagar o texto existente.
-- Alterações (3.11.0) :
--   • [IA→AI NOTES] Após gerar ActionAiAnalysis, grava automaticamente em ai_notes
--                  via aiNotesService (falha silenciosa, sem impactar UI).
-- Alterações (3.11.1) :
--   • [IA→AI NOTES] body da AI Note agora inclui sentimento/urgência + summary +
--                  next_steps + checklist + suggested_tags (mensagem completa).
-- ===================================================
*/

import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import clsx from "clsx";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tag as TagIcon, PlusCircle } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import HierarchicalActionSelect from "@/components/ui/HierarchicalActionSelect";
import BudgetSection, {
  BudgetDraft as UIBudgetDraft,
  BudgetItem as UIBudgetItem,
} from "./BudgetSection";

import {
  ActionFormData,
  actionSchema,
  PRIORITY_OPTIONS,
  TEMPERATURE_OPTIONS,
} from "@/types/chat";
import * as chatsService from "@/services/chatsService";
import type { CompanyDetails, ContactWithChannels } from "@/types/cockpit";

import ScheduleActionModal from "@/components/cockpit/ScheduleActionModal";
import { TimePickerRHF } from "@/components/ui/TimePicker";
import { useTagsManager } from "@/components/cockpit/hooks/useTagsManager";
import {
  analyzeRegisterActionWithAi,
  type RegisterActionPayload,
  type ActionAiAnalysis,
} from "@/services/ai/actionsAiService";

// [3.11.0] IA → AI Notes (sem alterar aiNotesService)
import { createAiNote } from "@/services/aiNotesService";

import type { Dir } from "@/config/actionConstants";
import { ACTION_GROUPS, byId, COLOR_PRESETS } from "@/config/actionConstants";
import { getContrastColor, darkenHex } from "@/utils/colors";
import { reconstructSelectionId, toTripleFromSelection } from "@/utils/actionMappers";
import { resolveActionLabel } from "@/utils/actionHelpers";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { TagChip } from "@/components/ui/TagChip";

/* --------------------- Tipos locais --------------------- */
type EditingChat = { id: string } & Partial<ActionFormData> & {
  kind?: string | null;
  channel_type?: string | null;
  direction?: "outbound" | "inbound" | "internal" | null;
  contact_name?: string | null;
  deal_id?: string | null;
  budgets?: any[] | null;
  tags?: string[] | null; // tags já existentes no chat (jsonb → string[] via slug)
};

interface EditActionFormProps {
  companyDetails?: CompanyDetails | null;
  editingChat: EditingChat | null;
  onSaved: () => void;
  onCancel: () => void;
  profileId?: string;
  /** Gatilho externo para disparar análise com IA (incremental) */
  aiTrigger?: number;
}

/* --------------------- Componente principal --------------------- */
const EditActionForm: React.FC<EditActionFormProps> = ({
  companyDetails,
  editingChat,
  onSaved,
  onCancel,
  profileId,
  aiTrigger,
}) => {
  const { addToast } = useToast();
  const isEditing = !!editingChat;
  const contextCompanyId = companyDetails?.id || editingChat?.company_id || "";
  const contacts: ContactWithChannels[] = companyDetails?.contacts ?? [];

  // Estado do modal de próxima ação
  const [nextOpen, setNextOpen] = useState(false);
  const [nextDefaults, setNextDefaults] = useState<{
    company_id: string;
    contact_id: string | null;
    subject?: string | null;
    seed_date?: string | null;
    seed_time?: string | null;
  }>({ company_id: "", contact_id: null });

  // Snapshot do pai
  const [stagedParent, setStagedParent] = useState<ActionFormData | null>(null);

  const normalizePriority = (p: string | null | undefined): string | null => {
    if (!p) return "Normal";
    return PRIORITY_OPTIONS.includes(p as any) ? p : "Normal";
  };

  const getFirstErrorMessage = (errors: any): string => {
    const order = [
      "action",
      "contact_id",
      "subject",
      "calendar_at",
      "on_time",
      "priority",
    ];
    for (const key of order) {
      const err = errors?.[key];
      if (err?.message) return String(err.message);
    }
    const flat = Object.values(errors) as any[];
    const withMsg = flat.find((e) => e && e.message);
    return withMsg?.message || "Verifique os campos obrigatórios.";
  };

  // Defaults ----------------
  const defaults = useMemo((): ActionFormData => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const mm = now.getMinutes();
    const roundedMin = Math.ceil(mm / 15) * 15;
    const d = new Date(now);
    if (roundedMin >= 60) {
      d.setHours(now.getHours() + 1);
      d.setMinutes(0);
    } else {
      d.setMinutes(roundedMin);
    }
    const currentTime = `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;

    let dv: ActionFormData;
    if (isEditing && editingChat) {
      const selId = reconstructSelectionId({
        kind: editingChat.kind ?? null,
        direction: (editingChat.direction ?? null) as Dir,
        channel_type: editingChat.channel_type ?? null,
      });
      dv = {
        action: selId,
        contact_id: editingChat.contact_id || "",
        company_id: editingChat.company_id || contextCompanyId,
        subject: editingChat.subject || "",
        body: editingChat.body || "",
        temperature: (editingChat as any).temperature || "Neutra",
        priority: normalizePriority((editingChat as any).priority) as any,
        calendar_at: editingChat.calendar_at
          ? String(editingChat.calendar_at).split("T")[0]
          : today,
        on_time: editingChat.on_time || currentTime,
        is_done: (editingChat as any).is_done ?? false,
      };
    } else {
      dv = {
        action: "",
        contact_id: contacts?.[0]?.id || "",
        company_id: contextCompanyId,
        subject: "",
        body: "",
        temperature: "Neutra",
        priority: "Normal",
        calendar_at: today,
        on_time: currentTime,
        is_done: false,
      };
    }
    return dv;
  }, [isEditing, editingChat, contextCompanyId, contacts]);

  const { control, handleSubmit, reset, formState, getValues, setValue } =
    useForm<ActionFormData>({
      resolver: zodResolver(actionSchema),
      defaultValues: defaults,
    });

  const watchedAction = useWatch({ control, name: "action" });
  const watchedSubject = useWatch({ control, name: "subject" });

  useEffect(() => {
    if (!nextOpen) reset(defaults);
  }, [defaults, nextOpen, reset]);

  const [budgetItems, setBudgetItems] = useState<UIBudgetItem[]>(() => {
    const raw = (editingChat?.budgets as UIBudgetItem[] | null) ?? [];
    // 3.8.2: orçamentos com status "terminado" não são exibidos/editados no formulário
    return raw.filter((b) => b && (b as any).status !== "terminado");
  });
  const [budgetDraft, setBudgetDraft] = useState<UIBudgetDraft | null>(null);

  // --------------------- Tags (Etiquetas) ---------------------
  const {
    tags,
    tagMapBySlug,
    lowerSelectedTags,
    isTagPanelOpen,
    tagSearch,
    tagSuggestions,
    tagLoading,
    tagCreating,
    tagError,
    pendingColor,
    effectivePendingColor,
    tagButtonRef,
    tagPanelRef,
    handleTagAdd,
    handleTagRemove,
    handleTagCreate,
    handleTagSearchKeyDown,
    setTagSearch,
    setIsTagPanelOpen,
    setPendingColor,
  } = useTagsManager({
    editingChatId: editingChat?.id,
    editingChatTags: (editingChat as any)?.tags,
  });

  const openCreateDraft = () => {
    setBudgetDraft({
      description: isEditing ? editingChat?.subject ?? "" : watchedSubject ?? "",
      amount: "",
      status: "aberta", // default = Em espera
      loss_reason: null,
    });
  };

  const openEditDraft = (item: UIBudgetItem) => {
    setBudgetDraft({
      id: item.id,
      description: item.description,
      amount: item.amount,
      status: item.status,
      loss_reason: item.loss_reason ?? null,
    });
  };

  const cancelDraft = () => setBudgetDraft(null);

  const submitDraft = async () => {
    if (!budgetDraft)
      return addToast("Descrição do orçamento é obrigatória.", "error");
    if (
      budgetDraft.amount === "" ||
      typeof budgetDraft.amount !== "number" ||
      !isFinite(budgetDraft.amount) ||
      budgetDraft.amount <= 0
    ) {
      return addToast("Valor do orçamento deve ser maior que zero.", "error");
    }

    const safeStatus = (budgetDraft.status ?? "aberta") as
      | "aberta"
      | "ganha"
      | "perdida"
      | "terminado";

    const allowedStatuses: Array<"aberta" | "ganha" | "perdida" | "terminado"> =
      ["aberta", "ganha", "perdida", "terminado"];

    if (!allowedStatuses.includes(safeStatus)) {
      return addToast("Status do orçamento inválido.", "error");
    }

    if (
      safeStatus === "perdida" &&
      !(budgetDraft.loss_reason && budgetDraft.loss_reason.trim().length > 0)
    ) {
      return addToast("Informe o motivo da perda.", "error");
    }

    try {
      if (isEditing && editingChat?.id) {
        if (budgetDraft.id) {
          await chatsService.updateBudget(editingChat.id, {
            id: budgetDraft.id,
            description: budgetDraft.description,
            amount: budgetDraft.amount as number,
            status: safeStatus,
            loss_reason: budgetDraft.loss_reason ?? null,
          });
          setBudgetItems((prev) =>
            prev
              .map((it) =>
                it.id === budgetDraft.id
                  ? {
                      ...it,
                      description: budgetDraft.description,
                      amount: budgetDraft.amount as number,
                      status: safeStatus,
                      loss_reason: budgetDraft.loss_reason ?? null,
                      updated_at: new Date().toISOString(),
                    }
                  : it
              )
              // 3.8.2: se virou "terminado", some da UI (deleção fria)
              .filter((it) => (it as any).status !== "terminado")
          );
          addToast("Orçamento atualizado.", "success");
        } else {
          await chatsService.appendBudget(editingChat.id, {
            description: budgetDraft.description,
            amount: budgetDraft.amount as number,
            status: safeStatus,
            loss_reason: budgetDraft.loss_reason ?? null,
          });

          // 3.8.2: se criado como "terminado", não exibe na UI (apenas auditoria)
          if (safeStatus !== "terminado") {
            setBudgetItems((prev) => [
              ...prev,
              {
                description: budgetDraft.description,
                amount: budgetDraft.amount as number,
                status: safeStatus,
                loss_reason: budgetDraft.loss_reason ?? null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              } as any,
            ]);
          }
          addToast("Orçamento criado.", "success");
        }
        setBudgetDraft(null);
        return;
      }

      // Novo chat (pendente em memória)
      const pendingItem: UIBudgetItem & { _pending: boolean } = {
        description: budgetDraft.description,
        amount: budgetDraft.amount as number,
        status: safeStatus,
        loss_reason: budgetDraft.loss_reason ?? null,
        _pending: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any;

      // 3.8.2: pendentes "terminado" não são exibidos na UI
      if (safeStatus !== "terminado") {
        setBudgetItems((prev) => [...prev, pendingItem]);
      }

      setBudgetDraft(null);
      addToast(
        "Orçamento adicionado (pendente). Será salvo ao registrar a ação.",
        "info"
      );
    } catch (e: any) {
      addToast(e?.message || "Falha ao salvar orçamento.", "error");
    }
  };

  /* --------------------- Submit principal (Salvar) --------------------- */
  const onSubmit = async (formData: ActionFormData) => {
    if (!formData.action) return addToast("Selecione uma Ação.", "error");
    if (!formData.contact_id)
      return addToast("Selecione um Contato.", "error");
    if (!formData.subject || formData.subject.trim().length < 2)
      return addToast("Informe o Assunto da ação.", "error");
    if (!formData.calendar_at) return addToast("Informe a Data.", "error");
    if (!formData.on_time) return addToast("Informe a Hora.", "error");

    // Padroniza temperatura
    formData.temperature = formData.temperature || "Neutra";

    const triple = toTripleFromSelection(formData.action);

    const effectiveCompanyId =
      (formData as any).company_id || contextCompanyId || null;

    const payloadChat = {
      id: isEditing ? editingChat?.id : undefined,
      company_id: effectiveCompanyId,
      contact_id: formData.contact_id,
      subject: formData.subject,
      body: formData.body,
      temperature: formData.temperature,
      priority: normalizePriority(formData.priority) as any,
      calendar_at: formData.calendar_at,
      on_time: formData.on_time,
      is_done: formData.is_done,
      kind: triple.kind,
      direction: triple.direction,
      channel_type: triple.channel_type,
      tags, // slugs das etiquetas
    };

    try {
      const chat = await chatsService.upsertChat(payloadChat as any);

      if (!isEditing) {
        const pendentes = budgetItems.filter((b) => (b as any)._pending);
        for (const p of pendentes) {
          await chatsService.appendBudget(chat.id, {
            description: p.description,
            amount: p.amount,
            status: p.status,
            loss_reason: p.loss_reason ?? null,
          });
        }
      }

      if (formData.action === "task:null:orcamento") {
        const hadInline = isEditing
          ? false
          : budgetItems.some((b) => (b as any)._pending);
        if (hadInline) addToast("Orçamentos pendentes salvos.", "success");
      }

      addToast(isEditing ? "Ação atualizada." : "Ação registrada.", "success");

      // 🔔 IMPORTANTE: garantir refresh de Histórico + "Empresas com Ações Ativas"
      try {
        const detail = { companyId: effectiveCompanyId ?? null };
        window.dispatchEvent(
          new CustomEvent("cockpit:refreshHistory", { detail })
        );
        window.dispatchEvent(new CustomEvent("chats:changed", { detail }));
      } catch {
        // silencioso – não deve quebrar o fluxo de salvar
      }

      onSaved();
    } catch (e: any) {
      addToast(e?.message || "Falha ao salvar.", "error");
    }
  };

  const onInvalid = (errors: any) => {
    const msg = getFirstErrorMessage(errors);
    addToast(msg, "error");
  };

  /* --------------------- + Próxima Ação: VALIDAR → stage PAI → abrir modal --------------------- */
  const handleOpenNextAction = () => {
    const data = getValues();

    if (!data.action) return addToast("Selecione uma Ação.", "error");
    if (!data.contact_id)
      return addToast("Selecione um Contato.", "error");
    if (!data.subject || data.subject.trim().length < 2)
      return addToast("Informe o Assunto da ação.", "error");
    if (!data.calendar_at) return addToast("Informe a Data.", "error");
    if (!data.on_time) return addToast("Informe a Hora.", "error");

    const effectiveCompanyId =
      (data as any).company_id || contextCompanyId || "";
    if (!effectiveCompanyId) {
      return addToast(
        "Empresa inválida: abra/seleciona o dossiê da empresa antes de agendar a próxima ação.",
        "error"
      );
    }

    setStagedParent({
      ...data,
      temperature: data.temperature || "Neutra",
      company_id: effectiveCompanyId,
      priority: normalizePriority(data.priority) as any,
    });

    const now = new Date();
    const seed = new Date(`${data.calendar_at}T${data.on_time}`);
    const useSeed =
      !isNaN(seed.getTime()) && seed.getTime() >= now.getTime();

    setNextDefaults({
      company_id: effectiveCompanyId,
      contact_id: data.contact_id || null,
      subject: "",
      seed_date: useSeed ? data.calendar_at : null,
      seed_time: useSeed ? data.on_time : null,
    });

    setNextOpen(true);
  };

  /* --------------------- Encadeamento do modal --------------------- */
  const handleSubmitNext = async (nextData: ActionFormData) => {
    if (!stagedParent) {
      addToast("Fluxo inválido: dados do formulário não encontrados.", "error");
      return;
    }

    try {
      const tripleParent = toTripleFromSelection(stagedParent.action);
      const parentCompanyId =
        (stagedParent as any).company_id || contextCompanyId || null;

      const parentPayload = {
        id: isEditing ? editingChat?.id : undefined,
        company_id: parentCompanyId,
        contact_id: stagedParent.contact_id,
        subject: stagedParent.subject,
        body: stagedParent.body,
        temperature: stagedParent.temperature || "Neutra",
        priority: normalizePriority(stagedParent.priority) as any,
        calendar_at: stagedParent.calendar_at,
        on_time: stagedParent.on_time,
        is_done: stagedParent.is_done,
        kind: tripleParent.kind,
        direction: tripleParent.direction,
        channel_type: tripleParent.channel_type,
        tags, // mesmas etiquetas da ação atual
      };
      const parent = await chatsService.upsertChat(parentPayload as any);

      if (!isEditing) {
        const pendentes = budgetItems.filter((b) => (b as any)._pending);
        for (const p of pendentes) {
          await chatsService.appendBudget(parent.id, {
            description: p.description,
            amount: p.amount,
            status: p.status,
            loss_reason: p.loss_reason ?? null,
          });
        }
      }

      const tripleChild = toTripleFromSelection(nextData.action);
      const childTemp = nextData.temperature || "Neutra";
      await chatsService.upsertChat({
        id: undefined,
        company_id:
          (nextData as any).company_id ||
          parentCompanyId ||
          contextCompanyId ||
          null,
        contact_id: nextData.contact_id,
        subject: nextData.subject,
        body: nextData.body,
        temperature: childTemp,
        priority: nextData.priority,
        calendar_at: nextData.calendar_at,
        on_time: nextData.on_time,
        is_done: nextData.is_done,
        kind: tripleChild.kind,
        direction: tripleChild.direction,
        channel_type: tripleChild.channel_type,
        reply_to_id: parent.id,
      } as any);

      addToast("Ação atual e próxima ação registradas.", "success");
      try {
        const detail = { companyId: parentCompanyId ?? null };
        window.dispatchEvent(
          new CustomEvent("cockpit:refreshHistory", { detail })
        );
        window.dispatchEvent(new CustomEvent("chats:changed", { detail }));
      } catch {}
      setNextOpen(false);
      onSaved?.();
    } catch (e: any) {
      addToast(e?.message || "Falha ao registrar a próxima ação.", "error");
    }
  };

  const shouldShowBudgetSection = watchedAction === "task:null:orcamento";

  // Opções do select: usar exatamente o enum TitleCase
  const temperatureOptions = useMemo(
    () => TEMPERATURE_OPTIONS as string[],
    []
  );

  /* --------------------- IA: estado local de análise --------------------- */
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<ActionAiAnalysis | null>(null);
  const [aiRequested, setAiRequested] = useState(false);
  const lastAiTriggerRef = useRef<number | undefined>(undefined);

  // [3.11.0] helper local de fingerprint (best-effort, anti-duplicidade via metadata)
  const buildFingerprint = (input: string) => {
    try {
      return btoa(unescape(encodeURIComponent(input))).slice(0, 120);
    } catch {
      return String(Date.now());
    }
  };

  // [3.11.1] bridge Cockpit → ai_notes (persistência silenciosa) + body COMPLETO
  const persistAiAnalysisToNotes = async (
    payload: RegisterActionPayload,
    analysis: ActionAiAnalysis
  ) => {
    try {
      const sentimentPlainLabel = (s: ActionAiAnalysis["sentiment"]) => {
        if (s === "positivo") return "Positivo";
        if (s === "negativo") return "Negativo";
        if (s === "neutro") return "Neutro";
        return "n/d";
      };

      const urgencyPlainLabel = (u: ActionAiAnalysis["urgency"]) => {
        if (u === "alta") return "Alta";
        if (u === "media") return "Média";
        if (u === "baixa") return "Baixa";
        return "n/d";
      };

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
          if (s && s.trim()) parts.push(`- ${s.trim()}`);
        });
        parts.push("");
      }

      if (analysis.checklist?.length) {
        parts.push("Checklist:");
        analysis.checklist.forEach((c) => {
          if (c && c.trim()) parts.push(`- ${c.trim()}`);
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

  const resolveStatusLabel = (isDone: boolean | undefined | null): string =>
    isDone ? "Concluída" : "Andamento";

  const resolveContatoNome = (contactId: string | null | undefined): string => {
    if (!contactId) return "";
    const c = contacts.find((ct) => ct.id === contactId);
    return c?.full_name ?? "";
  };

  // Dispara análise de IA sempre que o gatilho externo mudar
  useEffect(() => {
    if (aiTrigger === undefined) return;
    if (lastAiTriggerRef.current === aiTrigger) return;
    lastAiTriggerRef.current = aiTrigger;

    const runAi = async () => {
      const data = getValues();

      // Se não houver descrição, ainda deixamos a IA tentar (usando assunto),
      // mas avisamos o usuário.
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
        prioridade: normalizePriority(data.priority) || "Normal",
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

        // Auto-save silencioso em ai_notes (não depende do "Colar ✨")
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
  }, [aiTrigger, getValues, contacts, tags, normalizePriority, addToast]);

  const sentimentToLabel = (s: ActionAiAnalysis["sentiment"]) => {
    if (s === "positivo") return "Sentimento: Positivo";
    if (s === "negativo") return "Sentimento: Negativo";
    if (s === "neutro") return "Sentimento: Neutro";
    return "Sentimento: n/d";
  };

  const urgencyToLabel = (u: ActionAiAnalysis["urgency"]) => {
    if (u === "alta") return "Urgência: Alta";
    if (u === "media") return "Urgência: Média";
    if (u === "baixa") return "Urgência: Baixa";
    return "Urgência: n/d";
  };

  // Labels "limpos" para uso dentro do bloco colado
  const sentimentPlainLabel = (s: ActionAiAnalysis["sentiment"]) => {
    if (s === "positivo") return "Positivo";
    if (s === "negativo") return "Negativo";
    if (s === "neutro") return "Neutro";
    return "n/d";
  };

  const urgencyPlainLabel = (u: ActionAiAnalysis["urgency"]) => {
    if (u === "alta") return "Alta";
    if (u === "media") return "Média";
    if (u === "baixa") return "Baixa";
    return "n/d";
  };

  const buildAiPasteBlock = (analysis: ActionAiAnalysis): string => {
    const parts: string[] = [];

    parts.push("---");
    parts.push("");
    parts.push("✨");
    parts.push(`Sentimento: ${sentimentPlainLabel(analysis.sentiment)}`);
    parts.push(`Urgência: ${urgencyPlainLabel(analysis.urgency)}`);
    parts.push("");

    if (analysis.summary && analysis.summary.trim()) {
      parts.push(analysis.summary.trim());
      parts.push("");
    }

    if (analysis.next_steps && analysis.next_steps.length > 0) {
      parts.push("Próximas ações:");
      analysis.next_steps.forEach((step) => {
        if (step && step.trim()) {
          parts.push(`- ${step.trim()}`);
        }
      });
      parts.push("");
    }

    if (analysis.checklist && analysis.checklist.length > 0) {
      parts.push("Checklist:");
      analysis.checklist.forEach((item) => {
        if (item && item.trim()) {
          parts.push(`- ${item.trim()}`);
        }
      });
      parts.push("");
    }

    if (analysis.suggested_tags && analysis.suggested_tags.length > 0) {
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
  };

  const handlePasteFromAi = () => {
    if (!aiResult) {
      addToast("Nenhuma sugestão da IA disponível para colar.", "info");
      return;
    }

    const currentBody = getValues("body") ?? "";
    const block = buildAiPasteBlock(aiResult);
    const newBody = `${currentBody}\n\n${block}`;

    setValue("body", newBody, { shouldDirty: true });
    // Fechar painel da IA seria opcional; por ora mantemos aberto para referência visual.
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
        {/* Ação e Status */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Controller
            name="action"
            control={control}
            render={({ field, fieldState }) => (
              <HierarchicalActionSelect
                label="Ação*"
                error={fieldState.error?.message}
                groups={ACTION_GROUPS.map((g) => ({
                  group: g.group,
                  options: g.options.map((o) => ({
                    id: o.id,
                    label: o.label,
                  })),
                }))}
                value={field.value}
                onChange={field.onChange}
                profileId={profileId}
                placeholder="Selecione uma ação..."
              />
            )}
          />
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium mb-1 text-transparent select-none sm:text-gray-600 dark:sm:text-gray-300">
              Status
            </label>
            <Controller
              name="is_done"
              control={control}
              render={({ field }) => (
                <SegmentedToggle
                  value={field.value ? "right" : "left"}
                  onChange={(v) => field.onChange(v === "right")}
                  leftLabel="Andamento"
                  rightLabel="Concluída"
                  leftActiveClass="bg-red-500 text-white"
                  rightActiveClass="bg-green-600 text-white"
                />
              )}
            />
          </div>
        </div>

        {/* Contato e Assunto */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Contato*</label>
            <Controller
              name="contact_id"
              control={control}
              render={({ field }) => (
                <select
                  className="input-field h-11 dark:bg-dark-s2 dark:text-dark-t1 dark:border-dark-bmd"
                  value={field.value}
                  onChange={field.onChange}
                >
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
              )}
            />
          </div>
          <Controller
            name="subject"
            control={control}
            render={({ field, fieldState }) => (
              <Input
                label="Assunto*"
                placeholder="Resumo da ação..."
                {...field}
                error={fieldState.error?.message}
                className="h-11"
                style={{
                  fontSize: '14px',
                  color: '#3b2e1a',
                  backgroundColor: '#fffdf9',
                  border: '0.5px solid rgba(59,42,20,0.15)',
                  borderRadius: '8px',
                  boxShadow: 'none',
                  padding: '8px 12px',
                  width: '100%',
                }}
              />
            )}
          />
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Descreva a Ação ou Conversa
          </label>
          <Controller
            name="body"
            control={control}
            render={({ field }) => (
              <textarea
                rows={4}
                placeholder="Detalhes, notas, próximos passos..."
                className="input-field dark:bg-dark-s2 dark:text-dark-t1 dark:border-dark-bmd dark:focus:border-accent dark:focus:shadow-focus-accent"
                {...field}
                value={field.value ?? ""}
              />
            )}
          />
        </div>

        {/* Painel de Sugestões da IA */}
        {aiRequested && (
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
                    onClick={handlePasteFromAi}
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
        )}

        {/* Etiquetas: botão etiqueta + chips (e janela de Tagging) */}
        <div className="relative">
          <label className="block text-sm font-medium mb-1">Etiquetas</label>
          <div className="flex items-start gap-3">
            <div
              ref={tagButtonRef as any}
              title="Etiqueta"
              aria-label="Etiqueta"
              onClick={() => {
                setIsTagPanelOpen((prev) => !prev);
                setTagSearch("");
                setTagSuggestions([]);
                setTagError(null);
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
              style={{
                backgroundColor: '#3b68f5',
                color: '#ffffff',
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                opacity: 1,
              }}
            >
              <TagIcon className="h-4 w-4" />
            </div>

            <div className="flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-plate dark:bg-dark-s1 neumorphic-concave flex flex-wrap gap-2 items-center">
              {tags.length === 0 && (
                <span className="text-xs text-gray-500 dark:text-dark-t2">
                  Use o botão de etiqueta para pesquisar ou criar novas
                  etiquetas que resumam o assunto ou contexto da ação.
                </span>
              )}
              {tags.map((slug) => (
                <TagChip
                  key={slug}
                  slug={slug}
                  tag={tagMapBySlug.get(slug.toLowerCase())}
                  onRemove={() => handleTagRemove(slug)}
                />
              ))}
            </div>
          </div>

          {isTagPanelOpen && (
            <div
              ref={tagPanelRef}
              className="absolute z-30 mt-2 w-full max-w-xl rounded-xl bg-slate-900 text-slate-50 shadow-xl border border-slate-700 p-3"
            >
              <div className="mb-2 flex items-start justify_between gap-2">
                <div className="text-[11px] text-slate-300">
                  <div className="font-semibold mb-0.5">
                    Etiquetas desta ação
                  </div>
                  <div className="text-slate-400">
                    Busque por nome para reaproveitar etiquetas existentes ou
                    crie novas com uma cor padrão. Isso ajuda a organizar o
                    contexto sobre a conversa/tarefa.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTagPanelOpen(false)}
                  className="ml-2 text-[10px] text-slate-400 hover:text-slate-100"
                >
                  Fechar
                </button>
              </div>

              <div className="mb-2 flex flex-col gap-2">
                <input
                  type="text"
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  onKeyDown={handleTagSearchKeyDown}
                  placeholder="Buscar ou criar etiqueta..."
                  className="w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs outline-none placeholder:text-slate-500"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400">Cor sugerida:</span>
                  <div className="flex flex-wrap gap-1">
                    {COLOR_PRESETS.map((c) => {
                      const selected = c === effectivePendingColor;
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setPendingColor(c)}
                          className={clsx(
                            "h-4 w-4 rounded-full border border-slate-600",
                            selected &&
                              "ring-2 ring-offset-1 ring-offset-slate-900"
                          )}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleTagCreate}
                  disabled={tagCreating || !tagSearch.trim()}
                  className="self-start mt-1 inline-flex items-center rounded-md border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] font-medium hover:bg-slate-700 disabled:opacity-50"
                >
                  {tagCreating ? "Criando..." : "Criar etiqueta com esse nome"}
                </button>
              </div>

              {tagError && (
                <div className="mb-2 text-[10px] text-red-400">{tagError}</div>
              )}

              <div className="max-h-56 space-y-1 overflow-y-auto pr-1 mb-2">
                {tagLoading && (
                  <div className="text-[10px] text-slate-400">Buscando tags...</div>
                )}

                {tagSuggestions.map((tag) => {
                  const selected = lowerSelectedTags.has(tag.slug.toLowerCase());
                  const baseColor = tag.color || "#4B5563";
                  const textColor = getContrastColor(baseColor);
                  const outlineColor = darkenHex(baseColor, 0.85);

                  return (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-slate-800/80"
                    >
                      <button
                        type="button"
                        onClick={() => handleTagAdd(tag.slug)}
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        <span className="text-slate-500 text-[10px] mr-1">⋮⋮</span>
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border"
                          style={{
                            backgroundColor: baseColor,
                            color: textColor,
                            borderColor: outlineColor,
                          }}
                        >
                          <span
                            className="mr-1 inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: baseColor }}
                          />
                          {tag.name}
                        </span>
                      </button>
                      <input
                        type="checkbox"
                        className="ml-2 h-3 w-3 rounded border-slate-500 bg-slate-800 text-primary focus:ring-0"
                        checked={selected}
                        onChange={() => {
                          if (selected) {
                            handleTagRemove(tag.slug);
                          } else {
                            handleTagAdd(tag.slug);
                          }
                        }}
                      />
                    </div>
                  );
                })}

                {!tagLoading && tagSuggestions.length === 0 && tagSearch && (
                  <div className="text-[10px] text-slate-500">
                    Nenhuma etiqueta encontrada para &quot;{tagSearch}&quot;.
                    Você pode criar uma nova usando o botão acima.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Data → Hora → Temperatura → Prioridade */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Controller
            name="calendar_at"
            control={control}
            render={({ field }) => (
              <Input
                type="date"
                label="Data*"
                {...field}
                className="h-11"
                style={{
                  fontSize: '14px',
                  color: '#3b2e1a',
                  backgroundColor: '#fffdf9',
                  border: '0.5px solid rgba(59,42,20,0.15)',
                  borderRadius: '8px',
                  boxShadow: 'none',
                  padding: '8px 12px',
                  width: '100%',
                }}
              />
            )}
          />

          <TimePickerRHF
            control={control}
            name="on_time"
            label="Hora*"
            minuteStep={15}
            dropdownMaxHeight={224}
          />

          <div>
            <label className="block text-sm font-medium mb-1">Temperatura</label>
            <Controller
              name="temperature"
              control={control}
              render={({ field }) => (
                <select
                  className="input-field h-11 dark:bg-dark-s2 dark:text-dark-t1 dark:border-dark-bmd"
                  value={field.value ?? "Neutra"}
                  onChange={(e) => field.onChange(e.target.value || "Neutra")}
                >
                  {temperatureOptions.map((opt) => (
                    <option key={String(opt)} value={String(opt)}>
                      {String(opt)}
                    </option>
                  ))}
                </select>
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Prioridade</label>
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <select
                  className="input-field h-11 dark:bg-dark-s2 dark:text-dark-t1 dark:border-dark-bmd"
                  value={field.value ?? "Normal"}
                  onChange={(e) => field.onChange(e.target.value || "Normal")}
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={String(opt)} value={String(opt)}>
                      {String(opt)}
                    </option>
                  ))}
                </select>
              )}
            />
          </div>
        </div>

        {/* Rodapé: + Próxima ação / Cancelar / Salvar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-t2">
            <button
              onClick={handleOpenNextAction}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                backgroundColor: '#3b68f5',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 14px 6px 8px',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '400',
              }}
            >
              <PlusCircle size={16} color="#ffffff" />
              <span>Próxima ação</span>
            </button>
            <span className="max-w-xs">
              A próxima ação será criada encadeada a esta, mantendo o contexto
              de empresa, contato e temperatura.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                border: '0.5px solid rgba(59,42,20,0.15)',
                borderRadius: '8px',
                padding: '7px 15px',
                color: '#9a7d5a',
                fontSize: '13px',
                fontWeight: '400',
                opacity: 1,
              }}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              variant="primary"
              className="px-4"
              disabled={formState.isSubmitting}
              title={isEditing ? "Editar ação existente" : "Registrar nova ação"}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
            >
              {formState.isSubmitting ? "Salvando..." : "Salvar ação"}
            </Button>
          </div>
        </div>
      </form>

      {shouldShowBudgetSection && (
        <BudgetSection
          items={budgetItems}
          draft={budgetDraft}
          onCreateRequest={openCreateDraft}
          onEditRequest={openEditDraft}
          onDraftChange={setBudgetDraft}
          onSubmitDraft={submitDraft}
          onCancelDraft={cancelDraft}
        />
      )}

      <ScheduleActionModal
        open={nextOpen}
        onClose={() => {
          setNextOpen(false);
        }}
        defaults={nextDefaults}
        contacts={contacts}
        profileId={profileId}
        onSubmitNext={handleSubmitNext}
      />
    </div>
  );
};

export default EditActionForm;

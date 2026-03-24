import { useState } from "react";
import type { ActionFormData } from "@/types/chat";
import { PRIORITY_OPTIONS } from "@/types/chat";
import * as chatsService from "@/services/chatsService";
import { toTripleFromSelection } from "@/utils/actionMappers";
import type { BudgetItem as UIBudgetItem } from "../BudgetSection";

type AddToast = (message: string, type: string) => void;

interface NextDefaults {
  company_id: string;
  contact_id: string | null;
  subject?: string | null;
  seed_date?: string | null;
  seed_time?: string | null;
}

interface UseActionSubmitParams {
  isEditing: boolean;
  editingChatId: string | undefined;
  contextCompanyId: string;
  tags: string[];
  budgetItems: UIBudgetItem[];
  addToast: AddToast;
  onSaved: () => void;
}

export interface UseActionSubmitReturn {
  onSubmit: (formData: ActionFormData) => Promise<void>;
  handleOpenNextAction: (formData: ActionFormData) => void;
  handleSubmitNext: (nextData: ActionFormData) => Promise<void>;
  nextOpen: boolean;
  setNextOpen: (v: boolean) => void;
  nextDefaults: NextDefaults;
  stagedParent: ActionFormData | null;
}

function normalizePriority(p: string | null | undefined): string | null {
  if (!p) return "Normal";
  return PRIORITY_OPTIONS.includes(p as any) ? p : "Normal";
}

function dispatchRefreshEvents(companyId: string | null) {
  try {
    const detail = { companyId };
    window.dispatchEvent(new CustomEvent("cockpit:refreshHistory", { detail }));
    window.dispatchEvent(new CustomEvent("chats:changed", { detail }));
  } catch {
    // silencioso — não deve quebrar o fluxo de salvar
  }
}

async function processPendingBudgets(
  chatId: string,
  budgetItems: UIBudgetItem[]
) {
  const pendentes = budgetItems.filter((b) => (b as any)._pending);
  for (const p of pendentes) {
    await chatsService.appendBudget(chatId, {
      description: p.description,
      amount: p.amount,
      status: p.status,
      loss_reason: p.loss_reason ?? null,
    });
  }
}

export function useActionSubmit({
  isEditing,
  editingChatId,
  contextCompanyId,
  tags,
  budgetItems,
  addToast,
  onSaved,
}: UseActionSubmitParams): UseActionSubmitReturn {
  const [nextOpen, setNextOpen] = useState(false);
  const [nextDefaults, setNextDefaults] = useState<NextDefaults>({
    company_id: "",
    contact_id: null,
  });
  const [stagedParent, setStagedParent] = useState<ActionFormData | null>(null);

  const onSubmit = async (formData: ActionFormData) => {
    if (!formData.action) return addToast("Selecione uma Ação.", "error");
    if (!formData.contact_id) return addToast("Selecione um Contato.", "error");
    if (!formData.subject || formData.subject.trim().length < 2)
      return addToast("Informe o Assunto da ação.", "error");
    if (!formData.calendar_at) return addToast("Informe a Data.", "error");
    if (!formData.on_time) return addToast("Informe a Hora.", "error");

    formData.temperature = formData.temperature || "Neutra";

    const triple = toTripleFromSelection(formData.action);
    const effectiveCompanyId =
      (formData as any).company_id || contextCompanyId || null;

    const payloadChat = {
      id: isEditing ? editingChatId : undefined,
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
      tags,
    };

    try {
      const chat = await chatsService.upsertChat(payloadChat as any);

      if (!isEditing) {
        await processPendingBudgets(chat.id, budgetItems);
      }

      if (formData.action === "task:null:orcamento") {
        const hadInline = isEditing
          ? false
          : budgetItems.some((b) => (b as any)._pending);
        if (hadInline) addToast("Orçamentos pendentes salvos.", "success");
      }

      addToast(isEditing ? "Ação atualizada." : "Ação registrada.", "success");
      dispatchRefreshEvents(effectiveCompanyId);
      onSaved();
    } catch (e: any) {
      addToast(e?.message || "Falha ao salvar.", "error");
    }
  };

  const handleOpenNextAction = (data: ActionFormData) => {
    if (!data.action) return addToast("Selecione uma Ação.", "error");
    if (!data.contact_id) return addToast("Selecione um Contato.", "error");
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
        id: isEditing ? editingChatId : undefined,
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
        tags,
      };
      const parent = await chatsService.upsertChat(parentPayload as any);

      if (!isEditing) {
        await processPendingBudgets(parent.id, budgetItems);
      }

      const tripleChild = toTripleFromSelection(nextData.action);
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
        temperature: nextData.temperature || "Neutra",
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
      dispatchRefreshEvents(parentCompanyId);
      setNextOpen(false);
      onSaved?.();
    } catch (e: any) {
      addToast(e?.message || "Falha ao registrar a próxima ação.", "error");
    }
  };

  return {
    onSubmit,
    handleOpenNextAction,
    handleSubmitNext,
    nextOpen,
    setNextOpen,
    nextDefaults,
    stagedParent,
  };
}

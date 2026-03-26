import { useState } from "react";
import type { BudgetItem as UIBudgetItem, BudgetDraft as UIBudgetDraft } from "../BudgetSection";
import * as chatsService from "@/services/chatsService";

type AddToast = (message: string, type: string) => void;

interface UseBudgetManagerParams {
  isEditing: boolean;
  chatId: string | undefined;
  companyId: string | undefined;
  initialBudgets: UIBudgetItem[] | null | undefined;
  addToast: AddToast;
}

export interface UseBudgetManagerReturn {
  budgetItems: UIBudgetItem[];
  budgetDraft: UIBudgetDraft | null;
  setBudgetDraft: (draft: UIBudgetDraft | null) => void;
  openCreateDraft: (defaultDescription?: string) => void;
  openEditDraft: (item: UIBudgetItem) => void;
  cancelDraft: () => void;
  submitDraft: () => Promise<void>;
}

const ALLOWED_STATUSES = ["aberta", "ganha", "perdida", "terminado"] as const;
type BudgetStatus = typeof ALLOWED_STATUSES[number];

function dispatchBudgetRefresh(companyId: string | undefined) {
  try {
    const detail = { companyId: companyId ?? null };
    window.dispatchEvent(new CustomEvent("cockpit:refreshHistory", { detail }));
    window.dispatchEvent(new CustomEvent("chats:changed", { detail }));
  } catch {
    // silencioso
  }
}

export function useBudgetManager({
  isEditing,
  chatId,
  companyId,
  initialBudgets,
  addToast,
}: UseBudgetManagerParams): UseBudgetManagerReturn {
  const [budgetItems, setBudgetItems] = useState<UIBudgetItem[]>(() => {
    const raw = (initialBudgets as UIBudgetItem[] | null) ?? [];
    // 3.8.2: orçamentos com status "terminado" não são exibidos/editados
    return raw.filter((b) => b && (b as any).status !== "terminado");
  });

  const [budgetDraft, setBudgetDraft] = useState<UIBudgetDraft | null>(null);

  const openCreateDraft = (defaultDescription = "") => {
    setBudgetDraft({
      description: defaultDescription,
      amount: "",
      status: "aberta",
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

    const safeStatus = (budgetDraft.status ?? "aberta") as BudgetStatus;

    if (!ALLOWED_STATUSES.includes(safeStatus)) {
      return addToast("Status do orçamento inválido.", "error");
    }

    if (
      safeStatus === "perdida" &&
      !(budgetDraft.loss_reason && budgetDraft.loss_reason.trim().length > 0)
    ) {
      return addToast("Informe o motivo da perda.", "error");
    }

    try {
      if (isEditing && chatId) {
        if (budgetDraft.id) {
          // Atualizar existente
          await chatsService.updateBudget(chatId, {
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
          dispatchBudgetRefresh(companyId);
          addToast("Orçamento atualizado.", "success");
        } else {
          // Criar novo em chat existente
          await chatsService.appendBudget(chatId, {
            description: budgetDraft.description,
            amount: budgetDraft.amount as number,
            status: safeStatus,
            loss_reason: budgetDraft.loss_reason ?? null,
          });

          // 3.8.2: "terminado" criado direto não aparece na UI
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
          dispatchBudgetRefresh(companyId);
          addToast("Orçamento criado.", "success");
        }
        setBudgetDraft(null);
        return;
      }

      // Novo chat (pendente em memória — salvo no onSubmit do formulário)
      const pendingItem: UIBudgetItem & { _pending: boolean } = {
        description: budgetDraft.description,
        amount: budgetDraft.amount as number,
        status: safeStatus,
        loss_reason: budgetDraft.loss_reason ?? null,
        _pending: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any;

      // 3.8.2: pendentes "terminado" não exibidos na UI
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

  return {
    budgetItems,
    budgetDraft,
    setBudgetDraft,
    openCreateDraft,
    openEditDraft,
    cancelDraft,
    submitDraft,
  };
}

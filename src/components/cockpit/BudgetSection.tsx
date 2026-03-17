/*
-- ===================================================
-- Código             : /src/components/cockpit/BudgetSection.tsx
-- Versão (.v20)      : 3.4.1
-- Data/Hora          : 2025-11-30 16:35 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Seção inline, STATELESS, para lista e edição de múltiplos orçamentos (budgets[]) sem tocar no Supabase.
-- Fluxo              : EditActionForm (pai) mantém estado (items + draft) e decide append/update (e, em criação, guarda pendentes).
-- Alterações (3.2.0) :
--  • [UX] Rótulo "Aberta" alterado para "Em espera" (valor interno permanece "aberta").
--  • [UX] Lista e editor exibem "Em espera" quando status === "aberta".
--  • [DEFAULT] Default desejado = "Em espera" (valor interno "aberta") definido pelo componente pai ao abrir o draft.
-- Alterações (3.3.0) :
--  • [STATUS] Adicionado novo status interno "terminado" (rótulo "Encerrado" na UI),
--             última opção do dropdown, em negrito/vermelho.
--  • [STATUS] Tipos BudgetItem/BudgetDraft e displayStatus atualizados para suportar o novo status,
--             sem alteração de layout ou fluxo visual.
-- Alterações (3.4.0) :
--  • [VALOR] Campo "Valor (BRL)" passou a usar máscara pt-BR:
--            - Input sempre formatado com milhar e 2 casas (ex.: 150.000,01).
--            - Digitação livre (apenas dígitos): os dois últimos dígitos viram centavos.
--            - Internamente, amount continua sendo number (ex.: 150000.01) ou "" quando vazio.
-- Alterações (3.4.1) :
--  • [STATUS] Normalização defensiva de `draft.status` no select:
--             se vier qualquer valor inesperado, cai em "aberta" (Em espera),
--             mantendo a edição livre para Ganha / Perdida / Encerrado.
-- ===================================================
*/

import React from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export type BudgetItem = {
  id?: string; // ausente nos pendentes (criação)
  description: string;
  amount: number; // number real (pai faz parse)
  status: "aberta" | "ganha" | "perdida" | "terminado";
  loss_reason?: string | null;
  created_at?: string; // UTC ISO
  updated_at?: string; // UTC ISO
  _pending?: boolean; // marca local (não persistido)
};

export type BudgetDraft = {
  id?: string;
  description: string;
  amount: number | ""; // edição: input controla; pai envia number
  status: "aberta" | "ganha" | "perdida" | "terminado";
  loss_reason?: string | null;
};

type Props = {
  items: BudgetItem[]; // lista atual (persistidos + pendentes)
  draft: BudgetDraft | null; // item em edição/criação
  onCreateRequest: () => void; // abrir editor vazio
  onEditRequest: (item: BudgetItem) => void; // abrir editor com item
  onDraftChange: (next: BudgetDraft | null) => void;
  onSubmitDraft: () => void; // pai decide append/update/pendente
  onCancelDraft: () => void; // fechar editor
};

const STATUS_VALUES: BudgetDraft["status"][] = [
  "aberta",
  "ganha",
  "perdida",
  "terminado",
];

/* ------------------------- Helpers de formato ------------------------- */

// Exibição na lista (com R$)
function formatMoney(n: number | undefined) {
  if (typeof n !== "number" || !isFinite(n)) return "-";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(n);
  } catch {
    return String(n);
  }
}

// Exibição no input (sem prefixo R$)
function formatMoneyInput(n: number | undefined): string {
  if (typeof n !== "number" || !isFinite(n)) return "";
  try {
    return n.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return String(n);
  }
}

function formatDate(s?: string) {
  if (!s) return "";
  try {
    const d = new Date(s);
    return d.toLocaleString("pt-BR");
  } catch {
    return s;
  }
}

function displayStatus(s?: BudgetItem["status"]): string {
  if (!s) return "—";
  if (s === "aberta") return "Em espera";
  if (s === "ganha") return "Ganha";
  if (s === "perdida") return "Perdida";
  if (s === "terminado") return "Encerrado";
  return s;
}

export default function BudgetSection({
  items,
  draft,
  onCreateRequest,
  onEditRequest,
  onDraftChange,
  onSubmitDraft,
  onCancelDraft,
}: Props) {
  const set = <K extends keyof BudgetDraft>(k: K, v: BudgetDraft[K]) =>
    onDraftChange(draft ? { ...draft, [k]: v } : null);

  /**
   * Máscara de digitação para Valor (BRL):
   * - Considera apenas dígitos.
   * - Dois últimos dígitos = centavos.
   * - Ex: "1" => 0,01 | "15000001" => 150.000,01 (amount = 150000.01).
   */
  const handleAmountChange = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, "");

    if (!digitsOnly) {
      set("amount", "");
      return;
    }

    // parseInt dos centavos e divide por 100 para virar number com 2 casas
    const intValue = parseInt(digitsOnly, 10);
    if (!Number.isFinite(intValue)) {
      set("amount", "");
      return;
    }

    const value = intValue / 100; // 15000001 -> 150000.01
    set("amount", value);
  };

  // Status normalizado para o select (defensivo)
  const currentStatus: BudgetDraft["status"] | undefined =
    draft && STATUS_VALUES.includes(draft.status)
      ? draft.status
      : draft
      ? "aberta"
      : undefined;

  return (
    <div className="mt-4 p-4 border-t border-dashed border-dark-shadow dark:border-dark-dark-shadow space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-md font-bold text-gray-700 dark:text-gray-200">
          Orçamentos
        </h4>
        {!draft && (
          <Button type="button" variant="ghost" onClick={onCreateRequest}>
            + Adicionar orçamento
          </Button>
        )}
      </div>

      {/* Lista compacta */}
      <div className="space-y-2">
        {items.length === 0 && (
          <div className="text-sm text-gray-500">
            Nenhum orçamento cadastrado.
          </div>
        )}
        {items.map((it) => (
          <div
            key={
              it.id ??
              `${it.description}-${it.amount}-${it.updated_at ?? "pending"}`
            }
            className="flex items-center justify-between rounded-lg px-3 py-2 bg-plate dark:bg-plate-dark border border-dark-shadow dark:border-dark-dark-shadow"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">
                {it.description}{" "}
                {it._pending && (
                  <span className="ml-1 text-xs text-amber-600">
                    (pendente)
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {formatMoney(it.amount)} • {displayStatus(it.status)}
                {it.updated_at
                  ? ` • atualizado ${formatDate(it.updated_at)}`
                  : ""}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onEditRequest(it)}
                title="Editar orçamento"
              >
                ✎ Editar
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Editor inline (controlado) */}
      {draft && (
        <div className="space-y-4 pt-2 border-t border-dashed border-dark-shadow dark:border-dark-dark-shadow">
          <Input
            label="Descrição do Orçamento*"
            placeholder="Ex: Reparo de ótica — kit A"
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Valor (BRL)*"
              placeholder="Ex: 1.500,00"
              value={
                draft.amount === ""
                  ? ""
                  : formatMoneyInput(draft.amount as number)
              }
              onChange={(e) => handleAmountChange(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium mb-1">Status*</label>
              <select
                className="w-full h-11 px-4 rounded-lg bg-plate dark:bg-plate-dark neumorphic-concave focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={currentStatus}
                onChange={(e) =>
                  set("status", e.target.value as BudgetDraft["status"])
                }
              >
                {/* Valor interno "aberta" com rótulo "Em espera" */}
                <option value="aberta">Em espera</option>
                <option value="ganha">Ganha</option>
                <option value="perdida">Perdida</option>
                {/* Novo status: Encerrado (interno "terminado"), última opção */}
                <option
                  value="terminado"
                  style={{ fontWeight: "bold", color: "#dc2626" }}
                >
                  Encerrado
                </option>
              </select>
            </div>
          </div>

          {draft.status === "perdida" && (
            <Input
              label="Motivo da perda*"
              placeholder="Ex: Preço, concorrência, timing, escopo…"
              value={draft.loss_reason ?? ""}
              onChange={(e) => set("loss_reason", e.target.value)}
            />
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="default" onClick={onCancelDraft}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" onClick={onSubmitDraft}>
              {draft.id ? "Salvar alterações" : "Adicionar orçamento"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

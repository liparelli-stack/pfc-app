/*
  Código             : /src/hooks/useBudgetsKanban.ts
  Versão (.v20)      : 1.1.0
  Data/Hora          : 2025-11-28 16:00
  Autor              : FL / Execução via você EVA
  Objetivo do codigo : Hook responsável por carregar, estruturar e atualizar orçamentos
                       para o Kanban de Negócios (drag & drop por status).
  Fluxo              : OrcamentosPage -> BudgetsKanban -> useBudgetsKanban -> budgetService
  Alterações (1.1.0) :
    • Exclusão de budgets com status "terminado" do Kanban (não entram em items/columns).
    • Mapeamento de status mais resiliente a valores desconhecidos (fallback em "em_espera").
    • Mantido o refetch "silent" após atualização para evitar flicker de skeleton.
  Dependências       : React hooks, @/services/budgetService,
                       @/types/budgetKanban, @/contexts/ToastContext
*/

import { useState, useEffect, useCallback } from 'react';
import { getBudgetsForKanban, updateBudgetStatus } from '@/services/budgetService';
import {
  KanbanBudgetItem,
  KanbanColumns,
  KanbanItems,
  BudgetStatus,
} from '@/types/budgetKanban';
import { useToast } from '@/contexts/ToastContext';

/**
 * Mapeia o status "raw" do orçamento (armazenado no JSONB / back-end)
 * para o status usado nas colunas do Kanban.
 *
 * - "aberta"  -> "em_espera"
 * - "ganha"   -> "ganha"
 * - "perdida" -> "perdida"
 * - qualquer outro valor (defensivo) -> "em_espera"
 */
const mapRawStatusToKanban = (status: string | null | undefined): BudgetStatus => {
  if (status === 'aberta') return 'em_espera';
  if (status === 'ganha') return 'ganha';
  if (status === 'perdida') return 'perdida';

  // Fallback defensivo: status desconhecido volta para "em_espera"
  return 'em_espera';
};

/**
 * Mapeia o status do Kanban de volta para o status "raw" persistido no JSONB.
 */
export const mapKanbanStatusToRaw = (
  status: BudgetStatus
): 'aberta' | 'ganha' | 'perdida' => {
  if (status === 'em_espera') return 'aberta';
  return status;
};

interface FetchOptions {
  silent?: boolean;
}

export function useBudgetsKanban() {
  const [items, setItems] = useState<KanbanItems>({});
  const [columns, setColumns] = useState<KanbanColumns>({
    em_espera: [],
    ganha: [],
    perdida: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const fetchData = useCallback(
    async (options?: FetchOptions) => {
      const silent = options?.silent ?? false;

      if (!silent) {
        setLoading(true);
      }

      setError(null);

      try {
        const rawData = await getBudgetsForKanban();
        const newItems: KanbanItems = {};
        const newColumns: KanbanColumns = { em_espera: [], ganha: [], perdida: [] };

        rawData.forEach((rawItem) => {
          const budget = rawItem.budget;

          // ⛔ EXCLUIR orçamento "terminado" do Kanban
          if (budget.status === 'terminado') {
            return;
          }

          const itemId = `${rawItem.chat_id}-${budget.id}`;
          const status = mapRawStatusToKanban(budget.status);

          newItems[itemId] = {
            id: itemId,
            chatId: rawItem.chat_id,
            budgetId: budget.id,
            companyName: rawItem.company_name,
            subject: rawItem.chat_subject,
            description: budget.description,
            amount: budget.amount,
            status,
            lossReason: budget.loss_reason || null,
            createdAt: budget.created_at,
            updatedAt: budget.updated_at,
          };

          if (newColumns[status]) {
            newColumns[status].push(itemId);
          }
        });

        setItems(newItems);
        setColumns(newColumns);
      } catch (err: any) {
        const message = err?.message || 'Erro desconhecido';
        setError(message);
        addToast(message || 'Falha ao carregar orçamentos.', 'error');
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [addToast]
  );

  useEffect(() => {
    // Primeiro carregamento com skeleton
    fetchData();
  }, [fetchData]);

  const updateBudget = useCallback(
    async (
      chatId: string,
      budgetId: string,
      newStatus: 'aberta' | 'ganha' | 'perdida',
      lossReason?: string | null
    ) => {
      try {
        await updateBudgetStatus(chatId, budgetId, newStatus, lossReason);
        addToast('Status do orçamento atualizado!', 'success');
        // Atualiza dados sem acionar skeleton (evita flicker durante drag & drop)
        await fetchData({ silent: true });
      } catch (err: any) {
        addToast(err?.message || 'Falha ao atualizar o status.', 'error');
        throw err; // continua permitindo rollback no componente
      }
    },
    [addToast, fetchData]
  );

  return { items, columns, loading, error, refetch: fetchData, updateBudget };
}

/*
  Código             : /src/services/budgetService.ts
  Versão (.v20)      : 2.0.0
  Data/Hora          : 2025-11-28 21:45 America/Sao_Paulo
  Autor              : FL / Execução via você EVA
  Objetivo do codigo : Serviço de orçamentos utilizado pelo Kanban de Negócios,
                       responsável por:
                       • Listar orçamentos em formato flatten (RawBudgetItem) para o
                         Kanban (getBudgetsForKanban).
                       • Atualizar o status de um orçamento específico dentro do array
                         budgets armazenado em chats (updateBudgetStatus).
  Fluxo              : OrcamentosPage
                       -> BudgetsKanban
                       -> useBudgetsKanban
                       -> budgetService.getBudgetsForKanban / updateBudgetStatus
                       -> Supabase (vw_kanban_user_budgets / chats.budgets)
  Alterações (2.0.0) :
    • Fonte de dados do Kanban alterada de chats (tabela direta) para a view
      vw_kanban_user_budgets, eliminando o vazamento de orçamentos entre usuários
      do mesmo tenant.
    • View vw_kanban_user_budgets baseada em c.author_user_id = app.current_profile_id(),
      garantindo escopo por usuário a partir do JWT + RLS.
    • getBudgetsForKanban passa a consumir campos já “explodidos” da view
      (budget_id, budget_amount, budget_status, etc.), em vez de iterar diretamente
      sobre o array JSONB budgets da tabela chats.
    • Mantida a assinatura externa de getBudgetsForKanban (retorno RawBudgetItem[]),
      preservando compatibilidade com useBudgetsKanban e BudgetsKanban.
    • Mantida a lógica de updateBudgetStatus atualizando o array budgets em chats,
      sem alteração de contrato nem de comportamento.
  Dependências       : Supabase client (@/lib/supabaseClient),
                       vw_kanban_user_budgets (view SQL),
                       Tabela chats (campo budgets),
                       Chamadores: useBudgetsKanban / BudgetsKanban
*/


import { supabase } from '@/lib/supabaseClient';

export interface RawBudgetItem {
  chat_id: string;
  company_name: string;
  contact_name: string;
  chat_subject: string;
  budget: {
    id: string;
    amount: number;
    status: 'aberta' | 'ganha' | 'perdida';
    created_at: string;
    updated_at: string;
    description: string;
    loss_reason?: string;
  };
}

// Agora lê da view segura vw_kanban_user_budgets
export const getBudgetsForKanban = async (): Promise<RawBudgetItem[]> => {
  const { data, error } = await supabase
    .from('vw_kanban_user_budgets')
    .select(`
      chat_id,
      company_name,
      contact_name,
      chat_subject,
      budget_id,
      budget_amount,
      budget_status,
      budget_created_at,
      budget_updated_at,
      budget_description,
      budget_loss_reason
    `);

  if (error) {
    console.error('Error fetching budgets from view vw_kanban_user_budgets:', error);
    throw new Error('Falha ao carregar orçamentos.');
  }

  if (!data) {
    return [];
  }

  const flattenedBudgets: RawBudgetItem[] = [];

  (data as any[]).forEach((row) => {
    if (!row.budget_id) return;

    flattenedBudgets.push({
      chat_id: row.chat_id,
      company_name: row.company_name || 'Empresa não encontrada',
      contact_name: row.contact_name || 'Contato não encontrado',
      chat_subject: row.chat_subject || 'Ação sem assunto',
      budget: {
        id: row.budget_id,
        amount: Number(row.budget_amount) || 0,
        status: (row.budget_status as 'aberta' | 'ganha' | 'perdida') ?? 'aberta',
        created_at: row.budget_created_at,
        updated_at: row.budget_updated_at,
        description: row.budget_description,
        loss_reason: row.budget_loss_reason,
      },
    });
  });

  return flattenedBudgets;
};

export const updateBudgetStatus = async (
  chatId: string,
  budgetId: string,
  newStatus: 'aberta' | 'ganha' | 'perdida',
  lossReason?: string | null
) => {
  // 1. Fetch the chat and its budgets array
  const { data: chat, error: fetchError } = await supabase
    .from('chats')
    .select('budgets')
    .eq('id', chatId)
    .single();

  if (fetchError) {
    console.error('Error fetching chat to update budget:', fetchError);
    throw new Error('Falha ao carregar o chat para atualização.');
  }

  if (!chat || !Array.isArray(chat.budgets)) {
    throw new Error('Orçamentos não encontrados para este chat.');
  }

  // 2. Find and update the specific budget in the array
  let budgetFound = false;
  const updatedBudgets = chat.budgets.map((budget: any) => {
    if (budget.id === budgetId) {
      budgetFound = true;
      return {
        ...budget,
        status: newStatus,
        updated_at: new Date().toISOString(),
        loss_reason: newStatus === 'perdida' ? lossReason : null,
      };
    }
    return budget;
  });

  if (!budgetFound) {
    throw new Error('Orçamento específico não encontrado dentro do chat.');
  }

  // 3. Persist the modified budgets array back to the chats table
  const { error: updateError } = await supabase
    .from('chats')
    .update({ budgets: updatedBudgets })
    .eq('id', chatId);

  if (updateError) {
    console.error('Error updating budget status in chat:', updateError);
    throw new Error('Falha ao atualizar o status do orçamento.');
  }
};

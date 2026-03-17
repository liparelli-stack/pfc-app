export type BudgetStatus = 'em_espera' | 'ganha' | 'perdida';

export interface KanbanBudgetItem {
  id: string; // Unique ID for dnd, e.g., `${chatId}-${budgetId}`
  chatId: string;
  budgetId: string;
  companyName: string;
  subject: string;
  description: string;
  amount: number;
  status: BudgetStatus;
  lossReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type KanbanColumns = Record<BudgetStatus, string[]>;

export type KanbanItems = Record<string, KanbanBudgetItem>;

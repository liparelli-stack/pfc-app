/*
  Código             : /src/components/budgets/BudgetColumn.tsx
  Versão (.v20)      : 0.3.2
  Data/Hora          : 2025-11-28 18:40 America/Sao_Paulo
  Autor              : FL / Execução via você EVA
  Objetivo do codigo : Coluna do Kanban com plate fixo ampliado (5× maior).
  Fluxo              : BudgetsKanban -> BudgetColumn -> BudgetCard
  Alterações (0.3.2) :
    • [LAYOUT] min-h amplificada para ~2000px (5× maior),
      garantindo um plate robusto e estável visualmente.
  Dependências       : dnd-kit, BudgetCard
*/

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanBudgetItem, BudgetStatus } from '@/types/budgetKanban';
import BudgetCard from './BudgetCard';

interface BudgetColumnProps {
  id: BudgetStatus;
  label: string;
  items: KanbanBudgetItem[];
  color: string;
  editingCardId: string | null;
  onEditRequest: (id: string) => void;
  onSaveLossReason: (item: KanbanBudgetItem, reason: string) => void;
  onCancelEdit: () => void;
}

// Helper
const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const BudgetColumn: React.FC<BudgetColumnProps> = ({
  id,
  label,
  items,
  color,
  editingCardId,
  onEditRequest,
  onSaveLossReason,
  onCancelEdit,
}) => {
  const { setNodeRef } = useDroppable({ id });

  const totalAmount = items.reduce((sum, item) => sum + (item.amount ?? 0), 0);

  return (
    <div
      className="
        w-[360px] flex flex-col bg-plate dark:bg-dark-s1 
        p-4 rounded-2xl neumorphic-convex
        min-h-[2000px]   /* <<< altura fixada 5× maior */
      "
    >
      <header
        className="mb-4 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-lg flex justify-between items-center gap-2"
        style={{ backgroundColor: color }}
      >
        <span>{label} ({items.length})</span>
        <span className="text-xs md:text-sm font-bold">
          {formatCurrency(totalAmount)}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className="space-y-4 min-h-[150px] p-1 -m-1"
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <BudgetCard
              key={item.id}
              item={item}
              isEditing={editingCardId === item.id}
              onEditRequest={onEditRequest}
              onSaveLossReason={onSaveLossReason}
              onCancelEdit={onCancelEdit}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
};

export default BudgetColumn;

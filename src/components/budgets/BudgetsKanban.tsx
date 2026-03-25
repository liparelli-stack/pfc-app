/*
  Código             : /src/components/budgets/BudgetsKanban.tsx
  Versão (.v20)      : 0.1.0
  Data/Hora          : 2025-11-18 00:00
  Autor              : FL / Execução via você EVA
  Objetivo do codigo : Componente principal do Kanban de Orçamentos (drag & drop por status)
  Fluxo              : OrcamentosPage -> BudgetsKanban -> BudgetColumn -> BudgetCard
  Alterações (0.1.0) :
    • Inclusão de cabeçalho padrão de código.
    • Nenhuma alteração de layout ou lógica aplicada neste arquivo.
  Dependências       : useBudgetsKanban, mapKanbanStatusToRaw, BudgetColumn, BudgetCard, ToastContext, dnd-kit
*/

import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useBudgetsKanban, mapKanbanStatusToRaw } from '@/hooks/useBudgetsKanban';
import BudgetColumn from './BudgetColumn';
import BudgetCard from './BudgetCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { BudgetStatus, KanbanBudgetItem, KanbanItems, KanbanColumns } from '@/types/budgetKanban';
import { useToast } from '@/contexts/ToastContext';
import { playWinSound } from '@/lib/soundPlayer';

const STAGE_CONFIG: Record<BudgetStatus, { label: string; color: string }> = {
  em_espera: { label: 'Em Espera', color: '#DA8200' },
  ganha: { label: 'Ganha', color: '#047857' },
  perdida: { label: 'Perdida', color: '#BE123C' },
};

const COLUMN_ORDER: BudgetStatus[] = ['em_espera', 'ganha', 'perdida'];

const BudgetsKanban: React.FC = () => {
  const { items, columns, loading, error, updateBudget, refetch } = useBudgetsKanban();
  const { addToast } = useToast();

  const [localItems, setLocalItems] = useState<KanbanItems>(items);
  const [localColumns, setLocalColumns] = useState<KanbanColumns>(columns);
  const [activeItem, setActiveItem] = useState<KanbanBudgetItem | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  useEffect(() => {
    setLocalItems(items);
    setLocalColumns(columns);
    if (editingCardId && !items[editingCardId]) {
      setEditingCardId(null);
    }
  }, [items, columns, editingCardId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setEditingCardId(null);
    setActiveItem(localItems[event.active.id as string] ?? null);
  };

  const handleSaveLossReason = useCallback(async (item: KanbanBudgetItem, reason: string) => {
    if (reason.trim().split(/\s+/).length < 3) {
      addToast('O motivo da perda deve ter pelo menos 3 palavras.', 'warning');
      return;
    }
    
    try {
      const newStatus = 'perdida';
      if (item.status !== newStatus) {
        setLocalColumns(prev => {
          const sourceItems = prev[item.status]?.filter(id => id !== item.id) ?? [];
          const destItems = [...(prev[newStatus] ?? []), item.id];
          return { ...prev, [item.status]: sourceItems, [newStatus]: destItems };
        });
      }
      
      await updateBudget(item.chatId, item.budgetId, 'perdida', reason);
      addToast('Orçamento atualizado com motivo da perda.', 'success');
      setEditingCardId(null);
    } catch {
      addToast('Falha ao salvar motivo da perda.', 'error');
      refetch();
    }
  }, [addToast, updateBudget, refetch]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeItemData = localItems[activeId];
    if (!activeItemData) return;

    const sourceColumn = activeItemData.status;
    
    // Robustly determine the destination column
    let destColumn: BudgetStatus | undefined;
    const overIsAColumn = ['em_espera', 'ganha', 'perdida'].includes(overId);
    if (overIsAColumn) {
      destColumn = overId as BudgetStatus;
    } else {
      const overItem = localItems[overId];
      if (overItem) {
        destColumn = overItem.status;
      }
    }

    if (!destColumn) {
      return;
    }

    // Reordering within the same column
    if (sourceColumn === destColumn) {
      const itemsInColumn = localColumns[sourceColumn];
      const oldIndex = itemsInColumn.indexOf(activeId);
      const newIndex = itemsInColumn.indexOf(overId);
      
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setLocalColumns((prev) => ({
          ...prev,
          [sourceColumn]: arrayMove(itemsInColumn, oldIndex, newIndex),
        }));
      }
      return;
    }

    // Moving between columns
    const originalColumns = { ...localColumns };
    const sourceItems = originalColumns[sourceColumn] ?? [];
    const destItems = originalColumns[destColumn] ?? [];

    // Remove from source
    const newSourceItems = sourceItems.filter((id) => id !== activeId);
    
    // Add to destination at the correct position
    const overIndex = destItems.indexOf(overId);
    const newDestItems = [...destItems];
    if (overIndex !== -1) {
      newDestItems.splice(overIndex, 0, activeId);
    } else {
      newDestItems.push(activeId);
    }

    setLocalColumns({
      ...originalColumns,
      [sourceColumn]: newSourceItems,
      [destColumn]: newDestItems,
    });

    setLocalItems(prev => ({
      ...prev,
      [activeId]: { ...prev[activeId], status: destColumn, lossReason: destColumn !== 'perdida' ? null : prev[activeId].lossReason },
    }));

    if (destColumn === 'perdida') {
      setEditingCardId(activeId);
      return;
    }
    
    if (destColumn === 'ganha') {
      playWinSound();
    }

    try {
      const newLossReason = destColumn === 'perdida' ? activeItemData.lossReason : null;
      await updateBudget(activeItemData.chatId, activeItemData.budgetId, mapKanbanStatusToRaw(destColumn), newLossReason);
    } catch {
      setLocalColumns(originalColumns);
      setLocalItems(items);
    }
  }, [localItems, localColumns, updateBudget, items, addToast, refetch]);

  if (loading) {
    return (
      <div className="flex gap-6 h-full">
        <Skeleton className="w-[360px] h-full rounded-2xl" />
        <Skeleton className="w-[360px] h-full rounded-2xl" />
        <Skeleton className="w-[360px] h-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500">{error}</div>;
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveItem(null)}
      >
        <div className="h-full overflow-x-auto pb-4">
          <div className="flex gap-6 min-w-max h-full">
            {COLUMN_ORDER.map((stageKey) => (
              <BudgetColumn
                key={stageKey}
                id={stageKey}
                label={STAGE_CONFIG[stageKey].label}
                items={(localColumns[stageKey] || []).map(id => localItems[id]).filter(Boolean)}
                color={STAGE_CONFIG[stageKey].color}
                editingCardId={editingCardId}
                onEditRequest={setEditingCardId}
                onCancelEdit={() => setEditingCardId(null)}
                onSaveLossReason={handleSaveLossReason}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeItem ? (
            <BudgetCard
              item={activeItem}
              isOverlay
              isEditing={false}
              onEditRequest={() => {}}
              onSaveLossReason={() => {}}
              onCancelEdit={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
};

export default BudgetsKanban;

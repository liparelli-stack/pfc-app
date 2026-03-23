import React, { useState, useEffect, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { KanbanBudgetItem } from '@/types/budgetKanban';
import clsx from 'clsx';
import { Pencil, MessageSquareWarning, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// --- Helpers ---
const formatCurrency = (value?: number) => {
  if (typeof value !== 'number') return 'R$ -';
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Data desconhecida';
  try {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch {
    return dateString;
  }
};

const SOFT_COLORS = [
  '#E0E7FF', '#DBEAFE', '#CFFAFE', '#D1FAE5', '#F0FDF4',
  '#FEFCE8', '#FFF7ED', '#FCE7F3', '#F3E8FF',
];

const generateColorFromString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash % SOFT_COLORS.length);
  return SOFT_COLORS[index];
};

interface BudgetCardProps {
  item: KanbanBudgetItem;
  isOverlay?: boolean;
  isEditing: boolean;
  onEditRequest: (id: string) => void;
  onSaveLossReason: (item: KanbanBudgetItem, reason: string) => void;
  onCancelEdit: () => void;
}

const BudgetCard: React.FC<BudgetCardProps> = ({ 
  item, isOverlay = false, isEditing, 
  onEditRequest, onSaveLossReason, onCancelEdit 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { type: 'BudgetCard', item },
    disabled: isEditing,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const cardColor = generateColorFromString(item.companyName);

  const [reason, setReason] = useState(item.lossReason || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      setReason(item.lossReason || '');
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isEditing, item.lossReason]);

  const handleSave = () => {
    onSaveLossReason(item, reason);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onCancelEdit();
    }
  };

  const renderDisplayView = () => (
    <>
      <div className="flex justify-between items-start">
        <h4 className="font-bold text-gray-800 dark:text-dark-t1 pr-2 flex-1 break-words">
          {item.description || 'Orçamento sem descrição'}
        </h4>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEditRequest(item.id);
          }}
          className="p-1 rounded-full text-gray-500 hover:bg-black/10 transition-colors"
          aria-label="Editar motivo da perda"
          title="Editar motivo da perda"
        >
          <Pencil size={16} />
        </button>
      </div>

      <p className="text-sm text-gray-600 dark:text-dark-t2 mt-1">{item.companyName}</p>
      <p className="text-xs text-gray-500 dark:text-dark-t2 mt-1">{item.subject}</p>

      {item.status === 'perdida' && (
        <div className="mt-2 p-2 rounded-lg bg-red-100/50 dark:bg-red-900/20 text-red-700 dark:text-red-200 text-xs flex items-start gap-2">
          <MessageSquareWarning size={16} className="flex-shrink-0 mt-0.5" />
          {item.lossReason ? (
            <p className="break-words">{item.lossReason}</p>
          ) : (
            <p className="font-semibold">Motivo da perda obrigatório.</p>
          )}
        </div>
      )}

      <div className="flex justify-between items-end mt-4">
        <span className="font-bold text-lg text-gray-800 dark:text-dark-t1">
          {formatCurrency(item.amount)}
        </span>
        <span className="text-xs text-gray-400 dark:text-dark-t2">
          {formatDate(item.updatedAt)}
        </span>
      </div>
    </>
  );

  const renderEditView = () => (
    <div className="flex flex-col h-full">
      <h4 className="font-bold text-gray-800 dark:text-dark-t1 mb-2 text-sm">
        Motivo da Perda
      </h4>
      <textarea
        ref={textareaRef}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        className="w-full p-2 text-sm rounded-lg bg-white/80 dark:bg-dark-s1/80 neumorphic-concave focus:outline-none focus:ring-2 focus:ring-primary/50"
        placeholder="Descreva o motivo (mín. 3 palavras)..."
      />
      <div className="flex justify-end gap-2 mt-2">
        <Button onClick={onCancelEdit} variant="default" className="!p-2 h-8 w-8">
          <X size={16} />
        </Button>
        <Button onClick={handleSave} variant="primary" className="!p-2 h-8 w-8">
          <Check size={16} />
        </Button>
      </div>
    </div>
  );

  return (
    <motion.div
      ref={setNodeRef}
      style={{ ...style, backgroundColor: isDragging ? '#f3f4f6' : cardColor }}
      {...attributes}
      {...listeners}
      layoutId={isOverlay ? undefined : item.id}
      className={clsx(
        'p-4 rounded-2xl neumorphic-convex relative',
        !isOverlay && !isEditing && 'cursor-grab active:cursor-grabbing',
        isDragging && !isOverlay && 'opacity-50',
        isOverlay && 'shadow-2xl rotate-3 cursor-grabbing',
        isEditing && 'ring-2 ring-primary'
      )}
    >
      {isEditing ? renderEditView() : renderDisplayView()}
    </motion.div>
  );
};

export default BudgetCard;

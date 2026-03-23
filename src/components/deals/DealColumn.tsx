/*
===============================================================================
Arquivo: src/contexts/AuthContext.tsx
Versão: 2.0.0 Estavel
Autor: Recuperado por FL - EVA
Objetivo:
 Dependências: 
===============================================================================
*/

import React from 'react';
import { DealWithRelations } from '@/types/deal';
import DealCard from './DealCard';

interface DealColumnProps {
  stage: string;
  deals: DealWithRelations[];
  onDrop: (dealId: string, newStage: any) => void;
  onEditDeal: (deal: DealWithRelations) => void;
  refreshDeals: () => void;
}

const DealColumn: React.FC<DealColumnProps> = ({ stage, deals, onDrop, onEditDeal, refreshDeals }) => {
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('dealId');
    if (dealId) onDrop(dealId, stage as any);
  };

  return (
    <div
      className="w-[360px] flex-shrink-0 rounded-2xl p-3 neumorphic-convex bg-plate dark:bg-dark-s1"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold">{stage}</h3>
        <span className="text-xs opacity-70">{deals.length}</span>
      </div>
      <div className="space-y-3">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onEdit={onEditDeal} refreshDeals={refreshDeals} />
        ))}
      </div>
    </div>
  );
};
export default DealColumn;

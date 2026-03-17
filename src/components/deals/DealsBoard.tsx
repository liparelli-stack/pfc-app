/*
-- ===================================================
-- Código: /src/components/deals/DealsBoard.tsx
-- Versão: 2.0.0
-- Data/Hora: Recuperadopor Fernando
-- Autor: Dualite Alpha (AD)
-- Objetivo: Quadro Kanban para visualizar e organizar Oportunidades (Deals).
-- Fluxo: Renderizado por DealsPage.tsx.
-- Dependências: react, framer-motion, @/types/deal, DealColumn
-- ===================================================
*/

import React from 'react';
import { DealWithRelations, DEAL_PIPELINE_STAGES } from '@/types/deal';
import DealColumn from './DealColumn';
import * as dealsService from '@/services/dealsService';
import { useToast } from '@/contexts/ToastContext';

interface DealsBoardProps {
  deals: DealWithRelations[];
  onEditDeal: (deal: DealWithRelations) => void;
  refreshDeals: () => void;
}

const DealsBoard: React.FC<DealsBoardProps> = ({ deals, onEditDeal, refreshDeals }) => {
  const { addToast } = useToast();

  const handleDragEnd = async (dealId: string, newStage: (typeof DEAL_PIPELINE_STAGES)[number]) => {
    try { await dealsService.updatePipelineStage(dealId, newStage); addToast('Oportunidade movida com sucesso!', 'success'); refreshDeals(); }
    catch (error: any) { addToast(error.message || 'Falha ao mover oportunidade.', 'error'); }
  };

  return (
    <div className="flex-1 overflow-x-auto pb-4">
      <div className="flex gap-6 min-w-max h-full">
        {DEAL_PIPELINE_STAGES.map(stage => (
          <DealColumn
            key={stage}
            stage={stage}
            deals={deals.filter(d => d.pipeline_stage === stage)}
            onDrop={handleDragEnd}
            onEditDeal={onEditDeal}
            refreshDeals={refreshDeals}
          />
        ))}
      </div>
    </div>
  );
};
export default DealsBoard;

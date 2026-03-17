/*
-- ===================================================
-- Código             : /src/components/vision360/HistoryAndOpportunities.tsx
-- Versão (.v21)      : 1.0.1
-- Data/Hora          : 2025-11-05 18:22 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Exibir o card "Visão Atual e Histórica" na Visão 360,
--                      reaproveitando o ConversationHistoryCard em modo somente leitura.
-- Fluxo              : Vision360Page → HistoryAndOpportunities (readOnly)
-- Alterações (1.0.1) :
--   • Correção de import: ConversationHistoryCard como default import.
-- Dependências        : react, @/components/cockpit/ConversationHistoryCard,
--                       @/types/vision360, lucide-react
-- ===================================================
*/

import React from 'react';
import ConversationHistoryCard from '@/components/cockpit/ConversationHistoryCard';
import { CompanyDetails } from '@/types/vision360';
import { Clock } from 'lucide-react';

type Props = {
  companyId: string;
  companyDetails?: CompanyDetails;
};

const HistoryAndOpportunities: React.FC<Props> = ({ companyId, companyDetails }) => {
  if (!companyId) {
    return (
      <section className="bg-plate dark:bg-plate-dark rounded-2xl p-6 neumorphic-convex text-center text-gray-500 dark:text-gray-400">
        <p>Nenhuma empresa selecionada para exibir histórico.</p>
      </section>
    );
  }

  return (
    <section className="bg-plate dark:bg-plate-dark rounded-2xl p-6 neumorphic-convex space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-primary" />
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white">
            Visão Atual e Histórica
          </h3>
        </div>
        {companyDetails?.trade_name && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {companyDetails.trade_name}
          </span>
        )}
      </header>

      <div className="border-t border-dark-shadow dark:border-dark-dark-shadow pt-4">
        <ConversationHistoryCard
          companyId={companyId}
          readOnly={true}
        />
      </div>
    </section>
  );
};

export default HistoryAndOpportunities;

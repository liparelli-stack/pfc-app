/*
-- ===================================================
-- Código: /src/pages/SupportPage.tsx
-- Versão: 1.0.0
-- Data/Hora: 2025-11-05 11:10
-- Autor: FL / Execução via Dualite Alpha (AD)
-- Objetivo: Página principal do módulo de Suporte.
-- Fluxo: Gerencia a exibição da lista, formulário e detalhes dos tickets.
-- Dependências: React, componentes de UI e do módulo de Suporte.
-- ===================================================
*/
import React, { useState, useCallback } from 'react';
import { listTickets } from '@/services/ticketsService';
import { TicketWithRelations } from '@/types/ticket';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';
import TicketList from '@/components/support/TicketList';
import TicketForm from '@/components/support/TicketForm';
import TicketDetailView from '@/components/support/TicketDetailView';

type ViewMode = 'list' | 'create' | 'detail';

const SupportPage: React.FC = () => {
  const [view, setView] = useState<ViewMode>('list');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTicketSelect = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setView('detail');
  };

  const handleBackToList = () => {
    setSelectedTicketId(null);
    setView('list');
  };

  const handleCreateNew = () => {
    setSelectedTicketId(null);
    setView('create');
  };

  const handleSave = () => {
    setView('list');
    setRefreshKey(prev => prev + 1); // Força o refresh da lista
  };

  const renderContent = () => {
    switch (view) {
      case 'create':
        return <TicketForm onSave={handleSave} onCancel={handleBackToList} />;
      case 'detail':
        return <TicketDetailView ticketId={selectedTicketId!} onBack={handleBackToList} />;
      case 'list':
      default:
        return (
          <>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Meus Chamados</h1>
              <Button onClick={handleCreateNew} variant="primary">
                <Plus className="h-5 w-5 mr-2" />
                Abrir Chamado
              </Button>
            </div>
            <TicketList onTicketSelect={handleTicketSelect} key={refreshKey} />
          </>
        );
    }
  };

  return <div className="space-y-6">{renderContent()}</div>;
};

export default SupportPage;

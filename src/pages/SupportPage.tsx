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
              <h1 className="text-3xl font-bold text-gray-800 dark:text-dark-t1">Meus Chamados</h1>
              <button
                onClick={handleCreateNew}
                style={{ display: 'inline-flex', flexDirection: 'row', alignItems: 'center', gap: '8px', background: '#3b68f5', color: '#ffffff', border: '0.5px solid rgba(59,104,245,0.38)', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', boxShadow: '0 1px 8px rgba(59,104,245,0.35)' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 4.5v7M4.5 8h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span>Abrir Chamado</span>
              </button>
            </div>
            <TicketList onTicketSelect={handleTicketSelect} key={refreshKey} />
          </>
        );
    }
  };

  return <div className="space-y-6">{renderContent()}</div>;
};

export default SupportPage;

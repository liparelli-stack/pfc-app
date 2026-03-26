/*
-- ===================================================
-- Código             : src/pages/ChatAnalysisPage.tsx
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2026-03-26 14:30 America/Sao_Paulo
-- Autor              : FL / Execução via Eva (Claude)
-- Objetivo do código : Acompanhamento de Chats — tela de consulta detalhada para ADM/Gestor
--                      visualizar TODOS os chats do tenant com filtros extras.
--                      Reutiliza ConversationHistoryCard em modo readonly.
-- Fluxo              : HubGestaoPage → ChatAnalysisPage → ConversationHistoryCard (readonly)
-- Dependências       : ConversationHistoryCard, ChatAnalysisFilters, react
-- ===================================================
*/

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import ConversationHistoryCard from '@/components/cockpit/ConversationHistoryCard';
import { ChatAnalysisFilters } from '@/components/chat-analysis/ChatAnalysisFilters';

/* ============================================================
   Tipos
   ============================================================ */
export interface ChatFilters {
  salespersonId?: string;
  companyId?: string;
  subject?: string;
  dateFrom?: string;
  dateTo?: string;
}

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
/** Retorna true se pelo menos 1 filtro tem valor preenchido */
function hasActiveFilters(f: ChatFilters): boolean {
  return Object.values(f).some((v) => v !== undefined && v !== '');
}

const ChatAnalysisPage: React.FC = () => {
  const [filters, setFilters] = useState<ChatFilters>({});

  const filtersActive = hasActiveFilters(filters);

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="neumorphic-convex rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-primary mb-2">
          Acompanhamento de Chats
        </h1>
        <p className="text-sm text-muted-foreground">
          Visualização completa de todos os chats do time — Filtros: Pessoas, Período, Empresa, Assunto
        </p>
      </div>

      {/* Filtros */}
      <ChatAnalysisFilters
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Resultado: só renderiza (e busca) quando há filtro ativo */}
      {filtersActive ? (
        <div className="neumorphic-convex rounded-2xl p-6">
          <ConversationHistoryCard
            companyId={null}
            readOnly={true}
            showAllChats={true}
            showPagination={true}
            externalFilters={filters}
          />
        </div>
      ) : (
        <div className="neumorphic-convex rounded-2xl p-10 flex flex-col items-center gap-3 text-center">
          <Search className="h-10 w-10 text-muted-foreground opacity-40" />
          <p className="text-sm font-medium text-muted-foreground">
            Selecione pelo menos um filtro para visualizar os chats
          </p>
        </div>
      )}
    </div>
  );
};

export default ChatAnalysisPage;

/*
-- ===================================================
-- Código             : /src/pages/Vision360Page.tsx
-- Versão (.v20)      : 1.2.1
-- Data/Hora          : 2025-11-12 16:20 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Página Visão 360 com faixa de Insights rápidos (a partir de `chats`)
--                      posicionada antes do Histórico em modo somente leitura.
-- Fluxo              : Visão 360 → Filtro Cliente → CustomerDetailsCard → InsightsStrip → ConversationHistoryCard(showEdit=false)
-- Alterações (1.2.1) :
--   • [FIX] Removido import e uso de HistoryAndOpportunities (inativo).
--   • [READ-ONLY] Passado showEdit={false} para ConversationHistoryCard na Visão 360.
--   • [SAFE] Cockpit não é afetado (prop tem default true fora daqui).
-- Alterações (1.2.0) :
--   • Inserido InsightsStrip entre CustomerDetailsCard e histórico.
-- Dependências       : @/components/vision360/{InsightsStrip,CustomerDetailsCard}, @/components/cockpit/ConversationHistoryCard,
--                      @/services/vision360Service, tipos e UI base.
-- ===================================================
*/

import React, { useState, useCallback } from 'react';
import { searchCompanies, getCustomerDetails } from '@/services/vision360Service';
import { CustomerDetails } from '@/types/vision360';
import { Company } from '@/types/company';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import CustomerDetailsCard from '@/components/vision360/CustomerDetailsCard';
import InsightsStrip from '@/components/vision360/InsightsStrip';
import ConversationHistoryCard from '@/components/cockpit/ConversationHistoryCard'; // << substitui HistoryAndOpportunities
import { Search } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

const Vision360Page: React.FC = () => {
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Company[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const data = await searchCompanies(query);
      setSuggestions(data);
      setShowSuggestions(data.length > 0);
    } catch {
      // Erro silencioso no autocomplete
    }
  }, []);

  const handleSelectCompany = useCallback(
    async (companyId: string) => {
      setShowSuggestions(false);
      setIsLoading(true);
      setCustomerDetails(null);
      try {
        const details = await getCustomerDetails(companyId);
        setCustomerDetails(details);
        if (!details) {
          addToast('Cliente não encontrado ou sem detalhes.', 'warning');
        }
      } catch (error) {
        addToast('Erro ao carregar detalhes do cliente.', 'error');
      } finally {
        setIsLoading(false);
      }
    },
    [addToast]
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-dark-t1">Visão 360 do Cliente</h1>

      {/* Filtro de Cliente */}
      <section className="neumorphic-convex rounded-2xl p-4 sm:p-6">
        <div className="relative max-w-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            label="Buscar Cliente"
            placeholder="Digite o nome do cliente..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              fetchSuggestions(e.target.value);
            }}
            className="pl-12"
          />
          {showSuggestions && (
            <div className="absolute z-10 w-full mt-1 bg-plate dark:bg-dark-s1 rounded-lg neumorphic-convex shadow-lg max-h-60 overflow-y-auto">
              {suggestions.map((company) => (
                <div
                  key={company.id}
                  onClick={() => {
                    setSearchTerm(company.trade_name || '');
                    handleSelectCompany(company.id!);
                  }}
                  className="p-3 cursor-pointer hover:bg-dark-shadow dark:hover:bg-dark-dark-shadow"
                >
                  <p className="font-semibold">{company.trade_name}</p>
                  <p className="text-sm text-gray-500">{company.legal_name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Card de Detalhes / Insights / Histórico */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {customerDetails && !isLoading && (
        <>
          <CustomerDetailsCard details={customerDetails} />

          {/* === INSIGHTS RÁPIDOS (mini-gráficos a partir de `chats`) === */}
          <InsightsStrip
            companyId={customerDetails.id!}
            className="neumorphic-convex rounded-2xl p-4 sm:p-6"
          />

          <div className="border-t border-dark-shadow dark:border-dark-dark-shadow my-6"></div>

          {/* Histórico somente leitura (sem lápis de edição) */}
          <ConversationHistoryCard companyId={customerDetails.id!} showEdit={false} />
        </>
      )}

      {!customerDetails && !isLoading && (
        <div className="flex items-center justify-center h-64 rounded-2xl neumorphic-convex bg-plate dark:bg-dark-s1">
          <p className="text-gray-500">Selecione um cliente para ver os detalhes.</p>
        </div>
      )}
    </div>
  );
};

export default Vision360Page;

/*
-- ===================================================
-- Código             : src/components/chat-analysis/ChatAnalysisFilters.tsx
-- Versão (.v20)      : 2.0.0
-- Data/Hora          : 2026-03-25 America/Sao_Paulo
-- Autor              : FL / Execução via Eva (Claude)
-- Objetivo do código : Barra de filtros extras para ChatAnalysisPage
--                      Filtros: Consultora, Empresa, Assunto, Data de Agendamento
-- Alterações (2.0.0) :
--   • [FEAT] Filtro "Data de Agendamento" com presets (Mês atual / Mês passado / Próximo mês)
--             e opção de período customizado (date range picker)
--   • Filtra sobre chats.calendar_at via externalFilters.dateFrom/dateTo
-- Dependências       : react, lucide-react, @/hooks/useSalespersons, @/hooks/useContacts
-- ===================================================
*/

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Users, Building2, FileText, X, Calendar } from 'lucide-react';
import { useSalespersons } from '@/hooks/useSalespersons';
import { useCompaniesLookup } from '@/hooks/useCompaniesLookup';
import FilterCombobox from '@/components/ui/FilterCombobox';
import type { ChatFilters } from '@/pages/ChatAnalysisPage';

/* ============================================================
   Helpers de data
   ============================================================ */

function padTwo(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`;
}

/** Retorna { from, to } para um mês com offset relativo ao mês atual (0 = atual, -1 = passado, 1 = próximo) */
function getMonthRange(offset: number): { from: string; to: string } {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: fmtDate(firstDay), to: fmtDate(lastDay) };
}

/* ============================================================
   Tipos
   ============================================================ */

type DatePreset = 'all' | 'current' | 'last' | 'next' | 'custom';

interface ChatAnalysisFiltersProps {
  filters: ChatFilters;
  onFiltersChange: (filters: ChatFilters) => void;
}

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
export const ChatAnalysisFilters: React.FC<ChatAnalysisFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const { salespersons, loading: loadingSales }  = useSalespersons();
  const { companies,    loading: loadingCompanies } = useCompaniesLookup();

  const salespersonOptions = useMemo(
    () => salespersons.map((sp) => ({ id: sp.id, label: sp.name })),
    [salespersons]
  );

  // companies já vem com { id: companies.id, label: trade_name } — pronto para o combobox
  const contactOptions = companies;

  const [localFilters, setLocalFilters] = useState<ChatFilters>(filters);
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');

  // Sincroniza com filtros externos (ex: reset externo)
  useEffect(() => {
    setLocalFilters(filters);
    // Se não há dateFrom/dateTo externos, reset preset
    if (!filters.dateFrom && !filters.dateTo) {
      setDatePreset('all');
      setCustomFrom('');
      setCustomTo('');
    }
  }, [filters]);

  const handleFilterChange = (key: keyof ChatFilters, value: string | undefined) => {
    const updated = { ...localFilters, [key]: value || undefined };
    setLocalFilters(updated);
    onFiltersChange(updated);
  };

  /** Aplica preset de data: calcula range e propaga via onFiltersChange */
  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);

    if (preset === 'all') {
      const updated = { ...localFilters, dateFrom: undefined, dateTo: undefined };
      setLocalFilters(updated);
      onFiltersChange(updated);
      return;
    }

    if (preset === 'custom') {
      // Mantém os campos atuais; range será aplicado pelos inputs
      return;
    }

    const offsetMap: Record<Exclude<DatePreset, 'all' | 'custom'>, number> = {
      last:    -1,
      current:  0,
      next:     1,
    };
    const { from, to } = getMonthRange(offsetMap[preset as 'last' | 'current' | 'next']);
    const updated = { ...localFilters, dateFrom: from, dateTo: to };
    setLocalFilters(updated);
    onFiltersChange(updated);
  };

  /** Aplica o período customizado somente quando ambos os campos estão preenchidos */
  const applyCustomRange = (from: string, to: string) => {
    if (!from && !to) {
      const updated = { ...localFilters, dateFrom: undefined, dateTo: undefined };
      setLocalFilters(updated);
      onFiltersChange(updated);
      return;
    }
    const updated = {
      ...localFilters,
      dateFrom: from || undefined,
      dateTo:   to   || undefined,
    };
    setLocalFilters(updated);
    onFiltersChange(updated);
  };

  const clearFilters = () => {
    const empty: ChatFilters = {};
    setLocalFilters(empty);
    onFiltersChange(empty);
    setDatePreset('all');
    setCustomFrom('');
    setCustomTo('');
  };

  const hasActiveFilters = Object.values(localFilters).some(v => v !== undefined && v !== '');

  return (
    <div className="neumorphic-convex rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
          <Search className="h-4 w-4" />
          Filtros de Busca
        </h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Limpar filtros
          </button>
        )}
      </div>

      {/* Linha 1: 4 filtros principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Filtro: Consultora */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Consultora
          </label>
          <FilterCombobox
            options={salespersonOptions}
            value={localFilters.salespersonId}
            onChange={(id) => handleFilterChange('salespersonId', id)}
            placeholder={loadingSales ? 'Carregando...' : 'Buscar consultora...'}
            disabled={loadingSales}
          />
        </div>

        {/* Filtro: Empresa */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Empresa
          </label>
          <FilterCombobox
            options={contactOptions}
            value={localFilters.companyId}
            onChange={(id) => handleFilterChange('companyId', id)}
            placeholder={loadingCompanies ? 'Carregando...' : 'Buscar empresa...'}
            disabled={loadingCompanies}
          />
        </div>

        {/* Filtro: Assunto */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Assunto
          </label>
          <input
            type="text"
            value={localFilters.subject || ''}
            onChange={(e) => handleFilterChange('subject', e.target.value)}
            placeholder="Buscar por assunto..."
            className="neumorphic-concave rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
          />
        </div>

        {/* Filtro: Data de Agendamento */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Data de Agendamento
          </label>
          <select
            value={datePreset}
            onChange={(e) => applyDatePreset(e.target.value as DatePreset)}
            className="neumorphic-concave rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
          >
            <option value="all">Todas</option>
            <option value="current">Mês atual</option>
            <option value="last">Mês passado</option>
            <option value="next">Próximo mês</option>
            <option value="custom">Período customizado</option>
          </select>
        </div>
      </div>

      {/* Linha 2: Date range picker (só visível quando preset = custom) */}
      {datePreset === 'custom' && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-light-bmd dark:border-dark-bmd">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              De
            </label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => {
                setCustomFrom(e.target.value);
                applyCustomRange(e.target.value, customTo);
              }}
              className="neumorphic-concave rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Até
            </label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => {
                setCustomTo(e.target.value);
                applyCustomRange(customFrom, e.target.value);
              }}
              className="neumorphic-concave rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
        </div>
      )}
    </div>
  );
};

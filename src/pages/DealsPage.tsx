/*
-- ===================================================
-- Código: /src/pages/DealsPage.tsx
-- Versão: 1.3.1
-- Data/Hora: 2025-11-08 10:05
-- Autor: Dualite Alpha (AD)
-- Objetivo: Renomear import de DealForm para EditDealForm.
-- ===================================================
*/
import React, { useState, useEffect, useCallback } from 'react';
import { useDeals } from '@/hooks/useDeals';
import * as profilesService from '@/services/profilesService';
import { listSimpleCompanies } from '@/services/companiesService';
import { Profile } from '@/types/profile';
import { Company } from '@/types/company';
import { DealWithRelations, DEAL_PIPELINE_STAGES, DEAL_STATUSES } from '@/types/deal';

import DealsBoard from '@/components/deals/DealsBoard';
import EditDealForm from '@/components/deals/EditDealForm'; // <-- Renomeado
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { debounce } from 'lodash-es';
import { Plus, Eraser, Archive } from 'lucide-react';

const STATUS_LABELS: Record<(typeof DEAL_STATUSES)[number], string> = {
  aberta: 'Aberta',
  ganha: 'Ganha',
  perdida: 'Perdida',
  em_espera: 'Em Espera',
};

const DealsPage: React.FC = () => {
  // Filtros enviados ao hook/serviço
  const [filters, setFilters] = useState<any>({ includeArchived: false });
  const { deals, isLoading, error, refresh } = useDeals(filters);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DealWithRelations | null>(null);

  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);

  // Bootstrap de perfil/empresas + congela responsável
  useEffect(() => {
    async function bootstrap() {
      const [me, companiesData] = await Promise.all([
        profilesService.getCurrentProfile?.() ?? profilesService.listProfiles({ status: 'active' }).then((arr) => arr?.[0]),
        listSimpleCompanies({ status: 'active' }),
      ]);
      setCurrentProfile(me ?? null);
      setCompanies(companiesData ?? []);
      if (me?.id) {
        setFilters((prev: any) => ({ ...prev, ownerId: me.id, includeArchived: false }));
      }
    }
    bootstrap();
  }, []);

  // Helpers de filtro
  const debounced = useCallback(debounce((fn: (prev: any) => any) => setFilters(fn), 300), []);
  const setFilter = (patch: Partial<any>, debounceIt = false) => {
    const fn = (prev: any) => {
      const next = { ...prev, ...patch };
      Object.keys(next).forEach((k) => {
        if (next[k] === '' || next[k] === undefined || next[k] === null) delete next[k];
      });
      // preserva ownerId “congelado”
      if (currentProfile?.id) next.ownerId = currentProfile.id;
      return next;
    };
    debounceIt ? debounced(fn) : setFilters(fn);
  };

  const resetFilters = () => {
    setFilters({
      includeArchived: false,
      ownerId: currentProfile?.id, // mantém congelado
    });
  };

  const toggleArchived = () => {
    setFilters((prev: any) => ({
      ...prev,
      includeArchived: !prev.includeArchived,
      ownerId: currentProfile?.id,
    }));
  };

  // Ações do formulário
  const openCreateForm = () => { setEditingDeal(null); setIsFormOpen(true); };
  const openEditForm = (deal: DealWithRelations) => { setEditingDeal(deal); setIsFormOpen(true); };
  const handleFormClose = () => { setIsFormOpen(false); setEditingDeal(null); };
  const handleFormSave = () => { handleFormClose(); refresh(); };

  return (
    <div className="flex flex-col h-full">
      {/* Filtros + Ações (ícones) */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 p-4 rounded-2xl neumorphic-convex bg-plate dark:bg-dark-s1">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Empresa por nome */}
          <Select label="Empresa (por nome)" onChange={(e) => setFilter({ companyName: e.target.value })}>
            <option value="">Todas</option>
            {companies.map((c) => (
              <option key={c.id} value={c.trade_name}>{c.trade_name}</option>
            ))}
          </Select>

          {/* Nome */}
          <Input
            label="Buscar por Nome"
            placeholder="Parte do nome da oportunidade…"
            onChange={(e) => setFilter({ nameQuery: e.target.value }, true)}
          />

          {/* Temperatura */}
          <Select label="Temperatura" onChange={(e) => setFilter({ temperature: e.target.value })}>
            <option value="">Todas</option>
            <option value="frio">Frio</option>
            <option value="morno">Morno</option>
            <option value="quente">Quente</option>
          </Select>

          {/* Estágio */}
          <Select label="Estágio do Funil" onChange={(e) => setFilter({ stage: e.target.value })}>
            <option value="">Todos</option>
            {DEAL_PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>

          {/* Status */}
          <Select label="Status" onChange={(e) => setFilter({ status: e.target.value ? [e.target.value] : undefined })}>
            <option value="">Todos</option>
            {DEAL_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </Select>

          {/* Responsável (congelado) */}
          <Select label="Responsável" disabled value={currentProfile?.id || ''} onChange={() => {}}>
            <option value={currentProfile?.id || ''}>{currentProfile?.full_name || 'Carregando…'}</option>
          </Select>
        </div>

        {/* Ações (ícones no final da linha) */}
        <div className="flex items-end gap-2">
          {/* Limpar filtros */}
          <Button
            variant="default"
            className="px-3 py-2"
            onClick={resetFilters}
            title="Limpar filtros"
          >
            <Eraser className="h-5 w-5" aria-hidden="true" />
          </Button>

          {/* Exibir arquivados (toggle) */}
          <Button
            variant="default"
            className={`px-3 py-2 ${filters.includeArchived ? 'ring-2 ring-offset-0 ring-blue-500' : ''}`}
            onClick={toggleArchived}
            title={filters.includeArchived ? 'Ocultar arquivados' : 'Exibir arquivados'}
          >
            <Archive className="h-5 w-5" aria-hidden="true" />
          </Button>

          {/* Nova Oportunidade (ícone) */}
          <Button
            onClick={openCreateForm}
            variant="primary"
            className="px-3 py-2"
            title="Nova Oportunidade"
          >
            <Plus className="h-5 w-5 -mt-px" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {isLoading && <p className="text-center">Carregando oportunidades...</p>}
      {error && <p className="text-center text-red-500">{error}</p>}

      {!isLoading && !error && (
        <DealsBoard deals={deals} onEditDeal={openEditForm} refreshDeals={refresh} />
      )}

      {isFormOpen && (
        <EditDealForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          onSave={handleFormSave}
          deal={editingDeal}
        />
      )}
    </div>
  );
};

export default DealsPage;

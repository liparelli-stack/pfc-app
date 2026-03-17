/*
-- ===================================================
-- Código             : /src/components/lists/PessoasListTab.tsx
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-12-04 11:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Componente principal para a aba de listagem de Pessoas.
-- Fluxo              : ListsPage -> PessoasListTab -> useUserList -> UserListTable
-- Dependências       : react, @/hooks/useUserList, ./UserListTable, @/components/shared/PaginationToolbar, @/components/ui/*
-- ===================================================
*/
import React from 'react';
import { useUserList } from '@/hooks/useUserList';
import UserListTable, { UserProfile } from '@/components/lists/UserListTable';
import PaginationToolbar from '@/components/shared/PaginationToolbar';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Profile } from '@/types/profile';

// Mapper para adaptar o tipo Profile ao esperado pela UserListTable
const mapProfileToUserList = (profile: Profile): UserProfile => ({
  id: profile.id!,
  nome: profile.full_name,
  email: profile.email,
  departamento: profile.department || 'N/A',
  tratamento: profile.salutation_pref || 'neutro',
  cargo: profile.position || 'N/A',
  funcao: profile.role || 'user',
  status: profile.status === 'active' ? 'Ativo' : 'Inativo',
  mfaHabilitado: profile.mfa_enabled || false,
  podeEditarKB: profile.kb_can_edit || false,
});

const PessoasListTab: React.FC = () => {
  const { items: profiles, total, loading, params, setPage, setPageSize, setFilters } = useUserList();

  const users = profiles.map(mapProfileToUserList);

  return (
    <div className="flex flex-col gap-4">
      <section className="neumorphic-convex rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <Input
            label="Busca"
            placeholder="Buscar por nome ou email..."
            value={params.q || ''}
            onChange={e => setFilters({ q: e.target.value })}
          />
          <Select
            label="Status"
            value={params.status || 'all'}
            onChange={e => setFilters({ status: e.target.value as any })}
          >
            <option value="all">Todos</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </Select>
        </div>
      </section>

      {total > 0 && (
        <PaginationToolbar
          page={params.page || 1}
          pageSize={(params.pageSize as 15 | 30 | 60) || 15}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          className="neumorphic-convex rounded-2xl p-3"
        />
      )}

      <UserListTable users={users} loading={loading} />
    </div>
  );
};

export default PessoasListTab;

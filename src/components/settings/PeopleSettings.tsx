/*
================================================================================
Código             : /src/components/settings/PeopleSettings.tsx
Versão (.v20)      : 5.2.0
Data/Hora          : 2025-11-17 16:30
Autor              : FL / Execução via você EVA
Objetivo           : Implementar um CRUD completo para a gestão de Pessoas,
                     com criação e edição via modal, garantindo que sempre exista
                     pelo menos 1 admin cadastrado.
Fluxo              : SettingsPage -> PeopleSettings -> PeopleTable -> AddPersonModal
Alterações (5.2.0) :
  • Regra de negócio (simples, apenas no front):
    - Ao cadastrar a primeira pessoa sem admin existente, força role = 'admin'
      e informa o usuário.
    - Impede alterar o único admin para outro perfil ou desativá-lo.
    - Impede excluir o único admin.
Alterações (5.1.0) :
  • Mantido CRUD completo.
  • Alterada edição em linha para edição via modal reutilizando o mesmo formulário.
  • Integração com todos os campos editáveis do profileSchema.
Dependências       :
  - @/hooks/useUserList
  - ./PeopleTable
  - ./AddPersonModal
  - @/components/ui/*
  - @/services/profilesService
  - @/types/profile
================================================================================
*/
import React, { useState } from 'react';
import { useUserList } from '@/hooks/useUserList';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { Profile } from '@/types/profile';
import PeopleTable from './PeopleTable';
import AddPersonModal from './AddPersonModal';
import { createProfile, deleteProfileById, updateProfile } from '@/services/profilesService';

const PeopleSettings: React.FC = () => {
  const { items: profiles, loading, params, setFilters, refetch } = useUserList();
  const { addToast } = useToast();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [personBeingEdited, setPersonBeingEdited] = useState<Profile | null>(null);

  const getAdminsCount = () =>
    profiles.filter((p) => p.role === 'admin').length;

  const handleCreate = async (newPersonData: Partial<Profile>): Promise<boolean> => {
    try {
      const adminsCount = getAdminsCount();

      let payload: Partial<Profile> = { ...newPersonData };
      let becameAdminAutomatically = false;

      // Se ainda não existe nenhum admin, força o primeiro usuário a ser admin
      if (adminsCount === 0 && payload.role !== 'admin') {
        payload.role = 'admin';
        becameAdminAutomatically = true;
      }

      await createProfile(payload);

      if (becameAdminAutomatically) {
        addToast(
          'Não havia nenhum administrador cadastrado. Este usuário foi definido como admin automaticamente.',
          'success'
        );
      } else {
        addToast('Pessoa adicionada com sucesso!', 'success');
      }

      refetch();
      return true;
    } catch (error: any) {
      addToast(error?.message || 'Falha ao adicionar pessoa.', 'error');
      return false;
    }
  };

  const handleEditRequest = (person: Profile) => {
    setPersonBeingEdited(person);
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (updatedData: Partial<Profile>): Promise<boolean> => {
    if (!personBeingEdited?.id) return false;

    try {
      const adminsCount = getAdminsCount();
      const isEditingAdmin = personBeingEdited.role === 'admin';

      const nextRole = (updatedData.role ?? personBeingEdited.role) as Profile['role'];
      const nextStatus = (updatedData.status ?? personBeingEdited.status) as Profile['status'];

      // Se este é o único admin, não permitir perder perfil de admin ou ser desativado
      if (isEditingAdmin && adminsCount === 1) {
        const willStopBeingAdmin = nextRole !== 'admin';
        const willBeInactive = nextStatus === 'inactive';

        if (willStopBeingAdmin || willBeInactive) {
          addToast(
            'Não é possível alterar ou desativar o último administrador. Crie ou defina outro usuário como admin antes de mudar este.',
            'error'
          );
          return false;
        }
      }

      await updateProfile(personBeingEdited.id, updatedData);
      addToast('Pessoa atualizada com sucesso!', 'success');
      refetch();
      return true;
    } catch (error: any) {
      addToast(error?.message || 'Falha ao atualizar pessoa.', 'error');
      return false;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const adminsCount = getAdminsCount();
      const person = profiles.find((p) => p.id === id);
      const isAdmin = person?.role === 'admin';

      // Impede excluir o único admin
      if (isAdmin && adminsCount === 1) {
        addToast(
          'Não é possível excluir o último administrador. Crie ou defina outro usuário como admin antes de excluir este.',
          'error'
        );
        return;
      }

      await deleteProfileById(id);
      addToast('Pessoa excluída com sucesso!', 'success');
      refetch();
    } catch (error: any) {
      addToast(error?.message || 'Falha ao excluir pessoa.', 'error');
    }
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setPersonBeingEdited(null);
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <section className="neumorphic-convex rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Pessoas</h2>
            <Button onClick={() => setIsAddModalOpen(true)} variant="primary">
              <Plus className="h-5 w-5 mr-2" />
              Adicionar Pessoa
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <Input
              label="Busca"
              placeholder="Buscar por nome ou email..."
              value={params.q || ''}
              onChange={(e) => setFilters({ q: e.target.value })}
            />
            <Select
              label="Status"
              value={params.status || 'all'}
              onChange={(e) => setFilters({ status: e.target.value as any })}
            >
              <option value="all">Todos</option>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </Select>
          </div>
        </section>

        <PeopleTable
          users={profiles}
          loading={loading}
          onEdit={handleEditRequest}
          onDelete={handleDelete}
        />
      </div>

      {/* Modal de criação */}
      <AddPersonModal
        isOpen={isAddModalOpen}
        mode="create"
        initialData={null}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreate}
      />

      {/* Modal de edição */}
      <AddPersonModal
        isOpen={isEditModalOpen}
        mode="edit"
        initialData={personBeingEdited}
        onClose={handleCloseEditModal}
        onSubmit={handleUpdate}
      />
    </>
  );
};

export default PeopleSettings;

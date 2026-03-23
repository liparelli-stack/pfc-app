/*
================================================================================
Código             : /src/components/settings/PeopleTable.tsx
Versão (.v20)      : 1.2.0
Data/Hora          : 2025-11-17 16:30
Autor              : FL / Execução via você EVA
Objetivo           : Tabela para listar e gerenciar pessoas (sem edição em linha).
Fluxo              : PeopleSettings -> PeopleTable -> PersonRow
Alterações (1.2.0) :
  • Removida edição em linha (estado editingRowId/onUpdate).
  • Ação de editar agora dispara callback onEdit(user) para abrir modal externo.
  • Mantidas colunas de status para MFA (mfa_enabled) e KC (kb_can_edit).
  • Mantido modal de confirmação de exclusão.
Dependências       :
  - @/types/profile
  - @/components/ui/Skeleton
  - @/components/ui/Modal
  - @/components/ui/Button
  - ./PersonRow
================================================================================
*/
import React, { useState } from 'react';
import { Profile } from '@/types/profile';
import { Skeleton } from '@/components/ui/Skeleton';
import PersonRow from './PersonRow';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface PeopleTableProps {
  users: Profile[];
  loading: boolean;
  onEdit: (user: Profile) => void;
  onDelete: (id: string) => void;
}

const PeopleTable: React.FC<PeopleTableProps> = ({
  users,
  loading,
  onEdit,
  onDelete,
}) => {
  const [personToDelete, setPersonToDelete] = useState<Profile | null>(null);

  const handleDeleteRequest = (user: Profile) => {
    setPersonToDelete(user);
  };

  const handleDeleteConfirm = () => {
    if (personToDelete?.id) {
      onDelete(personToDelete.id);
      setPersonToDelete(null);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!loading && users.length === 0) {
    return (
      <div className="flex justify-center items-center h-48 neumorphic-convex rounded-2xl">
        <p className="text-gray-500">Nenhuma pessoa cadastrada.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto neumorphic-convex rounded-2xl p-4">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="text-left text-gray-500 dark:text-dark-t2 border-b border-gray-200/60 dark:border-white/10/60">
              <th scope="col" className="py-3 px-4 font-semibold">Nome</th>
              <th scope="col" className="py-3 px-4 font-semibold">Email</th>
              <th scope="col" className="py-3 px-4 font-semibold">Perfil</th>
              <th scope="col" className="py-3 px-4 font-semibold">MFA</th>
              <th scope="col" className="py-3 px-4 font-semibold">KC</th>
              <th scope="col" className="py-3 px-4 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <PersonRow
                key={user.id}
                user={user}
                onEdit={onEdit}
                onDelete={handleDeleteRequest}
              />
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={!!personToDelete}
        onClose={() => setPersonToDelete(null)}
        title="Confirmar Exclusão"
      >
        <p className="mb-6">
          Tem certeza que deseja excluir{' '}
          <strong>{personToDelete?.full_name}</strong>? Esta ação não pode ser
          desfeita.
        </p>
        <div className="flex justify-end gap-4">
          <Button onClick={() => setPersonToDelete(null)} variant="default">
            Cancelar
          </Button>
          <Button onClick={handleDeleteConfirm} variant="danger">
            Excluir
          </Button>
        </div>
      </Modal>
    </>
  );
};

export default PeopleTable;

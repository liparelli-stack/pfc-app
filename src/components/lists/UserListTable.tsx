/*
-- ===================================================
-- Código             : /src/components/lists/UserListTable.tsx
-- Versão (.v20)      : 1.1.0
-- Data/Hora          : 2025-12-04 12:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Remover a coluna "Ações" e suas dependências.
-- Alterações (1.1.0) :
--   • [REMOVE] Removida a coluna de cabeçalho "Ações".
--   • [REMOVE] Removida a célula com os botões de "Editar" e "Ver Perfil".
--   • [CLEAN] Removidas as props `onEditUser` e `onViewUser` que se tornaram redundantes.
-- Dependências       : react, clsx, lucide-react, @/components/ui/Skeleton
-- ===================================================
*/
import React from 'react';
import clsx from 'clsx';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';

// 1. Estrutura de Dados (TypeScript)
export interface UserProfile {
  id: string;
  nome: string;
  email: string;
  departamento: string;
  tratamento: string;
  cargo: string;
  funcao: string;
  status: 'Ativo' | 'Inativo';
  mfaHabilitado: boolean;
  podeEditarKB: boolean;
}

interface UserListTableProps {
  users: UserProfile[];
  loading: boolean;
}

// --- Componentes Auxiliares ---

// 2. Renderização Condicional: Status Badge
const StatusBadge: React.FC<{ status: 'Ativo' | 'Inativo' }> = ({ status }) => {
  const isActive = status === 'Ativo';
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        isActive
          ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
          : 'bg-gray-100 text-gray-800 dark:bg-dark-s2 dark:text-dark-t1'
      )}
    >
      {status}
    </span>
  );
};

// 2. Renderização Condicional: Boolean Icon
const BooleanIcon: React.FC<{ value: boolean }> = ({ value }) => {
  return value ? (
    <CheckCircle2 className="h-5 w-5 text-green-500" />
  ) : (
    <XCircle className="h-5 w-5 text-red-500" />
  );
};

// --- Componente Principal ---

const UserListTable: React.FC<UserListTableProps> = ({ users, loading }) => {
  // 5. UI/UX: Estado de Carregamento
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  // 5. UI/UX: Estado Vazio
  if (users.length === 0) {
    return (
      <div className="flex justify-center items-center h-48 neumorphic-convex rounded-2xl">
        <p className="text-gray-500">Nenhum utilizador encontrado.</p>
      </div>
    );
  }

  return (
    // 4. Responsividade: Scroll horizontal
    <div className="overflow-x-auto neumorphic-convex rounded-2xl p-4">
      <table className="w-full min-w-[800px] text-sm">
        <thead>
          <tr className="text-left text-gray-500 dark:text-dark-t2 border-b border-gray-200/60 dark:border-white/10/60">
            <th scope="col" className="py-3 px-4 font-semibold">Nome</th>
            <th scope="col" className="py-3 px-4 font-semibold">Email</th>
            <th scope="col" className="py-3 px-4 font-semibold">Departamento</th>
            <th scope="col" className="py-3 px-4 font-semibold">Cargo</th>
            <th scope="col" className="py-3 px-4 font-semibold">Status</th>
            <th scope="col" className="py-3 px-4 font-semibold text-center">MFA</th>
            <th scope="col" className="py-3 px-4 font-semibold text-center">Edita KB</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            // 5. UI/UX: Efeito de hover e 6. Boas Práticas: key única
            <tr key={user.id} className="border-b border-gray-200/60 dark:border-white/10/60 hover:bg-gray-50 dark:hover:bg-white/5">
              <td className="py-3 px-4 font-medium text-gray-800 dark:text-dark-t1">{user.nome}</td>
              <td className="py-3 px-4 text-gray-600 dark:text-dark-t1">{user.email}</td>
              <td className="py-3 px-4 text-gray-600 dark:text-dark-t1">{user.departamento}</td>
              <td className="py-3 px-4 text-gray-600 dark:text-dark-t1">{user.cargo}</td>
              <td className="py-3 px-4">
                <StatusBadge status={user.status} />
              </td>
              <td className="py-3 px-4">
                <div className="flex justify-center">
                  <BooleanIcon value={user.mfaHabilitado} />
                </div>
              </td>
              <td className="py-3 px-4">
                <div className="flex justify-center">
                  <BooleanIcon value={user.podeEditarKB} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserListTable;

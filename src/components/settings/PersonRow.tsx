/*
================================================================================
Código             : /src/components/settings/PersonRow.tsx
Versão (.v20)      : 1.3.0
Data/Hora          : 2025-11-17 17:10
Autor              : FL / Execução via você EVA
Objetivo           : Linha da tabela de pessoas (somente visualização), com ações.
Fluxo              : PeopleSettings -> PeopleTable -> PersonRow
Alterações (1.3.0) :
  • Ajustado Perfil: agora exibe somente:
      - 'Admin'  (role = 'admin')
      - 'Usuário' (role = 'user' ou qualquer outro valor)
  • Removidos rótulos anteriores "Leitor" e "Editor".
Alterações (1.2.0) :
  • Removido modo de edição em linha.
  • Mantida exibição dos status de MFA (mfa_enabled) e KC (kb_can_edit).
  • Ações agora apenas disparam edição (via modal) e exclusão (via tabela).
Dependências       :
  - @/types/profile
  - @/components/ui/Button
  - lucide-react
================================================================================
*/
import React from 'react';
import { Profile } from '@/types/profile';
import { Button } from '@/components/ui/Button';
import { Edit, Trash2 } from 'lucide-react';

interface PersonRowProps {
  user: Profile;
  onEdit: (user: Profile) => void;
  onDelete: (user: Profile) => void;
}

const PersonRow: React.FC<PersonRowProps> = ({ user, onEdit, onDelete }) => {
  const getRoleLabel = (role: string) =>
    role === 'admin' ? 'Admin' : 'Usuário';

  return (
    <tr className="border-b border-gray-200/60 dark:border-gray-700/60 hover:bg-black/5 dark:hover:bg-white/5">
      <td className="py-3 px-4 font-medium text-gray-800 dark:text-gray-100">
        {user.full_name}
      </td>
      <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
        {user.email}
      </td>

      {/* PERFIL (ajustado) */}
      <td className="py-3 px-4 text-gray-600 dark:text-gray-300 capitalize">
        {getRoleLabel(user.role)}
      </td>

      {/* MFA */}
      <td className="py-3 px-4">
        <span
          className={
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ' +
            (user.mfa_enabled
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300')
          }
        >
          {user.mfa_enabled ? 'Ativo' : 'Desativado'}
        </span>
      </td>

      {/* KC */}
      <td className="py-3 px-4">
        <span
          className={
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ' +
            (user.kb_can_edit
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300')
          }
        >
          {user.kb_can_edit ? 'Pode editar' : 'Somente leitura'}
        </span>
      </td>

      {/* AÇÕES */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Button
            onClick={() => onEdit(user)}
            variant="default"
            className="!p-2"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => onDelete(user)}
            variant="danger"
            className="!p-2"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
};

export default PersonRow;

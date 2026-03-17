/*
================================================================================
Código             : /src/components/settings/AddPersonModal.tsx
Versão (.v20)      : 1.5.0
Data/Hora          : 2025-12-06 21:25
Autor              : FL / Execução via você EVA
Objetivo           : Modal para criar/editar pessoa (usuário/perfil),
                     com mensagens de sucesso/erro e cargo livre.
Fluxo              : PeopleSettings -> AddPersonModal
Alterações (1.5.0) :
  • Integrado ToastContext diretamente no modal:
    - Sucesso na criação:  "Pessoa adicionada com sucesso!"
    - Sucesso na edição:   "Pessoa atualizada com sucesso!"
    - Falha na criação:    "Falha ao adicionar pessoa."
    - Falha na edição:     "Falha ao atualizar pessoa."
    - Erros com message    exibem a mensagem real do erro.
  • Mantido protocolo de retorno booleano para onSubmit.
Alterações (1.4.0) :
  • Campo "Função/Cargo" (position) como texto livre opcional.
  • String vazia convertida para NULL no submit.
Alterações (1.3.0) :
  • Perfil de acesso simplificado (admin|user).
Alterações (1.2.0) :
  • Modal unificado create/edit.
Dependências       :
  - react-hook-form, zod, @hookform/resolvers/zod
  - @/components/ui/Modal, Input, Select, Button
  - @/contexts/ToastContext
  - @/types/profile
================================================================================
*/

import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Profile } from '@/types/profile';
import { useToast } from '@/contexts/ToastContext';

/* -------------------------------------------------------------------------- */
/*                                 VALIDATION                                 */
/* -------------------------------------------------------------------------- */

const addPersonSchema = z.object({
  full_name: z.string().min(2, 'Nome é obrigatório.'),
  email: z.string().email('Email inválido.'),
  role: z.enum(['admin', 'user']),

  // Função/Cargo livre ou vazio
  position: z
    .string()
    .max(120, 'Função/Cargo deve ter no máximo 120 caracteres.')
    .optional()
    .or(z.literal('')),

  department: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  salutation_pref: z.enum(['masculino', 'feminino', 'neutro']).default('neutro'),
  locale: z.string().min(2, 'Locale é obrigatório.'),
  timezone: z.string().min(2, 'Timezone é obrigatório.'),
  mfa_enabled: z.boolean().default(false),
  kb_can_edit: z.boolean().default(false),
  avatar_url: z.string().url('URL do avatar inválida.').or(z.literal('')).optional(),
});

type AddPersonFormData = z.infer<typeof addPersonSchema>;

interface AddPersonModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialData?: Profile | null;
  onClose: () => void;
  onSubmit: (data: Partial<Profile>) => Promise<boolean>;
}

/* -------------------------------------------------------------------------- */
/*                             HELPERS & DEFAULTS                             */
/* -------------------------------------------------------------------------- */

const mapRoleToForm = (role?: Profile['role'] | null): 'admin' | 'user' =>
  role === 'admin' ? 'admin' : 'user';

const buildDefaultValues = (profile?: Profile | null): AddPersonFormData => ({
  full_name: profile?.full_name ?? '',
  email: profile?.email ?? '',
  role: mapRoleToForm(profile?.role),
  position: profile?.position ?? '',
  department: profile?.department ?? '',
  status: (profile?.status as 'active' | 'inactive') ?? 'active',
  salutation_pref: (profile?.salutation_pref as 'masculino' | 'feminino' | 'neutro') ?? 'neutro',
  locale: profile?.locale ?? 'pt-BR',
  timezone: profile?.timezone ?? 'America/Sao_Paulo',
  mfa_enabled: profile?.mfa_enabled ?? false,
  kb_can_edit: profile?.kb_can_edit ?? false,
  avatar_url: profile?.avatar_url ?? '',
});

/* -------------------------------------------------------------------------- */
/*                                   MODAL                                    */
/* -------------------------------------------------------------------------- */

const AddPersonModal: React.FC<AddPersonModalProps> = ({
  isOpen,
  mode,
  initialData,
  onClose,
  onSubmit,
}) => {
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<AddPersonFormData>({
    resolver: zodResolver(addPersonSchema),
    defaultValues: buildDefaultValues(initialData ?? null),
  });

  const { addToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      reset(buildDefaultValues(initialData ?? null));
    }
  }, [isOpen, initialData, reset]);

  const handleFormSubmit = async (data: AddPersonFormData) => {
    try {
      const success = await onSubmit({
        full_name: data.full_name,
        email: data.email,
        role: data.role,
        position:
          data.position && data.position.trim() !== ''
            ? data.position.trim()
            : null,
        department: data.department,
        status: data.status,
        salutation_pref: data.salutation_pref,
        locale: data.locale,
        timezone: data.timezone,
        mfa_enabled: data.mfa_enabled,
        kb_can_edit: data.kb_can_edit,
        avatar_url: data.avatar_url,
      });

      if (success) {
        addToast(
          mode === 'create'
            ? 'Pessoa adicionada com sucesso!'
            : 'Pessoa atualizada com sucesso!',
          'success'
        );
        reset(buildDefaultValues(null));
        onClose();
      } else {
        addToast(
          mode === 'create'
            ? 'Falha ao adicionar pessoa.'
            : 'Falha ao atualizar pessoa.',
          'error'
        );
      }
    } catch (e: any) {
      addToast(
        e?.message ||
          (mode === 'create'
            ? 'Erro ao adicionar pessoa.'
            : 'Erro ao atualizar pessoa.'),
        'error'
      );
    }
  };

  const title = mode === 'create' ? 'Adicionar Nova Pessoa' : 'Editar Pessoa';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        {/* Identidade */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller
            name="full_name"
            control={control}
            render={({ field }) => (
              <Input
                label="Nome Completo*"
                {...field}
                error={errors.full_name?.message}
              />
            )}
          />
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <Input
                label="Email*"
                type="email"
                {...field}
                error={errors.email?.message}
              />
            )}
          />
        </div>

        {/* Organização: role, position, department, status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller
            name="role"
            control={control}
            render={({ field }) => (
              <Select label="Perfil de acesso*" {...field}>
                <option value="user">Usuário</option>
                <option value="admin">Admin</option>
              </Select>
            )}
          />
          <Controller
            name="position"
            control={control}
            render={({ field }) => (
              <Input
                label="Função/Cargo"
                placeholder="Ex.: Gerente Comercial"
                {...field}
                error={errors.position?.message}
              />
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller
            name="department"
            control={control}
            render={({ field }) => (
              <Input
                label="Departamento"
                {...field}
                error={errors.department?.message}
              />
            )}
          />
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select label="Status*" {...field}>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </Select>
            )}
          />
        </div>

        {/* Preferências de comunicação / localização */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Controller
            name="salutation_pref"
            control={control}
            render={({ field }) => (
              <Select label="Tratamento padrão" {...field}>
                <option value="neutro">Neutro</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
              </Select>
            )}
          />
          <Controller
            name="locale"
            control={control}
            render={({ field }) => (
              <Input
                label="Locale"
                placeholder="pt-BR"
                {...field}
                error={errors.locale?.message}
              />
            )}
          />
          <Controller
            name="timezone"
            control={control}
            render={({ field }) => (
              <Input
                label="Timezone"
                placeholder="America/Sao_Paulo"
                {...field}
                error={errors.timezone?.message}
              />
            )}
          />
        </div>

        {/* Segurança: MFA + KC */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller
            name="mfa_enabled"
            control={control}
            render={({ field }) => (
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    MFA habilitado
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Exigir segundo fator de autenticação para este usuário.
                  </span>
                </div>
              </label>
            )}
          />
          <Controller
            name="kb_can_edit"
            control={control}
            render={({ field }) => (
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                    Pode editar KC
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Permite que este usuário altere conteúdos da base de conhecimento.
                  </span>
                </div>
              </label>
            )}
          />
        </div>

        {/* Avatar URL */}
        <Controller
          name="avatar_url"
          control={control}
          render={({ field }) => (
            <Input
              label="URL do Avatar"
              placeholder="https://..."
              {...field}
              error={errors.avatar_url?.message}
            />
          )}
        />

        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddPersonModal;
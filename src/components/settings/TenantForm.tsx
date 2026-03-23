/*
-- ===================================================
-- Código             : /src/components/settings/TenantForm.tsx
-- Versão (.v20)      : 1.5.0
-- Data/Hora          : 2025-11-16 15:50
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Formulário de criação/edição de Tenant com:
--                      • Submit sempre disparando (validação Zod manual).
--                      • Botão de excluir removido da UI.
--                      • Campos CNPJ e Número de Licenças protegidos em modo edição.
-- Fluxo              : OrganizationSettings -> TenantForm -> tenantService (create/update)
-- Alterações (1.5.0) :
--   • Removido botão "Excluir Organização" do rodapé.
--   • CNPJ (tax_id) e Limite de Número de Usuários (seats_limit) ficam desabilitados em modo edição.
-- Dependências       : react-hook-form, zod, tenantService, ToastContext, Input, Select, Button.
-- ===================================================
*/

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Tenant, tenantSchema } from '../../types/tenant';
import { createTenant, updateTenant } from '../../services/tenantService';
import { useToast } from '../../contexts/ToastContext';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';

interface TenantFormProps {
  initialData: Tenant | null;
  onSave: () => void;
  onDelete: () => void; // mantido por compatibilidade, mas não usado na UI
}

export const TenantForm = ({
  initialData,
  onSave,
}: TenantFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Tenant>({
    // Validação manual (sem resolver automático)
    defaultValues: initialData || {},
  });

  const isEditMode = Boolean(initialData?.id);

  useEffect(() => {
    reset(initialData || {});
  }, [initialData, reset]);

  const onSubmit = async (rawData: Tenant) => {
    setIsSubmitting(true);
    try {
      // [STEP 1] Limpar campos técnicos que vêm do DB e não fazem parte do form
      const cleaned: Tenant = {
        ...rawData,
        created_by: undefined as any,
        updated_by: undefined as any,
      };

      // [STEP 2] Validação Zod manual
      const parsed = tenantSchema.safeParse(cleaned);

      if (!parsed.success) {
        const messages = parsed.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join(' | ');

        console.error('Validação Tenant falhou:', parsed.error);
        addToast(`Erros de validação: ${messages}`, 'error');
        return;
      }

      const data = parsed.data;

      // [STEP 3] Decide entre criar ou editar
      if (isEditMode && initialData?.id) {
        await updateTenant({ ...data, id: initialData.id });
        addToast('Organização atualizada com sucesso!', 'success');
      } else {
        const { id, ...createData } = data;
        await createTenant(createData);
        addToast('Organização criada com sucesso!', 'success');
      }

      onSave();
    } catch (error: any) {
      console.error('Erro ao salvar Tenant (Supabase ou outro):', error);
      const raw =
        typeof error === 'string'
          ? error
          : error?.message ||
            error?.hint ||
            error?.details ||
            JSON.stringify(error);
      addToast(raw, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = isEditMode ? 'Editar Organização' : 'Cadastrar Organização';

  return (
    <div className="bg-plate dark:bg-dark-s1 rounded-2xl p-4 sm:p-8 neumorphic-convex">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-dark-t1 mb-6">
        {title}
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            label="Nome da Empresa"
            {...register('company_name')}
            error={errors.company_name?.message}
          />
          <Input
            label="Slug"
            {...register('slug')}
            error={errors.slug?.message}
          />
          <Input
            label="CNPJ"
            {...register('tax_id')}
            error={errors.tax_id?.message}
            disabled={isEditMode} // 🔒 protegido na edição
          />
          <Input
            label="Nome do Responsável"
            {...register('contract_owner')}
            error={errors.contract_owner?.message}
          />
          <Input
            label="E-mail do Responsável"
            type="email"
            {...register('email_contract_owner')}
            error={errors.email_contract_owner?.message}
          />
          <Input
            label="Telefone do Responsável"
            {...register('phone_contract_owner')}
            error={errors.phone_contract_owner?.message}
          />
          <Input
            label="Endereço"
            {...register('address')}
            error={errors.address?.message}
            className="md:col-span-2"
          />
          <Input
            label="Cidade"
            {...register('city')}
            error={errors.city?.message}
          />
          <Input
            label="Estado"
            {...register('state')}
            error={errors.state?.message}
          />
          <Input
            label="CEP"
            {...register('zip_code')}
            error={errors.zip_code?.message}
          />
          <Select
            label="Status"
            {...register('status')}
            error={errors.status?.message}
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </Select>
          <Input
            label="Limite de Número de Usuários"
            type="number"
            {...register('seats_limit', { valueAsNumber: true })}
            error={errors.seats_limit?.message}
            disabled={isEditMode} // 🔒 protegido na edição
          />
        </div>

        {/* [BLOCK] Rodapé responsivo – só botão de salvar, sem excluir */}
        <div className="flex justify-end items-center gap-4 pt-6 mt-6 border-t border-dark-shadow dark:border-dark-dark-shadow">
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            className="w-full sm:w-auto"
          >
            {isEditMode ? 'Salvar Alterações' : 'Criar Organização'}
          </Button>
        </div>
      </form>
    </div>
  );
};

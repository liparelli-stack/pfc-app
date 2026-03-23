/*
================================================================================
Código: /src/components/settings/ProfileForm.tsx
Versão: 6.1.0
Data/Hora: 2025-10-13 18:58 (America/Sao_Paulo)
Autor: FL / Eva (E.V.A.) | Base: Dualite Alpha (AD) v6.0.0
Objetivo: Adicionar campo "Tratamento" (salutation_pref: masculino|feminino|neutro)
          para controle de saudação no Dashboard; manter refinamentos do AD.
Fluxo: Simplificado para remover chamadas de log. UI atualizada com novas
       opções e texto de botão (herdado).
Dependências: react-hook-form, zod, componentes de UI, profilesService.
Regras de Projeto:
- A criação de perfis é totalmente independente do Auth.
================================================================================
*/

import React, { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type Profile } from "@/types/profile";
import { createProfile, updateProfile } from "@/services/profilesService";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/contexts/ToastContext";
import { Trash2 } from "lucide-react";

type ProfileFormValues = import("zod").infer<typeof profileSchema>;

// [--BLOCO--] Valores padrão para um formulário limpo (modo de criação)
const EMPTY_DEFAULTS: ProfileFormValues = {
  id: undefined,
  tenant_id: undefined,
  auth_user_id: undefined,
  full_name: "",
  email: "",
  avatar_url: "",
  department: "",
  position: "",
  role: "user",
  status: "active",
  mfa_enabled: false,
  kb_can_edit: false,

  // 🔹 NOVO: default do tratamento para coerência com schema/DB
  salutation_pref: "neutro",

  locale: "pt-BR",
  timezone: "America/Sao_Paulo",
  created_at: undefined,
  updated_at: undefined,
  created_by: undefined,
  updated_by: undefined,
};

type Props = {
  initialData: Profile | null;
  isCreating: boolean;
  onSave: (saved: Profile, wasCreating: boolean, status: number) => void;
  onDelete: () => void;
  onClear: () => void;
};

// [--BLOCO--] Componente wrapper para Switch com Label
const LabeledSwitch = ({ control, name, label, valueMap, ...rest }: any) => (
  <Controller
    control={control}
    name={name}
    render={({ field }) => (
      <div className="flex items-center justify-between rounded-lg p-3 neumorphic-convex">
        <label htmlFor={name} className="font-medium text-sm text-gray-600 dark:text-dark-t1 pr-4">
          {label}
        </label>
        <Switch
          id={name}
          checked={valueMap ? field.value === valueMap.on : Boolean(field.value)}
          onCheckedChange={(checked) => field.onChange(valueMap ? (checked ? valueMap.on : valueMap.off) : checked)}
          {...rest}
        />
      </div>
    )}
  />
);

const ProfileForm: React.FC<Props> = ({
  initialData,
  isCreating,
  onSave,
  onDelete,
  onClear,
}) => {
  const { addToast } = useToast();

  const initialValues = useMemo<ProfileFormValues>(() => {
    if (!initialData) return { ...EMPTY_DEFAULTS };
    // [--NOTA--] Garante que valores nulos do DB se tornem strings vazias para inputs controlados
    const safeData = Object.entries(initialData).reduce((acc, [key, value]) => {
      acc[key] = value === null ? "" : value;
      return acc;
    }, {} as any);

    // 🔹 Garante fallback para salutation_pref caso vindo vazio/nulo
    if (!safeData.salutation_pref) safeData.salutation_pref = "neutro";

    return { ...EMPTY_DEFAULTS, ...safeData };
  }, [initialData]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: initialValues,
    mode: "onChange",
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  // [--BLOCO--] Handler para capturar e exibir erros de validação
  const onInvalid = (validationErrors: any) => {
    addToast('Por favor, corrija os erros no formulário.', 'error');
    console.error("Validation Errors:", validationErrors);
  };

  const onSubmit = async (formData: ProfileFormValues) => {
    try {
      let saved: Profile;
      let status: number;

      // [--NOTA--] Sanitiza o payload, convertendo strings vazias em nulos antes de enviar.
      const sanitizedPayload = Object.fromEntries(
        Object.entries(formData).map(([key, value]) => [
          key,
          typeof value === 'string' && value.trim() === '' ? null : value,
        ])
      );

      if (isCreating) {
        const result = await createProfile(sanitizedPayload);
        saved = result.data;
        status = result.status;
      } else {
        if (!isDirty) {
          addToast("Nenhuma alteração para salvar.", "warning");
          return;
        }
        const result = await updateProfile(initialData!.id!, sanitizedPayload);
        saved = result.data;
        status = result.status;
      }
      
      onSave(saved, isCreating, status);
      // [--NOTA--] Reseta o formulário para o novo estado salvo, limpando o 'isDirty'.
      reset({ ...EMPTY_DEFAULTS, ...(saved as any) });
    } catch (err: any) {
      const statusText = err.status ? ` (Status: ${err.status})` : '';
      addToast(`${err.message || "Falha ao salvar o perfil."}${statusText}`, "error");
      console.error("[ProfileForm onSubmit Error]", err);
    }
  };
  
  const handleClearClick = () => {
    if (isCreating) {
      reset({ ...EMPTY_DEFAULTS });
    } else {
      reset(initialValues);
    }
    onClear();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
      {/* ===================== Dados Pessoais ===================== */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-dark-t1 border-b border-dark-shadow dark:border-dark-dark-shadow pb-2">Dados Pessoais</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller
            control={control}
            name="full_name"
            render={({ field, fieldState }) => (
              <Input
                label="Nome completo"
                placeholder="Ex.: Maria Souza"
                {...field}
                value={field.value ?? ""}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <Input
                label="E-mail"
                type="email"
                placeholder="exemplo@dominio.com"
                {...field}
                value={field.value ?? ""}
                error={fieldState.error?.message}
                disabled={!isCreating}
              />
            )}
          />
          <Controller
            control={control}
            name="avatar_url"
            render={({ field, fieldState }) => (
              <Input
                label="URL do Avatar"
                placeholder="https://..."
                {...field}
                value={field.value ?? ""}
                error={fieldState.error?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="department"
            render={({ field, fieldState }) => (
              <Input
                label="Departamento"
                placeholder="Ex.: Vendas"
                {...field}
                value={field.value ?? ""}
                error={fieldState.error?.message}
              />
            )}
          />
        </div>
      </section>

      {/* --------------- Permissões e Configurações --------------- */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-dark-t1 border-b border-dark-shadow dark:border-dark-dark-shadow pb-2">
          Permissões e Configurações
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 🔹 NOVO: Tratamento (salutation_pref) */}
          <Controller
            control={control}
            name="salutation_pref"
            render={({ field, fieldState }) => (
              <Select
                label="Tratamento"
                {...field}
                value={field.value ?? "neutro"}
                error={fieldState.error?.message}
              >
                <option value="neutro">Neutro</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
              </Select>
            )}
          />

          <Controller
            control={control}
            name="position"
            render={({ field, fieldState }) => (
              <Select
                label="Cargo"
                {...field}
                value={field.value ?? ""}
                error={fieldState.error?.message}
              >
                <option value="">Não definido</option>
                <option value="vendedor">Vendedor(a)</option>
                <option value="técnico">Técnico(a)</option>
                <option value="coordenador">Coordenador(a)</option>
                <option value="gerente">Gerente</option>
                <option value="consultor(a)">Consultor(a)</option>
                <option value="diretor(a)">Diretor(a)</option>
              </Select>
            )}
          />
          <Controller
            control={control}
            name="role"
            render={({ field, fieldState }) => (
              <Select
                label="Função"
                {...field}
                value={field.value ?? "user"}
                error={fieldState.error?.message}
              >
                <option value="user">Usuário</option>
                <option value="admin">Administrador</option>
              </Select>
            )}
          />
          <Controller
            control={control}
            name="timezone"
            render={({ field, fieldState }) => (
              <Select
                label="Fuso Horário"
                {...field}
                value={field.value ?? "America/Sao_Paulo"}
                error={fieldState.error?.message}
              >
                <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                <option value="UTC">UTC</option>
              </Select>
            )}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
          <LabeledSwitch control={control} name="status" label="Status Ativo" valueMap={{ on: 'active', off: 'inactive' }} />
          <LabeledSwitch control={control} name="mfa_enabled" label="MFA Habilitado" />
          <LabeledSwitch control={control} name="kb_can_edit" label="Editar Base de Conhecimento" />
        </div>
      </section>

      {/* --------------------------- Ações --------------------------- */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-dark-shadow dark:border-dark-dark-shadow">
        <div>
          <Button
            type="button"
            variant="danger"
            onClick={onDelete}
            title="Excluir Perfil"
            className="w-full sm:w-auto"
            disabled={isCreating}
          >
            <Trash2 className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Excluir</span>
          </Button>
        </div>
        <div className="flex w-full sm:w-auto items-center gap-3">
          <Button
            type="button"
            variant="default"
            onClick={handleClearClick}
            title="Limpar formulário"
            className="w-full sm:w-auto"
          >
            Limpar
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={!isDirty && !isCreating} className="w-full sm:w-auto">
            {isCreating ? "Salvar Perfil" : "Salvar Alterações"}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default ProfileForm;

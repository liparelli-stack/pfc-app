/*
-- ===================================================
-- Código: /src/components/deals/DealForm.tsx
-- Versão: 2.0.3
-- Data/Hora: 2025-11-12 10:00 -03
-- Autor: Dualite Alpha (AD)
-- Objetivo: Corrigir erro 'companies.map is not a function' ao processar
--           o retorno do serviço de listagem de empresas.
-- Mudanças v2.0.3:
--   - No `useEffect`, a desestruturação do retorno de `companiesService.listCompanies`
--     foi corrigida para acessar a propriedade `data`.
-- ===================================================
*/
import React, { useEffect, useState } from 'react';
import { useForm, Controller, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  dealSchema,
  Deal,
  DealWithRelations,
  DEAL_PIPELINE_STAGES,
  DEAL_STATUSES,
} from '@/types/deal';
import * as dealsService from '@/services/dealsService';
import * as companiesService from '@/services/companiesService';
import * as contactsService from '@/services/contactsService';
import * as profilesService from '@/services/profilesService';
import { Company } from '@/types/company';
import { Contact } from '@/types/contact';
import { Profile } from '@/types/profile';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/contexts/ToastContext';
import { getCurrentProfile } from '@/services/profilesService';

const TEMPERATURE_OPTIONS = [
  { value: '', label: 'Selecione...' },
  { value: 'frio',   label: 'Frio',  score: 1 },
  { value: 'morno',  label: 'Morno', score: 3 },
  { value: 'quente', label: 'Quente', score: 5 },
] as const;

const SOURCE_CHANNELS = [
  'Selecione...',
  'Indicação',
  'Inbound',
  'Outbound',
  'Parceiro',
  'Evento',
  'Orgânico',
  'Anúncio',
  'Site',
  'Telefone',
  'WhatsApp',
  'Email',
] as const;

const parseCurrencyPtBR = (raw: string): number | null => {
  if (!raw) return null;
  let v = raw.trim().replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  if (v === '' || v === '-' || v === '.' || v === '-.') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

interface DealFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  deal: DealWithRelations | null;
}

const STATUS_LABELS: Record<(typeof DEAL_STATUSES)[number], string> = {
  aberta: 'Aberta',
  ganha: 'Ganha',
  perdida: 'Perdida',
  em_espera: 'Em Espera',
};

const DealForm: React.FC<DealFormProps> = ({ isOpen, onClose, onSave, deal }) => {
  const { addToast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { isSubmitting, errors },
  } = useForm<Deal>({
    resolver: zodResolver(dealSchema),
    defaultValues: deal || {
      id: undefined,
      tenant_id: undefined,
      name: '',
      company_id: null,
      primary_contact_id: null,
      owner_user_id: undefined as unknown as string,
      status: 'aberta',
      pipeline_stage: 'Captura',
      amount: null,
      currency: 'BRL',
      is_archived: false,
      temperature: null,
      source: null,
      closed_at: null,
      loss_reason: null,
      loss_detail: null,
      created_by: undefined,
      updated_by: undefined,
      export_state: 'Create',
    },
    shouldUnregister: false,
  });

  const selectedCompanyId = watch('company_id');

  useEffect(() => {
    async function fetchData() {
      try {
        const [companiesResult, , me] = await Promise.all([
          companiesService.listCompanies({ status: 'active' }),
          profilesService.listProfiles({ status: 'active' }),
          getCurrentProfile(),
        ]);
        setCompanies(companiesResult.data); // CORREÇÃO: Acessa a propriedade 'data'
        setCurrentUser(me || null);

        const defaults: Partial<Deal> = deal
          ? {
              ...deal,
              owner_user_id: deal.owner_user_id || me?.id || undefined,
              tenant_id: deal.tenant_id || me?.tenant_id || undefined,
              created_by: deal.created_by || me?.id || undefined,
              updated_by: me?.id || deal.updated_by || undefined,
              status: (deal.status as any) || 'aberta',
            }
          : {
              name: '',
              company_id: null,
              primary_contact_id: null,
              owner_user_id: me?.id ?? undefined,
              tenant_id: me?.tenant_id ?? undefined,
              created_by: me?.id ?? undefined,
              updated_by: me?.id ?? undefined,
              status: 'aberta',
              pipeline_stage: 'Captura',
              amount: null,
              currency: 'BRL',
              is_archived: false,
              temperature: null,
              source: null,
              closed_at: null,
              loss_reason: null,
              loss_detail: null,
              export_state: 'Create',
            };

        reset(defaults);

        // Segurança extra
        if (!defaults.owner_user_id && me?.id) setValue('owner_user_id', me.id, { shouldDirty: false });
        if (!defaults.tenant_id && me?.tenant_id) setValue('tenant_id', me.tenant_id, { shouldDirty: false });
        if (!defaults.created_by && me?.id) setValue('created_by', me.id, { shouldDirty: false });
        if (!defaults.updated_by && me?.id) setValue('updated_by', me.id, { shouldDirty: false });
      } catch {
        addToast('Erro ao carregar dados para o formulário.', 'error');
      }
    }
    if (isOpen) fetchData();
  }, [isOpen, deal, reset, addToast, setValue]);

  useEffect(() => {
    if (currentUser?.id) {
      if (!getValues('owner_user_id')) setValue('owner_user_id', currentUser.id, { shouldDirty: false });
      if (!getValues('created_by')) setValue('created_by', currentUser.id, { shouldDirty: false });
      setValue('updated_by', currentUser.id, { shouldDirty: false });
    }
    if (currentUser?.tenant_id && !getValues('tenant_id')) {
      setValue('tenant_id', currentUser.tenant_id, { shouldDirty: false });
    }
  }, [currentUser?.id, currentUser?.tenant_id, getValues, setValue]);

  useEffect(() => {
    async function fetchContacts() {
      if (selectedCompanyId) {
        try {
          const contactsData = await contactsService.listByCompany(selectedCompanyId);
          setContacts(contactsData);
        } catch {
          setContacts([]);
          addToast('Erro ao carregar contatos da empresa.', 'error');
        }
      } else {
        setContacts([]);
        setValue('primary_contact_id', null);
      }
    }
    fetchContacts();
  }, [selectedCompanyId, addToast, setValue]);

  const normalizePayload = (data: Deal): Deal => {
    const toNull = (v: unknown) => (v === '' ? null : v);
    return {
      ...data,
      company_id: toNull(data.company_id) as string | null,
      primary_contact_id: toNull(data.primary_contact_id) as string | null,
    };
  };

  const onInvalid = (errs: FieldErrors<Deal>) => {
    const first = Object.values(errs)[0] as any;
    addToast(first?.message || 'Preencha os campos obrigatórios.', 'error');
  };

  const onSubmit = async (formData: Deal) => {
    // Reforço RLS/FKs
    if (!formData.owner_user_id && currentUser?.id) formData.owner_user_id = currentUser.id;
    if (!formData.tenant_id && currentUser?.tenant_id) formData.tenant_id = currentUser.tenant_id;
    if (!formData.created_by && currentUser?.id) formData.created_by = currentUser.id;
    formData.updated_by = currentUser?.id ?? formData.updated_by;

    addToast('Enviando atualização…', 'info');

    try {
      const payload = normalizePayload(formData);
      if (deal?.id) {
        await dealsService.updateDeal(deal.id, payload);
        addToast('✅ Oportunidade atualizada com sucesso!', 'success');
      } else {
        await dealsService.createDeal(payload);
        addToast('✅ Oportunidade criada com sucesso!', 'success');
      }
      onSave();
    } catch (error: any) {
      addToast(error?.message || 'Falha ao salvar oportunidade.', 'error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${deal ? 'Editar Oportunidade' : 'Nova Oportunidade'} · DF 2.0.2`}>
      <div className="mb-2 text-xs font-mono px-2 py-1 rounded bg-yellow-100 text-yellow-900 inline-block">
        DF:2.0.2
      </div>

      <form id="deal-form" onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4" noValidate>
        {/* Hidden RLS/FK fields */}
        <Controller name="tenant_id" control={control} render={({ field }) => <input type="hidden" {...field} value={field.value ?? ''} />} />
        <Controller name="owner_user_id" control={control} render={({ field }) => <input type="hidden" {...field} value={field.value ?? ''} />} />
        <Controller name="created_by" control={control} render={({ field }) => <input type="hidden" {...field} value={field.value ?? ''} />} />
        <Controller name="updated_by" control={control} render={({ field }) => <input type="hidden" {...field} value={field.value ?? ''} />} />

        {/* Nome */}
        <Controller name="name" control={control} render={({ field }) => (
          <Input label="Nome da Oportunidade*" {...field} error={errors.name?.message} />
        )} />

        {/* Empresa / Contato Principal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller name="company_id" control={control} render={({ field }) => (
            <Select label="Empresa" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value || null)} error={errors.company_id?.message}>
              <option value="">Selecione...</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.trade_name}</option>)}
            </Select>
          )} />
          <Controller name="primary_contact_id" control={control} render={({ field }) => (
            <Select label="Contato Principal" {...field} value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value || null)}
              disabled={!selectedCompanyId || contacts.length === 0} error={errors.primary_contact_id?.message}>
              <option value="">Selecione...</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </Select>
          )} />
        </div>

        {/* Status */}
        <Controller name="status" control={control} render={({ field }) => (
          <Select label="Status" {...field} value={field.value ?? 'aberta'} onChange={(e) => field.onChange(e.target.value)} error={errors.status?.message}>
            {DEAL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </Select>
        )} />

        {/* Temperatura */}
        <Controller name="temperature" control={control} render={({ field }) => (
          <Select label="Temperatura" {...field}
            value={field.value && (field.value as any).label ? (field.value as any).label : ''}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) field.onChange(null);
              else {
                const opt = TEMPERATURE_OPTIONS.find(o => o.value === v);
                field.onChange({ label: v, score: opt?.score ?? 0 });
              }
            }}
            error={errors.temperature as any}>
            {TEMPERATURE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        )} />

        {/* Valor / Estágio */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller name="amount" control={control} render={({ field }) => (
            <Input label="Valor (R$)" type="text" inputMode="decimal" placeholder="ex.: 8,95"
              {...field}
              value={field.value == null ? '' : String(field.value).replace('.', ',')}
              onChange={(e) => field.onChange(parseCurrencyPtBR(e.target.value))}
              error={errors.amount?.message}
            />
          )} />
          <Controller name="pipeline_stage" control={control} render={({ field }) => (
            <Select label="Estágio do Funil" {...field} value={field.value ?? 'Captura'} onChange={(e) => field.onChange(e.target.value)} error={errors.pipeline_stage?.message}>
              {DEAL_PIPELINE_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          )} />
        </div>

        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="default" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="deal-form" variant="primary" isLoading={isSubmitting}>Salvar</Button>
        </div>
      </form>
    </Modal>
  );
};

export default DealForm;

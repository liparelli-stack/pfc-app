/*
-- ===================================================
-- Código                 : /src/components/catalogs/CompanyForm.tsx
-- Versão (.v20)          : 2.3.5
-- Data/Hora              : 2025-12-04 12:55 America/Sao_Paulo
-- Autor                  : FL / Execução via você EVA
-- Objetivo do codigo     : Incluir o campo obrigatório "Tipo de Empresa" (companies.kind) na seção Classificação,
--                          uma linha abaixo de "Responsável", com default "Cliente" (valor interno 'client').
--                          [Owner] Dropdown de responsável baseado em profiles:
--                          • Exibe full_name;
--                          • Lista apenas perfis com auth_user_id preenchido;
--                          • Salva companies.owner como auth_user_id.
--                          • Responsável é obrigatório (sem opção "Nenhum").
-- Fluxo                  : UI (CompanyForm) → services/companiesService → DB (companies.kind enum company_kind)
-- Alterações (2.3.5) :
--   • [FIX] Removida a propriedade `notes` da validação do Zod no formulário
--     (companyFormSchema = companySchema.omit({ notes: true })), evitando
--     erro de "Too small: expected string to have >=1 characters" em notes[].nota,
--     já que notas não são obrigatórias e são tratadas por RPC separado.
-- Alterações (2.3.4) :
--   • [FIX] Sanitização de notes vindas do backend/RPC para garantir que
--     notes[].data / notes[].assunto / notes[].nota sejam sempre strings,
--     evitando falha de validação ("expected string, received undefined")
--     no companySchema durante o submit.
-- Alterações (2.3.3) :
--   • [FIX] Normalização de default para kind ao carregar empresas existentes, garantindo valor 'client'
--     quando vier null/undefined do backend (evita falha silenciosa na validação do Zod).
--   • [UX] Adicionado handler de erro do handleSubmit para exibir toast quando a validação bloquear o envio
--     do formulário (evita clique “morto” em Salvar sem feedback).
-- Alterações (2.3.2) :
--   • Ajuste do consumo de listProfiles, que agora retorna { items, count }.
--     Corrigido fetchOwners para usar result.items, evitando TypeError e o toast de erro.
-- Alterações (2.3.1) :
--   • [Owner] Campo passa a ser obrigatório (Responsável*).
--   • [Owner] Placeholder "Escolha um nome" no lugar de "Nenhum".
--   • [Owner] Validação extra no onSubmit se owner estiver vazio.
-- Alterações (2.3.0) :
--   • [Owner] Filtro local de perfis com auth_user_id !== null/''.
--   • [Owner] Label do select usa full_name; valor = auth_user_id.
--   • [Owner] EMPTY_DEFAULTS.owner ajustado para null.
-- Dependências           : react, react-hook-form, zod,
--                          services (companiesService, profilesService),
--                          componentes UI (Input, Select, Button, Switch, StarRating, Modal), lucide-react
-- ===================================================
*/

import React, { useEffect, useMemo, useState } from 'react';
import { useForm, Controller, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { companySchema, type Company, type CompanyNote } from '@/types/company';
import {
  createCompany,
  updateCompany,
  appendCompanyNote,
  updateCompanyNoteAt,
  deleteCompanyNoteAt,
} from '@/services/companiesService';
import { listProfiles } from '@/services/profilesService';
import { Profile } from '@/types/profile';
import { useToast } from '@/contexts/ToastContext';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { StarRating } from '@/components/ui/StarRating';
import { Modal } from '@/components/ui/Modal';
import { Trash2, Edit3, PlusCircle } from 'lucide-react';
import { z } from 'zod';

// 🔗 Integração com o dicionário de assuntos
import { NOTE_SUBJECTS, SUBJECT_PRECEDENCE, classifySubjects } from '@/config/noteSubjects';

/**
 * Schema específico para o formulário de empresa.
 * Removemos `notes` da validação do Zod porque:
 * - O histórico de notas é gerenciado via RPC separado (append/update/delete).
 * - `nota` não é obrigatória, e o backend pode devolver notas vazias.
 * - Evita erro de "Too small: expected string to have >=1 characters" em notes[].nota.
 */
const companyFormSchema = companySchema.omit({ notes: true });

type CompanyFormValues = z.infer<typeof companyFormSchema> & {
  notes?: CompanyNote[];
};

const EMPTY_DEFAULTS: Partial<CompanyFormValues> = {
  trade_name: '',
  legal_name: '',
  tax_id: '',
  email: '',
  phone: '',
  website: '',
  qualification: null,
  status: 'active',
  owner: null, // responsável obrigatório → começa vazio
  // ✅ default do kind alinhado ao DB ('client')
  kind: 'client',
  // notes continua existindo no estado do form, mas fora da validação do Zod
  notes: [],
  address_line: '',
  city: '',
  state: '',
  zip_code: '',
};

type Props = {
  initialData: Company | null;
  onSave: (saved: Company, wasCreating: boolean) => void;
  onDelete: () => void;
  onClear: () => void;
};

// Formata documento (CPF ou CNPJ)
const formatDocumentId = (value: string) => {
  if (!value) return '';
  const cleaned = value.replace(/[^\d]/g, '');
  if (cleaned.length <= 11) {
    return cleaned
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .slice(0, 14);
  }
  return cleaned
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})/, '$1-$2');
};

// Util para datas ISO
const fmtDateTimeBR = (iso?: string) => {
  try {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR');
  } catch {
    return iso || '—';
  }
};

/**
 * Sanitiza o array de notas para garantir compatibilidade com o companySchema:
 * - Garante que data/assunto/nota sejam sempre strings.
 * - Mantém demais campos originais (caso existam).
 */
const sanitizeNotes = (raw: any): CompanyNote[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((n: any): CompanyNote => {
    const safeData =
      typeof n?.data === 'string' && n.data
        ? n.data
        : new Date().toISOString();
    const safeAssunto =
      typeof n?.assunto === 'string' && n.assunto
        ? n.assunto
        : 'Geral';
    const safeNota =
      typeof n?.nota === 'string'
        ? n.nota
        : '';

    return {
      ...(n || {}),
      data: safeData,
      assunto: safeAssunto,
      nota: safeNota,
    } as CompanyNote;
  });
};

const CompanyForm: React.FC<Props> = ({ initialData, onSave, onDelete, onClear }) => {
  const { addToast } = useToast();
  const [owners, setOwners] = useState<Profile[]>([]);
  const isCreating = !initialData;

  // Estado local para modais de nota
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [editNoteAssunto, setEditNoteAssunto] = useState<string>('');
  const [editRecompute, setEditRecompute] = useState(true);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isDirty, isSubmitting, errors },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companyFormSchema),
    defaultValues: EMPTY_DEFAULTS as CompanyFormValues,
  });

  // 🔄 Carrega owners (responsáveis)
  useEffect(() => {
    const fetchOwners = async () => {
      try {
        // listProfiles agora retorna { items, count }
        const { items } = await listProfiles({ status: 'active', limit: 200, offset: 0 });

        const filtered = (items || [])
          .filter((p: Profile) => p.auth_user_id && p.auth_user_id.trim() !== '')
          .sort((a: Profile, b: Profile) => {
            const aName = (a.full_name || a.email || '').toLowerCase();
            const bName = (b.full_name || b.email || '').toLowerCase();
            return aName.localeCompare(bName);
          });

        setOwners(filtered);
      } catch {
        addToast('Erro ao carregar a lista de responsáveis.', 'error');
      }
    };
    fetchOwners();
  }, [addToast]);

  // 🔄 Normaliza defaults ao trocar de empresa
  useEffect(() => {
    if (!initialData) {
      reset(EMPTY_DEFAULTS as CompanyFormValues);
      return;
    }

    const rawNotes = (initialData as any).notes;
    const safeNotes = sanitizeNotes(rawNotes);

    // Normaliza kind e notes para evitar null/undefined quebrando validação
    const safeDefaults: CompanyFormValues = {
      ...(EMPTY_DEFAULTS as CompanyFormValues),
      ...(initialData as CompanyFormValues),
      kind: (initialData.kind as any) ?? 'client',
      notes: safeNotes,
    };

    reset(safeDefaults);
  }, [initialData, reset]);

  const taxIdValue = watch('tax_id');
  const companyId = initialData?.id;
  const notes = watch('notes') || [];

  /* ===========================================================
     Métodos de Notas (histórico) - chamam services (RPCs)
     =========================================================== */

  const handleAppendNote = async () => {
    if (!companyId) {
      addToast('Salve a empresa antes de adicionar notas.', 'warning');
      return;
    }
    const text = (newNoteText || '').trim();
    if (!text) {
      addToast('Digite a nota antes de salvar.', 'warning');
      return;
    }
    try {
      const updatedRaw = await appendCompanyNote(companyId, text);
      const updated = sanitizeNotes(updatedRaw);
      setValue('notes', updated, { shouldDirty: true });
      setNewNoteText('');
      setIsAddOpen(false);
      addToast('Nota adicionada com sucesso!', 'success');
    } catch (err: any) {
      addToast(err.message || 'Falha ao adicionar a nota.', 'error');
    }
  };

  const openEditModal = (idx: number, item: CompanyNote) => {
    setEditIndex(idx);
    setEditNoteText(item.nota || '');
    setEditNoteAssunto(item.assunto || 'Geral');
    setEditRecompute(true); // default: recalcular assunto ao alterar texto
    setIsEditOpen(true);
  };

  const handleEditNote = async () => {
    if (!companyId || editIndex === null) return;
    try {
      const patch: Partial<CompanyNote> = {};
      patch.nota = editNoteText || '';
      if (!editRecompute) {
        patch.assunto = editNoteAssunto || 'Geral';
      }
      const updatedRaw = await updateCompanyNoteAt(companyId, editIndex, patch, editRecompute);
      const updated = sanitizeNotes(updatedRaw);
      setValue('notes', updated, { shouldDirty: true });
      setIsEditOpen(false);
      addToast('Nota atualizada com sucesso!', 'success');
    } catch (err: any) {
      addToast(err.message || 'Falha ao atualizar a nota.', 'error');
    }
  };

  const handleDeleteNote = async (idx: number) => {
    if (!companyId) return;
    try {
      const updatedRaw = await deleteCompanyNoteAt(companyId, idx);
      const updated = sanitizeNotes(updatedRaw);
      setValue('notes', updated, { shouldDirty: true });
      addToast('Nota excluída com sucesso!', 'success');
    } catch (err: any) {
      addToast(err.message || 'Falha ao excluir a nota.', 'error');
    }
  };

  /* ===========================================================
     Dados derivados: assuntos dinâmicos e ordenação por precedência
     =========================================================== */

  const subjectOptions = useMemo(() => {
    const precedenceSet = new Set(SUBJECT_PRECEDENCE);
    const uniqueByName = new Map<string, string>();
    for (const s of NOTE_SUBJECTS) {
      if (!uniqueByName.has(s.name)) uniqueByName.set(s.name, s.name);
    }
    const ordered = Array.from(uniqueByName.keys()).sort((a, b) => {
      const ia = precedenceSet.has(a) ? SUBJECT_PRECEDENCE.indexOf(a) : Number.MAX_SAFE_INTEGER;
      const ib = precedenceSet.has(b) ? SUBJECT_PRECEDENCE.indexOf(b) : Number.MAX_SAFE_INTEGER;
      if (ia !== ib) return ia - ib;
      return a.localeCompare(b);
    });
    return ordered;
  }, []);

  const suggestionSubjects = useMemo(() => {
    if (!editNoteText?.trim()) return [];
    const { matches } = classifySubjects(editNoteText);
    return matches.map(m => m.subject).filter(s => s !== 'Geral');
  }, [editNoteText]);

  /* ===========================================================
     Submit do form (empresa)
     =========================================================== */

  const onSubmit = async (formData: CompanyFormValues) => {
    // Guarda extra: responsável obrigatório
    if (!formData.owner || formData.owner.trim() === '') {
      addToast('Selecione um responsável para a empresa.', 'warning');
      return;
    }

    try {
      let saved: Company;
      if (isCreating) {
        saved = await createCompany(formData);
        addToast('Empresa criada com sucesso!', 'success');
      } else {
        if (!isDirty) {
          addToast('Nenhuma alteração para salvar.', 'warning');
          return;
        }
        saved = await updateCompany(initialData!.id!, formData);
        addToast('Empresa atualizada com sucesso!', 'success');
      }
      onSave(saved, isCreating);
      if (isCreating) {
        reset(EMPTY_DEFAULTS as CompanyFormValues);
      } else {
        // Garante que kind/notes não voltem a null/undefined caso o backend retorne valores inconsistentes
        const safeNotes = sanitizeNotes((saved as any).notes);
        const safeSaved: CompanyFormValues = {
          ...(EMPTY_DEFAULTS as CompanyFormValues),
          ...(saved as CompanyFormValues),
          kind: (saved.kind as any) ?? 'client',
          notes: safeNotes,
        };
        reset(safeSaved);
      }
    } catch (err: any) {
      addToast(err.message || 'Falha ao salvar a empresa.', 'error');
    }
  };

  // Handler para erros de validação (Zod/react-hook-form)
  const onSubmitError = (formErrors: FieldErrors<CompanyFormValues>) => {
    console.error('[CompanyForm] Erros de validação no submit:', formErrors);
    addToast('Verifique os campos obrigatórios antes de salvar.', 'error');
  };

  /* ===========================================================
     Render
     =========================================================== */

  return (
    <form onSubmit={handleSubmit(onSubmit, onSubmitError)} className="space-y-6">
      {/* Dados Principais */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white border-b border-dark-shadow dark:border-dark-dark-shadow pb-2">
          Dados da Empresa
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller
            name="trade_name"
            control={control}
            render={({ field }) => (
              <Input
                label="Nome Fantasia*"
                {...field}
                value={field.value ?? ''}
                error={errors.trade_name?.message}
              />
            )}
          />
          <Controller
            name="legal_name"
            control={control}
            render={({ field }) => (
              <Input
                label="Razão Social"
                {...field}
                value={field.value ?? ''}
                error={errors.legal_name?.message}
              />
            )}
          />
          <Controller
            name="tax_id"
            control={control}
            render={({ field }) => (
              <Input
                label="CNPJ/CPF"
                {...field}
                value={taxIdValue ? formatDocumentId(taxIdValue) : ''}
                onChange={e => field.onChange(e.target.value)}
                error={errors.tax_id?.message}
              />
            )}
          />
          <Controller
            name="email"
            control={control}
            render={({ field }) => (
              <Input
                label="E-mail Principal"
                type="email"
                {...field}
                value={field.value ?? ''}
                error={errors.email?.message}
              />
            )}
          />
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <Input
                label="PABX"
                {...field}
                value={field.value ?? ''}
                error={errors.phone?.message}
              />
            )}
          />
          <Controller
            name="website"
            control={control}
            render={({ field }) => (
              <Input
                label="Website"
                {...field}
                value={field.value ?? ''}
                error={errors.website?.message}
              />
            )}
          />
        </div>
      </section>

      {/* Classificação e Dono */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white border-b border-dark-shadow dark:border-dark-dark-shadow pb-2">
          Classificação
        </h3>

        {/* Linha 1: Qualificação + Responsável */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">
              Qualificação
            </label>
            <Controller
              name="qualification"
              control={control}
              render={({ field }) => <StarRating value={field.value} onChange={field.onChange} />}
            />
          </div>
          <Controller
            name="owner"
            control={control}
            render={({ field }) => (
              <Select
                label="Responsável*"
                {...field}
                value={field.value ?? ''}
                onChange={e => field.onChange(e.target.value)}
                required
                title="Escolha o responsável pela empresa"
              >
                {/* Placeholder obrigatório */}
                <option value="">Escolha um nome</option>
                {owners.map(p => {
                  const label =
                    p.full_name ||
                    (p.email ? p.email.split('@')[0] : 'Usuário sem nome');
                  return (
                    <option key={p.id} value={p.auth_user_id || ''}>
                      {label}
                    </option>
                  );
                })}
              </Select>
            )}
          />
        </div>

        {/* Linha 2: Tipo de Empresa (kind) — obrigatório, default client */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller
            name="kind"
            control={control}
            render={({ field }) => (
              <Select
                label="Tipo de Empresa*"
                {...field}
                value={field.value ?? 'client'}
                required
                title="Selecione o tipo de empresa"
              >
                <option value="client">Cliente</option>
                <option value="lead">Lead</option>
                <option value="prospect">Prospect</option>
              </Select>
            )}
          />
          {/* espaço reservado para manter grade uniforme quando em 2 colunas */}
          <div className="hidden md:block" />
        </div>
      </section>

      {/* Endereço */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white border-b border-dark-shadow dark:border-dark-dark-shadow pb-2">
          Endereço
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Controller
            name="address_line"
            control={control}
            render={({ field }) => (
              <Input
                label="Endereço"
                {...field}
                value={field.value ?? ''}
                className="md:col-span-2"
              />
            )}
          />
          <Controller
            name="city"
            control={control}
            render={({ field }) => (
              <Input label="Cidade" {...field} value={field.value ?? ''} />
            )}
          />
          <Controller
            name="state"
            control={control}
            render={({ field }) => (
              <Input label="Estado" {...field} value={field.value ?? ''} />
            )}
          />
          <Controller
            name="zip_code"
            control={control}
            render={({ field }) => (
              <Input label="CEP" {...field} value={field.value ?? ''} />
            )}
          />
        </div>
      </section>

      {/* Notas (Histórico) */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white border-b border-dark-shadow dark:border-dark-dark-shadow pb-2">
          Notas (histórico)
        </h3>

        {!companyId ? (
          <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm">
            Salve a empresa para habilitar o histórico de notas.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Registre fatos e decisões. O assunto é classificado automaticamente por regras
                determinísticas.
              </p>
              <Button type="button" variant="primary" onClick={() => setIsAddOpen(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Adicionar nota
              </Button>
            </div>

            <div className="rounded-xl p-4 neumorphic-convex">
              {Array.isArray(notes) && notes.length > 0 ? (
                <ul className="space-y-3">
                  {[...notes]
                    .map((n, idx) => ({ ...n, _idx: idx }))
                    .sort(
                      (a, b) =>
                        new Date(a.data).getTime() - new Date(b.data).getTime()
                    )
                    .map(item => (
                      <li
                        key={`${item._idx}-${item.data}`}
                        className="rounded-lg p-3 bg-plate/60 dark:bg-plate-dark/60"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              <span className="font-medium">
                                {item.assunto || 'Geral'}
                              </span>
                              <span className="mx-2">•</span>
                              <span>{fmtDateTimeBR(item.data)}</span>
                            </div>
                            <div className="text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words mt-1">
                              {item.nota || '—'}
                            </div>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-2">
                            <Button
                              type="button"
                              variant="default"
                              onClick={() => openEditModal(item._idx, item)}
                              title="Editar nota"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              onClick={() => handleDeleteNote(item._idx)}
                              title="Excluir nota"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
              ) : (
                <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                  Nenhuma nota registrada.
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Outros (Status) */}
      <section className="space-y-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white border-b border-dark-shadow dark:border-dark-dark-shadow pb-2">
          Outros
        </h3>
        <div className="flex items-center justify-between rounded-lg p-3 neumorphic-convex max-w-xs">
          <label
            htmlFor="status"
            className="font-medium text-sm text-gray-600 dark:text-gray-300 pr-4"
          >
            Status Ativo
          </label>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Switch
                id="status"
                checked={field.value === 'active'}
                onCheckedChange={checked =>
                  field.onChange(checked ? 'active' : 'inactive')
                }
              />
            )}
          />
        </div>
      </section>

      {/* Ações */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-dark-shadow dark:border-dark-dark-shadow">
        <Button
          type="button"
          variant="danger"
          onClick={onDelete}
          title="Excluir Empresa"
          className="w-full sm:w-auto"
          disabled={isCreating}
        >
          <Trash2 className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Excluir</span>
        </Button>
        <div className="flex w-full sm:w-auto items-center gap-3">
          <Button
            type="button"
            variant="default"
            onClick={onClear}
            title="Limpar formulário"
            className="w-full sm:w-auto"
          >
            Limpar
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            disabled={!isDirty && !isCreating}
            className="w-full sm:w-auto"
          >
            {isCreating ? 'Salvar Empresa' : 'Salvar Alterações'}
          </Button>
        </div>
      </div>

      {/* Modal: Adicionar Nota */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Adicionar nota">
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Nota
          </label>
          <textarea
            className="w-full min-h-[120px] rounded-lg p-3 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-gray-700 outline-none"
            value={newNoteText}
            onChange={e => setNewNoteText(e.target.value)}
            placeholder="Descreva a nota. Ex.: 'Cliente solicitou novo budget anual para 2026.'"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="default" onClick={() => setIsAddOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" onClick={handleAppendNote}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Editar Nota */}
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Editar nota">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Nota
            </label>
            <textarea
              className="w-full min-h-[120px] rounded-lg p-3 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-gray-700 outline-none"
              value={editNoteText}
              onChange={e => setEditNoteText(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg p-3 bg-black/5 dark:bg.white/5 dark:bg-white/5">
            <div>
              <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Recalcular assunto automaticamente
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Se ativo, o assunto será recalculado pelas regras determinísticas ao salvar.
              </div>
            </div>
            <Switch
              id="recompute"
              checked={editRecompute}
              onCheckedChange={setEditRecompute}
            />
          </div>

          {!editRecompute && (
            <div className="space-y-2">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Assunto (manual)
                </label>
                <Select
                  value={editNoteAssunto}
                  onChange={e => setEditNoteAssunto(e.target.value)}
                >
                  {subjectOptions.map(name => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>

              {suggestionSubjects.length > 0 && (
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Sugestões de assunto (clique para aplicar):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestionSubjects.map(s => (
                      <Button
                        key={s}
                        type="button"
                        variant="default"
                        onClick={() => {
                          setEditNoteAssunto(s);
                          setEditRecompute(false);
                        }}
                        title={`Aplicar "${s}" como assunto`}
                        className="!py-1 !px-2 text-xs"
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="default" onClick={() => setIsEditOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="primary" onClick={handleEditNote}>
              Salvar alterações
            </Button>
          </div>
        </div>
      </Modal>
    </form>
  );
};

export default CompanyForm;

/*
-- ===================================================
-- Código                 : /src/components/cockpit/ConversationLogCard.tsx
-- Versão (.v16)         : 3.2.0
-- Data/Hora             : 2025-10-27 16:15 America/Sao_Paulo
-- Autor                 : FL/Eva GPT
-- Objetivo              : Ajustes p/ JWT+RLS puro (sem headers/localStorage).
--                         Remover dependências de tenant/autor no client.
-- Fluxo                 : UI → services/supabase (RLS decide escopo)
-- Alterações (3.2.0):
--   • Removidos getCurrentTenantId/getCurrentProfileId (imports e uso).
--   • saveConversation/update/handleScheduleSubmit sem tenant_id/author_user_id.
--   • Update só por id (RLS restringe).
-- ===================================================
*/
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { conversationSchema, ConversationFormData, TEMPERATURE_OPTIONS } from '@/types/chat';
import { DealWithRelations } from '@/types/deal';
import { Contact } from '@/types/contact';
import { createChat } from '@/services/chatsService';
import { listDeals } from '@/services/dealsService';
import { listByCompany } from '@/services/contactsService';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/contexts/ToastContext';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '../ui/Skeleton';
import ScheduleActionModal, { ScheduleActionType } from './ScheduleActionModal';
import { Phone, MessageSquareText, Mail, CheckSquare } from 'lucide-react';

type EditingChat = {
  id: string;
  kind: 'conversation' | 'followup' | 'task';
  subject: string | null;
  body: string | null;
  calendar_at: string | null;
  on_time: string | null;
  temperature?: string | null;
  deal_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  is_done: boolean;
  done_at: string | null;
  direction?: string | null;
  channel_type?: string | null;
  thread_id?: string | null;
};

interface Props {
  editingChat?: EditingChat | null;
  onCancelEdit?: () => void;
  onSaved?: () => void;
}

const ConversationLogCard: React.FC<Props> = ({ editingChat, onCancelEdit, onSaved }) => {
  const { addToast } = useToast();
  const isEditing = !!editingChat;

  const { control, handleSubmit, reset, watch, setValue, getValues, trigger, formState: { errors, isSubmitting, isDirty } } =
    useForm<ConversationFormData>({
      resolver: zodResolver(conversationSchema),
      defaultValues: {
        deal_id: '',
        contact_id: '',
        company_id: '',
        subject: '',
        body: '',
        temperature: null,
      },
    });

  const [editIsDone, setEditIsDone] = useState<boolean>(editingChat?.is_done ?? false);
  const [deals, setDeals] = useState<DealWithRelations[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [lastConversationId, setLastConversationId] = useState<string | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleActionType, setScheduleActionType] = useState<ScheduleActionType | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);

  const selectedDealId = watch('deal_id');

  // Carrega deals
  useEffect(() => {
    const fetchDeals = async () => {
      setIsLoading(true);
      try {
        const activeDeals = await listDeals({ status: 'aberta', includeArchived: false });
        setDeals(activeDeals);
      } catch {
        addToast('Erro ao carregar oportunidades.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carrega contatos ao trocar deal
  useEffect(() => {
    if (!selectedDealId) {
      setContacts([]);
      setValue('contact_id', '');
      setValue('company_id', '');
      return;
    }
    const selectedDeal = deals.find(d => d.id === selectedDealId);
    if (!selectedDeal || !selectedDeal.company_id) return;

    setValue('company_id', selectedDeal.company_id);

    const fetchContacts = async () => {
      try {
        const companyContacts = await listByCompany(selectedDeal.company_id!);
        setContacts(companyContacts);
        if (!getValues('contact_id')) {
          if (selectedDeal.primary_contact_id && companyContacts.some(c => c.id === selectedDeal.primary_contact_id)) {
            setValue('contact_id', selectedDeal.primary_contact_id);
          }
        }
      } catch {
        addToast('Erro ao carregar contatos da empresa.', 'error');
        setContacts([]);
      }
    };
    fetchContacts();
  }, [selectedDealId, deals, setValue, getValues, addToast]);

  // Entrar/Sair de edição
  useEffect(() => {
    if (!editingChat) {
      reset({ deal_id: '', contact_id: '', company_id: '', subject: '', body: '', temperature: null });
      setEditIsDone(false);
      setLastConversationId(null);
      return;
    }
    reset({
      deal_id: editingChat.deal_id ?? '',
      contact_id: editingChat.contact_id ?? '',
      company_id: editingChat.company_id ?? '',
      subject: editingChat.subject ?? '',
      body: editingChat.body ?? '',
      temperature: editingChat.kind === 'conversation' ? (editingChat.temperature ?? null) : null,
    });
    setEditIsDone(!!editingChat.is_done);
  }, [editingChat, reset]);

  // Rotulagem
  const kindLabel = useMemo(() => {
    if (!isEditing || !editingChat) return null;
    return editingChat.kind === 'conversation' ? 'Conversa' : editingChat.kind === 'followup' ? 'Follow-up' : 'Tarefa';
  }, [isEditing, editingChat]);

  // CREATE
  const saveConversation = useCallback(async (): Promise<string | null> => {
    const isValid = await trigger(['deal_id', 'contact_id', 'subject', 'body']);
    if (!isValid) {
      addToast('Preencha os campos obrigatórios da conversa para continuar.', 'error');
      return null;
    }
    const formData = getValues();
    const payload = {
      ...formData,
      kind: 'conversation',
      direction: 'outbound',
      is_done: false,
    };
    try {
      const result = await createChat(payload as any);
      setLastConversationId(result.id!);
      return result.id!;
    } catch (err: any) {
      addToast(`Erro ao salvar conversa: ${err?.message || 'Falha desconhecida'}`, 'error');
      return null;
    }
  }, [trigger, getValues, addToast]);

  // UPDATE
  const updateCurrentChat = useCallback(async (): Promise<boolean> => {
    if (!editingChat) return false;
    const isValid = await trigger(['deal_id', 'contact_id', 'subject', 'body']);
    if (!isValid) {
      addToast('Preencha os campos obrigatórios para salvar as alterações.', 'error');
      return false;
    }
    const form = getValues();

    const nextIsDone = !!editIsDone;
    const nextDoneAt = nextIsDone ? new Date().toISOString() : null;

    const temperatureValue =
      editingChat.kind === 'conversation' ? form.temperature : null; // trava temperatura p/ followup/task

    const updatePayload: any = {
      subject: form.subject,
      body: form.body,
      temperature: temperatureValue,
      deal_id: form.deal_id || null,
      company_id: form.company_id || null,
      contact_id: form.contact_id || null,
      calendar_at: editingChat.calendar_at,
      on_time: editingChat.on_time,
      is_done: nextIsDone,
      done_at: nextIsDone ? nextDoneAt : null,
    };

    try {
      const { error } = await supabase
        .from('chats')
        .update(updatePayload)
        .eq('id', editingChat.id); // RLS limita por tenant/autor

      if (error) throw error;

      addToast(`${kindLabel ? ` ${kindLabel}` : 'Item'} atualizado com sucesso!`, 'success');
      window.dispatchEvent(new CustomEvent('cockpit:refreshHistory'));
      onSaved?.();

      reset({ deal_id: '', contact_id: '', company_id: '', subject: '', body: '', temperature: null });
      setEditIsDone(false);
      return true;
    } catch (err: any) {
      addToast(`Erro ao atualizar: ${err?.message || 'Falha desconhecida'}`, 'error');
      return false;
    }
  }, [editingChat, trigger, getValues, addToast, onSaved, reset, editIsDone, kindLabel]);

  const onSaveOnly = async () => {
    const conversationId = await saveConversation();
    if (conversationId) {
      addToast('Conversa registrada com sucesso!', 'success');
      reset({ deal_id: '', contact_id: '', company_id: '', subject: '', body: '', temperature: null });
      setLastConversationId(null);
      setContacts([]);
      onSaved?.();
    }
  };

  const onSaveEdit = async () => {
    await updateCurrentChat();
    onCancelEdit?.();
  };

  const onCancelEditLocal = () => {
    reset({ deal_id: '', contact_id: '', company_id: '', subject: '', body: '', temperature: null });
    setEditIsDone(false);
    onCancelEdit?.();
  };

  const handleScheduleClick = (type: ScheduleActionType) => {
    setScheduleActionType(type);
    setIsScheduleModalOpen(true);
  };

  const actionSubject = (t: ScheduleActionType | null) =>
    t === 'call' ? 'Ligar' : t === 'whatsapp' ? 'Whats' : t === 'email' ? 'E-mail' : t === 'task' ? 'Tarefa' : '';

  // Agendar próxima ação com subject definido (JWT+RLS; sem tenant/autor no client)
  const handleScheduleSubmit = async (modalData: { calendar_at: string; on_time: string; body: string }) => {
    setIsScheduling(true);
    try {
      let conversationId = lastConversationId;

      if (isEditing && editingChat) {
        conversationId = editingChat.kind === 'conversation' ? editingChat.id : (editingChat.thread_id || editingChat.id);
      }

      if (!conversationId && !isEditing) {
        if (!conversationId || isDirty) {
          const newId = await saveConversation();
          if (!newId) {
            setIsScheduling(false);
            return;
          }
          conversationId = newId;
        }
      }

      const mainFormData = getValues();
      const subjectValue = actionSubject(scheduleActionType);

      const taskPayload = {
        deal_id: mainFormData.deal_id,
        contact_id: mainFormData.contact_id,
        company_id: mainFormData.company_id,
        subject: subjectValue || null,
        calendar_at: modalData.calendar_at,
        on_time: modalData.on_time,
        body: modalData.body,
        temperature: null,
        is_done: false,
        thread_id: conversationId,
        kind: scheduleActionType === 'task' ? 'task' : 'followup',
        direction: scheduleActionType === 'task' ? 'internal' : 'outbound',
        channel_type: scheduleActionType === 'task' ? 'task' : scheduleActionType,
      };

      const { error } = await supabase.from('chats').insert(taskPayload as any);
      if (error) throw error;

      addToast('Ação agendada com sucesso!', 'success');
      setIsScheduleModalOpen(false);

      if (!isEditing) {
        reset({ deal_id: '', contact_id: '', company_id: '', subject: '', body: '', temperature: null });
        setLastConversationId(null);
        setContacts([]);
      }

      window.dispatchEvent(new CustomEvent('cockpit:refreshHistory'));
      onSaved?.();
    } catch (err: any) {
      addToast(`Erro ao agendar ação: ${err?.message || 'Falha desconhecida'}`, 'error');
    } finally {
      setIsScheduling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-plate dark:bg-dark-s1 rounded-2xl p-6 neumorphic-convex space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
        <div className="flex justify-end">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="bg-plate dark:bg-dark-s1 rounded-2xl p-6 neumorphic-convex">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-dark-t1">
            {isEditing ? `Editar ${kindLabel}` : 'Registrar Oportunidade'}
          </h3>

          {isEditing && (
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-dark-t1">
              <input type="checkbox" checked={editIsDone} onChange={e => setEditIsDone(e.target.checked)} />
              Concluída
            </label>
          )}
        </div>

        <form onSubmit={handleSubmit(isEditing ? onSaveEdit : onSaveOnly)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Controller
              name="deal_id"
              control={control}
              render={({ field }) => (
                <Select label="Oportunidade*" {...field} value={field.value ?? ''} error={errors?.deal_id?.message}>
                  <option value="">Selecione uma oportunidade</option>
                  {deals.map(deal => (
                    <option key={deal.id} value={deal.id!}>
                      {deal.name ? deal.name : `${deal.company?.trade_name || 'Empresa'} • ${deal.pipeline_stage}`}
                    </option>
                  ))}
                </Select>
              )}
            />
            <Controller
              name="contact_id"
              control={control}
              render={({ field }) => (
                <Select
                  label="Contato*"
                  {...field}
                  value={field.value ?? ''}
                  disabled={!selectedDealId || contacts.length === 0}
                  error={errors?.contact_id?.message}
                >
                  <option value="">Selecione um contato</option>
                  {contacts.map(contact => (
                    <option key={contact.id} value={contact.id!}>
                      {contact.full_name}{contact.department ? ` – ${contact.department}` : ''}
                    </option>
                  ))}
                </Select>
              )}
            />
          </div>

          <Controller
            name="subject"
            control={control}
            render={({ field }) => (
              <Input
                label={isEditing ? 'Assunto* (editar)' : 'Assunto*'}
                placeholder="Resumo curto do tema..."
                {...field}
                error={errors?.subject?.message}
              />
            )}
          />

          <div>
            <label htmlFor="body" className="block text-sm font-medium mb-1 text-gray-600 dark:text-dark-t1">
              {isEditing ? 'Descrição / Observações (editar)*' : 'Descreva o que foi Conversado*'}
            </label>
            <Controller
              name="body"
              control={control}
              render={({ field }) => (
                <textarea
                  id="body"
                  placeholder="Detalhe os pontos principais, decisões e próximos passos..."
                  rows={5}
                  className="w-full px-4 py-2.5 rounded-lg bg-plate dark:bg-dark-s1 neumorphic-concave focus:bg-white dark:focus:bg-gray-700 transition-colors duration-200 outline-none"
                  {...field}
                />
              )}
            />
            {errors?.body && <p className="text-red-500 text-xs mt-1">{errors.body.message}</p>}
          </div>

          <Controller
            name="temperature"
            control={control}
            render={({ field }) => {
              const disabled = isEditing && editingChat?.kind !== 'conversation';
              const forcedValue = disabled ? '' : (field.value ?? '');
              if (disabled && field.value !== null) {
                setTimeout(() => field.onChange(null), 0);
              }
              return (
                <Select
                  label="Temperatura"
                  {...field}
                  value={forcedValue}
                  onChange={(e) => field.onChange((e.target as HTMLSelectElement).value || null)}
                  disabled={disabled}
                >
                  <option value="">Nenhuma</option>
                  {TEMPERATURE_OPTIONS.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
              );
            }}
          />

          {/* Rodapé unificado */}
          <div className="mt-6 pt-4 border-t border-dark-shadow dark:border-dark-dark-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <span className="font-semibold text-sm text-gray-700 dark:text-dark-t1 flex-shrink-0">
                Agendar Próxima Ação:
              </span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="default" onClick={() => handleScheduleClick('call')} className="!px-3 !py-1.5 text-sm">
                  <Phone className="h-4 w-4 mr-2" />Ligar
                </Button>
                <Button type="button" variant="default" onClick={() => handleScheduleClick('whatsapp')} className="!px-3 !py-1.5 text-sm">
                  <MessageSquareText className="h-4 w-4 mr-2" />Whats
                </Button>
                <Button type="button" variant="default" onClick={() => handleScheduleClick('email')} className="!px-3 !py-1.5 text-sm">
                  <Mail className="h-4 w-4 mr-2" />E-mail
                </Button>
                <Button type="button" variant="default" onClick={() => handleScheduleClick('task')} className="!px-3 !py-1.5 text-sm">
                  <CheckSquare className="h-4 w-4 mr-2" />Tarefa
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              {isEditing && (
                <Button type="button" variant="default" onClick={onCancelEditLocal} className="!px-4">
                  Cancelar
                </Button>
              )}
              <Button type="submit" variant="primary" isLoading={isSubmitting} className="self-end sm:self-auto">
                {isEditing ? 'Salvar Alterações' : 'Salvar Conversa'}
              </Button>
            </div>
          </div>
        </form>
      </section>

      {/* Modal de Agendamento */}
      <ScheduleActionModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onSubmit={handleScheduleSubmit}
        actionType={scheduleActionType}
        isSubmitting={isScheduling}
      />
    </>
  );
};

export default ConversationLogCard;

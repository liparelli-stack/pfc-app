import React, { useEffect, useMemo } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusCircle } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import HierarchicalActionSelect from "@/components/ui/HierarchicalActionSelect";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { TimePickerRHF } from "@/components/ui/TimePicker";
import BudgetSection from "./BudgetSection";
import ActionTagSelector from "./ActionTagSelector";
import AiInsightsPanel from "./AiInsightsPanel";
import ScheduleActionModal from "@/components/cockpit/ScheduleActionModal";

import {
  ActionFormData,
  actionSchema,
  PRIORITY_OPTIONS,
  TEMPERATURE_OPTIONS,
} from "@/types/chat";
import type { CompanyDetails, ContactWithChannels } from "@/types/cockpit";

import { useBudgetManager } from "@/components/cockpit/hooks/useBudgetManager";
import { useTagsManager } from "@/components/cockpit/hooks/useTagsManager";
import { useActionAI } from "@/components/cockpit/hooks/useActionAI";
import { useActionSubmit } from "@/components/cockpit/hooks/useActionSubmit";

import type { Dir } from "@/config/actionConstants";
import { ACTION_GROUPS } from "@/config/actionConstants";
import { reconstructSelectionId } from "@/utils/actionMappers";

/* --------------------- Tipos locais --------------------- */
type EditingChat = { id: string } & Partial<ActionFormData> & {
  kind?: string | null;
  channel_type?: string | null;
  direction?: "outbound" | "inbound" | "internal" | null;
  contact_name?: string | null;
  deal_id?: string | null;
  budgets?: any[] | null;
  tags?: string[] | null;
};

interface EditActionFormProps {
  companyDetails?: CompanyDetails | null;
  editingChat: EditingChat | null;
  onSaved: () => void;
  onCancel: () => void;
  profileId?: string;
  aiTrigger?: number;
}

/* --------------------- Componente principal --------------------- */
const EditActionForm: React.FC<EditActionFormProps> = ({
  companyDetails,
  editingChat,
  onSaved,
  onCancel,
  profileId,
  aiTrigger,
}) => {
  const { addToast } = useToast();
  const isEditing = !!editingChat;
  const contextCompanyId = companyDetails?.id || editingChat?.company_id || "";
  const contacts: ContactWithChannels[] = companyDetails?.contacts ?? [];

  const normalizePriority = (p: string | null | undefined): string =>
    PRIORITY_OPTIONS.includes(p as any) ? (p as string) : "Normal";

  const getFirstErrorMessage = (errors: any): string => {
    const order = ["action", "contact_id", "subject", "calendar_at", "on_time", "priority"];
    for (const key of order) {
      const err = errors?.[key];
      if (err?.message) return String(err.message);
    }
    const flat = Object.values(errors) as any[];
    const withMsg = flat.find((e) => e && e.message);
    return withMsg?.message || "Verifique os campos obrigatórios.";
  };

  // Defaults ----------------
  const defaults = useMemo((): ActionFormData => {
    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const mm = now.getMinutes();
    const roundedMin = Math.ceil(mm / 15) * 15;
    const d = new Date(now);
    if (roundedMin >= 60) {
      d.setHours(now.getHours() + 1);
      d.setMinutes(0);
    } else {
      d.setMinutes(roundedMin);
    }
    const currentTime = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

    if (isEditing && editingChat) {
      const selId = reconstructSelectionId({
        kind: editingChat.kind ?? null,
        direction: (editingChat.direction ?? null) as Dir,
        channel_type: editingChat.channel_type ?? null,
      });
      return {
        action: selId,
        contact_id: editingChat.contact_id || "",
        company_id: editingChat.company_id || contextCompanyId,
        subject: editingChat.subject || "",
        body: editingChat.body || "",
        temperature: (editingChat as any).temperature || "Neutra",
        priority: normalizePriority((editingChat as any).priority) as any,
        calendar_at: editingChat.calendar_at
          ? String(editingChat.calendar_at).split("T")[0]
          : today,
        on_time: editingChat.on_time || currentTime,
        is_done: (editingChat as any).is_done ?? false,
      };
    }
    return {
      action: "",
      contact_id: contacts?.[0]?.id || "",
      company_id: contextCompanyId,
      subject: "",
      body: "",
      temperature: "Neutra",
      priority: "Normal",
      calendar_at: today,
      on_time: currentTime,
      is_done: false,
    };
  }, [isEditing, editingChat, contextCompanyId, contacts]);

  const { control, handleSubmit, reset, formState, getValues, setValue } =
    useForm<ActionFormData>({
      resolver: zodResolver(actionSchema),
      defaultValues: defaults,
    });

  const watchedAction = useWatch({ control, name: "action" });
  const watchedSubject = useWatch({ control, name: "subject" });

  // --------------------- Orçamentos ---------------------
  const {
    budgetItems, budgetDraft, setBudgetDraft,
    openCreateDraft, openEditDraft, cancelDraft, submitDraft,
  } = useBudgetManager({
    isEditing,
    chatId: editingChat?.id,
    companyId: contextCompanyId || undefined,
    initialBudgets: editingChat?.budgets as any,
    addToast,
  });

  // --------------------- Tags ---------------------
  const {
    tags, tagMapBySlug, lowerSelectedTags,
    isTagPanelOpen, tagSearch, tagSuggestions,
    tagLoading, tagCreating, tagError,
    effectivePendingColor, tagButtonRef, tagPanelRef,
    handleTagAdd, handleTagRemove, handleTagCreate,
    handleTagSearchKeyDown, setTagSearch, setIsTagPanelOpen, setPendingColor,
  } = useTagsManager({
    editingChatId: editingChat?.id,
    editingChatTags: (editingChat as any)?.tags,
  });

  // --------------------- Submit / Próxima Ação ---------------------
  const {
    onSubmit, handleOpenNextAction, handleSubmitNext,
    nextOpen, setNextOpen, nextDefaults,
  } = useActionSubmit({
    isEditing,
    editingChatId: editingChat?.id,
    contextCompanyId,
    tags,
    budgetItems,
    addToast,
    onSaved,
  });

  useEffect(() => {
    if (!nextOpen) reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextOpen]); // Intencional: reset apenas quando o modal de próxima ação abre/fecha, não em cada re-render de defaults

  // Quando contacts muda (novo contato inserido) e o valor atual não está na lista,
  // auto-seleciona o primeiro contato disponível para evitar contact_id vazio no submit.
  useEffect(() => {
    const currentId = getValues("contact_id");
    const isInList = contacts.some((c) => c.id === currentId);
    if (!isInList && contacts.length > 0) {
      setValue("contact_id", contacts[0].id, { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts.length]); // contacts.length como primitivo estável — dispara só quando a lista cresce/diminui

  const onInvalid = (errors: any) => addToast(getFirstErrorMessage(errors), "error");

  // --------------------- IA ---------------------
  const {
    aiRequested, aiLoading, aiError, aiResult,
    sentimentToLabel, urgencyToLabel, handlePasteFromAi,
  } = useActionAI({
    aiTrigger,
    getValues,
    getBodyValue: () => getValues("body") ?? "",
    setBodyValue: (v) => setValue("body", v, { shouldDirty: true }),
    contacts,
    tags,
    addToast,
  });

  const temperatureOptions = useMemo(() => TEMPERATURE_OPTIONS as string[], []);
  const shouldShowBudgetSection = watchedAction === "task:null:orcamento";

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
        {/* Ação e Status */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Controller
            name="action"
            control={control}
            render={({ field, fieldState }) => (
              <HierarchicalActionSelect
                label="Ação*"
                error={fieldState.error?.message}
                groups={ACTION_GROUPS.map((g) => ({
                  group: g.group,
                  options: g.options.map((o) => ({ id: o.id, label: o.label })),
                }))}
                value={field.value}
                onChange={field.onChange}
                profileId={profileId}
                placeholder="Selecione uma ação..."
              />
            )}
          />
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium mb-1 text-transparent select-none sm:text-gray-600 dark:sm:text-gray-300">
              Status
            </label>
            <Controller
              name="is_done"
              control={control}
              render={({ field }) => (
                <SegmentedToggle
                  value={field.value ? "right" : "left"}
                  onChange={(v) => field.onChange(v === "right")}
                  leftLabel="Andamento"
                  rightLabel="Concluída"
                  leftActiveClass="bg-red-500 text-white"
                  rightActiveClass="bg-green-600 text-white"
                />
              )}
            />
          </div>
        </div>

        {/* Contato e Assunto */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Contato*</label>
            <Controller
              name="contact_id"
              control={control}
              render={({ field }) => (
                <select
                  className="input-field h-11 dark:bg-dark-s2 dark:text-dark-t1 dark:border-dark-bmd"
                  value={field.value}
                  onChange={field.onChange}
                >
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              )}
            />
          </div>
          <Controller
            name="subject"
            control={control}
            render={({ field, fieldState }) => (
              <Input
                label="Assunto*"
                placeholder="Resumo da ação..."
                {...field}
                error={fieldState.error?.message}
                className="h-11"
                style={{
                  fontSize: '14px',
                  color: '#3b2e1a',
                  backgroundColor: '#fffdf9',
                  border: '0.5px solid rgba(59,42,20,0.15)',
                  borderRadius: '8px',
                  boxShadow: 'none',
                  padding: '8px 12px',
                  width: '100%',
                }}
              />
            )}
          />
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Descreva a Ação ou Conversa
          </label>
          <Controller
            name="body"
            control={control}
            render={({ field }) => (
              <textarea
                rows={4}
                placeholder="Detalhes, notas, próximos passos..."
                className="input-field dark:bg-dark-s2 dark:text-dark-t1 dark:border-dark-bmd dark:focus:border-accent dark:focus:shadow-focus-accent"
                {...field}
                value={field.value ?? ""}
              />
            )}
          />
        </div>

        {/* Painel IA */}
        <AiInsightsPanel
          aiRequested={aiRequested}
          aiLoading={aiLoading}
          aiError={aiError}
          aiResult={aiResult}
          sentimentToLabel={sentimentToLabel}
          urgencyToLabel={urgencyToLabel}
          onPasteFromAi={handlePasteFromAi}
        />

        {/* Etiquetas */}
        <ActionTagSelector
          tags={tags}
          tagMapBySlug={tagMapBySlug}
          lowerSelectedTags={lowerSelectedTags}
          isTagPanelOpen={isTagPanelOpen}
          tagSearch={tagSearch}
          tagSuggestions={tagSuggestions}
          tagLoading={tagLoading}
          tagCreating={tagCreating}
          tagError={tagError}
          effectivePendingColor={effectivePendingColor}
          tagButtonRef={tagButtonRef}
          tagPanelRef={tagPanelRef}
          onTogglePanel={() => { setIsTagPanelOpen((prev) => !prev); setTagSearch(""); }}
          onTagAdd={handleTagAdd}
          onTagRemove={handleTagRemove}
          onTagCreate={handleTagCreate}
          onTagSearchKeyDown={handleTagSearchKeyDown}
          onTagSearchChange={setTagSearch}
          onColorSelect={setPendingColor}
          onClosePanel={() => setIsTagPanelOpen(false)}
        />

        {/* Data → Hora → Temperatura → Prioridade */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Controller
            name="calendar_at"
            control={control}
            render={({ field }) => (
              <Input
                type="date"
                label="Data*"
                {...field}
                className="h-11"
                style={{
                  fontSize: '14px',
                  color: '#3b2e1a',
                  backgroundColor: '#fffdf9',
                  border: '0.5px solid rgba(59,42,20,0.15)',
                  borderRadius: '8px',
                  boxShadow: 'none',
                  padding: '8px 12px',
                  width: '100%',
                }}
              />
            )}
          />
          <TimePickerRHF
            control={control}
            name="on_time"
            label="Hora*"
            minuteStep={15}
            dropdownMaxHeight={224}
          />
          <div>
            <label className="block text-sm font-medium mb-1">Temperatura</label>
            <Controller
              name="temperature"
              control={control}
              render={({ field }) => (
                <select
                  className="input-field h-11 dark:bg-dark-s2 dark:text-dark-t1 dark:border-dark-bmd"
                  value={field.value ?? "Neutra"}
                  onChange={(e) => field.onChange(e.target.value || "Neutra")}
                >
                  {temperatureOptions.map((opt) => (
                    <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
                  ))}
                </select>
              )}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Prioridade</label>
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <select
                  className="input-field h-11 dark:bg-dark-s2 dark:text-dark-t1 dark:border-dark-bmd"
                  value={field.value ?? "Normal"}
                  onChange={(e) => field.onChange(e.target.value || "Normal")}
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
                  ))}
                </select>
              )}
            />
          </div>
        </div>

        {/* Rodapé: + Próxima ação / Cancelar / Salvar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200 dark:border-white/10">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-t2">
            <button
              type="button"
              onClick={() => handleOpenNextAction(getValues())}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                backgroundColor: '#3b68f5',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 14px 6px 8px',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '400',
              }}
            >
              <PlusCircle size={16} color="#ffffff" />
              <span>Próxima ação</span>
            </button>
            <span className="max-w-xs">
              A próxima ação será criada encadeada a esta, mantendo o contexto
              de empresa, contato e temperatura.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                cursor: 'pointer',
                backgroundColor: 'transparent',
                border: '0.5px solid rgba(59,42,20,0.15)',
                borderRadius: '8px',
                padding: '7px 15px',
                color: '#9a7d5a',
                fontSize: '13px',
                fontWeight: '400',
                opacity: 1,
              }}
            >
              Cancelar
            </button>
            <Button
              type="submit"
              variant="primary"
              className="px-4"
              disabled={formState.isSubmitting}
              title={isEditing ? "Editar ação existente" : "Registrar nova ação"}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
            >
              {formState.isSubmitting ? "Salvando..." : "Salvar ação"}
            </Button>
          </div>
        </div>
      </form>

      {shouldShowBudgetSection && (
        <BudgetSection
          items={budgetItems}
          draft={budgetDraft}
          onCreateRequest={() =>
            openCreateDraft(
              isEditing ? (editingChat?.subject ?? "") : (watchedSubject ?? "")
            )
          }
          onEditRequest={openEditDraft}
          onDraftChange={setBudgetDraft}
          onSubmitDraft={submitDraft}
          onCancelDraft={cancelDraft}
        />
      )}

      <ScheduleActionModal
        open={nextOpen}
        onClose={() => setNextOpen(false)}
        defaults={nextDefaults}
        contacts={contacts}
        profileId={profileId}
        onSubmitNext={handleSubmitNext}
      />
    </div>
  );
};

export default EditActionForm;

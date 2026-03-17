/*
-- ===================================================
-- Código             : /src/components/cockpit/ScheduleActionModal.tsx
-- Versão (.v20)      : 1.4.1
-- Data/Hora          : 2025-11-11 22:55 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Modal "Registrar Próxima Ação" (apenas criação), padronizado:
--                      • Temperatura TitleCase ("Neutra" ...) em defaults/select/submit
--                      • Toast de Data/Hora inválida visível no modal
--                      • [UI] Compose "Descreva a Ação ou Conversa" posicionado logo após Assunto
--                      • Hora com TimePickerRHF (padrão do projeto)
-- Fluxo              : EditActionForm (+ Próxima ação) → ScheduleActionModal → chatsService.upsertChat
-- Alterações (1.4.1) :
--   • [UX] Reposiciona o compose (body) imediatamente após o campo Assunto.
--   • [SAFE] Sem mudanças funcionais adicionais.
-- Dependências        : "@/components/ui/TimePicker" (TimePickerRHF)
-- ===================================================
*/

import React, { useEffect, useMemo } from "react";
import clsx from "clsx";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import HierarchicalActionSelect from "@/components/ui/HierarchicalActionSelect";
import { useToast } from "@/contexts/ToastContext";
import { TimePickerRHF } from "@/components/ui/TimePicker";

import {
  ActionFormData,
  actionSchema,
  PRIORITY_OPTIONS,
  TEMPERATURE_OPTIONS,
} from "@/types/chat";
import * as chatsService from "@/services/chatsService";
import type { ContactWithChannels } from "@/types/cockpit";

type Dir = "outbound" | "inbound" | "internal" | null;

export interface ScheduleActionModalProps {
  open: boolean;
  onClose: () => void;
  primaryChatId?: string;
  defaults: {
    company_id: string;
    contact_id: string | null;
    subject?: string | null;
    seed_date?: string | null;
    seed_time?: string | null;
  };
  contacts: ContactWithChannels[];
  profileId?: string;
  onSubmitNext?: (data: ActionFormData) => Promise<void>;
}

type ActionOpt = {
  id: string;
  label: string;
  kind: "call" | "message" | "task";
  direction: Dir;
  channel_type:
    | "phone"
    | "whatsapp"
    | "email"
    | "orcamento"
    | "followup"
    | "visita"
    | "informacao"
    | "interna"
    | "almoco"
    | "reuniao"
    | null;
};

const ACTION_GROUPS: Array<{ group: string; options: ActionOpt[] }> = [
  {
    group: "Ligação",
    options: [
      { id: "call:outbound:phone", label: "Efetuada", kind: "call", direction: "outbound", channel_type: "phone" },
      { id: "call:inbound:phone",  label: "Recebida", kind: "call", direction: "inbound",  channel_type: "phone" },
    ],
  },
  {
    group: "Mensagem",
    options: [
      { id: "message:outbound:whatsapp", label: "Enviada (WhatsApp)",  kind: "message", direction: "outbound", channel_type: "whatsapp" },
      { id: "message:inbound:whatsapp",  label: "Recebida (WhatsApp)", kind: "message", direction: "inbound",  channel_type: "whatsapp" },
      { id: "message:outbound:email",    label: "Enviada (E-mail)",    kind: "message", direction: "outbound", channel_type: "email" },
      { id: "message:inbound:email",     label: "Recebida (E-mail)",   kind: "message", direction: "inbound",  channel_type: "email" },
    ],
  },
  {
    group: "Tarefa",
    options: [
      { id: "task:null:orcamento",  label: "Orçamento",  kind: "task", direction: null, channel_type: "orcamento" },
      { id: "task:null:followup",   label: "Follow-up",  kind: "task", direction: null, channel_type: "followup" },
      { id: "task:null:visita",     label: "Visita",     kind: "task", direction: null, channel_type: "visita" },
      { id: "task:null:informacao", label: "Informação", kind: "task", direction: null, channel_type: "informacao" },
      { id: "task:null:interna",    label: "Interna",    kind: "task", direction: null, channel_type: "interna" },
      { id: "task:null:almoco",     label: "Almoço",     kind: "task", direction: null, channel_type: "almoco" },
      { id: "task:null:reuniao",    label: "Reunião",    kind: "task", direction: null, channel_type: "reuniao" },
    ],
  },
];

const FLAT_OPTIONS: ActionOpt[] = ACTION_GROUPS.flatMap((g) => g.options);
const byId = new Map(FLAT_OPTIONS.map((o) => [o.id, o]));

function toTripleFromSelection(selectionId: string) {
  if (selectionId === "call")    return { kind: "call" as const,    direction: null as Dir,       channel_type: null as const };
  if (selectionId === "message") return { kind: "message" as const, direction: null as Dir,       channel_type: null as const };
  if (selectionId === "task")    return { kind: "task" as const,    direction: "internal" as Dir, channel_type: null as const };
  const opt = byId.get(selectionId);
  if (!opt) return { kind: "task" as const, direction: "internal" as Dir, channel_type: null as const };
  const dir = opt.kind === "task" ? "internal" : opt.direction;
  return { kind: opt.kind, direction: dir, channel_type: opt.channel_type };
}

const ScheduleActionModal: React.FC<ScheduleActionModalProps> = ({
  open,
  onClose,
  primaryChatId,
  defaults,
  contacts,
  profileId,
  onSubmitNext,
}) => {
  const { addToast, setModalScope } = useToast();

  useEffect(() => {
    if (open) setModalScope(true);
    return () => setModalScope(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const defaultValues = useMemo<ActionFormData>(() => {
    const now = new Date();
    const today = defaults.seed_date || now.toISOString().split("T")[0];
    const currentTime =
      defaults.seed_time ||
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const dv: ActionFormData = {
      action: "",
      contact_id: defaults.contact_id ?? (contacts[0]?.id ?? ""),
      company_id: defaults.company_id ?? "",
      subject: defaults.subject ?? "",
      body: "", // compose
      temperature: "Neutra",
      priority: "Normal",
      calendar_at: today,
      on_time: currentTime,
      is_done: false,
    };
    return dv;
  }, [defaults, contacts]);

  const { control, handleSubmit, formState, getValues, setValue } = useForm<ActionFormData>({
    resolver: zodResolver(actionSchema),
    defaultValues,
  });

  useEffect(() => {
    if (open) {
      setValue("company_id", defaults.company_id ?? "");
      setValue("temperature", (getValues("temperature") as any) || "Neutra");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaults.company_id]);

  const getFirstErrorMessage = (errors: any): string => {
    const order = ["company_id", "action", "contact_id", "subject", "calendar_at", "on_time", "priority"];
    for (const key of order) {
      const err = errors?.[key];
      if (err?.message) return String(err.message);
    }
    const flat = Object.values(errors) as any[];
    const withMsg = flat.find((e) => e && e.message);
    return withMsg?.message || "Verifique os campos obrigatórios.";
  };

  const validateDateTimeGTE = () => {
    const v = getValues();
    if (!v.calendar_at || !v.on_time) return false;
    const ts = new Date(`${v.calendar_at}T${v.on_time}:00`);
    if (isNaN(ts.getTime())) return false;
    const now = new Date();
    now.setSeconds(0, 0);
    return ts.getTime() >= now.getTime();
  };

  const persistInternallyIfNeeded = async (data: ActionFormData) => {
    if (onSubmitNext) return;
    if (!primaryChatId) {
      addToast("Fluxo legado sem primaryChatId para vínculo da próxima ação.", "error");
      return;
    }
    const triple = toTripleFromSelection(data.action);
    await chatsService.upsertChat({
      id: undefined,
      company_id: data.company_id,
      contact_id: data.contact_id,
      subject: data.subject,
      body: data.body,
      temperature: data.temperature ?? "Neutra",
      priority: data.priority,
      calendar_at: data.calendar_at,
      on_time: data.on_time,
      is_done: data.is_done,
      kind: triple.kind,
      direction: triple.direction,
      channel_type: triple.channel_type,
      reply_to_id: primaryChatId,
    } as any);
    try {
      window.dispatchEvent(new CustomEvent("cockpit:refreshHistory"));
      window.dispatchEvent(new CustomEvent("chats:changed"));
    } catch {}
  };

  const onSubmit = async (data: ActionFormData) => {
    if (!data.company_id || String(data.company_id).trim().length === 0) {
      addToast("Empresa inválida: abra o dossiê antes de registrar a próxima ação.", "error");
      return;
    }
    if (!data.action) { addToast("Selecione uma Ação.", "error"); return; }
    if (!data.contact_id) { addToast("Selecione um Contato.", "error"); return; }
    if (!data.subject || data.subject.trim().length < 2) { addToast("Informe o Assunto da ação.", "error"); return; }
    if (!data.calendar_at) { addToast("Informe a Data.", "error"); return; }
    if (!data.on_time) { addToast("Informe a Hora.", "error"); return; }

    const isDateValid = validateDateTimeGTE();
    if (!isDateValid) {
      addToast("Data/Hora menor que a data atual", "error");
      return;
    }

    data.temperature = data.temperature || "Neutra";

    try {
      if (onSubmitNext) {
        await onSubmitNext(data);
        addToast("Próxima ação registrada.", "success");
        setModalScope(false);
        onClose();
        return;
      }
      await persistInternallyIfNeeded(data);
      addToast("Próxima ação registrada.", "success");
      setModalScope(false);
      onClose();
    } catch (e: any) {
      addToast(e?.message || "Falha ao registrar a próxima ação.", "error");
      console.error("[ScheduleActionModal] onSubmit error:", e);
    }
  };

  const onInvalid = (errors: any) => {
    const msg = getFirstErrorMessage(errors);
    addToast(msg, "error");
  };

  const temperatureOptions = useMemo(() => TEMPERATURE_OPTIONS as string[], []);

  return (
    <Modal isOpen={open} onClose={() => { setModalScope(false); onClose(); }} title="Registrar Próxima Ação">
      <div id="modal-toast-portal" />

      <div className="mb-4">
        <div className="inline-flex items-center rounded-xl border border-green-600 text-green-700 px-3 py-2 select-none">
          <span className="w-2 h-2 rounded-full bg-green-600 mr-2" />
          <span className="text-sm font-semibold">Vinculada à ação atual</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
        {/* company_id hidden */}
        <Controller
          name="company_id"
          control={control}
          render={({ field }) => <input type="hidden" {...field} value={field.value ?? ""} />}
        />

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

          {/* Status toggle */}
          <div className="flex-shrink-0">
            <label className="block text-sm font-medium mb-1 text-transparent select-none sm:text-gray-600 dark:sm:text-gray-300">
              Status
            </label>
            <Controller
              name="is_done"
              control={control}
              render={({ field }) => (
                <div className="inline-flex rounded-xl overflow-hidden border border-dark-shadow dark:border-dark-dark-shadow select-none h-11">
                  <button
                    type="button"
                    onClick={() => field.onChange(false)}
                    className={clsx(
                      "px-4 text-sm font-semibold flex items-center",
                      !field.value
                        ? "bg-red-500 text-white"
                        : "bg-plate dark:bg-plate-dark text-gray-700 dark:text-gray-200"
                    )}
                  >
                    Andamento
                  </button>
                  <button
                    type="button"
                    onClick={() => field.onChange(true)}
                    className={clsx(
                      "px-4 text-sm font-semibold flex items-center",
                      field.value
                        ? "bg-green-600 text-white"
                        : "bg-plate dark:bg-plate-dark text-gray-700 dark:text-gray-200"
                    )}
                  >
                    Concluída
                  </button>
                </div>
              )}
            />
          </div>
        </div>

        {/* Linha: contato + assunto */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Contato*</label>
            <Controller
              name="contact_id"
              control={control}
              render={({ field }) => (
                <select
                  className="w-full h-11 px-4 rounded-lg bg-plate dark:bg-plate-dark neumorphic-concave focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={field.value}
                  onChange={field.onChange}
                >
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
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
                placeholder="Resumo da próxima ação..."
                {...field}
                error={fieldState.error?.message}
                className="h-11"
              />
            )}
          />
        </div>

        {/* Compose imediatamente após Assunto */}
        <div>
          <label className="block text-sm font-medium mb-1">Descreva a Ação ou Conversa</label>
          <Controller
            name="body"
            control={control}
            render={({ field }) => (
              <textarea
                {...field}
                placeholder="Descreva a Ação ou Conversa..."
                rows={4}
                className={clsx(
                  "w-full px-4 py-3 rounded-lg",
                  "bg-plate dark:bg-plate-dark neumorphic-concave",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50",
                  "resize-y min-h-[110px]"
                )}
              />
            )}
          />
        </div>

        {/* Linha: Data, Hora (TimePicker), Temperatura, Prioridade */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Controller
            name="calendar_at"
            control={control}
            render={({ field }) => (
              <Input type="date" label="Data*" {...field} className="h-11" />
            )}
          />
          <TimePickerRHF
            control={control}
            name={"on_time"}
            label="Hora*"
            minuteStep={5}
            side="bottom"
            sideOffset={6}
            align="start"
            className="h-11"
          />
          <div>
            <label className="block text-sm font-medium mb-1">Temperatura</label>
            <Controller
              name="temperature"
              control={control}
              render={({ field }) => (
                <select
                  className="w-full h-11 px-4 rounded-lg bg-plate dark:bg-plate-dark neumorphic-concave focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={field.value ?? "Neutra"}
                  onChange={(e) => field.onChange(e.target.value || "Neutra")}
                >
                  {temperatureOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
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
                  className="w-full h-11 px-4 rounded-lg bg-plate dark:bg-plate-dark neumorphic-concave focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value || "Normal")}
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}
            />
          </div>
        </div>

        <div className="flex justify-end items-center gap-2 pt-4 border-t border-dark-shadow dark:border-dark-dark-shadow">
          <Button type="button" variant="default" onClick={() => { setModalScope(false); onClose(); }}>
            Fechar
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={formState.isSubmitting}
            data-testid="schedule-next-submit"
          >
            Salvar próxima ação
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ScheduleActionModal;

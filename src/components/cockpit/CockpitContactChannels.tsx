import React, { useState } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabaseClient";
import type { ContactChannel, ChannelType } from "@/types/channel";
import { CHANNEL_TYPES } from "@/types/channel";

const channelSchema = z.object({
  type: z.enum(["email", "phone", "messaging", "link", "other"]),
  value: z.string().min(1, "Valor é obrigatório"),
  label_custom: z.string().nullable().optional(),
  is_preferred: z.boolean(),
});

type ChannelFormValues = z.infer<typeof channelSchema>;

const TABLE = "contacts_channel";
const BLANK: ChannelFormValues = { type: "phone", value: "", label_custom: "", is_preferred: false };

interface CockpitContactChannelsProps {
  contactId: string;
  currentChannels: ContactChannel[];
  onChannelsUpdated: (channels: ContactChannel[]) => void;
}

const CockpitContactChannels: React.FC<CockpitContactChannelsProps> = ({
  contactId,
  currentChannels,
  onChannelsUpdated,
}) => {
  const { addToast } = useToast();
  const { tenantId } = useAuth();
  const [channels, setChannels] = useState<ContactChannel[]>(currentChannels);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const addForm = useForm<ChannelFormValues>({ resolver: zodResolver(channelSchema), defaultValues: BLANK });
  const editForm = useForm<ChannelFormValues>({ resolver: zodResolver(channelSchema), defaultValues: BLANK });

  const openEdit = (ch: ContactChannel) => {
    setEditingId(ch.id);
    setShowAddForm(false);
    editForm.reset({ type: ch.type, value: ch.value, label_custom: ch.label_custom ?? "", is_preferred: ch.is_preferred });
  };

  const handleAdd = async (values: ChannelFormValues) => {
    if (!tenantId) { addToast("Sessão inválida. Faça login novamente.", "error"); return; }
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .insert({ tenant_id: tenantId, contact_id: contactId, type: values.type, value: values.value, label_custom: values.label_custom || null, is_preferred: values.is_preferred })
        .select("id, type, value, label_custom, is_preferred, created_at, updated_at, export_state")
        .single();
      if (error) throw error;
      const next = [...channels, data as ContactChannel];
      setChannels(next);
      onChannelsUpdated(next);
      addForm.reset(BLANK);
      setShowAddForm(false);
      addToast("Canal adicionado.", "success");
    } catch (e: any) {
      addToast(e?.message || "Falha ao adicionar canal.", "error");
    }
  };

  const handleUpdate = async (values: ChannelFormValues) => {
    if (!editingId) return;
    try {
      const { data, error } = await supabase
        .from(TABLE)
        .update({ type: values.type, value: values.value, label_custom: values.label_custom || null, is_preferred: values.is_preferred })
        .eq("id", editingId)
        .select("id, type, value, label_custom, is_preferred, created_at, updated_at, export_state")
        .single();
      if (error) throw error;
      const next = channels.map((ch) => ch.id === editingId ? (data as ContactChannel) : ch);
      setChannels(next);
      onChannelsUpdated(next);
      setEditingId(null);
      addToast("Canal atualizado.", "success");
    } catch (e: any) {
      addToast(e?.message || "Falha ao atualizar canal.", "error");
    }
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    try {
      const { error } = await supabase.from(TABLE).delete().eq("id", id);
      if (error) throw error;
      const next = channels.filter((ch) => ch.id !== id);
      setChannels(next);
      onChannelsUpdated(next);
      addToast("Canal removido.", "success");
    } catch (e: any) {
      addToast(e?.message || "Falha ao remover canal.", "error");
    } finally {
      setRemovingId(null);
    }
  };

  const typeLabel = (t: ChannelType) => CHANNEL_TYPES.find((ct) => ct.value === t)?.label ?? t;

  return (
    <div className="space-y-2">
      {channels.length === 0 && !showAddForm && (
        <p className="text-sm text-gray-500 dark:text-dark-t2">Nenhum canal cadastrado.</p>
      )}

      {channels.map((ch) =>
        editingId === ch.id ? (
          <div
            key={ch.id}
            className="border border-gray-200 dark:border-white/10 rounded-lg p-3 space-y-2"
          >
            <ChannelFields form={editForm} />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setEditingId(null)}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-dark-t2">
                <X className="h-3.5 w-3.5" /> Cancelar
              </button>
              <Button
                type="button"
                variant="primary"
                className="h-7 px-3 text-xs"
                loading={editForm.formState.isSubmitting}
                onClick={() => editForm.handleSubmit(handleUpdate)()}
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Salvar
              </Button>
            </div>
          </div>
        ) : (
          <div key={ch.id} className="flex items-center justify-between gap-2 text-sm py-1">
            <div className="flex items-center gap-2 min-w-0">
              {ch.is_preferred && <span className="h-2 w-2 rounded-full bg-orange-400 flex-shrink-0" title="Preferencial" />}
              <span className="text-xs text-gray-500 dark:text-dark-t2 flex-shrink-0">{typeLabel(ch.type)}</span>
              <span className="truncate font-medium text-gray-900 dark:text-dark-t1">{ch.value}</span>
              {ch.label_custom && <span className="text-xs text-gray-400 flex-shrink-0">– {ch.label_custom}</span>}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button type="button" onClick={() => openEdit(ch)}
                className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 hover:text-gray-700 dark:hover:text-dark-t1"
                title="Editar">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => handleRemove(ch.id)} disabled={removingId === ch.id}
                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 disabled:opacity-40"
                title="Remover">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )
      )}

      {showAddForm ? (
        <div className="border border-gray-200 dark:border-white/10 rounded-lg p-3 space-y-2 mt-2">
          <p className="text-xs font-medium text-gray-700 dark:text-dark-t1">Novo canal</p>
          <ChannelFields form={addForm} />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowAddForm(false)}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
              <X className="h-3.5 w-3.5" /> Cancelar
            </button>
            <Button
              type="button"
              variant="primary"
              className="h-7 px-3 text-xs"
              loading={addForm.formState.isSubmitting}
              onClick={() => addForm.handleSubmit(handleAdd)()}
            >
              Adicionar
            </Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { setShowAddForm(true); setEditingId(null); }}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:opacity-80 font-medium mt-1">
          <Plus className="h-3.5 w-3.5" /> Adicionar canal
        </button>
      )}
    </div>
  );
};

function ChannelFields({ form }: { form: UseFormReturn<ChannelFormValues> }) {
  const { register, formState: { errors } } = form;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium mb-0.5">Tipo</label>
          <select {...register("type")} className="input-field h-9 w-full text-sm">
            {CHANNEL_TYPES.map((ct) => (
              <option key={ct.value} value={ct.value}>{ct.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-0.5">Valor*</label>
          <input {...register("value")} className="input-field h-9 w-full text-sm" placeholder="(00) 00000-0000" />
          {errors.value && <p className="text-[10px] text-red-500 mt-0.5">{errors.value.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 items-center">
        <div>
          <label className="block text-xs font-medium mb-0.5">Rótulo (opcional)</label>
          <input {...register("label_custom")} className="input-field h-9 w-full text-sm" placeholder="Pessoal, Comercial..." />
        </div>
        <div className="flex items-center gap-2 pt-4">
          <input type="checkbox" id="ch_is_preferred" {...register("is_preferred")} className="h-4 w-4 rounded border-gray-300" />
          <label htmlFor="ch_is_preferred" className="text-xs text-gray-700 dark:text-dark-t1 cursor-pointer">Canal preferencial</label>
        </div>
      </div>
    </div>
  );
}

export default CockpitContactChannels;

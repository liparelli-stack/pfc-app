import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/contexts/ToastContext";
import { Button } from "@/components/ui/Button";
import { createContact, updateContact } from "@/services/contactsService";
import type { Contact } from "@/types/contact";

const schema = z.object({
  full_name: z.string().min(1, "Nome é obrigatório"),
  position: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  contact_guard: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]),
});

type FormValues = z.infer<typeof schema>;

const GUARD_OPTIONS = ["Principal", "Decisor", "Secundário", "Temporário"] as const;

interface CockpitEditContactFormProps {
  companyId: string;
  contactId?: string;
  initialData?: {
    full_name?: string;
    position?: string | null;
    department?: string | null;
    contact_guard?: string | null;
    status?: "active" | "inactive";
  };
  onSaved: (contact: Contact) => void;
  onCancel: () => void;
}

const CockpitEditContactForm: React.FC<CockpitEditContactFormProps> = ({
  companyId,
  contactId,
  initialData,
  onSaved,
  onCancel,
}) => {
  const { addToast } = useToast();
  const isCreating = !contactId;

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: {
        full_name: initialData?.full_name ?? "",
        position: initialData?.position ?? "",
        department: initialData?.department ?? "",
        contact_guard: initialData?.contact_guard ?? "Temporário",
        status: initialData?.status ?? "active",
      },
    });

  const onSubmit = async (values: FormValues) => {
    try {
      const payload: Partial<Contact> = {
        full_name: values.full_name,
        position: values.position || null,
        department: values.department || null,
        contact_guard: values.contact_guard || null,
        status: values.status,
      };

      let saved: Contact;
      if (isCreating) {
        saved = await createContact({ ...payload, company_id: companyId });
        addToast("Contato criado.", "success");
      } else {
        saved = await updateContact(contactId!, payload);
        addToast("Contato atualizado.", "success");
      }

      onSaved(saved);
    } catch (e: any) {
      addToast(e?.message || "Falha ao salvar contato.", "error");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Nome Completo*</label>
        <input
          {...register("full_name")}
          className="input-field h-10 w-full"
          placeholder="Nome do contato"
        />
        {errors.full_name && (
          <p className="text-xs text-red-500 mt-1">{errors.full_name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Cargo</label>
          <input
            {...register("position")}
            className="input-field h-10 w-full"
            placeholder="Diretor, Gerente..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Departamento</label>
          <input
            {...register("department")}
            className="input-field h-10 w-full"
            placeholder="Comercial, TI..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Tipo de Contato</label>
          <select {...register("contact_guard")} className="input-field h-10 w-full">
            {GUARD_OPTIONS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select {...register("status")} className="input-field h-10 w-full">
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="default" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          {isCreating ? "Criar Contato" : "Salvar"}
        </Button>
      </div>
    </form>
  );
};

export default CockpitEditContactForm;

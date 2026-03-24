import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/contexts/ToastContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { updateCompany } from "@/services/companiesService";
import type { Company } from "@/types/company";

const schema = z.object({
  trade_name: z.string().min(1, "Nome fantasia é obrigatório"),
  tax_id: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email("E-mail inválido").nullable().optional().or(z.literal("")),
  website: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

interface CockpitEditCompanyFormProps {
  companyId: string;
  initialData: {
    trade_name: string;
    tax_id?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  };
  onSaved: (updated: Company) => void;
  onCancel: () => void;
}

const CockpitEditCompanyForm: React.FC<CockpitEditCompanyFormProps> = ({
  companyId,
  initialData,
  onSaved,
  onCancel,
}) => {
  const { addToast } = useToast();

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: {
        trade_name: initialData.trade_name ?? "",
        tax_id: initialData.tax_id ?? "",
        phone: initialData.phone ?? "",
        email: initialData.email ?? "",
        website: initialData.website ?? "",
      },
    });

  const onSubmit = async (values: FormValues) => {
    try {
      const updated = await updateCompany(companyId, {
        trade_name: values.trade_name,
        tax_id: values.tax_id || null,
        phone: values.phone || null,
        email: values.email || null,
        website: values.website || null,
      });
      addToast("Empresa atualizada.", "success");
      onSaved(updated);
    } catch (e: any) {
      addToast(e?.message || "Falha ao atualizar empresa.", "error");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Nome Fantasia*</label>
        <input
          {...register("trade_name")}
          className="input-field h-10 w-full"
          placeholder="Nome fantasia"
        />
        {errors.trade_name && (
          <p className="text-xs text-red-500 mt-1">{errors.trade_name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">CNPJ</label>
        <input
          {...register("tax_id")}
          className="input-field h-10 w-full"
          placeholder="00.000.000/0001-00"
          maxLength={18}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Telefone</label>
          <input
            {...register("phone")}
            className="input-field h-10 w-full"
            placeholder="(00) 00000-0000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">E-mail</label>
          <input
            {...register("email")}
            className="input-field h-10 w-full"
            placeholder="contato@empresa.com"
            type="email"
          />
          {errors.email && (
            <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Website</label>
        <input
          {...register("website")}
          className="input-field h-10 w-full"
          placeholder="www.empresa.com"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="default" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          Salvar
        </Button>
      </div>
    </form>
  );
};

export default CockpitEditCompanyForm;

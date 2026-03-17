/*
-- ===================================================
-- Código                 : /src/components/support/TicketForm.tsx
-- Versão (.v20)         : 2.0.0
-- Data/Hora             : 2025-12-18 18:05
-- Autor                 : FL / Execução via EVA
-- Objetivo              : Formulário de abertura de chamado (modelo novo, sem legado)
-- Alterações (2.0.0)    :
--  • Corrigidos defaultValues (fix/normal)
--  • Labels PT-BR desacoplados dos values
--  • Alinhado com constraints + RLS
-- ===================================================
*/
import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import { Ticket, ticketSchema, TicketAttachment } from '@/types/ticket';
import { createTicket, updateTicket, uploadAttachment } from '@/services/ticketsService';
import { useToast } from '@/contexts/ToastContext';

import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Upload, X } from 'lucide-react';

interface TicketFormProps {
  onSave: () => void;
  onCancel: () => void;
}

/* ======================= OPÇÕES (LABEL ≠ VALUE) ======================= */
const TYPE_OPTIONS = [
  { value: 'fix', label: 'Correção' },
  { value: 'improvement', label: 'Melhoria' },
  { value: 'question', label: 'Dúvida' },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Urgente' },
] as const;

const TicketForm: React.FC<TicketFormProps> = ({ onSave, onCancel }) => {
  const { addToast } = useToast();
  const [files, setFiles] = useState<File[]>([]);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<Ticket>({
    resolver: zodResolver(
      ticketSchema.pick({
        subject: true,
        description: true,
        type: true,
        priority: true,
      })
    ),
    defaultValues: {
      subject: '',
      description: '',
      type: 'fix',       // ✅ CORRETO
      priority: 'normal' // ✅ CORRETO
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFiles(prev => [...prev, ...Array.from(event.target.files)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (
    formData: Pick<Ticket, 'subject' | 'description' | 'type' | 'priority'>
  ) => {
    try {
      // 1) Cria o ticket
      const newTicket = await createTicket(formData);

      // 2) Upload de anexos (opcional)
      if (files.length > 0) {
        const uploaded: TicketAttachment[] = [];
        for (const file of files) {
          const meta = await uploadAttachment(newTicket.id!, file);
          uploaded.push(meta);
        }

        await updateTicket(newTicket.id!, { attachments: uploaded });
      }

      addToast('Chamado aberto com sucesso!', 'success');
      onSave();
    } catch (error: any) {
      console.error(error);
      addToast(error?.message || 'Erro ao abrir chamado.', 'error');
    }
  };

  return (
    <div className="bg-plate dark:bg-plate-dark rounded-2xl p-8 neumorphic-convex">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
        Abrir Novo Chamado
      </h2>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Controller
          name="subject"
          control={control}
          render={({ field }) => (
            <Input
              label="Assunto"
              {...field}
              error={errors.subject?.message}
            />
          )}
        />

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">
            Descrição
          </label>
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <textarea
                {...field}
                rows={6}
                className="w-full p-3 rounded-lg bg-plate dark:bg-plate-dark neumorphic-concave focus:bg-white dark:focus:bg-gray-700 outline-none"
              />
            )}
          />
          {errors.description && (
            <p className="text-red-500 text-xs mt-1">
              {errors.description.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select label="Tipo" {...field}>
                {TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            )}
          />

          <Controller
            name="priority"
            control={control}
            render={({ field }) => (
              <Select label="Prioridade" {...field}>
                {PRIORITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            )}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-600 dark:text-gray-300">
            Anexos
          </label>

          <div className="relative border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-primary transition-colors">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Arraste e solte ou clique para selecionar
            </p>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded-lg bg-dark-shadow/50 dark:bg-dark-dark-shadow/50"
                >
                  <span className="text-sm truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="p-1 rounded-full hover:bg-red-500/20"
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t border-dark-shadow dark:border-dark-dark-shadow">
          <Button type="button" variant="default" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Abrir Chamado
          </Button>
        </div>
      </form>
    </div>
  );
};

export default TicketForm;

/*
-- ===================================================
-- Código             : /src/components/catalogs/TagForm.tsx
-- Versão (.v20)      : 3.1.0
-- Data/Hora          : 2025-12-06 12:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Adicionar o campo "Origem" (user/system) ao formulário.
-- Alterações (3.1.0) :
--   • [FEAT] Adicionado campo "Origem" (Select) com as opções "Usuário" e "Sistema".
--   • [VALIDATION] O campo "Origem" agora é obrigatório no schema de validação.
-- Dependências       : react, react-hook-form, zod, @/components/ui/*, @/services/tagsService
-- ===================================================
*/

import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/contexts/ToastContext';
import { Tag, TagOrigin } from '@/types/tag';
import { createTag, updateTag } from '@/services/tagsService';

const tagFormSchema = z.object({
  name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres.'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida. Use o formato hexadecimal.').nullable().optional(),
  tag_group: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
  origin: z.enum(['user', 'system'], { required_error: 'A origem é obrigatória.' }),
});

type TagFormData = z.infer<typeof tagFormSchema>;

interface TagFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tag: Tag) => void;
  initialData: Partial<Tag> | null;
}

const TagForm: React.FC<TagFormProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const { addToast } = useToast();
  const isEditing = !!initialData?.id;

  const { control, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm<TagFormData>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: {
      name: '',
      color: '#4A90E2',
      tag_group: '',
      is_active: true,
      origin: 'user',
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          name: initialData.name || '',
          color: initialData.color || '#4A90E2',
          tag_group: initialData.tag_group || '',
          is_active: initialData.is_active ?? true,
          origin: initialData.origin || 'user',
        });
      } else {
        reset({
          name: '',
          color: '#4A90E2',
          tag_group: '',
          is_active: true,
          origin: 'user',
        });
      }
    }
  }, [isOpen, initialData, reset]);

  const onSubmit = async (formData: TagFormData) => {
    try {
      let savedTag: Tag;
      if (isEditing) {
        savedTag = await updateTag(initialData!.id!, {
          name: formData.name,
          color: formData.color,
          tag_group: formData.tag_group,
          is_active: formData.is_active,
          origin: formData.origin,
        });
        addToast('Etiqueta atualizada com sucesso!', 'success');
      } else {
        savedTag = await createTag({
          name: formData.name,
          color: formData.color,
          tag_group: formData.tag_group,
          is_active: formData.is_active,
          origin: formData.origin,
        });
        addToast('Etiqueta criada com sucesso!', 'success');
      }
      onSave(savedTag);
      onClose();
    } catch (error: any) {
      addToast(error.message || 'Falha ao salvar etiqueta.', 'error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Editar Etiqueta' : 'Nova Etiqueta'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <Input label="Nome da Etiqueta*" {...field} error={errors.name?.message} />
          )}
        />
        <Controller
          name="origin"
          control={control}
          render={({ field }) => (
            <Select label="Origem*" {...field} error={errors.origin?.message}>
              <option value="user">Usuário</option>
              <option value="system">Sistema</option>
            </Select>
          )}
        />
        <Controller
          name="tag_group"
          control={control}
          render={({ field }) => (
            <Input label="Grupo" {...field} value={field.value ?? ''} placeholder="Ex: Comercial, Suporte" />
          )}
        />
        <div>
          <label htmlFor="color-picker" className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">Cor</label>
          <Controller
            name="color"
            control={control}
            render={({ field }) => (
              <input
                id="color-picker"
                type="color"
                {...field}
                value={field.value || '#4A90E2'}
                className="w-full h-10 p-1 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
            )}
          />
          {errors.color && <p className="text-red-500 text-xs mt-1">{errors.color.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">Status</label>
          <div className="flex items-center justify-between rounded-lg p-3 neumorphic-convex">
            <span className="font-medium text-sm text-gray-600 dark:text-gray-300">Ativa</span>
            <Controller
              name="is_active"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="default" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>Salvar</Button>
        </div>
      </form>
    </Modal>
  );
};

export default TagForm;

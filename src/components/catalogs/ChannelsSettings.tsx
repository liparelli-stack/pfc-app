/*
================================================================================
Código: /src/components/catalogs/ChannelsSettings.tsx
Versão: 1.4.0
Data/Hora: 2025-10-12 17:55
Autor: FL / Execução via você "AD"
Objetivo: Eliminar “movimento fantasma” do switch e melhorar UX:
          - Remover autosave via watch (causava re-render competitivo)
          - Toggle sem debounce e com bloqueio por item
          - Debounce apenas no label_custom (texto)
          - Atualização local de updated_at (sem fetch)
          - Rótulos PT-BR (“Outros”, “Telefone”, etc.)
Fluxo: Renderizado por CatalogsPage.tsx.
Dependências: React, react-hook-form, zod, @hookform/resolvers/zod, lodash-es,
              services channelsService, componentes UI.
Regras de Negócio:
  - Salvar is_enabled imediatamente ao clicar (sem debounce)
  - Salvar label_custom com debounce (750ms)
  - Reset mantém refresh silencioso (sem Skeleton)
Diretrizes:
  - [Diretriz 1] Não integrar/alterar Auth do Supabase.
  - [Diretriz 2] Sem requisitos extras além do plano Free.
================================================================================
*/

import { useEffect, useState, useCallback } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { listChannels, updateChannel, resetChannels } from '@/services/channelsService';
import type { Channel } from '@/types/channel';
import { useToast } from '@/contexts/ToastContext';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Mail, Phone, MessageSquare, Link, Pencil, LucideIcon } from 'lucide-react';
import { debounce } from 'lodash-es';

// [--BLOCO--] Mapeamento de ícones por tipo de canal
const channelIcons: Record<Channel['kind'], LucideIcon> = {
  email: Mail,
  phone: Phone,
  instant_message: MessageSquare,
  url: Link,
  other: Pencil,
};

// [--BLOCO--] Rótulos PT-BR
const kindLabels: Record<Channel['kind'], string> = {
  email: 'E-mail',
  phone: 'Telefone',
  instant_message: 'Mensageria',
  url: 'Link',
  other: 'Outros',
};

// [--BLOCO--] Schema do formulário
const formSchema = z.object({
  channels: z.array(z.object({
    id: z.string().uuid(),
    kind: z.string(),
    label_custom: z.string().nullable().optional(),
    is_enabled: z.boolean(),
    updated_at: z.string().optional(),
  }))
});

type FormValues = z.infer<typeof formSchema>;

const ChannelsSettings = () => {
  const { addToast } = useToast();

  // [--BLOCO--] Estados
  const [isLoading, setIsLoading] = useState(true);  // Skeleton apenas no boot
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [booted, setBooted] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<Set<string>>(new Set()); // por item

  // [--BLOCO--] RHF
  const { control, reset, setValue } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { channels: [] },
  });

  // [--TÉCNICA--] UseFieldArray com keyName estável
  const { fields } = useFieldArray({ control, name: 'channels', keyName: '_key' });

  // [--BLOCO--] Fetch com modo silencioso após boot
  const fetchChannels = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await listChannels();
      // serviço já ordena por kind; redundância segura:
      data.sort((a, b) => a.kind.localeCompare(b.kind));
      reset({ channels: data });
    } catch (error) {
      addToast('Erro ao carregar os canais.', 'error');
    } finally {
      setIsLoading(false);
      if (!booted) setBooted(true);
    }
  }, [reset, addToast, booted]);

  // [--BLOCO--] Boot
  useEffect(() => {
    fetchChannels(false);
  }, [fetchChannels]);

  // [--BLOCO--] Debounce apenas para label_custom (texto)
  const debouncedLabelUpdate = useCallback(
    debounce(async (id: string, value: string, formIndex: number) => {
      try {
        await updateChannel(id, { label_custom: value });
        setValue(`channels.${formIndex}.updated_at`, new Date().toISOString(), { shouldDirty: false });
      } catch {
        addToast('Erro ao atualizar o canal.', 'error');
      }
    }, 750),
    [addToast, setValue]
  );

  // [--BLOCO--] Handler do switch (sem debounce + bloqueio por item)
  const handleToggle = useCallback(async (id: string, formIndex: number, nextVal: boolean) => {
    // otimismo: atualiza form de imediato
    setValue(`channels.${formIndex}.is_enabled`, nextVal, { shouldDirty: true });

    // bloqueia apenas o item enquanto salva
    setPendingSwitch(prev => new Set(prev).add(id));
    try {
      await updateChannel(id, { is_enabled: nextVal });
      setValue(`channels.${formIndex}.updated_at`, new Date().toISOString(), { shouldDirty: false });
    } catch {
      // rollback visual em caso de erro
      setValue(`channels.${formIndex}.is_enabled`, !nextVal, { shouldDirty: true });
      addToast('Erro ao atualizar o canal.', 'error');
    } finally {
      setPendingSwitch(prev => {
        const clone = new Set(prev);
        clone.delete(id);
        return clone;
      });
    }
  }, [setValue, addToast]);

  // [--BLOCO--] Reset ao padrão (silencioso)
  const handleReset = async () => {
    setIsSubmitting(true);
    try {
      await resetChannels();
      addToast('Canais resetados para o padrão.', 'success');
      await fetchChannels(true);
    } catch (error) {
      addToast('Erro ao resetar os canais.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // [--BLOCO--] Utilitário de data
  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  // [--BLOCO--] Skeleton apenas no boot
  if (isLoading && !booted) {
    return (
      <div className="bg-plate dark:bg-dark-s1 rounded-2xl p-8 neumorphic-convex space-y-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-dark-t1 mb-6">
          Canais de Comunicação
        </h2>
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  // [--BLOCO--] UI
  return (
    <div className="bg-plate dark:bg-dark-s1 rounded-2xl p-4 sm:p-8 neumorphic-convex">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-dark-t1 mb-6">
        Canais de Comunicação
      </h2>

      <div className="space-y-4">
        {fields.map((field, index) => {
          const Icon = channelIcons[field.kind as Channel['kind']] || Pencil;
          const label = kindLabels[field.kind as Channel['kind']] ?? String(field.kind);
          const isWaiting = pendingSwitch.has(field.id as string);

          return (
            <div
              key={field.id ?? field._key ?? `${field.kind}-${index}`}
              className="grid grid-cols-[auto,1fr,1fr,auto,auto] items-center gap-4 p-3 neumorphic-convex rounded-lg"
            >
              {/* Ícone */}
              <Icon className="h-6 w-6 text-primary" />

              {/* Kind (PT-BR) */}
              <span className="font-semibold">{label}</span>

              {/* Campo 'Outros' com label_custom */}
              <div>
                {field.kind === 'other' && (
                  <Controller
                    name={`channels.${index}.label_custom`}
                    control={control}
                    render={({ field: inputField }) => (
                      <Input
                        label=""
                        placeholder="Nome do Outro Canal"
                        {...inputField}
                        value={inputField.value ?? ''}
                        className="!py-2"
                        onChange={(e) => {
                          const v = e?.target?.value ?? '';
                          inputField.onChange(v);
                          debouncedLabelUpdate(field.id as string, v, index);
                        }}
                      />
                    )}
                  />
                )}
              </div>

              {/* Updated at */}
              <div className="text-xs text-gray-500 dark:text-dark-t2 text-right">
                Últ. atualização: <br /> {formatDate(field.updated_at)}
              </div>

              {/* Switch is_enabled (sem debounce) */}
              <Controller
                name={`channels.${index}.is_enabled`}
                control={control}
                render={({ field: switchField }) => (
                  <Switch
                    checked={!!switchField.value}
                    disabled={isWaiting || isSubmitting}
                    onCheckedChange={(val) => {
                      // RHF + salvamento imediato controlado
                      switchField.onChange(val);
                      void handleToggle(field.id as string, index, val);
                    }}
                  />
                )}
              />
            </div>
          );
        })}
      </div>

      {/* Rodapé / Reset */}
      <div className="flex justify-end mt-8 pt-6 border-t border-dark-shadow dark:border-dark-dark-shadow">
        <Button onClick={handleReset} variant="default" isLoading={isSubmitting}>
          Resetar Padrão
        </Button>
      </div>
    </div>
  );
};

export default ChannelsSettings;

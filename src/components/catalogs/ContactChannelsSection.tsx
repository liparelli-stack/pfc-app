/*
================================================================================
Código: /src/components/catalogs/ContactChannelsSection.tsx
Versão: 1.4.0
Data/Hora: 2025-10-16 10:00 -03
Autor: Dualite Alpha (AD)
Objetivo: Reorganizar o layout do painel para ser totalmente responsivo e
          evitar a sobreposição de campos.
Regras:
  - Usar um grid de 12 colunas com breakpoints para mobile, tablet e desktop.
  - Agrupar campos logicamente para melhorar a visualização.
================================================================================
*/

import React, { useMemo, useState } from 'react';
import { useContactChannels } from '@/hooks/useContactChannels';
import { CHANNEL_TYPES, CONTACT_GUARD, type ChannelItem } from '@/types/channel';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { X, Plus, Save, RotateCcw } from 'lucide-react';

type Props = {
  contactId: string;
};

type Draft = Partial<ChannelItem>;
type DraftMap = Record<string, Draft>;

const ContactChannelsSection: React.FC<Props> = ({ contactId }) => {
  const {
    channels,
    loading,
    saving,
    error,
    refresh,
    addChannel,
    updateChannel,
    removeChannel,
  } = useContactChannels(contactId);

  const [drafts, setDrafts] = useState<DraftMap>({});

  const sorted = useMemo(
    () => [...channels].sort((a, b) => a.type.localeCompare(b.type, undefined, { sensitivity: 'base' })),
    [channels]
  );

  const isDirty = (id: string) => {
    const d = drafts[id];
    return !!(d && Object.keys(d).length > 0);
  };

  const setDraft = (id: string, patch: Draft) => {
    setDrafts((prev) => {
      const next: DraftMap = { ...prev };
      const current = next[id] ?? {};
      next[id] = { ...current, ...patch };
      return next;
    });
  };

  const resetDraft = (id: string) => {
    setDrafts((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const currentLabel = (item: ChannelItem) =>
    drafts[item.id]?.label ?? item.label ?? { code: 'A', custom: '' };

  const view = <K extends keyof ChannelItem>(item: ChannelItem, key: K): ChannelItem[K] =>
    (drafts[item.id]?.[key] as ChannelItem[K]) ?? item[key];

  const handleSave = async (item: ChannelItem) => {
    const patch = drafts[item.id];
    if (!patch || Object.keys(patch).length === 0) return;
    await updateChannel(item.id, patch);
    resetDraft(item.id);
  };

  const handleAdd = async () => {
    await addChannel({});
  };

  const isEmpty = sorted.length === 0;

  return (
    <section className="neumorphic-convex rounded-2xl p-4 sm:p-6 mt-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white">Canais de Comunicação</h3>
        <div className="flex items-center gap-2">
          <Button type="button" variant="default" onClick={refresh} disabled={loading || saving}>
            Recarregar
          </Button>
          <Button type="button" variant="primary" onClick={handleAdd} disabled={loading || saving}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-red-500">{error}</div>}

      {loading ? (
        <div className="text-sm text-gray-500 dark:text-gray-400">Carregando canais…</div>
      ) : isEmpty ? (
        <div className="w-full bg-plate dark:bg-plate-dark rounded-2xl p-6 neumorphic-convex flex items-center justify-between">
          <p className="text-gray-500 dark:text-gray-400">Nenhum canal adicionado.</p>
          <Button type="button" variant="primary" onClick={handleAdd} disabled={saving}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Canal
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((item) => {
            const label = currentLabel(item);
            const dirty = isDirty(item.id);

            return (
              <div
                key={item.id}
                className="rounded-2xl p-4 neumorphic-convex border border-dark-shadow/40 dark:border-dark-dark-shadow/40"
              >
                <div className="grid grid-cols-12 gap-4 items-start">
                  {/* Tipo */}
                  <div className="col-span-12 sm:col-span-6 md:col-span-3 lg:col-span-2">
                    <Select
                      label="Tipo*"
                      value={view(item, 'type')}
                      onChange={(e) =>
                        setDraft(item.id, { type: e.target.value as ChannelItem['type'] })
                      }
                    >
                      {CHANNEL_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {/* Papel (guard) */}
                  <div className="col-span-12 sm:col-span-6 md:col-span-3 lg:col-span-2">
                    <Select
                      label="Papel*"
                      value={view(item, 'guard')}
                      onChange={(e) =>
                        setDraft(item.id, { guard: e.target.value as ChannelItem['guard'] })
                      }
                    >
                      {CONTACT_GUARD.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {/* Valor */}
                  <div className="col-span-12 md:col-span-6 lg:col-span-4">
                    <Input
                      label="Valor (opcional)"
                      value={view(item, 'value') ?? ''}
                      onChange={(e) => setDraft(item.id, { value: e.target.value })}
                      placeholder={
                        item.type === 'email'
                          ? 'email@exemplo.com'
                          : item.type === 'phone'
                          ? '+55 11 99999-9999'
                          : 'valor do canal'
                      }
                    />
                  </div>

                  {/* Switches */}
                  <div className="col-span-12 lg:col-span-4">
                     <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">Opções</label>
                     <div className="grid grid-cols-2 gap-2 h-[46px]">
                        <div className="flex items-center justify-between rounded-lg px-3 py-2 neumorphic-convex">
                            <span className="text-sm text-gray-600 dark:text-gray-300 pr-3">Principal</span>
                            <Switch
                                checked={!!(drafts[item.id]?.is_primary ?? item.is_primary)}
                                onCheckedChange={(checked) => setDraft(item.id, { is_primary: checked })}
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-lg px-3 py-2 neumorphic-convex">
                            <span className="text-sm text-gray-600 dark:text-gray-300 pr-3">Ativo</span>
                            <Switch
                                checked={!!(drafts[item.id]?.active ?? item.active)}
                                onCheckedChange={(checked) => setDraft(item.id, { active: checked })}
                            />
                        </div>
                     </div>
                  </div>

                  {/* Label code */}
                  <div className="col-span-12 sm:col-span-6 md:col-span-3">
                    <Input
                      label="Label code"
                      value={label.code ?? 'A'}
                      onChange={(e) => setDraft(item.id, { label: { ...label, code: e.target.value } })}
                      placeholder="A | B | C ..."
                    />
                  </div>
                  
                  {/* Label custom */}
                  <div className="col-span-12 sm:col-span-6 md:col-span-3">
                    <Input
                      label={view(item, 'type') === 'other' ? 'Label custom*' : 'Label custom'}
                      value={label.custom ?? ''}
                      onChange={(e) =>
                        setDraft(item.id, { label: { ...label, custom: e.target.value } })
                      }
                      placeholder={view(item, 'type') === 'other' ? 'Descreva o tipo' : 'Opcional'}
                    />
                  </div>

                  {/* Notas */}
                  <div className="col-span-12 md:col-span-6">
                    <Input
                      label="Notas"
                      value={view(item, 'notes') ?? ''}
                      onChange={(e) => setDraft(item.id, { notes: e.target.value })}
                      placeholder="Observações sobre este canal"
                    />
                  </div>

                  {/* Ações por linha */}
                  <div className="col-span-12 flex justify-end items-center gap-2 mt-2">
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => removeChannel(item.id)}
                      title="Remover canal"
                      className="!p-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>

                    <Button
                      type="button"
                      variant="default"
                      onClick={() => resetDraft(item.id)}
                      disabled={!dirty || saving}
                      title="Descartar alterações"
                    >
                      <RotateCcw className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Descartar</span>
                    </Button>

                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => handleSave(item)}
                      disabled={!dirty || saving}
                      title="Salvar alterações"
                    >
                      <Save className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Salvar</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rodapé */}
      <div className="mt-4 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        {saving && <span>Salvando…</span>}
        {!saving && !loading && <span>{channels.length} canal(is)</span>}
      </div>
    </section>
  );
};

export default ContactChannelsSection;

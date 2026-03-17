/*
================================================================================
Código: /src/components/catalogs/ContactChannelsModal.tsx
Versão: 2.3.0
Data/Hora: 2025-11-12 19:10 -03
Autor: FL / Eva (E.V.A.)
Objetivo:
  - Garantir feedback VISÍVEL após salvar canais (Salvar / Fechar / ESC / X),
    usando SEMPRE o escopo GLOBAL de toast.
  - Manter fluxo atual:
      • Fechar continua salvando + limpando vazios quando houver alterações.
      • ESC e botão "X" usam o mesmo fluxo de fechamento.
Alterações (2.3.0):
  - Removido uso de setModalScope neste modal específico.
  - Removido <div id="modal-toast-portal" /> local.
  - Todas as chamadas de addToast usam scope: 'global' explicitamente.
================================================================================
*/

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CHANNEL_TYPES, type ContactChannel } from '@/types/channel';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { X, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { useContactChannels } from '@/hooks/useContactChannels';

type Props = { contactId: string; open: boolean; onClose: () => void };

const NEW_ID_PREFIX = 'tmp-';

// [--BLOCO--] Peso por tipo (alinha com hook/useContactChannels)
const TYPE_WEIGHT: Record<string, number> = {
  email: 10,
  whatsapp: 20,
  phone: 30,
  mobile: 35,
  site: 40,
  website: 40,
  linkedin: 50,
  instagram: 60,
  other: 90,
  outros: 90,
};

const getTypeWeight = (t?: string) => {
  const key = String(t || '').toLowerCase().trim();
  return TYPE_WEIGHT[key] ?? 80;
};

// [--TÉCNICA--] Ordenação determinística local (type_weight → created_at → value)
function sortDeterministic(a: ContactChannel, b: ContactChannel) {
  const wa = getTypeWeight(a.type);
  const wb = getTypeWeight(b.type);
  if (wa !== wb) return wa - wb;

  const ca = a.created_at ?? '';
  const cb = b.created_at ?? '';
  if (ca !== cb) return ca.localeCompare(cb);

  const va = (a.value ?? '').toString();
  const vb = (b.value ?? '').toString();
  return va.localeCompare(vb);
}

const newItem = (): ContactChannel => ({
  id: `${NEW_ID_PREFIX}${crypto.randomUUID()}`,
  type: 'phone',
  value: '',
  label_custom: '',
  is_preferred: false,
  notes: '',
  verified_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  export_state: 'Create',
});

const isEmptyForAutodrop = (c: ContactChannel): boolean => {
  const createdNow = String(c.id).startsWith(NEW_ID_PREFIX);
  const noValue = !c.value || c.value.trim() === '';
  const noNotes = !c.notes || c.notes.trim() === '';
  const noCustom = !c.label_custom || c.label_custom.trim() === '';
  return createdNow && noValue && noNotes && noCustom;
};

// [--TÉCNICA--] Formatação dd/MM/yyyy HH:mm para "Criado em"
function formatDateTime(iso?: string | null) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch {
    return String(iso);
  }
}

// Util: encontra (ou cria) o root de portais da app
function ensurePortalRoot(): HTMLElement {
  if (typeof document === 'undefined') return ({} as any);
  let el = document.getElementById('app-modal-root') as HTMLElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-modal-root';
    el.style.position = 'relative';
    el.style.zIndex = '90';
    document.body.appendChild(el);
  }
  return el;
}

const ContactChannelsModal: React.FC<Props> = ({ contactId, open, onClose }) => {
  const { addToast } = useToast();
  const {
    channels: sourceChannels,
    loading: loadingHook,
    saving: savingHook,
    error: hookError,
    replaceAll,
    refresh,
  } = useContactChannels(contactId);

  const [rows, setRows] = useState<ContactChannel[]>([]);
  const [dirty, setDirty] = useState(false);
  const [firstSyncDone, setFirstSyncDone] = useState(false);

  const loading = loadingHook;
  const saving = savingHook;
  const error = hookError;

  const sorted = useMemo(() => [...rows].sort(sortDeterministic), [rows]);

  // Reset do prime a cada abertura
  useEffect(() => {
    if (open) setFirstSyncDone(false);
  }, [open]);

  // Prime: copia do hook para buffer uma vez por abertura
  useEffect(() => {
    if (!open) return;
    if (!loading && !firstSyncDone) {
      setRows(sourceChannels ?? []);
      setDirty(false);
      setFirstSyncDone(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading, firstSyncDone]);

  // [--BLOCO--] Tecla ESC para fechar (com salvar)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose().catch(() => {});
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const touch = () => setDirty(true);
  const patch = (id: string, change: Partial<ContactChannel>) => {
    setRows(prev => prev.map(c => (c.id === id ? { ...c, ...change } : c)));
    touch();
  };
  const add = () => { setRows(prev => [...prev, newItem()]); touch(); };
  const remove = (id: string) => { setRows(prev => prev.filter(c => c.id !== id)); touch(); };

  const saveAll = useCallback(async () => {
    const cleaned = rows.filter(c => !isEmptyForAutodrop(c));
    // Normaliza campos opcionais e garante tipos
    const validated: ContactChannel[] = cleaned.map(c => ({
      ...c,
      type: (c.type || 'phone') as ContactChannel['type'],
      value: c.value ?? '',
      label_custom: (c.label_custom ?? '') || null,
      is_preferred: !!c.is_preferred,
      notes: (c.notes ?? '') || null,
      verified_at: c.verified_at ?? null,
      export_state: c.export_state ?? 'Create',
      created_at: c.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    const saved = await replaceAll(validated);
    if (saved) {
      setRows(saved);
      setDirty(false);
    }
    return saved;
  }, [rows, replaceAll]);

  const handleReload = useCallback(async () => {
    await refresh();
    setRows(prev => {
      const src = sourceChannels ?? [];
      const sameLen = prev.length === src.length;
      const sameIds = sameLen && prev.every((p, i) => p.id === src[i]?.id);
      return sameLen && sameIds ? prev : src;
    });
    setDirty(false);
  }, [refresh, sourceChannels]);

  const handleSaveClick = useCallback(async () => {
    try {
      await saveAll();
      addToast('Canais salvos com sucesso.', 'success', { scope: 'global' });
    } catch {
      addToast('Erro ao salvar os canais.', 'error', { scope: 'global' });
    }
  }, [saveAll, addToast]);

  const handleClose = useCallback(async () => {
    // Se nada foi alterado, apenas fecha.
    if (!dirty) {
      onClose();
      return;
    }

    try {
      await saveAll();
      addToast('Canais salvos com sucesso.', 'success', { scope: 'global' });
    } catch {
      addToast('Erro ao salvar os canais.', 'error', { scope: 'global' });
    } finally {
      onClose();
    }
  }, [dirty, saveAll, onClose, addToast]);

  if (!open) return null;

  // Render via PORTAL
  const portalRoot = ensurePortalRoot();
  const titleId = 'modal-contacts-channels-title';

  const modalTree = (
    <div className="fixed inset-0 z-[120] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* Modal */}
      <div
        className="relative z-[121] w-[min(1024px,95vw)] max-h-[90vh] overflow-hidden rounded-2xl bg-plate dark:bg-plate-dark neumorphic-convex"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-shadow/40 dark:border-dark-dark-shadow/40">
          <h3 id={titleId} className="text-lg font-bold text-gray-100">Canais de Comunicação</h3>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="default"
              onClick={handleReload}
              disabled={loading || saving}
              aria-label="Recarregar canais do contato"
              title="Recarregar"
            >
              Recarregar
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={add}
              disabled={loading || saving}
              aria-label="Adicionar novo canal"
              title="Adicionar novo canal"
            >
              <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
              Adicionar
            </Button>
            <button
              className="ml-2 p-2 rounded-full hover:bg-dark-shadow/60 transition focus:outline-none focus:ring-2 focus:ring-slate-400/60"
              aria-label="Fechar modal de canais (salva e limpa vazios)"
              onClick={handleClose}
              title="Fechar (salva e limpa vazios)"
              disabled={saving}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Região de erro (aria-live) */}
        <div className="sr-only" aria-live="assertive">
          {error ? `Erro: ${error}` : ''}
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {!firstSyncDone ? (
            <div className="animate-pulse space-y-4" aria-hidden="true">
              <div className="h-10 rounded-lg bg-white/5 dark:bg-black/20" />
              <div className="h-24 rounded-2xl bg-white/5 dark:bg-black/20" />
              <div className="h-24 rounded-2xl bg-white/5 dark:bg-black/20" />
            </div>
          ) : (
            <>
              {error && <div className="mb-4 text-sm text-red-500" role="alert">{error}</div>}

              {rows.length === 0 && !loading && (
                <div className="w-full bg-plate dark:bg-plate-dark rounded-2xl p-6 neumorphic-convex flex items-center justify-between">
                  <p className="text-gray-400">Nenhum canal adicionado para este contato.</p>
                  <Button type="button" variant="primary" onClick={add} disabled={saving} aria-label="Adicionar primeiro canal">
                    <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                    Adicionar Canal
                  </Button>
                </div>
              )}

              <div role="list" aria-label="Lista de canais do contato">
                {sorted.map((item) => (
                  <div
                    key={item.id}
                    role="listitem"
                    aria-label={[
                      `Canal ${item.type}`,
                      item.label_custom ? `, Etiqueta ${item.label_custom}` : '',
                      item.is_preferred ? ', Preferencial' : '',
                    ].join('')}
                    className="rounded-2xl p-4 mb-4 neumorphic-convex border border-dark-shadow/40 dark:border-dark-dark-shadow/40"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                      {/* Tipo */}
                      <div className="lg:col-span-2">
                        <Select
                          label="Tipo ▾"
                          name={`type-${item.id}`}
                          value={item.type}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                            patch(item.id, { type: e.target.value as ContactChannel['type'] })
                          }
                          aria-label="Tipo do canal"
                        >
                          {CHANNEL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </Select>
                      </div>

                      {/* Valor */}
                      <div className="lg:col-span-4">
                        <Input
                          label="Valor*"
                          name={`value-${item.id}`}
                          value={item.value ?? ''}
                          onChange={(e) => patch(item.id, { value: e.target.value })}
                          placeholder={
                            item.type === 'email'
                              ? 'email@exemplo.com'
                              : item.type === 'phone'
                              ? '+55 11 99999-9999'
                              : item.type === 'link'
                              ? 'https://exemplo.com'
                              : 'valor do canal'
                          }
                          aria-label="Valor do canal"
                          aria-required="true"
                        />
                      </div>

                      {/* Etiqueta */}
                      <div className="lg:col-span-3">
                        <Input
                          label="Etiqueta"
                          name={`label-${item.id}`}
                          value={item.label_custom ?? ''}
                          onChange={(e) => patch(item.id, { label_custom: e.target.value })}
                          placeholder="Pessoal, Comercial, Whats, etc."
                          aria-label="Etiqueta do canal"
                        />
                      </div>

                      {/* Notas */}
                      <div className="lg:col-span-3">
                        <Input
                          label="Notas"
                          name={`notes-${item.id}`}
                          value={item.notes ?? ''}
                          onChange={(e) => patch(item.id, { notes: e.target.value })}
                          placeholder="Observações sobre este canal"
                          aria-label="Notas do canal"
                        />
                      </div>
                    </div>

                    {/* Linha 2: Switch + Ações */}
                    <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                      <div className="lg:col-span-3">
                        <label
                          htmlFor={`preferred-${item.id}`}
                          className="flex items-center justify-between rounded-lg px-3 py-2 neumorphic-convex cursor-pointer"
                        >
                          <span className="text-sm text-gray-600 dark:text-gray-300 pr-3">Preferencial</span>
                          <Switch
                            id={`preferred-${item.id}`}
                            checked={!!item.is_preferred}
                            onCheckedChange={(checked: boolean) => patch(item.id, { is_preferred: checked })}
                            aria-label="Marcar canal como preferencial"
                          />
                        </label>
                      </div>

                      <div className="lg:col-span-9 flex items-center justify-end">
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => remove(item.id)}
                          title="Remover canal"
                          aria-label="Remover canal"
                        >
                          <Trash2 className="h-4 w-4 mr-1" aria-hidden="true" />
                          Excluir
                        </Button>
                      </div>
                    </div>

                    {/* Metadado de criação */}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        Criado em: <strong>{formatDateTime(item.created_at)}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-dark-shadow/40 dark:border-dark-dark-shadow/40 bg-plate/60 dark:bg-plate-dark/60 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400 mr-auto">
              Fechar salva alterações. Itens novos vazios são descartados automaticamente.
            </span>
            <Button
              type="button"
              variant="primary"
              onClick={handleSaveClick}
              isLoading={saving}
              disabled={!dirty && !saving}
              aria-label="Salvar alterações nos canais"
              title="Salvar alterações"
            >
              Salvar
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleClose}
              disabled={saving}
              aria-label="Fechar modal de canais"
              title="Fechar modal"
            >
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalTree, portalRoot);
};

export default ContactChannelsModal;

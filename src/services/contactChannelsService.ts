/*
================================================================================
Código: /src/services/contactChannelsService.ts
Versão: 2.1.0
Data/Hora: 2025-10-10 09:36 -03
Autor: FL / Eva (E.V.A.)
Objetivo: CRUD dos canais (JSONB) embutidos em public.contacts.channels_json.
Pilares:
  - Operações atômicas no documento do contato (sem tabela auxiliar).
  - Retornos compatíveis com hook otimista (add/update retornam o item salvo).
  - Sem refetch agressivo (nenhum list encadeado pós-update).
  - Validação leve: se type='other' exigir label.custom não-vazio na persistência.
Dependências:
  - @/lib/supabaseClient
  - @/types/channel
================================================================================
*/

import { supabase } from '@/lib/supabaseClient';
import type { ChannelItem, ChannelsArray, ChannelType } from '@/types/channel';

/* =============================================================================
[--BLOCO--] Utils locais
============================================================================= */

const isArray = (v: unknown): v is any[] => Array.isArray(v);

// Clone seguro: usa structuredClone se disponível; fallback para JSON.
const deepClone = <T>(v: T): T => {
  try {
    // @ts-ignore
    if (typeof structuredClone === 'function') return structuredClone(v);
  } catch {}
  return JSON.parse(JSON.stringify(v));
};

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? (crypto.randomUUID as () => string)()
    : `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

function coerceArray(input: unknown): ChannelsArray {
  if (!input) return [];
  if (isArray(input)) return input as ChannelsArray;
  return [];
}

function ensureValidOther(item: ChannelItem) {
  if (item.type === 'other') {
    const custom = item?.label?.custom?.toString().trim() ?? '';
    if (custom === '') {
      throw new Error("Para 'other', 'label.custom' deve ser preenchido.");
    }
  }
}

/* =============================================================================
[--BLOCO--] SELECT/UPDATE helpers (operam apenas em channels_json)
============================================================================= */

async function fetchChannels(contactId: string): Promise<ChannelsArray> {
  const { data, error } = await supabase
    .from('contacts')
    .select('channels_json')
    .eq('id', contactId)
    .single();

  if (error) {
    // RLS/Permissões ou inexistência do contato
    throw new Error('Falha ao carregar os canais do contato.');
  }

  return coerceArray(data?.channels_json);
}

async function persistChannels(contactId: string, next: ChannelsArray): Promise<ChannelsArray> {
  const payload = deepClone(next);
  const { data, error } = await supabase
    .from('contacts')
    .update({ channels_json: payload })
    .eq('id', contactId)
    .select('channels_json')
    .single();

  if (error) {
    throw new Error('Falha ao salvar os canais do contato.');
  }

  return coerceArray(data?.channels_json);
}

/* =============================================================================
[--BLOCO--] API pública
============================================================================= */

/** Lista os canais do contato (array sempre). */
export async function list(contactId: string): Promise<ChannelsArray> {
  return fetchChannels(contactId);
}

/**
 * Adiciona um canal ao array e retorna o item criado (com ID real).
 * Observação: o ID é gerado no cliente (UUID v4) e persistido no JSONB.
 */
export async function add(
  contactId: string,
  partial: Partial<ChannelItem> = {}
): Promise<ChannelItem> {
  const current = await fetchChannels(contactId);

  const newItem: ChannelItem = {
    id: partial.id ?? uuid(),
    type: (partial.type as ChannelType) ?? 'phone',
    value: partial.value ?? '',
    label: partial.label ?? { code: 'A', custom: '' },
    is_primary: partial.is_primary ?? false,
    guard: (partial.guard as ChannelItem['guard']) ?? 'Temporário',
    active: partial.active ?? true,
    notes: partial.notes ?? '',
  };

  ensureValidOther(newItem);

  const next = [...current, newItem];
  const persisted = await persistChannels(contactId, next);

  // Retorna o criado conforme salvo no banco (caso haja normalizações)
  const created = persisted.find((i) => i.id === newItem.id);
  return created ?? newItem;
}

/** Atualiza um item pelo ID e retorna o item salvo. */
export async function update(
  contactId: string,
  id: string,
  patch: Partial<ChannelItem>
): Promise<ChannelItem> {
  const current = await fetchChannels(contactId);
  const idx = current.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('Canal não encontrado.');

  const merged: ChannelItem = { ...current[idx], ...deepClone(patch) };
  ensureValidOther(merged);

  const next = deepClone(current);
  next[idx] = merged;

  const persisted = await persistChannels(contactId, next);
  const saved = persisted.find((i) => i.id === id);
  return saved ?? merged;
}

/** Remove um item do array e confirma boolean. */
export async function remove(contactId: string, id: string): Promise<boolean> {
  const current = await fetchChannels(contactId);
  const next = current.filter((c) => c.id !== id);
  await persistChannels(contactId, next);
  return true;
}

/**
 * Substitui o array inteiro de canais.
 * Retorna o array efetivamente salvo (normalizado pelo banco).
 */
export async function replaceAll(
  contactId: string,
  nextArray: ChannelsArray
): Promise<ChannelsArray> {
  const next = coerceArray(nextArray).map((it) => {
    const item = deepClone(it) as ChannelItem;
    // normalizações leves
    item.id = item.id || uuid();
    item.label = item.label ?? { code: 'A', custom: '' };
    item.is_primary = !!item.is_primary;
    item.active = item.active ?? true;

    ensureValidOther(item);
    return item;
  });

  const saved = await persistChannels(contactId, next);
  return saved;
}

/* -----------------------------------------------------------------------------
Compat: algumas partes do app podem chamar saveAll(contactId, array)
----------------------------------------------------------------------------- */
export async function saveAll(contactId: string, arr: ChannelsArray) {
  return replaceAll(contactId, arr);
}

/*
================================================================================
Código: /src/hooks/useContactChannels.ts
Versão: 2.2.0
Data/Hora: 2025-10-13 13:25 -03
Autor: FL / Eva (E.V.A.)
Objetivo: Hook de gestão dos canais de contato (load/replace), com
          ordenação determinística e garantia de multi-tenant.
Fluxo: UI (ContactChannelsModal/Section) → useContactChannels → Supabase
Dependências: supabaseClient, types/channel
Padrões: Cabeçalho + versão semântica + blocos [--BLOCO--]/[--NOTA--]/[--TÉCNICA--]
Histórico:
  - 2.1.1 (FL): Trata id vazio como novo; persiste em 2 fases (INSERT novos; UPSERT existentes);
                tenant_id obrigatório.
  - 2.2.0 (Eva): Ordenação determinística com "type_weight" (client-side), created_at ASC, value ASC;
                SELECT já inclui todos os campos de exibição; pequenos hardening de tipos.
================================================================================
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { ContactChannel } from '@/types/channel';

/* [--BLOCO--] Constantes e utilitários -------------------------------------- */

const NEW_ID_PREFIX = 'tmp-';

// Mapa de peso por tipo para ordenação determinística.
// [--NOTA--] Ajustável conforme a taxonomia usada na UI.
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
  return TYPE_WEIGHT[key] ?? 80; // default intermediário
};

// id válido = uuid v4-like (36 chars) e não prefixo tmp
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isExistingId = (id: unknown) =>
  !!id && typeof id === 'string' && UUID_RE.test(id) && !id.startsWith(NEW_ID_PREFIX);

// Normalização defensiva de linhas vindas do DB
function normalizeRow(row: any): ContactChannel {
  return {
    id: String(row.id),
    type: String(row.type) as ContactChannel['type'],
    value: row.value ?? '',
    label_custom: row.label_custom ?? null,
    is_preferred: !!row.is_preferred,
    notes: row.notes ?? null,
    verified_at: row.verified_at ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
    export_state: row.export_state ?? 'Create',
  };
}

// Ordenação determinística (type_weight ASC → created_at ASC → value ASC)
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

/* [--BLOCO--] Tipos internos do hook ---------------------------------------- */

type State = {
  channels: ContactChannel[];
  loading: boolean;
  saving: boolean;
  error: string | null;
};

type Hook = {
  channels: ContactChannel[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  refresh: () => Promise<ContactChannel[]>;
  replaceAll: (rows: ContactChannel[]) => Promise<ContactChannel[] | null>;
};

/* [--BLOCO--] Hook principal ------------------------------------------------- */

export function useContactChannels(contactId: string): Hook {
  const [st, setSt] = useState<State>({
    channels: [],
    loading: true,
    saving: false,
    error: null,
  });

  const tenantIdRef = useRef<string | null>(null);
  const hasContact = !!contactId;

  /* [--BLOCO--] tenant_id (multi-tenant) ------------------------------------ */
  // [--NOTA--] Resolve tenant_id do contato; cache local por instância do hook.
  const ensureTenantId = useCallback(async (): Promise<string> => {
    if (tenantIdRef.current) return tenantIdRef.current!;
    const { data, error } = await supabase
      .from('contacts')
      .select('tenant_id')
      .eq('id', contactId)
      .single();
    if (error || !data?.tenant_id)
      throw new Error('Não foi possível obter tenant_id do contato.');
    tenantIdRef.current = String(data.tenant_id);
    return tenantIdRef.current;
  }, [contactId]);

  /* [--BLOCO--] Fetch -------------------------------------------------------- */
  // [--TÉCNICA--] Ordenamos no client com sortDeterministic para aplicar type_weight.
  const fetchAll = useCallback(async (): Promise<ContactChannel[]> => {
    if (!hasContact) {
      setSt((s) => ({ ...s, channels: [], loading: false, error: null }));
      return [];
    }
    setSt((s) => ({ ...s, loading: true, error: null }));

    const { data, error } = await supabase
      .from('contacts_channel')
      .select(
        [
          'id',
          'type',
          'value',
          'label_custom',
          'is_preferred',
          'notes',
          'verified_at',
          'created_at',
          'updated_at',
          'export_state',
        ].join(', ')
      )
      .eq('contact_id', contactId)
      // [--NOTA--] Ordem básica no servidor para estabilidade; refino no client:
      .order('created_at', { ascending: true })
      .order('value', { ascending: true });

    if (error) {
      setSt((s) => ({ ...s, loading: false, error: error.message }));
      return [];
    }

    const rows = (data ?? []).map(normalizeRow).sort(sortDeterministic);
    setSt((s) => ({ ...s, channels: rows, loading: false, error: null }));
    return rows;
  }, [contactId, hasContact]);

  useEffect(() => {
    fetchAll().catch((e) =>
      setSt((s) => ({
        ...s,
        loading: false,
        error: e?.message ?? 'Falha ao carregar canais.',
      }))
    );
  }, [fetchAll]);

  const refresh = useCallback(async () => fetchAll(), [fetchAll]);

  /* [--BLOCO--] ReplaceAll (persistência em 2 fases) ------------------------ */
  // 1) INSERT novos (sem id/uuid válido) — DB gera id
  // 2) UPSERT existentes (com id válido) — onConflict: id
  // 3) DELETE removidos (delta entre DB e payload recebido)
  const replaceAll = useCallback(
    async (rows: ContactChannel[]): Promise<ContactChannel[] | null> => {
      if (!hasContact) {
        setSt((s) => ({ ...s, error: 'Contato não informado.' }));
        return null;
      }

      setSt((s) => ({ ...s, saving: true, error: null }));
      try {
        const tenant_id = await ensureTenantId();

        // [--BLOCO--] Snapshot atual p/ diff
        const { data: existingData, error: existingErr } = await supabase
          .from('contacts_channel')
          .select('id')
          .eq('contact_id', contactId);
        if (existingErr) throw existingErr;

        const existingIds = new Set<string>(
          (existingData ?? []).map((r: any) => String(r.id))
        );

        // [--BLOCO--] Sanitização de entrada
        const incoming = rows
          .map((r) => ({
            id: (r.id ?? '').toString().trim(),
            type: (r.type || 'phone') as ContactChannel['type'],
            value: (r.value ?? '').toString(),
            label_custom:
              r.label_custom === undefined
                ? null
                : (r.label_custom as string | null),
            is_preferred: !!r.is_preferred,
            notes: r.notes ?? null,
          }))
          // [--NOTA--] Evita linhas totalmente vazias.
          .filter(
            (r) =>
              (r.value?.toString().trim() ?? '') !== '' ||
              (r.label_custom?.toString().trim() ?? '') !== ''
          );

        const existingPayload = incoming.filter((r) => isExistingId(r.id));
        const newPayload = incoming.filter((r) => !isExistingId(r.id)); // inclui id "" e tmp-*

        // [--BLOCO--] DELETE (o que existia e não veio mais)
        const incomingExistingIds = new Set(existingPayload.map((r) => r.id));
        const toDelete = Array.from(existingIds).filter(
          (id) => !incomingExistingIds.has(id)
        );
        if (toDelete.length > 0) {
          const { error: delErr } = await supabase
            .from('contacts_channel')
            .delete()
            .in('id', toDelete)
            .eq('contact_id', contactId);
          if (delErr) throw delErr;
        }

        // [--BLOCO--] INSERT (novos, sem id → DB gera)
        if (newPayload.length > 0) {
          const insertRows = newPayload.map((r) => ({
            tenant_id,
            contact_id: contactId,
            type: r.type,
            value: r.value,
            label_custom: r.label_custom,
            is_preferred: r.is_preferred,
            notes: r.notes,
            // [--NOTA--] created_at é carimbado no DB; a UI pode usar otimista se desejar.
          }));
          const { error: insErr } = await supabase
            .from('contacts_channel')
            .insert(insertRows)
            .select('id'); // força validação
          if (insErr) throw insErr;
        }

        // [--BLOCO--] UPSERT (existentes com id válido)
        if (existingPayload.length > 0) {
          const upsertRows = existingPayload.map((r) => ({
            id: r.id,
            tenant_id,
            contact_id: contactId,
            type: r.type,
            value: r.value,
            label_custom: r.label_custom,
            is_preferred: r.is_preferred,
            notes: r.notes,
          }));
          const { error: upErr } = await supabase
            .from('contacts_channel')
            .upsert(upsertRows, { onConflict: 'id' })
            .select('id');
          if (upErr) throw upErr;
        }

        // [--BLOCO--] Refetch final (com ordenação determinística)
        const fresh = await fetchAll();
        setSt((s) => ({ ...s, saving: false, error: null }));
        return fresh;
      } catch (e: any) {
        setSt((s) => ({
          ...s,
          saving: false,
          error: e?.message ?? 'Falha ao salvar canais.',
        }));
        return null;
      }
    },
    [contactId, ensureTenantId, fetchAll, hasContact]
  );

  /* [--BLOCO--] Exposição do hook ------------------------------------------- */
  return useMemo<Hook>(
    () => ({
      channels: st.channels,
      loading: st.loading,
      saving: st.saving,
      error: st.error,
      refresh,
      replaceAll,
    }),
    [st.channels, st.loading, st.saving, st.error, refresh, replaceAll]
  );
}

/*
-- ===================================================
-- Código             : /src/services/aiNotesService.ts
-- Versão (.v20)      : 1.2.0
-- Data/Hora          : 2026-03-26 America/Sao_Paulo
-- Autor              : FL / Execução via E.V.A.
-- Objetivo do codigo : Service de Notas da IA (CRUD + Finder FTS)
-- Fluxo              : UI / Hooks
--                      -> aiNotesService
--                      -> Supabase (ai_notes)
-- Observações:
--   • Escopo por JWT + RLS (tenant_id + owner_profile_id)
--   • Finder usa FTS (title + body)
--   • Hard delete via policy ai_notes_delete_own
--   • listAiNotes / searchAiNotes filtram deleted_at IS NULL explicitamente
-- ===================================================
*/

import { supabase } from '@/lib/supabaseClient';

/* ===================================================
 * TIPOS
 * =================================================== */

export interface AiNote {
  id: string;
  title: string;
  body: string;
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface ListOptions {
  limit?: number;
  offset?: number;
}

interface SearchOptions extends ListOptions {
  query: string;
}

/* ===================================================
 * CREATE — NOVO (ADIÇÃO CONTROLADA)
 * =================================================== */
export async function createAiNote(input: {
  title: string;
  body: string;
  tags?: string[];
  metadata?: Record<string, any>;
}): Promise<AiNote | null> {
  const { title, body, tags = [], metadata = {} } = input;

  const { data, error } = await supabase
    .from('ai_notes')
    .insert({
      title,
      body,
      tags,
      metadata,
    })
    .select(
      `
      id,
      title,
      body,
      tags,
      metadata,
      created_at,
      updated_at
    `
    )
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[aiNotesService] Erro ao criar nota:', error);
    return null;
  }

  return (data ?? null) as AiNote | null;
}

/* ===================================================
 * LISTAR NOTAS (ordem: mais recentes)
 * =================================================== */
export async function listAiNotes(
  options: ListOptions = {}
): Promise<AiNote[]> {
  const { limit = 50, offset = 0 } = options;

  const { data, error } = await supabase
    .from('ai_notes')
    .select(
      `
      id,
      title,
      body,
      tags,
      metadata,
      created_at,
      updated_at
    `
    )
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[aiNotesService] Erro ao listar notas:', error);
    return [];
  }

  return (data ?? []) as AiNote[];
}

/* ===================================================
 * BUSCAR NOTAS (Finder FTS: title + body)
 * =================================================== */
export async function searchAiNotes(
  options: SearchOptions
): Promise<AiNote[]> {
  const { query, limit = 50, offset = 0 } = options;

  if (!query.trim()) {
    return listAiNotes({ limit, offset });
  }

  const { data, error } = await supabase
    .from('ai_notes')
    .select(
      `
      id,
      title,
      body,
      tags,
      metadata,
      created_at,
      updated_at
    `
    )
    .is('deleted_at', null)
    .textSearch('search_tsv', query, {
      type: 'websearch',
      config: 'portuguese',
    })
    .order('updated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[aiNotesService] Erro ao buscar notas:', error);
    return [];
  }

  return (data ?? []) as AiNote[];
}

/* ===================================================
 * OBTER NOTA POR ID
 * =================================================== */
export async function getAiNoteById(
  noteId: string
): Promise<AiNote | null> {
  const { data, error } = await supabase
    .from('ai_notes')
    .select(
      `
      id,
      title,
      body,
      tags,
      metadata,
      created_at,
      updated_at
    `
    )
    .eq('id', noteId)
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[aiNotesService] Erro ao obter nota:', error);
    return null;
  }

  return (data ?? null) as AiNote | null;
}

/* ===================================================
 * ATUALIZAR NOTA (título, corpo, tags, metadata)
 * =================================================== */
export async function updateAiNote(
  noteId: string,
  updates: Partial<Pick<AiNote, 'title' | 'body' | 'tags' | 'metadata'>>
): Promise<boolean> {
  const { error } = await supabase
    .from('ai_notes')
    .update(updates)
    .eq('id', noteId);

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[aiNotesService] Erro ao atualizar nota:', error);
    return false;
  }

  return true;
}

/* ===================================================
 * DELETE
 * =================================================== */
export async function deleteAiNote(noteId: string): Promise<boolean> {
  const { error } = await supabase
    .from('ai_notes')
    .delete()
    .eq('id', noteId);

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[aiNotesService] Erro ao deletar nota:', error);
    return false;
  }

  return true;
}

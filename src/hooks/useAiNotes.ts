/*
-- ===================================================
-- Código             : /src/hooks/useAiNotes.ts
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-12-18 19:05 America/Sao_Paulo
-- Autor              : FL / Execução via E.V.A.
-- Objetivo do codigo : Hook para Notas da IA (estado + finder + seleção)
-- Fluxo              : UI
--                      -> useAiNotes
--                      -> aiNotesService
-- Observações:
--   • Busca inteligente (FTS) em title + body
--   • Debounce para o finder
--   • Soft delete
--   • Erros não quebram UI (logs apenas)
-- ===================================================
*/

import { useCallback, useEffect, useMemo, useState } from 'react';
import { debounce } from 'lodash-es';
import {
  listAiNotes,
  searchAiNotes,
  getAiNoteById,
  updateAiNote,
  deleteAiNote,
  AiNote,
} from '@/services/aiNotesService';

/* ===================================================
 * TIPOS
 * =================================================== */

interface UseAiNotesOptions {
  pageSize?: number;
}

interface UseAiNotesResult {
  notes: AiNote[];
  selectedNote: AiNote | null;
  loading: boolean;
  error: string | null;

  // Finder
  searchTerm: string;
  setSearchTerm: (v: string) => void;

  // Seleção
  selectNote: (noteId: string) => Promise<void>;

  // Ações
  refresh: () => Promise<void>;
  updateNote: (
    noteId: string,
    updates: Partial<Pick<AiNote, 'title' | 'body' | 'tags' | 'metadata'>>
  ) => Promise<boolean>;
  deleteNote: (noteId: string) => Promise<boolean>;

  // Paginação básica (preparado p/ evolução)
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

/* ===================================================
 * HOOK
 * =================================================== */

export function useAiNotes(
  options: UseAiNotesOptions = {}
): UseAiNotesResult {
  const { pageSize = 30 } = options;

  const [notes, setNotes] = useState<AiNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<AiNote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  /* ---------------------------
   * Debounce do finder
   * ------------------------- */
  const debounced = useMemo(
    () =>
      debounce((v: string) => {
        setDebouncedSearch(v);
        setOffset(0);
      }, 300),
    []
  );

  useEffect(() => {
    debounced(searchTerm);
    return () => debounced.cancel();
  }, [searchTerm, debounced]);

  /* ---------------------------
   * Load inicial / refresh
   * ------------------------- */
  const load = useCallback(
    async (reset = false) => {
      setLoading(true);
      setError(null);

      try {
        const currentOffset = reset ? 0 : offset;

        const data = debouncedSearch
          ? await searchAiNotes({
              query: debouncedSearch,
              limit: pageSize,
              offset: currentOffset,
            })
          : await listAiNotes({
              limit: pageSize,
              offset: currentOffset,
            });

        if (reset) {
          setNotes(data);
        } else {
          setNotes((prev) => [...prev, ...data]);
        }

        setHasMore(data.length === pageSize);
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.error('[useAiNotes] Erro ao carregar notas:', err);
        setError('Erro ao carregar notas da IA.');
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, offset, pageSize]
  );

  useEffect(() => {
    // sempre que muda o termo efetivo, recarrega do zero
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  /* ---------------------------
   * Selecionar nota
   * ------------------------- */
  const selectNote = useCallback(async (noteId: string) => {
    setLoading(true);
    setError(null);

    try {
      const note = await getAiNoteById(noteId);
      setSelectedNote(note);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[useAiNotes] Erro ao selecionar nota:', err);
      setError('Erro ao carregar a nota.');
      setSelectedNote(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---------------------------
   * Ações
   * ------------------------- */
  const refresh = useCallback(async () => {
    setOffset(0);
    await load(true);
  }, [load]);

  const updateNoteAction = useCallback(
    async (
      noteId: string,
      updates: Partial<Pick<AiNote, 'title' | 'body' | 'tags' | 'metadata'>>
    ) => {
      const ok = await updateAiNote(noteId, updates);
      if (ok) {
        // reflete na lista
        setNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, ...updates } : n))
        );
        // reflete no viewer
        setSelectedNote((prev) =>
          prev && prev.id === noteId ? { ...prev, ...updates } : prev
        );
      }
      return ok;
    },
    []
  );

  const deleteNoteAction = useCallback(async (noteId: string) => {
    const ok = await deleteAiNote(noteId);
    if (ok) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      setSelectedNote((prev) => (prev?.id === noteId ? null : prev));
    }
    return ok;
  }, []);

  /* ---------------------------
   * Paginação
   * ------------------------- */
  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    const nextOffset = offset + pageSize;
    setOffset(nextOffset);
    await load(false);
  }, [hasMore, loading, offset, pageSize, load]);

  return {
    notes,
    selectedNote,
    loading,
    error,

    searchTerm,
    setSearchTerm,

    selectNote,

    refresh,
    updateNote: updateNoteAction,
    deleteNote: deleteNoteAction,

    hasMore,
    loadMore,
  };
}

/*
-- ===================================================
-- Código             : /src/hooks/useAcoesList.ts
-- Versão (.v20)      : 1.1.0
-- Data/Hora          : 2025-12-03 11:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Corrigir o hook para que a busca seja re-executada a cada mudança nos filtros.
-- Fluxo              : AcoesListTab -> useAcoesList -> chatsService
-- Alterações (1.1.0) :
--   • [FIX] O useEffect principal agora depende de `JSON.stringify(params)`, garantindo que qualquer alteração nos filtros dispare uma nova busca.
-- Dependências       : react, lodash-es, @/services/chatsService, @/types/chat, @/contexts/ToastContext
-- ===================================================
*/
import { useState, useEffect, useCallback } from 'react';
import { listChats, ListChatsParams } from '@/services/chatsService';
import { ChatListItem } from '@/types/chat';
import { useToast } from '@/contexts/ToastContext';
import { debounce } from 'lodash-es';

export function useAcoesList(initialParams: Partial<ListChatsParams> = {}) {
  const [items, setItems] = useState<ChatListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [params, setParams] = useState<ListChatsParams>({
    page: 1,
    pageSize: 15,
    sortBy: 'calendar_at',
    sortOrder: 'desc',
    ...initialParams,
  });

  const { addToast } = useToast();

  const fetchItems = useCallback(async (currentParams: ListChatsParams) => {
    setLoading(true);
    setError(null);
    try {
      const { items: newItems, total: newTotal } = await listChats(currentParams);
      setItems(newItems);
      setTotal(newTotal);
    } catch (err: any) {
      const errorMessage = err.message || 'Falha ao carregar a lista de ações.';
      setError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const debouncedFetch = useCallback(debounce(fetchItems, 300), [fetchItems]);

  // FIX: O useEffect agora observa todas as mudanças no objeto de parâmetros.
  useEffect(() => {
    debouncedFetch(params);
    return () => debouncedFetch.cancel();
  }, [JSON.stringify(params), debouncedFetch]);

  const setSort = (sortBy: string) => {
    setParams(p => ({
      ...p,
      page: 1,
      sortBy,
      sortOrder: p.sortBy === sortBy && p.sortOrder === 'desc' ? 'asc' : 'desc',
    }));
  };

  const setPage = (page: number) => {
    setParams(p => ({ ...p, page }));
  };
  
  const setPageSize = (pageSize: 15 | 30 | 60) => {
    setParams(p => ({ ...p, page: 1, pageSize }));
  };

  const setFilters = (newFilters: Partial<ListChatsParams>) => {
    setParams(p => ({ ...p, page: 1, ...newFilters }));
  };

  const applySearch = (searchTerm: string) => {
    setParams(p => ({ ...p, page: 1, q: searchTerm }));
  };

  const clearFilters = () => {
    setParams({
      page: 1,
      pageSize: 15,
      sortBy: 'calendar_at',
      sortOrder: 'desc',
      q: '',
      status: 'all',
      type: '',
      channel: '',
      companyName: '',
      contactName: '',
      temperature: '',
    });
  };

  return {
    items,
    total,
    loading,
    error,
    params,
    setSort,
    setPage,
    setPageSize,
    setFilters,
    applySearch,
    clearFilters, // Expondo a função de limpar
  };
}

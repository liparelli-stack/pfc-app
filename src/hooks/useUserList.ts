/*
-- ===================================================
-- Código             : /src/hooks/useUserList.ts
-- Versão (.v20)      : 1.2.0
-- Data/Hora          : 2025-12-06 18:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Expor a função de refetch para o componente pai.
-- Alterações (1.2.0) :
--   • [FEAT] A função `fetchItems` agora é retornada como `refetch`.
-- Dependências       : react, lodash-es, @/services/profilesService, @/types/profile, @/contexts/ToastContext
-- ===================================================
*/
import { useState, useEffect, useCallback } from 'react';
import { listProfiles, ListParams } from '@/services/profilesService';
import { Profile } from '@/types/profile';
import { useToast } from '@/contexts/ToastContext';
import { debounce } from 'lodash-es';

export function useUserList(initialParams: Partial<ListParams> = {}) {
  const [items, setItems] = useState<Profile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [params, setParams] = useState<ListParams>({
    page: 1,
    pageSize: 15,
    ...initialParams,
  });

  const { addToast } = useToast();

  const fetchItems = useCallback(async (currentParams: ListParams) => {
    setLoading(true);
    setError(null);
    try {
      const { q, status, pageSize, page } = currentParams;
      const limit = pageSize || 15;
      const offset = ((page || 1) - 1) * limit;
      const { items: newItems, count: newTotal } = await listProfiles({ q, status, limit, offset });
      setItems(newItems);
      setTotal(newTotal);
    } catch (err: any) {
      const errorMessage = err.message || 'Falha ao carregar a lista de utilizadores.';
      setError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const debouncedFetch = useCallback(debounce(fetchItems, 300), [fetchItems]);

  useEffect(() => {
    debouncedFetch(params);
    return () => debouncedFetch.cancel();
  }, [JSON.stringify(params), debouncedFetch]);

  const setPage = (page: number) => {
    setParams(p => ({ ...p, page }));
  };

  const setPageSize = (pageSize: 15 | 30 | 60) => {
    setParams(p => ({ ...p, page: 1, pageSize }));
  };

  const setFilters = (newFilters: Partial<Omit<ListParams, 'limit' | 'offset' | 'page' | 'pageSize'>>) => {
    setParams(p => ({ ...p, page: 1, ...newFilters }));
  };

  const refetch = useCallback(() => {
    fetchItems(params);
  }, [fetchItems, params]);

  return { items, total, loading, error, params, setPage, setPageSize, setFilters, refetch };
}

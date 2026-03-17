/*
-- ===================================================
-- Código             : /src/hooks/useContactsList.ts
-- Versão (.v20)      : 1.5.0
-- Data/Hora          : 2025-12-07 15:05 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Adicionar suporte a filtros avançados no hook.
-- Alterações (1.5.0) :
--   • [FEAT] Params expandidos: email, phone, position, department.
--   • [FEAT] clearFilters limpa todos os novos campos.
-- Dependências       : react, lodash-es, @/services/contactsService, @/types/contact
-- ===================================================
*/
import { useState, useEffect, useCallback } from 'react';
import { listContacts, ListContactsParams } from '@/services/contactsService';
import { ContactWithCompany } from '@/types/contact';
import { useToast } from '@/contexts/ToastContext';
import { debounce } from 'lodash-es';

export function useContactsList(initialParams: Partial<ListContactsParams> = {}) {
  const [items, setItems] = useState<ContactWithCompany[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [params, setParams] = useState<ListContactsParams>({
    page: 1,
    pageSize: 15,
    sortBy: 'full_name', // Default: Contato A-Z
    sortOrder: 'asc',
    contactName: '',
    companyName: '',
    channelType: 'all',
    email: '',
    phone: '',
    position: '',
    department: '',
    ...initialParams,
  });

  const { addToast } = useToast();

  const fetchItems = useCallback(
    async (currentParams: ListContactsParams) => {
      setLoading(true);
      setError(null);
      try {
        const { items: newItems, total: newTotal } = await listContacts(currentParams);
        setItems(newItems);
        setTotal(newTotal);
      } catch (err: any) {
        const errorMessage = err.message || 'Falha ao carregar a lista de contatos.';
        setError(errorMessage);
        addToast(errorMessage, 'error');
      } finally {
        setLoading(false);
      }
    },
    [addToast]
  );

  const debouncedFetch = useCallback(debounce(fetchItems, 300), [fetchItems]);

  useEffect(() => {
    debouncedFetch(params);
    return () => debouncedFetch.cancel();
  }, [JSON.stringify(params), debouncedFetch]);

  // --- Setters ---

  const setPage = useCallback((page: number) => {
    setParams((p) => ({ ...p, page }));
  }, []);

  const setPageSize = useCallback((pageSize: 15 | 30 | 60) => {
    setParams((p) => ({ ...p, page: 1, pageSize }));
  }, []);

  const setFilters = useCallback((newFilters: Partial<ListContactsParams>) => {
    setParams((p) => ({ ...p, page: 1, ...newFilters }));
  }, []);

  const setSort = useCallback((column: string) => {
    setParams((prev) => ({
      ...prev,
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1, // Reset page on sort change
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setParams({
      page: 1,
      pageSize: 15,
      sortBy: 'full_name',
      sortOrder: 'asc',
      contactName: '',
      companyName: '',
      channelType: 'all',
      email: '',
      phone: '',
      position: '',
      department: '',
    });
  }, []);

  return {
    items,
    total,
    loading,
    error,
    params,
    setPage,
    setPageSize,
    setFilters,
    setSort,
    clearFilters,
  };
}

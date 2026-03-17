/* =============================================================================
Arquivo: src/hooks/useDeals.ts
Versão: 2.0.0
Autor: E.V.A. (a pedido de FL)
Data/Hora: 2025-10-16 15:30:00-03:00
Objetivo:
  - Tornar o hook CONTROLADO por filtros do caller (DealsPage).
  - Buscar sempre que os filtros mudarem.
Dependências: dealsService.listDeals
============================================================================= */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as dealsService from '@/services/dealsService';
import { DealWithRelations } from '@/types/deal';
import { useToast } from '@/contexts/ToastContext';

type DealsFilter = Parameters<typeof dealsService.listDeals>[0];

export function useDeals(filters: DealsFilter = {}) {
  const { addToast } = useToast();
  const [deals, setDeals] = useState<DealWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Deep-deps estáveis
  const filtersKey = useMemo(() => JSON.stringify(filters ?? {}), [filters]);
  const lastKeyRef = useRef<string>(''); // evita duplos fetchs idênticos

  const fetchDeals = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dealsService.listDeals(filters);
      setDeals(data);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao carregar oportunidades.';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Carrega na montagem e sempre que os filtros mudarem
  useEffect(() => {
    if (lastKeyRef.current === filtersKey) return;
    lastKeyRef.current = filtersKey;
    fetchDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  return {
    deals,
    isLoading,
    error,
    refresh: fetchDeals, // usa os filtros atuais do caller
  };
}

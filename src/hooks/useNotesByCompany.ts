/*
-- ===================================================
-- Código             : /src/hooks/useNotesByCompany.ts
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-12-05 18:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Hook para buscar todas as empresas com suas notas.
-- Fluxo              : NotasPorEmpresa -> useNotesByCompany -> companiesService
-- Dependências       : react, @/services/companiesService, @/types/company, @/contexts/ToastContext
-- ===================================================
*/
import { useState, useEffect, useCallback } from 'react';
import { listCompaniesWithNotes } from '@/services/companiesService';
import { Company, CompanyNote } from '@/types/company';
import { useToast } from '@/contexts/ToastContext';

interface CompanyWithParsedNotes extends Omit<Company, 'notes'> {
  notes: CompanyNote[];
}

export function useNotesByCompany() {
  const [companies, setCompanies] = useState<CompanyWithParsedNotes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rawCompanies = await listCompaniesWithNotes();
      const parsedCompanies = rawCompanies.map(company => ({
        ...company,
        notes: Array.isArray(company.notes) ? company.notes : [],
      }));
      setCompanies(parsedCompanies);
    } catch (err: any) {
      const errorMessage = err.message || 'Falha ao carregar as notas.';
      setError(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  return {
    companies,
    loading,
    error,
    refetch: fetchItems,
  };
}

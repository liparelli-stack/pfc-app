/*
-- ===================================================
-- Código             : src/hooks/useCompaniesLookup.ts
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2026-03-25 America/Sao_Paulo
-- Autor              : FL / Execução via Eva (Claude)
-- Objetivo do codigo : Hook simples para listar empresas (companies) do tenant.
--                      Retorna { id, label } para uso em FilterCombobox.
--                      Relação: chats.company_id → companies.id (FK direta)
-- Dependências       : @/lib/supabaseClient
-- ===================================================
*/
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface CompanyOption {
  id: string;
  label: string;   // trade_name (NOT NULL no schema)
}

export function useCompaniesLookup() {
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    supabase
      .from('companies')
      .select('id, trade_name')
      .order('trade_name')
      .then(({ data }) => {
        if (!mounted) return;
        setCompanies(
          (data ?? []).map((c: any) => ({
            id:    c.id,
            label: c.trade_name ?? c.id,
          }))
        );
        setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  return { companies, loading };
}

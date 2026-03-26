/*
-- ===================================================
-- Código             : src/hooks/useSalespersons.ts
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2026-03-26 14:50 America/Sao_Paulo
-- Autor              : FL / Execução via Eva (Claude)
-- Objetivo do codigo : Hook simples para listar profiles (vendedores) do tenant.
--                      Retorna { id, name } para uso em dropdowns de filtro.
-- Dependências       : @/lib/supabaseClient
-- ===================================================
*/
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

export interface Salesperson {
  id: string;
  name: string;
}

export function useSalespersons() {
  const [salespersons, setSalespersons] = useState<Salesperson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name')
      .then(({ data }) => {
        if (!mounted) return;
        setSalespersons(
          (data ?? []).map((p: any) => ({ id: p.id, name: p.full_name ?? p.id }))
        );
        setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  return { salespersons, loading };
}

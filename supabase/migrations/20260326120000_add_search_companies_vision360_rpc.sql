-- =======================================================================
-- Migration : add_search_companies_vision360_rpc
-- Data      : 2026-03-26
-- Objetivo  : RPC accent-insensitive para busca de empresas na Visão 360.
--             Equivalente ao search_companies_by_name do Cockpit, porém sem
--             filtro de owner — Visão 360 mostra todas as empresas do tenant.
-- =======================================================================

CREATE OR REPLACE FUNCTION public.search_companies_vision360(p_term TEXT)
RETURNS TABLE(id UUID, trade_name TEXT, legal_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, auth
AS $$
  SELECT c.id, c.trade_name, c.legal_name
  FROM public.companies c
  WHERE c.tenant_id = app.current_tenant_id()
    AND extensions.unaccent(lower(c.trade_name))
        ILIKE '%' || extensions.unaccent(lower(p_term)) || '%'
  ORDER BY c.trade_name
  LIMIT 15;
$$;

COMMENT ON FUNCTION public.search_companies_vision360 IS
  'Busca accent-insensitive de empresas do tenant para Visão 360. Sem filtro de owner — retorna todas as empresas do tenant autenticado.';

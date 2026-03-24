-- ===================================================
-- Migration : add_search_companies_by_name_rpc
-- Data      : 2026-03-24
-- Objetivo  : RPC accent-insensitive para busca de empresas no Cockpit.
--             Usa extensions.unaccent para normalizar acentos em tempo de query,
--             sem necessidade de coluna desnormalizada.
-- ===================================================

CREATE OR REPLACE FUNCTION public.search_companies_by_name(
  p_term      TEXT,
  p_tenant_id UUID
)
RETURNS TABLE(id UUID, trade_name TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT c.id, c.trade_name
  FROM public.companies c
  WHERE c.tenant_id = p_tenant_id
    AND extensions.unaccent(lower(c.trade_name))
        ILIKE '%' || extensions.unaccent(lower(p_term)) || '%'
  ORDER BY c.trade_name
  LIMIT 25;
$$;

COMMENT ON FUNCTION public.search_companies_by_name IS
  'Busca empresas por nome com suporte a acentos (unaccent) e case-insensitive. Filtra por tenant_id.';

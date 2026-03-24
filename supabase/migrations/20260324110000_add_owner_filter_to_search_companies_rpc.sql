-- ===================================================
-- Migration : add_owner_filter_to_search_companies_rpc
-- Data      : 2026-03-24
-- Objetivo  : Adicionar filtro por owner (auth.uid()) na busca de empresas
--             do Cockpit, garantindo que cada usuário veja apenas as
--             empresas das quais é dono — sem exceção para admins.
--
-- Diagnóstico:
--   companies.owner  = auth_user_id (text, UUID do auth.users)
--   auth.uid()       = UUID do usuário autenticado na sessão atual
--   Não usa parâmetro externo → não pode ser forjado pelo frontend.
--
-- Sem alteração de assinatura: cockpitService.ts não precisa mudar.
-- ===================================================

CREATE OR REPLACE FUNCTION public.search_companies_by_name(
  p_term      TEXT,
  p_tenant_id UUID
)
RETURNS TABLE(id UUID, trade_name TEXT)
LANGUAGE sql
STABLE
SET search_path = public, extensions, auth
AS $$
  SELECT c.id, c.trade_name
  FROM public.companies c
  WHERE c.tenant_id = p_tenant_id
    AND c.owner = auth.uid()::text
    AND extensions.unaccent(lower(c.trade_name))
        ILIKE '%' || extensions.unaccent(lower(p_term)) || '%'
  ORDER BY c.trade_name
  LIMIT 25;
$$;

COMMENT ON FUNCTION public.search_companies_by_name IS
  'Busca empresas do tenant com filtro de owner (auth.uid()) e unaccent. Apenas empresas do usuário logado são retornadas.';

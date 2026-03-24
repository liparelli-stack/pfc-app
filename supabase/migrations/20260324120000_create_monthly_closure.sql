/*
-- =====================================================================================================
-- Código             : supabase/migrations/20260324120000_create_monthly_closure.sql
-- Versão (.v20)      : 0.1.0
-- Data/Hora          : 2026-03-24 19:00 America/Sao_Paulo
-- Autor              : FL / Execução via (Eva Claude Modelo) (Alpha Dualite modelo LLM)
-- Objetivo do codigo : Cria infraestrutura de fechamento mensal de orçamentos:
--                      • monthly_goals  — meta mensal por vendedor
--                      • monthly_closure — fechamento/snapshot mensal por tenant
--                      • RPC get_monthly_live_data — agrega orçamentos de todos os
--                        vendedores do tenant (SECURITY DEFINER, cross-user)
-- Dependências       : public.org_tenants, public.profiles, public.chats
-- Versão/Alteração   :
-- [ 0.1.0 ]          : Versão inicial - SUP-000004
-- =====================================================================================================
*/

-- ============================================================
-- 1. Tabela de metas mensais por vendedor
-- ============================================================
CREATE TABLE IF NOT EXISTS public.monthly_goals (
  id          uuid          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid          NOT NULL REFERENCES public.org_tenants(id) ON DELETE CASCADE,
  profile_id  uuid          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mes         text          NOT NULL,
  goal_amount numeric(14,2) NOT NULL DEFAULT 0,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT monthly_goals_mes_format CHECK (mes ~ '^\d{4}-\d{2}$'),
  CONSTRAINT monthly_goals_unique     UNIQUE (tenant_id, profile_id, mes)
);

ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer membro do tenant
CREATE POLICY "monthly_goals_tenant_read"
  ON public.monthly_goals FOR SELECT
  USING (tenant_id = app.current_tenant_id());

-- Escrita: somente admin do tenant
CREATE POLICY "monthly_goals_admin_write"
  ON public.monthly_goals FOR ALL
  USING (
    tenant_id = app.current_tenant_id()
    AND (
      SELECT role FROM public.profiles
      WHERE id = (SELECT app.current_profile_id())
    ) = 'admin'
  )
  WITH CHECK (
    tenant_id = app.current_tenant_id()
    AND (
      SELECT role FROM public.profiles
      WHERE id = (SELECT app.current_profile_id())
    ) = 'admin'
  );

CREATE TRIGGER set_monthly_goals_updated_at
  BEFORE UPDATE ON public.monthly_goals
  FOR EACH ROW EXECUTE FUNCTION public.app_set_updated_at();

-- ============================================================
-- 2. Tabela de fechamentos mensais (snapshot)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.monthly_closure (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id  uuid        NOT NULL REFERENCES public.org_tenants(id) ON DELETE CASCADE,
  mes        text        NOT NULL,
  closed_at  timestamptz,
  closed_by  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  snapshot   jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monthly_closure_mes_format CHECK (mes ~ '^\d{4}-\d{2}$'),
  CONSTRAINT monthly_closure_unique     UNIQUE (tenant_id, mes)
);

ALTER TABLE public.monthly_closure ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer membro do tenant
CREATE POLICY "monthly_closure_tenant_read"
  ON public.monthly_closure FOR SELECT
  USING (tenant_id = app.current_tenant_id());

-- Escrita: somente admin
CREATE POLICY "monthly_closure_admin_write"
  ON public.monthly_closure FOR ALL
  USING (
    tenant_id = app.current_tenant_id()
    AND (
      SELECT role FROM public.profiles
      WHERE id = (SELECT app.current_profile_id())
    ) = 'admin'
  )
  WITH CHECK (
    tenant_id = app.current_tenant_id()
    AND (
      SELECT role FROM public.profiles
      WHERE id = (SELECT app.current_profile_id())
    ) = 'admin'
  );

-- ============================================================
-- 3. RPC: agrega dados mensais de todos os vendedores
--    SECURITY DEFINER: bypassa o RLS de chats (autor-próprio)
--    permitindo que admin veja todos os vendedores do tenant.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_monthly_live_data(p_mes text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_from_date date;
  v_to_date   date;
  v_result    jsonb;
BEGIN
  -- Garante que a chamada vem de um usuário autenticado do tenant
  v_tenant_id := app.current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  v_from_date := (p_mes || '-01')::date;
  v_to_date   := v_from_date + INTERVAL '1 month';

  SELECT jsonb_agg(row_to_json(t)) INTO v_result
  FROM (
    SELECT
      p.id                                       AS profile_id,
      p.full_name                                AS seller_name,
      COALESCE(g.goal_amount, 0)                 AS goal,
      COALESCE(agg.realized, 0)                  AS realized,
      COALESCE(agg.count_won, 0)::int            AS count,
      COALESCE(agg.lost, 0)                      AS lost
    FROM public.profiles p
    LEFT JOIN public.monthly_goals g
      ON  g.profile_id = p.id
      AND g.mes        = p_mes
      AND g.tenant_id  = v_tenant_id
    LEFT JOIN (
      SELECT
        c.author_user_id,
        SUM(
          CASE WHEN (b.item->>'status') = 'ganha'
               THEN (b.item->>'amount')::numeric
               ELSE 0 END
        )                                          AS realized,
        COUNT(
          DISTINCT CASE WHEN (b.item->>'status') = 'ganha' THEN c.id END
        )                                          AS count_won,
        SUM(
          CASE WHEN (b.item->>'status') = 'perdida'
               THEN (b.item->>'amount')::numeric
               ELSE 0 END
        )                                          AS lost
      FROM public.chats c,
        LATERAL jsonb_array_elements(
          COALESCE(c.budgets, '[]'::jsonb)
        ) AS b(item)
      WHERE c.tenant_id    = v_tenant_id
        AND c.calendar_at >= v_from_date
        AND c.calendar_at <  v_to_date
        AND c.budgets      IS NOT NULL
        AND jsonb_typeof(c.budgets) = 'array'
        AND jsonb_array_length(c.budgets) > 0
      GROUP BY c.author_user_id
    ) agg ON agg.author_user_id = p.id
    WHERE p.tenant_id = v_tenant_id
      AND p.status    = 'active'
      AND (
            COALESCE(g.goal_amount,  0) > 0
         OR COALESCE(agg.realized,   0) > 0
         OR COALESCE(agg.lost,       0) > 0
      )
    ORDER BY COALESCE(agg.realized, 0) DESC
  ) t;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_live_data(text) TO authenticated;

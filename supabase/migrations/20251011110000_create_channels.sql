-- ===================================================
-- Código: supabase/migrations/20251011110000_create_channels.sql
-- Versão: 1.1.0
-- Data/Hora: 2025-10-11 12:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: [CORREÇÃO] Criar a tabela 'channels' e o gatilho em 'public.org_tenants'.
-- Fluxo: A criação de um registro em 'public.org_tenants' dispara um gatilho para popular 'public.channels'.
-- Dependências: Tabela public.org_tenants
-- ===================================================

-- [BLOCK] Cria o tipo ENUM para os canais
CREATE TYPE public.channel_kind AS ENUM (
    'email',
    'phone',
    'instant_message',
    'url',
    'other'
);

-- [BLOCK] Criação da tabela 'channels'
CREATE TABLE IF NOT EXISTS public.channels (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    kind public.channel_kind NOT NULL,
    label_custom text,
    is_enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT channels_pkey PRIMARY KEY (id),
    CONSTRAINT channels_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.org_tenants(id) ON DELETE CASCADE,
    CONSTRAINT channels_tenant_id_kind_key UNIQUE (tenant_id, kind)
);

-- [BLOCK] Habilita RLS na tabela 'channels'
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

-- [BLOCK] Política de SELECT para usuários autenticados do mesmo tenant
CREATE POLICY "Allow authenticated users to view their own tenant channels"
ON public.channels
FOR SELECT
TO authenticated
USING ((EXISTS ( SELECT 1
   FROM public.org_tenants
  WHERE (public.org_tenants.id = public.channels.tenant_id))));

-- [BLOCK] Política de UPDATE para usuários autenticados do mesmo tenant
CREATE POLICY "Allow authenticated users to update their own tenant channels"
ON public.channels
FOR UPDATE
TO authenticated
USING ((EXISTS ( SELECT 1
   FROM public.org_tenants
  WHERE (public.org_tenants.id = public.channels.tenant_id))))
WITH CHECK ((EXISTS ( SELECT 1
   FROM public.org_tenants
  WHERE (public.org_tenants.id = public.channels.tenant_id))));

-- [BLOCK] Função para popular os canais padrão de um novo tenant
CREATE OR REPLACE FUNCTION public.handle_new_tenant_channels()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.channels (tenant_id, kind)
  VALUES
    (NEW.id, 'email'),
    (NEW.id, 'phone'),
    (NEW.id, 'instant_message'),
    (NEW.id, 'url'),
    (NEW.id, 'other');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- [NOTA] SECURITY DEFINER é crucial para que a função tenha permissão para inserir na tabela 'channels',
-- especialmente se o gatilho for acionado indiretamente por uma operação no schema 'auth'.

-- [BLOCK] Gatilho que dispara na criação de um novo tenant
-- [CORREÇÃO] O gatilho agora está corretamente na tabela 'public.org_tenants'.
CREATE TRIGGER on_tenant_created_add_channels
  AFTER INSERT ON public.org_tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_tenant_channels();

-- [BLOCK] Função para resetar os canais para o padrão
CREATE OR REPLACE FUNCTION public.reset_default_channels()
RETURNS void AS $$
DECLARE
  current_tenant_id uuid;
BEGIN
  -- [--TÉCNICA--] Obtém o tenant_id do usuário logado a partir da tabela 'profiles'.
  SELECT tenant_id INTO current_tenant_id
  FROM public.profiles
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  -- [--REGRA--] Atualiza apenas os canais do tenant encontrado.
  IF current_tenant_id IS NOT NULL THEN
    UPDATE public.channels
    SET is_enabled = true, label_custom = NULL
    WHERE tenant_id = current_tenant_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

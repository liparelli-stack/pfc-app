-- ===================================================
-- Código: supabase/migrations/20250525100000_create_channels.sql
-- Versão: 1.0.0
-- Data/Hora: 2025-10-11 10:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Criar a estrutura da tabela 'channels' e automações relacionadas.
-- Fluxo: org_tenants (trigger) -> channels
-- Dependências: Tabela org_tenants, Tabela profiles
-- ===================================================

-- [--BLOCO--] Função utilitária para obter o tenant_id do usuário autenticado.
-- [NOTA] Essencial para as políticas de RLS e operações de usuário.
create or replace function auth.tenant_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select tenant_id from profiles where auth_user_id = auth.uid() limit 1;
$$;

-- [--BLOCO--] Criação do tipo ENUM para os canais de comunicação.
-- [REGRA] Garante que os tipos de canais sejam consistentes e fixos.
create type public.channel_kind as enum (
  'email',
  'phone',
  'instant_message',
  'url',
  'other'
);

-- [--BLOCO--] Criação da tabela 'channels'.
create table if not exists public.channels (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.org_tenants(id) on delete cascade,
  kind          public.channel_kind not null,
  label_custom  text,
  is_enabled    boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- [REGRA] Garante que cada tenant tenha apenas um registro por tipo de canal.
  unique (tenant_id, kind)
);

comment on table public.channels is 'Catálogo de canais de comunicação por tenant.';

-- [--BLOCO--] Habilitação de RLS para a tabela 'channels'.
alter table public.channels enable row level security;

-- [--BLOCO--] Políticas de RLS.
-- [REGRA] Permite que usuários autenticados vejam apenas os canais do seu próprio tenant.
create policy "Allow authenticated users to read their own tenant's channels"
on public.channels for select
to authenticated
using (tenant_id = auth.tenant_id());

-- [REGRA] Permite que usuários autenticados atualizem apenas os canais do seu próprio tenant.
create policy "Allow authenticated users to update their own tenant's channels"
on public.channels for update
to authenticated
using (tenant_id = auth.tenant_id())
with check (tenant_id = auth.tenant_id());

-- [--BLOCO--] Trigger para atualizar o campo 'updated_at'.
create trigger set_timestamp
before update on public.channels
for each row
execute function public.app_set_updated_at();

-- [--BLOCO--] Função de trigger para criar os canais padrão para um novo tenant.
create or replace function public.handle_new_tenant_channels()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.channels (tenant_id, kind)
  values
    (new.id, 'email'),
    (new.id, 'phone'),
    (new.id, 'instant_message'),
    (new.id, 'url'),
    (new.id, 'other');
  return new;
end;
$$;

-- [--BLOCO--] Criação do trigger na tabela 'org_tenants'.
create trigger on_new_tenant_create_channels
after insert on public.org_tenants
for each row
execute function public.handle_new_tenant_channels();


-- [--BLOCO--] Função RPC para resetar os canais para o padrão.
-- [NOTA] Permite que o frontend execute uma operação de atualização em massa de forma segura.
create or replace function public.reset_default_channels()
returns void
language sql
as $$
  update public.channels
  set 
    is_enabled = true,
    label_custom = null
  where
    tenant_id = auth.tenant_id();
$$;

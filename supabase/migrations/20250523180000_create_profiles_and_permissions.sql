-- ===================================================
-- Código: supabase/migrations/20250523180000_create_profiles_and_permissions.sql
-- Versão: 1.0
-- Data/Hora: 2025-05-23 18:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Criar tabela de perfis (public.profiles) com RLS e funções de apoio.
-- Fluxo: A tabela org_tenants é pré-requisito.
-- Dependências: Tabela public.org_tenants, função auth.uid().
-- ===================================================

-- [BLOCK] Função para gatilho de 'updated_at'
-- [NOTE] Garante que o campo 'updated_at' seja atualizado automaticamente.
CREATE OR REPLACE FUNCTION public.app_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- [BLOCK] Criação da tabela de perfis
create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.org_tenants(id) on delete cascade,
  auth_user_id  uuid not null, -- [RULE] FK lógica para auth.users.id
  full_name     text not null,
  position      text check (position in ('vendedor','técnico','coordenador')),
  role          text not null default 'user' check (role in ('admin','user')),
  department    text,
  status        text not null default 'active' check (status in ('active','inactive')),
  email         text not null,
  avatar_url    text,
  locale        text not null default 'pt-BR',
  timezone      text not null default 'America/Sao_Paulo',
  mfa_enabled   boolean not null default false,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid,
  updated_by    uuid,
  export_state  text not null default 'Create',
  deleted_at    timestamptz,
  kb_can_edit   boolean not null default false,
  unique (tenant_id, auth_user_id),
  unique (tenant_id, email)
);

-- [BLOCK] Comentários da tabela e colunas
comment on table public.profiles is 'Armazena perfis de usuários, vinculados a um tenant e a um usuário de autenticação.';
comment on column public.profiles.auth_user_id is 'Referência ao ID do usuário no schema auth.users.';

-- [BLOCK] Trigger para 'updated_at'
-- [NOTE] Dispara a função app_set_updated_at() antes de qualquer atualização na linha.
create trigger set_timestamp
before update on public.profiles
for each row
execute function public.app_set_updated_at();

-- [BLOCK] Índices para otimização de consultas
create index if not exists idx_profiles_tenant_id on public.profiles(tenant_id);
create index if not exists idx_profiles_auth_user_id on public.profiles(auth_user_id);
create index if not exists idx_profiles_email on public.profiles(email);

-- [BLOCK] Habilitação do Row Level Security (RLS)
alter table public.profiles enable row level security;

-- [BLOCK] Políticas de RLS
-- [NOTE] A política abaixo é permissiva e permite que qualquer usuário autenticado
-- acesse ou modifique QUALQUER perfil. Em um ambiente multi-tenant real,
-- esta regra deve ser substituída por uma política que restrinja o acesso
-- com base no tenant_id do usuário. Ex: (get_current_user_tenant_id() = tenant_id)
create policy "Allow all access to authenticated users"
on public.profiles for all
to authenticated
using (true)
with check (true);

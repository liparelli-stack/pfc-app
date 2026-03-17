-- ===================================================
-- Código: /supabase/migrations/20251014100000_create_contacts_table.sql
-- Versão: 1.0.0
-- Data/Hora: 2025-10-14 10:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Criar a tabela 'contacts' para o catálogo de contatos.
-- Fluxo: org_tenants -> companies -> contacts
-- Dependências: public.org_tenants, public.companies, função app_set_updated_at()
-- ===================================================

-- [BLOCO] Criação do ENUM para status
create type public.contact_status as enum ('active', 'inactive');

-- [BLOCO] Criação da tabela public.contacts
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.org_tenants(id) on delete cascade,
  company_id uuid null references public.companies(id) on delete set null,
  full_name text not null,
  email text null,
  phone text null,
  position text null,
  is_primary boolean null,
  status public.contact_status not null default 'active',
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  export_state text not null default 'Create'
);

-- [BLOCO] Comentários da tabela e colunas
comment on table public.contacts is 'Catálogo de contatos associados a um tenant e opcionalmente a uma empresa.';
comment on column public.contacts.is_primary is 'Indica se este é o contato principal da empresa.';

-- [BLOCO] Índices
create index if not exists idx_contacts_tenant_id on public.contacts (tenant_id);
create index if not exists idx_contacts_tenant_company on public.contacts (tenant_id, company_id);
create index if not exists idx_contacts_full_name_lower on public.contacts using btree (lower(full_name));
create index if not exists idx_contacts_tenant_status on public.contacts (tenant_id, status);
create index if not exists idx_contacts_tenant_email on public.contacts (tenant_id, email) where email is not null;

-- [BLOCO] Trigger para updated_at
drop trigger if exists set_timestamp on public.contacts;
create trigger set_timestamp
before update on public.contacts
for each row
execute function public.app_set_updated_at();

-- [BLOCO] Row Level Security (RLS)
alter table public.contacts enable row level security;

drop policy if exists "Allow all access for authenticated users" on public.contacts;
create policy "Allow all access for authenticated users"
on public.contacts
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

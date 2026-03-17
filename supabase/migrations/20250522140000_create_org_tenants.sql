/*
-- ===================================================
-- Código: /supabase/migrations/20251004_000000_org_tenants_mvp.sql
-- Data/Hora: 2025-10-04 18:30
-- Autor: Dualite Alpha (AD)
-- Objetivo: Consolidar a criação da tabela org_tenants para o MVP,
--           incluindo enum, função endurecida, tabela, comentário,
--           trigger, habilitação de RLS e policies permissivas.
-- Fluxo: Tabela central de metadados do tenant (CRUD liberado para authenticated).
-- Dependências: auth.users (FKs opcionais).
-- Observações:
--   • Esta migration já engloba:
--       - 20250522141500_fix_function_search_path.sql
--       - 20250522150000_update_org_tenants_for_multitenancy.sql
--   • Esses arquivos permanecem no repositório apenas como histórico,
--     mas não precisam ser aplicados separadamente.
-- ===================================================
*/

-- [BLOCK 1] Criação do tipo ENUM de status
-- [NOTE] Postgres não suporta "CREATE TYPE IF NOT EXISTS"; usar criação simples.
-- [WHY] Garante consistência do status ('active' | 'inactive').
create type public.org_tenant_status as enum ('active', 'inactive');


-- [BLOCK 2] Função de auditoria de atualização temporal (hardening)
-- [SECURITY] Define SET search_path = public para mitigar "Function Search Path Mutable".
-- [BEHAVIOR] Atualiza o campo updated_at a cada UPDATE.
create or replace function public.app_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- [BLOCK 3] Criação da tabela org_tenants
/*
  ## Query Description:
  Cria a tabela principal `public.org_tenants` para metadados da organização (tenant).
  Campos com CHECK de tamanho, status (enum), auditoria temporal e FKs opcionais
  para `auth.users` (created_by/updated_by). Pensada para MVP.

  ## Metadata:
  - Schema-Category: "Structural"
  - Impact-Level: "Low"
  - Requires-Backup: false
  - Reversible: true (DROP TABLE após remover dependências)

  ## Structure Details:
  - Colunas: id, company_name, slug, contract_owner, tax_id, address, state, city,
             zip_code, phone_contract_owner, email_contract_owner, status, plan_tier,
             seats_limit, locale, timezone, created_at, updated_at, created_by,
             updated_by, export_state
  - Constraints: PK, UNIQUE (slug), CHECKs de tamanho, FKs opcionais
  - Índices implícitos: PK + UNIQUE(slug)

  ## Security Implications:
  - RLS será habilitado e policies permissivas criadas (MVP).
*/
create table if not exists public.org_tenants (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (length(company_name) <= 150),
  slug text not null unique check (length(slug) <= 50), -- usado em rotas/subdomínios (único por tenant)
  contract_owner text not null check (length(contract_owner) <= 120),
  tax_id text not null check (length(tax_id) <= 32),
  address text check (length(address) <= 200),
  state text check (length(state) <= 50),
  city text check (length(city) <= 80),
  zip_code text check (length(zip_code) <= 12),
  phone_contract_owner text check (length(phone_contract_owner) <= 20),
  email_contract_owner text not null check (length(email_contract_owner) <= 254),
  status public.org_tenant_status not null default 'active',
  plan_tier text not null default 'free',
  seats_limit integer not null default 1 check (seats_limit >= 1),
  locale text not null default 'pt-BR',
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  export_state text not null default 'Create'
);


-- [BLOCK 4] Comentário da tabela
-- [WHY] Documentação in-schema para consulta rápida via GUI/psql.
comment on table public.org_tenants is 'Tabela única para armazenar as informações da organização (tenant).';


-- [BLOCK 5] Trigger de atualização de timestamp
-- [WHY] Garante manutenção automática de updated_at em cada UPDATE.
drop trigger if exists set_timestamp on public.org_tenants;

create trigger set_timestamp
before update on public.org_tenants
for each row
execute function public.app_set_updated_at();


-- [BLOCK 6] Habilitação do RLS (Row Level Security)
-- [WHY] Ativa o regime de políticas; mesmo permissivas no MVP, mantém compatibilidade futura.
alter table public.org_tenants enable row level security;


-- [BLOCK 7] Políticas RLS (MVP - permissivas)
-- [SECURITY] Em MVP, todo usuário autenticado pode CRUD. Em produção, restringir.
create policy "Allow authenticated users to read tenants"
on public.org_tenants
for select
to authenticated
using (true);

create policy "Allow authenticated users to insert tenants"
on public.org_tenants
for insert
to authenticated
with check (true);

create policy "Allow authenticated users to update tenants"
on public.org_tenants
for update
to authenticated
using (true)
with check (true);

create policy "Allow authenticated users to delete tenants"
on public.org_tenants
for delete
to authenticated
using (true);

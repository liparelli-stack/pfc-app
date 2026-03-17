/*
-- ===================================================
-- Código: supabase/migrations/20251013100000_create_companies.sql
-- Versão: 1.0.0
-- Data/Hora: 2025-10-13 10:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Criar a tabela 'companies' e seus tipos e índices associados.
-- Fluxo: N/A (Estrutura de Banco de Dados)
-- Dependências: Tabela 'org_tenants', função 'app_set_updated_at'.
-- ===================================================
*/

-- [--BLOCO--] Criação do tipo ENUM para o status da empresa
create type public.company_status as enum ('active', 'inactive');

-- [--BLOCO--] Criação da tabela 'companies'
create table if not exists public.companies (
  id uuid not null default gen_random_uuid() primary key,
  tenant_id uuid not null references public.org_tenants(id) on delete cascade,
  trade_name text not null,
  legal_name text,
  tax_id text,
  email text,
  phone text,
  website text,
  qualification integer,
  status public.company_status not null default 'active',
  address_line text,
  city text,
  state text,
  zip_code text,
  notes text,
  owner text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- [--BLOCO--] Trigger para 'updated_at'
create trigger set_timestamp
before update on public.companies
for each row
execute function public.app_set_updated_at();

-- [--BLOCO--] Índices de performance e unicidade
-- [--NOTA--] Índice para otimizar busca por nome fantasia (case-insensitive)
create index if not exists idx_companies_trade_name_lower on public.companies (lower(trade_name));

-- [--NOTA--] Índice de unicidade parcial para CNPJ (tax_id) por tenant, apenas se não for nulo/vazio.
create unique index if not exists idx_companies_unique_tax_id_per_tenant on public.companies (tenant_id, tax_id) where (tax_id is not null and tax_id <> '');

-- [--NOTA--] Índices de apoio para buscas comuns
create index if not exists idx_companies_tenant_id on public.companies (tenant_id);
create index if not exists idx_companies_tenant_id_status on public.companies (tenant_id, status);

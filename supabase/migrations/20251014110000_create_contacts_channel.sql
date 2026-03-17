/*
-- ===================================================
-- Código: /supabase/migrations/20251014110000_create_contacts_channel.sql
-- Versão: 1.0.0
-- Data/Hora: 2025-10-14 11:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Criar a tabela `contacts_channel` para armazenar os canais de comunicação de um contato.
-- Fluxo: Esta tabela é filha de `contacts` e `org_tenants`.
-- Dependências: public.org_tenants, public.contacts, public.app_set_updated_at().
-- ===================================================
*/

-- [--BLOCO--] Criação da tabela `contacts_channel`
create table if not exists public.contacts_channel (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.org_tenants(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  type text not null,
  value text not null,
  label_code text not null default 'A',
  label_custom text null,
  is_primary boolean null,
  verified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  export_state text not null default 'Create'
);

comment on table public.contacts_channel is 'Armazena os múltiplos canais de comunicação para cada contato (ex: múltiplos e-mails, telefones).';
comment on column public.contacts_channel.type is 'Tipo de canal (ex.: email, phone, whatsapp, site, linkedin).';
comment on column public.contacts_channel.value is 'Valor do canal (ex.: endereço de email, número de telefone).';
comment on column public.contacts_channel.label_code is 'Código sequencial do rótulo para diferenciar canais do mesmo tipo (A, B, C…).';
comment on column public.contacts_channel.label_custom is 'Nome customizado do rótulo, definido pelo usuário.';
comment on column public.contacts_channel.is_primary is 'Indica se este é o canal principal para o seu tipo (ex: o e-mail principal).';

-- [--BLOCO--] Restrições de unicidade
-- [RULE] Evita a duplicação exata de um canal para o mesmo contato.
alter table public.contacts_channel add constraint contacts_channel_tenant_id_contact_id_type_value_key unique (tenant_id, contact_id, type, value);

-- [RULE] Garante que cada rótulo (A, B, C...) seja único por tipo de canal para um contato.
alter table public.contacts_channel add constraint contacts_channel_tenant_id_contact_id_type_label_code_key unique (tenant_id, contact_id, type, label_code);


-- [--BLOCO--] Índices para otimização de consultas
create index if not exists contacts_channel_tenant_id_idx on public.contacts_channel (tenant_id);
create index if not exists contacts_channel_tenant_id_contact_id_idx on public.contacts_channel (tenant_id, contact_id);
create index if not exists contacts_channel_tenant_id_type_idx on public.contacts_channel (tenant_id, type);
create index if not exists contacts_channel_tenant_id_contact_id_type_is_primary_idx on public.contacts_channel (tenant_id, contact_id, type, is_primary);


-- [--BLOCO--] Trigger para `updated_at`
create trigger set_timestamp
before update on public.contacts_channel
for each row
execute function app_set_updated_at();


-- [--BLOCO--] Row Level Security (RLS)
alter table public.contacts_channel enable row level security;

create policy "Allow all for authenticated users"
on public.contacts_channel
for all
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

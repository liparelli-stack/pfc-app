/*
-- ===================================================
-- Código: /supabase/migrations/20251012100000_secure_channel_functions.sql
-- Versão: 2.0.0
-- Data/Hora: 2025-10-12 11:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: [CORREÇÃO] Recriar as funções 'populate_default_channels' e
--           'reset_default_channels' para garantir que existam e para
--           corrigir a vulnerabilidade "Function Search Path Mutable".
-- Fluxo: Substitui a tentativa de 'ALTER' por 'CREATE OR REPLACE'.
-- Dependências: N/A
-- ===================================================
*/

-- [BLOCK] Recria a função 'populate_default_channels' com um search_path seguro
-- [NOTA] Usa CREATE OR REPLACE para garantir que a função seja criada se não existir, ou atualizada se já existir.
create or replace function public.populate_default_channels()
returns trigger as $$
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
$$ language plpgsql set search_path = public;

-- [BLOCK] Recria a função 'reset_default_channels' com um search_path seguro
create or replace function public.reset_default_channels()
returns void as $$
begin
  update public.channels
  set is_enabled = true, label_custom = null
  where tenant_id = (select tenant_id from public.profiles where auth_user_id = auth.uid() limit 1);
end;
$$ language plpgsql set search_path = public;

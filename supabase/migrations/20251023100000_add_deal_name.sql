/* =============================================================================
RLS para public.deals com base em profiles (auth só resolve o perfil ativo)
- SELECT: todo mundo do mesmo tenant enxerga os deals do tenant
- INSERT: só permite inserir no próprio tenant (força tenant_id)
- UPDATE/DELETE: no mesmo tenant; dono OU admin do tenant
============================================================================= */

-- 1) Limpeza das políticas antigas
drop policy if exists "Deals are visible to their owners" on public.deals;
drop policy if exists "Users can insert their own deals"   on public.deals;
drop policy if exists "Users can update their own deals"   on public.deals;
drop policy if exists "Users can delete their own deals"   on public.deals;

-- 2) SELECT — visão por tenant (modelo profiles-first)
create policy "deals_select_by_tenant"
on public.deals
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.tenant_id    = deals.tenant_id
  )
);

-- 3) INSERT — só no próprio tenant (força tenant_id correto)
create policy "deals_insert_in_own_tenant"
on public.deals
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.tenant_id    = deals.tenant_id
  )
);

-- 4) UPDATE — mesmo tenant E (dono do deal OU admin)
create policy "deals_update_owner_or_admin"
on public.deals
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.tenant_id    = deals.tenant_id
      and (deals.owner_user_id = p.id or p.role = 'admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.tenant_id    = deals.tenant_id
      and (deals.owner_user_id = p.id or p.role = 'admin')
  )
);

-- 5) DELETE — mesmo tenant E (dono OU admin)
create policy "deals_delete_owner_or_admin"
on public.deals
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.auth_user_id = auth.uid()
      and p.tenant_id    = deals.tenant_id
      and (deals.owner_user_id = p.id or p.role = 'admin')
  )
);

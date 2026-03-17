/*
================================================================================
Código: /supabase/migrations/20251022110000_security_hardening_v2.sql
Versão: 2.0.0
Autor: Dualite Alpha (AD)
Objetivo: Corrigir vulnerabilidades de segurança críticas detectadas.
  - [ERROR] Security Definer View: Recria a view `view_contacts_clean` como SECURITY INVOKER.
  - [ERROR] RLS Disabled in Public: Ativa RLS na tabela `contacts_channels_audit` e aplica uma política restritiva.
  - [WARN] Function Search Path Mutable: Define um `search_path` seguro para todas as funções relevantes.
================================================================================
*/

-- =============================================================================
-- [CORREÇÃO 1] Recria a view `view_contacts_clean` com SECURITY INVOKER (padrão)
--
-- Descrição: Remove a propriedade `SECURITY DEFINER` que fazia a view executar
-- com as permissões do seu criador, o que é uma falha de segurança. Agora, ela
-- executará com as permissões do usuário que a consulta.
-- =============================================================================
/*
# [Operation Name] Recreate view_contacts_clean
[This operation recreates the view to enforce the querying user's permissions, fixing a security definer vulnerability.]

## Query Description: [This operation will alter the `view_contacts_clean` view to use `SECURITY INVOKER` permissions. This is a safe change that enhances security by ensuring Row Level Security policies of the calling user are respected. There is no risk to existing data.]

## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [true]

## Structure Details:
- view_contacts_clean

## Security Implications:
- RLS Status: [Enforced]
- Policy Changes: [No]
- Auth Requirements: [None]

## Performance Impact:
- Indexes: [None]
- Triggers: [None]
- Estimated Impact: [None]
*/
DROP VIEW IF EXISTS public.view_contacts_clean;
CREATE VIEW public.view_contacts_clean AS
 SELECT c.id,
    c.tenant_id,
    c.company_id,
    c.full_name,
    c."position",
    c.department,
    c.contact_guard,
    c.status,
    c.notes,
    c.created_at,
    c.updated_at,
    c.export_state,
    COALESCE(( SELECT json_agg(json_build_object('id', ch.id, 'type', lower(ch.type), 'value', ch.value, 'label_custom', ch.label_custom, 'is_preferred', COALESCE(ch.is_preferred, false), 'notes', ch.notes, 'verified_at', ch.verified_at, 'created_at', ch.created_at, 'updated_at', ch.updated_at, 'export_state', ch.export_state) ORDER BY COALESCE(ch.is_preferred, false) DESC, (lower(ch.type)), NULLIF(ch.label_custom, ''::text), ch.value) AS json_agg
           FROM contacts_channel ch
          WHERE ((ch.contact_id = c.id) AND (ch.tenant_id = c.tenant_id))), '[]'::json) AS channels,
    ( SELECT count(*) AS count
           FROM contacts_channel ch2
          WHERE ((ch2.contact_id = c.id) AND (ch2.tenant_id = c.tenant_id))) AS channels_count
   FROM contacts c;


-- =============================================================================
-- [CORREÇÃO 2] Ativa RLS na tabela `contacts_channels_audit`
--
-- Descrição: Habilita a Row Level Security na tabela de auditoria e cria uma
-- política que, por padrão, nega todo o acesso, exceto para superusuários.
-- =============================================================================
/*
# [Operation Name] Enable RLS on contacts_channels_audit
[This operation enables Row Level Security on the audit table and applies a restrictive policy to prevent unauthorized access.]

## Query Description: [This operation will enable RLS on the `contacts_channels_audit` table. A policy will be added to deny all access by default, protecting sensitive audit data. This is a critical security enhancement with no risk to data integrity.]

## Metadata:
- Schema-Category: ["Security"]
- Impact-Level: ["High"]
- Requires-Backup: [false]
- Reversible: [true]

## Structure Details:
- contacts_channels_audit

## Security Implications:
- RLS Status: [Enabled]
- Policy Changes: [Yes]
- Auth Requirements: [Admin-level for access]

## Performance Impact:
- Indexes: [None]
- Triggers: [None]
- Estimated Impact: [Negligible performance impact on queries.]
*/
ALTER TABLE public.contacts_channels_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny all access by default" ON public.contacts_channels_audit;
CREATE POLICY "Deny all access by default"
ON public.contacts_channels_audit
FOR ALL
USING (false)
WITH CHECK (false);


-- =============================================================================
-- [CORREÇÃO 3] Define um `search_path` seguro para as funções
--
-- Descrição: Altera as funções para fixar o `search_path`, mitigando o risco
-- de ataques de sequestro de caminho de busca (hijacking).
-- =============================================================================
/*
# [Operation Name] Secure Function Search Paths
[This operation sets a fixed, secure `search_path` for multiple functions to prevent potential hijacking vulnerabilities.]

## Query Description: [This operation modifies several internal functions to set a secure `search_path`. This is a preventative security measure that has no impact on data or application functionality. It is a safe and recommended change.]

## Metadata:
- Schema-Category: ["Security"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [true]

## Structure Details:
- handle_new_tenant_channels
- populate_default_channels
- reset_default_channels
- fn_audit_contacts_channels
- contacts_channel_normalize
- app_set_updated_at
- get_my_profile_id

## Security Implications:
- RLS Status: [Unaffected]
- Policy Changes: [No]
- Auth Requirements: [None]

## Performance Impact:
- Indexes: [None]
- Triggers: [None]
- Estimated Impact: [None]
*/
ALTER FUNCTION public.handle_new_tenant_channels() SET search_path = 'public';
ALTER FUNCTION public.populate_default_channels() SET search_path = 'public';
ALTER FUNCTION public.reset_default_channels() SET search_path = 'public';
ALTER FUNCTION public.fn_audit_contacts_channels() SET search_path = 'public';
ALTER FUNCTION public.contacts_channel_normalize() SET search_path = 'public';
ALTER FUNCTION public.app_set_updated_at() SET search_path = 'public';
ALTER FUNCTION public.get_my_profile_id() SET search_path = 'public';

-- ===================================================
-- Código: /supabase/migrations/20250523190000_secure_functions_search_path.sql
-- Versão: 1.0
-- Data/Hora: 2025-05-23 19:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Corrigir o aviso de segurança "Function Search Path Mutable" definindo um search_path explícito para as funções existentes.
-- Fluxo: N/A (Alteração de metadados de função)
-- Dependências: Função app_set_updated_at()
-- ===================================================

/*
# [Fix Function Search Path]
This operation hardens the security of existing database functions by explicitly setting their `search_path`. This prevents potential hijacking attacks where a malicious user could create objects in other schemas to alter the function's behavior.

## Query Description: This operation modifies the metadata of the `app_set_updated_at` function. It is a non-destructive, safe change that improves security without affecting data or application logic.

## Metadata:
- Schema-Category: ["Safe", "Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: false
- Reversible: true

## Structure Details:
- Function: `public.app_set_updated_at()`

## Security Implications:
- RLS Status: Not Applicable
- Policy Changes: No
- Auth Requirements: Requires database admin privileges to run.
- Mitigates: `search_path` manipulation attacks.

## Performance Impact:
- Indexes: None
- Triggers: None
- Estimated Impact: Negligible.
*/

-- [BLOCK] Set explicit search_path for app_set_updated_at function
alter function public.app_set_updated_at()
  set search_path = 'public';

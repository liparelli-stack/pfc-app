/*
-- ===================================================
-- Código: /supabase/migrations/20251025110000_secure_remaining_functions.sql
-- Versão: 1.0.0
-- Data/Hora: 2025-10-25 11:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Corrigir o aviso de segurança "Function Search Path Mutable"
--           para a função restante, definindo um search_path seguro.
-- Fluxo: Migração de banco de dados.
-- Dependências: Nenhuma.
-- ===================================================
*/

/*
-- =============================================================================
-- [BLOCO] Correção da Função: handle_new_tenant_channels
-- Objetivo: Definir um search_path explícito para mitigar riscos de segurança.
-- =============================================================================
*/
ALTER FUNCTION public.handle_new_tenant_channels() SET search_path = public;

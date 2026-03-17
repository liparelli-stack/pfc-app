/*
-- ===================================================
-- ENGLOBADA NA PRIMERA MIGRATION 20251004_000000
-- Código: /supabase/migrations/20250522141500_fix_function_search_path.sql
-- Data/Hora: 2025-05-22 14:15
-- Autor: Dualite Alpha (AD)
-- Objetivo: Corrigir o aviso de segurança "Function Search Path Mutable" definindo um search_path explícito para a função de trigger.
-- Fluxo: Alteração da função existente.
-- Dependências: Função public.app_set_updated_at()
-- ===================================================
*/

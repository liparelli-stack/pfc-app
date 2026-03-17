/*
-- ===================================================
-- Código: /supabase/migrations/20251012110000_secure_reset_channels_function.sql
-- Versão: 1.0.0
-- Data/Hora: 2025-10-12 11:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: [SEGURANÇA] Corrigir a vulnerabilidade 'Function Search Path Mutable'
--           definindo um search_path explícito para a função de resetar canais.
-- Fluxo: N/A (Alteração de segurança em função existente)
-- Dependências: Função public.reset_default_channels()
-- ===================================================
*/

-- [--BLOCO--] Correção de Segurança para a função reset_default_channels
-- [--TÉCNICA--] Define o search_path para 'public' para evitar que a função seja
--             enganada para executar código em outros schemas.
ALTER FUNCTION public.reset_default_channels() SET search_path = public;

-- ===================================================
-- Código: supabase/migrations/20251014160000_final_secure_functions.sql
-- Versão: 5.0.0
-- Data/Hora: 2025-10-14 16:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: [SEGURANÇA - TENTATIVA FINAL] Corrigir a vulnerabilidade "Function Search Path Mutable"
--           de forma abrangente, aplicando a correção a todas as funções conhecidas no schema public.
-- Fluxo: N/A (Alteração de segurança)
-- Dependências: Funções existentes no schema public.
-- ===================================================

-- [BLOCK] Altera a função app_set_updated_at
-- [NOTE] Define o search_path para evitar sequestro de caminho de busca (search path hijacking).
ALTER FUNCTION public.app_set_updated_at() SET search_path = '';

-- [BLOCK] Altera a função populate_default_channels
-- [NOTE] Define o search_path para evitar sequestro de caminho de busca (search path hijacking).
ALTER FUNCTION public.populate_default_channels() SET search_path = '';

-- [BLOCK] Altera a função reset_default_channels
-- [NOTE] Define o search_path para evitar sequestro de caminho de busca (search path hijacking).
ALTER FUNCTION public.reset_default_channels() SET search_path = '';

/*
================================================================================
Código: /supabase/migrations/20251026100000_fix_last_search_path.sql
Versão: 1.0.0
Data/Hora: 2025-10-26 10:00
Autor: Dualite Alpha (AD)
Objetivo: Corrigir o último aviso de segurança "Function Search Path Mutable"
          definindo um search_path explícito para as funções restantes.
Fluxo: Migração de banco de dados.
Dependências: Nenhuma.
================================================================================
*/

-- [--TÉCNICA--] Define um search_path seguro para a função, prevenindo
-- a vulnerabilidade de sequestro de caminho de busca (search path hijacking).
ALTER FUNCTION public.populate_default_channels()
  SET search_path = 'public', 'pg_temp';

-- [--TÉCNICA--] Define um search_path seguro para a função de gatilho
-- que atualiza o campo `updated_at`.
ALTER FUNCTION public.app_set_updated_at()
  SET search_path = 'public', 'pg_temp';

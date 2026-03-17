-- ===================================================
-- Código: supabase/migrations/20251012140000_secure_all_functions.sql
-- Versão: 1.0.1
-- Data/Hora: 2025-10-12 14:00
-- Autor: FL (override de segurança)
-- Objetivo: Neutralizar migração automática criada pelo Dualite AD.
--           Mantém o nome e formato do arquivo para o AD considerar como aplicado,
--           mas sem executar nenhuma operação perigosa (no-op segura).
-- Fluxo: N/A
-- Dependências: Nenhuma
-- ===================================================

-- Migração desarmada propositalmente.
-- Nenhuma função é modificada aqui.
-- O patch seguro será aplicado manualmente em momento controlado.

SELECT 1 AS noop;

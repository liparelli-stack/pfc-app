/*
-- ===================================================
-- Código: supabase/migrations/20251008110000_make_auth_user_id_nullable.sql
-- Versão: 1.0.0
-- Data/Hora: 2025-10-08 11:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: [CORREÇÃO] Tornar a coluna 'auth_user_id' na tabela 'profiles' nula.
-- Fluxo: Permite a criação de perfis sem um ID de autenticação associado, tratando a tabela como independente.
-- Dependências: Tabela 'profiles' existente.
-- ===================================================
*/

/*
# [Operation Name]
Tornar 'auth_user_id' Nula

## Query Description: [Esta operação remove a restrição NOT NULL da coluna `auth_user_id` na tabela `profiles`. Isso permitirá que novos perfis sejam criados sem um ID de autenticação, alinhando o banco de dados com a regra de negócio de que a tabela `profiles` é independente do sistema de autenticação. Não há risco de perda de dados existentes.]

## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: [false]
- Reversible: [true]

## Structure Details:
- Tabela afetada: public.profiles
- Coluna afetada: auth_user_id
- Mudança: Remoção da constraint NOT NULL

## Security Implications:
- RLS Status: [Enabled]
- Policy Changes: [No]
- Auth Requirements: [None]

## Performance Impact:
- Indexes: [No]
- Triggers: [No]
- Estimated Impact: [Nenhum impacto de performance esperado.]
*/

-- [BLOCK] Altera a coluna para permitir valores nulos
alter table public.profiles
alter column auth_user_id drop not null;

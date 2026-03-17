/*
-- ===================================================
-- Código: /supabase/functions/_shared/cors.ts
-- Versão: 1.0
-- Data/Hora: 2025-05-24 10:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Definir cabeçalhos CORS reutilizáveis para Edge Functions.
-- Fluxo: Importado por todas as Edge Functions que precisam de acesso via browser.
-- Dependências: N/A
-- ===================================================
*/
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

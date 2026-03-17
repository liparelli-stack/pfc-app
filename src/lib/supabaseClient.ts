/*
-- ===================================================
-- Código                 : /src/lib/supabaseClient.ts
-- Versão (.v16)         : 3.1.0
-- Data/Hora             : 2025-11-12 19:50 America/Sao_Paulo
-- Autor                 : FL/Eva GPT
-- Objetivo              : Cliente Supabase configurado para Auth/JWT puro,
--                         sem uso de headers/localStorage para escopo/identidade.
--                         Coerência DEV=PROD e estabilidade de sessão.
-- Fluxo                 : Importado por toda a camada de dados/serviços do app.
-- Dependências          : @supabase/supabase-js
-- Notas                 : Alinhado às diretrizes "JWT sem headers/localStorage" e RLS canônica.
-- Alterações (3.1.0)    :
--   • [COMPAT] Adicionado alias exportado `supabaseClient` apontando para `supabase`,
--     garantindo compatibilidade com imports antigos: { supabaseClient } from "@/lib/supabaseClient".
-- ===================================================
*/

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------
// 1) Variáveis de ambiente (obrigatórias)
// ---------------------------------------------------
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be defined in .env file');
}

// ---------------------------------------------------
// 2) Cliente Supabase — SEM headers X-* e SEM localStorage custom
//    • Auth/JWT = única fonte de verdade (RLS resolve current_* no DB)
//    • Sem wrappers de fetch; sem injeção de contexto por cabeçalho
// ---------------------------------------------------
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ---------------------------------------------------
// 3) Alias de compatibilidade
//    • Permite que imports antigos continuem funcionando:
//      import { supabaseClient } from "@/lib/supabaseClient";
// ---------------------------------------------------
export const supabaseClient = supabase;

/*
[--TÉCNICA--]
- Removido:
  • Fallbacks FL_PROFILE_ID_FALLBACK / FL_TENANT_ID_FALLBACK
  • get/setCurrentProfileId / get/setCurrentTenantId
  • injectedFetch com X-Profile-Id / X-Tenant-Id
- Mantido:
  • Persistência/refresh de sessão para estabilidade de rede
- Diretrizes:
  • "JWT sem headers/localStorage". A autorização é feita exclusivamente
    pelas políticas RLS baseadas em app.current_profile_id() /
    app.current_tenant_id() (resolvidas no Postgres via auth.uid()).
- Compatibilidade:
  • O alias `supabaseClient` evita que seja necessário refatorar todos os
    módulos antigos de uma vez. Novos códigos podem usar apenas `supabase`.
*/

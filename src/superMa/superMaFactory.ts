/*
-- ===================================================
-- Código             : /src/superMa/superMaFactory.ts
-- Versão (.v20)      : 1.2.0
-- Data/Hora          : 2025-12-10 01:40 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo :
--   Selecionar automaticamente qual Service do Super MA
--   (DEV, PROD ou OFF) será utilizado pelo Controller.
--
--   • DEV  → modo seguro/simulado (sem trocar sessão, sem verifyOtp)
--   • PROD → impersonação real (usa Edge + maImpersonationClient)
--   • OFF  → recurso totalmente desativado
-- ===================================================
*/

import { SuperMaService } from './superMaTypes';
import { superMaServiceDev } from './superMaServiceDev';     // ← REAL (verifyOtp)
import { superMaServiceProd } from './superMaServiceProd';   // ← SAFE (simulado)

// Lê o valor bruto da env (pode vir como "dev", "dev-real", "prod", "prod-safe", etc.)
const RAW_MODE = (import.meta.env.VITE_SUPER_MA_MODE || '').toString().toLowerCase();

/**
 * Normalização:
 *  - "dev" ou "dev-safe"  → dev   (simulado)
 *  - "prod" ou "prod-real" → prod (real)
 *  - vazio ou qualquer outra coisa:
 *      • se Vite estiver em modo DEV → dev
 *      • senão                       → off
 */
function resolveMode(): 'dev' | 'prod' | 'off' {
  if (RAW_MODE === 'dev' || RAW_MODE === 'dev-real' || RAW_MODE === 'dev-safe') return 'dev';
  if (RAW_MODE === 'prod' || RAW_MODE === 'prod-real' || RAW_MODE === 'prod-safe') return 'prod';

  // fallback inteligente: em ambiente de desenvolvimento, DEV SAFE por padrão
  if (import.meta.env.DEV) return 'dev';

  return 'off';
}

const MODE = resolveMode();

export function superMaFactory(): SuperMaService {
  // -----------------------------------
  // DEV = SIMULADO (SAFE)
  // -----------------------------------
  if (MODE === 'dev') {
    console.info('[Super MA] Modo DEV SAFE (simulado, sem trocar sessão)');
    return superMaServiceProd;   // ← simulado
  }

  // -----------------------------------
  // PROD = REAL (impersonação completa)
  // -----------------------------------
  if (MODE === 'prod') {
    console.info('[Super MA] Modo PROD REAL (impersonação ativa)');
    return superMaServiceDev;    // ← real
  }

  // -----------------------------------
  // OFF
  // -----------------------------------
  console.info('[Super MA] Modo OFF (desativado)');
  return {
    async enter() {
      console.warn('[Super MA] Modo OFF — entrada bloqueada.');
      return { mode: 'IDLE' };
    },
    async exit() {
      console.warn('[Super MA] Modo OFF — saída bloqueada.');
      return { mode: 'IDLE' };
    },
  };
}

/*
-- ===================================================
-- Código             : /src/superMa/superMaServiceProd.ts
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-12-10 00:22 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo :
--   Implementação segura (PROD) do Super MA.
--
--   • NÃO chama Edge Function.
--   • NÃO chama verifyOtp.
--   • Apenas simula a entrada/saída do modo Super MA
--     para manter a mesma UX, sem trocar a sessão real.
--
-- Fluxo              : Controller -> superMaServiceProd
-- Alterações (1.0.0) :
--   • Criação inicial da Strategy PROD (safe/simulado).
-- Dependências       :
--   - superMaTypes.ts
-- ===================================================
*/

import { SuperMaService } from './superMaTypes';

export const superMaServiceProd: SuperMaService = {
  //------------------------------------------------------------
  // ENTRAR EM SUPER MA (PROD → modo simulado, sem trocar sessão)
  //------------------------------------------------------------
  async enter(profileId: string) {
    console.info(
      '[Super MA][PROD] Enter simulado para profileId:',
      profileId,
    );

    // Em produção, mantemos a mesma UX:
    // - Controller verá mode = 'AS_USER'
    // - Tema vermelho e UI serão ajustados lá
    // - Nenhuma sessão real é alterada aqui
    return { mode: 'AS_USER' };
  },

  //------------------------------------------------------------
  // SAIR DO SUPER MA (PROD → apenas volta UI, sem trocar sessão)
  //------------------------------------------------------------
  async exit() {
    console.info('[Super MA][PROD] Exit simulado');

    // Controller verá mode = 'MA_GLOBAL'
    // e restaurará o tema/status visual
    return { mode: 'MA_GLOBAL' };
  },
};

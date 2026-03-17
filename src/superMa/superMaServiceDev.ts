/*
-- ===================================================
-- Código             : /src/superMa/superMaServiceDev.ts
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-12-10 00:15 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo :
--   Implementação DEV REAL do Super MA — usa a Edge Function
--   e o fluxo completo de impersonação via verifyOtp.
--
--   • Entra: chama toggleMaImpersonation({ action: 'enter' })
--   • Sai:   chama toggleMaImpersonation({ action: 'exit' })
--
-- Fluxo              : Controller -> superMaServiceDev -> maImpersonationClient
-- Alterações (1.0.0) :
--   • Criação inicial da Strategy DEV.
-- Dependências       :
--   - src/services/maImpersonationClient.ts
-- ===================================================
*/

import { toggleMaImpersonation } from '@/services/maImpersonationClient';
import { SuperMaService } from './superMaTypes';

export const superMaServiceDev: SuperMaService = {
  //------------------------------------------------------------
  // ENTRAR EM SUPER MA (DEV → impersonação real)
  //------------------------------------------------------------
  async enter(profileId: string) {
    const { mode } = await toggleMaImpersonation({
      action: 'enter',
      simulatedProfileId: profileId,
      note: 'Super MA DEV: enter',
      metadata: { source: 'dev-strategy' },
    });

    return { mode };
  },

  //------------------------------------------------------------
  // SAIR DO SUPER MA (voltar para MA)
  //------------------------------------------------------------
  async exit() {
    const { mode } = await toggleMaImpersonation({
      action: 'exit',
      note: 'Super MA DEV: exit',
      metadata: { source: 'dev-strategy' },
    });

    return { mode };
  },
};

// =====================================================================
// Código             : /src/services/maImpersonationClient.ts
// Versão (.v20)      : v1.0
// Data/Hora          : 2025-12-09 15:42
// Autor              : FL / Execução via você EVA
// Objetivo do codigo :
//   Client front-end para o "Super MA", integrando com a Edge Function
//   `ma-impersonation` e realizando a troca de sessão via Magic Link
//   (verifyOtp com token_hash), sem alterar fluxos de login/logout
//   existentes e sem tocar em listas/hooks de negócio.
// Fluxo              :
//   Ctrl+| (front) ->
//     toggleMaImpersonation(action, simulatedProfileId?) ->
//       supabase.functions.invoke('ma-impersonation') ->
//       recebe token_hash ->
//       supabase.auth.verifyOtp({ type: 'magiclink', token_hash }) ->
//       sessão atual passa a ser MA ou USER conforme o modo.
// Alterações (X.X.X) :
//   • Criado client de serviço maImpersonationClient para encapsular
//     chamadas à Edge Function e à troca de sessão.
// Dependências       :
//   • src/lib/supabaseClient.ts (instância do supabase-js v2)
//   • Edge Function: ma-impersonation
// =====================================================================

import { supabase } from "@/lib/supabaseClient";

export type MaImpersonationMode = "AS_USER" | "MA_GLOBAL";
export type MaImpersonationToggleAction = "enter" | "exit";

export type MaImpersonationOcorrencia =
  | "abertura_normal"
  | "encerramento_normal"
  | "encerramento_sistema_autocorrecao"
  | "encerramento_sistema_multiplas"
  | "encerramento_sistema_login"
  | "encerramento_sistema_logout";

export interface MaImpersonationSessionLog {
  id: string;
  tenant_id: string;
  ma_profile_id: string;
  simulated_profile_id: string;
  started_at: string;
  ended_at?: string | null;
}

export interface MaImpersonationEdgeResponse {
  mode: MaImpersonationMode;
  token_hash: string;
  session_log?: MaImpersonationSessionLog;
}

export interface ToggleMaImpersonationParams {
  action: MaImpersonationToggleAction;
  /**
   * Obrigatório quando action = 'enter'.
   * Ignorado quando action = 'exit'.
   */
  simulatedProfileId?: string;
  note?: string;
  metadata?: Record<string, unknown>;
}

/**
 * toggleMaImpersonation
 *
 * Cliente front-end para a Edge Function `ma-impersonation`.
 *
 * - Quando action = 'enter':
 *   • Entra em modo AS_USER para o profile informado (simulatedProfileId).
 * - Quando action = 'exit':
 *   • Sai do modo AS_USER e volta para o MA original.
 *
 * Efeito colateral importante:
 *   • Esta função, ao final, chama `supabase.auth.verifyOtp` com o token_hash
 *     retornado pela Edge Function, o que ALTERA a sessão atual do supabase-js
 *     (passando a ser o usuário simulado ou o MA novamente).
 *
 * Uso típico (pseudo):
 *   await toggleMaImpersonation({ action: "enter", simulatedProfileId: "..." });
 *   await toggleMaImpersonation({ action: "exit" });
 */
export async function toggleMaImpersonation(
  params: ToggleMaImpersonationParams,
): Promise<{
  mode: MaImpersonationMode;
  sessionLog?: MaImpersonationSessionLog;
}> {
  const { action, simulatedProfileId, note, metadata } = params;

  if (action === "enter" && !simulatedProfileId) {
    throw new Error(
      'toggleMaImpersonation: "simulatedProfileId" é obrigatório quando action = "enter"',
    );
  }

  const body: Record<string, unknown> = {
    action,
  };

  if (action === "enter") {
    body.simulated_profile_id = simulatedProfileId;
  }

  if (note) {
    body.note = note;
  }

  if (metadata) {
    body.metadata = metadata;
  }

  // Chama a Edge Function `ma-impersonation`
  const { data, error } = await supabase.functions.invoke(
    "ma-impersonation",
    {
      body,
    },
  );

  if (error) {
    console.error("toggleMaImpersonation: edge function error", error);
    throw error;
  }

  const edgeResponse = data as MaImpersonationEdgeResponse | null;

  if (!edgeResponse || !edgeResponse.token_hash || !edgeResponse.mode) {
    throw new Error(
      "toggleMaImpersonation: resposta inválida da função ma-impersonation",
    );
  }

  // Usa o token_hash para criar a nova sessão via Magic Link
  // Isso altera a sessão atual do cliente supabase-js.
  const { data: verifyData, error: verifyError } =
    await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: edgeResponse.token_hash,
    });

  if (verifyError) {
    console.error(
      "toggleMaImpersonation: erro ao aplicar token_hash via verifyOtp",
      verifyError,
    );
    throw verifyError;
  }

  // verifyOtp já atualiza a sessão interna do supabase-js (auth user),
  // então o resto da aplicação passa a "ver" o user correto automaticamente.
  return {
    mode: edgeResponse.mode,
    sessionLog: edgeResponse.session_log,
  };
}

/*
-- ===================================================
-- Código             : /src/services/ai/geminiChatService.ts
-- Versão (.v20)      : 1.1.0
-- Data/Hora          : 2025-12-02 19:55
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Adapter de compatibilidade para chamadas de IA no front,
--                      expondo a função generateGeminiContent() usada por
--                      actionsAiService.ts e delegando a execução para o
--                      serviço real /src/services/geminiModelsService.ts.
-- Fluxo              : UI/Services → actionsAiService.generateGeminiContent()
--                      → geminiChatService.generateGeminiContent()
--                      → geminiModelsService.generateGeminiContent()
-- Alterações (1.0.0) :
--   • Criação do adapter geminiChatService.ts para unificar chamadas de IA.
-- Alterações (1.1.0) :
--   • Ajuste para delegar explicitamente para generateGeminiContent() recém
--     criado em geminiModelsService.ts, eliminando a necessidade de introspecção.
-- Dependências        : /src/services/geminiModelsService.ts
-- ===================================================
*/

import {
  generateGeminiContent as baseGenerateGeminiContent,
  type GeminiGenerateParams,
} from "@/services/geminiModelsService";

export interface GeminiChatParams extends GeminiGenerateParams {
  // Mantém compatibilidade com chamadas existentes do front.
}

/**
 * Função de alto nível usada pelo restante do front.
 * Mantém a assinatura simples e delega para a implementação real
 * configurada em geminiModelsService.ts.
 */
export async function generateGeminiContent(
  request: GeminiChatParams
): Promise<string> {
  return baseGenerateGeminiContent(request);
}

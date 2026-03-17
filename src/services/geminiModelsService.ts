/*
-- ===================================================
-- Código             : /src/services/geminiModelsService.ts
-- Versão (.v20)      : 0.2.1
-- Data/Hora          : 2025-12-02 20:20
-- Autor              : FL / Execução via você EVA
-- Objetivo do código : 
--   • Listar modelos disponíveis no Gemini usando a API oficial.
--   • Fornecer função de geração de texto (generateGeminiContent) para uso
--     pelos serviços de IA do front (ex.: actionsAiService).
-- Fluxo              : 
--   listGeminiModels:
--     getDefaultIntegrationKey("gemini") -> chamada HTTP -> lista de modelos
--   generateGeminiContent:
--     getDefaultIntegrationKey("gemini") -> POST /models/{model}:generateContent
--     -> retorna texto gerado (primeiro candidato).
-- Alterações (0.1.0) :
--   • [NOVO] Função listGeminiModels() com mapeamento de campos principais.
-- Alterações (0.2.0) :
--   • [NOVO] Tipo GeminiGenerateParams.
--   • [NOVO] Função generateGeminiContent() para geração de texto via Gemini.
-- Alterações (0.2.1) :
--   • [IA] Aumentado maxOutputTokens padrão de 512 para 2048 para evitar
--     finishReason=MAX_TOKENS em respostas longas com JSON estruturado.
-- Dependências       : fetch (browser), @/services/integrationKeysService
-- Observações        :
--   • MVP chamando a API diretamente do front, usando a API key do tenant.
--   • Recomenda-se futuramente mover para Edge Function/Backend para maior segurança.
-- ===================================================
*/

import { getDefaultIntegrationKey } from "@/services/integrationKeysService";

export type GeminiModel = {
  name: string;
  displayName: string;
  description: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods: string[];
};

const GEMINI_MODELS_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1/models";

export type GeminiGenerateParams = {
  /** Prompt principal (usuário) */
  prompt: string;
  /** Instruções de sistema (serão concatenadas com o prompt) */
  system?: string;
  /** Temperatura de amostragem (0–1) */
  temperature?: number;
  /** Limite máximo de tokens de saída (se suportado pelo modelo) */
  maxOutputTokens?: number;
  /** ID do modelo Gemini (ex.: "gemini-1.5-flash") */
  modelId?: string;
  /** Alias alternativo para o modelo (se vier de outros serviços) */
  model?: string;
};

/**
 * Lista modelos disponíveis no Gemini usando a chave default
 * configurada em integration_keys para o provider "gemini".
 */
export async function listGeminiModels(): Promise<GeminiModel[]> {
  const key = await getDefaultIntegrationKey("gemini");

  if (!key) {
    throw new Error(
      "Nenhuma chave default do provider 'gemini' foi configurada."
    );
  }

  const url = `${GEMINI_MODELS_ENDPOINT}?key=${encodeURIComponent(key.apiKey)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Falha ao consultar modelos do Gemini (HTTP ${res.status}).`
    );
  }

  const json: any = await res.json();
  const models = Array.isArray(json.models) ? json.models : [];

  return models.map((m: any) => ({
    name: String(m.name ?? ""),
    displayName: String(m.displayName ?? m.name ?? ""),
    description: String(m.description ?? ""),
    inputTokenLimit: m.inputTokenLimit,
    outputTokenLimit: m.outputTokenLimit,
    supportedGenerationMethods: Array.isArray(m.supportedGenerationMethods)
      ? m.supportedGenerationMethods.map((x: any) => String(x))
      : [],
  }));
}

/**
 * Gera texto usando o modelo Gemini configurado para o tenant.
 * Retorna sempre o texto da 1ª alternativa (candidate[0]).
 */
export async function generateGeminiContent(
  params: GeminiGenerateParams
): Promise<string> {
  const {
    prompt,
    system,
    temperature = 0.4,
    maxOutputTokens = 16000, // ← AQUI: aumentado para 2048
    modelId,
    model,
  } = params;

  if (!prompt || !prompt.trim()) {
    throw new Error("Prompt vazio ao chamar generateGeminiContent().");
  }

  const key = await getDefaultIntegrationKey("gemini");
  if (!key) {
    throw new Error(
      "Nenhuma chave default do provider 'gemini' foi configurada."
    );
  }

  const effectiveModelId = modelId || model || "gemini-2.5-flash";
  const url = `${GEMINI_MODELS_ENDPOINT}/${encodeURIComponent(
    effectiveModelId
  )}:generateContent?key=${encodeURIComponent(key.apiKey)}`;

  // Estratégia simples: concatenar system + prompt em um único conteúdo.
  const fullText = system
    ? `${system.trim()}\n\n${prompt.trim()}`
    : prompt.trim();

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: fullText }],
      },
    ],
    generationConfig: {
      temperature,
      maxOutputTokens,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(
      `Falha ao gerar conteúdo no Gemini (HTTP ${res.status}): ${errorText}`
    );
  }

  const json: any = await res.json();

  const candidates = Array.isArray(json.candidates) ? json.candidates : [];
  if (!candidates.length) {
    throw new Error("Resposta do Gemini sem candidatos de saída.");
  }

  const first = candidates[0];
  const parts = first?.content?.parts ?? [];
  const texts = parts
    .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
    .filter((t: string) => t.length > 0);

  if (!texts.length) {
    console.error(
      "generateGeminiContent: candidates sem texto (parts sem .text). Resposta bruta do Gemini:",
      json
    );
    throw new Error("Resposta do Gemini sem texto nos candidates.");
  }

  return texts.join("\n\n").trim();
}

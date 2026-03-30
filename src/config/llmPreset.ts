/*
-- ===================================================
-- Código  : /src/config/llmPreset.ts
-- Versão  : 1.0.0
-- Autor   : FL / Claude
-- Objetivo: Preset padrão de parâmetros LLM (Gemini).
--           Usado por geminiModelsService e useLLMPreset.
-- ===================================================
*/

export type LLMPreset = {
  temperature: number;
  top_p: number;
  max_tokens: number;
  /** OpenAI-only — armazenado mas não enviado ao Gemini */
  frequency_penalty: number;
  /** OpenAI-only — armazenado mas não enviado ao Gemini */
  presence_penalty: number;
};

export const LLM_DEFAULT_PRESET: LLMPreset = {
  temperature: 0.7,
  top_p: 0.9,
  max_tokens: 8000,
  frequency_penalty: 0.1,
  presence_penalty: 0.1,
};

export const LLM_MODEL = 'gemini-2.5-flash';
export const LLM_MODEL_DISPLAY_NAME = 'Gemini 2.5 Flash';

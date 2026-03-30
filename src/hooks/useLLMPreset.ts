/*
-- ===================================================
-- Código  : /src/hooks/useLLMPreset.ts
-- Versão  : 1.0.0
-- Autor   : FL / Claude
-- Objetivo: Persistência do preset LLM em localStorage.
-- ===================================================
*/

import { useState } from 'react';
import { LLM_DEFAULT_PRESET, LLMPreset } from '@/config/llmPreset';

const STORAGE_KEY = 'crmappy.llm.preset';

function readFromStorage(): LLMPreset {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as LLMPreset) : LLM_DEFAULT_PRESET;
  } catch {
    return LLM_DEFAULT_PRESET;
  }
}

export function useLLMPreset() {
  const [preset, setPreset] = useState<LLMPreset>(readFromStorage);

  const savePreset = (newPreset: LLMPreset) => {
    setPreset(newPreset);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreset));
    } catch {
      // storage bloqueado — ignora silenciosamente
    }
  };

  const resetToFactory = () => {
    savePreset(LLM_DEFAULT_PRESET);
  };

  const isCustom =
    JSON.stringify(preset) !== JSON.stringify(LLM_DEFAULT_PRESET);

  return { preset, savePreset, resetToFactory, isCustom };
}

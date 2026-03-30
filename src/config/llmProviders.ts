/*
-- ===================================================
-- Código  : /src/config/llmProviders.ts
-- Versão  : 1.0.0
-- Autor   : FL / Claude
-- Objetivo: Catálogo estático de providers e modelos LLM.
-- ===================================================
*/

export type ModelTier = 'free' | 'free-limited' | 'paid' | 'low-cost' | 'experimental';

export interface LLMModel {
  id: string;
  name: string;
  tier: ModelTier;
  isDefault?: boolean;
}

export interface LLMProvider {
  id: string;
  name: string;
  icon: string;
  models: LLMModel[];
}

export const LLM_PROVIDERS: LLMProvider[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tier: 'free', isDefault: true },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', tier: 'free' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', tier: 'free' },
      { id: 'gemini-1.5-pro',   name: 'Gemini 1.5 Pro',   tier: 'free-limited' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI ChatGPT',
    icon: '',
    models: [
      { id: 'gpt-4o',       name: 'GPT-4o',       tier: 'paid', isDefault: true },
      { id: 'gpt-4-turbo',  name: 'GPT-4 Turbo',  tier: 'paid' },
      { id: 'gpt-4o-mini',  name: 'GPT-4o Mini',  tier: 'low-cost' },
    ],
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    icon: '',
    models: [
      { id: 'claude-sonnet-4-6',          name: 'Claude Sonnet 4.6', tier: 'paid', isDefault: true },
      { id: 'claude-3-5-sonnet-20241022',  name: 'Claude 3.5 Sonnet', tier: 'paid' },
      { id: 'claude-haiku-4-5-20251001',   name: 'Claude Haiku 4.5',  tier: 'paid' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: '',
    models: [
      { id: 'deepseek-chat',     name: 'DeepSeek Chat V3',     tier: 'low-cost', isDefault: true },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1 Reasoner', tier: 'low-cost' },
    ],
  },
  {
    id: 'qwen',
    name: 'Qwen',
    icon: '',
    models: [
      { id: 'qwen-2.5-72b', name: 'Qwen 2.5 (72B)', tier: 'free', isDefault: true },
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    icon: '',
    models: [
      { id: 'mistral-large', name: 'Mistral Large', tier: 'free-limited', isDefault: true },
    ],
  },
];

export function getProviderById(providerId: string): LLMProvider | undefined {
  return LLM_PROVIDERS.find(p => p.id === providerId);
}

export function getModelById(providerId: string, modelId: string): LLMModel | undefined {
  return getProviderById(providerId)?.models.find(m => m.id === modelId);
}

export function tierLabel(tier: ModelTier): string {
  const map: Record<ModelTier, string> = {
    free:          '[GRATUITO]',
    'free-limited':'[LIMITADO]',
    paid:          '[PAGO]',
    'low-cost':    '[ECONÔMICO]',
    experimental:  '[EXPERIMENTAL]',
  };
  return map[tier] ?? '';
}

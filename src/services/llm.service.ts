import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LLMProvider = 'claude' | 'chatgpt' | 'gemini' | 'deepseek'

export interface LLMConfig {
  id: string
  provider: LLMProvider
  display_name: string | null
  model: string | null
  is_default: boolean
  active: boolean
  has_key: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── Provider defaults ────────────────────────────────────────────────────────

export const PROVIDER_META: Record<LLMProvider, { label: string; model: string; placeholder: string }> = {
  claude:   { label: 'Claude',    model: 'claude-sonnet-4-20250514', placeholder: 'sk-ant-...' },
  chatgpt:  { label: 'ChatGPT',   model: 'gpt-4o',                  placeholder: 'sk-...' },
  gemini:   { label: 'Gemini',    model: 'gemini-2.0-flash',         placeholder: 'AIza...' },
  deepseek: { label: 'DeepSeek',  model: 'deepseek-chat',            placeholder: 'sk-...' },
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Usuário não autenticado.')
  return data.user.id
}

// ─── Config CRUD ──────────────────────────────────────────────────────────────

export async function getConfiguredProviders(): Promise<LLMConfig[]> {
  const { data, error } = await supabase
    .from('user_llm_configs')
    .select('id, provider, display_name, model, is_default, active, api_key')
    .eq('active', true)
    .order('provider')

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id:           row.id,
    provider:     row.provider as LLMProvider,
    display_name: row.display_name,
    model:        row.model,
    is_default:   row.is_default,
    active:       row.active,
    has_key:      Boolean(row.api_key),
  }))
}

/** Returns the stored plaintext API key for a provider (in-session use only). */
export async function getProviderApiKey(provider: LLMProvider): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_llm_configs')
    .select('api_key')
    .eq('provider', provider)
    .eq('active', true)
    .single()

  if (error) return null
  return data?.api_key ?? null
}

/** Upserts a provider config (by user_id + provider). Returns the config id. */
export async function saveProviderConfig(
  provider: LLMProvider,
  apiKey: string,
  model?: string,
): Promise<string> {
  const user_id = await getCurrentUserId()
  const resolvedModel = model ?? PROVIDER_META[provider].model

  const { data, error } = await supabase
    .from('user_llm_configs')
    .upsert(
      {
        user_id,
        provider,
        api_key:      apiKey,
        model:        resolvedModel,
        display_name: PROVIDER_META[provider].label,
        active:       true,
      },
      { onConflict: 'user_id,provider' },
    )
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id
}

export async function setDefaultProvider(configId: string): Promise<void> {
  // The DB trigger enforce_single_default_llm handles clearing other defaults
  const { error } = await supabase
    .from('user_llm_configs')
    .update({ is_default: true })
    .eq('id', configId)

  if (error) throw new Error(error.message)
}

// ─── Test connection ──────────────────────────────────────────────────────────

export async function testConnection(provider: LLMProvider, apiKey: string): Promise<boolean> {
  try {
    await callLLM(provider, apiKey, [{ role: 'user', content: 'Olá' }], 'Responda apenas "OK".')
    return true
  } catch {
    return false
  }
}

// ─── Core LLM caller ─────────────────────────────────────────────────────────

export async function callLLM(
  provider: LLMProvider,
  apiKey: string,
  messages: ChatMessage[],
  systemPrompt?: string,
): Promise<string> {
  switch (provider) {
    case 'claude':   return callClaude(apiKey, messages, systemPrompt)
    case 'chatgpt':  return callOpenAICompatible('https://api.openai.com/v1/chat/completions',   'gpt-4o',         apiKey, messages, systemPrompt)
    case 'deepseek': return callOpenAICompatible('https://api.deepseek.com/v1/chat/completions', 'deepseek-chat',  apiKey, messages, systemPrompt)
    case 'gemini':   return callGemini(apiKey, messages, systemPrompt)
  }
}

// ─── Provider implementations ─────────────────────────────────────────────────

async function callClaude(
  apiKey: string,
  messages: ChatMessage[],
  systemPrompt?: string,
): Promise<string> {
  const body: Record<string, unknown> = {
    model:      'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages,
  }
  if (systemPrompt) body.system = systemPrompt

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const errData = err as Record<string, Record<string, string>>
    throw new Error(`Claude: ${res.status} ${errData?.error?.message ?? res.statusText}`)
  }

  const data = await res.json()
  return data.content?.[0]?.text ?? ''
}

async function callOpenAICompatible(
  url: string,
  model: string,
  apiKey: string,
  messages: ChatMessage[],
  systemPrompt?: string,
): Promise<string> {
  const fullMessages = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages: fullMessages }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`${model}: ${res.status} ${(err as Record<string, Record<string,string>>)?.error?.message ?? res.statusText}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

async function callGemini(
  apiKey: string,
  messages: ChatMessage[],
  systemPrompt?: string,
): Promise<string> {
  const model = 'gemini-2.0-flash'
  const url   = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const contents = messages.map((m) => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const body: Record<string, unknown> = { contents }
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Gemini: ${res.status} ${JSON.stringify((err as Record<string,unknown>)?.error ?? res.statusText)}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

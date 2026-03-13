import { supabase } from '@/lib/supabase'
import type { LLMProvider } from './llm.service'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PeriodTransaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'debit' | 'credit'
  category_id: string | null
  category_name: string | null
  source: 'bank' | 'card'
}

export interface AnalysisAlert {
  category: string
  amount: number
  message: string
}

export interface AnalysisSuggestion {
  title: string
  description: string
  savings: number
  difficulty: 'Fácil' | 'Média' | 'Difícil'
}

export interface AnalysisRecord {
  id: string
  period_from: string
  period_to: string
  source_type: string | null
  transaction_count: number | null
  total_amount: number | null
  prompt_text: string | null
  analysis_summary: string | null
  alerts: AnalysisAlert[] | null
  suggestions: AnalysisSuggestion[] | null
  status: string
  error_message: string | null
  created_at: string
  completed_at: string | null
  llm_config_id: string
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Usuário não autenticado.')
  return data.user.id
}

// ─── Fetch period transactions ────────────────────────────────────────────────

export async function fetchPeriodTransactions(
  periodStart: string,
  periodEnd: string,
): Promise<PeriodTransaction[]> {
  // Fetch categories for name lookup
  const { data: catData } = await supabase
    .from('categories')
    .select('id, name')
    .is('deleted_at', null)

  const catMap = new Map((catData ?? []).map((c) => [c.id as string, c.name as string]))

  const [{ data: bankData, error: e1 }, { data: cardData, error: e2 }] = await Promise.all([
    supabase
      .from('bank_transactions')
      .select('id, date, description, amount, type, category_id')
      .is('deleted_at', null)
      .eq('type', 'debit')
      .gte('date', periodStart)
      .lte('date', periodEnd)
      .order('date'),
    supabase
      .from('card_transactions')
      .select('id, date, description, amount, category_id')
      .is('deleted_at', null)
      .gte('date', periodStart)
      .lte('date', periodEnd)
      .order('date'),
  ])

  if (e1) throw new Error(e1.message)
  if (e2) throw new Error(e2.message)

  const bank: PeriodTransaction[] = (bankData ?? []).map((t) => ({
    id:            t.id,
    date:          t.date,
    description:   t.description,
    amount:        Number(t.amount),
    type:          'debit' as const,
    category_id:   t.category_id ?? null,
    category_name: t.category_id ? (catMap.get(t.category_id) ?? null) : null,
    source:        'bank' as const,
  }))

  const card: PeriodTransaction[] = (cardData ?? []).map((t) => ({
    id:            t.id,
    date:          t.date,
    description:   t.description,
    amount:        Number(t.amount),
    type:          'debit' as const,
    category_id:   t.category_id ?? null,
    category_name: t.category_id ? (catMap.get(t.category_id) ?? null) : null,
    source:        'card' as const,
  }))

  return [...bank, ...card].sort((a, b) => a.date.localeCompare(b.date))
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function buildAnalysisPrompt(
  transactions: PeriodTransaction[],
  periodStart: string,
  periodEnd: string,
): string {
  const total = transactions.reduce((s, t) => s + t.amount, 0)

  const byCategory: Record<string, number> = {}
  for (const t of transactions) {
    const key = t.category_name ?? 'Sem categoria'
    byCategory[key] = (byCategory[key] ?? 0) + t.amount
  }

  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat, val]) => `- ${cat}: ${brl.format(val)}`)
    .join('\n')

  const txnList = transactions
    .map((t) => `${t.date} | ${t.description} | ${brl.format(t.amount)} | ${t.category_name ?? 'Sem categoria'}`)
    .join('\n')

  return `Analise as finanças do período de ${periodStart} a ${periodEnd}:

RESUMO:
- Total de gastos: ${brl.format(total)}
- Número de transações: ${transactions.length}

CATEGORIAS COM MAIS GASTOS:
${topCategories}

LISTA COMPLETA DE TRANSAÇÕES:
Data | Descrição | Valor | Categoria
${txnList}

Gere uma análise financeira completa em português com:
1. RESUMO EXECUTIVO (3-4 linhas)
2. PADRÕES IDENTIFICADOS (gastos recorrentes, tendências)
3. ALERTAS (categorias com gastos elevados, anomalias)
4. RECOMENDAÇÕES (2-3 ações práticas)

Use markdown com títulos (##) e bullets. Seja direto e prático.`
}

export function buildSuggestionsPrompt(
  transactions: PeriodTransaction[],
  periodStart: string,
  periodEnd: string,
): string {
  const total = transactions.reduce((s, t) => s + t.amount, 0)

  const byCategory: Record<string, number> = {}
  for (const t of transactions) {
    const key = t.category_name ?? 'Sem categoria'
    byCategory[key] = (byCategory[key] ?? 0) + t.amount
  }

  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([cat, val]) => `- ${cat}: ${brl.format(val)}`)
    .join('\n')

  return `Com base nos gastos do período de ${periodStart} a ${periodEnd}:

TOTAL GASTO: ${brl.format(total)}

GASTOS POR CATEGORIA:
${topCategories}

Gere 5 a 8 sugestões práticas e personalizadas de economia.
Para cada sugestão, forneça:
- title: título curto e objetivo
- description: explicação prática em 2-3 linhas
- savings: economia potencial estimada em reais (número, sem R$)
- difficulty: exatamente uma das opções "Fácil", "Média" ou "Difícil"

Responda APENAS com JSON válido, sem markdown, sem explicações extras:
{"suggestions":[{"title":"","description":"","savings":0,"difficulty":"Fácil"}]}`
}

export function buildClassificationPrompt(
  transactions: PeriodTransaction[],
  categories: string[],
): string {
  const txnList = transactions
    .map((t) => `${t.id} | ${t.description} | ${brl.format(t.amount)} | ${t.source}`)
    .join('\n')

  return `Classifique cada transação abaixo em uma das categorias disponíveis:
${categories.join(', ')}

Transações (id | descrição | valor | origem):
${txnList}

Responda APENAS com JSON válido, sem markdown, sem explicações:
{"classifications":[{"id":"uuid","category":"nome da categoria","confidence":0.95}]}`
}

// ─── ai_analyses CRUD ─────────────────────────────────────────────────────────

export interface SaveAnalysisInput {
  llm_config_id: string
  source_type: string
  period_from: string
  period_to: string
  prompt_text: string
  transaction_count: number
  total_amount: number
}

export async function saveAnalysisPending(input: SaveAnalysisInput): Promise<string> {
  const user_id = await getCurrentUserId()

  const { data, error } = await supabase
    .from('ai_analyses')
    .insert({
      user_id,
      ...input,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id
}

export interface UpdateAnalysisInput {
  analysis_summary?: string | null
  alerts?: AnalysisAlert[] | null
  suggestions?: AnalysisSuggestion[] | null
  status: 'completed' | 'error'
  error_message?: string | null
}

export async function updateAnalysis(id: string, result: UpdateAnalysisInput): Promise<void> {
  const { error } = await supabase
    .from('ai_analyses')
    .update({
      ...result,
      completed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function fetchAnalysisHistory(limit = 20): Promise<AnalysisRecord[]> {
  const { data, error } = await supabase
    .from('ai_analyses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as AnalysisRecord[]
}

// ─── Summary helper ───────────────────────────────────────────────────────────

export function buildSummary(txns: PeriodTransaction[]): {
  total: number
  count: number
  byCategory: Record<string, number>
} {
  const byCategory: Record<string, number> = {}
  let total = 0
  for (const t of txns) {
    total += t.amount
    const key = t.category_name ?? 'Sem categoria'
    byCategory[key] = (byCategory[key] ?? 0) + t.amount
  }
  return { total, count: txns.length, byCategory }
}

// ─── LLM provider label ───────────────────────────────────────────────────────

export function providerFromConfigId(
  configId: string | null,
  configs: Array<{ id: string; provider: LLMProvider }>,
): LLMProvider | null {
  if (!configId) return null
  return configs.find((c) => c.id === configId)?.provider ?? null
}

import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryRule {
  id: string
  user_id: string | null
  category_id: string
  keyword: string
  match_type: 'exact' | 'starts_with' | 'word' | 'contains'
  priority: number
  active: boolean
}

export interface ClassificationResult {
  category_id: string | null
  confidence: number        // 0 to 1
  matched_keyword: string | null
  classified: boolean
}

export interface ClassificationSummary {
  total: number
  classified: number
  unclassified: number
  avgConfidence: number
}

// ─── Score map ────────────────────────────────────────────────────────────────

const MATCH_SCORE: Record<CategoryRule['match_type'], number> = {
  exact: 1.0,
  starts_with: 0.85,
  word: 0.75,
  contains: 0.60,
}

// ─── Built-in global rules ────────────────────────────────────────────────────
// Used as baseline when user has no matching rule.
// user_id = null marks these as system rules (lower priority than user rules).
// Category IDs are the real UUIDs from the categories table.

type BuiltinRule = Omit<CategoryRule, 'id' | 'active'> & { active: true }

const BUILTIN_RULES: BuiltinRule[] = [
  // Alimentação
  { user_id: null, category_id: 'd2be5fb6-8463-4934-b920-abf63091a22d', keyword: 'ifood',        match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'd2be5fb6-8463-4934-b920-abf63091a22d', keyword: 'lanchonete',   match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'd2be5fb6-8463-4934-b920-abf63091a22d', keyword: 'padaria',      match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'd2be5fb6-8463-4934-b920-abf63091a22d', keyword: 'panificadora', match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'd2be5fb6-8463-4934-b920-abf63091a22d', keyword: 'pastelaria',   match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'd2be5fb6-8463-4934-b920-abf63091a22d', keyword: 'acougue',      match_type: 'contains', priority: 1, active: true },
  // Restaurante
  { user_id: null, category_id: '044e3340-58c6-4e34-ada5-efac1ff8b096', keyword: 'restaurante',  match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '044e3340-58c6-4e34-ada5-efac1ff8b096', keyword: 'pizzaria',     match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '044e3340-58c6-4e34-ada5-efac1ff8b096', keyword: 'churrascaria', match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '044e3340-58c6-4e34-ada5-efac1ff8b096', keyword: 'hamburgueria', match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '044e3340-58c6-4e34-ada5-efac1ff8b096', keyword: 'outback',      match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '044e3340-58c6-4e34-ada5-efac1ff8b096', keyword: 'mcdonalds',    match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '044e3340-58c6-4e34-ada5-efac1ff8b096', keyword: 'mc donalds',   match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '044e3340-58c6-4e34-ada5-efac1ff8b096', keyword: 'burger king',  match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '044e3340-58c6-4e34-ada5-efac1ff8b096', keyword: 'bob\'s',       match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '044e3340-58c6-4e34-ada5-efac1ff8b096', keyword: 'giraffas',     match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '044e3340-58c6-4e34-ada5-efac1ff8b096', keyword: 'spoleto',      match_type: 'contains', priority: 1, active: true },
  // Supermercado — specific chains before generic "mercado" to win tiebreaks
  { user_id: null, category_id: '985de7e6-b623-4bcb-bbe3-3aa910b9cd8d', keyword: 'supermercado', match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '985de7e6-b623-4bcb-bbe3-3aa910b9cd8d', keyword: 'hortifruti',   match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '985de7e6-b623-4bcb-bbe3-3aa910b9cd8d', keyword: 'carrefour',    match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '985de7e6-b623-4bcb-bbe3-3aa910b9cd8d', keyword: 'atacadista',   match_type: 'contains', priority: 1, active: true },
  // "atacado" kept for backwards-compat but "atacadista" now catches Assaí etc.
  { user_id: null, category_id: '985de7e6-b623-4bcb-bbe3-3aa910b9cd8d', keyword: 'atacado',      match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '985de7e6-b623-4bcb-bbe3-3aa910b9cd8d', keyword: 'assai',        match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '985de7e6-b623-4bcb-bbe3-3aa910b9cd8d', keyword: 'extra',        match_type: 'word',     priority: 1, active: true },
  // "mercado" uses word match so it doesn't fire on "mercadolivre" / "mercadopago"
  { user_id: null, category_id: '985de7e6-b623-4bcb-bbe3-3aa910b9cd8d', keyword: 'mercado',      match_type: 'word',     priority: 1, active: true },
  // Combustível
  { user_id: null, category_id: '11bd5484-48b9-4a6e-9ba5-78d6f671553b', keyword: 'gasolina',     match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '11bd5484-48b9-4a6e-9ba5-78d6f671553b', keyword: 'etanol',       match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '11bd5484-48b9-4a6e-9ba5-78d6f671553b', keyword: 'abastecimento',match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '11bd5484-48b9-4a6e-9ba5-78d6f671553b', keyword: 'diesel',       match_type: 'contains', priority: 1, active: true },
  // "posto" uses word match to avoid e.g. "posto de saude"
  { user_id: null, category_id: '11bd5484-48b9-4a6e-9ba5-78d6f671553b', keyword: 'posto',        match_type: 'word',     priority: 1, active: true },
  // Transporte
  { user_id: null, category_id: '5d20cc59-38fc-4413-b22c-ed9eadd14d81', keyword: 'uber',         match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '5d20cc59-38fc-4413-b22c-ed9eadd14d81', keyword: '99app',        match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '5d20cc59-38fc-4413-b22c-ed9eadd14d81', keyword: 'cabify',       match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '5d20cc59-38fc-4413-b22c-ed9eadd14d81', keyword: 'estacionamento',match_type:'contains', priority: 1, active: true },
  { user_id: null, category_id: '5d20cc59-38fc-4413-b22c-ed9eadd14d81', keyword: 'pedagio',      match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '5d20cc59-38fc-4413-b22c-ed9eadd14d81', keyword: 'metro',        match_type: 'contains', priority: 1, active: true },
  // Farmácia
  { user_id: null, category_id: '923c45c4-8283-45fd-9248-8e1b7b3435fe', keyword: 'farmacia',     match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '923c45c4-8283-45fd-9248-8e1b7b3435fe', keyword: 'drogasil',     match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '923c45c4-8283-45fd-9248-8e1b7b3435fe', keyword: 'drogaria',     match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '923c45c4-8283-45fd-9248-8e1b7b3435fe', keyword: 'droga raia',   match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '923c45c4-8283-45fd-9248-8e1b7b3435fe', keyword: 'ultrafarma',   match_type: 'contains', priority: 1, active: true },
  // Saúde
  { user_id: null, category_id: '3a149071-89f4-4720-a49c-6f697015fbe9', keyword: 'medico',       match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '3a149071-89f4-4720-a49c-6f697015fbe9', keyword: 'hospital',     match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '3a149071-89f4-4720-a49c-6f697015fbe9', keyword: 'clinica',      match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '3a149071-89f4-4720-a49c-6f697015fbe9', keyword: 'laboratorio',  match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '3a149071-89f4-4720-a49c-6f697015fbe9', keyword: 'plano de saude',match_type:'contains', priority: 1, active: true },
  // Educação
  { user_id: null, category_id: 'd68b3153-c7d2-4bc0-850f-3d5275f9f249', keyword: 'escola',       match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'd68b3153-c7d2-4bc0-850f-3d5275f9f249', keyword: 'faculdade',    match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'd68b3153-c7d2-4bc0-850f-3d5275f9f249', keyword: 'mensalidade',  match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'd68b3153-c7d2-4bc0-850f-3d5275f9f249', keyword: 'alura',        match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'd68b3153-c7d2-4bc0-850f-3d5275f9f249', keyword: 'udemy',        match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'd68b3153-c7d2-4bc0-850f-3d5275f9f249', keyword: 'coursera',     match_type: 'contains', priority: 1, active: true },
  // Lazer
  { user_id: null, category_id: 'eecc49fb-e16b-4448-903a-1eda5ac31ac5', keyword: 'netflix',      match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'eecc49fb-e16b-4448-903a-1eda5ac31ac5', keyword: 'spotify',      match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'eecc49fb-e16b-4448-903a-1eda5ac31ac5', keyword: 'cinema',       match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'eecc49fb-e16b-4448-903a-1eda5ac31ac5', keyword: 'teatro',       match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'eecc49fb-e16b-4448-903a-1eda5ac31ac5', keyword: 'disney',       match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'eecc49fb-e16b-4448-903a-1eda5ac31ac5', keyword: 'amazon prime', match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'eecc49fb-e16b-4448-903a-1eda5ac31ac5', keyword: 'hbo max',      match_type: 'contains', priority: 1, active: true },
  // Moradia
  { user_id: null, category_id: '0a6f0590-0084-4afd-a73b-fa88939c67e1', keyword: 'aluguel',      match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '0a6f0590-0084-4afd-a73b-fa88939c67e1', keyword: 'condominio',   match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '0a6f0590-0084-4afd-a73b-fa88939c67e1', keyword: 'energia eletrica',match_type:'contains',priority: 1, active: true },
  { user_id: null, category_id: '0a6f0590-0084-4afd-a73b-fa88939c67e1', keyword: 'agua e esgoto',match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '0a6f0590-0084-4afd-a73b-fa88939c67e1', keyword: 'internet',     match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '0a6f0590-0084-4afd-a73b-fa88939c67e1', keyword: 'gas encanado', match_type: 'contains', priority: 1, active: true },
  // Financeiro
  { user_id: null, category_id: '625030a7-ed49-42d4-94eb-2ee61b1a9d28', keyword: 'iof',          match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '625030a7-ed49-42d4-94eb-2ee61b1a9d28', keyword: 'juros',        match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '625030a7-ed49-42d4-94eb-2ee61b1a9d28', keyword: 'tarifa',       match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '625030a7-ed49-42d4-94eb-2ee61b1a9d28', keyword: 'seguro',       match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '625030a7-ed49-42d4-94eb-2ee61b1a9d28', keyword: 'imposto',      match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '625030a7-ed49-42d4-94eb-2ee61b1a9d28', keyword: 'multa',        match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '625030a7-ed49-42d4-94eb-2ee61b1a9d28', keyword: 'anuidade',     match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '625030a7-ed49-42d4-94eb-2ee61b1a9d28', keyword: 'inss',         match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '625030a7-ed49-42d4-94eb-2ee61b1a9d28', keyword: 'das mei',      match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '625030a7-ed49-42d4-94eb-2ee61b1a9d28', keyword: 'mercadopago',  match_type: 'contains', priority: 1, active: true },
  // Serviços digitais
  { user_id: null, category_id: 'c7ed306c-566a-417e-a765-ae27a9b1b8d3', keyword: 'mercadolivre', match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'c7ed306c-566a-417e-a765-ae27a9b1b8d3', keyword: 'google',       match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'c7ed306c-566a-417e-a765-ae27a9b1b8d3', keyword: 'microsoft',    match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'c7ed306c-566a-417e-a765-ae27a9b1b8d3', keyword: 'apple',        match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'c7ed306c-566a-417e-a765-ae27a9b1b8d3', keyword: 'chatgpt',      match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'c7ed306c-566a-417e-a765-ae27a9b1b8d3', keyword: 'openai',       match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'c7ed306c-566a-417e-a765-ae27a9b1b8d3', keyword: 'amazon',       match_type: 'contains', priority: 1, active: true },
  // Telecom — word match to avoid false positives on common words
  { user_id: null, category_id: 'c7ed306c-566a-417e-a765-ae27a9b1b8d3', keyword: 'claro',        match_type: 'word',     priority: 1, active: true },
  { user_id: null, category_id: 'c7ed306c-566a-417e-a765-ae27a9b1b8d3', keyword: 'vivo',         match_type: 'word',     priority: 1, active: true },
  { user_id: null, category_id: 'c7ed306c-566a-417e-a765-ae27a9b1b8d3', keyword: 'tim',          match_type: 'word',     priority: 1, active: true },
  { user_id: null, category_id: 'c7ed306c-566a-417e-a765-ae27a9b1b8d3', keyword: 'oi ',          match_type: 'starts_with', priority: 1, active: true },
  // Vestuário
  { user_id: null, category_id: 'c9dfeb22-1ec4-4a26-9e36-92a36436af54', keyword: 'renner',       match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'c9dfeb22-1ec4-4a26-9e36-92a36436af54', keyword: 'zara',         match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'c9dfeb22-1ec4-4a26-9e36-92a36436af54', keyword: 'riachuelo',    match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: 'c9dfeb22-1ec4-4a26-9e36-92a36436af54', keyword: 'hering',       match_type: 'contains', priority: 1, active: true },
  // Viagem
  { user_id: null, category_id: '5fd83b64-0a82-43d6-bdea-d06139674fe6', keyword: 'hotel',        match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '5fd83b64-0a82-43d6-bdea-d06139674fe6', keyword: 'pousada',      match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '5fd83b64-0a82-43d6-bdea-d06139674fe6', keyword: 'airbnb',       match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '5fd83b64-0a82-43d6-bdea-d06139674fe6', keyword: 'latam',        match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '5fd83b64-0a82-43d6-bdea-d06139674fe6', keyword: 'gol linhas',   match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '5fd83b64-0a82-43d6-bdea-d06139674fe6', keyword: 'azul linhas',  match_type: 'contains', priority: 1, active: true },
  { user_id: null, category_id: '5fd83b64-0a82-43d6-bdea-d06139674fe6', keyword: 'passagem aerea',match_type:'contains', priority: 1, active: true },
] as const

// ─── Core classifier ──────────────────────────────────────────────────────────

export function classifyTransaction(
  description: string,
  rules: CategoryRule[],
): ClassificationResult {
  const desc = description.toLowerCase().trim()

  // Merge user rules (higher tiebreak) with built-in rules (lower tiebreak)
  const allRules: Array<CategoryRule | BuiltinRule> = [...rules, ...BUILTIN_RULES]

  let bestScore = -1
  let bestRule: CategoryRule | BuiltinRule | null = null

  for (const rule of allRules) {
    if (!rule.active) continue

    const kw = rule.keyword.toLowerCase().trim()
    let matches = false

    switch (rule.match_type) {
      case 'exact':
        matches = desc === kw
        break
      case 'starts_with':
        matches = desc.startsWith(kw)
        break
      case 'word': {
        const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        matches = new RegExp(`(?<![\\wÀ-ÿ])${escaped}(?![\\wÀ-ÿ])`, 'i').test(desc)
        break
      }
      case 'contains':
      default:
        matches = desc.includes(kw)
        break
    }

    if (!matches) continue

    const score = MATCH_SCORE[rule.match_type] ?? 0.60

    // Tiebreak: score → priority → user rule beats built-in
    const beats =
      score > bestScore ||
      (score === bestScore && rule.priority > (bestRule?.priority ?? 0)) ||
      (score === bestScore &&
        rule.priority === bestRule?.priority &&
        rule.user_id !== null &&
        bestRule?.user_id === null)

    if (beats) {
      bestScore = score
      bestRule = rule
    }
  }

  if (!bestRule) {
    return { category_id: null, confidence: 0, matched_keyword: null, classified: false }
  }

  return {
    category_id: bestRule.category_id,
    confidence: bestScore,
    matched_keyword: bestRule.keyword,
    classified: true,
  }
}

// ─── Fetch user rules from DB ─────────────────────────────────────────────────

async function fetchUserRules(userId: string): Promise<CategoryRule[]> {
  // Fetch user-specific rules AND system rules (user_id = NULL)
  // User-specific rules beat system rules via tiebreak in classifyTransaction()
  const { data, error } = await supabase
    .from('category_rules')
    .select('*')
    .eq('active', true)
    .or(`user_id.is.null,user_id.eq.${userId}`)

  if (error) throw new Error(error.message)
  return (data ?? []) as CategoryRule[]
}

// ─── Batch update helper ──────────────────────────────────────────────────────

async function applyClassifications(
  table: 'bank_transactions' | 'card_transactions',
  updates: Array<{ id: string; category_id: string }>,
): Promise<void> {
  if (updates.length === 0) return

  const CHUNK = 50
  for (let i = 0; i < updates.length; i += CHUNK) {
    const batch = updates.slice(i, i + CHUNK)
    await Promise.all(
      batch.map(({ id, category_id }) =>
        supabase
          .from(table)
          .update({ category_id, auto_classified: true })
          .eq('id', id),
      ),
    )
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function classifyAndSaveTransactions(
  transactions: Array<{ id: string; description: string }>,
  table: 'bank_transactions' | 'card_transactions',
  userId: string,
): Promise<ClassificationSummary> {
  if (transactions.length === 0) {
    return { total: 0, classified: 0, unclassified: 0, avgConfidence: 0 }
  }

  const userRules = await fetchUserRules(userId)

  const results = transactions.map((t) => ({
    id: t.id,
    result: classifyTransaction(t.description, userRules),
  }))

  const classifiedResults = results.filter((r) => r.result.classified)
  const updates = classifiedResults.map((r) => ({
    id: r.id,
    category_id: r.result.category_id!,
  }))

  await applyClassifications(table, updates)

  const avgConfidence =
    classifiedResults.length > 0
      ? classifiedResults.reduce((sum, r) => sum + r.result.confidence, 0) / classifiedResults.length
      : 0

  return {
    total: transactions.length,
    classified: classifiedResults.length,
    unclassified: transactions.length - classifiedResults.length,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
  }
}

import { supabase } from '@/lib/supabase'
import { classifyAndSaveTransactions, type ClassificationSummary } from './classification.service'

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Usuário não autenticado.')
  return data.user.id
}

export interface UnifiedTransaction {
  id: string
  source: 'bank' | 'card'
  date: string
  description: string
  amount: number
  type: string | null           // bank: 'debit'|'credit'; card: always null
  origin_name: string
  category_id: string | null
  category_name: string | null
  category_icon: string | null
  category_color: string | null
  auto_classified: boolean
  notes: string | null
  reference_month: string | null  // YYYY-MM-01
}

export interface TransactionFilters {
  year: number
  month: number                 // 1–12
  source: 'all' | 'bank' | 'card'
  classified: 'all' | 'classified' | 'unclassified'
  referenceMonth: string | null // YYYY-MM-01 or null for all
}

export interface TransactionUpdate {
  description: string
  date: string
  amount: number
  type: string | null
  category_id: string | null
  notes: string | null
  reference_month: string | null  // YYYY-MM-01
}

export interface PaginatedResult {
  data: UnifiedTransaction[]
  total: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = new Date(year, month, 0).toISOString().split('T')[0]
  return { start, end }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBankRow(row: any): UnifiedTransaction {
  return {
    id: row.id,
    source: 'bank',
    date: row.date,
    description: row.description,
    amount: row.amount,
    type: row.type ?? null,
    origin_name: row.banks?.name ?? '—',
    category_id: row.category_id ?? null,
    category_name: row.categories?.name ?? null,
    category_icon: row.categories?.icon ?? null,
    category_color: row.categories?.color ?? null,
    auto_classified: row.auto_classified ?? false,
    notes: row.notes ?? null,
    reference_month: row.reference_month ?? null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeCardRow(row: any): UnifiedTransaction {
  return {
    id: row.id,
    source: 'card',
    date: row.date,
    description: row.description,
    amount: row.amount,
    type: null,
    origin_name: row.credit_cards?.name ?? '—',
    category_id: row.category_id ?? null,
    category_name: row.categories?.name ?? null,
    category_icon: row.categories?.icon ?? null,
    category_color: row.categories?.color ?? null,
    auto_classified: row.auto_classified ?? false,
    notes: row.notes ?? null,
    reference_month: row.reference_month ?? null,
  }
}

// ─── Count helpers ────────────────────────────────────────────────────────────

async function countBank(
  user_id: string,
  start: string,
  end: string,
  classified: TransactionFilters['classified'],
  referenceMonth: string | null,
): Promise<number> {
  let q = supabase
    .from('bank_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user_id)
    .is('deleted_at', null)
    .gte('date', start)
    .lte('date', end)
  if (classified === 'classified') q = q.not('category_id', 'is', null)
  if (classified === 'unclassified') q = q.is('category_id', null)
  if (referenceMonth) q = q.eq('reference_month', referenceMonth)
  const { count, error } = await q
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function countCard(
  user_id: string,
  start: string,
  end: string,
  classified: TransactionFilters['classified'],
  referenceMonth: string | null,
): Promise<number> {
  let q = supabase
    .from('card_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user_id)
    .is('deleted_at', null)
    .gte('date', start)
    .lte('date', end)
  if (classified === 'classified') q = q.not('category_id', 'is', null)
  if (classified === 'unclassified') q = q.is('category_id', null)
  if (referenceMonth) q = q.eq('reference_month', referenceMonth)
  const { count, error } = await q
  if (error) throw new Error(error.message)
  return count ?? 0
}

// ─── Data fetch helpers ───────────────────────────────────────────────────────

async function fetchBankPage(
  user_id: string,
  start: string,
  end: string,
  classified: TransactionFilters['classified'],
  referenceMonth: string | null,
  rangeFrom: number,
  rangeTo: number,
): Promise<UnifiedTransaction[]> {
  let q = supabase
    .from('bank_transactions')
    .select(`
      id, date, description, amount, type, notes, category_id, auto_classified, reference_month,
      banks!bank_id(name),
      categories!category_id(name, icon, color)
    `)
    .eq('user_id', user_id)
    .is('deleted_at', null)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (classified === 'classified') q = q.not('category_id', 'is', null)
  if (classified === 'unclassified') q = q.is('category_id', null)
  if (referenceMonth) q = q.eq('reference_month', referenceMonth)
  q = q.range(rangeFrom, rangeTo)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as any[]) ?? []).map(normalizeBankRow)
}

async function fetchCardPage(
  user_id: string,
  start: string,
  end: string,
  classified: TransactionFilters['classified'],
  referenceMonth: string | null,
  rangeFrom: number,
  rangeTo: number,
): Promise<UnifiedTransaction[]> {
  let q = supabase
    .from('card_transactions')
    .select(`
      id, date, description, amount, notes, category_id, auto_classified, reference_month,
      credit_cards!card_id(name),
      categories!category_id(name, icon, color)
    `)
    .eq('user_id', user_id)
    .is('deleted_at', null)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
  if (classified === 'classified') q = q.not('category_id', 'is', null)
  if (classified === 'unclassified') q = q.is('category_id', null)
  if (referenceMonth) q = q.eq('reference_month', referenceMonth)
  q = q.range(rangeFrom, rangeTo)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data as any[]) ?? []).map(normalizeCardRow)
}

// ─── Fetch (paginated) ────────────────────────────────────────────────────────

export async function fetchTransactions(
  filters: TransactionFilters,
  page: number,       // 1-indexed
  pageSize: number,
): Promise<PaginatedResult> {
  const user_id = await getCurrentUserId()
  const { start, end } = monthRange(filters.year, filters.month)
  const rangeFrom = (page - 1) * pageSize
  const rangeTo = page * pageSize - 1

  const rm = filters.referenceMonth ?? null

  if (filters.source === 'bank') {
    const [total, data] = await Promise.all([
      countBank(user_id, start, end, filters.classified, rm),
      fetchBankPage(user_id, start, end, filters.classified, rm, rangeFrom, rangeTo),
    ])
    return { data, total }
  }

  if (filters.source === 'card') {
    const [total, data] = await Promise.all([
      countCard(user_id, start, end, filters.classified, rm),
      fetchCardPage(user_id, start, end, filters.classified, rm, rangeFrom, rangeTo),
    ])
    return { data, total }
  }

  // source === 'all':
  // COUNT: accurate sum from both tables.
  // DATA: fetch range(0, rangeTo) from each, merge+sort, slice to current page.
  // This is correct for monthly financial data (typically < 500 rows/month).
  const [bankTotal, cardTotal, bankRows, cardRows] = await Promise.all([
    countBank(user_id, start, end, filters.classified, rm),
    countCard(user_id, start, end, filters.classified, rm),
    fetchBankPage(user_id, start, end, filters.classified, rm, 0, rangeTo),
    fetchCardPage(user_id, start, end, filters.classified, rm, 0, rangeTo),
  ])

  const total = bankTotal + cardTotal
  const merged = [...bankRows, ...cardRows].sort((a, b) => b.date.localeCompare(a.date))
  const data = merged.slice(rangeFrom, rangeFrom + pageSize)
  return { data, total }
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateTransaction(
  id: string,
  source: 'bank' | 'card',
  updates: TransactionUpdate,
): Promise<UnifiedTransaction> {
  const table = source === 'bank' ? 'bank_transactions' : 'card_transactions'

  const payload: Record<string, unknown> = {
    description: updates.description,
    date: updates.date,
    amount: updates.amount,
    category_id: updates.category_id,
    notes: updates.notes,
    reference_month: updates.reference_month,
    auto_classified: false,
  }
  if (source === 'bank' && updates.type !== null) {
    payload.type = updates.type
  }

  const bankSelect = `
    id, date, description, amount, type, notes, category_id, auto_classified, reference_month,
    banks!bank_id(name),
    categories!category_id(name, icon, color)
  `
  const cardSelect = `
    id, date, description, amount, notes, category_id, auto_classified, reference_month,
    credit_cards!card_id(name),
    categories!category_id(name, icon, color)
  `

  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq('id', id)
    .select(source === 'bank' ? bankSelect : cardSelect)
    .single()

  if (error) throw new Error(error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return source === 'bank' ? normalizeBankRow(data as any) : normalizeCardRow(data as any)
}

// ─── Reclassify period ────────────────────────────────────────────────────────

export async function reclassifyPeriod(
  filters: Pick<TransactionFilters, 'year' | 'month' | 'source'>,
): Promise<ClassificationSummary> {
  const user_id = await getCurrentUserId()
  const { start, end } = monthRange(filters.year, filters.month)

  let bankTotal = 0
  let bankClassified = 0
  let cardTotal = 0
  let cardClassified = 0

  if (filters.source !== 'card') {
    const { data, error } = await supabase
      .from('bank_transactions')
      .select('id, description')
      .eq('user_id', user_id)
      .is('deleted_at', null)
      .gte('date', start)
      .lte('date', end)

    if (error) throw new Error(error.message)

    const rows = (data ?? []) as Array<{ id: string; description: string }>
    bankTotal = rows.length

    if (rows.length > 0) {
      const summary = await classifyAndSaveTransactions(rows, 'bank_transactions', user_id)
      bankClassified = summary.classified
    }
  }

  if (filters.source !== 'bank') {
    const { data, error } = await supabase
      .from('card_transactions')
      .select('id, description')
      .eq('user_id', user_id)
      .is('deleted_at', null)
      .gte('date', start)
      .lte('date', end)

    if (error) throw new Error(error.message)

    const rows = (data ?? []) as Array<{ id: string; description: string }>
    cardTotal = rows.length

    if (rows.length > 0) {
      const summary = await classifyAndSaveTransactions(rows, 'card_transactions', user_id)
      cardClassified = summary.classified
    }
  }

  const total = bankTotal + cardTotal
  const classified = bankClassified + cardClassified
  return {
    total,
    classified,
    unclassified: total - classified,
    avgConfidence: 0,
  }
}

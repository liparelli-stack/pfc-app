import { supabase } from '@/lib/supabase'

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Usuário não autenticado.')
  return data.user.id
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BudgetRow {
  categoryId: string
  categoryName: string
  categoryColor: string
  categoryIcon: string | null
  budgeted: number
  actual: number
  pointBudgetId: string | null   // ID of the point entry (is_base=false) for this month
  baseBudgetId: string | null    // ID of the base entry (is_base=true)
  effectiveSource: 'point' | 'base' | 'none'
  hasBudget: boolean
}

export interface BudgetSummary {
  totalBudgeted: number
  totalActual: number
  balance: number
  pctConsumed: number
}

export interface BudgetData {
  rows: BudgetRow[]
  summary: BudgetSummary
  // Uncategorized actual spending (no category_id)
  uncategorizedActual: number
}

export interface BudgetUpsertInput {
  category_id: string
  amount: number
  is_base: boolean
  selectedMonth: string   // "YYYY-MM-01" — service extracts year + month integers
  existingId: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FALLBACK_COLOR = '#6b7280'

// Convention: base budget entries are stored with year=0, month=0
const BASE_YEAR = 0
const BASE_MONTH = 0

function parseMonthStr(str: string): { year: number; month: number } {
  const [y, m] = str.split('-')
  return { year: parseInt(y, 10), month: parseInt(m, 10) }
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchBudgetData(monthStr: string): Promise<BudgetData> {
  const user_id = await getCurrentUserId()
  const { year, month } = parseMonthStr(monthStr)

  const [
    { data: pointData, error: e1 },
    { data: baseData, error: e2 },
    { data: bankData, error: e3 },
    { data: cardData, error: e4 },
    { data: catData, error: e5 },
  ] = await Promise.all([
    // Point adjustments for this specific year+month
    supabase
      .from('budget')
      .select('*')
      .eq('user_id', user_id)
      .eq('year', year)
      .eq('month', month)
      .eq('is_base', false),
    // Base budget (applies to all months — stored with year=0, month=0)
    supabase
      .from('budget')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_base', true),
    // Bank debits for this month
    supabase
      .from('bank_transactions')
      .select('category_id, amount')
      .eq('reference_month', monthStr)
      .eq('type', 'debit'),
    // All card expenses for this month
    supabase
      .from('card_transactions')
      .select('category_id, amount')
      .eq('reference_month', monthStr),
    // All categories visible to this user
    supabase
      .from('categories')
      .select('id, name, icon, color')
      .is('deleted_at', null)
      .or(`user_id.is.null,user_id.eq.${user_id}`),
  ])

  if (e1) throw new Error(e1.message)
  if (e2) throw new Error(e2.message)
  if (e3) throw new Error(e3.message)
  if (e4) throw new Error(e4.message)
  if (e5) throw new Error(e5.message)

  const pointEntries = pointData ?? []
  const baseEntries = baseData ?? []
  const bankTxns = bankData ?? []
  const cardTxns = cardData ?? []
  const categories = catData ?? []

  // Lookup maps
  type CatRecord = { id: string; name: string; icon: string | null; color: string | null }
  const catMap = new Map<string, CatRecord>(categories.map((c) => [c.id, c as CatRecord]))
  const pointMap = new Map(pointEntries.map((e) => [e.category_id as string, e]))
  const baseMap = new Map(baseEntries.map((e) => [e.category_id as string, e]))

  // Actual spending per category (null key = uncategorized)
  const actualMap = new Map<string | null, number>()
  for (const t of [...bankTxns, ...cardTxns]) {
    const key = t.category_id ?? null
    actualMap.set(key, (actualMap.get(key) ?? 0) + Number(t.amount))
  }

  // Uncategorized actual (no category_id in transactions)
  const uncategorizedActual = actualMap.get(null) ?? 0

  // Union of all named category IDs across budget + actuals
  const allCatIds = new Set<string>([
    ...pointEntries.map((e) => e.category_id as string),
    ...baseEntries.map((e) => e.category_id as string),
    ...[...actualMap.keys()].filter((k): k is string => k !== null),
  ])

  const rows: BudgetRow[] = []

  for (const catId of allCatIds) {
    const cat = catMap.get(catId)
    const pointEntry = pointMap.get(catId) ?? null
    const baseEntry = baseMap.get(catId) ?? null
    const actual = actualMap.get(catId) ?? 0

    // Point adjustment overrides base for this category/month
    let budgeted = 0
    let effectiveSource: BudgetRow['effectiveSource'] = 'none'

    if (pointEntry) {
      budgeted = Number(pointEntry.amount)
      effectiveSource = 'point'
    } else if (baseEntry) {
      budgeted = Number(baseEntry.amount)
      effectiveSource = 'base'
    }

    rows.push({
      categoryId: catId,
      categoryName: cat?.name ?? 'Categoria desconhecida',
      categoryColor: cat?.color ?? FALLBACK_COLOR,
      categoryIcon: cat?.icon ?? null,
      budgeted,
      actual,
      pointBudgetId: pointEntry?.id ?? null,
      baseBudgetId: baseEntry?.id ?? null,
      effectiveSource,
      hasBudget: effectiveSource !== 'none',
    })
  }

  // Sort: rows with budget first (by budgeted desc), then by actual desc
  rows.sort((a, b) => {
    if (a.hasBudget !== b.hasBudget) return a.hasBudget ? -1 : 1
    return b.budgeted - a.budgeted || b.actual - a.actual
  })

  const totalBudgeted = rows.reduce((s, r) => s + r.budgeted, 0)
  const totalActual = rows.reduce((s, r) => s + r.actual, 0) + uncategorizedActual
  const balance = totalBudgeted - totalActual
  const pctConsumed = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : 0

  return {
    rows,
    summary: { totalBudgeted, totalActual, balance, pctConsumed },
    uncategorizedActual,
  }
}

// ─── Upsert ───────────────────────────────────────────────────────────────────

export async function upsertBudget(input: BudgetUpsertInput): Promise<void> {
  const user_id = await getCurrentUserId()
  if (input.amount <= 0) throw new Error('Valor deve ser maior que zero.')

  const { year, month } = parseMonthStr(input.selectedMonth)

  // Base entries use year=0, month=0 as convention
  const entryYear = input.is_base ? BASE_YEAR : year
  const entryMonth = input.is_base ? BASE_MONTH : month

  if (input.existingId) {
    const { error } = await supabase
      .from('budget')
      .update({ amount: input.amount, is_base: input.is_base, year: entryYear, month: entryMonth })
      .eq('id', input.existingId)
      .eq('user_id', user_id)

    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('budget').insert({
      user_id,
      category_id: input.category_id,
      amount: input.amount,
      is_base: input.is_base,
      year: entryYear,
      month: entryMonth,
    })

    if (error) throw new Error(error.message)
  }
}

// ─── Copy base to month ───────────────────────────────────────────────────────

/**
 * Copies base budget entries (is_base=true) to point entries for the given month,
 * skipping categories that already have a point entry for that month.
 * Returns the count of new entries created.
 */
export async function copyBaseToMonth(monthStr: string): Promise<number> {
  const user_id = await getCurrentUserId()
  const { year, month } = parseMonthStr(monthStr)

  const [{ data: base }, { data: existing }] = await Promise.all([
    supabase
      .from('budget')
      .select('category_id, amount')
      .eq('user_id', user_id)
      .eq('is_base', true),
    supabase
      .from('budget')
      .select('category_id')
      .eq('user_id', user_id)
      .eq('year', year)
      .eq('month', month)
      .eq('is_base', false),
  ])

  const existingCats = new Set((existing ?? []).map((e) => e.category_id))

  const toInsert = (base ?? [])
    .filter((e) => !existingCats.has(e.category_id))
    .map((e) => ({
      user_id,
      category_id: e.category_id,
      amount: e.amount,
      is_base: false,
      year,
      month,
    }))

  if (toInsert.length === 0) return 0

  const { error } = await supabase.from('budget').insert(toInsert)
  if (error) throw new Error(error.message)

  return toInsert.length
}

// ─── Matrix types ─────────────────────────────────────────────────────────────

export interface MatrixBudgetEntry {
  id: string
  category_id: string
  year: number
  month: number   // 1-12
  amount: number
}

export interface MatrixSaveInput {
  budgetId: string | null   // existing DB id, or null for new entries
  category_id: string
  amount: number            // 0 = delete entry if budgetId exists
  year: number
  month: number             // 1-12
}

// ─── Fetch matrix ─────────────────────────────────────────────────────────────

/**
 * Fetches all point budget entries (is_base=false) for the given list of months.
 * monthStrs: array of "YYYY-MM-01" strings.
 */
export async function fetchBudgetMatrix(monthStrs: string[]): Promise<MatrixBudgetEntry[]> {
  if (monthStrs.length === 0) return []
  const user_id = await getCurrentUserId()

  const parsed = monthStrs.map(parseMonthStr)
  const minYear = Math.min(...parsed.map((p) => p.year))
  const maxYear = Math.max(...parsed.map((p) => p.year))

  const { data, error } = await supabase
    .from('budget')
    .select('id, category_id, year, month, amount')
    .eq('user_id', user_id)
    .eq('is_base', false)
    .gte('year', minYear)
    .lte('year', maxYear)

  if (error) throw new Error(error.message)

  // Filter to exactly our target months (year range may be broader than needed)
  const monthSet = new Set(parsed.map((p) => `${p.year}-${p.month}`))
  return (data ?? [])
    .filter((e) => monthSet.has(`${e.year}-${e.month}`))
    .map((e) => ({ ...e, amount: Number(e.amount) }))
}

// ─── Save matrix ──────────────────────────────────────────────────────────────

const SAVE_CHUNK = 50

/**
 * Bulk saves a matrix of budget values.
 * - amount > 0: upsert (insert or update by unique key)
 * - amount = 0 and budgetId exists: delete the entry
 * - amount = 0 and no budgetId: no-op
 * Calls onProgress(done, total) after each chunk.
 */
export async function saveBudgetMatrix(
  inputs: MatrixSaveInput[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ saved: number; deleted: number }> {
  const user_id = await getCurrentUserId()

  const toUpsert = inputs.filter((i) => i.amount > 0)
  const toDelete = inputs.filter((i) => i.amount === 0 && i.budgetId)
  const total = toUpsert.length + toDelete.length

  let done = 0
  let saved = 0
  let deleted = 0

  // Upsert in chunks — use Supabase upsert with onConflict to handle both insert & update
  for (let i = 0; i < toUpsert.length; i += SAVE_CHUNK) {
    const chunk = toUpsert.slice(i, i + SAVE_CHUNK)
    const rows = chunk.map((c) => ({
      user_id,
      category_id: c.category_id,
      year: c.year,
      month: c.month,
      amount: c.amount,
      is_base: false,
    }))

    const { error } = await supabase
      .from('budget')
      .upsert(rows, { onConflict: 'user_id,category_id,year,month' })

    if (error) throw new Error(error.message)

    done += chunk.length
    saved += chunk.length
    onProgress?.(done, total)
  }

  // Delete in chunks by ID
  for (let i = 0; i < toDelete.length; i += SAVE_CHUNK) {
    const chunk = toDelete.slice(i, i + SAVE_CHUNK)
    const ids = chunk.map((c) => c.budgetId!)

    const { error } = await supabase.from('budget').delete().in('id', ids)
    if (error) throw new Error(error.message)

    done += chunk.length
    deleted += chunk.length
    onProgress?.(done, total)
  }

  return { saved, deleted }
}

// ─── Save single cell (auto-save) ─────────────────────────────────────────────

/**
 * Upserts or deletes a single budget point entry.
 * - amount > 0: upsert by natural key (user_id, category_id, year, month)
 * - amount = 0: delete by natural key
 * Returns the row ID after upsert, or null if deleted / no-op.
 */
export async function saveSingleBudgetCell(input: {
  category_id: string
  amount: number
  year: number
  month: number
}): Promise<string | null> {
  const user_id = await getCurrentUserId()

  if (input.amount === 0) {
    const { error } = await supabase
      .from('budget')
      .delete()
      .eq('user_id', user_id)
      .eq('category_id', input.category_id)
      .eq('year', input.year)
      .eq('month', input.month)
      .eq('is_base', false)
    if (error) throw new Error(error.message)
    return null
  }

  const { data, error } = await supabase
    .from('budget')
    .upsert(
      {
        user_id,
        category_id: input.category_id,
        amount: input.amount,
        is_base: false,
        year: input.year,
        month: input.month,
      },
      { onConflict: 'user_id,category_id,year,month' },
    )
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data.id
}

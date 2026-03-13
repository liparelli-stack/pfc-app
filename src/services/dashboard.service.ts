import { supabase } from '@/lib/supabase'

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Usuário não autenticado.')
  return data.user.id
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  totalIncome: number
  totalExpense: number
  balance: number
  totalCard: number
  totalBankDebit: number
  biggestExpense: { description: string; amount: number; source: 'bank' | 'card' } | null
  dailyAverage: number
  uncategorizedCount: number
  uncategorizedTotal: number
}

export interface MonthlyPoint {
  month: string    // "YYYY-MM-01"
  label: string    // "Mar/26"
  income: number
  expense: number
  balance: number
}

export interface CategorySlice {
  categoryId: string | null
  name: string
  color: string
  icon: string | null
  total: number
  percentage: number
}

export interface DashboardData {
  summary: DashboardSummary
  evolution: MonthlyPoint[]
  categories: CategorySlice[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MONTHS_SHORT[parseInt(m, 10) - 1]}/${String(y).slice(2)}`
}

/** Returns last N months ending at referenceMonth as "YYYY-MM-01" strings, oldest first. */
export function getLastNMonths(referenceMonth: string, n: number): string[] {
  const [year, month] = referenceMonth.split('-').map(Number)
  const months: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    let m = month - i
    let y = year
    while (m <= 0) { m += 12; y-- }
    months.push(`${y}-${String(m).padStart(2, '0')}-01`)
  }
  return months
}

function daysInMonth(referenceMonth: string): number {
  const [y, m] = referenceMonth.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

// ─── Main fetch ───────────────────────────────────────────────────────────────

export async function fetchDashboardData(referenceMonth: string): Promise<DashboardData> {
  const user_id = await getCurrentUserId()
  const months6 = getLastNMonths(referenceMonth, 6)

  const [bankCurrent, cardCurrent, bank6, card6] = await Promise.all([
    supabase
      .from('bank_transactions')
      .select('id, amount, type, description, category_id, categories(id, name, icon, color)')
      .eq('user_id', user_id)
      .eq('reference_month', referenceMonth)
      .is('deleted_at', null),

    supabase
      .from('card_transactions')
      .select('id, amount, description, category_id, categories(id, name, icon, color)')
      .eq('user_id', user_id)
      .eq('reference_month', referenceMonth)
      .is('deleted_at', null),

    supabase
      .from('bank_transactions')
      .select('amount, type, reference_month')
      .eq('user_id', user_id)
      .in('reference_month', months6)
      .is('deleted_at', null),

    supabase
      .from('card_transactions')
      .select('amount, reference_month')
      .eq('user_id', user_id)
      .in('reference_month', months6)
      .is('deleted_at', null),
  ])

  if (bankCurrent.error) throw new Error(bankCurrent.error.message)
  if (cardCurrent.error) throw new Error(cardCurrent.error.message)
  if (bank6.error) throw new Error(bank6.error.message)
  if (card6.error) throw new Error(card6.error.message)

  const bankRows = (bankCurrent.data ?? []) as any[]
  const cardRows = (cardCurrent.data ?? []) as any[]

  // ── Summary ─────────────────────────────────────────────────────────────────

  const bankCredit = bankRows.filter((r) => r.type === 'credit')
  const bankDebit  = bankRows.filter((r) => r.type === 'debit')

  const totalIncome    = bankCredit.reduce((s: number, r: any) => s + Math.abs(r.amount), 0)
  const totalBankDebit = bankDebit.reduce((s: number, r: any) => s + Math.abs(r.amount), 0)
  const totalCard      = cardRows.reduce((s: number, r: any) => s + Math.abs(r.amount), 0)
  const totalExpense   = totalBankDebit + totalCard
  const balance        = totalIncome - totalExpense

  const expenseRows = [
    ...bankDebit.map((r: any) => ({ description: r.description as string, amount: Math.abs(r.amount) as number, source: 'bank' as const })),
    ...cardRows.map((r: any)  => ({ description: r.description as string, amount: Math.abs(r.amount) as number, source: 'card' as const })),
  ]
  const biggestExpense = expenseRows.length > 0
    ? expenseRows.reduce((max, r) => r.amount > max.amount ? r : max)
    : null

  const dailyAverage = totalExpense / daysInMonth(referenceMonth)

  const uncategorizedBank = bankDebit.filter((r: any) => !r.category_id)
  const uncategorizedCard = cardRows.filter((r: any) => !r.category_id)
  const uncategorizedCount = uncategorizedBank.length + uncategorizedCard.length
  const uncategorizedTotal =
    uncategorizedBank.reduce((s: number, r: any) => s + Math.abs(r.amount), 0) +
    uncategorizedCard.reduce((s: number, r: any) => s + Math.abs(r.amount), 0)

  // ── Category breakdown ───────────────────────────────────────────────────────

  const categoryMap = new Map<string | null, { name: string; color: string; icon: string | null; total: number }>()

  function addExpense(row: any, source: 'bank' | 'card') {
    if (source === 'bank' && row.type !== 'debit') return
    const amt = Math.abs(row.amount)
    const catId: string | null = row.category_id ?? null
    const cat = row.categories as any
    const existing = categoryMap.get(catId)
    if (existing) {
      existing.total += amt
    } else {
      categoryMap.set(catId, {
        name:  cat?.name  ?? 'Sem categoria',
        color: cat?.color ?? '#6b7280',
        icon:  cat?.icon  ?? null,
        total: amt,
      })
    }
  }

  bankRows.forEach((r) => addExpense(r, 'bank'))
  cardRows.forEach((r) => addExpense(r, 'card'))

  const divisor = totalExpense || 1
  const categories: CategorySlice[] = Array.from(categoryMap.entries())
    .map(([id, v]) => ({ categoryId: id, ...v, percentage: (v.total / divisor) * 100 }))
    .sort((a, b) => b.total - a.total)

  // ── Monthly evolution ────────────────────────────────────────────────────────

  const bank6Rows = (bank6.data ?? []) as any[]
  const card6Rows = (card6.data ?? []) as any[]

  const evolution: MonthlyPoint[] = months6.map((m) => {
    const bRows = bank6Rows.filter((r) => r.reference_month === m)
    const cRows = card6Rows.filter((r) => r.reference_month === m)

    const income  = bRows.filter((r: any) => r.type === 'credit').reduce((s: number, r: any) => s + Math.abs(r.amount), 0)
    const expense = bRows.filter((r: any) => r.type === 'debit').reduce((s: number, r: any) => s + Math.abs(r.amount), 0)
                  + cRows.reduce((s: number, r: any) => s + Math.abs(r.amount), 0)

    return { month: m, label: formatMonthLabel(m), income, expense, balance: income - expense }
  })

  return {
    summary: { totalIncome, totalExpense, balance, totalCard, totalBankDebit, biggestExpense, dailyAverage, uncategorizedCount, uncategorizedTotal },
    evolution,
    categories,
  }
}

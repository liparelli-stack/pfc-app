import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SummaryCards, SummaryCardsSkeleton } from '@/components/dashboard/SummaryCards'
import { MonthlyEvolutionChart, MonthlyEvolutionChartSkeleton } from '@/components/dashboard/MonthlyEvolutionChart'
import { IncomeExpenseChart, IncomeExpenseChartSkeleton } from '@/components/dashboard/IncomeExpenseChart'
import { CategoryPieChart, CategoryPieChartSkeleton } from '@/components/dashboard/CategoryPieChart'
import { CategoryBarChart, CategoryBarChartSkeleton } from '@/components/dashboard/CategoryBarChart'
import { UncategorizedAlert } from '@/components/dashboard/UncategorizedAlert'
import { fetchDashboardData, getLastNMonths, formatMonthLabel, type DashboardData } from '@/services/dashboard.service'

// ── Month selector helpers ────────────────────────────────────────────────────

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function getMonthOptions(): Array<{ value: string; label: string }> {
  // Last 24 months up to current month, newest first
  const current = getCurrentMonth()
  const months = getLastNMonths(current, 24).reverse()
  return months.map((m) => ({ value: m, label: formatMonthLabel(m) }))
}

const MONTH_OPTIONS = getMonthOptions()

// ─── Dashboard page ───────────────────────────────────────────────────────────

export function Dashboard() {
  const [referenceMonth, setReferenceMonth] = useState<string>(getCurrentMonth)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData(referenceMonth)
  }, [referenceMonth])

  async function loadData(month: string) {
    setLoading(true)
    try {
      const result = await fetchDashboardData(month)
      setData(result)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar o dashboard.')
    } finally {
      setLoading(false)
    }
  }

  const noData = data && data.summary.totalIncome === 0 && data.summary.totalExpense === 0

  return (
    <div className="flex flex-col gap-6">
      {/* Header + filter */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Visão geral das suas finanças.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-muted-foreground">Mês de referência:</span>
          <Select value={referenceMonth} onValueChange={setReferenceMonth}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Alerta sem categoria */}
      {!loading && data && (
        <UncategorizedAlert
          count={data.summary.uncategorizedCount}
          total={data.summary.uncategorizedTotal}
        />
      )}

      {/* BLOCO 1 + 3: Summary cards */}
      {loading ? <SummaryCardsSkeleton /> : data && <SummaryCards summary={data.summary} />}

      {/* No-data message */}
      {!loading && noData && (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          Nenhuma transação encontrada para{' '}
          <strong>{formatMonthLabel(referenceMonth)}</strong>.
          Importe um extrato ou selecione outro período.
        </div>
      )}

      {/* BLOCO 2: Evolução mensal (line chart) */}
      {loading
        ? <MonthlyEvolutionChartSkeleton />
        : data && <MonthlyEvolutionChart data={data.evolution} />
      }

      {/* BLOCO 2b: Entradas vs Saídas (bar chart — alternative view) */}
      {loading
        ? <IncomeExpenseChartSkeleton />
        : data && <IncomeExpenseChart data={data.evolution} />
      }

      {/* BLOCO 4: Categorias */}
      {loading ? (
        <div className="grid grid-cols-2 gap-6">
          <CategoryPieChartSkeleton />
          <CategoryBarChartSkeleton />
        </div>
      ) : data && (
        <div className="grid grid-cols-2 gap-6">
          <CategoryPieChart categories={data.categories} />
          <CategoryBarChart categories={data.categories} />
        </div>
      )}
    </div>
  )
}

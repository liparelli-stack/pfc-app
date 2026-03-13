import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { BudgetRow } from '@/services/budget.service'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-card px-4 py-3 shadow-md text-sm">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="flex justify-between gap-4" style={{ color: p.fill }}>
          <span>{p.name}:</span>
          <span className="font-medium tabular-nums">{brl.format(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

interface BudgetChartProps {
  rows: BudgetRow[]
}

export function BudgetChart({ rows }: BudgetChartProps) {
  // Only named categories with budget or actual data, sorted by actual desc
  const chartData = rows
    .filter((r) => r.categoryId !== null && (r.budgeted > 0 || r.actual > 0))
    .sort((a, b) => b.actual - a.actual)
    .map((r) => ({
      name: r.categoryName,
      Orçado: r.budgeted,
      Realizado: r.actual,
      color: r.categoryColor,
    }))

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm flex items-center justify-center h-40 text-sm text-muted-foreground">
        Nenhum dado para exibir no gráfico.
      </div>
    )
  }

  // 60px per category + margins
  const chartHeight = Math.max(chartData.length * 60 + 60, 200)

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold mb-4">Orçado vs Realizado por Categoria</h3>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 0, right: 100, left: 8, bottom: 0 }}
          barGap={2}
          barCategoryGap="35%"
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
          <XAxis
            type="number"
            tickFormatter={(v) => brl.format(v)}
            tick={{ fontSize: 10 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            type="category"
            dataKey="name"
            width={120}
            tick={{ fontSize: 11 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="Orçado" fill="#3b82f6" radius={[0, 3, 3, 0]} maxBarSize={16} />
          <Bar dataKey="Realizado" radius={[0, 3, 3, 0]} maxBarSize={16}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function BudgetChartSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm animate-pulse">
      <div className="h-4 w-52 rounded bg-muted mb-5" />
      <div className="flex flex-col gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-3 w-24 rounded bg-muted shrink-0" />
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="h-3 rounded bg-muted" style={{ maxWidth: `${(6 - i) * 18}%` }} />
              <div className="h-3 rounded bg-muted" style={{ maxWidth: `${(6 - i) * 14}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

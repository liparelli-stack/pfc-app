import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
  ResponsiveContainer,
} from 'recharts'
import type { CategorySlice } from '@/services/dashboard.service'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const MAX_CATEGORIES = 10

interface CategoryBarChartProps {
  categories: CategorySlice[]
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div className="rounded-lg border bg-card px-4 py-3 shadow-md text-sm">
      <p className="font-semibold">{entry.payload.name}</p>
      <p className="text-muted-foreground">{brl.format(entry.value)}</p>
      <p className="text-muted-foreground">{entry.payload.percentage.toFixed(1)}%</p>
    </div>
  )
}

export function CategoryBarChart({ categories }: CategoryBarChartProps) {
  if (categories.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm flex items-center justify-center h-64 text-sm text-muted-foreground">
        Nenhum gasto no período.
      </div>
    )
  }

  // Top 10; group the rest into "Outros"
  let chartData: CategorySlice[]
  if (categories.length <= MAX_CATEGORIES) {
    chartData = [...categories]
  } else {
    const top = categories.slice(0, MAX_CATEGORIES - 1)
    const rest = categories.slice(MAX_CATEGORIES - 1)
    const othersTotal = rest.reduce((s, c) => s + c.total, 0)
    const othersPerc  = rest.reduce((s, c) => s + c.percentage, 0)
    chartData = [
      ...top,
      { categoryId: null, name: 'Outros', color: '#9ca3af', icon: null, total: othersTotal, percentage: othersPerc },
    ]
  }

  // Chart is horizontal: layout="vertical" in recharts means bars grow left→right
  const barHeight = 32
  const chartHeight = Math.max(chartData.length * barHeight + 40, 180)

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold mb-3">Ranking de Gastos</h3>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 0, right: 80, left: 4, bottom: 0 }}
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
            width={110}
            tick={{ fontSize: 12 }}
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {chartData.map((c, i) => (
              <Cell key={i} fill={c.color} />
            ))}
            <LabelList
              dataKey="total"
              position="right"
              formatter={(v) => brl.format(v as number)}
              style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CategoryBarChartSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm animate-pulse">
      <div className="h-4 w-32 rounded bg-muted mb-4" />
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-5 rounded bg-muted flex-1" style={{ maxWidth: `${(6 - i) * 18}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}

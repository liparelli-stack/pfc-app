import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { CategorySlice } from '@/services/dashboard.service'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

interface CategoryPieChartProps {
  categories: CategorySlice[]
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  return (
    <div className="rounded-lg border bg-card px-4 py-3 shadow-md text-sm">
      <p className="font-semibold">{entry.name}</p>
      <p className="text-muted-foreground">{brl.format(entry.value)}</p>
      <p className="text-muted-foreground">{entry.payload.percentage.toFixed(1)}%</p>
    </div>
  )
}

function renderLegend(props: any) {
  const { payload } = props
  return (
    <ul className="flex flex-col gap-1 text-xs mt-2">
      {payload.map((entry: any, i: number) => (
        <li key={i} className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="truncate text-muted-foreground">{entry.value}</span>
          <span className="ml-auto font-medium shrink-0">{entry.payload.percentage.toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  )
}

export function CategoryPieChart({ categories }: CategoryPieChartProps) {
  if (categories.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm flex items-center justify-center h-64 text-sm text-muted-foreground">
        Nenhum gasto no período.
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold mb-3">Gastos por Categoria</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={categories}
            dataKey="total"
            nameKey="name"
            cx="50%"
            cy="45%"
            outerRadius={90}
            innerRadius={40}
          >
            {categories.map((c, i) => (
              <Cell key={i} fill={c.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            content={renderLegend}
            layout="vertical"
            align="center"
            verticalAlign="bottom"
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function CategoryPieChartSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm animate-pulse">
      <div className="h-4 w-36 rounded bg-muted mb-4" />
      <div className="flex justify-center">
        <div className="h-44 w-44 rounded-full bg-muted" />
      </div>
    </div>
  )
}

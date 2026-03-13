import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { MonthlyPoint } from '@/services/dashboard.service'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

interface IncomeExpenseChartProps {
  data: MonthlyPoint[]
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-card px-4 py-3 shadow-md text-sm">
      <p className="font-semibold mb-2">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {brl.format(entry.value)}
        </p>
      ))}
    </div>
  )
}

export function IncomeExpenseChart({ data }: IncomeExpenseChartProps) {
  const isEmpty = data.every((d) => d.income === 0 && d.expense === 0)

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="text-sm font-semibold mb-4">Entradas vs Saídas — últimos 6 meses</h3>

      {isEmpty ? (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          Nenhum dado para exibir no período.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <YAxis
              tickFormatter={(v) => brl.format(v)}
              tick={{ fontSize: 11 }}
              width={90}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="income" name="Entradas" fill="#22c55e" radius={[3, 3, 0, 0]} />
            <Bar dataKey="expense" name="Saídas"   fill="#ef4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export function IncomeExpenseChartSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm animate-pulse">
      <div className="h-4 w-52 rounded bg-muted mb-4" />
      <div className="h-56 rounded bg-muted" />
    </div>
  )
}

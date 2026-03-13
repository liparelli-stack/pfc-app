import type { BudgetSummary } from '@/services/budget.service'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

interface BudgetKPICardsProps {
  summary: BudgetSummary
}

export function BudgetKPICards({ summary }: BudgetKPICardsProps) {
  const { totalBudgeted, totalActual, balance, pctConsumed } = summary

  const isOver = balance < 0
  const isWarning = !isOver && pctConsumed >= 80

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Total Orçado */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Orçado</p>
        <p className="text-2xl font-bold text-blue-600">{brl.format(totalBudgeted)}</p>
        <p className="text-xs text-muted-foreground mt-1">Planejado para o mês</p>
      </div>

      {/* Total Realizado */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Realizado</p>
        <p className="text-2xl font-bold text-red-600">{brl.format(totalActual)}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {totalBudgeted > 0
            ? `${pctConsumed.toFixed(1)}% do orçamento consumido`
            : 'Sem orçamento definido'}
        </p>
      </div>

      {/* Saldo */}
      <div className={`rounded-xl border bg-card p-5 shadow-sm ${isOver ? 'border-red-300' : 'border-green-200'}`}>
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Saldo do Orçamento</p>
        <p className={`text-2xl font-bold ${isOver ? 'text-red-600' : 'text-green-600'}`}>
          {brl.format(balance)}
        </p>
        <p className={`text-xs mt-1 ${isOver ? 'text-red-500' : isWarning ? 'text-yellow-600' : 'text-muted-foreground'}`}>
          {isOver
            ? `🔴 Estourado em ${brl.format(Math.abs(balance))}`
            : isWarning
            ? `⚠️ ${pctConsumed.toFixed(1)}% consumido — atenção`
            : totalBudgeted > 0
            ? `✅ ${pctConsumed.toFixed(1)}% consumido — dentro do orçamento`
            : 'Defina o orçamento para acompanhar'}
        </p>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function BudgetKPICardsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border bg-card p-5 shadow-sm animate-pulse">
          <div className="h-3 w-24 rounded bg-muted mb-3" />
          <div className="h-7 w-36 rounded bg-muted mb-2" />
          <div className="h-3 w-32 rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

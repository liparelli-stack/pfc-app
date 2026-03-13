import type { DashboardSummary } from '@/services/dashboard.service'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

interface SummaryCardsProps {
  summary: DashboardSummary
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border bg-card p-5 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const {
    totalIncome, totalExpense, balance,
    totalCard, totalBankDebit, biggestExpense, dailyAverage,
  } = summary

  return (
    <div className="flex flex-col gap-4">
      {/* ── BLOCO 1: Entradas / Saídas / Saldo ─────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Entradas */}
        <Card>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Entradas</p>
          <p className="text-2xl font-bold text-green-600">{brl.format(totalIncome)}</p>
          <p className="text-xs text-muted-foreground mt-1">Créditos bancários do período</p>
        </Card>

        {/* Saídas */}
        <Card>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Saídas</p>
          <p className="text-2xl font-bold text-red-600">{brl.format(totalExpense)}</p>
          <p className="text-xs text-muted-foreground mt-1">Débitos + faturas do período</p>
        </Card>

        {/* Saldo */}
        <Card className={balance >= 0 ? 'border-green-200' : 'border-red-200'}>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Saldo do Período</p>
          <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {brl.format(balance)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Entradas − Saídas</p>
        </Card>
      </div>

      {/* ── BLOCO 3: Detalhes de gastos ────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        {/* Total Cartão */}
        <Card>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Total Cartão</p>
          <p className="text-lg font-semibold">{brl.format(totalCard)}</p>
          <p className="text-xs text-muted-foreground mt-1">Faturas do período</p>
        </Card>

        {/* Total Banco Débito */}
        <Card>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Banco (Débitos)</p>
          <p className="text-lg font-semibold">{brl.format(totalBankDebit)}</p>
          <p className="text-xs text-muted-foreground mt-1">Débitos em conta</p>
        </Card>

        {/* Maior gasto único */}
        <Card>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Maior Gasto</p>
          {biggestExpense ? (
            <>
              <p className="text-lg font-semibold text-red-600">{brl.format(biggestExpense.amount)}</p>
              <p className="text-xs text-muted-foreground mt-1 truncate" title={biggestExpense.description}>
                {biggestExpense.description}
              </p>
            </>
          ) : (
            <p className="text-lg font-semibold text-muted-foreground">—</p>
          )}
        </Card>

        {/* Média diária */}
        <Card>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Média Diária</p>
          <p className="text-lg font-semibold">{brl.format(dailyAverage)}</p>
          <p className="text-xs text-muted-foreground mt-1">Gastos / dias do mês</p>
        </Card>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function SummaryCardsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-5 shadow-sm animate-pulse">
            <div className="h-3 w-24 rounded bg-muted mb-3" />
            <div className="h-7 w-36 rounded bg-muted mb-2" />
            <div className="h-3 w-32 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-5 shadow-sm animate-pulse">
            <div className="h-3 w-20 rounded bg-muted mb-3" />
            <div className="h-6 w-28 rounded bg-muted mb-2" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

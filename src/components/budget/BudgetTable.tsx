import type { BudgetRow } from '@/services/budget.service'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// ─── Progress bar helpers ─────────────────────────────────────────────────────

function getPct(budgeted: number, actual: number): number | null {
  if (budgeted === 0) return null
  return (actual / budgeted) * 100
}

function barBackground(pct: number): string {
  if (pct >= 100) {
    return 'repeating-linear-gradient(-45deg, #ef4444, #ef4444 4px, #fca5a5 4px, #fca5a5 8px)'
  }
  if (pct >= 80) return '#f59e0b'
  return '#22c55e'
}

function ProgressBar({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-xs text-muted-foreground">Sem orçamento</span>
  }
  const clampedPct = Math.min(pct, 100)
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="relative h-2 flex-1 rounded-full bg-muted overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${clampedPct}%`, background: barBackground(pct) }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-10 text-right shrink-0">
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

function StatusBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>
  if (pct >= 100) return <span className="text-xs font-medium text-red-600">🔴 Estourado</span>
  if (pct >= 80) return <span className="text-xs font-medium text-yellow-600">⚠️ Atenção</span>
  return <span className="text-xs font-medium text-green-600">✅ OK</span>
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BudgetTableProps {
  rows: BudgetRow[]
  uncategorizedActual: number
  onEdit: (row: BudgetRow) => void
}

export function BudgetTable({ rows, uncategorizedActual, onEdit }: BudgetTableProps) {
  if (rows.length === 0 && uncategorizedActual === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
        Nenhuma categoria orçada ou gasto encontrado para o período.
      </div>
    )
  }

  const totalBudgeted = rows.reduce((s, r) => s + r.budgeted, 0)
  const totalActual = rows.reduce((s, r) => s + r.actual, 0) + uncategorizedActual
  const totalDiff = totalBudgeted - totalActual
  const totalPct = totalBudgeted > 0 ? (totalActual / totalBudgeted) * 100 : null

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Categoria</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Orçado</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Realizado</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Progresso</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Diferença R$</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Diferença %</th>
              <th className="px-4 py-3 text-center font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => {
              const pct = getPct(row.budgeted, row.actual)
              const diff = row.budgeted - row.actual
              const diffPct = row.budgeted > 0 ? (row.actual / row.budgeted) * 100 : null

              return (
                <tr key={row.categoryId} className="hover:bg-muted/20 transition-colors">
                  {/* Categoria */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-xs shrink-0"
                        style={{
                          backgroundColor: `${row.categoryColor}22`,
                          color: row.categoryColor,
                        }}
                      >
                        {row.categoryIcon ?? '?'}
                      </div>
                      <span className="font-medium">{row.categoryName}</span>
                      {row.effectiveSource === 'base' && (
                        <span className="text-[10px] text-muted-foreground border rounded px-1">
                          base
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Orçado — clicável para editar */}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onEdit(row)}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium tabular-nums transition-colors"
                      title="Clique para editar o orçamento"
                    >
                      {row.budgeted > 0 ? brl.format(row.budgeted) : '+ definir'}
                    </button>
                  </td>

                  {/* Realizado */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {brl.format(row.actual)}
                  </td>

                  {/* Progresso */}
                  <td className="px-4 py-3">
                    <ProgressBar pct={pct} />
                  </td>

                  {/* Diferença R$ */}
                  <td
                    className={`px-4 py-3 text-right tabular-nums font-medium ${
                      row.budgeted === 0
                        ? 'text-muted-foreground'
                        : diff >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {row.budgeted === 0 ? '—' : brl.format(diff)}
                  </td>

                  {/* Diferença % */}
                  <td
                    className={`px-4 py-3 text-right tabular-nums ${
                      diffPct === null
                        ? 'text-muted-foreground'
                        : diffPct >= 100
                        ? 'text-red-600'
                        : diffPct >= 80
                        ? 'text-yellow-600'
                        : 'text-green-600'
                    }`}
                  >
                    {diffPct === null ? '—' : `${diffPct.toFixed(1)}%`}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    <StatusBadge pct={pct} />
                  </td>
                </tr>
              )
            })}

            {/* Linha "Sem categoria" — gastos sem category_id, somente realizado */}
            {uncategorizedActual > 0 && (
              <tr className="bg-muted/10">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full flex items-center justify-center text-xs bg-muted text-muted-foreground shrink-0">
                      ?
                    </div>
                    <span className="italic text-muted-foreground">Sem categoria</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                <td className="px-4 py-3 text-right tabular-nums">{brl.format(uncategorizedActual)}</td>
                <td className="px-4 py-3">
                  <span className="text-xs text-muted-foreground">Não orçável</span>
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                <td className="px-4 py-3 text-right text-muted-foreground">—</td>
                <td className="px-4 py-3 text-center text-muted-foreground">—</td>
              </tr>
            )}

            {/* Linha de totais */}
            <tr className="border-t-2 bg-muted/10 font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right tabular-nums text-blue-600">
                {brl.format(totalBudgeted)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-red-600">
                {brl.format(totalActual)}
              </td>
              <td className="px-4 py-3">
                <ProgressBar pct={totalPct} />
              </td>
              <td
                className={`px-4 py-3 text-right tabular-nums ${
                  totalDiff >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {brl.format(totalDiff)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                {totalPct !== null ? `${totalPct.toFixed(1)}%` : '—'}
              </td>
              <td className="px-4 py-3" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function BudgetTableSkeleton() {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden animate-pulse">
      <div className="h-10 bg-muted/30 border-b" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-6 px-4 py-3 border-b">
          <div className="flex items-center gap-2 w-40 shrink-0">
            <div className="h-7 w-7 rounded-full bg-muted shrink-0" />
            <div className="h-4 w-24 rounded bg-muted" />
          </div>
          <div className="h-4 w-20 rounded bg-muted ml-auto" />
          <div className="h-4 w-20 rounded bg-muted" />
          <div className="h-2 w-32 rounded bg-muted" />
          <div className="h-4 w-16 rounded bg-muted" />
          <div className="h-4 w-12 rounded bg-muted" />
          <div className="h-4 w-16 rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

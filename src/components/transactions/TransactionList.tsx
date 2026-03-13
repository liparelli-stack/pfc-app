import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { UnifiedTransaction, TransactionFilters } from '@/services/transactions-view.service'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
const PAGE_SIZES = [25, 50, 100, 200]

// Generate last 24 months as "YYYY-MM-01" strings for reference month filter
function getLast24Months(): Array<{ value: string; label: string }> {
  const result = []
  const now = new Date()
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const value = `${y}-${String(m).padStart(2, '0')}-01`
    const label = `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}`
    result.push({ value, label })
  }
  return result
}

const REF_MONTH_OPTIONS = getLast24Months()

function formatRefMonth(value: string | null): string {
  if (!value) return '—'
  const [y, m] = value.split('-')
  return `${MONTHS_SHORT[parseInt(m, 10) - 1]}/${String(y).slice(2)}`
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Math.abs(amount))
}

function typeLabel(type: string | null, source: 'bank' | 'card'): string {
  if (source === 'card') return 'Cartão'
  if (type === 'credit') return 'Crédito'
  if (type === 'debit') return 'Débito'
  return '—'
}

function CategoryBadge({ name, icon, color }: { name: string | null; icon: string | null; color: string | null }) {
  if (!name) {
    return (
      <Badge variant="secondary" className="text-xs font-normal">
        Sem categoria
      </Badge>
    )
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: color ? `${color}22` : '#94a3b822',
        color: color ?? '#64748b',
        border: `1px solid ${color ? `${color}55` : '#94a3b855'}`,
      }}
    >
      {icon && <span>{icon}</span>}
      {name}
    </span>
  )
}

// ─── Paginator ────────────────────────────────────────────────────────────────

function getPageNumbers(current: number, total: number): Array<number | null> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, null, total]
  if (current >= total - 3) return [1, null, total - 4, total - 3, total - 2, total - 1, total]
  return [1, null, current - 1, current, current + 1, null, total]
}

function Paginator({
  page,
  totalPages,
  onPageChange,
}: {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
}) {
  if (totalPages <= 1) return null

  const pages = getPageNumbers(page, totalPages)

  return (
    <div className="flex items-center justify-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onPageChange(1)}
        disabled={page === 1}
        title="Primeira"
      >
        <ChevronFirst className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        title="Anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {pages.map((p, i) =>
        p === null ? (
          <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-sm select-none">
            …
          </span>
        ) : (
          <Button
            key={p}
            variant={p === page ? 'default' : 'outline'}
            size="icon"
            className="h-8 w-8 text-sm"
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        )
      )}

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        title="Próxima"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => onPageChange(totalPages)}
        disabled={page === totalPages}
        title="Última"
      >
        <ChevronLast className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ─── TransactionList ──────────────────────────────────────────────────────────

interface TransactionListProps {
  transactions: UnifiedTransaction[]
  filters: TransactionFilters
  loading: boolean
  total: number
  page: number
  pageSize: number
  onFilterChange: (filters: TransactionFilters) => void
  onEdit: (transaction: UnifiedTransaction) => void
  onReclassify: () => void
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  reclassifying: boolean
}

export function TransactionList({
  transactions,
  filters,
  loading,
  total,
  page,
  pageSize,
  onFilterChange,
  onEdit,
  onReclassify,
  onPageChange,
  onPageSizeChange,
  reclassifying,
}: TransactionListProps) {
  function setFilter<K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) {
    onFilterChange({ ...filters, [key]: value })
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const firstItem = total === 0 ? 0 : (page - 1) * pageSize + 1
  const lastItem = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col gap-4">
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={String(filters.month)}
          onValueChange={(v) => setFilter('month', parseInt(v, 10))}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((label, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(filters.year)}
          onValueChange={(v) => setFilter('year', parseInt(v, 10))}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.source}
          onValueChange={(v) => setFilter('source', v as TransactionFilters['source'])}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="bank">Banco</SelectItem>
            <SelectItem value="card">Cartão</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.classified}
          onValueChange={(v) => setFilter('classified', v as TransactionFilters['classified'])}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="classified">Classificadas</SelectItem>
            <SelectItem value="unclassified">Não classificadas</SelectItem>
          </SelectContent>
        </Select>

        {/* Reference month filter */}
        <Select
          value={filters.referenceMonth ?? 'all'}
          onValueChange={(v) => setFilter('referenceMonth', v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Mês Ref." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mês Ref.: Todos</SelectItem>
            {REF_MONTH_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Right side: page size + reclassify */}
        <div className="ml-auto flex items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(parseInt(v, 10))}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s} / pág.
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={onReclassify}
            disabled={reclassifying || loading}
          >
            {reclassifying ? 'Reclassificando…' : 'Reclassificar tudo'}
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Carregando…</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed py-16">
          <p className="text-sm text-muted-foreground">Nenhuma transação encontrada.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Data</TableHead>
                <TableHead className="w-20">Mês Ref.</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-20">Tipo</TableHead>
                <TableHead className="w-28 text-right">Valor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => {
                const isExpense = t.source === 'card' ? t.amount >= 0 : t.type === 'debit'
                return (
                  <TableRow key={`${t.source}-${t.id}`}>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {formatDate(t.date)}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {formatRefMonth(t.reference_month)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">
                          {t.source === 'bank' ? '🏦' : '💳'}
                        </span>
                        {t.origin_name}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm max-w-[220px] truncate" title={t.description}>
                      {t.description}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {typeLabel(t.type, t.source)}
                    </TableCell>
                    <TableCell
                      className={`text-sm tabular-nums text-right font-medium ${
                        isExpense ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {isExpense ? '- ' : '+ '}
                      {formatAmount(t.amount)}
                    </TableCell>
                    <TableCell>
                      <CategoryBadge
                        name={t.category_name}
                        icon={t.category_icon}
                        color={t.category_color}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(t)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Footer: summary + paginator */}
      {!loading && total > 0 && (
        <div className="flex flex-col items-center gap-3">
          <Paginator page={page} totalPages={totalPages} onPageChange={onPageChange} />
          <p className="text-xs text-muted-foreground">
            Exibindo {firstItem}–{lastItem} de {total} transaç{total === 1 ? 'ão' : 'ões'}
          </p>
        </div>
      )}
    </div>
  )
}

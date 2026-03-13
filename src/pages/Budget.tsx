import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Copy, LayoutGrid } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { BudgetKPICards, BudgetKPICardsSkeleton } from '@/components/budget/BudgetKPICards'
import { BudgetTable, BudgetTableSkeleton } from '@/components/budget/BudgetTable'
import { BudgetChart, BudgetChartSkeleton } from '@/components/budget/BudgetChart'
import { BudgetForm } from '@/components/budget/BudgetForm'
import { BudgetMatrix } from '@/components/budget/BudgetMatrix'
import {
  fetchBudgetData,
  upsertBudget,
  copyBaseToMonth,
  type BudgetData,
  type BudgetRow,
  type BudgetUpsertInput,
} from '@/services/budget.service'
import { fetchCategories, type Category } from '@/services/categories.service'
import { getLastNMonths, formatMonthLabel } from '@/services/dashboard.service'

// ── Month helpers ─────────────────────────────────────────────────────────────

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function getMonthOptions(): Array<{ value: string; label: string }> {
  const current = getCurrentMonth()
  const months = getLastNMonths(current, 24).reverse()
  return months.map((m) => ({ value: m, label: formatMonthLabel(m) }))
}

const MONTH_OPTIONS = getMonthOptions()

// ── Page ──────────────────────────────────────────────────────────────────────

export function Budget() {
  const [month, setMonth] = useState<string>(getCurrentMonth)
  const [data, setData] = useState<BudgetData | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [copying, setCopying] = useState(false)
  const [saving, setSaving] = useState(false)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editRow, setEditRow] = useState<BudgetRow | null>(null)
  const [matrixOpen, setMatrixOpen] = useState(false)

  // Categories loaded once on mount
  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => {}) // non-critical
  }, [])

  // Budget data reloaded whenever the month changes
  useEffect(() => {
    loadBudgetData(month)
  }, [month])

  async function loadBudgetData(m: string) {
    setLoading(true)
    try {
      setData(await fetchBudgetData(m))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar orçamento.')
    } finally {
      setLoading(false)
    }
  }

  function openEdit(row: BudgetRow) {
    setEditRow(row)
    setSheetOpen(true)
  }

  function openAdd() {
    setEditRow(null)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setEditRow(null)
  }

  async function handleSave(input: BudgetUpsertInput) {
    setSaving(true)
    try {
      await upsertBudget(input)
      toast.success('Orçamento salvo.')
      closeSheet()
      await loadBudgetData(month)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar orçamento.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCopyBase() {
    setCopying(true)
    try {
      const count = await copyBaseToMonth(month)
      if (count === 0) {
        toast.info('Nenhuma categoria nova para copiar. Ajustes pontuais já existem para todas as categorias base.')
      } else {
        const plural = count !== 1
        toast.success(`${count} categoria${plural ? 's' : ''} copiada${plural ? 's' : ''} do orçamento base.`)
        await loadBudgetData(month)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao copiar orçamento base.')
    } finally {
      setCopying(false)
    }
  }

  // Categories not yet budgeted — used in the "add" dropdown
  const budgetedCatIds = new Set(
    data?.rows
      .filter((r) => r.hasBudget && r.categoryId !== null)
      .map((r) => r.categoryId!) ?? [],
  )
  const availableCategories = categories.filter((c) => !budgetedCatIds.has(c.id))

  const hasRows = (data?.rows.length ?? 0) > 0 || (data?.uncategorizedActual ?? 0) > 0

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold">Orçamento</h2>
          <p className="text-sm text-muted-foreground">
            Compare o planejado com o realizado por categoria.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          <span className="text-sm text-muted-foreground">Mês:</span>
          <Select value={month} onValueChange={setMonth}>
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

          <Button
            variant="outline"
            size="sm"
            onClick={() => setMatrixOpen(true)}
            disabled={loading}
          >
            <LayoutGrid className="h-4 w-4 mr-1.5" />
            Planejar Período
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyBase}
            disabled={copying || loading}
          >
            <Copy className="h-4 w-4 mr-1.5" />
            {copying ? 'Copiando…' : 'Copiar base'}
          </Button>

          <Button size="sm" onClick={openAdd} disabled={loading}>
            + Adicionar categoria
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <BudgetKPICardsSkeleton />
      ) : data ? (
        <BudgetKPICards summary={data.summary} />
      ) : null}

      {/* Empty state */}
      {!loading && !hasRows && (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
          Nenhum orçamento definido para <strong>{formatMonthLabel(month)}</strong>.
          <br />
          Clique em <strong>+ Adicionar categoria</strong> para definir valores,
          ou em <strong>Copiar base</strong> para aproveitar o orçamento padrão.
        </div>
      )}

      {/* Table */}
      {loading ? (
        <BudgetTableSkeleton />
      ) : hasRows ? (
        <BudgetTable
          rows={data!.rows}
          uncategorizedActual={data!.uncategorizedActual}
          onEdit={openEdit}
        />
      ) : null}

      {/* Chart */}
      {loading ? (
        <BudgetChartSkeleton />
      ) : hasRows ? (
        <BudgetChart rows={data!.rows} />
      ) : null}

      {/* Matrix planning dialog */}
      <BudgetMatrix
        open={matrixOpen}
        onClose={() => setMatrixOpen(false)}
        onSaved={() => loadBudgetData(month)}
      />

      {/* Sheet form — individual category */}
      <BudgetForm
        open={sheetOpen}
        row={editRow}
        categories={availableCategories}
        selectedMonth={month}
        loading={saving}
        onSubmit={handleSave}
        onClose={closeSheet}
      />
    </div>
  )
}

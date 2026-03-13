import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { TransactionList } from '@/components/transactions/TransactionList'
import { TransactionForm } from '@/components/transactions/TransactionForm'
import {
  fetchTransactions,
  updateTransaction,
  reclassifyPeriod,
  type UnifiedTransaction,
  type TransactionFilters,
  type TransactionUpdate,
} from '@/services/transactions-view.service'
import { fetchCategories, type Category } from '@/services/categories.service'

const DEFAULT_PAGE_SIZE = 50

function defaultFilters(): TransactionFilters {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    source: 'all',
    classified: 'all',
    referenceMonth: null,
  }
}

export function Transactions() {
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [filters, setFilters] = useState<TransactionFilters>(defaultFilters)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<UnifiedTransaction | null>(null)
  const [saving, setSaving] = useState(false)
  const [reclassifying, setReclassifying] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    loadTransactions(filters, page, pageSize)
  }, [filters, page, pageSize])

  async function loadCategories() {
    try {
      setCategories(await fetchCategories())
    } catch {
      // non-critical
    }
  }

  async function loadTransactions(
    f: TransactionFilters,
    p: number,
    ps: number,
  ) {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchTransactions(f, p, ps)
      setTransactions(result.data)
      setTotal(result.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar transações.')
    } finally {
      setLoading(false)
    }
  }

  function handleFilterChange(newFilters: TransactionFilters) {
    setPage(1)
    setFilters(newFilters)
  }

  function handlePageSizeChange(size: number) {
    setPage(1)
    setPageSize(size)
  }

  function openEdit(transaction: UnifiedTransaction) {
    setSelectedTransaction(transaction)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setSelectedTransaction(null)
  }

  async function handleSubmit(
    id: string,
    source: 'bank' | 'card',
    updates: TransactionUpdate,
  ) {
    setSaving(true)
    try {
      const updated = await updateTransaction(id, source, updates)
      setTransactions((prev) =>
        prev.map((t) => (t.id === id && t.source === source ? updated : t))
      )
      toast.success('Transação atualizada.')
      closeSheet()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar transação.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReclassify() {
    setReclassifying(true)
    try {
      const summary = await reclassifyPeriod({
        year: filters.year,
        month: filters.month,
        source: filters.source,
      })
      toast.success(
        `${summary.classified} de ${summary.total} transaç${summary.total === 1 ? 'ão classificada' : 'ões classificadas'}.`
      )
      // Go back to page 1 and reload
      setPage(1)
      await loadTransactions(filters, 1, pageSize)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao reclassificar.')
    } finally {
      setReclassifying(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Transações</h2>
        <p className="text-sm text-muted-foreground">
          Visualize e edite suas transações de banco e cartão.
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <TransactionList
        transactions={transactions}
        filters={filters}
        loading={loading}
        total={total}
        page={page}
        pageSize={pageSize}
        onFilterChange={handleFilterChange}
        onEdit={openEdit}
        onReclassify={handleReclassify}
        onPageChange={setPage}
        onPageSizeChange={handlePageSizeChange}
        reclassifying={reclassifying}
      />

      <TransactionForm
        open={sheetOpen}
        transaction={selectedTransaction}
        categories={categories}
        loading={saving}
        onSubmit={handleSubmit}
        onClose={closeSheet}
      />
    </div>
  )
}

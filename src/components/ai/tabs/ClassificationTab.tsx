import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { fetchCategories, type Category } from '@/services/categories.service'
import { fetchPeriodTransactions, type PeriodTransaction } from '@/services/analysis.service'
import { classifyAndSaveTransactions, type ClassificationSummary } from '@/services/classification.service'
import { formatMonthLabel } from '@/services/dashboard.service'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ClassificationTabProps {
  periodStart: string
  periodEnd: string
}

// ─── ClassificationTab ────────────────────────────────────────────────────────

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function ClassificationTab({ periodStart, periodEnd }: ClassificationTabProps) {
  const [loading, setLoading]           = useState(false)
  const [classifying, setClassifying]   = useState(false)
  const [transactions, setTransactions] = useState<PeriodTransaction[]>([])
  const [categories, setCategories]     = useState<Category[]>([])
  const [overrides, setOverrides]       = useState<Record<string, string>>({})
  const [saving, setSaving]             = useState<Set<string>>(new Set())

  async function load() {
    setLoading(true)
    try {
      const [txns, cats] = await Promise.all([
        fetchPeriodTransactions(periodStart, periodEnd),
        fetchCategories(),
      ])
      setTransactions(txns.filter((t) => t.category_id === null))
      setCategories(cats)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar transações.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [periodStart, periodEnd])

  async function handleAutoClassify() {
    setClassifying(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado.')

      const bankTxns = transactions.filter((t) => t.source === 'bank')
      const cardTxns = transactions.filter((t) => t.source === 'card')

      const results: ClassificationSummary[] = await Promise.all([
        bankTxns.length > 0
          ? classifyAndSaveTransactions(bankTxns, 'bank_transactions', user.id)
          : Promise.resolve({ total: 0, classified: 0, unclassified: 0, avgConfidence: 0 }),
        cardTxns.length > 0
          ? classifyAndSaveTransactions(cardTxns, 'card_transactions', user.id)
          : Promise.resolve({ total: 0, classified: 0, unclassified: 0, avgConfidence: 0 }),
      ])

      const total      = results.reduce((s, r) => s + r.total, 0)
      const classified = results.reduce((s, r) => s + r.classified, 0)
      toast.success(
        `${classified} de ${total} transação${total !== 1 ? 'ões' : ''} classificada${classified !== 1 ? 's' : ''} automaticamente.`,
      )
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro na classificação automática.')
    } finally {
      setClassifying(false)
    }
  }

  async function handleManualOverride(txn: PeriodTransaction, categoryId: string) {
    setOverrides((prev) => ({ ...prev, [txn.id]: categoryId }))
    setSaving((prev) => new Set(prev).add(txn.id))

    try {
      const table = txn.source === 'bank' ? 'bank_transactions' : 'card_transactions'
      const { error } = await supabase.from(table).update({ category_id: categoryId }).eq('id', txn.id)
      if (error) throw new Error(error.message)
      toast.success('Categoria aplicada.')
      setTransactions((prev) => prev.filter((t) => t.id !== txn.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar categoria.')
      setOverrides((prev) => { const n = { ...prev }; delete n[txn.id]; return n })
    } finally {
      setSaving((prev) => { const n = new Set(prev); n.delete(txn.id); return n })
    }
  }

  return (
    <div className="space-y-5">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Período: <strong>{formatMonthLabel(periodStart)}</strong> →{' '}
          <strong>{formatMonthLabel(periodEnd)}</strong>
          {!loading && (
            <span className="ml-2">
              — <strong>{transactions.length}</strong> sem categoria
            </span>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading || classifying}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={handleAutoClassify}
            disabled={classifying || loading || transactions.length === 0}
          >
            <CheckCheck className="h-4 w-4 mr-1.5" />
            {classifying ? 'Classificando…' : 'Classificar automaticamente'}
          </Button>
        </div>
      </div>

      {/* Skeleton */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      )}

      {/* Table */}
      {!loading && transactions.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Data</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Descrição</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Valor</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Origem</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Categoria</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {new Date(txn.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-2.5 max-w-xs">
                      <span className="truncate block" title={txn.description}>
                        {txn.description}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {brl.format(txn.amount)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        txn.source === 'bank'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
                      }`}>
                        {txn.source === 'bank' ? 'Banco' : 'Cartão'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 w-44">
                      <Select
                        value={overrides[txn.id] ?? ''}
                        onValueChange={(v) => handleManualOverride(txn, v)}
                        disabled={saving.has(txn.id)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecionar…" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              {c.icon} {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && transactions.length === 0 && (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
          <CheckCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium">Todas as transações do período estão classificadas.</p>
        </div>
      )}
    </div>
  )
}

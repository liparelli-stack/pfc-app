import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RefreshCw, CheckCheck, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { fetchCategories, type Category } from '@/services/categories.service'
import {
  fetchPeriodTransactions,
  buildClassificationPrompt,
  type PeriodTransaction,
} from '@/services/analysis.service'
import { callLLM, type LLMProvider } from '@/services/llm.service'
import { formatMonthLabel } from '@/services/dashboard.service'

// ─── Props ────────────────────────────────────────────────────────────────────

interface ClassificationTabProps {
  provider: LLMProvider | null
  apiKey: string | null
  periodStart: string
  periodEnd: string
}

// ─── LLM suggestion row ───────────────────────────────────────────────────────

interface LLMSuggestion {
  id: string
  category: string       // category name returned by LLM
  categoryId: string | null  // resolved after matching with DB categories
  confidence: number
  reason: string
  selected: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function confidenceBadge(c: number) {
  const pct = Math.round(c * 100)
  const color =
    c >= 0.85 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : c >= 0.60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{pct}%</span>
}

// ─── ClassificationTab ────────────────────────────────────────────────────────

export function ClassificationTab({
  provider,
  apiKey,
  periodStart,
  periodEnd,
}: ClassificationTabProps) {
  const [loading, setLoading]           = useState(false)
  const [transactions, setTransactions] = useState<PeriodTransaction[]>([])
  const [categories, setCategories]     = useState<Category[]>([])

  // LLM suggestion state
  const [classifying, setClassifying]   = useState(false)
  const [suggestions, setSuggestions]   = useState<LLMSuggestion[]>([])
  const [applying, setApplying]         = useState(false)

  // Manual override state (per txn)
  const [saving, setSaving]             = useState<Set<string>>(new Set())

  // ── Load ──────────────────────────────────────────────────────────────────

  async function load() {
    setLoading(true)
    setSuggestions([])
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

  // ── LLM classify ─────────────────────────────────────────────────────────

  async function handleClassifyWithAI() {
    if (!provider || !apiKey) {
      toast.error('Configure e selecione um provedor de IA.')
      return
    }
    if (transactions.length === 0) return

    setClassifying(true)
    setSuggestions([])

    try {
      const catNames = categories.map((c) => c.name)
      const prompt = buildClassificationPrompt(transactions, catNames)

      const raw = await callLLM(provider, apiKey, [{ role: 'user', content: prompt }])

      const clean = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
      let parsed: { classifications: Array<{ id: string; category: string; confidence: number; reason: string }> } = {
        classifications: [],
      }
      try {
        parsed = JSON.parse(clean)
      } catch {
        toast.error('A IA retornou uma resposta inválida. Tente novamente.')
        return
      }

      // Build a name→id map for fast lookup
      const nameToId = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]))

      const items: LLMSuggestion[] = (parsed.classifications ?? []).map((c) => ({
        id:         c.id,
        category:   c.category,
        categoryId: nameToId.get(c.category.toLowerCase()) ?? null,
        confidence: c.confidence ?? 0,
        reason:     c.reason ?? '',
        selected:   true,
      }))

      setSuggestions(items)

      if (items.length === 0) {
        toast.info('A IA não retornou sugestões.')
      } else {
        toast.success(`${items.length} sugestão${items.length !== 1 ? 'ões' : ''} recebida${items.length !== 1 ? 's' : ''}.`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao classificar com IA.')
    } finally {
      setClassifying(false)
    }
  }

  // ── Apply selected ────────────────────────────────────────────────────────

  async function handleApplySelected() {
    const toApply = suggestions.filter((s) => s.selected && s.categoryId)
    if (toApply.length === 0) {
      toast.info('Nenhuma sugestão selecionada ou com categoria válida.')
      return
    }

    setApplying(true)
    let applied = 0
    let errors  = 0

    for (const s of toApply) {
      const txn = transactions.find((t) => t.id === s.id)
      if (!txn || !s.categoryId) continue

      const table = txn.source === 'bank' ? 'bank_transactions' : 'card_transactions'
      const { error } = await supabase
        .from(table)
        .update({ category_id: s.categoryId })
        .eq('id', s.id)

      if (error) errors++
      else applied++
    }

    if (applied > 0) {
      toast.success(`${applied} transaç${applied !== 1 ? 'ões classificadas' : 'ão classificada'}.`)
    }
    if (errors > 0) {
      toast.error(`${errors} erro${errors !== 1 ? 's' : ''} ao salvar.`)
    }

    setApplying(false)
    await load()
  }

  // ── Manual override ───────────────────────────────────────────────────────

  async function handleManualOverride(txn: PeriodTransaction, categoryId: string) {
    setSaving((prev) => new Set(prev).add(txn.id))
    try {
      const table = txn.source === 'bank' ? 'bank_transactions' : 'card_transactions'
      const { error } = await supabase.from(table).update({ category_id: categoryId }).eq('id', txn.id)
      if (error) throw new Error(error.message)
      toast.success('Categoria aplicada.')
      setTransactions((prev) => prev.filter((t) => t.id !== txn.id))
      setSuggestions((prev) => prev.filter((s) => s.id !== txn.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar categoria.')
    } finally {
      setSaving((prev) => { const n = new Set(prev); n.delete(txn.id); return n })
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const selectedCount = suggestions.filter((s) => s.selected && s.categoryId).length
  const hasSuggestions = suggestions.length > 0

  // Build a map for quick txn lookup in suggestion table
  const txnMap = new Map(transactions.map((t) => [t.id, t]))

  // ─── Render ───────────────────────────────────────────────────────────────

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
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={load} disabled={loading || classifying || applying}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={handleClassifyWithAI}
            disabled={classifying || loading || applying || transactions.length === 0}
          >
            {classifying
              ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Classificando…</>
              : <><Sparkles className="h-4 w-4 mr-1.5" />Classificar com IA</>
            }
          </Button>
          {hasSuggestions && (
            <Button
              size="sm"
              variant="default"
              onClick={handleApplySelected}
              disabled={applying || selectedCount === 0}
            >
              {applying
                ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Aplicando…</>
                : <><CheckCheck className="h-4 w-4 mr-1.5" />Aplicar selecionadas ({selectedCount})</>
              }
            </Button>
          )}
        </div>
      </div>

      {/* Skeleton */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      )}

      {/* LLM suggestion preview */}
      {!loading && hasSuggestions && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
            <h3 className="font-semibold text-sm">Sugestões da IA — revise e selecione</h3>
            <div className="flex gap-2 text-xs">
              <button
                className="text-primary underline"
                onClick={() => setSuggestions((prev) => prev.map((s) => ({ ...s, selected: true })))}
              >
                Selecionar todos
              </button>
              <span className="text-muted-foreground">·</span>
              <button
                className="text-muted-foreground underline"
                onClick={() => setSuggestions((prev) => prev.map((s) => ({ ...s, selected: false })))}
              >
                Desmarcar todos
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="px-3 py-2 w-8" />
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Descrição</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Valor</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Categoria sugerida</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Razão</th>
                  <th className="px-4 py-2 text-center font-medium text-muted-foreground">Confiança</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {suggestions.map((s) => {
                  const txn = txnMap.get(s.id)
                  return (
                    <tr
                      key={s.id}
                      className={`transition-colors cursor-pointer ${s.selected ? 'bg-primary/5' : 'hover:bg-muted/10'}`}
                      onClick={() =>
                        setSuggestions((prev) =>
                          prev.map((x) => x.id === s.id ? { ...x, selected: !x.selected } : x)
                        )
                      }
                    >
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={s.selected}
                          onCheckedChange={(v) =>
                            setSuggestions((prev) =>
                              prev.map((x) => x.id === s.id ? { ...x, selected: !!v } : x)
                            )
                          }
                        />
                      </td>
                      <td className="px-4 py-2.5 max-w-xs">
                        <span className="truncate block" title={txn?.description}>
                          {txn?.description ?? s.id}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {txn?.date} · {txn?.source === 'bank' ? 'Banco' : 'Cartão'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium whitespace-nowrap">
                        {txn ? brl.format(txn.amount) : '—'}
                      </td>
                      <td className="px-4 py-2.5">
                        {s.categoryId ? (
                          <span className="font-medium">{s.category}</span>
                        ) : (
                          <span className="text-red-500 text-xs">
                            {s.category} <span className="text-muted-foreground">(não encontrada)</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-xs">
                        {s.reason}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {confidenceBadge(s.confidence)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unclassified transactions table */}
      {!loading && transactions.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <h3 className="font-semibold text-sm">
              {hasSuggestions ? 'Classificação manual' : 'Transações sem categoria'}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
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
                      {new Date(txn.date + 'T00:00:00').toLocaleDateString('pt-BR')}
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
                        value=""
                        onValueChange={(v) => handleManualOverride(txn, v)}
                        disabled={saving.has(txn.id)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder={saving.has(txn.id) ? 'Salvando…' : 'Selecionar…'} />
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

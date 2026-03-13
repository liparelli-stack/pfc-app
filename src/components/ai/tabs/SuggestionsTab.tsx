import { useState } from 'react'
import { toast } from 'sonner'
import { Lightbulb, Loader2, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { callLLM, type LLMProvider } from '@/services/llm.service'
import {
  fetchPeriodTransactions,
  buildSuggestionsPrompt,
  buildSummary,
  saveAnalysisPending,
  updateAnalysis,
  type AnalysisSuggestion,
} from '@/services/analysis.service'
import { formatMonthLabel } from '@/services/dashboard.service'

// ─── Props ────────────────────────────────────────────────────────────────────

interface SuggestionsTabProps {
  provider: LLMProvider | null
  apiKey: string | null
  llmConfigId: string | null
  periodStart: string
  periodEnd: string
}

// ─── Difficulty badge ─────────────────────────────────────────────────────────

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const variants: Record<string, string> = {
    'Fácil':  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'Média':  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    'Difícil':'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${variants[difficulty] ?? 'bg-muted text-muted-foreground'}`}>
      {difficulty}
    </span>
  )
}

// ─── Suggestion card ──────────────────────────────────────────────────────────

function SuggestionCard({ suggestion, index }: { suggestion: AnalysisSuggestion; index: number }) {
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="rounded-xl border bg-card shadow-sm p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
            {index + 1}
          </span>
          <h4 className="font-semibold text-sm leading-tight">{suggestion.title}</h4>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DifficultyBadge difficulty={suggestion.difficulty} />
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">{suggestion.description}</p>

      {suggestion.savings > 0 && (
        <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-sm font-medium">
          <TrendingDown className="h-3.5 w-3.5" />
          Economia potencial: {brl.format(suggestion.savings)}/mês
        </div>
      )}
    </div>
  )
}

// ─── SuggestionsTab ───────────────────────────────────────────────────────────

export function SuggestionsTab({
  provider,
  apiKey,
  llmConfigId,
  periodStart,
  periodEnd,
}: SuggestionsTabProps) {
  const [generating, setGenerating]     = useState(false)
  const [suggestions, setSuggestions]   = useState<AnalysisSuggestion[]>([])
  const [currentId, setCurrentId]       = useState<string | null>(null)

  async function handleGenerate() {
    if (!provider || !apiKey) {
      toast.error('Configure e selecione um provedor de IA.')
      return
    }
    if (!llmConfigId) {
      toast.error('Salve a API key do provedor selecionado primeiro.')
      return
    }

    setGenerating(true)
    setSuggestions([])
    setCurrentId(null)

    try {
      const transactions = await fetchPeriodTransactions(periodStart, periodEnd)

      if (transactions.length === 0) {
        toast.info('Nenhuma transação encontrada no período selecionado.')
        setGenerating(false)
        return
      }

      const { total, count } = buildSummary(transactions)
      const prompt = buildSuggestionsPrompt(transactions, periodStart, periodEnd)

      const analysisId = await saveAnalysisPending({
        llm_config_id:     llmConfigId,
        source_type:       'both',
        period_from:       periodStart,
        period_to:         periodEnd,
        prompt_text:       prompt,
        transaction_count: count,
        total_amount:      total,
      })
      setCurrentId(analysisId)

      const raw = await callLLM(provider, apiKey, [{ role: 'user', content: prompt }])

      // Strip markdown code fences if present
      const clean = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
      let parsed: { suggestions: AnalysisSuggestion[] } = { suggestions: [] }
      try {
        parsed = JSON.parse(clean)
      } catch {
        // LLM returned non-JSON — show as a single suggestion
        parsed = {
          suggestions: [{
            title: 'Sugestões do assistente',
            description: raw,
            savings: 0,
            difficulty: 'Média',
          }],
        }
      }

      const items = parsed.suggestions ?? []
      setSuggestions(items)

      await updateAnalysis(analysisId, {
        suggestions: items,
        status:      'completed',
      })

      toast.success(`${items.length} sugestão${items.length !== 1 ? 'ões' : ''} gerada${items.length !== 1 ? 's' : ''}.`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao gerar sugestões.'
      toast.error(msg)
      if (currentId) {
        await updateAnalysis(currentId, { status: 'error', error_message: msg }).catch(() => {})
      }
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Período: <strong>{formatMonthLabel(periodStart)}</strong> →{' '}
          <strong>{formatMonthLabel(periodEnd)}</strong>
        </p>
        <Button size="sm" onClick={handleGenerate} disabled={generating}>
          {generating
            ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Gerando…</>
            : <><Lightbulb className="h-4 w-4 mr-1.5" />Gerar sugestões</>
          }
        </Button>
      </div>

      {/* Skeleton */}
      {generating && (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border p-4 space-y-3 animate-pulse">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {suggestions.length > 0 && !generating && (
        <>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{suggestions.length} sugestões</Badge>
            <span>·</span>
            <span className="text-xs">
              Economia total estimada:{' '}
              <strong className="text-foreground">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
                  .format(suggestions.reduce((s, r) => s + (r.savings ?? 0), 0))}
                /mês
              </strong>
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {suggestions.map((s, i) => (
              <SuggestionCard key={i} suggestion={s} index={i} />
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {suggestions.length === 0 && !generating && (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
          <Lightbulb className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-medium">Nenhuma sugestão gerada ainda.</p>
          <p className="text-xs mt-1">
            Selecione o período e clique em <strong>Gerar sugestões</strong>.
          </p>
        </div>
      )}
    </div>
  )
}

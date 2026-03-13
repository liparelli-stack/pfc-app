import { useState } from 'react'
import { toast } from 'sonner'
import { Search, AlertTriangle, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { callLLM, type LLMProvider } from '@/services/llm.service'
import {
  fetchPeriodTransactions,
  buildAnalysisPrompt,
  buildSummary,
  saveAnalysisPending,
  updateAnalysis,
  fetchAnalysisHistory,
  type PeriodTransaction,
  type AnalysisRecord,
} from '@/services/analysis.service'
import { formatMonthLabel } from '@/services/dashboard.service'

// ─── Props ────────────────────────────────────────────────────────────────────

interface AnalysisTabProps {
  provider: LLMProvider | null
  apiKey: string | null
  llmConfigId: string | null
  periodStart: string
  periodEnd: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// ─── History row ─────────────────────────────────────────────────────────────

function HistoryRow({
  record,
  onClick,
}: {
  record: AnalysisRecord
  onClick: () => void
}) {
  return (
    <tr
      className="hover:bg-muted/20 transition-colors cursor-pointer border-b"
      onClick={onClick}
    >
      <td className="px-4 py-2 text-sm text-muted-foreground whitespace-nowrap">
        {new Date(record.created_at).toLocaleDateString('pt-BR')}
      </td>
      <td className="px-4 py-2 text-sm">
        {formatMonthLabel(record.period_from)} — {formatMonthLabel(record.period_to)}
      </td>
      <td className="px-4 py-2 text-sm">
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            record.status === 'completed'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : record.status === 'error'
              ? 'bg-red-100 text-red-700'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {record.status}
        </span>
      </td>
      <td className="px-4 py-2 text-sm text-muted-foreground max-w-xs truncate">
        {record.analysis_summary?.slice(0, 80) ?? record.error_message ?? '—'}
      </td>
      <td className="px-4 py-2 text-right">
        <ChevronRight className="h-4 w-4 text-muted-foreground inline" />
      </td>
    </tr>
  )
}

// ─── AnalysisTab ─────────────────────────────────────────────────────────────

export function AnalysisTab({
  provider,
  apiKey,
  llmConfigId,
  periodStart,
  periodEnd,
}: AnalysisTabProps) {
  const [analyzing, setAnalyzing]   = useState(false)
  const [txns, setTxns]             = useState<PeriodTransaction[] | null>(null)
  const [currentId, setCurrentId]   = useState<string | null>(null)
  const [summary, setSummary]       = useState<string | null>(null)
  const [history, setHistory]       = useState<AnalysisRecord[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [historyOpen, setHistoryOpen]     = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<AnalysisRecord | null>(null)

  async function loadHistory() {
    try {
      const h = await fetchAnalysisHistory()
      setHistory(h)
      setHistoryLoaded(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar histórico.')
    }
  }

  async function handleAnalyze() {
    if (!provider || !apiKey) {
      toast.error('Configure e selecione um provedor de IA.')
      return
    }
    if (!llmConfigId) {
      toast.error('Salve a API key do provedor selecionado primeiro.')
      return
    }

    setAnalyzing(true)
    setSummary(null)
    setCurrentId(null)

    try {
      const transactions = await fetchPeriodTransactions(periodStart, periodEnd)
      setTxns(transactions)

      if (transactions.length === 0) {
        toast.info('Nenhuma transação encontrada no período selecionado.')
        setAnalyzing(false)
        return
      }

      const { total, count } = buildSummary(transactions)
      const prompt = buildAnalysisPrompt(transactions, periodStart, periodEnd)

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

      const raw = await callLLM(
        provider,
        apiKey,
        [{ role: 'user', content: prompt }],
      )

      await updateAnalysis(analysisId, {
        analysis_summary: raw,
        status:           'completed',
      })

      setSummary(raw)
      toast.success('Análise concluída.')
      loadHistory()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro durante a análise.'
      toast.error(msg)
      if (currentId) {
        await updateAnalysis(currentId, { status: 'error', error_message: msg }).catch(() => {})
      }
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Período: <strong>{formatMonthLabel(periodStart)}</strong> →{' '}
          <strong>{formatMonthLabel(periodEnd)}</strong>
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setHistoryOpen(!historyOpen); if (!historyLoaded) loadHistory() }}
          >
            {historyOpen ? <ChevronDown className="h-4 w-4 mr-1.5" /> : <ChevronRight className="h-4 w-4 mr-1.5" />}
            Histórico
          </Button>
          <Button
            size="sm"
            onClick={handleAnalyze}
            disabled={analyzing}
          >
            {analyzing
              ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Analisando…</>
              : <><Search className="h-4 w-4 mr-1.5" />Analisar período</>
            }
          </Button>
        </div>
      </div>

      {/* Loading skeleton */}
      {analyzing && (
        <div className="space-y-3 animate-pulse">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      )}

      {/* Analysis result */}
      {summary && !analyzing && (
        <div className="rounded-xl border bg-card shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base">Análise do período</h3>
            {txns && (
              <span className="text-xs text-muted-foreground">
                {txns.length} transações analisadas
              </span>
            )}
          </div>

          <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h3]:text-sm [&_h3]:font-medium [&_ul]:my-2 [&_li]:my-0.5">
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* History section */}
      {historyOpen && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <h3 className="font-semibold text-sm">Histórico de análises</h3>
          </div>

          {!historyLoaded ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : history.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center text-muted-foreground">
              Nenhuma análise salva ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Data</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Período</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Resumo</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {history.map((r) => (
                    <HistoryRow key={r.id} record={r} onClick={() => setSelectedRecord(r)} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* History detail dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={(v) => { if (!v) setSelectedRecord(null) }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Análise — {selectedRecord && formatMonthLabel(selectedRecord.period_from)} a{' '}
              {selectedRecord && formatMonthLabel(selectedRecord.period_to)}
            </DialogTitle>
          </DialogHeader>

          {selectedRecord?.analysis_summary && (
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_h2]:text-base [&_h2]:font-semibold [&_ul]:my-2">
              <ReactMarkdown>{selectedRecord.analysis_summary}</ReactMarkdown>
            </div>
          )}

          {selectedRecord?.alerts && selectedRecord.alerts.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                Alertas
              </h4>
              {selectedRecord.alerts.map((a, i) => (
                <div key={i} className="rounded-lg border bg-yellow-50 dark:bg-yellow-900/10 px-3 py-2 text-sm">
                  <span className="font-medium">{a.category}</span>
                  {a.amount > 0 && <span className="text-muted-foreground ml-2">{brl.format(a.amount)}</span>}
                  <p className="text-muted-foreground mt-0.5">{a.message}</p>
                </div>
              ))}
            </div>
          )}

          {selectedRecord?.error_message && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              {selectedRecord.error_message}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

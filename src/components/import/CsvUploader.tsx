import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, ChevronRight, ChevronLeft, Check, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { fetchBanks, type Bank } from '@/services/banks.service'
import { fetchCards, type Card } from '@/services/cards.service'
import { parseCSV, detectAndDecode, type NormalizedTransaction } from '@/services/import/csv.parser'
import { saveTransactions } from '@/services/transactions.service'
import type { ImportHistory } from '@/services/import-history.service'

type SourceType = 'bank' | 'card'
type Step = 1 | 2 | 3 | 4

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const REF_YEARS = Array.from({ length: 7 }, (_, i) => 2020 + i)

function detectReferenceMonth(rows: NormalizedTransaction[]): { year: number; month: number } {
  if (rows.length === 0) {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  }
  const counts = new Map<string, number>()
  for (const row of rows) {
    const ym = row.date.substring(0, 7)           // "YYYY-MM"
    counts.set(ym, (counts.get(ym) ?? 0) + 1)
  }
  let bestYm = ''
  let bestCount = 0
  for (const [ym, count] of counts) {
    // Tiebreak: most recent month wins (lexicographic desc on "YYYY-MM")
    if (count > bestCount || (count === bestCount && ym > bestYm)) {
      bestYm = ym
      bestCount = count
    }
  }
  const [y, m] = bestYm.split('-')
  return { year: parseInt(y, 10), month: parseInt(m, 10) }
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEP_LABELS = ['Tipo', 'Origem', 'Arquivo', 'Prévia']

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEP_LABELS.map((label, i) => {
        const step = (i + 1) as Step
        const done = current > step
        const active = current === step
        return (
          <div key={step} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  done
                    ? 'bg-primary text-primary-foreground'
                    : active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : step}
              </div>
              <span
                className={`text-sm font-medium ${
                  active ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className="h-px w-8 bg-border" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CsvUploaderProps {
  onImportSuccess: (record: ImportHistory) => void
}

export function CsvUploader({ onImportSuccess }: CsvUploaderProps) {
  const [step, setStep] = useState<Step>(1)
  const [sourceType, setSourceType] = useState<SourceType | null>(null)
  const [banks, setBanks] = useState<Bank[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [selectedName, setSelectedName] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [parsed, setParsed] = useState<NormalizedTransaction[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [refYear, setRefYear] = useState<number>(new Date().getFullYear())
  const [refMonth, setRefMonth] = useState<number>(new Date().getMonth() + 1)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([fetchBanks(), fetchCards()])
      .then(([b, c]) => { setBanks(b); setCards(c) })
      .catch(() => toast.error('Erro ao carregar bancos e cartões.'))
  }, [])

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleSourceType(type: SourceType) {
    setSourceType(type)
    setSelectedId('')
    setSelectedName('')
    setStep(2)
  }

  function handleOriginSelect(id: string) {
    setSelectedId(id)
    if (sourceType === 'bank') {
      setSelectedName(banks.find((b) => b.id === id)?.name ?? '')
    } else {
      const card = cards.find((c) => c.id === id)
      // Prefer the linked bank name for parser routing (more reliable than card nickname)
      setSelectedName(card?.banks?.name ?? card?.name ?? '')
    }
  }

  async function processFile(f: File) {
    setFile(f)
    setParseError(null)
    setParsed([])
    try {
      const content = await detectAndDecode(f)
      const rows = parseCSV(content, sourceType!, selectedId, selectedName)
      if (rows.length === 0) {
        setParseError('Nenhuma transação encontrada. Verifique se o formato do arquivo está correto.')
        return
      }
      const detected = detectReferenceMonth(rows)
      setRefYear(detected.year)
      setRefMonth(detected.month)
      setParsed(rows)
      // Stay on step 3 to let user confirm/edit the reference month
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Erro ao processar o arquivo.')
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) processFile(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    if (f && f.name.endsWith('.csv')) processFile(f)
    else toast.error('Selecione um arquivo .csv válido.')
  }

  async function handleConfirm() {
    setSaving(true)
    const referenceMonth = `${refYear}-${String(refMonth).padStart(2, '0')}-01`
    try {
      const result = await saveTransactions(parsed, referenceMonth, {
        originName: selectedName,
        fileName: file?.name ?? 'arquivo.csv',
      })
      const msg =
        result.skipped > 0
          ? `${result.imported} transações importadas, ${result.skipped} duplicatas ignoradas.`
          : `${result.imported} transações importadas com sucesso.`
      toast.success(msg)
      onImportSuccess(result.importRecord)
      softReset()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar as transações.')
    } finally {
      setSaving(false)
    }
  }

  // Keep sourceType + selectedId/Name; only clear file state
  function softReset() {
    setStep(3)
    setFile(null)
    setParsed([])
    setParseError(null)
    setRefYear(new Date().getFullYear())
    setRefMonth(new Date().getMonth() + 1)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Step 1: Source type ──────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          O que você deseja importar?
        </p>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleSourceType('bank')}
            className="flex flex-col items-center gap-3 rounded-xl border-2 p-8 text-center transition-colors hover:border-primary hover:bg-primary/5"
          >
            <span className="text-3xl">🏦</span>
            <span className="font-medium">Conta bancária</span>
            <span className="text-xs text-muted-foreground">
              Extrato de conta corrente ou poupança
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleSourceType('card')}
            className="flex flex-col items-center gap-3 rounded-xl border-2 p-8 text-center transition-colors hover:border-primary hover:bg-primary/5"
          >
            <span className="text-3xl">💳</span>
            <span className="font-medium">Cartão de crédito</span>
            <span className="text-xs text-muted-foreground">
              Fatura de cartão de crédito
            </span>
          </button>
        </div>
      </div>
    )
  }

  // ── Step 2: Select origin ────────────────────────────────────────────────────

  function renderStep2() {
    const items = sourceType === 'bank' ? banks : cards
    const label = sourceType === 'bank' ? 'banco' : 'cartão'
    const placeholder = sourceType === 'bank' ? 'Selecione um banco' : 'Selecione um cartão'

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          De qual {label} é este extrato?
        </p>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum {label} cadastrado.{' '}
            {sourceType === 'bank'
              ? 'Cadastre um banco em Bancos antes de importar.'
              : 'Cadastre um cartão em Cartões antes de importar.'}
          </div>
        ) : (
          <Select value={selectedId} onValueChange={handleOriginSelect}>
            <SelectTrigger>
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                  {'last_four' in item ? ` (••• ${item.last_four})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    )
  }

  // ── Step 3: File upload + Reference month ────────────────────────────────────

  function renderStep3() {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Selecione o arquivo CSV exportado do seu banco.
        </p>

        {/* Drop zone — only when no file parsed yet */}
        {parsed.length === 0 && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center gap-4 rounded-xl border-2 border-dashed p-12 transition-colors ${
              dragging ? 'border-primary bg-primary/5' : 'hover:border-primary/50 hover:bg-muted/30'
            }`}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-medium">Arraste o arquivo aqui</p>
              <p className="mt-1 text-sm text-muted-foreground">
                ou clique para selecionar — apenas arquivos .csv
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        )}

        {/* File info */}
        {file && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate">{file.name}</span>
            <span className="text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB
            </span>
            {parsed.length > 0 && (
              <span className="text-primary font-medium">{parsed.length} transações</span>
            )}
          </div>
        )}

        {/* Reference month — shown after successful parse */}
        {parsed.length > 0 && (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Mês de referência
            </div>
            <p className="text-xs text-muted-foreground">
              Mês ao qual estas transações pertencem. Detectado automaticamente — corrija se necessário.
            </p>
            <div className="flex gap-3">
              <Select
                value={String(refMonth)}
                onValueChange={(v) => setRefMonth(parseInt(v, 10))}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS_PT.map((label, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(refYear)}
                onValueChange={(v) => setRefYear(parseInt(v, 10))}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REF_YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {parseError && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {parseError}
          </div>
        )}
      </div>
    )
  }

  // ── Step 4: Preview ──────────────────────────────────────────────────────────

  function renderStep4() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{parsed.length}</strong> transações
            encontradas em <strong className="text-foreground">{file?.name}</strong>.
            Revise antes de confirmar.
          </p>
        </div>

        <div className="max-h-96 overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-32 text-right">Valor</TableHead>
                <TableHead className="w-24">Tipo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parsed.map((t, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-sm">
                    {t.date.split('-').reverse().join('/')}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm">
                    {t.description}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {brl.format(t.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.type === 'credit' ? 'default' : 'secondary'}>
                      {t.type === 'credit' ? 'Crédito' : 'Débito'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  // ── Layout ───────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border bg-card p-8 shadow-sm">
      <StepIndicator current={step} />

      <div className="min-h-48">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>

      {/* Navigation */}
      {step > 1 && (
        <div className="mt-8 flex items-center justify-between border-t pt-6">
          <Button
            variant="outline"
            onClick={() => {
              if (step === 4) {
                setStep(3)
                // Keep file + parsed so user sees the reference month panel
              } else if (step === 3) {
                setStep(2)
                setParsed([])
                setFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              } else if (step === 2) {
                setStep(1)
                setSelectedId('')
                setSelectedName('')
              }
            }}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>

          {step === 2 && (
            <Button disabled={!selectedId} onClick={() => setStep(3)}>
              Próximo
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          {step === 3 && parsed.length > 0 && (
            <Button onClick={() => setStep(4)}>
              Prévia
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}

          {step === 4 && (
            <Button onClick={handleConfirm} disabled={saving}>
              {saving ? 'Salvando…' : 'Confirmar importação'}
              {!saving && <Check className="ml-2 h-4 w-4" />}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

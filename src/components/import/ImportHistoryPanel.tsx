import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ImportHistory } from '@/services/import-history.service'

// ─── Formatters ───────────────────────────────────────────────────────────────

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function formatRefMonth(value: string): string {
  const [y, m] = value.split('-')
  return `${MONTHS_SHORT[parseInt(m, 10) - 1]}/${String(y).slice(2)}`
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ─── ImportCard ───────────────────────────────────────────────────────────────

const STATUS_ICON: Record<ImportHistory['status'], string> = {
  success: '✅',
  partial: '⚠️',
  error: '❌',
}

const STATUS_BORDER: Record<ImportHistory['status'], string> = {
  success: 'border-l-green-500',
  partial: 'border-l-yellow-500',
  error: 'border-l-red-500',
}

function ImportCard({
  record,
  highlighted,
  onDeleteRequest,
}: {
  record: ImportHistory
  highlighted: boolean
  onDeleteRequest: (record: ImportHistory) => void
}) {
  return (
    <div
      className={`rounded-lg border bg-card px-4 py-3 ${
        highlighted ? `border-l-4 ${STATUS_BORDER[record.status]}` : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-base leading-none">{STATUS_ICON[record.status]}</span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Line 1: type badge + origin */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs px-1.5 py-0 shrink-0">
              {record.type === 'bank' ? 'Banco' : 'Cartão'}
            </Badge>
            <span className="text-sm font-medium truncate">{record.origin_name}</span>
          </div>

          {/* Line 2: filename */}
          <p className="text-xs text-muted-foreground truncate" title={record.file_name}>
            {record.file_name}
          </p>

          {/* Line 3: ref month + datetime */}
          <p className="text-xs text-muted-foreground">
            {formatRefMonth(record.reference_month)}
            {' · '}
            {formatDateTime(record.created_at)}
          </p>

          {/* Line 4: row counts */}
          <p className="text-xs text-muted-foreground">
            <span className="text-green-600 font-medium">{record.imported_rows}</span> importadas
            {' · '}
            <span className="text-yellow-600 font-medium">{record.duplicate_rows}</span> duplicadas
            {' · '}
            <span className={record.error_rows > 0 ? 'text-red-600 font-medium' : ''}>
              {record.error_rows}
            </span> erros
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onDeleteRequest(record)}
          title="Excluir import e transações"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── ImportHistoryPanel ───────────────────────────────────────────────────────

interface ImportHistoryPanelProps {
  sessionImports: ImportHistory[]
  historyImports: ImportHistory[]
  loadingHistory: boolean
  onDelete: (importId: string) => Promise<void>
}

export function ImportHistoryPanel({
  sessionImports,
  historyImports,
  loadingHistory,
  onDelete,
}: ImportHistoryPanelProps) {
  const sessionTopRef = useRef<HTMLDivElement>(null)
  const [pendingDelete, setPendingDelete] = useState<ImportHistory | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Expose scroll-to-top for parent to call after new import
  // (parent can set a key or use a separate mechanism; we auto-scroll via useEffect in parent)

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await onDelete(pendingDelete.id)
    } finally {
      setDeleting(false)
      setPendingDelete(null)
    }
  }

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* ── Desta sessão ─────────────────────────────────────────── */}
      <div ref={sessionTopRef}>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold">Desta sessão</h3>
          {sessionImports.length > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {sessionImports.length}
            </Badge>
          )}
        </div>

        {sessionImports.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-6 text-center">
            <p className="text-xs text-muted-foreground">
              Nenhum import realizado nesta sessão.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sessionImports.map((r) => (
              <ImportCard
                key={r.id}
                record={r}
                highlighted
                onDeleteRequest={setPendingDelete}
              />
            ))}
          </div>
        )}
      </div>

      <div className="border-t" />

      {/* ── Histórico completo ───────────────────────────────────── */}
      <div className="flex flex-col gap-3 min-h-0">
        <h3 className="text-sm font-semibold shrink-0">Histórico completo</h3>

        {loadingHistory ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : historyImports.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-6 text-center">
            <p className="text-xs text-muted-foreground">Nenhum import anterior.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[480px] pr-1">
            {historyImports.map((r) => (
              <ImportCard
                key={r.id}
                record={r}
                highlighted={false}
                onDeleteRequest={setPendingDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Delete confirmation dialog ───────────────────────────── */}
      <Dialog open={pendingDelete !== null} onOpenChange={(v) => { if (!v) setPendingDelete(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir import</DialogTitle>
            <DialogDescription>
              Tem certeza? Esta ação irá remover permanentemente{' '}
              <strong>{pendingDelete?.imported_rows ?? 0} transação{(pendingDelete?.imported_rows ?? 0) !== 1 ? 'ões' : ''}</strong>{' '}
              vinculadas ao arquivo{' '}
              <strong>{pendingDelete?.file_name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Excluindo…' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

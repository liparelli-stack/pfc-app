import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CsvUploader } from '@/components/import/CsvUploader'
import { ImportHistoryPanel } from '@/components/import/ImportHistoryPanel'
import {
  fetchImportHistory,
  deleteImport,
  type ImportHistory,
} from '@/services/import-history.service'

export function Import() {
  // Timestamp when this page session started — used to split session vs. older imports
  const sessionStartRef = useRef(new Date().toISOString())

  const [sessionImports, setSessionImports] = useState<ImportHistory[]>([])
  const [historyImports, setHistoryImports] = useState<ImportHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  // Ref to the top of the history panel for scrolling after new imports
  const panelTopRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadHistory()
  }, [])

  async function loadHistory() {
    setLoadingHistory(true)
    try {
      const all = await fetchImportHistory()
      const cutoff = sessionStartRef.current
      // Items created before this page load → full history section
      setHistoryImports(all.filter((r) => r.created_at < cutoff))
      // Items created after page load (e.g. from a previous open tab) → session section
      const alreadySession = all.filter((r) => r.created_at >= cutoff)
      if (alreadySession.length > 0) setSessionImports(alreadySession)
    } catch {
      toast.error('Erro ao carregar histórico de imports.')
    } finally {
      setLoadingHistory(false)
    }
  }

  function handleImportSuccess(record: ImportHistory) {
    // Prepend to session imports (most recent on top)
    setSessionImports((prev) => [record, ...prev])
    // Scroll panel top into view
    panelTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleDelete(importId: string) {
    const { deletedTransactions } = await deleteImport(importId)
    // Remove from both lists
    setSessionImports((prev) => prev.filter((r) => r.id !== importId))
    setHistoryImports((prev) => prev.filter((r) => r.id !== importId))
    toast.success(
      deletedTransactions > 0
        ? `Import excluído. ${deletedTransactions} transaç${deletedTransactions === 1 ? 'ão removida' : 'ões removidas'}.`
        : 'Import excluído.'
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Importar</h2>
        <p className="text-sm text-muted-foreground">
          Importe extratos bancários ou faturas de cartão em formato CSV.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-6 items-start">
        {/* Left column — wizard (60%) */}
        <div className="col-span-3">
          <CsvUploader onImportSuccess={handleImportSuccess} />
        </div>

        {/* Right column — history panel (40%) */}
        <div className="col-span-2 rounded-xl border bg-card p-5 shadow-sm" ref={panelTopRef}>
          <ImportHistoryPanel
            sessionImports={sessionImports}
            historyImports={historyImports}
            loadingHistory={loadingHistory}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </div>
  )
}

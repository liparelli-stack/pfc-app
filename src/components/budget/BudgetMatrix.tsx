import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Copy, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { fetchCategories, type Category } from '@/services/categories.service'
import {
  fetchBudgetMatrix,
  saveBudgetMatrix,
  saveSingleBudgetCell,
  type MatrixSaveInput,
} from '@/services/budget.service'
import { formatMonthLabel } from '@/services/dashboard.service'

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const now = new Date()
const CURRENT_YEAR  = now.getFullYear()
const CURRENT_MONTH = now.getMonth() + 1
const YEAR_OPTIONS  = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2]

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateMonths(sy: number, sm: number, ey: number, em: number): string[] {
  const months: string[] = []
  let y = sy, m = sm
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}-01`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

function monthDiff(sy: number, sm: number, ey: number, em: number): number {
  return (ey - sy) * 12 + (em - sm) + 1
}

function parseMonthStr(str: string): { year: number; month: number } {
  const [y, m] = str.split('-')
  return { year: parseInt(y, 10), month: parseInt(m, 10) }
}

function validatePeriod(sy: number, sm: number, ey: number, em: number): string | null {
  if (ey < sy || (ey === sy && em < sm)) return 'A data fim deve ser após a data início.'
  if (monthDiff(sy, sm, ey, em) > 15) return 'O período máximo é de 15 meses.'
  return null
}

function defaultEnd(): { year: number; month: number } {
  let m = CURRENT_MONTH + 11, y = CURRENT_YEAR
  if (m > 12) { m -= 12; y++ }
  return { year: y, month: m }
}

function cloneValues(vals: ValuesState): ValuesState {
  const out: ValuesState = {}
  for (const k in vals) out[k] = { ...vals[k] }
  return out
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ValuesState    = Record<string, Record<string, string>>  // catId → monthStr → amount str
type OriginalsState = Record<string, Record<string, string>>  // catId → monthStr → budgetId
type CellSyncState  = Record<string, 'saving' | 'error'>      // cellKey → status
type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface ActivePopover {
  catId: string
  monthStr: string
  type: 'replicate' | 'clear'
  x: number
  y: number
}

interface BudgetMatrixProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

// ─── ShortcutPopover — isolated component so autoFocus fires on every open ───

interface ShortcutPopoverProps {
  type: 'replicate' | 'clear'
  count: string
  x: number
  y: number
  onCountChange: (v: string) => void
  onConfirm: () => void
  onCancel: () => void
}

function ShortcutPopover({ type, count, x, y, onCountChange, onConfirm, onCancel }: ShortcutPopoverProps) {
  return (
    <div
      className="fixed z-[200] rounded-lg border bg-popover shadow-lg px-3 py-2"
      style={{ top: y, left: x }}
      // Swallow ALL mouse events so clicks here never reach the document listener
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        {type === 'replicate'
          ? <Copy  className="h-4 w-4 text-muted-foreground shrink-0" />
          : <Trash2 className="h-4 w-4 text-muted-foreground shrink-0" />
        }
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {type === 'replicate' ? 'Replicar →' : 'Limpar →'}
        </span>
        <input
          // autoFocus fires because this component unmounts/remounts every open
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          type="number"
          min="1"
          step="1"
          value={count}
          onChange={(e) => onCountChange(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            e.stopPropagation()                                // never reach the cell
            if (e.key === 'Enter')  { e.preventDefault(); onConfirm() }
            if (e.key === 'Escape') { e.preventDefault(); onCancel()  }
          }}
          className="w-16 text-center h-7 rounded border bg-background text-sm px-2 tabular-nums"
        />
        <Button
          type="button"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onConfirm}
        >
          Confirmar
        </Button>
        <button
          type="button"
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground text-sm"
          onClick={onCancel}
          title="Cancelar"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ─── BudgetMatrix ─────────────────────────────────────────────────────────────

export function BudgetMatrix({ open, onClose, onSaved }: BudgetMatrixProps) {
  const end = defaultEnd()

  // Period selectors
  const [startYear,  setStartYear]  = useState(CURRENT_YEAR)
  const [startMonth, setStartMonth] = useState(CURRENT_MONTH)
  const [endYear,    setEndYear]    = useState(end.year)
  const [endMonth,   setEndMonth]   = useState(end.month)
  const [periodError, setPeriodError] = useState<string | null>(null)

  // Matrix state
  const [months,     setMonths]     = useState<string[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [values,     setValues]     = useState<ValuesState>({})
  const [savedValues, setSavedValues] = useState<ValuesState>({})
  const [originals,  setOriginals]  = useState<OriginalsState>({})
  const [loading,    setLoading]    = useState(false)
  const [matrixLoaded, setMatrixLoaded] = useState(false)

  // Per-cell auto-save indicators
  const [cellSync, setCellSync]             = useState<CellSyncState>({})
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>('idle')
  const autoSaveTimer = useRef<number | null>(null)
  const savingCells   = useRef<Set<string>>(new Set())
  const isBatchSaving = useRef(false)

  // Value at focus time — for Ctrl+Z revert
  const focusValRef = useRef<string>('')

  // Batch save
  const [saving,       setSaving]       = useState(false)
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null)

  // Shortcut popover (R / L)
  const [popover,      setPopover]      = useState<ActivePopover | null>(null)
  const [popoverCount, setPopoverCount] = useState('1')
  const suppressBlur = useRef(false)   // block auto-save while popover is open

  // Cell input refs for arrow-key navigation
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  // ── Close popover on outside click ──────────────────────────────────────────
  // We listen at the document level; the ShortcutPopover component swallows its
  // own mousedown events so only clicks truly outside trigger this.

  useEffect(() => {
    if (!popover) return
    function onDown() { closePopover() }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [popover])

  // ── Reset when dialog closes ─────────────────────────────────────────────────

  useEffect(() => {
    if (!open) {
      setMatrixLoaded(false)
      setMonths([])
      setValues({})
      setSavedValues({})
      setOriginals({})
      setCellSync({})
      setAutoSaveStatus('idle')
      setPopover(null)
      setSaveProgress(null)
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [open])

  // ── Load ─────────────────────────────────────────────────────────────────────

  async function handleLoad() {
    const err = validatePeriod(startYear, startMonth, endYear, endMonth)
    if (err) { setPeriodError(err); return }
    setPeriodError(null)

    const generatedMonths = generateMonths(startYear, startMonth, endYear, endMonth)
    setLoading(true)
    setMatrixLoaded(false)

    try {
      const [cats, entries] = await Promise.all([
        fetchCategories(),
        fetchBudgetMatrix(generatedMonths),
      ])

      const sorted = [...cats].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      setCategories(sorted)
      setMonths(generatedMonths)

      const vals: ValuesState     = {}
      const origs: OriginalsState = {}
      for (const entry of entries) {
        const monthStr = `${entry.year}-${String(entry.month).padStart(2, '0')}-01`
        if (!vals[entry.category_id])  vals[entry.category_id]  = {}
        if (!origs[entry.category_id]) origs[entry.category_id] = {}
        vals[entry.category_id][monthStr]  = entry.amount.toString()
        origs[entry.category_id][monthStr] = entry.id
      }

      setValues(vals)
      setSavedValues(cloneValues(vals))
      setOriginals(origs)
      setCellSync({})
      setAutoSaveStatus('idle')
      setMatrixLoaded(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar matriz.')
    } finally {
      setLoading(false)
    }
  }

  // ── Auto-save status ──────────────────────────────────────────────────────────

  function pushStatus(status: AutoSaveStatus) {
    setAutoSaveStatus(status)
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    if (status === 'saved') {
      autoSaveTimer.current = window.setTimeout(() => setAutoSaveStatus('idle'), 3000)
    }
  }

  // ── Cell events ───────────────────────────────────────────────────────────────

  const handleCellChange = useCallback((catId: string, monthStr: string, val: string) => {
    setValues((prev) => ({ ...prev, [catId]: { ...(prev[catId] ?? {}), [monthStr]: val } }))
  }, [])

  function handleCellFocus(catId: string, monthStr: string) {
    focusValRef.current = inputRefs.current.get(`${catId}-${monthStr}`)?.value ?? ''
  }

  async function handleCellBlur(
    e: React.FocusEvent<HTMLInputElement>,
    catId: string,
    monthStr: string,
    savedValSnapshot: string,
  ) {
    if (suppressBlur.current)  return
    if (isBatchSaving.current) return

    const cellKey    = `${catId}-${monthStr}`
    const currentVal = e.currentTarget.value

    if (currentVal === savedValSnapshot) return
    if (savingCells.current.has(cellKey)) return

    const { year, month } = parseMonthStr(monthStr)
    const amount = parseFloat(currentVal) || 0

    savingCells.current.add(cellKey)
    setCellSync((p) => ({ ...p, [cellKey]: 'saving' }))
    pushStatus('saving')

    try {
      await saveSingleBudgetCell({ category_id: catId, amount, year, month })

      if (amount === 0) {
        setOriginals((p) => {
          const cat = { ...(p[catId] ?? {}) }
          delete cat[monthStr]
          return { ...p, [catId]: cat }
        })
      }

      setSavedValues((p) => ({ ...p, [catId]: { ...(p[catId] ?? {}), [monthStr]: currentVal } }))
      setCellSync((p) => { const n = { ...p }; delete n[cellKey]; return n })
      pushStatus('saved')
    } catch {
      setCellSync((p) => ({ ...p, [cellKey]: 'error' }))
      pushStatus('error')
    } finally {
      savingCells.current.delete(cellKey)
    }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    catId: string,
    monthStr: string,
    savedValSnapshot: string,
  ) {
    // Popover owns the keyboard — cell only handles Esc as a fallback close
    if (popover) {
      if (e.key === 'Escape') { e.preventDefault(); closePopover() }
      return
    }

    const catIdx = categories.findIndex((c) => c.id === catId)
    const mIdx   = months.indexOf(monthStr)

    // Arrow navigation
    if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault()
      let nc = catIdx, nm = mIdx
      if      (e.key === 'ArrowRight') nm++
      else if (e.key === 'ArrowLeft')  nm--
      else if (e.key === 'ArrowDown')  nc++
      else                             nc--
      nc = Math.max(0, Math.min(categories.length - 1, nc))
      nm = Math.max(0, Math.min(months.length    - 1, nm))
      inputRefs.current.get(`${categories[nc].id}-${months[nm]}`)?.focus()
      return
    }

    // Enter — next cell in reading order
    if (e.key === 'Enter') {
      e.preventDefault()
      let nc = catIdx, nm = mIdx + 1
      if (nm >= months.length) { nm = 0; nc++ }
      if (nc >= categories.length) return
      inputRefs.current.get(`${categories[nc].id}-${months[nm]}`)?.focus()
      return
    }

    // Escape — revert to last saved value
    if (e.key === 'Escape') {
      e.preventDefault()
      setValues((p) => ({ ...p, [catId]: { ...(p[catId] ?? {}), [monthStr]: savedValSnapshot } }))
      setCellSync((p) => { const n = { ...p }; delete n[`${catId}-${monthStr}`]; return n })
      return
    }

    // Ctrl+Z / Cmd+Z — revert to value at focus time
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault()
      setValues((p) => ({ ...p, [catId]: { ...(p[catId] ?? {}), [monthStr]: focusValRef.current } }))
      return
    }

    // R — replicate this value to the next N months
    if (e.key === 'r' || e.key === 'R') {
      const currentVal = (e.currentTarget as HTMLInputElement).value
      if (!currentVal || parseFloat(currentVal) <= 0) return
      if (mIdx >= months.length - 1) return
      e.preventDefault()
      openShortcutPopover(e.currentTarget as HTMLInputElement, catId, monthStr, 'replicate')
      return
    }

    // L — clear N months starting from this cell
    if (e.key === 'l' || e.key === 'L') {
      e.preventDefault()
      openShortcutPopover(e.currentTarget as HTMLInputElement, catId, monthStr, 'clear')
      return
    }
  }

  // ── Popover actions ───────────────────────────────────────────────────────────

  function openShortcutPopover(
    inputEl: HTMLInputElement,
    catId: string,
    monthStr: string,
    type: 'replicate' | 'clear',
  ) {
    // suppressBlur MUST be set synchronously before setPopover re-renders,
    // so that the onBlur fired when focus moves to the popover input is ignored.
    suppressBlur.current = true
    const rect = inputEl.getBoundingClientRect()
    setPopover({ catId, monthStr, type, x: rect.left, y: rect.bottom + 4 })
    setPopoverCount('1')
  }

  function closePopover() {
    const key = popover ? `${popover.catId}-${popover.monthStr}` : null
    suppressBlur.current = false
    setPopover(null)
    setPopoverCount('1')
    // Return focus to the originating cell so the user can keep navigating
    if (key) requestAnimationFrame(() => inputRefs.current.get(key)?.focus())
  }

  function confirmPopover() {
    if (!popover) return
    const n                         = Math.max(1, parseInt(popoverCount) || 1)
    const { catId, monthStr, type } = popover
    const mIdx                      = months.indexOf(monthStr)

    if (type === 'replicate') {
      const val = values[catId]?.[monthStr] ?? ''
      setValues((p) => {
        const cv = { ...(p[catId] ?? {}) }
        for (let i = mIdx + 1; i <= Math.min(mIdx + n, months.length - 1); i++) cv[months[i]] = val
        return { ...p, [catId]: cv }
      })
    } else {
      setValues((p) => {
        const cv = { ...(p[catId] ?? {}) }
        for (let i = mIdx; i < Math.min(mIdx + n, months.length); i++) cv[months[i]] = ''
        return { ...p, [catId]: cv }
      })
    }

    closePopover()
  }

  // ── Totals ────────────────────────────────────────────────────────────────────

  const colTotals = useMemo(() => Object.fromEntries(
    months.map((m) => [m, categories.reduce((s, c) => s + (parseFloat(values[c.id]?.[m] ?? '') || 0), 0)]),
  ), [values, months, categories])

  const rowTotals = useMemo(() => Object.fromEntries(
    categories.map((c) => [c.id, months.reduce((s, m) => s + (parseFloat(values[c.id]?.[m] ?? '') || 0), 0)]),
  ), [values, months, categories])

  const grandTotal = useMemo(() => Object.values(colTotals).reduce((s, v) => s + v, 0), [colTotals])

  const valuedCellCount = useMemo(() => {
    let n = 0
    for (const cId in values) for (const m of months) if ((parseFloat(values[cId]?.[m] ?? '') || 0) > 0) n++
    return n
  }, [values, months])

  // ── Batch save ────────────────────────────────────────────────────────────────

  async function handleSave() {
    isBatchSaving.current = true
    setSaving(true)
    setSaveProgress({ done: 0, total: 0 })
    const valuesSnapshot = cloneValues(values)

    try {
      const inputs: MatrixSaveInput[] = []
      for (const cat of categories) {
        for (const monthStr of months) {
          const { year, month } = parseMonthStr(monthStr)
          const amount   = parseFloat(valuesSnapshot[cat.id]?.[monthStr] ?? '') || 0
          const budgetId = originals[cat.id]?.[monthStr] ?? null
          if (amount > 0 || budgetId) inputs.push({ budgetId, category_id: cat.id, amount, year, month })
        }
      }

      const result = await saveBudgetMatrix(inputs, (done, total) => setSaveProgress({ done, total }))
      setSavedValues(cloneValues(valuesSnapshot))

      const s = result.saved
      toast.success(`Planejamento salvo — ${s} valor${s !== 1 ? 'es' : ''} definido${s !== 1 ? 's' : ''} em ${months.length} mês${months.length !== 1 ? 'es' : ''}.`)
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar planejamento.')
    } finally {
      isBatchSaving.current = false
      setSaving(false)
      setSaveProgress(null)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose() }}>
      <DialogContent className="max-w-[95vw] h-[88vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* ── Header ── */}
        <DialogHeader className="flex-row items-end justify-between px-6 pt-5 pb-4 border-b shrink-0 space-y-0">
          <DialogTitle className="text-xl">📊 Planejamento de Orçamento</DialogTitle>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">De:</span>
            <select className="h-8 rounded-md border bg-background px-2 text-sm" value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))}>
              {MONTHS_PT.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <select className="h-8 rounded-md border bg-background px-2 text-sm" value={startYear} onChange={(e) => setStartYear(Number(e.target.value))}>
              {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>

            <span className="text-sm text-muted-foreground">Até:</span>
            <select className="h-8 rounded-md border bg-background px-2 text-sm" value={endMonth} onChange={(e) => setEndMonth(Number(e.target.value))}>
              {MONTHS_PT.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <select className="h-8 rounded-md border bg-background px-2 text-sm" value={endYear} onChange={(e) => setEndYear(Number(e.target.value))}>
              {YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>

            <Button size="sm" onClick={handleLoad} disabled={loading || saving}>
              {loading ? 'Carregando…' : 'Carregar'}
            </Button>
            {periodError && <span className="text-xs text-destructive">{periodError}</span>}
          </div>
        </DialogHeader>

        {/* ── Matrix area ── */}
        <div className="flex-1 overflow-auto relative">
          {!matrixLoaded && !loading && (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Configure o período e clique em <strong className="mx-1">Carregar</strong> para exibir a matriz.
            </div>
          )}

          {loading && (
            <div className="p-6 animate-pulse space-y-3">
              <div className="h-8 rounded bg-muted w-full" />
              {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-9 rounded bg-muted w-full" />)}
            </div>
          )}

          {matrixLoaded && !loading && (
            <table className="border-collapse text-sm" style={{ minWidth: `${180 + months.length * 100 + 110}px` }}>
              <thead>
                <tr className="bg-muted/40 border-b-2">
                  <th className="sticky left-0 z-30 bg-muted/40 px-4 py-2 text-left font-semibold text-muted-foreground min-w-[180px] border-r">
                    Categoria
                  </th>
                  {months.map((m) => (
                    <th key={m} className="px-2 py-2 text-center font-semibold text-muted-foreground w-[100px] border-r">
                      {formatMonthLabel(m)}
                    </th>
                  ))}
                  <th className="sticky right-0 z-30 bg-muted/40 px-3 py-2 text-right font-semibold text-muted-foreground min-w-[110px] border-l">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-muted/10 transition-colors border-b">
                    {/* Category — sticky left */}
                    <td className="sticky left-0 z-20 bg-background px-3 py-1.5 border-r">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-6 w-6 rounded-full flex items-center justify-center text-xs shrink-0"
                          style={{ backgroundColor: `${cat.color ?? '#6b7280'}22`, color: cat.color ?? '#6b7280' }}
                        >
                          {cat.icon ?? '?'}
                        </div>
                        <span className="font-medium truncate max-w-[120px]" title={cat.name}>{cat.name}</span>
                      </div>
                    </td>

                    {/* Month input cells */}
                    {months.map((monthStr) => {
                      const cellKey    = `${cat.id}-${monthStr}`
                      const val        = values[cat.id]?.[monthStr] ?? ''
                      const savedVal   = savedValues[cat.id]?.[monthStr] ?? ''
                      const isDirty    = val !== savedVal
                      const syncStatus = cellSync[cellKey]
                      const hasValue   = (parseFloat(val) || 0) > 0

                      return (
                        <td
                          key={monthStr}
                          className={[
                            'p-0 border-r w-[100px]',
                            syncStatus === 'error'
                              ? 'bg-red-50 dark:bg-red-950/20'
                              : isDirty && syncStatus !== 'saving'
                              ? 'bg-amber-50/70 dark:bg-amber-950/20'
                              : '',
                          ].join(' ')}
                        >
                          <input
                            ref={(el) => {
                              if (el) inputRefs.current.set(cellKey, el)
                              else inputRefs.current.delete(cellKey)
                            }}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="—"
                            value={val}
                            onChange={(e) => handleCellChange(cat.id, monthStr, e.target.value)}
                            onFocus={() => handleCellFocus(cat.id, monthStr)}
                            onBlur={(e) => handleCellBlur(e, cat.id, monthStr, savedVal)}
                            onKeyDown={(e) => handleKeyDown(e, cat.id, monthStr, savedVal)}
                            className={[
                              'w-full h-9 px-2 text-right text-sm tabular-nums',
                              'bg-transparent border-none outline-none',
                              'focus:bg-primary/5 focus:ring-1 focus:ring-inset focus:ring-primary',
                              'placeholder:text-muted-foreground/40',
                              syncStatus === 'saving' ? 'opacity-50' : '',
                              syncStatus === 'error'  ? 'ring-1 ring-inset ring-red-400' : '',
                              hasValue ? 'text-foreground' : 'text-muted-foreground',
                            ].join(' ')}
                          />
                        </td>
                      )
                    })}

                    {/* Row total — sticky right */}
                    <td className="sticky right-0 z-20 bg-background px-3 py-1.5 text-right tabular-nums font-semibold border-l text-sm">
                      {rowTotals[cat.id] > 0
                        ? brl.format(rowTotals[cat.id])
                        : <span className="text-muted-foreground font-normal">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="bg-muted/30 border-t-2 font-bold">
                  <td className="sticky left-0 z-20 bg-muted/30 px-4 py-2 border-r text-sm">Total do Mês</td>
                  {months.map((m) => (
                    <td key={m} className="px-2 py-2 text-right tabular-nums text-sm border-r">
                      {colTotals[m] > 0
                        ? brl.format(colTotals[m])
                        : <span className="font-normal text-muted-foreground">—</span>
                      }
                    </td>
                  ))}
                  <td className="sticky right-0 z-20 bg-muted/30 px-3 py-2 text-right tabular-nums text-sm border-l text-primary">
                    {brl.format(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* ── Footer ── */}
        <DialogFooter className="px-6 py-4 border-t shrink-0 flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {matrixLoaded ? (
              <>
                <span>
                  {categories.length} categorias · {months.length} meses · {valuedCellCount} valores ·{' '}
                  <span className="font-medium text-foreground">Total: {brl.format(grandTotal)}</span>
                </span>
                {autoSaveStatus === 'saving' && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" />
                    Salvando…
                  </span>
                )}
                {autoSaveStatus === 'saved'  && <span className="text-green-600">✓ Salvo</span>}
                {autoSaveStatus === 'error'  && <span className="text-destructive">⚠ Erro ao salvar</span>}
              </>
            ) : (
              <span>Configure o período e clique em Carregar.</span>
            )}
          </div>

          {saveProgress && saveProgress.total > 0 && (
            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${(saveProgress.done / saveProgress.total) * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {saveProgress.done}/{saveProgress.total}
              </span>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !matrixLoaded}>
              {saving ? 'Salvando…' : 'Salvar tudo'}
            </Button>
          </div>
        </DialogFooter>

        {/* ── Shortcut popover (R / L) — rendered INSIDE DialogContent so it's
            inside Radix's focus trap and autoFocus works reliably ── */}
        {popover && (
          <ShortcutPopover
            type={popover.type}
            count={popoverCount}
            x={popover.x}
            y={popover.y}
            onCountChange={setPopoverCount}
            onConfirm={confirmPopover}
            onCancel={closePopover}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

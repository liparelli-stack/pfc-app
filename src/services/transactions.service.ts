import { supabase } from '@/lib/supabase'
import type { NormalizedTransaction } from './import/csv.parser'
import { classifyAndSaveTransactions } from './classification.service'
import type { ImportHistory } from './import-history.service'

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Usuário não autenticado.')
  return data.user.id
}

export interface SaveContext {
  originName: string    // human-readable bank/card name for the history record
  fileName: string      // original CSV filename
}

export interface SaveResult {
  imported: number
  skipped: number
  classified: number
  importRecord: ImportHistory
}

export async function saveTransactions(
  transactions: NormalizedTransaction[],
  referenceMonth: string,   // YYYY-MM-01
  context: SaveContext,
): Promise<SaveResult> {
  if (transactions.length === 0) throw new Error('Nenhuma transação para importar.')

  const user_id = await getCurrentUserId()

  // All transactions in one batch share the same origin_type and origin_id
  const sourceType = transactions[0].origin_type
  const table = sourceType === 'bank' ? 'bank_transactions' : 'card_transactions'
  const originId = transactions[0].origin_id
  const originCol = sourceType === 'bank' ? 'bank_id' : 'card_id'

  // ── Duplicate detection ──────────────────────────────────────────────────────
  const incomingHashes = transactions.map((t) => t.import_hash)

  const { data: existing, error: fetchError } = await supabase
    .from(table)
    .select('import_hash')
    .eq(originCol, originId)
    .in('import_hash', incomingHashes)

  if (fetchError) throw new Error(fetchError.message)

  const existingHashes = new Set(
    (existing ?? []).map((r: { import_hash: string }) => r.import_hash),
  )

  const newTransactions = transactions.filter((t) => !existingHashes.has(t.import_hash))
  const skipped = transactions.length - newTransactions.length

  // ── Insert new transactions ──────────────────────────────────────────────────
  let insertedIds: string[] = []
  let classified = 0

  if (newTransactions.length > 0) {
    const rows = newTransactions.map((t) => {
      const row: Record<string, unknown> = {
        user_id,
        [originCol]: t.origin_id,
        date: t.date,
        description: t.description,
        amount: t.amount,
        import_hash: t.import_hash,
        reference_month: referenceMonth,
      }
      if (sourceType === 'bank') row.type = t.type
      return row
    })

    const { data: inserted, error: insertError } = await supabase
      .from(table)
      .insert(rows)
      .select('id, description')
    if (insertError) throw new Error(insertError.message)

    const insertedRows = (inserted ?? []) as Array<{ id: string; description: string }>
    insertedIds = insertedRows.map((r) => r.id)

    // Auto-classify
    const summary = await classifyAndSaveTransactions(insertedRows, table, user_id)
    classified = summary.classified
  }

  // ── Create import_history record ─────────────────────────────────────────────
  const status =
    newTransactions.length === 0 ? 'partial'   // all duplicates
    : skipped > 0                ? 'partial'   // mixed
    :                              'success'   // all new

  const { data: importRecord, error: historyError } = await supabase
    .from('import_history')
    .insert({
      user_id,
      type: sourceType,
      origin_id: originId,
      origin_name: context.originName,
      file_name: context.fileName,
      reference_month: referenceMonth,
      total_rows: transactions.length,
      imported_rows: newTransactions.length,
      duplicate_rows: skipped,
      error_rows: 0,
      status,
    })
    .select('*')
    .single()

  if (historyError) throw new Error(historyError.message)

  // ── Link inserted transactions to this import ────────────────────────────────
  if (insertedIds.length > 0) {
    const { error: linkError } = await supabase
      .from(table)
      .update({ import_id: importRecord.id })
      .in('id', insertedIds)

    if (linkError) throw new Error(linkError.message)
  }

  return {
    imported: newTransactions.length,
    skipped,
    classified,
    importRecord: importRecord as ImportHistory,
  }
}

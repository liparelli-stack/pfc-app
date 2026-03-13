import { supabase } from '@/lib/supabase'

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Usuário não autenticado.')
  return data.user.id
}

export interface ImportHistory {
  id: string
  user_id: string
  type: 'bank' | 'card'
  origin_id: string
  origin_name: string
  file_name: string
  reference_month: string   // YYYY-MM-01
  total_rows: number
  imported_rows: number
  duplicate_rows: number
  error_rows: number
  status: 'success' | 'partial' | 'error'
  created_at: string
}

export async function fetchImportHistory(): Promise<ImportHistory[]> {
  const user_id = await getCurrentUserId()

  const { data, error } = await supabase
    .from('import_history')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as ImportHistory[]
}

export async function deleteImport(
  importId: string,
): Promise<{ deletedTransactions: number }> {
  // Delete linked transactions from both tables first (FK constraint)
  const [bankDel, cardDel] = await Promise.all([
    supabase
      .from('bank_transactions')
      .delete()
      .eq('import_id', importId)
      .select('id'),
    supabase
      .from('card_transactions')
      .delete()
      .eq('import_id', importId)
      .select('id'),
  ])

  if (bankDel.error) throw new Error(bankDel.error.message)
  if (cardDel.error) throw new Error(cardDel.error.message)

  const deletedTransactions =
    (bankDel.data?.length ?? 0) + (cardDel.data?.length ?? 0)

  // Now delete the import_history record
  const { error } = await supabase
    .from('import_history')
    .delete()
    .eq('id', importId)

  if (error) throw new Error(error.message)

  return { deletedTransactions }
}

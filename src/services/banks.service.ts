import { supabase } from '@/lib/supabase'

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Usuário não autenticado.')
  return data.user.id
}

export interface Bank {
  id: string
  user_id: string
  name: string
  short_name: string
  active: boolean
  created_at: string
  deleted_at: string | null
}

export interface BankInput {
  name: string
  short_name: string
  active: boolean
}

export async function fetchBanks(): Promise<Bank[]> {
  const { data, error } = await supabase
    .from('banks')
    .select('*')
    .is('deleted_at', null)
    .order('name')

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createBank(input: BankInput): Promise<Bank> {
  if (!input.name.trim()) throw new Error('Nome é obrigatório.')
  if (!input.short_name.trim()) throw new Error('Sigla é obrigatória.')

  const user_id = await getCurrentUserId()

  const { data, error } = await supabase
    .from('banks')
    .insert({
      user_id,
      name: input.name.trim(),
      short_name: input.short_name.trim().toUpperCase(),
      active: input.active,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateBank(id: string, input: BankInput): Promise<Bank> {
  if (!input.name.trim()) throw new Error('Nome é obrigatório.')
  if (!input.short_name.trim()) throw new Error('Sigla é obrigatória.')

  const user_id = await getCurrentUserId()

  const { data, error } = await supabase
    .from('banks')
    .update({
      user_id,
      name: input.name.trim(),
      short_name: input.short_name.trim().toUpperCase(),
      active: input.active,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteBank(id: string): Promise<void> {
  const { error } = await supabase
    .from('banks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

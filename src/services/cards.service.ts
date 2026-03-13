import { supabase } from '@/lib/supabase'

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Usuário não autenticado.')
  return data.user.id
}

export interface Card {
  id: string
  user_id: string
  name: string
  last_four: string
  bank_id: string | null
  credit_limit: number | null
  closing_day: number | null
  due_day: number | null
  active: boolean
  created_at: string
  deleted_at: string | null
  banks: { name: string; short_name: string } | null
}

export interface CardInput {
  name: string
  last_four: string
  bank_id: string | null
  credit_limit: number | null
  closing_day: number | null
  due_day: number | null
  active: boolean
}

export async function fetchCards(): Promise<Card[]> {
  const { data, error } = await supabase
    .from('credit_cards')
    .select('*, banks(name, short_name)')
    .is('deleted_at', null)
    .order('name')

  if (error) throw new Error(error.message)
  return (data ?? []) as Card[]
}

export async function createCard(input: CardInput): Promise<Card> {
  if (!input.name.trim()) throw new Error('Nome é obrigatório.')
  if (!/^\d{4}$/.test(input.last_four)) throw new Error('Final deve ter exatamente 4 dígitos.')

  const user_id = await getCurrentUserId()

  const { data, error } = await supabase
    .from('credit_cards')
    .insert({
      user_id,
      name: input.name.trim(),
      last_four: input.last_four,
      bank_id: input.bank_id || null,
      credit_limit: input.credit_limit,
      closing_day: input.closing_day,
      due_day: input.due_day,
      active: input.active,
    })
    .select('*, banks(name, short_name)')
    .single()

  if (error) throw new Error(error.message)
  return data as Card
}

export async function updateCard(id: string, input: CardInput): Promise<Card> {
  if (!input.name.trim()) throw new Error('Nome é obrigatório.')
  if (!/^\d{4}$/.test(input.last_four)) throw new Error('Final deve ter exatamente 4 dígitos.')

  const user_id = await getCurrentUserId()

  const { data, error } = await supabase
    .from('credit_cards')
    .update({
      user_id,
      name: input.name.trim(),
      last_four: input.last_four,
      bank_id: input.bank_id || null,
      credit_limit: input.credit_limit,
      closing_day: input.closing_day,
      due_day: input.due_day,
      active: input.active,
    })
    .eq('id', id)
    .select('*, banks(name, short_name)')
    .single()

  if (error) throw new Error(error.message)
  return data as Card
}

export async function deleteCard(id: string): Promise<void> {
  const { error } = await supabase
    .from('credit_cards')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

import { supabase } from '@/lib/supabase'

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Usuário não autenticado.')
  return data.user.id
}

export interface Category {
  id: string
  user_id: string | null   // null = sistema/padrão | uuid = categoria do usuário
  name: string
  icon: string | null
  color: string | null
  active: boolean
  deleted_at: string | null
  created_at: string
}

export interface CategoryInput {
  name: string
  icon: string
  color: string
}

export async function fetchCategories(): Promise<Category[]> {
  const user_id = await getCurrentUserId()

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .is('deleted_at', null)
    .or(`user_id.is.null,user_id.eq.${user_id}`)
    .order('name')

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  if (!input.name.trim()) throw new Error('Nome é obrigatório.')

  const user_id = await getCurrentUserId()

  const { data, error } = await supabase
    .from('categories')
    .insert({
      user_id,
      name: input.name.trim(),
      icon: input.icon.trim() || null,
      color: input.color || null,
      active: true,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function updateCategory(id: string, input: CategoryInput): Promise<Category> {
  if (!input.name.trim()) throw new Error('Nome é obrigatório.')

  const { data, error } = await supabase
    .from('categories')
    .update({
      name: input.name.trim(),
      icon: input.icon.trim() || null,
      color: input.color || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  // Check usage in both transaction tables before deleting
  const [bankCheck, cardCheck] = await Promise.all([
    supabase
      .from('bank_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id),
    supabase
      .from('card_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id),
  ])

  const totalUsage = (bankCheck.count ?? 0) + (cardCheck.count ?? 0)
  if (totalUsage > 0) {
    throw new Error('Categoria em uso — não pode ser excluída.')
  }

  const { error } = await supabase
    .from('categories')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

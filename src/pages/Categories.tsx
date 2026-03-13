import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CategoryList } from '@/components/categories/CategoryList'
import { CategoryForm } from '@/components/categories/CategoryForm'
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type Category,
  type CategoryInput,
} from '@/services/categories.service'

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    setLoading(true)
    setError(null)
    try {
      setCategories(await fetchCategories())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar categorias.')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setSelectedCategory(null)
    setSheetOpen(true)
  }

  function openEdit(category: Category) {
    setSelectedCategory(category)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setSelectedCategory(null)
  }

  async function handleSubmit(input: CategoryInput) {
    setSaving(true)
    try {
      if (selectedCategory) {
        const updated = await updateCategory(selectedCategory.id, input)
        setCategories((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        )
      } else {
        const created = await createCategory(input)
        setCategories((prev) =>
          [...prev, created].sort((a, b) => {
            const aDefault = a.user_id === null
            const bDefault = b.user_id === null
            if (aDefault !== bDefault) return aDefault ? 1 : -1
            return a.name.localeCompare(b.name)
          })
        )
      }
      closeSheet()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar categoria.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(category: Category) {
    try {
      await deleteCategory(category.id)
      setCategories((prev) => prev.filter((c) => c.id !== category.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir categoria.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Categorias</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie as categorias de despesas e receitas.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Nova categoria
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Carregando…</p>
        </div>
      ) : (
        <CategoryList
          categories={categories}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      <CategoryForm
        open={sheetOpen}
        category={selectedCategory}
        loading={saving}
        onSubmit={handleSubmit}
        onClose={closeSheet}
      />
    </div>
  )
}

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
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
import type { Category } from '@/services/categories.service'

interface CategoryListProps {
  categories: Category[]
  onEdit: (category: Category) => void
  onDelete: (category: Category) => Promise<void>
}

interface ColorDotProps {
  color: string | null
  icon: string | null
}

function ColorDot({ color, icon }: ColorDotProps) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm"
      style={{ backgroundColor: color ?? '#94a3b8' }}
    >
      {icon ?? '📁'}
    </div>
  )
}

function CategoryRow({
  category,
  onEdit,
  onDeleteRequest,
}: {
  category: Category
  onEdit: (c: Category) => void
  onDeleteRequest: (c: Category) => void
}) {
  const isDefault = category.user_id === null

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-3">
      <ColorDot color={category.color} icon={category.icon} />

      <div className="flex flex-1 items-center gap-2 min-w-0">
        <span className="font-medium truncate">{category.name}</span>
        {isDefault && (
          <Badge variant="secondary" className="shrink-0 text-xs">
            Padrão
          </Badge>
        )}
      </div>

      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(category)}
          disabled={isDefault}
          title={isDefault ? 'Categorias padrão não podem ser editadas' : 'Editar'}
          className={isDefault ? 'opacity-25 cursor-not-allowed hover:bg-transparent' : ''}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDeleteRequest(category)}
          disabled={isDefault}
          title={isDefault ? 'Categorias padrão não podem ser excluídas' : 'Excluir'}
          className={
            isDefault
              ? 'opacity-25 cursor-not-allowed hover:bg-transparent'
              : 'text-destructive hover:text-destructive'
          }
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function CategoryList({ categories, onEdit, onDelete }: CategoryListProps) {
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)

  const defaults = categories.filter((c) => c.user_id === null)
  const userDefined = categories.filter((c) => c.user_id !== null)

  async function handleConfirmDelete() {
    if (!categoryToDelete) return
    setDeleting(true)
    try {
      await onDelete(categoryToDelete)
    } finally {
      setDeleting(false)
      setCategoryToDelete(null)
    }
  }

  if (categories.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed py-16">
        <p className="text-sm text-muted-foreground">Nenhuma categoria encontrada.</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* User-defined categories */}
        {userDefined.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide px-1">
              Minhas categorias
            </h3>
            <div className="flex flex-col gap-2">
              {userDefined.map((c) => (
                <CategoryRow
                  key={c.id}
                  category={c}
                  onEdit={onEdit}
                  onDeleteRequest={setCategoryToDelete}
                />
              ))}
            </div>
          </section>
        )}

        {/* Default categories */}
        {defaults.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide px-1">
              Categorias padrão
            </h3>
            <div className="flex flex-col gap-2">
              {defaults.map((c) => (
                <CategoryRow
                  key={c.id}
                  category={c}
                  onEdit={onEdit}
                  onDeleteRequest={setCategoryToDelete}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <Dialog
        open={categoryToDelete !== null}
        onOpenChange={(v) => { if (!v) setCategoryToDelete(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir categoria</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir{' '}
              <strong>{categoryToDelete?.name}</strong>? Esta ação não pode ser
              desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCategoryToDelete(null)}
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
    </>
  )
}

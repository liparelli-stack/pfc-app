import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Category, CategoryInput } from '@/services/categories.service'

const schema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres.'),
  icon: z.string().max(10, 'Ícone deve ter no máximo 10 caracteres.'),
  color: z.string(),
})

type FormValues = z.infer<typeof schema>

interface CategoryFormProps {
  open: boolean
  category: Category | null
  loading: boolean
  onSubmit: (values: CategoryInput) => Promise<void>
  onClose: () => void
}

export function CategoryForm({ open, category, loading, onSubmit, onClose }: CategoryFormProps) {
  const isEditing = category !== null

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', icon: '', color: '#6366f1' },
  })

  useEffect(() => {
    if (open) {
      form.reset(
        category
          ? {
              name: category.name,
              icon: category.icon ?? '',
              color: category.color ?? '#6366f1',
            }
          : { name: '', icon: '', color: '#6366f1' }
      )
    }
  }, [open, category, form])

  async function handleSubmit(values: FormValues) {
    await onSubmit(values)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar categoria' : 'Nova categoria'}</SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-6 py-6"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Alimentação" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ícone (emoji)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: 🍔" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        className="h-10 w-16 cursor-pointer rounded-md border border-input bg-background p-1"
                        {...field}
                      />
                      <span className="text-sm text-muted-foreground font-mono">
                        {field.value}
                      </span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SheetFooter className="flex gap-2 pt-2">
              <SheetClose asChild>
                <Button type="button" variant="outline" disabled={loading}>
                  Cancelar
                </Button>
              </SheetClose>
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando…' : 'Salvar'}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

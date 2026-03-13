import { useEffect, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import type { BudgetRow, BudgetUpsertInput } from '@/services/budget.service'
import type { Category } from '@/services/categories.service'
import { formatMonthLabel } from '@/services/dashboard.service'

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  category_id: z.string().min(1, 'Selecione uma categoria.'),
  amount: z.string().refine(
    (v) => v !== '' && !isNaN(parseFloat(v)) && parseFloat(v) > 0,
    { message: 'Informe um valor maior que zero.' },
  ),
})

type FormValues = z.infer<typeof schema>

// ─── Component ────────────────────────────────────────────────────────────────

interface BudgetFormProps {
  open: boolean
  row: BudgetRow | null      // null = add mode, BudgetRow = edit mode
  categories: Category[]     // available categories for the add dropdown
  selectedMonth: string      // "YYYY-MM-01"
  loading: boolean
  onSubmit: (input: BudgetUpsertInput) => Promise<void>
  onClose: () => void
}

export function BudgetForm({
  open,
  row,
  categories,
  selectedMonth,
  loading,
  onSubmit,
  onClose,
}: BudgetFormProps) {
  const isAddMode = row === null

  // true = save as base (all months); false = save as point (only this month)
  const [updateBase, setUpdateBase] = useState(true)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category_id: '', amount: '' },
  })

  useEffect(() => {
    if (!open) return

    if (isAddMode) {
      form.reset({ category_id: '', amount: '' })
      setUpdateBase(true)
    } else {
      form.reset({
        category_id: row.categoryId ?? '',
        amount: row.budgeted > 0 ? row.budgeted.toString() : '',
      })
      // Default toggle based on current effective source
      setUpdateBase(row.effectiveSource === 'base' || row.effectiveSource === 'none')
    }
  }, [open, row, isAddMode, form])

  async function handleSubmit(values: FormValues) {
    // Choose which existing ID to update, or null to INSERT
    const existingId = updateBase
      ? (row?.baseBudgetId ?? null)
      : (row?.pointBudgetId ?? null)

    await onSubmit({
      category_id: values.category_id,
      amount: parseFloat(values.amount),
      is_base: updateBase,
      selectedMonth,
      existingId,
    })
  }

  const monthLabel = formatMonthLabel(selectedMonth)

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isAddMode ? 'Adicionar ao orçamento' : 'Editar orçamento'}
          </SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-5 py-6">
            {/* Categoria — dropdown em add mode, readonly em edit mode */}
            {isAddMode ? (
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.length === 0 ? (
                          <SelectItem value="_none" disabled>
                            Todas as categorias já têm orçamento
                          </SelectItem>
                        ) : (
                          categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.icon ? `${c.icon} ` : ''}{c.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none">Categoria</label>
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/30 text-sm">
                  {row?.categoryIcon && <span>{row.categoryIcon}</span>}
                  <span className="font-medium">{row?.categoryName}</span>
                  {row?.effectiveSource === 'base' && (
                    <span className="ml-auto text-[10px] text-muted-foreground border rounded px-1">
                      base
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Valor */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor orçado (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0,00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Toggle base vs ponto */}
            <div className="rounded-lg border p-4 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {updateBase ? 'Orçamento base (todos os meses)' : `Apenas ${monthLabel}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {updateBase
                      ? 'Define o padrão mensal. Pode ser ajustado pontualmente por mês.'
                      : `Aplica somente em ${monthLabel}. Sobrepõe o orçamento base.`}
                  </p>
                </div>
                <Switch checked={updateBase} onCheckedChange={setUpdateBase} />
              </div>
            </div>

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

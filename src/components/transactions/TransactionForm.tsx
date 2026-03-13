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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { UnifiedTransaction, TransactionUpdate } from '@/services/transactions-view.service'
import type { Category } from '@/services/categories.service'

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]
const REF_YEARS = Array.from({ length: 7 }, (_, i) => 2020 + i)

// Parse "YYYY-MM-01" → { year, month }
function parseRefMonth(value: string | null): { refYear: string; refMonth: string } {
  if (!value) return { refYear: 'none', refMonth: 'none' }
  const [y, m] = value.split('-')
  return { refYear: y, refMonth: String(parseInt(m, 10)) }
}

// Compose "YYYY-MM-01" from year + month strings
function composeRefMonth(year: string, month: string): string | null {
  if (year === 'none' || month === 'none') return null
  return `${year}-${String(parseInt(month, 10)).padStart(2, '0')}-01`
}

const schema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória.'),
  date: z.string().min(1, 'Data é obrigatória.'),
  amount: z
    .string()
    .refine((v) => v !== '' && !isNaN(parseFloat(v)) && parseFloat(v) > 0, {
      message: 'Informe um valor maior que zero.',
    }),
  type: z.string().nullable(),
  category_id: z.string().nullable(),
  notes: z.string(),
  refYear: z.string(),
  refMonth: z.string(),
})

type FormValues = z.infer<typeof schema>

interface TransactionFormProps {
  open: boolean
  transaction: UnifiedTransaction | null
  categories: Category[]
  loading: boolean
  onSubmit: (id: string, source: 'bank' | 'card', updates: TransactionUpdate) => Promise<void>
  onClose: () => void
}

export function TransactionForm({
  open,
  transaction,
  categories,
  loading,
  onSubmit,
  onClose,
}: TransactionFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: '',
      date: '',
      amount: '',
      type: null,
      category_id: null,
      notes: '',
      refYear: 'none',
      refMonth: 'none',
    },
  })

  useEffect(() => {
    if (open && transaction) {
      const { refYear, refMonth } = parseRefMonth(transaction.reference_month)
      form.reset({
        description: transaction.description,
        date: transaction.date,
        amount: Math.abs(transaction.amount).toString(),
        type: transaction.type ?? null,
        category_id: transaction.category_id ?? null,
        notes: transaction.notes ?? '',
        refYear,
        refMonth,
      })
    }
  }, [open, transaction, form])

  async function handleSubmit(values: FormValues) {
    if (!transaction) return
    await onSubmit(transaction.id, transaction.source, {
      description: values.description,
      date: values.date,
      amount: parseFloat(values.amount),
      type: values.type,
      category_id: values.category_id === 'none' ? null : values.category_id,
      notes: values.notes.trim() || null,
      reference_month: composeRefMonth(values.refYear, values.refMonth),
    })
  }

  const isBank = transaction?.source === 'bank'

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Editar transação</SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-5 py-6"
          >
            {/* Descrição */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Descrição da transação" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Data */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Valor */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
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

            {/* Tipo — somente banco */}
            {isBank && (
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select
                      value={field.value ?? 'none'}
                      onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="debit">Débito</SelectItem>
                        <SelectItem value="credit">Crédito</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Categoria */}
            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoria</FormLabel>
                  <Select
                    value={field.value ?? 'none'}
                    onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sem categoria" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sem categoria</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.icon ? `${c.icon} ` : ''}{c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Mês de referência */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Mês de referência</label>
              <div className="flex gap-2">
                <FormField
                  control={form.control}
                  name="refMonth"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Mês" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {MONTHS_PT.map((label, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FormField
                  control={form.control}
                  name="refYear"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-24">
                        <SelectValue placeholder="Ano" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {REF_YEARS.map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            {/* Observação */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observação</FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                      placeholder="Observação opcional…"
                      {...field}
                    />
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

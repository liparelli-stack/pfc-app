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
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import type { Bank } from '@/services/banks.service'
import type { Card, CardInput } from '@/services/cards.service'

const schema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres.'),
  last_four: z
    .string()
    .regex(/^\d{4}$/, 'Informe exatamente 4 dígitos numéricos.'),
  bank_id: z.string().nullable(),
  credit_limit: z
    .string()
    .refine((v) => v === '' || (!isNaN(parseFloat(v)) && parseFloat(v) > 0), {
      message: 'Informe um valor maior que zero.',
    }),
  closing_day: z
    .string()
    .refine((v) => v === '' || (Number.isInteger(+v) && +v >= 1 && +v <= 31), {
      message: 'Informe um dia entre 1 e 31.',
    }),
  due_day: z
    .string()
    .refine((v) => v === '' || (Number.isInteger(+v) && +v >= 1 && +v <= 31), {
      message: 'Informe um dia entre 1 e 31.',
    }),
  active: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface CardFormProps {
  open: boolean
  card: Card | null
  banks: Bank[]
  loading: boolean
  onSubmit: (values: CardInput) => Promise<void>
  onClose: () => void
}

export function CardForm({ open, card, banks, loading, onSubmit, onClose }: CardFormProps) {
  const isEditing = card !== null

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      last_four: '',
      bank_id: null,
      credit_limit: '',
      closing_day: '',
      due_day: '',
      active: true,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset(
        card
          ? {
              name: card.name,
              last_four: card.last_four,
              bank_id: card.bank_id,
              credit_limit: card.credit_limit?.toString() ?? '',
              closing_day: card.closing_day?.toString() ?? '',
              due_day: card.due_day?.toString() ?? '',
              active: card.active,
            }
          : {
              name: '',
              last_four: '',
              bank_id: null,
              credit_limit: '',
              closing_day: '',
              due_day: '',
              active: true,
            }
      )
    }
  }, [open, card, form])

  async function handleSubmit(values: FormValues) {
    await onSubmit({
      name: values.name,
      last_four: values.last_four,
      bank_id: values.bank_id === 'none' ? null : values.bank_id,
      credit_limit: values.credit_limit !== '' ? parseFloat(values.credit_limit) : null,
      closing_day: values.closing_day !== '' ? parseInt(values.closing_day, 10) : null,
      due_day: values.due_day !== '' ? parseInt(values.due_day, 10) : null,
      active: values.active,
    })
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar cartão' : 'Novo cartão'}</SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-5 py-6"
          >
            {/* Nome */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Nubank Roxinho" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Final (last four) */}
            <FormField
              control={form.control}
              name="last_four"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Final do cartão</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: 1234"
                      maxLength={4}
                      inputMode="numeric"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value.replace(/\D/g, ''))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Banco */}
            <FormField
              control={form.control}
              name="bank_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Banco</FormLabel>
                  <Select
                    value={field.value ?? 'none'}
                    onValueChange={(v) => field.onChange(v === 'none' ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um banco (opcional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {banks.map((bank) => (
                        <SelectItem key={bank.id} value={bank.id}>
                          {bank.name} ({bank.short_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Limite de crédito */}
            <FormField
              control={form.control}
              name="credit_limit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Limite de crédito (R$)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Ex: 5000.00"
                      step="0.01"
                      min="0"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Fechamento e Vencimento */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="closing_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dia de fechamento</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Ex: 20"
                        min="1"
                        max="31"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dia de vencimento</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Ex: 5"
                        min="1"
                        max="31"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Ativo */}
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <FormLabel className="cursor-pointer">Ativo</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
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

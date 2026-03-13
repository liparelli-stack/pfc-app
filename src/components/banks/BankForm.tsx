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
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import type { Bank, BankInput } from '@/services/banks.service'

const schema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres.'),
  short_name: z
    .string()
    .min(1, 'Sigla é obrigatória.')
    .max(10, 'Sigla deve ter no máximo 10 caracteres.'),
  active: z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface BankFormProps {
  open: boolean
  bank: Bank | null
  loading: boolean
  onSubmit: (values: BankInput) => Promise<void>
  onClose: () => void
}

export function BankForm({ open, bank, loading, onSubmit, onClose }: BankFormProps) {
  const isEditing = bank !== null

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', short_name: '', active: true },
  })

  useEffect(() => {
    if (open) {
      form.reset(
        bank
          ? { name: bank.name, short_name: bank.short_name, active: bank.active }
          : { name: '', short_name: '', active: true }
      )
    }
  }, [open, bank, form])

  async function handleSubmit(values: FormValues) {
    await onSubmit(values)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar banco' : 'Novo banco'}</SheetTitle>
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
                    <Input placeholder="Ex: Banco do Brasil" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="short_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sigla</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: BB"
                      maxLength={10}
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value.toUpperCase())
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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

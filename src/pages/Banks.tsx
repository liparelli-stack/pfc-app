import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BankList } from '@/components/banks/BankList'
import { BankForm } from '@/components/banks/BankForm'
import {
  fetchBanks,
  createBank,
  updateBank,
  deleteBank,
  type Bank,
  type BankInput,
} from '@/services/banks.service'

export function Banks() {
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadBanks()
  }, [])

  async function loadBanks() {
    setLoading(true)
    setError(null)
    try {
      setBanks(await fetchBanks())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar bancos.')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setSelectedBank(null)
    setSheetOpen(true)
  }

  function openEdit(bank: Bank) {
    setSelectedBank(bank)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setSelectedBank(null)
  }

  async function handleSubmit(input: BankInput) {
    setSaving(true)
    try {
      if (selectedBank) {
        const updated = await updateBank(selectedBank.id, input)
        setBanks((prev) =>
          prev.map((b) => (b.id === updated.id ? updated : b))
        )
      } else {
        const created = await createBank(input)
        setBanks((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      }
      closeSheet()
    } catch (e) {
      // Re-throw so BankForm can optionally react; error shown via alert for now
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar banco.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(bank: Bank) {
    await deleteBank(bank.id)
    setBanks((prev) => prev.filter((b) => b.id !== bank.id))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Bancos</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie suas contas bancárias.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo banco
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
        <BankList banks={banks} onEdit={openEdit} onDelete={handleDelete} />
      )}

      <BankForm
        open={sheetOpen}
        bank={selectedBank}
        loading={saving}
        onSubmit={handleSubmit}
        onClose={closeSheet}
      />
    </div>
  )
}

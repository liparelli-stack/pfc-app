import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CardList } from '@/components/cards/CardList'
import { CardForm } from '@/components/cards/CardForm'
import {
  fetchCards,
  createCard,
  updateCard,
  deleteCard,
  type Card,
  type CardInput,
} from '@/services/cards.service'
import { fetchBanks, type Bank } from '@/services/banks.service'

export function Cards() {
  const [cards, setCards] = useState<Card[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [cardsData, banksData] = await Promise.all([fetchCards(), fetchBanks()])
      setCards(cardsData)
      setBanks(banksData)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar cartões.')
    } finally {
      setLoading(false)
    }
  }

  function openNew() {
    setSelectedCard(null)
    setSheetOpen(true)
  }

  function openEdit(card: Card) {
    setSelectedCard(card)
    setSheetOpen(true)
  }

  function closeSheet() {
    setSheetOpen(false)
    setSelectedCard(null)
  }

  async function handleSubmit(input: CardInput) {
    setSaving(true)
    try {
      if (selectedCard) {
        const updated = await updateCard(selectedCard.id, input)
        setCards((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        )
      } else {
        const created = await createCard(input)
        setCards((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      }
      closeSheet()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar cartão.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(card: Card) {
    await deleteCard(card.id)
    setCards((prev) => prev.filter((c) => c.id !== card.id))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Cartões</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie seus cartões de crédito.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          Novo cartão
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
        <CardList cards={cards} onEdit={openEdit} onDelete={handleDelete} />
      )}

      <CardForm
        open={sheetOpen}
        card={selectedCard}
        banks={banks}
        loading={saving}
        onSubmit={handleSubmit}
        onClose={closeSheet}
      />
    </div>
  )
}

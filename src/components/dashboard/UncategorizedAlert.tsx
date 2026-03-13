import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

interface UncategorizedAlertProps {
  count: number
  total: number
}

export function UncategorizedAlert({ count, total }: UncategorizedAlertProps) {
  const navigate = useNavigate()

  if (count === 0) return null

  return (
    <div className="flex items-center gap-4 rounded-xl border border-yellow-300 bg-yellow-50 px-5 py-4 shadow-sm dark:border-yellow-700 dark:bg-yellow-950/30">
      <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
          {count} transaç{count === 1 ? 'ão' : 'ões'} sem categoria
          {' '}—{' '}
          <span className="font-semibold">{brl.format(total)}</span> no total
        </p>
        <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
          Classifique as transações para obter análises mais precisas.
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0 border-yellow-400 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-600 dark:text-yellow-300 dark:hover:bg-yellow-900/40"
        onClick={() => navigate('/transacoes?classified=unclassified')}
      >
        Classificar agora
      </Button>
    </div>
  )
}

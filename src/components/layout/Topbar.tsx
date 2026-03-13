import { useLocation } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { signOut } from '@/services/auth.service'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/bancos': 'Bancos',
  '/cartoes': 'Cartões',
  '/transacoes': 'Transações',
  '/importar': 'Importar',
  '/analise': 'Análise IA',
  '/orcamento': 'Orçamento',
  '/categorias': 'Categorias',
  '/configuracoes': 'Configurações',
}

export function Topbar() {
  const { pathname } = useLocation()
  const title = pageTitles[pathname] ?? 'PFC'

  async function handleSignOut() {
    try {
      await signOut()
    } catch {
      toast.error('Erro ao sair. Tente novamente.')
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        className="text-muted-foreground hover:text-foreground"
      >
        <LogOut className="mr-2 h-4 w-4" />
        Sair
      </Button>
    </header>
  )
}

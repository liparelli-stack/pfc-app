import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  ArrowLeftRight,
  Upload,
  BrainCircuit,
  PiggyBank,
  Tag,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/bancos', label: 'Bancos', icon: Building2 },
  { to: '/cartoes', label: 'Cartões', icon: CreditCard },
  { to: '/transacoes', label: 'Transações', icon: ArrowLeftRight },
  { to: '/importar', label: 'Importar', icon: Upload },
  { to: '/analise', label: 'Análise IA', icon: BrainCircuit },
  { to: '/orcamento', label: 'Orçamento', icon: PiggyBank },
  { to: '/categorias', label: 'Categorias', icon: Tag },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

export function Sidebar() {
  return (
    <aside className="flex h-screen w-60 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border shrink-0">
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <span className="text-lg font-semibold tracking-tight">
          💰 Finanças
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}

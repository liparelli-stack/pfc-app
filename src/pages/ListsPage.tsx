/*
-- ===================================================
-- Código             : /src/pages/ListsPage.tsx
-- Versão (.v20)      : 3.0.0
-- Data/Hora          : 2025-12-06 16:30 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Página de Listas com menu horizontal e conteúdo por abas,
--                      com layout fluido em altura e scroll interno consistente
--                      com o restante do app (Dashboard, Orçamentos etc.).
-- Fluxo              : App.tsx -> ListsPage.tsx -> [Tabs de listagem]
-- Alterações (3.0.0) :
--   • [LAYOUT] Ajustado o container principal para usar
--              "flex flex-col h-full", permitindo que a área de conteúdo
--              ocupe toda a altura disponível da página.
--   • [LAYOUT] Envolvida a área de conteúdo em um wrapper
--              "flex-1 min-h-0 overflow-auto" para que as listas
--              (ações, contatos, empresas, orçamentos, notas, suporte)
--              possam rolar internamente sem "plate fixo" ou corte visual.
--   • [STYLE] Mantidos o menu horizontal e os componentes de listagem
--             exatamente como estavam, sem alterações de CSS nos tabs
--             (AcoesListTab, OrcamentosListTab, etc.), preservando o
--             estilo neumórfico já definido neles.
-- Dependências       : react, lucide-react,
--                      CompanyList, TicketList, AcoesListTab,
--                      ContactsListTab, OrcamentosListTab, NotasPorEmpresa
-- ===================================================
*/

import React, { useState } from 'react';
import {
  Users,
  Building,
  LifeBuoy,
  LucideIcon,
  ClipboardList,
  StickyNote,
  CalendarDays,
} from 'lucide-react';
import clsx from 'clsx';

// Importando os componentes de listagem
import CompanyList from '@/components/catalogs/CompanyList';
import TicketList from '@/components/support/TicketList';
import AcoesListTab from '@/components/lists/AcoesListTab';
import ContactsListTab from '@/components/lists/ContactsListTab';
import OrcamentosListTab from '@/components/lists/OrcamentosListTab';
import NotasPorEmpresa from '@/components/lists/NotasPorEmpresa';

type Section = 'ações' | 'contatos' | 'empresas' | 'orçamentos' | 'notas' | 'suporte';

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon: Icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={clsx(
      'flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200',
      {
        'neumorphic-concave text-primary': isActive,
        'neumorphic-convex hover:neumorphic-concave hover:text-primary': !isActive,
      }
    )}
    aria-current={isActive ? 'page' : undefined}
  >
    <Icon className="h-5 w-5" />
    <span className="font-semibold">{label}</span>
  </button>
);

const ListsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>('ações');

  const menuItems: { id: Section; label: string; icon: LucideIcon }[] = [
    { id: 'ações', label: 'Ações & Agenda', icon: CalendarDays },
    { id: 'contatos', label: 'Contatos', icon: Users },
    { id: 'empresas', label: 'Empresas', icon: Building },
    { id: 'orçamentos', label: 'Orçamentos', icon: ClipboardList },
    { id: 'notas', label: 'Notas', icon: StickyNote },
    { id: 'suporte', label: 'Suporte', icon: LifeBuoy },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'ações':
        return <AcoesListTab />;
      case 'empresas':
        return <CompanyList />;
      case 'suporte':
        return (
          <TicketList
            onTicketSelect={(id) => console.log(`Ticket selecionado: ${id}`)}
          />
        );
      case 'contatos':
        return <ContactsListTab />;
      case 'orçamentos':
        return <OrcamentosListTab />;
      case 'notas':
        return <NotasPorEmpresa />;
      default:
        return (
          <div className="text-center p-8 neumorphic-convex rounded-2xl">
            <h3 className="text-lg font-semibold">Em desenvolvimento</h3>
            <p className="text-gray-500">
              Esta seção de listagem estará disponível em breve.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <nav className="neumorphic-convex rounded-2xl p-2">
        <div className="flex flex-wrap items-center gap-2">
          {menuItems.map((item) => (
            <NavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              isActive={activeSection === item.id}
              onClick={() => setActiveSection(item.id)}
            />
          ))}
        </div>
      </nav>

      {/* Área de conteúdo flexível, com scroll interno */}
      <div className="flex-1 min-h-0 overflow-auto mt-2">
        {renderContent()}
      </div>
    </div>
  );
};

export default ListsPage;

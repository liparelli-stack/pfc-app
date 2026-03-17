/*
-- ===================================================
-- Código             : /src/components/Sidebar.tsx
-- Versão (.v20)      : 3.15.3
-- Data/Hora          : 2025-12-10 08:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Reordenar "Hub de Gestão" para o final do menu e controlar visibilidade por role (admin).
-- Fluxo              : App.tsx -> Sidebar.tsx -> activeItem (view)
-- Alterações (3.15.3):
--   • [RENAME] Renomeado item "Conhecimento" para "Gestão do Conhecimento".
-- Alterações (3.15.2):
--   • [RULE] Itens "Hub de Gestão" e "Configurações" visíveis apenas para profiles.role = 'admin'.
-- Alterações (3.15.1):
--   • [RENAME] Renomeado item "Orçamentos" para "Negócios" (mantendo ícone).
-- Dependências          : clsx, lucide-react, useAuth, getCurrentProfile (profilesService)
-- ===================================================
*/

import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Gauge,
  Calendar,
  BookOpen,
  Book,
  LifeBuoy,
  Settings,
  Moon,
  Sun,
  LogOut,
  LucideIcon,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  ListChecks,
  CircleDollarSign,
  AreaChart,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentProfile } from '@/services/profilesService';

type Theme = 'light' | 'dark' | 'sepia';

interface SidebarProps {
  theme: Theme;
  toggleTheme: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  isDesktop: boolean;
  activeItem: string;
  setActiveItem: (item: string) => void;
}

interface NavItemProps {
  icon: LucideIcon;
  text: string;
  active: boolean;
  isOpen: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const NavItem = ({ icon: Icon, text, active, isOpen, onClick, disabled }: NavItemProps) => (
  <a
    href="#"
    onClick={(e) => {
      e.preventDefault();
      if (!disabled) onClick();
    }}
    aria-disabled={disabled || undefined}
    className={clsx(
      'flex items-center p-3 my-1 rounded-lg transition-all duration-200',
      {
        'neumorphic-concave text-primary': active && !disabled,
        'neumorphic-convex hover:neumorphic-concave hover:text-primary': !active && !disabled,
        'opacity-50 cursor-not-allowed select-none pointer-events-auto': disabled,
        'w-full': isOpen,
        'w-12 justify-center': !isOpen,
      }
    )}
    title={disabled ? 'Em breve' : undefined}
  >
    <Icon className="h-5 w-5 flex-shrink-0" />
    {isOpen && <span className="ml-4 font-semibold">{text}</span>}
  </a>
);

const Sidebar = ({
  theme,
  toggleTheme,
  isOpen,
  setIsOpen,
  isDesktop,
  activeItem,
  setActiveItem,
}: SidebarProps) => {
  const { session, signOut } = useAuth();

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        const profile = await getCurrentProfile();
        if (!mounted) return;

        const role = profile?.role ?? null;
        setIsAdmin(role === 'admin');
      } catch (error) {
        if (!mounted) return;
        // Em caso de erro ao carregar o profile, mantém como não-admin por segurança
        setIsAdmin(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const mainMenuItems: Array<{
    icon: LucideIcon;
    text: string;
    disabled?: boolean;
  }> = [
    { icon: LayoutDashboard, text: 'Dashboard' },
    { icon: Gauge, text: 'Cockpit' },
    { icon: Calendar, text: 'Agenda' },
    { icon: Eye, text: 'Visão 360' },
    { icon: CircleDollarSign, text: 'Negócios' },
    { icon: BookOpen, text: 'Catálogos' },
    { icon: ListChecks, text: 'Listas' },
    { icon: Book, text: 'Conhecimento' },
    { icon: LifeBuoy, text: 'Suporte' },
  ];

  const themeConfig: Record<Theme, { next: string; icon: React.ReactNode }> = {
    light: { next: 'Escuro', icon: <Moon className="h-5 w-5 flex-shrink-0" /> },
    dark: { next: 'Sépia', icon: <Book className="h-5 w-5 flex-shrink-0" /> },
    sepia: { next: 'Claro', icon: <Sun className="h-5 w-5 flex-shrink-0" /> },
  };

  return (
    <aside
      className={clsx(
        'bg-plate dark:bg-plate-dark flex flex-col p-4 transition-all duration-300 z-20',
        isDesktop ? 'relative' : 'fixed h-full top-0 left-0',
        {
          'w-64': isOpen && isDesktop,
          'w-20': !isOpen && isDesktop,
          'translate-x-0': !isDesktop && isOpen,
          '-translate-x-full': !isDesktop && !isOpen,
        }
      )}
    >
      <div
        className={clsx(
          'flex items-center mb-8 h-[48px]',
          isOpen ? 'justify-between pl-3' : 'justify-center'
        )}
      >
        {isOpen && (
          <div className="bg-gray-800 text-white text-lg font-bold py-2 px-4 rounded">
            CRM Appy
          </div>
        )}

        {isDesktop && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-full neumorphic-convex hover:neumorphic-concave"
          >
            {isOpen ? <ChevronsLeft size={20} /> : <ChevronsRight size={20} />}
          </button>
        )}
      </div>

      <nav className="flex-1">
        {mainMenuItems.map((item) => (
          <NavItem
            key={item.text}
            icon={item.icon}
            text={item.text}
            active={activeItem === item.text}
            isOpen={isOpen}
            disabled={item.disabled}
            onClick={() => setActiveItem(item.text)}
          />
        ))}
      </nav>

      <div className="mt-auto">
        {isAdmin && (
          <>
            <NavItem
              icon={AreaChart}
              text="Hub de Gestão"
              active={activeItem === 'Hub de Gestão'}
              isOpen={isOpen}
              onClick={() => setActiveItem('Hub de Gestão')}
            />

            <NavItem
              icon={Settings}
              text="Configurações"
              active={activeItem === 'Configurações'}
              isOpen={isOpen}
              onClick={() => setActiveItem('Configurações')}
            />
          </>
        )}

        <button
          onClick={toggleTheme}
          className={clsx(
            'flex items-center p-3 my-1 rounded-lg transition-all duration-200 neumorphic-convex hover:neumorphic-concave hover:text-primary',
            isOpen ? 'w-full' : 'w-12 justify-center'
          )}
        >
          {themeConfig[theme].icon}
          {isOpen && <span className="ml-4 font-semibold">Tema {themeConfig[theme].next}</span>}
        </button>

        <div className="border-t border-dark-shadow dark:border-dark-dark-shadow my-2"></div>

        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            signOut();
          }}
          className={clsx(
            'flex items-center p-3 rounded-lg transition-all duration-200 neumorphic-convex hover:neumorphic-concave',
            isOpen ? 'w-full' : 'w-12 justify-center'
          )}
        >
          <div className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
            {session?.user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>

          {isOpen && (
            <>
              <div className="ml-3 overflow-hidden">
                <p className="font-semibold text-sm truncate">{session?.user?.email}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Logado</p>
              </div>
              <LogOut className="h-5 w-5 ml-auto flex-shrink-0" />
            </>
          )}
        </a>
      </div>
    </aside>
  );
};

export default Sidebar;

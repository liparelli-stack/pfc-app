/*
-- ===================================================
-- Código             : /src/components/Sidebar.tsx
-- Versão (.v21)      : 3.16.1
-- Data/Hora          : 2026-03-20 America/Sao_Paulo
-- Autor              : FL / Execução via Eva (Claude Sonnet 4.6)
-- Objetivo do codigo : Suporte completo aos 3 temas (dark / light / sépia)
-- Fluxo              : App.tsx -> Sidebar.tsx -> activeItem (view)
-- Alterações (3.16.1):
--   • [DS] Sidebar responde corretamente nos 3 modos:
--       dark  → bg #13151a, texto claro, borders rgba(255,255,255,...)
--       light → bg #ffffff, texto escuro, borders rgba(0,0,0,...)
--       sepia → bg var(--app-surface), texto var(--app-text)
--   • [DS] NavItem recebe prop `theme` para colorização correta
--   • [DS] Objeto `t` centraliza todos os tokens condicionais por tema
--   • [KEEP] Toda lógica preservada: isAdmin, collapse, signOut
-- ===================================================
*/

import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Gauge, Calendar, BookOpen, Book, LifeBuoy,
  Settings, Sun, LogOut, LucideIcon,
  ChevronsLeft, ChevronsRight, Eye, ListChecks, CircleDollarSign, AreaChart,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../contexts/AuthContext'
import { getCurrentProfile } from '@/services/profilesService'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

type Theme = 'light' | 'sepia' // dark descontinuado temporariamente (v0101)

interface SidebarProps {
  theme:         Theme
  toggleTheme:   () => void
  isOpen:        boolean
  setIsOpen:     (isOpen: boolean) => void
  isDesktop:     boolean
  activeItem:    string
  setActiveItem: (item: string) => void
}

interface NavItemProps {
  icon:      LucideIcon
  text:      string
  active:    boolean
  isOpen:    boolean
  onClick:   () => void
  theme:     Theme
  disabled?: boolean
  badge?:    number
}

// ─── TOKENS POR TEMA ─────────────────────────────────────────────────────────

const t = {
  aside: {
    dark:  'bg-dark-s1 border-r-[0.5px] border-dark-bmd shadow-sh1',
    light: 'bg-white border-r border-[rgba(0,0,0,0.10)] shadow-[0_1px_3px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.05)]',
    sepia: 'bg-[var(--app-surface)] border-r border-[var(--app-border)]',
  },
  label: {
    dark:  'text-dark-t3',
    light: 'text-[rgba(0,0,0,0.35)]',
    sepia: 'text-[var(--app-muted)]',
  },
  logo: {
    dark:  'bg-dark-s3 border-[0.5px] border-dark-bmd border-t-dark-bhi text-dark-t1',
    light: 'bg-[rgba(0,0,0,0.05)] border border-[rgba(0,0,0,0.10)] text-[#0f1117]',
    sepia: 'bg-[rgba(74,60,43,0.08)] border border-[var(--app-border)] text-[var(--app-text)]',
  },
  collapse: {
    dark:  'border-dark-bmd text-dark-t3 hover:bg-dark-s2 hover:border-dark-bhi hover:text-dark-t1',
    light: 'border-[rgba(0,0,0,0.12)] text-[rgba(0,0,0,0.35)] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#0f1117]',
    sepia: 'border-[var(--app-border)] text-[var(--app-muted)] hover:bg-[rgba(74,60,43,0.08)] hover:text-[var(--app-text)]',
  },
  navInactive: {
    dark:  'text-dark-t2 border-transparent hover:bg-dark-s2 hover:text-dark-t1 hover:border-dark-blo',
    light: 'text-[rgba(0,0,0,0.55)] border-transparent hover:bg-[rgba(0,0,0,0.05)] hover:text-[#0f1117]',
    sepia: 'text-[var(--app-muted)] border-transparent hover:bg-[rgba(74,60,43,0.08)] hover:text-[var(--app-text)]',
  },
  navActive: {
    dark:  'bg-accent-dim text-accent border-accent-20',
    light: 'bg-[rgba(28,76,150,0.08)] text-[#1c4c96] border-[rgba(28,76,150,0.20)]',
    sepia: 'bg-[rgba(161,98,7,0.10)] text-[var(--link)] border-[rgba(161,98,7,0.20)]',
  },
  navBadge: {
    dark:  'bg-dark-s3 text-dark-t3',
    light: 'bg-[rgba(0,0,0,0.08)] text-[rgba(0,0,0,0.45)]',
    sepia: 'bg-[rgba(74,60,43,0.10)] text-[var(--app-muted)]',
  },
  divider: {
    dark:  'bg-dark-blo',
    light: 'bg-[rgba(0,0,0,0.08)]',
    sepia: 'bg-[var(--app-border)]',
  },
  footerBtn: {
    dark:  'text-dark-t2 hover:bg-dark-s2 hover:text-dark-t1',
    light: 'text-[rgba(0,0,0,0.50)] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#0f1117]',
    sepia: 'text-[var(--app-muted)] hover:bg-[rgba(74,60,43,0.08)] hover:text-[var(--app-text)]',
  },
  userRow: {
    dark:  'hover:bg-dark-s2',
    light: 'hover:bg-[rgba(0,0,0,0.05)]',
    sepia: 'hover:bg-[rgba(74,60,43,0.08)]',
  },
  emailText: {
    dark:  'text-dark-t1',
    light: 'text-[#0f1117]',
    sepia: 'text-[var(--app-text)]',
  },
  mutedText: {
    dark:  'text-dark-t3',
    light: 'text-[rgba(0,0,0,0.40)]',
    sepia: 'text-[var(--app-muted)]',
  },
}

// ─── NAV ITEM ─────────────────────────────────────────────────────────────────

const NavItem = ({ icon: Icon, text, active, isOpen, onClick, disabled, badge, theme }: NavItemProps) => (
  <a
    href="#"
    onClick={(e) => { e.preventDefault(); if (!disabled) onClick() }}
    aria-disabled={disabled || undefined}
    title={disabled ? 'Em breve' : isOpen ? undefined : text}
    className={clsx(
      'flex items-center rounded my-[1px]',
      'font-sans font-normal text-body-md',
      'transition-[background,color,border-color] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]',
      'border-[0.5px]',
      'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      isOpen ? 'px-2.5 py-[6px] w-full' : 'w-9 h-9 justify-center',
      active && !disabled
        ? t.navActive[theme]
        : !disabled
          ? t.navInactive[theme]
          : 'opacity-40 cursor-not-allowed select-none border-transparent',
    )}
  >
    <Icon className={clsx('shrink-0', isOpen ? 'w-[13px] h-[13px]' : 'w-[14px] h-[14px]')} />
    {isOpen && (
      <>
        <span className="ml-[9px] flex-1 truncate">{text}</span>
        {badge !== undefined && badge > 0 && (
          <span className={clsx('ml-auto text-[10px] px-1.5 py-px rounded-full', t.navBadge[theme])}>
            {badge}
          </span>
        )}
      </>
    )}
  </a>
)

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────

const Sidebar = ({ theme, toggleTheme, isOpen, setIsOpen, isDesktop, activeItem, setActiveItem }: SidebarProps) => {
  const { session, signOut } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let mounted = true
    const loadProfile = async () => {
      try {
        const profile = await getCurrentProfile()
        if (!mounted) return
        setIsAdmin((profile?.role ?? null) === 'admin')
      } catch {
        if (!mounted) return
        setIsAdmin(false)
      }
    }
    loadProfile()
    return () => { mounted = false }
  }, [])

  const mainMenuItems: Array<{ icon: LucideIcon; text: string; disabled?: boolean }> = [
    { icon: LayoutDashboard,  text: 'Dashboard'    },
    { icon: Gauge,            text: 'Cockpit'      },
    { icon: Calendar,         text: 'Agenda'       },
    { icon: Eye,              text: 'Visão 360'    },
    { icon: CircleDollarSign, text: 'Negócios'     },
    { icon: BookOpen,         text: 'Catálogos'    },
    { icon: ListChecks,       text: 'Listas'       },
    { icon: Book,             text: 'Conhecimento' },
    { icon: LifeBuoy,         text: 'Suporte'      },
  ]

  const themeConfig: Record<Theme, { next: string; icon: React.ReactNode }> = {
    light: { next: 'Sépia', icon: <Book className="w-[13px] h-[13px] shrink-0" /> },
    sepia: { next: 'Claro', icon: <Sun  className="w-[13px] h-[13px] shrink-0" /> },
  }

  const emailInitial = session?.user?.email?.charAt(0).toUpperCase() ?? 'U'

  return (
    <aside
      className={clsx(
        'flex flex-col py-4 px-3 z-20',
        'transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
        t.aside[theme],
        isDesktop ? 'relative' : 'fixed h-full top-0 left-0',
        isDesktop && (isOpen ? 'w-56' : 'w-[56px]'),
        !isDesktop && 'w-56',
        !isDesktop && (isOpen ? 'translate-x-0' : '-translate-x-full'),
      )}
    >
      {/* LOGO + COLLAPSE */}
      <div className={clsx('flex items-center mb-2 h-[112px]', isOpen ? 'justify-between px-1' : 'justify-center')}>
        {isOpen && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img
              src="/logo-topo-menu.png"
              alt="CRM Appy"
              style={{ height: '112px', width: 'auto', objectFit: 'contain', maxWidth: '100%' }}
            />
          </div>
        )}
        {isDesktop && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            title={isOpen ? 'Recolher menu' : 'Expandir menu'}
            className={clsx(
              'flex items-center justify-center w-7 h-7 rounded border-[0.5px]',
              'transition-[background,border-color,color] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              t.collapse[theme],
            )}
          >
            {isOpen ? <ChevronsLeft className="w-3.5 h-3.5" /> : <ChevronsRight className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* LABEL MENU */}
      {isOpen && <div className={clsx('label-upper px-1 mb-2', t.label[theme])}>Menu</div>}

      {/* NAV PRINCIPAL */}
      <nav className="flex-1 flex flex-col gap-px">
        {mainMenuItems.map((item) => (
          <NavItem
            key={item.text}
            icon={item.icon}
            text={item.text}
            active={activeItem === item.text}
            isOpen={isOpen}
            disabled={item.disabled}
            theme={theme}
            onClick={() => setActiveItem(item.text)}
          />
        ))}
      </nav>

      {/* RODAPÉ */}
      <div className="mt-4 flex flex-col gap-px">
        {isAdmin && (
          <>
            {isOpen && <div className={clsx('label-upper px-1 mb-2 mt-1', t.label[theme])}>Config</div>}
            <NavItem icon={AreaChart} text="Hub de Gestão" active={activeItem === 'Hub de Gestão'} isOpen={isOpen} theme={theme} onClick={() => setActiveItem('Hub de Gestão')} />
            <NavItem icon={Settings}  text="Configurações" active={activeItem === 'Configurações'} isOpen={isOpen} theme={theme} onClick={() => setActiveItem('Configurações')} />
          </>
        )}

        <div className={clsx('my-2 h-px', t.divider[theme])} style={theme === 'sepia' ? {backgroundColor: 'var(--app-border)'} : undefined} />

        <button
          onClick={toggleTheme}
          className={clsx(
            'flex items-center rounded border-[0.5px] border-transparent',
            'font-sans font-normal text-body-md',
            'transition-[background,color,border-color] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            isOpen ? 'px-2.5 py-[6px] w-full' : 'w-9 h-9 justify-center',
            t.footerBtn[theme],
          )}
        >
          {themeConfig[theme].icon}
          {isOpen && <span className="ml-[9px]">Tema {themeConfig[theme].next}</span>}
        </button>

        <div className={clsx('my-2 h-px', t.divider[theme])} style={theme === 'sepia' ? {backgroundColor: 'var(--app-border)'} : undefined} />

        <a
          href="#"
          onClick={(e) => { e.preventDefault(); signOut() }}
          title="Sair"
          className={clsx(
            'flex items-center rounded border-[0.5px] border-transparent',
            'transition-[background,border-color] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            isOpen ? 'px-2 py-1.5 w-full gap-2.5' : 'w-9 h-9 justify-center',
            t.userRow[theme],
          )}
        >
          <div className="shrink-0 rounded flex items-center justify-center bg-accent-dim border-[0.5px] border-accent-20 text-accent text-[11px] font-medium w-6 h-6">
            {emailInitial}
          </div>
          {isOpen && (
            <>
              <div className="flex-1 overflow-hidden min-w-0">
                <p className={clsx('text-body-sm font-normal truncate leading-tight', t.emailText[theme])}>
                  {session?.user?.email}
                </p>
                <p className={clsx('text-[12px] leading-tight', t.mutedText[theme])}>Logado</p>
              </div>
              <LogOut className={clsx('w-3.5 h-3.5 shrink-0', t.mutedText[theme])} />
            </>
          )}
        </a>
      </div>
    </aside>
  )
}

export default Sidebar

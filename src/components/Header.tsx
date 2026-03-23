/*
-- ===================================================
-- Código             : /src/components/Header.tsx
-- Versão (.v21)      : 1.3.0
-- Data/Hora          : 2026-03-20 America/Sao_Paulo
-- Autor              : FL / Execução via Eva (Claude Sonnet 4.6)
-- Objetivo do codigo : Suporte completo aos 3 temas (dark / light / sépia)
-- Fluxo              : App.tsx -> Header.tsx
-- Alterações (1.3.0):
--   • [DS] Header responde corretamente nos 3 modos via prop `theme`
--       dark  → bg dark-s1, border dark-bmd, texto dark-t1
--       light → bg white, border rgba(0,0,0,0.10), texto #0f1117
--       sepia → bg var(--app-surface), border var(--app-border)
--   • [DS] Objeto `t` centraliza tokens condicionais por tema
--   • [DS] Input busca: cores adaptadas por tema
--   • [DS] Menu button: cores adaptadas por tema
--   • [KEEP] Props, lógica e regra lg:hidden preservados
-- Dependências       : lucide-react, React
-- ===================================================
*/

import { Search, Menu } from 'lucide-react'
import { FC } from 'react'
import clsx from 'clsx'

type Theme = 'light' | 'dark' | 'sepia'

interface HeaderProps {
  onMenuClick: () => void
  title:       string
  theme:       Theme
}

// ─── TOKENS POR TEMA ─────────────────────────────────────────────────────────

const t = {
  header: {
    dark:  'bg-dark-s1 border-b-[0.5px] border-dark-bmd',
    light: 'bg-white border-b border-[rgba(0,0,0,0.10)] shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
    sepia: 'bg-[var(--app-surface)] border-b border-[var(--app-border)]',
  },
  menuBtn: {
    dark:  'border-dark-bmd text-dark-t2 hover:bg-dark-s2 hover:border-dark-bhi hover:text-dark-t1',
    light: 'border-[rgba(0,0,0,0.12)] text-[rgba(0,0,0,0.40)] hover:bg-[rgba(0,0,0,0.05)] hover:text-[#0f1117]',
    sepia: 'border-[var(--app-border)] text-[var(--app-muted)] hover:bg-[rgba(74,60,43,0.08)] hover:text-[var(--app-text)]',
  },
  title: {
    dark:  'text-dark-t1',
    light: 'text-[#0f1117]',
    sepia: 'text-[var(--app-text)]',
  },
  searchIcon: {
    dark:  'text-dark-t3',
    light: 'text-[rgba(0,0,0,0.30)]',
    sepia: 'text-[var(--app-muted)]',
  },
  input: {
    dark:  'bg-dark-s2 text-dark-t1 placeholder:text-dark-t3 border-dark-bmd focus:border-accent focus:shadow-focus-accent',
    light: 'bg-[rgba(0,0,0,0.04)] text-[#0f1117] placeholder:text-[rgba(0,0,0,0.30)] border-[rgba(0,0,0,0.10)] focus:border-[#1c4c96] focus:shadow-[0_0_0_3px_rgba(28,76,150,0.12)]',
    sepia: 'bg-[#fffbf0] text-[var(--app-text)] placeholder:text-[var(--app-muted)] border-[var(--app-border)] focus:border-[var(--link)] focus:shadow-[0_0_0_3px_rgba(161,98,7,0.12)]',
  },
}

// ─── COMPONENTE ──────────────────────────────────────────────────────────────

const Header: FC<HeaderProps> = ({ onMenuClick, title, theme }) => {
  return (
    <header
      className={clsx(
        'flex items-center justify-between',
        'px-4 py-3 sm:px-6',
        'flex-shrink-0',
        t.header[theme],
      )}
    >
      {/* ── ESQUERDA: menu mobile + título ─────────────────────────────── */}
      <div className="flex items-center gap-3">

        {/* Botão menu — [RULE] apenas em telas < lg */}
        <button
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className={clsx(
            'lg:hidden',
            'flex items-center justify-center w-8 h-8 rounded',
            'border-[0.5px]',
            'transition-[background,border-color,color] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            t.menuBtn[theme],
          )}
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Título */}
        <h1 className={clsx('text-heading font-medium tracking-tight-sm capitalize', t.title[theme])}>
          {title}
        </h1>
      </div>

      {/* ── DIREITA: busca ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block">
          <Search
            className={clsx(
              'absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none',
              t.searchIcon[theme],
            )}
          />
          <input
            type="text"
            placeholder="Buscar..."
            className={clsx(
              'font-sans font-normal text-body',
              'border-[0.5px] rounded',
              'w-36 sm:w-48 md:w-72',
              'pl-9 pr-3 py-[7px]',
              'outline-none',
              'transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]',
              t.input[theme],
            )}
          />
        </div>
      </div>
    </header>
  )
}

export default Header

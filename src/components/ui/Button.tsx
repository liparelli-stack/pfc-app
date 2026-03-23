import { forwardRef, ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?:    ButtonSize
  loading?: boolean
  /** Ícone à esquerda do label */
  iconLeft?: React.ReactNode
  /** Ícone à direita do label */
  iconRight?: React.ReactNode
}

// ─── VARIANTES ───────────────────────────────────────────────────────────────

const variantClasses: Record<ButtonVariant, string> = {
  // Primário — azul CRMappy com glow
  primary: [
    'bg-accent text-white font-medium',
    'border border-accent-border',
    'shadow-btn-primary',
    'hover:opacity-[0.88] hover:shadow-btn-primary-hover',
  ].join(' '),

  // Secundário — surface layer2 com border
  secondary: [
    'bg-dark-s2 text-dark-t1',
    'border border-dark-bmd',
    'hover:bg-dark-s3 hover:border-dark-bhi',
    // Light mode
    'dark:bg-dark-s2 dark:text-dark-t1 dark:border-dark-bmd',
    'dark:hover:bg-dark-s3 dark:hover:border-dark-bhi',
  ].join(' '),

  // Danger — vermelho sutil
  danger: [
    'bg-transparent text-danger',
    'border border-danger-border',
    'hover:bg-danger-dim',
  ].join(' '),

  // Ghost — sem borda, só hover
  ghost: [
    'bg-transparent text-dark-t2',
    'border border-transparent',
    'hover:bg-dark-s2 hover:text-dark-t1 hover:border-dark-blo',
  ].join(' '),
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7  px-3   text-body    gap-1.5',
  md: 'h-8  px-[15px] text-body gap-1.5',
  lg: 'h-10 px-5   text-body-md gap-2',
}

// ─── COMPONENTE ──────────────────────────────────────────────────────────────

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant  = 'secondary',
      size     = 'md',
      loading  = false,
      iconLeft,
      iconRight,
      children,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={clsx(
          // Base
          'inline-flex items-center justify-center',
          'font-sans font-normal rounded',
          'outline-none',
          // Transição global do sistema
          'transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]',
          // Hover / active / focus
          'active:scale-[0.97]',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          // Disabled
          'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
          // Variante e tamanho
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {/* Loading spinner */}
        {loading && (
          <span
            aria-hidden="true"
            className="h-3.5 w-3.5 rounded-full border border-current border-t-transparent animate-spin"
          />
        )}

        {/* Ícone esquerdo */}
        {!loading && iconLeft && (
          <span className="shrink-0 opacity-70">{iconLeft}</span>
        )}

        {/* Label */}
        {children && <span>{children}</span>}

        {/* Ícone direito */}
        {iconRight && (
          <span className="shrink-0 opacity-70">{iconRight}</span>
        )}
      </button>
    )
  },
)

Button.displayName = 'Button'

// ─── USO ─────────────────────────────────────────────────────────────────────
/*
  <Button variant="primary">Nova ação</Button>
  <Button variant="secondary">Exportar</Button>
  <Button variant="danger">Remover</Button>
  <Button variant="ghost" size="sm">Ver mais</Button>
  <Button variant="primary" loading>Salvando…</Button>
  <Button variant="secondary" iconLeft={<PlusIcon size={13} />}>Adicionar</Button>
*/

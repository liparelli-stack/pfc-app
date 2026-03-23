import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

type CardVariant  = 'default' | 'flat' | 'accent'
type CardPadding  = 'none' | 'sm' | 'md' | 'lg'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?:    CardVariant
  padding?:    CardPadding
  /** Ativa efeito hover (translateY + shadow upgrade) */
  hoverable?:  boolean
  /** Borda accent ring — ex: card selecionado */
  selected?:   boolean
}

// ─── VARIANTES ───────────────────────────────────────────────────────────────

const variantClasses: Record<CardVariant, string> = {
  // Layer 1 — card base padrão do sistema
  default: [
    'bg-dark-s1',
    // Border: médio nas laterais/baixo, claro no topo (simula luz vinda de cima)
    'border-[0.5px] border-dark-bmd border-t-dark-bhi',
    'shadow-sh1',
  ].join(' '),

  // Flat — sem sombra, apenas border
  flat: [
    'bg-dark-s2',
    'border-[0.5px] border-dark-blo',
  ].join(' '),

  // Accent — glow azul, usado para destaque / estado ativo
  accent: [
    'bg-dark-s1',
    'border-[0.5px] border-accent-border',
    'shadow-sha',
  ].join(' '),
}

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm:   'p-3',
  md:   'p-[18px]',    // 18px — padrão cockpit card
  lg:   'p-[22px]',    // 22px — padrão KPI card
}

// ─── COMPONENTE ──────────────────────────────────────────────────────────────

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant   = 'default',
      padding   = 'md',
      hoverable = false,
      selected  = false,
      children,
      className,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-lg',
          'transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]',
          // Variante base
          variantClasses[variant],
          // Padding
          paddingClasses[padding],
          // Hoverable
          hoverable && [
            'cursor-default',
            'hover:-translate-y-0.5 hover:shadow-sh2 hover:border-dark-bhi',
          ],
          // Selected — sobrescreve border com accent ring
          selected && 'border-accent-border shadow-sha',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  },
)

Card.displayName = 'Card'

// ─── SUBCOMPONENTES ──────────────────────────────────────────────────────────

/** Header de card com label + action slot */
interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  action?: React.ReactNode
}

export function CardHeader({ children, action, className, ...props }: CardHeaderProps) {
  return (
    <div
      className={clsx('flex items-center justify-between mb-2.5', className)}
      {...props}
    >
      <span className="text-body font-medium text-dark-t1 tracking-tight-sm">
        {children}
      </span>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  )
}

/** Label de KPI dentro do card */
export function CardLabel({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx('text-body-sm text-dark-t3 mb-2.5', className)}
      {...props}
    >
      {children}
    </div>
  )
}

/** Valor principal do KPI */
export function CardValue({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx('text-display font-medium text-white tracking-kpi leading-none', className)}
      {...props}
    >
      {children}
    </div>
  )
}

/** Delta do KPI — positivo (verde) ou negativo (vermelho) */
interface CardDeltaProps extends HTMLAttributes<HTMLDivElement> {
  direction?: 'up' | 'down' | 'neutral'
}

export function CardDelta({ children, direction = 'neutral', className, ...props }: CardDeltaProps) {
  return (
    <div
      className={clsx(
        'flex items-center gap-1 mt-2 text-caption',
        direction === 'up'      && 'text-success',
        direction === 'down'    && 'text-danger',
        direction === 'neutral' && 'text-dark-t3',
        className,
      )}
      {...props}
    >
      {direction === 'up' && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M5 8V2M2 5l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
      {direction === 'down' && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M5 2v6M2 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </div>
  )
}

// ─── USO ─────────────────────────────────────────────────────────────────────
/*
  // KPI Card
  <Card padding="lg" hoverable>
    <CardLabel>Receita projetada</CardLabel>
    <CardValue>R$ 184k</CardValue>
    <CardDelta direction="up">+12% vs mês anterior</CardDelta>
  </Card>

  // Cockpit card
  <Card>
    <CardHeader action={<Badge variant="open">Aberta</Badge>}>
      Acme Tecnologia Ltda
    </CardHeader>
    ...
  </Card>

  // Card accent (selecionado)
  <Card variant="accent" selected>...</Card>

  // Card flat (row de lista)
  <Card variant="flat" padding="sm" hoverable>...</Card>
*/

import { HTMLAttributes } from 'react'
import { clsx } from 'clsx'

// ─── TIPOS ────────────────────────────────────────────────────────────────────

type BadgeVariant =
  | 'success'   // Verde  — Ganha / Concluída
  | 'danger'    // Vermelho — Perdida / Atrasada
  | 'warning'   // Âmbar — Em espera / Morno
  | 'open'      // Azul  — Aberta / Pendente
  | 'ai'        // Roxo  — AI Insight
  | 'neutral'   // Cinza — estado neutro

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?:  BadgeVariant
  /** Mostrar dot indicador à esquerda (padrão: true) */
  dot?:      boolean
  /** Tamanho do badge */
  size?:     'sm' | 'md'
}

// ─── VARIANTES ───────────────────────────────────────────────────────────────

const variantClasses: Record<BadgeVariant, { wrap: string; dot: string }> = {
  success: {
    wrap: 'bg-success-dim text-success border-[0.5px] border-success-border',
    dot:  'bg-success',
  },
  danger: {
    wrap: 'bg-danger-dim text-danger border-[0.5px] border-danger-border',
    dot:  'bg-danger',
  },
  warning: {
    wrap: 'bg-warning-dim text-warning border-[0.5px] border-warning-border',
    dot:  'bg-warning',
  },
  open: {
    wrap: 'bg-accent-dim text-accent border-[0.5px] border-accent-20',
    dot:  'bg-accent',
  },
  ai: {
    wrap: 'bg-ai-dim text-ai border-[0.5px] border-ai-border',
    dot:  'bg-ai',
  },
  neutral: {
    wrap: 'bg-dark-s3 text-dark-t3 border-[0.5px] border-dark-blo',
    dot:  'bg-dark-t3',
  },
}

const sizeClasses = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-2.5 py-[3px] text-caption',
}

// ─── COMPONENTE ──────────────────────────────────────────────────────────────

export function Badge({
  variant = 'neutral',
  dot     = true,
  size    = 'md',
  children,
  className,
  ...props
}: BadgeProps) {
  const { wrap, dot: dotColor } = variantClasses[variant]

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-[5px] rounded-full font-sans font-normal',
        wrap,
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={clsx('shrink-0 rounded-full', dotColor)}
          style={{ width: 5, height: 5 }}
        />
      )}
      {children}
    </span>
  )
}

// ─── MAPEAMENTOS SEMÂNTICOS CRMappy ──────────────────────────────────────────

/** Mapeia status de deal → variante de badge */
export function DealStatusBadge({ status }: { status: 'aberta' | 'ganha' | 'perdida' | 'em_espera' }) {
  const map: Record<typeof status, { variant: BadgeVariant; label: string }> = {
    aberta:    { variant: 'open',    label: 'Aberta'    },
    ganha:     { variant: 'success', label: 'Ganha'     },
    perdida:   { variant: 'danger',  label: 'Perdida'   },
    em_espera: { variant: 'warning', label: 'Em espera' },
  }
  const { variant, label } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}

/** Mapeia status de action/ticket → variante de badge */
export function ActionStatusBadge({ isDone, isLate }: { isDone: boolean; isLate?: boolean }) {
  if (isDone)   return <Badge variant="success">Concluída</Badge>
  if (isLate)   return <Badge variant="danger">Atrasada</Badge>
  return              <Badge variant="warning">Pendente</Badge>
}

/** Badge de temperatura de lead */
export function TemperatureBadge({ temp }: { temp: 'quente' | 'morno' | 'frio' }) {
  const map: Record<typeof temp, { variant: BadgeVariant; label: string }> = {
    quente: { variant: 'danger',  label: 'Quente' },
    morno:  { variant: 'warning', label: 'Morno'  },
    frio:   { variant: 'open',    label: 'Frio'   },
  }
  const { variant, label } = map[temp]
  return <Badge variant={variant}>{label}</Badge>
}

// ─── USO ─────────────────────────────────────────────────────────────────────
/*
  <Badge variant="success">Ganha</Badge>
  <Badge variant="danger">Perdida</Badge>
  <Badge variant="warning">Em espera</Badge>
  <Badge variant="open">Aberta</Badge>
  <Badge variant="ai">AI Insight</Badge>
  <Badge variant="neutral" dot={false}>Rascunho</Badge>

  // Semânticos
  <DealStatusBadge status="ganha" />
  <ActionStatusBadge isDone={false} isLate={true} />
  <TemperatureBadge temp="quente" />
*/

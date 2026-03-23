import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, useId } from 'react'
import { clsx } from 'clsx'

// ─── INPUT WRAPPER ────────────────────────────────────────────────────────────

interface InputWrapperProps {
  label?:    string
  error?:    string
  hint?:     string
  required?: boolean
  children:  React.ReactNode
  className?: string
}

export function InputWrapper({ label, error, hint, required, children, className }: InputWrapperProps) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && (
        <label className="text-caption font-normal text-dark-t2">
          {label}
          {required && <span className="text-danger ml-0.5" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="text-caption text-danger flex items-center gap-1" role="alert">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M6 4v2.5M6 8h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-caption text-dark-t3">{hint}</p>
      )}
    </div>
  )
}

// ─── INPUT ────────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:       string
  error?:       string
  hint?:        string
  /** Ícone à esquerda (Lucide ou SVG) */
  iconLeft?:    React.ReactNode
  /** Ícone/ação à direita */
  iconRight?:   React.ReactNode
  wrapClassName?: string
}

const inputBaseClasses = [
  // Layout
  'w-full font-sans font-normal text-body',
  // Cores
  'bg-dark-s2 text-dark-t1 placeholder:text-dark-t3',
  // Border padrão
  'border-[0.5px] border-dark-bmd',
  // Border radius
  'rounded',
  // Padding (ajustado se tiver ícone — via px- no wrapper)
  'px-3 py-2',
  // Outline
  'outline-none',
  // Transição
  'transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]',
  // Focus — border accent + ring
  'focus:border-accent focus:shadow-focus-accent',
  // Disabled
  'disabled:opacity-40 disabled:cursor-not-allowed',
  // Erro
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:shadow-focus-danger',
].join(' ')

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      iconLeft,
      iconRight,
      wrapClassName,
      className,
      required,
      id: idProp,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId()
    const id = idProp ?? generatedId

    return (
      <InputWrapper
        label={label}
        error={error}
        hint={hint}
        required={required}
        className={wrapClassName}
      >
        <div className="relative flex items-center">
          {iconLeft && (
            <span className="absolute left-3 text-dark-t3 shrink-0 pointer-events-none">
              {iconLeft}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            className={clsx(
              inputBaseClasses,
              iconLeft  && 'pl-9',
              iconRight && 'pr-9',
              className,
            )}
            {...props}
          />
          {iconRight && (
            <span className="absolute right-3 text-dark-t3 shrink-0">
              {iconRight}
            </span>
          )}
        </div>
      </InputWrapper>
    )
  },
)

Input.displayName = 'Input'

// ─── TEXTAREA ────────────────────────────────────────────────────────────────

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?:        string
  error?:        string
  hint?:         string
  wrapClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, wrapClassName, className, required, id: idProp, ...props }, ref) => {
    const generatedId = useId()
    const id = idProp ?? generatedId

    return (
      <InputWrapper label={label} error={error} hint={hint} required={required} className={wrapClassName}>
        <textarea
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          rows={3}
          className={clsx(
            inputBaseClasses,
            'resize-y min-h-[80px]',
            className,
          )}
          {...props}
        />
      </InputWrapper>
    )
  },
)

Textarea.displayName = 'Textarea'

// ─── USO ─────────────────────────────────────────────────────────────────────
/*
  // Simples
  <Input placeholder="Buscar empresa..." />

  // Com label e hint
  <Input
    label="E-mail"
    hint="Usado para login e notificações"
    type="email"
    required
  />

  // Com erro
  <Input
    label="Telefone"
    error="Formato inválido. Use (00) 00000-0000"
    value={value}
  />

  // Com ícone
  <Input
    placeholder="Buscar..."
    iconLeft={<SearchIcon size={14} />}
  />

  // Textarea
  <Textarea
    label="Observações"
    hint="Visível apenas para a equipe"
    placeholder="Adicionar nota..."
  />
*/

/*
-- ===================================================
-- Código: /src/components/ui/Select.tsx
-- Versão: 1.1.0
-- Data/Hora: 2025-10-13 14:10 -03
-- Autor: FL / Eva (E.V.A.)
-- Objetivo: Componente <Select> com caret embutido (▾) e suporte a label,
--           mantendo a API existente (label obrigatório).
-- Fluxo: Usado em TenantForm.tsx e ContactChannelsModal.tsx (campo "Tipo").
-- Dependências: react, clsx
-- Notas:
--   - Mantém assinatura: { label: string; error?: string; ...native }
--   - Usa appearance-none + caret absoluto à direita (pointer-events: none).
--   - padding-right ampliado (pr-10) para não sobrepor o caret.
--   - Acessível: htmlFor, aria-invalid, foco visível.
-- ===================================================
*/
import clsx from 'clsx';
import { forwardRef } from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, name, error, children, className, disabled, ...props }, ref) => {
    const selectClasses = clsx(
      "w-full pl-4 pr-10 py-2.5 rounded-lg",
      "bg-plate dark:bg-dark-s1 neumorphic-concave",
      "focus:bg-white dark:focus:bg-gray-700",
      "transition-colors duration-200 outline-none",
      "appearance-none", // remove caret nativo para usar o custom
      disabled && "opacity-60 cursor-not-allowed",
      error && "border-2 border-red-500",
      className
    );

    return (
      <div className="w-full">
        <label
          htmlFor={name}
          className="block text-sm font-medium mb-1 text-gray-600 dark:text-dark-t1"
        >
          {label}
        </label>

        <div className="relative">
          <select
            id={name}
            name={name}
            ref={ref}
            className={selectClasses}
            aria-invalid={error ? 'true' : 'false'}
            disabled={disabled}
            {...props}
          >
            {children}
          </select>

          {/* Caret embutido */}
          <span
            aria-hidden="true"
            className={clsx(
              "pointer-events-none absolute inset-y-0 right-3",
              "flex items-center text-gray-500 dark:text-dark-t2"
            )}
          >
            {/* SVG caret (chevron down) para evitar dependência extra */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              role="img"
              focusable="false"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>

        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </div>
    );
  }
);

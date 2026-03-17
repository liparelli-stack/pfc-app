/*
-- ===================================================
-- Código: /src/components/ui/Input.tsx
-- Data/Hora: 2025-05-22 17:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Aprimorar o componente para incluir um ícone clicável (usado para visualização de senha).
-- Fluxo: Usado em AuthPage.tsx e TenantForm.tsx.
-- Dependências: react, clsx
-- ===================================================
*/
import clsx from 'clsx';
import { forwardRef, ReactNode } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: ReactNode;
  onIconClick?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, name, error, className, icon, onIconClick, ...props }, ref) => {
  return (
    <div className="w-full">
      <label htmlFor={name} className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">{label}</label>
      <div className="relative">
        <input
          id={name}
          name={name}
          ref={ref}
          className={clsx(
            "w-full pl-4 py-2.5 rounded-lg bg-plate dark:bg-plate-dark neumorphic-concave focus:bg-white dark:focus:bg-gray-700 transition-colors duration-200 outline-none",
            { 'border-2 border-red-500': error },
            { 'pr-10': icon },
            className
          )}
          {...props}
        />
        {icon && (
          <button
            type="button"
            onClick={onIconClick}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-primary focus:outline-none"
            aria-label="Toggle action"
          >
            {icon}
          </button>
        )}
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
});

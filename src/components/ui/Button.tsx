/*
-- ===================================================
-- Código             : /src/components/ui/Button.tsx
-- Versão (.v20)      : 1.1.1
-- Data/Hora          : 2025-12-01 14:30 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Componente de botão reutilizável com variantes.
--                      • type padrão = 'submit'
--                      • disabled coerente: isLoading || disabled
--                      • forwardRef para foco/integrações
--                      • Suporte a variantes visuais (default, primary, danger, ghost)
-- Fluxo              : UI Button -> usado em formulários, ações gerais e links de ação
-- Alterações (1.1.1) :
--    • Adicionada variant "ghost" para suportar botões de ação secundária (+ Próxima ação, Cancelar, etc.).
--    • Garantido fallback visual consistente para qualquer uso existente de variant="ghost".
-- Dependências       : react, clsx
-- ===================================================
*/
import React, { forwardRef } from 'react';
import clsx from 'clsx';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'default' | 'ghost';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, variant = 'default', isLoading = false, className, type, disabled, ...rest },
  ref
) {
  const baseStyle =
    'px-6 py-2.5 font-semibold rounded-lg transition-all duration-200 flex items-center justify-center';

  const variantStyles: Record<NonNullable<ButtonProps['variant']>, string> = {
    default:
      'neumorphic-convex hover:neumorphic-concave active:neumorphic-concave',
    primary:
      'bg-gradient-to-r from-blue-500 to-primary text-white shadow-lg hover:shadow-xl transform hover:scale-105',
    danger:
      'bg-red-500 text-white shadow-lg hover:bg-red-600',
    ghost:
      // Botão leve, texto azul, sem preenchimento forte (para ações secundárias).
      'bg-transparent text-primary hover:bg-primary/10 hover:text-primary font-semibold',
  };

  const computedDisabled = Boolean(isLoading || disabled);
  const btnType =
    (type as React.ButtonHTMLAttributes<HTMLButtonElement>['type']) ?? 'submit';

  return (
    <button
      ref={ref}
      {...rest}
      type={btnType}
      disabled={computedDisabled}
      className={clsx(
        baseStyle,
        variantStyles[variant],
        { 'opacity-50 cursor-not-allowed': computedDisabled },
        className
      )}
      aria-busy={isLoading || undefined}
    >
      {isLoading ? (
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
      ) : (
        children
      )}
    </button>
  );
});

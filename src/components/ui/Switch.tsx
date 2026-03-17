/*
-- ===================================================
-- Código: /src/components/ui/Switch.tsx
-- Versão: 1.0
-- Data/Hora: 2025-05-23 18:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Componente de toggle switch estilizado.
-- Fluxo: Usado no formulário de perfis (ProfileForm.tsx).
-- Dependências: react, @radix-ui/react-switch, clsx
-- ===================================================
*/
import * as SwitchPrimitives from '@radix-ui/react-switch';
import clsx from 'clsx';
import { forwardRef } from 'react';

export const Switch = forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={clsx(
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-primary data-[state=unchecked]:bg-dark-shadow dark:data-[state=unchecked]:bg-dark-dark-shadow',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={clsx(
        'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0'
      )}
    />
  </SwitchPrimitives.Root>
));

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
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=unchecked]:[background:var(--s3)] data-[state=unchecked]:[border:0.5px_solid_var(--blo)]',
      'data-[state=checked]:[background:var(--acc)] data-[state=checked]:[border:0.5px_solid_var(--abrd)]',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={clsx(
        'pointer-events-none block h-5 w-5 rounded-full shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0',
        'data-[state=unchecked]:[background:var(--t3)] data-[state=checked]:bg-white'
      )}
    />
  </SwitchPrimitives.Root>
));

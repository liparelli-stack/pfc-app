/*
-- ===================================================
-- Código: /src/components/ui/Skeleton.tsx
-- Data/Hora: 2025-05-22 13:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Criar um componente de skeleton para indicar loading.
-- Fluxo: Usado em TenantForm.tsx.
-- Dependências: clsx
-- ===================================================
*/
import clsx from 'clsx';

export const Skeleton = ({ className }: { className?: string }) => {
  return (
    <div className={clsx('animate-pulse rounded-md bg-gray-300 dark:bg-gray-600', className)} />
  );
};

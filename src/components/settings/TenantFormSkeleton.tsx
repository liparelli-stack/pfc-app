/*
-- ===================================================
-- Código: /src/components/settings/TenantFormSkeleton.tsx
-- Data/Hora: 2025-05-23 10:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Criar um skeleton para o formulário de tenant, melhorando a UX durante o carregamento.
-- Fluxo: Renderizado em OrganizationSettings.tsx enquanto os dados são buscados.
-- Dependências: ../ui/Skeleton.tsx
-- ===================================================
*/
import { Skeleton } from '../ui/Skeleton';

export const TenantFormSkeleton = () => {
  return (
    <div className="bg-plate dark:bg-dark-s1 rounded-2xl p-8 neumorphic-convex">
      <Skeleton className="h-8 w-1/3 mb-6" />

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(12)].map((_, i) => (
            <div key={i}>
              <Skeleton className="h-5 w-1/4 mb-1" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-6 mt-6 border-t border-dark-shadow dark:border-dark-dark-shadow">
          <Skeleton className="h-10 w-28" />
          <div className="flex gap-4">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
      </div>
    </div>
  );
};

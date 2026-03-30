/*
-- ===================================================
-- Código             : src/hooks/useBaseDiagnostics.ts
-- Versão             : 1.0.0
-- Data/Hora          : 2026-03-29 America/Sao_Paulo
-- Autor              : FL / Claude
-- Objetivo           : Hook React Query para diagnóstico da base.
-- ===================================================
*/

import { useQuery } from '@tanstack/react-query';
import { getBaseDiagnostics, BaseDiagnosticsData } from '@/services/baseDiagnosticsService';
import { useAuth } from '@/contexts/AuthContext';

export default function useBaseDiagnostics() {
  const { currentProfileLite } = useAuth();
  const tenantId = currentProfileLite?.tenantId ?? null;

  return useQuery<BaseDiagnosticsData>({
    queryKey: ['base-diagnostics', tenantId],
    queryFn: () => getBaseDiagnostics(tenantId!),
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5,
  });
}

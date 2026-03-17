/*
-- ===================================================
-- Código             : /src/providers/ReactQueryProvider.tsx
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-11-06 23:45 America/Sao_Paulo
-- Autor              : FL / Execução via E.V.A.
-- Objetivo do código : Injetar QueryClientProvider (React Query v5) na árvore do app.
-- Dependências       : @tanstack/react-query
-- ===================================================
*/
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

type Props = { children: React.ReactNode };

export const ReactQueryProvider: React.FC<Props> = ({ children }) => {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

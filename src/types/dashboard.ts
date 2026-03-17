/*
-- ===================================================
-- Código             : /src/types/dashboard.ts
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-11-06 22:48 America/Sao_Paulo
-- Autor              : FL / Execução via E.V.A.
-- Objetivo do código : Tipos usados no Quadro 1 (C/P/L + Top 6 Estados)
-- ===================================================
*/

export interface CompanyMix {
  kind: 'lead' | 'prospect' | 'client';
  qtd: number;
  pct: number;
  total_base: number;
}

export interface CompanyByState {
  label: string;
  total: number;
  pct: number;
}

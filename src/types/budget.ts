/*
-- ===================================================
-- Código             : /src/types/budget.ts
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-12-03 10:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Tipagem para a entidade de Orçamento.
-- ===================================================
*/

export interface Budget {
  id: string;
  mes: string;
  kind: string;
  valor: number;
}

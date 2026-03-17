/*
-- ===================================================
-- Código             : /src/utils/budgetExporter.ts
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-12-03 10:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Utilitário para exportar a lista de orçamentos para Excel com pivotagem.
-- ===================================================
*/
import * as XLSX from 'xlsx';
import { Budget } from '@/types/budget';

const generateFilename = (prefix: string, extension: string): string => {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `${prefix}_${dateStr}.${extension}`;
};

export const exportBudgetsToExcel = (data: Budget[]) => {
  // 1. Pivotar os dados
  const pivotedData = new Map<string, any>();
  const allKinds = new Set<string>();

  data.forEach(item => {
    allKinds.add(item.kind);
    if (!pivotedData.has(item.mes)) {
      pivotedData.set(item.mes, { 'Mês': item.mes });
    }
    const row = pivotedData.get(item.mes);
    row[item.kind] = (row[item.kind] || 0) + item.valor;
  });

  const finalData = Array.from(pivotedData.values());
  const headers = ['Mês', ...Array.from(allKinds).sort()];
  
  // Garante que todas as linhas tenham todas as colunas
  finalData.forEach(row => {
    headers.forEach(header => {
      if (header !== 'Mês' && !row.hasOwnProperty(header)) {
        row[header] = 0;
      }
    });
  });

  // 2. Gerar o arquivo Excel
  const ws = XLSX.utils.json_to_sheet(finalData, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Orçamentos Pivotados');

  XLSX.writeFile(wb, generateFilename('orcamento', 'xlsx'));
};

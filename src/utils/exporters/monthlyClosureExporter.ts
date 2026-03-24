/*
-- =====================================================================================================
-- Código             : src/utils/exporters/monthlyClosureExporter.ts
-- Versão (.v20)      : 0.1.0
-- Data/Hora          : 2026-03-24 19:00 America/Sao_Paulo
-- Autor              : FL / Execução via (Eva Claude Modelo) (Alpha Dualite modelo LLM)
-- Objetivo do codigo : Exportadores de dados de fechamento mensal:
--                      • Excel (xlsx) - formatado com tabelas
--                      • CSV - formato simples
--                      • PDF (jsPDF) - relatório formatado
-- Dependências       : xlsx, jsPDF, jspdf-autotable, file-saver → monthlyClosureExporter.ts
-- Versão/Alteração   :
-- [ 0.1.0 ]          : Versão inicial - SUP-000004
-- =====================================================================================================
*/

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { MonthData, SellerRow } from '@/services/monthlyClosureService';

/* ============================================================
   Helpers
   ============================================================ */

const brl = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const pct = (value: number) => `${value}%`;

function filename(mes: string, ext: string) {
  return `fechamento_${mes}.${ext}`;
}

function buildRows(sellers: SellerRow[]) {
  return sellers.map((s) => ({
    Vendedor:         s.seller_name,
    'Meta (R$)':      s.goal,
    'Realizado (R$)': s.realized,
    'Qtd Ganhos':     s.count,
    'Performance (%)': s.performance,
    'Perdido (R$)':   s.lost,
  }));
}

/* ============================================================
   Excel
   ============================================================ */

export function exportToExcel(data: MonthData): void {
  const rows = buildRows(data.sellers);

  // Linha de totais
  rows.push({
    Vendedor:          'TOTAL',
    'Meta (R$)':       data.total_goal,
    'Realizado (R$)':  data.total_realized,
    'Qtd Ganhos':      data.sellers.reduce((s, r) => s + r.count, 0),
    'Performance (%)': data.performance,
    'Perdido (R$)':    data.total_lost,
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Larguras de coluna
  ws['!cols'] = [
    { wch: 28 },  // Vendedor
    { wch: 16 },  // Meta
    { wch: 16 },  // Realizado
    { wch: 12 },  // Qtd
    { wch: 16 },  // Performance
    { wch: 16 },  // Perdido
  ];

  const wb = XLSX.utils.book_new();
  const sheetName = `Fechamento ${data.mes}`;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), filename(data.mes, 'xlsx'));
}

/* ============================================================
   CSV
   ============================================================ */

export function exportToCSV(data: MonthData): void {
  const headers = ['Vendedor', 'Meta R$', 'Realizado R$', 'Qtd Ganhos', 'Performance %', 'Perdido R$'];
  const lines = [
    headers.join(';'),
    ...data.sellers.map((s) =>
      [s.seller_name, s.goal, s.realized, s.count, s.performance, s.lost].join(';'),
    ),
    // Linha de totais
    [
      'TOTAL',
      data.total_goal,
      data.total_realized,
      data.sellers.reduce((s, r) => s + r.count, 0),
      data.performance,
      data.total_lost,
    ].join(';'),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, filename(data.mes, 'csv'));
}

/* ============================================================
   PDF
   ============================================================ */

export function exportToPDF(data: MonthData): void {
  const doc = new jsPDF({ orientation: 'landscape' });

  // Cabeçalho
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Fechamento Mensal — ${data.mes}`, 14, 16);

  const status = data.is_closed
    ? `Fechado em ${new Date(data.closed_at!).toLocaleDateString('pt-BR')}`
    : 'Aberto (dados em tempo real)';

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(status, 14, 23);

  // Cards de resumo
  doc.setFontSize(9);
  const summaryY = 30;
  const summaryItems = [
    ['Total Ganho',   brl(data.total_realized)],
    ['Total Meta',    brl(data.total_goal)],
    ['Performance',   pct(data.performance)],
    ['Total Perdido', brl(data.total_lost)],
  ];
  summaryItems.forEach(([label, value], i) => {
    const x = 14 + i * 70;
    doc.setFont('helvetica', 'bold');
    doc.text(label, x, summaryY);
    doc.setFont('helvetica', 'normal');
    doc.text(value, x, summaryY + 5);
  });

  // Tabela de vendedores
  const tableRows = data.sellers.map((s) => [
    s.seller_name,
    brl(s.goal),
    brl(s.realized),
    String(s.count),
    pct(s.performance),
    brl(s.lost),
  ]);

  // Linha de totais
  tableRows.push([
    'TOTAL',
    brl(data.total_goal),
    brl(data.total_realized),
    String(data.sellers.reduce((s, r) => s + r.count, 0)),
    pct(data.performance),
    brl(data.total_lost),
  ]);

  autoTable(doc, {
    startY: summaryY + 14,
    head: [['Vendedor', 'Meta R$', 'Realizado R$', 'Qtd', 'Performance', 'Perdido R$']],
    body: tableRows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 104, 245] },
    // Destaca linha de totais
    didParseCell: (hookData) => {
      if (hookData.row.index === tableRows.length - 1) {
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
  });

  doc.save(filename(data.mes, 'pdf'));
}

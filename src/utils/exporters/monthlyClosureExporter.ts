/*
-- =====================================================================================================
-- Código             : src/utils/exporters/monthlyClosureExporter.ts
-- Versão (.v20)      : 0.2.0
-- Data/Hora          : 2026-03-24 19:00 America/Sao_Paulo
-- Autor              : FL / Execução via (Eva Claude Modelo) (Alpha Dualite modelo LLM)
-- Objetivo do codigo : Exportadores de dados de fechamento mensal:
--                      • Excel (xlsx) - formatado com tabelas
--                      • CSV - formato simples
--                      • PDF (jsPDF) - relatório formatado
-- Dependências       : xlsx, jsPDF, jspdf-autotable, file-saver → monthlyClosureExporter.ts
-- Versão/Alteração   :
-- [ 0.1.0 ]          : Versão inicial
-- [ 0.2.0 ]          : Alinhamento com schema real (SellerRow + MonthData v0.4.0):
--                        seller_name→salesperson_name, goal→target_amount,
--                        realized→total_ganha, count→qty_ganha,
--                        performance→performance_pct, lost→total_perdida;
--                        MonthData: total_goal→target_amount, total_realized→total_ganha,
--                        performance→performance_pct, total_lost→total_perdida
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
    Vendedor:          s.salesperson_name,
    'Meta (R$)':       s.target_amount,
    'Realizado (R$)':  s.total_ganha,
    'Qtd Ganhos':      s.qty_ganha,
    'Performance (%)': s.performance_pct,
    'Perdido (R$)':    s.total_perdida,
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
    'Meta (R$)':       data.target_amount,
    'Realizado (R$)':  data.total_ganha,
    'Qtd Ganhos':      data.sellers.reduce((s, r) => s + r.qty_ganha, 0),
    'Performance (%)': data.performance_pct,
    'Perdido (R$)':    data.total_perdida,
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  ws['!cols'] = [
    { wch: 28 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Fechamento ${data.mes}`);

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
      [s.salesperson_name, s.target_amount, s.total_ganha, s.qty_ganha, s.performance_pct, s.total_perdida].join(';'),
    ),
    [
      'TOTAL',
      data.target_amount,
      data.total_ganha,
      data.sellers.reduce((s, r) => s + r.qty_ganha, 0),
      data.performance_pct,
      data.total_perdida,
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

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Fechamento Mensal — ${data.mes}`, 14, 16);

  const status = data.is_closed
    ? `Fechado em ${new Date(data.closed_at!).toLocaleDateString('pt-BR')}`
    : 'Aberto (dados em tempo real)';

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(status, 14, 23);

  doc.setFontSize(9);
  const summaryY = 30;
  const summaryItems = [
    ['Total Ganho',   brl(data.total_ganha)],
    ['Total Meta',    brl(data.target_amount)],
    ['Performance',   pct(data.performance_pct)],
    ['Total Perdido', brl(data.total_perdida)],
  ];
  summaryItems.forEach(([label, value], i) => {
    const x = 14 + i * 70;
    doc.setFont('helvetica', 'bold');
    doc.text(label, x, summaryY);
    doc.setFont('helvetica', 'normal');
    doc.text(value, x, summaryY + 5);
  });

  const tableRows = data.sellers.map((s) => [
    s.salesperson_name,
    brl(s.target_amount),
    brl(s.total_ganha),
    String(s.qty_ganha),
    pct(s.performance_pct),
    brl(s.total_perdida),
  ]);

  tableRows.push([
    'TOTAL',
    brl(data.target_amount),
    brl(data.total_ganha),
    String(data.sellers.reduce((s, r) => s + r.qty_ganha, 0)),
    pct(data.performance_pct),
    brl(data.total_perdida),
  ]);

  autoTable(doc, {
    startY: summaryY + 14,
    head: [['Vendedor', 'Meta R$', 'Realizado R$', 'Qtd', 'Performance', 'Perdido R$']],
    body: tableRows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 104, 245] },
    didParseCell: (hookData) => {
      if (hookData.row.index === tableRows.length - 1) {
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
  });

  doc.save(filename(data.mes, 'pdf'));
}

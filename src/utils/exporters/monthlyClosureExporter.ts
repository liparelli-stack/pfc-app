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
import type { MonthData, SellerRow, DetalhamentoRow } from '@/services/monthlyClosureService';

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

function buildStatusRows(data: MonthData) {
  const totalGeral = data.total_ganha + data.total_perdida + data.total_aberta;
  const qtdGeral   = data.qty_ganha   + data.qty_perdida   + data.qty_aberta;
  const participacao = (total: number) =>
    totalGeral > 0 ? `${((total / totalGeral) * 100).toFixed(2)}%` : '0.00%';
  const ticketMedio = (total: number, qty: number) =>
    qty > 0 ? brl(total / qty) : brl(0);

  const rows = [
    {
      Status:                'Ganha',
      Qtd:                   data.qty_ganha,
      'Total R$':            brl(data.total_ganha),
      '% Participação':      participacao(data.total_ganha),
      'Ticket Médio (R$)':   ticketMedio(data.total_ganha, data.qty_ganha),
    },
    {
      Status:                'Perdida',
      Qtd:                   data.qty_perdida,
      'Total R$':            brl(data.total_perdida),
      '% Participação':      participacao(data.total_perdida),
      'Ticket Médio (R$)':   ticketMedio(data.total_perdida, data.qty_perdida),
    },
    {
      Status:                'Em Espera',
      Qtd:                   data.qty_aberta,
      'Total R$':            brl(data.total_aberta),
      '% Participação':      participacao(data.total_aberta),
      'Ticket Médio (R$)':   ticketMedio(data.total_aberta, data.qty_aberta),
    },
    {
      Status:                'TOTAL GERAL',
      Qtd:                   qtdGeral,
      'Total R$':            brl(totalGeral),
      '% Participação':      '100%',
      'Ticket Médio (R$)':   ticketMedio(totalGeral, qtdGeral),
    },
  ];

  if (data.qty_encerrada > 0) {
    rows.splice(3, 0, {
      Status:                'Encerrado',
      Qtd:                   data.qty_encerrada,
      'Total R$':            brl(data.total_encerrada),
      '% Participação':      '—',
      'Ticket Médio (R$)':   ticketMedio(data.total_encerrada, data.qty_encerrada),
    });
  }

  return rows;
}

/* ============================================================
   Excel
   ============================================================ */

export function exportToExcel(data: MonthData): void {
  const rows = buildStatusRows(data);

  const ws = XLSX.utils.json_to_sheet(rows);

  ws['!cols'] = [
    { wch: 16 },
    { wch: 10 },
    { wch: 18 },
    { wch: 16 },
    { wch: 18 },
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
  const headers = ['Status', 'Qtd', 'Total R$', '% Participação', 'Ticket Médio (R$)'];
  const rows = buildStatusRows(data);
  const lines = [
    headers.join(';'),
    ...rows.map((r) =>
      [r.Status, r.Qtd, r['Total R$'], r['% Participação'], r['Ticket Médio (R$)']].join(';'),
    ),
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

  const statusRows = buildStatusRows(data);
  const tableRows = statusRows.map((r) => [
    r.Status,
    String(r.Qtd),
    r['Total R$'],
    r['% Participação'],
    r['Ticket Médio (R$)'],
  ]);

  autoTable(doc, {
    startY: summaryY + 14,
    head: [['Status', 'Qtd', 'Total R$', '% Participação', 'Ticket Médio (R$)']],
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

/* ============================================================
   Excel — Detalhamento de Conferência
   ============================================================ */

export function exportDetalhamentoExcel(
  rows: DetalhamentoRow[],
  mes: string,
  nomeArquivo?: string,
): void {
  const wsData = rows.map((r) => ({
    'Vendedor':           r.vendedor_nome,
    'Cliente':            r.cliente_nome,
    'Valor (R$)':         r.valor,
    'Status Fechamento':  r.status_fechamento,
    'Data Mudança':       r.data_mudanca
      ? new Date(r.data_mudanca).toLocaleDateString('pt-BR')
      : '',
    'Status Atual':       r.status_atual,
    'Mudou Depois?':      r.mudou_apos ? 'Sim' : 'Não',
    'Dias até Fechar':    r.dias_ate_fechamento ?? '',
    'Budget ID':          r.budget_id,
    'Chat ID':            r.chat_id,
    'Observação':         r.observacao,
    'Motivo Perda':       r.motivo_perda,
  }));

  const ws = XLSX.utils.json_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 22 }, // Vendedor
    { wch: 30 }, // Cliente
    { wch: 16 }, // Valor
    { wch: 18 }, // Status Fechamento
    { wch: 14 }, // Data Mudança
    { wch: 14 }, // Status Atual
    { wch: 14 }, // Mudou Depois?
    { wch: 14 }, // Dias até Fechar
    { wch: 32 }, // Budget ID
    { wch: 32 }, // Chat ID
    { wch: 28 }, // Observação
    { wch: 28 }, // Motivo Perda
  ];

  // Formato moeda na coluna C (Valor)
  wsData.forEach((_, i) => {
    const ref = `C${i + 2}`;
    if (ws[ref]) ws[ref].z = 'R$ #,##0.00';
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Detalhamento');

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  saveAs(
    new Blob([buf], { type: 'application/octet-stream' }),
    nomeArquivo ?? `conferencia_${mes}.xlsx`,
  );
}

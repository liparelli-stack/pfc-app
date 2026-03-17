/*
-- ===================================================
-- Código             : /src/utils/contactsExporter.ts
-- Versão (.v20)      : 1.2.0
-- Data/Hora          : 2025-12-05 00:40 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Exportar contatos para PDF / CSV / Excel,
--                      incluindo:
--                        • Empresa (companies.trade_name)
--                        • Responsável (profiles.full_name, ex.: owner_full_name)
-- Alterações (1.2.0) :
--   • [FEAT] Incluída coluna "Responsável" em todas as exportações.
--   • [NOTE] Campo de origem esperado: contact.owner_full_name
--           (enriquecido previamente no service que monta ContactWithCompany[]).
-- Dependências       : jspdf, jspdf-autotable, xlsx, @/types/contact
-- ===================================================
*/
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ContactWithCompany } from '@/types/contact';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// --- Helpers ---
const escapeCsvField = (field: any): string => {
  if (field === null || field === undefined) return '';
  const stringField = String(field);
  if (stringField.includes(';') || stringField.includes('"') || stringField.includes('\n')) {
    const escapedField = stringField.replace(/"/g, '""');
    return `"${escapedField}"`;
  }
  return stringField;
};

const generateFilename = (prefix: string, extension: string): string => {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  return `${prefix}_${dateStr}.${extension}`;
};

const formatBirthday = (birthDayMonth: string | null | undefined): string => {
  if (!birthDayMonth) return '—';
  const parts = birthDayMonth.split('-');
  if (parts.length === 2) {
    const [month, day] = parts;
    if (!isNaN(parseInt(day)) && !isNaN(parseInt(month))) {
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}`;
    }
  }
  if (parts.length === 1) {
    const monthIndex = parseInt(parts[0], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      const date = new Date(2000, monthIndex);
      return date.toLocaleString('pt-BR', { month: 'long' });
    }
  }
  return birthDayMonth;
};

const getChannelsString = (channels: ContactWithCompany['channels']): string => {
  if (!channels || channels.length === 0) return 'N/A';
  return channels.map(c => `${c.type}: ${c.value}`).join(' | ');
};

/**
 * Responsável do contato (profiles.full_name).
 *
 * Espera receber já enriquecido em contact.owner_full_name
 * pelo service de listagem (ex.: join com profiles).
 */
const getOwnerFullName = (contact: ContactWithCompany): string => {
  const anyContact = contact as any;
  return (anyContact.owner_full_name as string) || '—';
};

// Cabeçalhos na ordem: Empresa, Responsável, Contato, Cargo, Departamento, Status, Mês Aniv., Canais, Notas
const HEADERS = [
  'Empresa',
  'Responsável',
  'Contato',
  'Cargo',
  'Departamento',
  'Status',
  'Mês Aniv.',
  'Canais',
  'Notas',
];

// --- PDF Export ---
export const exportContactsToPdf = (contacts: ContactWithCompany[]) => {
  const doc = new jsPDF();
  doc.text('Lista de Contatos', 14, 16);

  const body = contacts.map(contact => [
    contact.company?.trade_name || 'N/A',             // Empresa (trade_name)
    getOwnerFullName(contact),                       // Responsável (profiles.full_name)
    contact.full_name,                               // Contato
    contact.position || '—',                         // Cargo
    contact.department || '—',                       // Departamento
    contact.status === 'active' ? 'Ativo' : 'Inativo', // Status
    formatBirthday(contact.birth_day_month),         // Mês Aniv.
    getChannelsString(contact.channels),             // Canais
    contact.notes || '',                             // Notas
  ]);

  doc.autoTable({
    head: [HEADERS],
    body,
    startY: 24,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [28, 76, 150] },
  });

  doc.save(generateFilename('contatos', 'pdf'));
};

// --- CSV Export ---
export const exportContactsToCsv = (contacts: ContactWithCompany[]) => {
  const csvRows = [HEADERS.join(';')];

  contacts.forEach(contact => {
    const row = [
      contact.company?.trade_name || 'N/A',             // Empresa
      getOwnerFullName(contact),                       // Responsável
      contact.full_name,                               // Contato
      contact.position || '—',                         // Cargo
      contact.department || '—',                       // Departamento
      contact.status === 'active' ? 'Ativo' : 'Inativo', // Status
      formatBirthday(contact.birth_day_month),         // Mês Aniv.
      getChannelsString(contact.channels),             // Canais
      contact.notes || '',                             // Notas
    ].map(escapeCsvField);
    csvRows.push(row.join(';'));
  });

  const csvString = csvRows.join('\n');
  const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = generateFilename('contatos', 'csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

// --- Excel Export ---
export const exportContactsToExcel = (contacts: ContactWithCompany[]) => {
  const data = contacts.map(contact => ({
    Empresa: contact.company?.trade_name || 'N/A',
    Responsável: getOwnerFullName(contact),
    Contato: contact.full_name,
    Cargo: contact.position || '—',
    Departamento: contact.department || '—',
    Status: contact.status === 'active' ? 'Ativo' : 'Inativo',
    'Mês Aniv.': formatBirthday(contact.birth_day_month),
    Canais: getChannelsString(contact.channels),
    Notas: contact.notes || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data, { header: HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Contatos');

  XLSX.writeFile(wb, generateFilename('contatos', 'xlsx'));
};

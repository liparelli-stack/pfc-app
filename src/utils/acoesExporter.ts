import { ChatListItem } from '@/types/chat';
import { isPast, parseISO } from 'date-fns';
import * as XLSX from 'xlsx';

// --- Helpers ---
const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');
const formatTime = (time: string | null) => (time ? time.slice(0, 5) : '');

const getSituation = (item: ChatListItem): string => {
  if (item.is_done) return 'Finalizada';
  if (item.calendar_at) {
    const dateTimeString = `${item.calendar_at}T${item.on_time || '00:00:00'}`;
    try {
      if (isPast(parseISO(dateTimeString))) return 'Atraso';
    } catch {
      /* ignore invalid date */
    }
  }
  return 'No prazo';
};

const getTemperatureLabel = (temp: string | null): string => {
  const normalizedTemp = (temp || 'Neutra').toLowerCase();
  if (normalizedTemp === 'fria') return 'Fria';
  if (normalizedTemp === 'morna') return 'Morna';
  if (normalizedTemp === 'quente') return 'Quente';
  return 'Neutra';
};

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
    now.getDate()
  ).padStart(2, '0')}`;
  return `${prefix}_${dateStr}.${extension}`;
};

// --- Export to CSV ---
export const exportAcoesToCsv = (items: ChatListItem[]) => {
  const headers = [
    "Data", "Situação", "Canal", "Temperatura", "Assunto",
    "Empresa", "Responsável", "Atualizado", "Status", "Etiquetas"
  ];

  const csvRows = [headers.join(';')];

  items.forEach(item => {
    const row = [
      `${formatDate(item.calendar_at)} ${formatTime(item.on_time)}`.trim(),
      getSituation(item),
      item.channel_type || 'N/A',
      getTemperatureLabel(item.temperature),
      item.subject || 'Sem Assunto',
      item.company_name || '',
      item.author_name || 'N/A',
      formatDate(item.updated_at),
      item.is_done ? 'Concluída' : 'Em Andamento',
      item.tags?.join(', ') || ''
    ].map(escapeCsvField);
    csvRows.push(row.join(';'));
  });

  const csvString = csvRows.join('\n');
  const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = generateFilename('acoes_agenda', 'csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

// --- Export to Excel ---
export const exportAcoesToExcel = (items: ChatListItem[]) => {
  const headers = {
    Data: "Data",
    Situação: "Situação",
    Canal: "Canal",
    Temperatura: "Temperatura",
    Assunto: "Assunto",
    Empresa: "Empresa",
    Responsável: "Responsável",
    Atualizado: "Atualizado",
    Status: "Status",
    Etiquetas: "Etiquetas"
  };

  const data = items.map(item => ({
    [headers.Data]: `${formatDate(item.calendar_at)} ${formatTime(item.on_time)}`.trim(),
    [headers.Situação]: getSituation(item),
    [headers.Canal]: item.channel_type || 'N/A',
    [headers.Temperatura]: getTemperatureLabel(item.temperature),
    [headers.Assunto]: item.subject || 'Sem Assunto',
    [headers.Empresa]: item.company_name || '',
    [headers.Responsável]: item.author_name || 'N/A',
    [headers.Atualizado]: formatDate(item.updated_at),
    [headers.Status]: item.is_done ? 'Concluída' : 'Em Andamento',
    [headers.Etiquetas]: item.tags?.join(', ') || ''
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Ações e Agenda');

  XLSX.writeFile(wb, generateFilename('acoes_agenda', 'xlsx'));
};

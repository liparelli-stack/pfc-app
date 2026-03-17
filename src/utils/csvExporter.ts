/*
-- ===================================================
-- Código             : /src/utils/csvExporter.ts
-- Versão (.v20)      : 2.2.0
-- Data/Hora          : 2025-12-07 04:55 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Utilitários para exportação de dados em CSV.
--                      • Exportação rica de Empresas (CRM) em MODO B
--                        (empresa explode para N linhas, 1 por contato),
--                        alinhada com Excel e PDF gerencial.
--                      • Exportação genérica full mantém comportamento anterior.
-- Fluxo              : CompanyList -> listAllCompaniesForExport -> exportCompaniesToCSV
-- Alterações (2.2.0) :
--   • [ENRICH] exportCompaniesToCSV passa a exportar colunas ricas:
--     Responsável, Tipo, Segmento, Classificação, ABC, Qualificação, Endereço,
--     Situação, Website, etc.
--   • [CONSISTÊNCIA] Colunas e ordem alinhadas com Excel.
--   • [SANITIZAÇÃO] Removidos NaN/null/undefined na saída.
-- Dependências       : CompanyWithContacts.
-- ===================================================
*/

import { CompanyWithContacts } from '@/types/company';

// Helper to format date as YYYY-MM-DD HH:mm
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return '';
  }
};

// Sanitiza campo para evitar NaN, null, undefined etc.
const sanitizeField = (value: any, fallback = ''): string => {
  if (value === null || value === undefined) return fallback;
  const str = String(value).trim();
  if (!str) return fallback;
  const lower = str.toLowerCase();
  if (['nan', 'null', 'undefined'].includes(lower)) return fallback;
  return str;
};

// Helper to safely escape CSV fields
const escapeCsvField = (field: any): string => {
  if (field === null || field === undefined) {
    return '';
  }
  const stringField = String(field);
  // If the field contains a semicolon, a double quote, or a newline, wrap it in double quotes.
  if (stringField.includes(';') || stringField.includes('"') || stringField.includes('\n')) {
    // Escape existing double quotes by doubling them
    const escapedField = stringField.replace(/"/g, '""');
    return `"${escapedField}"`;
  }
  return stringField;
};

// Helper to trigger browser download
const triggerDownload = (filename: string, content: string) => {
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Traduções para campos lógicos
const translateKind = (kind?: string | null): string => {
  switch (kind) {
    case 'client':
      return 'Cliente';
    case 'lead':
      return 'Lead';
    case 'prospect':
      return 'Prospect';
    default:
      return '';
  }
};

const translateStatus = (status?: string | null): string => {
  switch (status) {
    case 'active':
      return 'Ativo';
    case 'inactive':
      return 'Inativo';
    default:
      return '';
  }
};

// -----------------------------------------------------------------------------
// Exportação específica (Empresas + Contatos) — MODO B rico
// -----------------------------------------------------------------------------
export const exportCompaniesToCSV = (companies: CompanyWithContacts[]) => {
  const headers = [
    'Empresa (Nome Fantasia)',
    'Razão Social',
    'CNPJ',
    'Responsável',
    'Email (Empresa)',
    'Telefone (Empresa)',
    'Website',
    'Tipo',
    'Segmento',
    'Classificação',
    'ABC',
    'Qualificação',
    'Endereço',
    'Cidade',
    'UF',
    'CEP',
    'Situação',
    'Nome do Contato',
    'Cargo do Contato',
    'Email do Contato',
    'Telefone do Contato',
    'Data de Criação (Empresa)',
    'Última Atualização (Empresa)',
  ];

  const csvRows: string[] = [];
  csvRows.push(headers.map(escapeCsvField).join(';'));

  companies.forEach(company => {
    const tradeName = sanitizeField(company.trade_name);
    const legalName = sanitizeField(company.legal_name);
    const taxId = sanitizeField(company.tax_id);
    const ownerName = sanitizeField((company as any).owner_name);

    const emailEmpresa = sanitizeField(company.email);
    const phoneEmpresa = sanitizeField(company.phone);
    const website = sanitizeField(company.website);

    const kindPT = translateKind(company.kind as any);
    const segmento = sanitizeField((company as any).segment);
    const classificacao = sanitizeField((company as any).business_classification);
    const abc = sanitizeField((company as any).abc_analysis);
    const qualif = sanitizeField(company.qualification);

    const enderecoParts = [
      sanitizeField((company as any).address_line, ''),
      sanitizeField((company as any).neighborhood, ''),
    ].filter(Boolean);
    const endereco = enderecoParts.join(', ');

    const city = sanitizeField(company.city);
    const state = sanitizeField(company.state);
    const zip = sanitizeField(company.zip_code);
    const statusPT = translateStatus(company.status as any);

    const companyCreationDate = formatDate(company.created_at || null);
    const companyUpdateDate = formatDate(company.updated_at || null);

    const contacts = company.contacts && company.contacts.length > 0 ? company.contacts : [null];

    contacts.forEach(contact => {
      const mainEmail =
        contact?.channels?.find(c => c.type === 'email')?.value || '';
      const mainPhone =
        contact?.channels?.find(c => c.type === 'phone')?.value || '';

      const row = [
        tradeName,
        legalName,
        taxId,
        ownerName,
        emailEmpresa,
        phoneEmpresa,
        website,
        kindPT,
        segmento,
        classificacao,
        abc,
        qualif,
        endereco,
        city,
        state,
        zip,
        statusPT,
        contact ? sanitizeField(contact.full_name) : '',
        contact ? sanitizeField(contact.position) : '',
        sanitizeField(mainEmail),
        sanitizeField(mainPhone),
        companyCreationDate,
        companyUpdateDate,
      ].map(escapeCsvField);

      csvRows.push(row.join(';'));
    });
  });

  const csvString = csvRows.join('\n');

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(
    now.getMinutes(),
  ).padStart(2, '0')}`;

  triggerDownload(`Empresas_${dateStr}_${timeStr}.csv`, csvString);
};

// -----------------------------------------------------------------------------
// Exportação genérica "full" de qualquer tabela
// -----------------------------------------------------------------------------

type GenericRecord = Record<string, any>;

/**
 * Exporta um array de registros em CSV puro com todas as colunas.
 * As colunas são derivadas das chaves do primeiro registro.
 * A coluna tenant_id é automaticamente removida.
 */
export const exportGenericTableToCSV = (rows: GenericRecord[], tableLabel: string) => {
  if (!rows || rows.length === 0) return;

  const excludedKeys = ['tenant_id'];
  const headers = Object.keys(rows[0]).filter(key => !excludedKeys.includes(key));

  const csvRows: string[] = [];

  // Cabeçalho
  csvRows.push(headers.map(escapeCsvField).join(';'));

  // Linhas
  rows.forEach(row => {
    const line = headers
      .map(key => {
        const value = row[key];
        return escapeCsvField(value);
      })
      .join(';');
    csvRows.push(line);
  });

  const csvString = csvRows.join('\n');

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate(),).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours(),).padStart(2, '0')}${String(
    now.getMinutes(),
  ).padStart(2, '0')}`;

  const filename = `${tableLabel}_${dateStr}_${timeStr}.csv`;
  triggerDownload(filename, csvString);
};

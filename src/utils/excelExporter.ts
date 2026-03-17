/*
-- ===================================================
-- Código             : /src/utils/excelExporter.ts
-- Versão (.v20)      : 2.0.0
-- Data/Hora          : 2025-12-07 04:40 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Exportar empresas em Excel (XLSX) em formato rico,
--                      MODO B (empresa explode para N linhas, 1 por contato),
--                      alinhado com PDF gerencial e CSV rico.
-- Fluxo              : CompanyList -> listAllCompaniesForExport -> exportCompaniesToExcel
-- Dependências       : xlsx, CompanyWithContacts
-- ===================================================
*/

import { CompanyWithContacts } from '@/types/company';
import * as XLSX from 'xlsx';

// Helper para formatar a data como AAAA-MM-DD HH:mm
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

// Traduções opcionais (para colunas amigáveis em PT-BR)
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

export const exportCompaniesToExcel = (companies: CompanyWithContacts[]) => {
  // Cabeçalho rico – 1 linha por contato
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

  const data: (string | number)[][] = [headers];

  companies.forEach((company) => {
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

    const createdAt = formatDate(company.created_at || null);
    const updatedAt = formatDate(company.updated_at || null);

    const contacts = company.contacts && company.contacts.length > 0 ? company.contacts : [null];

    contacts.forEach((contact) => {
      const mainEmail =
        contact?.channels?.find((c) => c.type === 'email')?.value || '';
      const mainPhone =
        contact?.channels?.find((c) => c.type === 'phone')?.value || '';

      const row: (string | number)[] = [
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
        createdAt,
        updatedAt,
      ];

      data.push(row);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Empresas');

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(now.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(
    now.getMinutes()
  ).padStart(2, '0')}`;
  const fileName = `Empresas_${dateStr}_${timeStr}.xlsx`;

  XLSX.writeFile(wb, fileName);
};

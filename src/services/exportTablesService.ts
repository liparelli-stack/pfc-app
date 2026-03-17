/*
-- ===================================================
-- Código             : /src/services/exportTablesService.ts
-- Versão (.v20)      : 2.1.0
-- Data/Hora          : 2025-12-05 02:05 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Serviço de exportação de tabelas em CSV puro
--                      para a aba "Exportação de Tabelas" em Configurações.
--                      • Paginação interna (contorna limite de 1000 linhas).
--                      • companies com owner_full_name (profiles.full_name).
--                      • contacts_channel com telefone/ramal formatados e
--                        enrich de empresa + responsável.
--                      • contacts com company_trade_name + owner_full_name.
--                      • Colunas de debug para validar versão de export.
-- Fluxo              : SettingsPage -> ExportTablesSettings -> exportTablesService
-- Dependências       : supabaseClient, csvExporter.
-- ===================================================
*/

import { supabase } from '@/lib/supabaseClient';
import { exportGenericTableToCSV } from '@/utils/csvExporter';

export type ExportSelection = {
  companies: boolean;
  contacts: boolean;
  contacts_channel: boolean;
  chats: boolean;
  tags: boolean;
  profiles: boolean;
  tickets: boolean;
  channels: boolean;
};

const PAGE_SIZE = 1000;
const CONTACTS_EXPORT_VERSION = '2.0.0';
const CHANNELS_EXPORT_VERSION = '1.0.0';

/* ========================================================================== */
/* Fetch genérico com paginação                                               */
/* ========================================================================== */

const fetchAllRows = async <T = any>(
  tableName: string,
  columns: string = '*',
): Promise<T[]> => {
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from<T>(tableName)
      .select(columns)
      .range(from, to);

    if (error) {
      throw new Error(`Erro ao buscar dados de ${tableName}: ${error.message}`);
    }

    const batch = data ?? [];
    allRows.push(...batch);

    if (batch.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return allRows;
};

const exportTable = async (tableName: string, label?: string) => {
  const rows = await fetchAllRows<any>(tableName, '*');
  if (!rows.length) return;
  exportGenericTableToCSV(rows, label || tableName);
};

/* ========================================================================== */
/* Helpers de formatação para contacts_channel                                 */
/* ========================================================================== */

const normalizeDigits = (value: any): string => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\D/g, '');
};

const formatLocalNumber = (digits: string): string => {
  // 8 dígitos → NNNN-NNNN
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  // 9 dígitos iniciando com 9 → 9NNNN-NNNN
  if (digits.length === 9 && digits[0] === '9') {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  return digits;
};

const formatPhoneForExport = (value: any): string => {
  if (value === null || value === undefined) return '';
  const original = String(value).trim();
  if (!original) return '';

  const digits = normalizeDigits(original);
  if (!digits) return original;

  // Com DDD (10 ou 11 dígitos)
  if (digits.length === 10 || digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const local = digits.slice(2);

    return `(${ddd}) ${formatLocalNumber(local)}`;
  }

  // Sem DDD, mas com 8 ou 9 dígitos
  if (digits.length === 8 || (digits.length === 9 && digits[0] === '9')) {
    return formatLocalNumber(digits);
  }

  // Caso fora do padrão esperado, mantém original
  return original;
};

const formatExtensionForExport = (value: any): string => {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (!str) return '';

  if (/^\d+$/.test(str)) {
    return `R: ${str}`;
  }

  return str;
};

/* ========================================================================== */
/* Exportação específica: companies com owner_full_name                        */
/* ========================================================================== */
/*
Premissas:
  - companies.owner guarda o auth_user_id em formato texto;
  - profiles.auth_user_id é esse mesmo auth_user_id;
  - profiles.full_name é o nome do responsável.
*/

const exportCompaniesWithOwnerFullName = async () => {
  const companies = await fetchAllRows<any>('companies', '*');
  if (!companies.length) return;

  const profiles = await fetchAllRows<any>('profiles', 'auth_user_id, full_name');

  const profileByAuthId = new Map<string, string>();
  profiles.forEach((p: any) => {
    if (p.auth_user_id) {
      profileByAuthId.set(String(p.auth_user_id), p.full_name ?? '');
    }
  });

  const rowsWithOwner = companies.map((company: any) => {
    const ownerAuthId = company.owner ? String(company.owner) : '';
    const ownerFullName = ownerAuthId ? profileByAuthId.get(ownerAuthId) ?? '' : '';

    return {
      ...company,
      owner_full_name: ownerFullName,
    };
  });

  exportGenericTableToCSV(rowsWithOwner, 'companies');
};

/* ========================================================================== */
/* Exportação específica: contacts_channel — ENRIQUECIDO                       */
/* ========================================================================== */
/*
   Agora esta função retorna:
      - value / extension formatados (telefone / ramal)
      - company_trade_name (companies.trade_name)
      - owner_full_name (profiles.full_name do responsável)
      - debug_channels_version ("1.0.0")

   Mapeamento:
      contacts_channel.contact_id  -> contacts.id
      contacts.company_id          -> companies.id
      companies.owner              -> profiles.auth_user_id
*/

const exportContactsChannelFormatted = async () => {
  // 1) Buscar a tabela principal
  const channels = await fetchAllRows<any>('contacts_channel', '*');
  if (!channels.length) return;

  // 2) Buscar contacts (para encontrar company_id)
  const contacts = await fetchAllRows<any>('contacts', 'id, company_id');

  // 3) Buscar companies (id, trade_name, owner)
  const companies = await fetchAllRows<any>('companies', 'id, trade_name, owner');

  // 4) Buscar profiles (auth_user_id, full_name)
  const profiles = await fetchAllRows<any>('profiles', 'auth_user_id, full_name');

  // 5) Indexes
  const contactById = new Map<string, any>();
  contacts.forEach(c => {
    if (c.id) contactById.set(String(c.id), c);
  });

  const companyById = new Map<string, any>();
  companies.forEach(c => {
    if (c.id) companyById.set(String(c.id), c);
  });

  const profileByAuthId = new Map<string, string>();
  profiles.forEach(p => {
    if (p.auth_user_id) {
      profileByAuthId.set(String(p.auth_user_id), p.full_name ?? '');
    }
  });

  // 6) Enriquecer canais
  const enriched = channels.map(channel => {
    const contact = channel.contact_id ? contactById.get(String(channel.contact_id)) : null;
    const company = contact?.company_id ? companyById.get(String(contact.company_id)) : null;

    const companyTradeName = company?.trade_name ?? '';
    const ownerAuthId = company?.owner ? String(company.owner) : '';
    const ownerFullName = ownerAuthId ? profileByAuthId.get(ownerAuthId) ?? '' : '';

    return {
      ...channel,
      value: formatPhoneForExport(channel.value),
      extension: formatExtensionForExport(channel.extension),
      company_trade_name: companyTradeName,
      owner_full_name: ownerFullName,
      debug_channels_version: CHANNELS_EXPORT_VERSION,
    };
  });

  exportGenericTableToCSV(enriched, 'contacts_channel');
};

/* ========================================================================== */
/* Exportação específica: contacts com empresa + responsável                   */
/* ========================================================================== */
/*
Premissas:
  - contacts.company_id referencia companies.id;
  - companies.owner guarda o auth_user_id (uuid em texto);
  - profiles.auth_user_id é esse mesmo auth_user_id;
  - profiles.full_name é o nome do responsável.
*/

const exportContactsWithCompanyAndOwner = async () => {
  const contacts = await fetchAllRows<any>('contacts', '*');
  if (!contacts.length) return;

  const companies = await fetchAllRows<any>('companies', 'id, trade_name, owner');
  const profiles = await fetchAllRows<any>('profiles', 'auth_user_id, full_name');

  const companyMap = new Map<
    string,
    { trade_name: string | null | undefined; owner: string | null | undefined }
  >();
  companies.forEach((c: any) => {
    if (c.id) {
      companyMap.set(String(c.id), {
        trade_name: c.trade_name,
        owner: c.owner,
      });
    }
  });

  const profileByAuthId = new Map<string, string>();
  profiles.forEach((p: any) => {
    if (p.auth_user_id) {
      profileByAuthId.set(String(p.auth_user_id), p.full_name ?? '');
    }
  });

  const rowsEnriched = contacts.map((contact: any) => {
    const companyId = contact.company_id ? String(contact.company_id) : '';
    const companyInfo = companyId ? companyMap.get(companyId) : undefined;

    const companyTradeName = companyInfo?.trade_name ?? '';

    const ownerAuthId = companyInfo?.owner ? String(companyInfo.owner) : '';
    const ownerFullName = ownerAuthId ? profileByAuthId.get(ownerAuthId) ?? '' : '';

    return {
      ...contact,
      company_trade_name: companyTradeName,
      owner_full_name: ownerFullName,
      debug_contacts_version: CONTACTS_EXPORT_VERSION,
    };
  });

  exportGenericTableToCSV(rowsEnriched, 'contacts');
};

/* ========================================================================== */
/* Função principal: exportSelectedTables                                      */
/* ========================================================================== */

export const exportSelectedTables = async (selection: ExportSelection) => {
  const tasks: Promise<void>[] = [];

  if (selection.companies) tasks.push(exportCompaniesWithOwnerFullName());
  if (selection.contacts) tasks.push(exportContactsWithCompanyAndOwner());
  if (selection.contacts_channel) tasks.push(exportContactsChannelFormatted());
  if (selection.chats) tasks.push(exportTable('chats'));
  if (selection.tags) tasks.push(exportTable('tags'));
  if (selection.profiles) tasks.push(exportTable('profiles'));
  if (selection.tickets) tasks.push(exportTable('tickets'));
  if (selection.channels) tasks.push(exportTable('channels'));

  await Promise.all(tasks);
};

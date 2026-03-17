/*
-- ===================================================
-- Código             : /src/services/contactsExportService.ts
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-12-05 01:05 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Fornecer lista de contatos enriquecida para exportação,
--                      incluindo:
--                        • Empresa (companies.trade_name)
--                        • Responsável (profiles.full_name via companies.owner)
-- Fluxo              : contactsExportService -> contactsExporter (PDF/CSV/Excel)
-- Alterações (1.0.0) :
--   • [FEAT] Função fetchContactsForExport com joins em memória:
--       - contacts + companies + profiles.
--   • [FEAT] Campo extra owner_full_name em cada contato retornado.
-- Dependências       : supabaseClient, @/types/contact
-- ===================================================
*/

import { supabase } from '@/lib/supabaseClient';
import { ContactWithCompany } from '@/types/contact';

const PAGE_SIZE = 1000;

/**
 * Busca todas as linhas de uma tabela usando paginação interna (range).
 * columns: lista de colunas, padrão '*'.
 */
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

type RawContact = any;
type RawCompany = {
  id: string;
  trade_name?: string | null;
  owner?: string | null; // auth_user_id do responsável
};
type RawProfile = {
  auth_user_id: string | null;
  full_name: string | null;
};

/**
 * Retorna os contatos já prontos para exportação,
 * com:
 *  - contact.company.trade_name preenchido
 *  - campo extra owner_full_name (profiles.full_name do responsável)
 *
 * Premissas:
 *  - contacts.company_id referencia companies.id;
 *  - companies.owner guarda o auth_user_id (uuid em texto);
 *  - profiles.auth_user_id é esse mesmo auth_user_id;
 *  - profiles.full_name é o nome do responsável.
 */
export const fetchContactsForExport = async (): Promise<
  (ContactWithCompany & { owner_full_name: string })
[]> => {
  // 1) Buscar contatos crus
  const rawContacts = await fetchAllRows<RawContact>('contacts', '*');
  if (!rawContacts.length) {
    return [];
  }

  // 2) Buscar empresas (id, trade_name, owner)
  const rawCompanies = await fetchAllRows<RawCompany>('companies', 'id, trade_name, owner');

  // 3) Buscar perfis (auth_user_id, full_name)
  const rawProfiles = await fetchAllRows<RawProfile>('profiles', 'auth_user_id, full_name');

  // 4) Montar índices em memória
  const companyById = new Map<string, RawCompany>();
  rawCompanies.forEach(c => {
    if (c.id) {
      companyById.set(String(c.id), c);
    }
  });

  const fullNameByAuthUserId = new Map<string, string>();
  rawProfiles.forEach(p => {
    if (p.auth_user_id) {
      fullNameByAuthUserId.set(String(p.auth_user_id), p.full_name ?? '');
    }
  });

  // 5) Enriquecer cada contato
  const enrichedContacts = rawContacts.map(raw => {
    const companyId = raw.company_id ? String(raw.company_id) : '';
    const company = companyId ? companyById.get(companyId) : undefined;

    const tradeName = company?.trade_name ?? '';

    const ownerAuthId = company?.owner ? String(company.owner) : '';
    const ownerFullName = ownerAuthId ? fullNameByAuthUserId.get(ownerAuthId) ?? '' : '';

    // Montar objeto compatível com ContactWithCompany + owner_full_name
    const contactWithCompany: ContactWithCompany & { owner_full_name: string } = {
      ...(raw as ContactWithCompany),
      company: {
        ...(raw.company ?? {}),
        trade_name: tradeName,
      },
      owner_full_name: ownerFullName,
    };

    return contactWithCompany;
  });

  return enrichedContacts;
};

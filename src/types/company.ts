/*
-- ===================================================
-- Código             : /src/types/company.ts
-- Versão (.v20)      : 2.2.0
-- Data/Hora          : 2025-11-30 18:30 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Incluir o campo "kind" (ENUM company_kind) no schema de Company,
--                      obrigatório com default 'client' (client|lead|prospect), e tipos derivados
--                      para uso em listagens (contacts + owner_name).
-- Fluxo              : companies → services → cockpit/catalogs/lists
-- Alterações (2.2.0) :
--   • [Feat] Adicionado tipo CompanyWithContactsAndOwner (Company + contacts + owner_name).
--   • [Docs] Comentários sobre o papel de owner (auth_user_id) e owner_name (full_name do profile).
-- Dependências           : zod, ./contact
-- ===================================================
*/

import { z } from 'zod';
import { Contact } from './contact';

/* ---------------------------------------------- */
/* Tipos auxiliares                               */
/* ---------------------------------------------- */

export const companyNoteSchema = z.object({
  data: z.string().min(1),
  assunto: z.string().min(1),
  nota: z.string().min(1),
});

export type CompanyNote = z.infer<typeof companyNoteSchema>;

/** Enum lógico para UI (mapeia o ENUM do DB: company_kind) */
export const companyKindSchema = z.enum(['client', 'lead', 'prospect']);
export type CompanyKind = z.infer<typeof companyKindSchema>;

/* ---------------------------------------------- */
/* Schema principal de Company                    */
/* ---------------------------------------------- */

export const companySchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),

  // Dados principais
  trade_name: z.string().min(1, 'O nome fantasia é obrigatório.'),
  legal_name: z.string().nullable().optional(),
  tax_id: z.string().nullable().optional(),
  email: z
    .string()
    .email('E-mail inválido.')
    .or(z.literal(''))
    .nullable()
    .optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),

  // Metadados
  qualification: z.number().int().min(1).max(5).nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),

  /**
   * Responsável pela empresa
   * - Armazena profiles.auth_user_id (UUID em texto) ou valor nulo.
   * - O nome "humano" correspondente será resolvido via profiles.full_name
   *   e exposto em CompanyWithContactsAndOwner.owner_name.
   */
  owner: z.string().nullable().optional(),

  /** Tipo de empresa — alinha com ENUM public.company_kind no DB */
  kind: companyKindSchema.default('client'),

  // 🔁 Novo formato de notas
  notes: z.array(companyNoteSchema).default([]),

  // Endereço
  address_line: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip_code: z.string().nullable().optional(),

  // Timestamps
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

/* ---------------------------------------------- */
/* Tipos derivados                                */
/* ---------------------------------------------- */

export type Company = z.infer<typeof companySchema>;

export type CompanyWithContacts = Company & {
  contacts: Contact[];
};

/**
 * Tipo para listagens que precisam de:
 * - contatos carregados
 * - nome do responsável (profiles.full_name) já resolvido
 *
 * owner (Company) → guarda auth_user_id (texto)
 * owner_name      → nome amigável do responsável
 */
export type CompanyWithContactsAndOwner = CompanyWithContacts & {
  owner_name?: string | null;
};

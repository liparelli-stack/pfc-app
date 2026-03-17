/*
-- ===================================================
-- Código: /src/types/deal.ts
-- Versão: 2.0.0
-- Data/Hora: 2025-10-16 13:40 -03
-- Autor: E.V.A.
-- Objetivo: Status em português (persistência e UI): 'aberta' | 'ganha' | 'perdida' | 'em_espera'
-- Mudanças:
--  1) DEAL_STATUSES atualizados.
--  2) Validação de datas flexível (sem .datetime), '' → null.
-- ===================================================
*/
import { z } from 'zod';
import { profileSchema } from './profile';
import { companySchema } from './company';
import { contactSchema } from './contact';

export const DEAL_PIPELINE_STAGES = [
  'Captura',
  'Qualificação',
  'Proposta',
  'Negociação',
  'Fechamento',
] as const;

// >>> STATUS em PT-BR (DB e UI)
export const DEAL_STATUSES = ['aberta', 'ganha', 'perdida', 'em_espera'] as const;

// Datas flexíveis
const zLooseDateNullable = z.preprocess((v) => {
  if (v === '' || v === undefined) return null;
  return v; // aceita string, Date ou null
}, z.union([z.string(), z.date(), z.null()]));

const zLooseDateOptional = z.preprocess((v) => {
  if (v === '' || v === undefined) return undefined;
  return v;
}, z.union([z.string(), z.date()]).optional());

export const dealSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),

  name: z.string().min(3, 'O nome da oportunidade é obrigatório.'),

  company_id: z.string().uuid('Selecione uma empresa.').nullable(),
  primary_contact_id: z.string().uuid('Selecione um contato principal.').nullable(),

  owner_user_id: z.string().uuid('O responsável é obrigatório.'),

  pipeline_stage: z.enum(DEAL_PIPELINE_STAGES).default('Captura'),

  // >>> Status PT-BR
  status: z.enum(DEAL_STATUSES).default('aberta'),

  is_archived: z.boolean().default(false),

  amount: z.number().positive('O valor deve ser positivo.').nullable().default(null),
  currency: z.string().default('BRL'),

  // Temperatura/Origem livres (mantém objeto ou null)
  temperature: z.any().optional().nullable(),
  source: z.any().optional().nullable(),

  // Datas
  closed_at: zLooseDateNullable,
  created_at: zLooseDateOptional,
  updated_at: zLooseDateOptional,

  created_by: z.string().uuid().optional(),
  updated_by: z.string().uuid().optional(),
  export_state: z.string().optional(),
});

export type Deal = z.infer<typeof dealSchema>;

export type DealWithRelations = Deal & {
  company: z.infer<typeof companySchema> | null;
  primary_contact: z.infer<typeof contactSchema> | null;
  owner: z.infer<typeof profileSchema> | null;
  creator: z.infer<typeof profileSchema> | null;
  updater: z.infer<typeof profileSchema> | null;
};

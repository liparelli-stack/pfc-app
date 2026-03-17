/*
================================================================================
Código: /src/types/contact.ts
Versão: 2.2.0
Data/Hora: 2025-12-04 15:00 -03
Autor: FL / Eva (E.V.A.)
Objetivo: Adicionar o campo birth_day_month ao schema de validação.
================================================================================
*/

import { z } from 'zod';
import { Company } from './company';
import { ContactChannel } from './channel';

/* [--BLOCO--] Tipos auxiliares ------------------------------------------------ */
export type ContactGuard =
  | 'Principal'
  | 'Decisor'
  | 'Secundário'
  | 'Temporário'
  | string;

export type ContactStatus = 'active' | 'inactive' | string;

/* [--BLOCO--] Schema de validação -------------------------------------------- */
export const contactSchema = z.object({
  /* Identidade e vínculo multi-tenant */
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  company_id: z.string().uuid().nullable(),

  /* Dados principais */
  full_name: z.string().min(1, 'O nome é obrigatório'),
  position: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  contact_guard: z.string().nullable().optional(),
  birth_day_month: z.string().nullable().optional(),

  /* Status e notas */
  status: z.enum(['active', 'inactive']).default('active'),
  notes: z.string().nullable().optional(),

  /* Metadados (read-only na UI) */
  created_at: z.string(),
  updated_at: z.string(),
  export_state: z.string().default('Create'),

  channels: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      value: z.string(),
      label_custom: z.string().nullable().optional(),
      is_preferred: z.boolean(),
      notes: z.string().nullable().optional(),
      verified_at: z.string().nullable().optional(),
      created_at: z.string(),
      updated_at: z.string(),
      export_state: z.string(),
    })
  ),

  channels_count: z.number(),
});

export type Contact = z.infer<typeof contactSchema>;

export type ContactWithCompany = Omit<Contact, 'channels'> & {
  company: Partial<Company> | null;
  channels: Partial<ContactChannel>[];
};


/* [--BLOCO--] Constantes de apoio à UI --------------------------------------- */
export const CONTACT_GUARD_OPTIONS: { value: ContactGuard; label: string }[] = [
  { value: 'Principal',  label: 'Principal' },
  { value: 'Decisor',    label: 'Decisor' },
  { value: 'Secundário', label: 'Secundário' },
  { value: 'Temporário', label: 'Temporário' },
];

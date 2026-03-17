/*
-- ===================================================
-- Código: /src/types/tenant.ts
-- Data/Hora: 2025-05-22 13:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Definir o tipo e o schema de validação para a entidade Tenant.
-- Fluxo: Usado pelo serviço e pelo formulário do Tenant.
-- Dependências: zod
-- ===================================================
*/
import { z } from 'zod';

// [BLOCK] Schema de validação com Zod
export const tenantSchema = z.object({
  id: z.string().uuid().optional(),
  company_name: z.string().min(1, "O nome da empresa é obrigatório.").max(150),
  slug: z.string().min(1, "O slug é obrigatório.").max(50).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug deve ser em formato kebab-case minúsculo."),
  contract_owner: z.string().min(1, "O nome do responsável é obrigatório.").max(120),
  tax_id: z.string().min(1, "O CNPJ/CPF é obrigatório.").max(32),
  address: z.string().max(200).optional(),
  state: z.string().max(50).optional(),
  city: z.string().max(80).optional(),
  zip_code: z.string().max(12).optional(),
  phone_contract_owner: z.string().max(20).optional(),
  email_contract_owner: z.string().email("O e-mail do responsável é inválido.").max(254),
  status: z.enum(['active', 'inactive']).default('active'),
  plan_tier: z.string().default('free'),
  seats_limit: z.number().int().min(1, "O limite de assentos deve ser no mínimo 1.").default(1),
  locale: z.string().default('pt-BR'),
  timezone: z.string().default('America/Sao_Paulo'),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().uuid().optional(),
  updated_by: z.string().uuid().optional(),
  export_state: z.string().default('Create'),
});

// [BLOCK] Tipo TypeScript inferido do schema
export type Tenant = z.infer<typeof tenantSchema>;

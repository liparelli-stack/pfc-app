/*
================================================================================
Código: /src/types/profile.ts
Versão: 4.3.0
Data/Hora: 2025-12-06 18:00 (America/Sao_Paulo)
Autor: FL / Execução via E.V.A.
Objetivo: Adicionar o cargo 'editor' ao enum de roles.
================================================================================
*/
import { z } from "zod";

/* =============================================================================
[--BLOCO--] Schema de validação Zod para Profile (unificado)
   - Mantém compatibilidade com o banco (constraints) e com o serviço.
============================================================================= */
export const profileSchema = z.object({
  /* Identificação e relações */
  id: z.string().uuid().optional(),
  tenant_id: z
    .string()
    .uuid({ message: "Tenant ID é obrigatório." })
    .optional(), // definido pelo backend/RLS na criação

  // [--TÉCNICA--] Trata strings vazias como nulas antes da validação.
  auth_user_id: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().uuid({ message: "Auth User ID deve ser um UUID válido." }).nullable().optional()
  ),

  /* Dados Pessoais */
  full_name: z.string().min(2, "O nome completo é obrigatório."),
  email: z.string().email("O e-mail é inválido."),
  avatar_url: z
    .string()
    .url("URL do avatar inválida.")
    .or(z.literal(""))
    .nullable()
    .optional(),
  department: z.string().nullable().optional(),

  /* Permissões e Configurações */
  // Enum alinhado ao CHECK do banco (versão atualizada)
  position: z
    .enum([
      "vendedor",
      "técnico",
      "coordenador",
      "gerente",
      "consultor(a)",
      "diretor(a)",
      "",
    ])
    .nullable()
    .optional(),
  role: z.enum(["admin", "editor", "user"]).default("user"),
  status: z.enum(["active", "inactive"]).default("active"),
  mfa_enabled: z.boolean().default(false),
  kb_can_edit: z.boolean().default(false),

  /* Preferência de tratamento para saudação */
  salutation_pref: z.enum(["masculino", "feminino", "neutro"]).default("neutro"),

  /* Localização e Metadados */
  locale: z.string().default("pt-BR"),
  timezone: z.string().default("America/Sao_Paulo"),

  /* Timestamps e rastreabilidade (controlados pelo DB) */
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  created_by: z.string().uuid().optional(),
  updated_by: z.string().uuid().optional(),
});

/* =============================================================================
[--BLOCO--] Tipo TypeScript inferido do schema
============================================================================= */
export type Profile = z.infer<typeof profileSchema>;

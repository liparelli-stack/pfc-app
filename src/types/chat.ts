/*
-- ===================================================
-- Código             : /src/types/chat.ts
-- Versão (.v20)      : 1.4.0
-- Data/Hora          : 2025-12-03 15:42 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do código : Ajustar lista de prioridades: remover “Programada” e “Imediata”
--                      e incluir “Alta”; manter default = "Normal".
-- Fluxo              : UI → Form (EditActionForm) → chatsService → DB (chats)
-- Alterações (1.4.0) :
--   • PRIORITY_OPTIONS atualizado para ["Normal", "Alta"]
--   • Schema zod atualizado para aceitar somente "Normal" | "Alta"
--   • Prioridade default permanece “Normal”
-- Dependências        : zod
-- ===================================================
*/

import { z } from "zod";

/**
 * Opções de prioridade da ação (dropdown no EditActionForm)
 * → Atualizado conforme especificação: Normal | Alta
 */
export const PRIORITY_OPTIONS = ["Normal", "Alta"] as const;
export type Priority = (typeof PRIORITY_OPTIONS)[number];

/**
 * Opções de temperatura (relevância/intensidade da ação)
 * Regra: sempre presente; default = "Neutra"
 */
export const TEMPERATURE_OPTIONS = ["Neutra", "Fria", "Morna", "Quente"] as const;
export type Temperature = (typeof TEMPERATURE_OPTIONS)[number];

/**
 * Schema de validação do formulário de Ação (zod)
 */
export const actionSchema = z.object({
  action: z.string().min(1, "Selecione uma ação."),
  contact_id: z.string().uuid("Contato inválido."),
  company_id: z.string().uuid("Empresa inválida."),
  subject: z.string().min(3, "Informe o assunto."),
  body: z.string().optional().nullable(),

  // Temperatura obrigatória com default "Neutra"
  temperature: z.enum(TEMPERATURE_OPTIONS).default("Neutra"),

  // PRIORIDADE — somente "Normal" | "Alta"
  priority: z.enum(PRIORITY_OPTIONS).default("Normal"),

  calendar_at: z.string().min(1, "Data obrigatória."),
  on_time: z.string().min(1, "Hora obrigatória."),
  is_done: z.boolean().default(false),
});

/**
 * Tipo principal do formulário de ação
 */
export type ActionFormData = z.infer<typeof actionSchema>;

/**
 * Tipo para a listagem de Ações (Chats)
 */
export interface ChatListItem {
  id: string;
  kind: string;
  channel_type: string | null;
  calendar_at: string | null;
  on_time: string | null;
  company_name: string | null;
  contact_name: string | null;
  author_name: string | null;
  priority: string | null;
  temperature: string | null;
  is_done: boolean;
  done_at: string | null;
  tags: string[] | null;
  subject: string | null;
  body: string | null;
  updated_at: string;
  budgets?: Array<{
    id?: string;
    description?: string;
    amount?: number; // Em centavos
    status?: 'aberta' | 'ganha' | 'perdida';
    loss_reason?: string | null;
    created_at?: string;
    updated_at?: string;
  }> | null;
}

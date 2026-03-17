/*
-- ===================================================
-- Código                 : /src/types/ticket.ts
-- Versão (.v20)         : 2.0.0
-- Data/Hora             : 2025-12-18 17:35
-- Autor                 : FL / Execução via EVA
-- Objetivo              : Tipos e schemas (zod) LIMPOS para Ticket (sem legado)
-- Alterações (2.0.0)    :
--  • Removido legado de priority/type/messages
--  • priority: normal|urgent
--  • type: fix|improvement|question
--  • messages: formato novo (seq/at/text/by_profile_id/type/visibility)
-- ===================================================
*/
import { z } from 'zod';

export const TICKET_STATUSES = ['open', 'closed'] as const;
export const TICKET_PRIORITIES = ['normal', 'urgent'] as const;
export const TICKET_TYPES = ['fix', 'improvement', 'question'] as const;

export const ticketMessageSchema = z.object({
  seq: z.number().int().positive(),
  at: z.string().min(1), // "DD/MM/YYYY - HH:MM"
  text: z.string().min(1),
  by_profile_id: z.string().uuid(),
  type: z.enum(['comment', 'status_change', 'system']).default('comment'),
  visibility: z.enum(['public', 'internal']).default('public'),
  status: z.enum(TICKET_STATUSES).optional(),
  created_at: z.any().optional(), // timestamp do postgres vindo da RPC
});

export const ticketAttachmentSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  path: z.string(),
  mime_type: z.string(),
  size_bytes: z.number(),
  created_at: z.string().datetime(),
});

export const ticketSchema = z.object({
  id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
  owner_user_id: z.string().uuid().optional(),
  assignee_profile_id: z.string().uuid().nullable().optional(),
  ticket_number: z.string().optional(),

  subject: z.string().min(1, 'O assunto é obrigatório.'),
  description: z.string().min(1, 'A descrição é obrigatória.'),

  status: z.enum(TICKET_STATUSES).default('open'),
  priority: z.enum(TICKET_PRIORITIES).default('normal'),
  type: z.enum(TICKET_TYPES).default('fix'),

  messages: z.array(ticketMessageSchema).default([]),
  attachments: z.array(ticketAttachmentSchema).default([]),

  parent_ticket_id: z.string().uuid().nullable().optional(),

  export_state: z.string().default('Create'),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  resolved_at: z.string().datetime().nullable().optional(),
  closed_at: z.string().datetime().nullable().optional(),
});

export type Ticket = z.infer<typeof ticketSchema>;
export type TicketMessage = z.infer<typeof ticketMessageSchema>;
export type TicketAttachment = z.infer<typeof ticketAttachmentSchema>;

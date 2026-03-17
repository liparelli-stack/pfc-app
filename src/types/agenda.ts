/*
-- ===================================================
-- Código: /src/types/agenda.ts
-- Versão: 1.1.0
-- Data/Hora: 2025-10-30 10:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Estender o tipo AgendaAppointment para incluir dados da empresa e do contato.
-- Fluxo: Usado pelo agendaService e pela AgendaPage.
-- ===================================================
*/

/**
 * [--TIPO--] Representa um compromisso da agenda, derivado da tabela `chats`.
 * Inclui dados aninhados da empresa e do contato associados.
 */
export interface AgendaAppointment {
  id: string;
  calendar_at: string;
  on_time: string | null;
  subject: string | null;
  is_done: boolean;
  channel_type: string | null;
  
  // [--NOVO--] Dados da empresa e contato relacionados
  company: {
    id: string;
    trade_name: string | null;
  } | null;
  contact: {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
}

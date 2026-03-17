/*
-- ===================================================
-- Código                 : /src/services/agendaService.ts
-- Versão (.v16)         : 1.2.0
-- Data/Hora             : 2025-10-27 15:50
-- Autor                 : FL/Eva GPT
-- Objetivo              : Buscar compromissos (agenda) usando JWT+RLS puro.
--                         Sem headers/localStorage; filtros somente por datas.
-- Fluxo                 : Chamado pela AgendaPage para popular o calendário.
-- Dependências          : @/lib/supabaseClient, @/types/agenda
-- ===================================================
*/

import { supabase } from '@/lib/supabaseClient';
import type { AgendaAppointment } from '@/types/agenda';

/* --------------------------- Utilitários --------------------------- */

const toDateYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Busca os compromissos de um mês específico (RLS limita por tenant/autor).
 * Inclui dados da empresa e do contato associados.
 * @param year  - Ano (ex.: 2025)
 * @param month - Mês (1-12)
 */
export const getAppointmentsForMonth = async (
  year: number,
  month: number
): Promise<AgendaAppointment[]> => {
  // JS usa mês 0-11; aqui recebemos 1-12
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // dia 0 do próximo mês = último dia do mês atual

  const { data, error } = await supabase
    .from('chats')
    .select(
      `
      id,
      calendar_at,
      on_time,
      subject,
      is_done,
      channel_type,
      company:companies(id, trade_name),
      contact:contacts(id, full_name, phone, email)
    `
    )
    // Escopo é garantido pela RLS (sem eq por tenant/autor aqui)
    .gte('calendar_at', toDateYMD(startDate))
    .lte('calendar_at', toDateYMD(endDate))
    .order('calendar_at', { ascending: true })
    .order('on_time', { ascending: true, nullsFirst: true });

  if (error) {
    console.error('[agendaService] Erro ao buscar compromissos da agenda:', error);
    throw new Error('Não foi possível carregar os compromissos.');
  }

  return (data || []) as AgendaAppointment[];
};

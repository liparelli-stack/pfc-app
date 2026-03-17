/*
-- ===================================================
-- Código                 : /src/services/ticketsService.ts
-- Versão (.v20)         : 2.0.3
-- Data/Hora             : 2025-12-18 19:25
-- Autor                 : FL / Execução via EVA
-- Objetivo              : CRUD Suporte (public.tickets) + RPC append_ticket_update
-- Alterações (2.0.3)    :
--  • listTickets e getTicket agora trazem owner (profiles.full_name) via FK owner_user_id -> profiles.id
--  • listTickets mantém attachments + messages (ícone + contador)
-- ===================================================
*/
import { supabase } from '@/lib/supabaseClient';
import type { Ticket, TicketAttachment } from '@/types/ticket';
import { getCurrentProfile } from '@/services/profilesService';

const TICKET_TABLE = 'tickets';

export type ListTicketsParams = {
  filter: 'mine' | 'team' | 'waiting' | 'resolved';
  searchQuery?: string;
};

/* ============================== LISTAR ============================== */
export const listTickets = async (params: ListTicketsParams): Promise<any[]> => {
  const { filter, searchQuery } = params;

  // ✅ owner via FK: tickets.owner_user_id -> profiles.id
  // Syntax Supabase: alias:profiles!<constraint_or_column>(fields)
  let query = supabase
    .from(TICKET_TABLE)
    .select(
      [
        'id',
        'ticket_number',
        'subject',
        'status',
        'priority',
        'type',
        'attachments',
        'messages',
        'created_at',
        'updated_at',
        'owner:profiles!tickets_owner_user_id_fkey(full_name,email)',
      ].join(',')
    )
    .order('created_at', { ascending: false });

  switch (filter) {
    case 'resolved':
      query = query.eq('status', 'closed');
      break;
    case 'mine':
    case 'team':
    case 'waiting':
    default:
      break;
  }

  if (searchQuery && searchQuery.trim().length > 0) {
    const q = searchQuery.trim();
    query = query.or(`subject.ilike.%${q}%,ticket_number.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[ticketsService] Error fetching tickets:', error);
    throw error;
  }

  return (data as any[]) ?? [];
};

/* ============================== DETALHE ============================= */
export const getTicket = async (id: string): Promise<any | null> => {
  const { data, error } = await supabase
    .from(TICKET_TABLE)
    .select(
      [
        'id',
        'ticket_number',
        'subject',
        'description',
        'status',
        'priority',
        'type',
        'messages',
        'attachments',
        'parent_ticket_id',
        'export_state',
        'created_at',
        'updated_at',
        'closed_at',
        'owner:profiles!tickets_owner_user_id_fkey(full_name,email)',
      ].join(',')
    )
    .eq('id', id)
    .single();

  if (error) {
    if ((error as any).code === 'PGRST116') return null;
    console.error(`[ticketsService] Error fetching ticket ${id}:`, error);
    throw error;
  }

  return (data as any) ?? null;
};

/* ============================== CRIAR =============================== */
export const createTicket = async (payload: Partial<Ticket>): Promise<Ticket> => {
  const base = {
    subject: payload.subject,
    description: payload.description,
    priority: payload.priority ?? 'normal',
    type: payload.type ?? 'fix',
  };

  const { data, error } = await supabase.from(TICKET_TABLE).insert(base).select().single();

  if (error) {
    console.error('[ticketsService] Error creating ticket:', error);
    throw error;
  }

  return data as Ticket;
};

/* ============================== ATUALIZAR =========================== */
export const updateTicket = async (id: string, payload: Partial<Ticket>): Promise<Ticket> => {
  const { data, error } = await supabase
    .from(TICKET_TABLE)
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error(`[ticketsService] Error updating ticket ${id}:`, error);
    throw error;
  }

  return data as Ticket;
};

/* ========================= APPEND UPDATE (RPC) ===================== */
export const appendTicketUpdate = async (
  ticketId: string,
  text: string,
  opts?: { visibility?: 'public' | 'internal'; type?: 'comment' | 'status_change' | 'system'; status?: 'open' | 'closed' | null }
): Promise<Ticket> => {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('Sessão válida, mas sem perfil ativo vinculado.');

  const { data, error } = await supabase.rpc('append_ticket_update', {
    p_ticket_id: ticketId,
    p_text: text,
    p_visibility: opts?.visibility ?? 'public',
    p_type: opts?.type ?? 'comment',
    p_status: opts?.status ?? null,
  });

  if (error) {
    console.error(`[ticketsService] Error appending update to ticket ${ticketId}:`, error);
    throw error;
  }

  return data as Ticket;
};

/* ========================= STATUS: FECHAR/REABRIR ==================== */
export const setTicketStatus = async (ticketId: string, status: 'open' | 'closed'): Promise<Ticket> => {
  const updated = await updateTicket(ticketId, {
    status,
    ...(status === 'closed' ? { closed_at: new Date().toISOString() } : { closed_at: null }),
  });

  await appendTicketUpdate(ticketId, status === 'closed' ? 'Chamado fechado.' : 'Chamado reaberto.', {
    type: 'status_change',
    visibility: 'public',
    status,
  });

  return updated;
};

/* ============================ UPLOAD ANEXO ========================== */
export const uploadAttachment = async (ticketId: string, file: File): Promise<TicketAttachment> => {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('Sessão válida, mas sem perfil ativo vinculado.');

  const tenantId = profile.tenant_id;

  const safeFileName = file.name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '_');
  const objectPath = `${tenantId}/${ticketId}/${Date.now()}-${safeFileName}`;

  const { data: up, error: upErr } = await supabase.storage.from('helpdesk-files').upload(objectPath, file, {
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });

  if (upErr) {
    console.error('[ticketsService] Error uploading attachment:', upErr);
    throw upErr;
  }

  const expiresIn = 7 * 24 * 60 * 60;
  const { data: signed, error: signErr } = await supabase.storage.from('helpdesk-files').createSignedUrl(objectPath, expiresIn);

  if (signErr) {
    console.error('[ticketsService] Error creating signed URL:', signErr);
    throw signErr;
  }

  return {
    name: file.name,
    url: signed.signedUrl,
    path: up?.path || objectPath,
    mime_type: file.type,
    size_bytes: file.size,
    created_at: new Date().toISOString(),
  };
};

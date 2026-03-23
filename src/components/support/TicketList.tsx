/*
-- ===================================================
-- Código                 : /src/components/support/TicketList.tsx
-- Versão (.v20)         : 2.0.3
-- Data/Hora             : 2025-12-18 19:25 America/Sao_Paulo
-- Autor                 : FL / Execução via EVA
-- Objetivo              : Lista de tickets com:
--                         • Nome real do owner (profiles do tickets.owner_user_id)
--                         • Linha: #SUP-000005 | Atualizado em ... | Aberto por ... | Nº atualizações ... | Data abertura ...
--                         • Ícone 📎 quando há anexo
--                         • Borda esquerda verde quando fechado
-- ===================================================
*/
import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Paperclip } from 'lucide-react';

import { listTickets } from '@/services/ticketsService';
import type { Ticket, TicketMessage } from '@/types/ticket';
import { useToast } from '@/contexts/ToastContext';
import { Skeleton } from '@/components/ui/Skeleton';

interface TicketListProps {
  onTicketSelect: (ticketId: string) => void;
}

const labelStatusPt = (s: Ticket['status']) => (s === 'open' ? 'Aberto' : 'Fechado');

const STATUS_STYLES: Record<Ticket['status'], string> = {
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  closed: 'bg-gray-100 text-gray-800 dark:bg-dark-s2 dark:text-dark-t1',
};

const PRIORITY_STYLES: Record<Ticket['priority'], string> = {
  normal: 'border-slate-400',
  urgent: 'border-red-500',
};

const formatPtBrDateTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');
const formatPtBrDateOnly = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

const TicketList: React.FC<TicketListProps> = ({ onTicketSelect }) => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchTickets = async () => {
      setIsLoading(true);
      try {
        const data = await listTickets({ filter: 'mine' });
        setTickets(data);
      } catch (error) {
        console.error('Erro ao carregar tickets:', error);
        addToast('Erro ao carregar seus chamados.', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchTickets();
  }, [addToast]);

  const rows = useMemo(() => {
    return tickets.map((t) => {
      const ticket = t as any;

      const hasAttachments = Array.isArray(ticket.attachments) && ticket.attachments.length > 0;

      const msgs = (ticket.messages || []) as TicketMessage[];
      const updatesCount = Array.isArray(msgs) ? msgs.length : 0;

      const ownerName =
        ticket.owner?.full_name?.trim?.() ||
        ticket.owner?.email?.trim?.() ||
        '—';

      const leftBorder =
        ticket.status === 'closed'
          ? 'border-green-500'
          : PRIORITY_STYLES[ticket.priority as Ticket['priority']] || 'border-slate-400';

      return { ticket, hasAttachments, updatesCount, ownerName, leftBorder };
    });
  }, [tickets]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="text-center py-16 neumorphic-convex rounded-2xl">
        <p className="text-gray-500">Você ainda não abriu nenhum chamado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map(({ ticket, hasAttachments, updatesCount, ownerName, leftBorder }) => (
        <div
          key={ticket.id}
          onClick={() => ticket.id && onTicketSelect(ticket.id)}
          className={clsx(
            'p-4 rounded-xl neumorphic-convex hover:neumorphic-concave transition-all duration-200 cursor-pointer flex items-center gap-4',
            'border-l-4',
            leftBorder
          )}
        >
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {hasAttachments && (
                  <span className="inline-flex items-center" title="Possui anexo">
                    <Paperclip className="h-4 w-4 text-gray-500" />
                  </span>
                )}
                <p className="font-bold text-lg text-gray-800 dark:text-dark-t1 truncate">{ticket.subject}</p>
              </div>

              <span className={clsx('px-2 py-0.5 text-xs font-semibold rounded-full', STATUS_STYLES[ticket.status])}>
                {labelStatusPt(ticket.status)}
              </span>
            </div>

            <div className="text-sm text-gray-500 dark:text-dark-t2 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="whitespace-nowrap">#{ticket.ticket_number}</span>
              <span className="opacity-60">|</span>
              <span className="whitespace-nowrap">Atualizado em: {formatPtBrDateTime(ticket.updated_at)}</span>
              <span className="opacity-60">|</span>
              <span className="whitespace-nowrap">Aberto por: {ownerName}</span>
              <span className="opacity-60">|</span>
              <span className="whitespace-nowrap">Número de atualizações: {updatesCount}</span>
              <span className="opacity-60">|</span>
              <span className="whitespace-nowrap">Data da abertura: {formatPtBrDateOnly(ticket.created_at)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TicketList;


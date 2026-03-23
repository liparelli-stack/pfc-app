/*
-- ===================================================
-- Código                 : /src/components/support/TicketDetailView.tsx
-- Versão (.v20)         : 2.0.1
-- Data/Hora             : 2025-12-18 18:35
-- Autor                 : FL / Execução via EVA
-- Objetivo              : Detalhe do ticket + mostra "Aberto por" e "Criado em"
-- Alterações (2.0.1)    :
--  • Exibe "Aberto por" (Você / profile.full_name)
--  • Exibe "Criado em" (created_at -> DD/MM/AAAA - HH:MM)
-- ===================================================
*/
import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { ArrowLeft, Paperclip, Lock, Unlock } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/contexts/ToastContext';

import { getTicket, appendTicketUpdate, setTicketStatus } from '@/services/ticketsService';
import { getCurrentProfile } from '@/services/profilesService';
import type { Ticket, TicketMessage } from '@/types/ticket';

interface TicketDetailViewProps {
  ticketId: string;
  onBack: () => void;
}

const labelStatusPt = (status: Ticket['status']) => (status === 'open' ? 'Aberto' : 'Fechado');
const labelPriorityPt = (p: Ticket['priority']) => (p === 'urgent' ? 'Urgente' : 'Normal');
const labelTypePt = (t: Ticket['type']) => {
  if (t === 'fix') return 'Correção';
  if (t === 'improvement') return 'Melhoria';
  return 'Dúvida';
};

const formatPtBrDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} - ${hh}:${min}`;
};

const TicketDetailView: React.FC<TicketDetailViewProps> = ({ ticketId, onBack }) => {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [openedByLabel, setOpenedByLabel] = useState<string>('Você');
  const { addToast } = useToast();

  const isClosed = ticket?.status === 'closed';

  const refreshTicket = async () => {
    const data = await getTicket(ticketId);
    setTicket(data);
  };

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      try {
        // ticket
        await refreshTicket();

        // "Aberto por" (se quiser mostrar nome em vez de "Você")
        const profile = await getCurrentProfile();
        if (profile?.full_name && profile.full_name.trim().length > 0) {
          setOpenedByLabel(profile.full_name);
        } else {
          setOpenedByLabel('Você');
        }
      } catch {
        addToast('Erro ao carregar detalhes do chamado.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const sortedMessages = useMemo(() => {
    const msgs = (ticket?.messages || []) as TicketMessage[];
    return [...msgs].sort((a, b) => a.seq - b.seq);
  }, [ticket?.messages]);

  const handleAppendUpdate = async () => {
    if (!newMessage.trim()) return;

    if (isClosed) {
      addToast('Chamado fechado. Reabra para adicionar novas atualizações.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await appendTicketUpdate(ticketId, newMessage.trim(), { visibility: 'public', type: 'comment' });
      setNewMessage('');
      await refreshTicket();
      addToast('Atualização registrada com sucesso!', 'success');
    } catch {
      addToast('Erro ao atualizar chamado.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!ticket?.id) return;
    setIsTogglingStatus(true);
    try {
      const next = isClosed ? 'open' : 'closed';
      await setTicketStatus(ticket.id, next);
      await refreshTicket();
      addToast(next === 'closed' ? 'Chamado fechado.' : 'Chamado reaberto.', 'success');
    } catch {
      addToast('Erro ao alterar status do chamado.', 'error');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  if (!ticket) {
    return (
      <div className="text-center py-16">
        <p>Chamado não encontrado.</p>
        <Button onClick={onBack} variant="default" className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button onClick={onBack} variant="default" className="!p-2">
          <ArrowLeft />
        </Button>

        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-dark-t1">{ticket.subject}</h1>
          <p className="text-gray-500">#{ticket.ticket_number}</p>
        </div>

        <Button onClick={handleToggleStatus} variant={isClosed ? 'default' : 'primary'} isLoading={isTogglingStatus} className="gap-2">
          {isClosed ? (
            <>
              <Unlock className="h-4 w-4" /> Reabrir
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" /> Fechar
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Principal */}
        <div className="md:col-span-2 space-y-6">
          <div className="neumorphic-convex rounded-2xl p-6">
            <h3 className="font-bold mb-2">Descrição</h3>
            <p className="whitespace-pre-wrap">{ticket.description}</p>
          </div>

          <div className="neumorphic-convex rounded-2xl p-6">
            <h3 className="font-bold mb-4">Histórico</h3>

            <div className="space-y-4">
              {sortedMessages.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma atualização ainda.</p>
              ) : (
                sortedMessages.map((msg) => (
                  <div
                    key={msg.seq}
                    className={clsx(
                      'p-4 rounded-lg border',
                      msg.visibility === 'internal'
                        ? 'bg-yellow-100/50 dark:bg-yellow-900/30 border-yellow-400'
                        : 'bg-dark-shadow/30 dark:bg-dark-dark-shadow/30 border-transparent'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">
                        Atualização {msg.seq}
                        {msg.visibility === 'internal' ? ' • Nota Interna' : ''}
                      </p>
                      <p className="text-xs text-gray-500">{msg.at}</p>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="neumorphic-convex rounded-2xl p-6">
            <h3 className="font-bold mb-2">Atualizar chamado</h3>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={4}
              disabled={isClosed}
              className={clsx(
                'w-full p-3 rounded-lg bg-plate dark:bg-dark-s1 neumorphic-concave outline-none',
                'focus:bg-white dark:focus:bg-gray-700',
                isClosed && 'opacity-60 cursor-not-allowed'
              )}
              placeholder={isClosed ? 'Chamado fechado. Reabra para atualizar...' : 'Digite a atualização...'}
            />
            <div className="flex justify-end mt-4">
              <Button onClick={handleAppendUpdate} variant="primary" isLoading={isSubmitting} disabled={isClosed}>
                Salvar atualização
              </Button>
            </div>
          </div>
        </div>

        {/* Lateral */}
        <div className="md:col-span-1 space-y-6">
          <div className="neumorphic-convex rounded-2xl p-6 space-y-3">
            <h3 className="font-bold mb-2">Detalhes</h3>

            <p>
              <strong>Status:</strong> {labelStatusPt(ticket.status)}
            </p>
            <p>
              <strong>Prioridade:</strong> {labelPriorityPt(ticket.priority)}
            </p>
            <p>
              <strong>Tipo:</strong> {labelTypePt(ticket.type)}
            </p>

            <hr className="opacity-30" />

            <p>
              <strong>Aberto por:</strong> {openedByLabel || 'Você'}
            </p>
            <p>
              <strong>Criado em:</strong> {formatPtBrDateTime(ticket.created_at)}
            </p>
          </div>

          {ticket.attachments?.length ? (
            <div className="neumorphic-convex rounded-2xl p-6">
              <h3 className="font-bold mb-2">Anexos</h3>
              <div className="space-y-2">
                {ticket.attachments.map((att, i) => (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-dark-shadow/50 dark:hover:bg-dark-dark-shadow/50"
                  >
                    <Paperclip className="h-4 w-4" />
                    <span className="text-sm truncate">{att.name}</span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default TicketDetailView;

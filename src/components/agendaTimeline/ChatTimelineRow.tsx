/*
-- ===================================================
-- Código             : /src/components/agendaTimeline/ChatTimelineRow.tsx
-- Versão (.v20)      : 1.0.2
-- Data/Hora          : 2025-12-17 12:35 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Row SAGRADO (clone 1:1 do legado) para Timeline.
--                      Única variação permitida: header (ReactNode) via props.
-- Fluxo              : AgendaTimelineList -> ChatTimelineRow
-- Alterações (1.0.2) :
--   • [UX] Header vira "faixa separadora" (bg leve + barra lateral + fonte #2722b6).
-- ===================================================
*/

import React from 'react';
import clsx from 'clsx';
import { Flame, Thermometer, Snowflake, HelpCircle, MinusCircle } from 'lucide-react';
import type { AXChat } from '@/services/agendaXBridge';
import { classifyChat } from './timelineUtils';

/* ===== Ícone de Temperatura (padrão dropdown oficial) ===== */
type Temperature = 'Neutra' | 'Fria' | 'Morna' | 'Quente';
const TempIcon = ({ temp }: { temp?: string | null }) => {
  const v = (temp || '').trim() as Temperature | '';
  const base = 'w-4 h-4';
  const wrap = (node: JSX.Element, title: string) => (
    <span className="inline-flex items-center" title={`Temperatura: ${title}`}>
      {node}
    </span>
  );

  switch (v) {
    case 'Neutra':
    case '':
      return wrap(<MinusCircle className={clsx(base, 'text-gray-400')} />, 'Neutra');
    case 'Quente':
      return wrap(<Flame className={clsx(base, 'text-red-500')} />, 'Quente');
    case 'Morna':
      return wrap(<Thermometer className={clsx(base, 'text-amber-500')} />, 'Morna');
    case 'Fria':
      return wrap(<Snowflake className={clsx(base, 'text-blue-500')} />, 'Fria');
    default:
      return wrap(<HelpCircle className={clsx(base, 'text-gray-400')} />, v);
  }
};

/* ===== Badges de Tipo ===== */
type TypeBadgeData = { label: string; className: string; title?: string };

function resolveTypeBadge(r: Pick<AXChat, 'kind' | 'direction' | 'channel_type'>): TypeBadgeData {
  const kind = String(r.kind || '').toLowerCase();
  const direction = (r.direction ?? 'inout') as 'inbound' | 'outbound' | 'internal' | 'inout';
  const ch = String(r.channel_type || '').toLowerCase();

  if (kind === 'call') {
    if (direction === 'outbound' && ch === 'phone') return { label: 'Ligação (E)', className: 'bg-[#6D28D9] text-white' };
    if (direction === 'inbound'  && ch === 'phone') return { label: 'Ligação (R)', className: 'bg-[#4C1D95] text-white' };
    return { label: 'Ligação', className: 'bg-[#4C1D95] text-white' };
  }

  if (kind === 'message') {
    if (ch === 'whatsapp') {
      if (direction === 'outbound') return { label: 'Whats (E)', className: 'bg-[#047857] text-white' };
      if (direction === 'inbound')  return { label: 'Whats (R)', className: 'bg-[#065F46] text-white' };
    }
    if (ch === 'email') {
      if (direction === 'outbound') return { label: 'E-mail (E)', className: 'bg-[#1D4ED8] text-white' };
      if (direction === 'inbound')  return { label: 'E-mail (R)', className: 'bg-[#22429E] text-white' };
    }
    return { label: 'Mensagem', className: 'bg-[#34B4BA] text-white' };
  }

  if (kind === 'task') {
    if (ch === 'orcamento')  return { label: 'Orçamento',  className: 'bg-[#BE123C] text-white' };
    if (ch === 'followup')   return { label: 'Follow-up',  className: 'bg-[#DA8200] text-white' };
    if (ch === 'visita')     return { label: 'Visita',     className: 'bg-[#F600B6] text-white' };
    if (ch === 'informacao') return { label: 'Informação', className: 'bg-[#DA8200] text-white' };
    if (ch === 'interna')    return { label: 'Interna',    className: 'bg-[#DA8200] text-white' };
    if (ch === 'almoco')     return { label: 'Almoço',     className: 'bg-[#F600B6] text-white' };
    if (ch === 'reuniao')    return { label: 'Reunião',    className: 'bg-[#F600B6] text-white' };
    return { label: 'Tarefa', className: 'bg-[#996633] text-white' };
  }

  return { label: (ch || kind || 'Tipo').replace(/\b\w/g, (m) => m.toUpperCase()), className: 'bg-gray-300 text-gray-900' };
}

const TYPE_LABELS = [
  'Ligação','Ligação (E)','Ligação (R)','Mensagem','Whats (E)','Whats (R)',
  'E-mail (E)','E-mail (R)','Tarefa','Orçamento','Follow-up','Visita','Informação','Interna','Almoço','Reunião',
];
const BADGE_MIN_CH = Math.max(...TYPE_LABELS.map((s) => s.length)) + 2;

const TypeBadge = ({ row }: { row: Pick<AXChat, 'kind' | 'direction' | 'channel_type'> }) => {
  const t = resolveTypeBadge(row);
  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center text-center',
        'px-2 py-0.5 rounded-full text-[11px] font-medium',
        t.className
      )}
      style={{ minWidth: `${BADGE_MIN_CH}ch` }}
      title={t.title || t.label}
    >
      {t.label}
    </span>
  );
};

/* ===== Badges de status ===== */
const ConcludedBadge = () => (
  <span
    className={clsx(
      'inline-flex items-center justify-center text-center',
      'px-2 py-0.5 rounded-full text-[11px] font-semibold',
      'bg-green-500 text-white shadow-sm'
    )}
    title="Ação concluída"
  >
    Concluída
  </span>
);

const OverdueBadge = () => (
  <span
    className={clsx(
      'inline-flex items-center justify-center text-center',
      'px-2 py-0.5 rounded-full text-[11px] font-semibold',
      'bg-red-500 text-white shadow-sm'
    )}
    title="Ação atrasada"
  >
    Atrasada
  </span>
);

/* ===== Budgets detalhados (clone 1:1) ===== */
const BudgetsBlock = ({ budgets }: { budgets: any[] }) => {
  if (!Array.isArray(budgets) || budgets.length === 0) return null;
  return (
    <div className="mt-2 rounded-xl border border-purple-300/50 dark:border-purple-400/40 p-2">
      <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">
        Orçamentos vinculados ({budgets.length})
      </div>
      <ul className="space-y-1">
        {budgets.map((b, i) => {
          const amount =
            typeof b?.amount === 'number'
              ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(b.amount)
              : b?.amount ?? '-';
          const currency = b?.currency ?? '';
          return (
            <li key={`b-${i}-${b?.id ?? ''}`} className="text-xs bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2">
              <div><span className="font-medium">Valor:</span> {amount} {currency}</div>
              <div><span className="font-medium">Status:</span> {b?.status ?? '-'}</div>
              {b?.description ? (
                <div className="whitespace-pre-wrap"><span className="font-medium">Descrição:</span> {b.description}</div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

type Props = {
  chat: AXChat;
  header: React.ReactNode; // ÚNICA variação permitida
  openMode?: boolean;
  now: Date;
};

const ChatTimelineRow: React.FC<Props> = ({ chat, header, openMode = true, now }) => {
  const activeBudgets = Array.isArray(chat.budgets)
    ? chat.budgets.filter((b: any) => {
        const status = (b?.status ?? '').toString().trim().toLowerCase();
        return status !== 'terminado';
      })
    : [];

  const status = classifyChat(chat, now);

  return (
    <div
      className={clsx(
        'p-2 rounded-lg neumorphic-convex hover:neumorphic-concave transition mb-2',
        status.isOverdue && 'ring-1 ring-red-300/60 dark:ring-red-500/30'
      )}
    >
      {/* Linha 0: Identificação (separador visual padrão) */}
      <div
        className={clsx(
          'mb-2 rounded-md px-2 py-0.5',
          'bg-[#2722b6]/10 dark:bg-[#2722b6]/15',
          'border-l-4 border-[#2722b6]/70',
          'text-[#2722b6]'
        )}
      >
        <div className="text-xs">
          {header}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm flex items-center gap-2">
          <TempIcon temp={chat.temperature} />
          <strong>{chat.subject || '(Sem assunto)'}</strong>
          {chat.priority ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {chat.priority}
            </span>
          ) : null}
        </div>

        <div className="text-xs text-gray-500 flex items-center gap-2">
          {chat.is_done ? <ConcludedBadge /> : null}
          {!chat.is_done && status.isOverdue ? <OverdueBadge /> : null}
          <TypeBadge row={chat} />
        </div>
      </div>

      {chat.body ? (
        <div className={`text-xs text-gray-700 dark:text-dark-t1 mt-1 ${openMode ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
          {chat.body}
        </div>
      ) : null}

      {activeBudgets.length > 0 ? (
        openMode ? (
          <BudgetsBlock budgets={activeBudgets} />
        ) : (
          <div className="text-xs text-purple-700 dark:text-purple-300 mt-1">
            💰 {activeBudgets.length} orçamento(s) vinculados
          </div>
        )
      ) : null}
    </div>
  );
};

export default ChatTimelineRow;

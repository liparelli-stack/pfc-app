/*
-- ===================================================
-- Código             : /src/components/dashboard/UserAgendaCard_vw.tsx
-- Versão (.v20)      : 1.0.1
-- Data/Hora          : 2025-12-17 00:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Card alternativo de Dashboard (Quadro 2 - versão view),
--                      exibindo a agenda do usuário logado ("minhas ações"
--                      pendentes) a partir da view vw_dashboard_user_agenda,
--                      via hook useDashboardQuadro2_vw.
-- Fluxo              : Dashboard.tsx -> UserAgendaCard_vw
--                      -> useDashboardQuadro2_vw -> dashboardService_vw
--                      -> vw_dashboard_user_agenda
-- Alterações (1.0.1) :
--   • Linha secundária em modo compacto: "Empresa · Contato" (sem prefixos).
--   • Fallbacks mais previsíveis para empresa/contato ausentes.
-- Dependências       : React, @/hooks/useDashboardQuadro2_vw
-- ===================================================
*/

import React from 'react';
import { useDashboardQuadro2_vw } from '@/hooks/useDashboardQuadro2_vw';
import type { DashboardUserAgendaItem } from '@/services/dashboardService_vw';

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';

  const date = d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });

  const time = d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${date} · ${time}`;
};

const getKindLabel = (item: DashboardUserAgendaItem): string => {
  // Ajuste simples: se existir subject usamos subject,
  // senão caímos em uma descrição curta baseada em kind/channel_type.
  if (item.subject && item.subject.trim().length > 0) {
    return item.subject.trim();
  }

  const kind = item.kind ?? '';
  const channel = item.channel_type ?? '';

  const base =
    kind === 'task'
      ? 'Tarefa'
      : kind === 'meeting'
      ? 'Reunião'
      : kind === 'call'
      ? 'Ligação'
      : kind === 'message'
      ? 'Mensagem'
      : 'Ação';

  if (channel === 'whatsapp') return `${base} (WhatsApp)`;
  if (channel === 'email') return `${base} (E-mail)`;
  if (channel === 'phone') return `${base} (Telefone)`;

  return base;
};

const getCompactCompanyContact = (item: DashboardUserAgendaItem): string => {
  const company = item.company_name?.trim() || 'Empresa não informada';
  const contact = item.contact_name?.trim();

  // Modo compacto: "Empresa · Contato" (sem prefixos).
  return contact ? `${company} · ${contact}` : company;
};

export const UserAgendaCard_vw: React.FC = () => {
  const { agendaQuery } = useDashboardQuadro2_vw();
  const { data, isLoading, isError, error, refetch } = agendaQuery;

  if (isLoading) {
    return (
      <div className="p-4 rounded-2xl shadow-sm bg-card animate-pulse">
        <div className="h-4 w-40 bg-gray-200 rounded mb-4" />
        <div className="space-y-2">
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 rounded-2xl shadow-sm bg-card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Minha Agenda</h2>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs text-primary hover:underline"
          >
            Tentar novamente
          </button>
        </div>
        <p className="text-sm text-red-500">
          Erro ao carregar a agenda do dashboard.
          {error && typeof error === 'object' && 'message' in (error as any) ? (
            <span className="block text-xs mt-1 text-red-400">
              {(error as any).message}
            </span>
          ) : null}
        </p>
      </div>
    );
  }

  const items = (data ?? []) as DashboardUserAgendaItem[];

  return (
    <div className="p-4 rounded-2xl shadow-sm bg-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Minha Agenda</h2>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-xs text-primary hover:underline"
        >
          Atualizar
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Você não possui ações de agenda pendentes.
        </p>
      ) : (
        <div className="flex flex-col gap-2 max-h-72 overflow-auto pr-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-2 rounded-xl border border-border bg-background/60"
            >
              {/* Coluna da data/hora */}
              <div className="min-w-[96px] text-xs text-muted-foreground">
                <div className="font-medium">
                  {formatDateTime(item.calendar_at)}
                </div>
                {item.on_time && (
                  <div className="text-[11px] opacity-80">
                    Previsto: {item.on_time}
                  </div>
                )}
              </div>

              {/* Conteúdo principal */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {getKindLabel(item)}
                </div>

                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  {getCompactCompanyContact(item)}
                </div>

                {item.body && (
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {item.body}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

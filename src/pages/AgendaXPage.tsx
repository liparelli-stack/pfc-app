/*
-- ===================================================
-- Código             : /src/pages/AgendaXPage.tsx
-- Versão (.v20)      : 1.3.4
-- Data/Hora          : 2025-12-17 13:18 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Página "Agenda X" (somente leitura), iniciando no "hoje" e
--                      mantendo o painel do dia aberto. Inclui alternância de modo
--                      via clique no título e indicador "Modo: Empresa/Agenda".
--                      Agora persiste o modo no localStorage.
-- Fluxo              : AgendaXPage → DayContextPanel → agendaXBridge → Supabase (RLS)
-- Alterações (1.3.4) :
--   • [D+] Persistência do viewMode em localStorage (abre no último modo).
--   • [SAFE] Fallback para 'agenda' caso não exista valor válido salvo.
-- ===================================================
*/

import { useEffect, useMemo, useState } from 'react';
import CalendarMiniX from '@/components/agendaX/CalendarMiniX';
import DayContextPanel from '@/components/agendaX/DayContextPanel';

type ViewMode = 'company' | 'agenda';

const STORAGE_KEY = 'agendax:viewMode';

function isViewMode(v: unknown): v is ViewMode {
  return v === 'company' || v === 'agenda';
}

function safeReadViewMode(): ViewMode {
  // SSR-safe + tolerante a bloqueios de storage
  try {
    if (typeof window === 'undefined') return 'agenda';
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isViewMode(raw) ? raw : 'agenda';
  } catch {
    return 'agenda';
  }
}

function safeWriteViewMode(mode: ViewMode) {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore (storage pode estar bloqueado)
  }
}

const AgendaXPage = () => {
  // Inicia no HOJE para abrir o painel
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // ✅ Default: último modo salvo (fallback: 'agenda')
  const [viewMode, setViewMode] = useState<ViewMode>(() => safeReadViewMode());

  // ✅ Persiste sempre que mudar
  useEffect(() => {
    safeWriteViewMode(viewMode);
  }, [viewMode]);

  const dateLabel = useMemo(() => {
    return selectedDate ? selectedDate.toLocaleDateString('pt-BR') : '';
  }, [selectedDate]);

  const title = useMemo(() => {
    if (!selectedDate) return 'Selecione um dia';
    return `Contexto do Dia — ${dateLabel}`;
  }, [selectedDate, dateLabel]);

  const modeLabel = viewMode === 'company' ? 'Empresa' : 'Agenda';
  const modeTooltip =
    viewMode === 'company'
      ? 'Exibe os agendamentos agrupados por empresa.'
      : 'Exibe os agendamentos em linha do tempo.';

  const onToggleMode = () => {
    setViewMode((m) => (m === 'company' ? 'agenda' : 'company'));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* Coluna esquerda — Calendário */}
      <div className="w-full lg:w-1/3">
        <CalendarMiniX
          selectedDate={selectedDate}
          onSelect={(d) => setSelectedDate(d)}
          size="md"
        />
      </div>

      {/* Coluna direita — Painel do dia */}
      <div className="flex-1 overflow-y-auto bg-transparent">
        {selectedDate ? (
          <div className="p-4">
            {/* Header: título (clicável invisível) + indicador de modo */}
            <div className="flex items-center justify-between gap-3 mb-3">
              <button
                type="button"
                onClick={onToggleMode}
                className="text-left"
                title="Clique para alternar o modo de visualização"
                aria-label="Alternar modo de visualização"
              >
                <h2 className="text-xl font-semibold">{title}</h2>
              </button>

              <span
                className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-200/70 dark:bg-dark-s1/10 text-gray-700 dark:text-dark-t1"
                title={modeTooltip}
                aria-label={modeTooltip}
              >
                Modo: {modeLabel}
              </span>
            </div>

            <DayContextPanel selectedDate={selectedDate} viewMode={viewMode} />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 italic">
            Selecione um dia para visualizar as informações.
          </div>
        )}
      </div>
    </div>
  );
};

export default AgendaXPage;

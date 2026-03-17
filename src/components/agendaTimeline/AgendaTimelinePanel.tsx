/*
-- ===================================================
-- Código             : /src/components/agendaTimeline/AgendaTimelinePanel.tsx
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-12-17 12:10 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Painel NOVO (Modo Agenda) integrado ao DayContextPanel,
--                      renderizando a Timeline V1 (read-only) para a data selecionada.
-- Fluxo              : AgendaXPage -> DayContextPanel (viewMode=agenda) -> AgendaTimelinePanel -> AgendaTimelineList
-- Alterações (1.0.0) :
--   • [NEW] Integração real: substitui placeholder por Timeline nova.
-- ===================================================
*/

import React, { useMemo } from 'react';
import AgendaTimelineList from './AgendaTimelineList';
import { localISODate } from './timelineUtils';

type Props = {
  selectedDate: Date;
};

const AgendaTimelinePanel: React.FC<Props> = ({ selectedDate }) => {
  const dayISO = useMemo(() => localISODate(selectedDate), [selectedDate]);

  return (
    <div className="p-0 space-y-3">
      <AgendaTimelineList dayISO={dayISO} initialTab="ambos" openMode={true} historyLimit={500} />
    </div>
  );
};

export default AgendaTimelinePanel;

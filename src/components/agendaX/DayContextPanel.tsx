/*
-- ===================================================
-- Código             : /src/components/agendaX/DayContextPanel.tsx
-- Versão (.v20)      : 1.4.3
-- Data/Hora          : 2025-12-17 12:10 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Exibir, para a data selecionada:
--                      • Modo company (LEGADO): empresas + dossiê + timeline por empresa
--                      • Modo agenda (NOVO V1): timeline linear (com abas/filtros existentes)
-- Fluxo              : AgendaXPage -> DayContextPanel -> (company: agendaXBridge + legado) | (agenda: AgendaTimelinePanel)
-- Alterações (1.4.3) :
--   • [NEW] Modo 'agenda' agora renderiza componente novo (AgendaTimelinePanel).
--   • [SAFE] Mantém modo 'company' intacto.
--   • [SAFE] Ajuste de dateStr para YYYY-MM-DD local (evita bug UTC).
-- ===================================================
*/

import { useEffect, useMemo, useState } from 'react';
import { getCompaniesByDayWithCounts } from '@/services/agendaXBridge';
import CompanyProfileCardFull from './CompanyProfileCardFull';
import ChatsTimeline from './ChatsTimeline';
import AgendaTimelinePanel from '@/components/agendaTimeline/AgendaTimelinePanel';
import { localISODate } from '@/components/agendaTimeline/timelineUtils';

type ViewMode = 'company' | 'agenda';

interface DayContextPanelProps {
  selectedDate: Date;
  viewMode: ViewMode;
}

type CompanyItem = {
  id: string;
  trade_name: string;
  counts: { today: number };
};

const DayContextPanel = ({ selectedDate, viewMode }: DayContextPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);

  // SAFE: data local (evita UTC shift)
  const dateStr = useMemo(() => localISODate(selectedDate), [selectedDate]);

  const loadData = async () => {
    setError(null);
    setLoading(true);
    setCompanies([]);

    try {
      const list = await getCompaniesByDayWithCounts(dateStr);
      setCompanies(list);
    } catch (err: any) {
      setError('Falha ao carregar empresas do dia. Tente novamente.');
      console.error('[AgendaX] Erro de carga (empresas):', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr]);

  const SkeletonCard = () => (
    <div className="animate-pulse bg-plate dark:bg-plate-dark mb-4 p-4 rounded-2xl neumorphic-convex">
      <div className="h-4 w-1/2 bg-gray-300 dark:bg-gray-700 rounded mb-3"></div>
      <div className="h-3 w-1/3 bg-gray-200 dark:bg-gray-800 rounded mb-2"></div>
      <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-800 rounded"></div>
    </div>
  );

  // === NOVA VIEW (V1) ===
  if (viewMode === 'agenda') {
    return <AgendaTimelinePanel selectedDate={selectedDate} />;
  }

  // === MODO LEGADO (Empresa → Linha do Tempo) ===
  return (
    <div className="p-0 space-y-4" aria-busy={loading}>
      {loading && (
        <>
          <p className="text-gray-500 italic mb-2 animate-pulse">
            Carregando empresas do dia…
          </p>
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </>
      )}

      {error && (
        <div className="text-red-500 bg-red-50 dark:bg-red-900/30 border border-red-400 rounded-xl p-3">
          <p className="mb-2">{error}</p>
          <button
            onClick={loadData}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!loading && !error && companies.length === 0 && (
        <p className="text-gray-500 italic">
          Nenhuma empresa com ações neste dia.
        </p>
      )}

      {/* Para cada empresa do dia: dossiê + timeline (tudo aberto) */}
      {!loading &&
        !error &&
        companies.map((c) => (
          <div key={c.id} className="space-y-3">
            <CompanyProfileCardFull companyId={c.id} />

            <ChatsTimeline
              companyId={c.id}
              dayISO={dateStr}
              initialTab="ambos"
              openMode={true}
              pageSize={20}
            />
          </div>
        ))}

      {!loading && !error && companies.length > 0 && (
        <div className="text-xs text-gray-400 italic mt-2">
          {companies.length} empresa(s) com ações em {dateStr}.
        </div>
      )}
    </div>
  );
};

export default DayContextPanel;

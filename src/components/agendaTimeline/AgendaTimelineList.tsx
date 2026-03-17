/*
-- ===================================================
-- Código             : /src/components/agendaTimeline/AgendaTimelineList.tsx
-- Versão (.v20)      : 1.0.1
-- Data/Hora          : 2025-12-17 12:22 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Timeline NOVA (V1) com header L1 atualizado:
--                      DD/MM/YY - HH:MM | Empresa | Contato
-- Alterações (1.0.1) :
--   • [FIX] Header do card no novo formato (mais funcional).
--   • [FIX] Passa header como ReactNode para o Row sagrado.
-- ===================================================
*/

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import GroupingModeButton, { GroupMode } from '@/components/shared/GroupingModeButton';
import type { AXChat } from '@/services/agendaXBridge';
import { getTimelineChatsByDay, getTimelineChatsHistory } from '@/services/agendaXBridge';
import ChatTimelineRow from './ChatTimelineRow';
import {
  QuickFilter,
  applyQuickFilter,
  formatDateOnly,
  formatDateTimeFromCalendar,
  groupByDateSorted,
  matchesSearch,
  resolveCompanyName,
  resolveContactName,
  sortByDateTimeAsc,
} from './timelineUtils';

type Tab = 'dia' | 'historico' | 'ambos';
const Tabs: Tab[] = ['dia', 'historico', 'ambos'];

const SkeletonRow = () => (
  <div className="animate-pulse h-4 w-full bg-gray-200 dark:bg-gray-800 rounded mb-2" />
);

const QUICK_FILTERS: Array<{ key: QuickFilter; label: string }> = [
  { key: 'todas', label: 'Todas' },
  { key: 'agendadas', label: 'Agendadas' },
  { key: 'atrasadas', label: 'Atrasadas' },
  { key: 'concluidas', label: 'Concluídas' },
];

type Props = {
  dayISO: string;
  openMode?: boolean;
  initialTab?: Tab;
  historyLimit?: number;
};

function buildHeader(c: AXChat) {
  const company = resolveCompanyName(c) ? resolveCompanyName(c) : 'Sem empresa';
  const contact = resolveContactName(c) ? resolveContactName(c) : 'Sem contato';
  const when = formatDateTimeFromCalendar(c.calendar_at, c.on_time) || '—';

  return (
    <>
      <span className="font-semibold">{when}</span>
      <span className="mx-2 text-gray-400">|</span>
      <span className="font-medium">{company}</span>
      <span className="mx-2 text-gray-400">|</span>
      <span className="font-medium">{contact}</span>
    </>
  );
}


/** V1 suporta apenas: none (linear) e date (agrupado por data). */
function coerceToV1GroupMode(mode: GroupMode): GroupMode {
  return mode === 'date' ? 'date' : 'none';
}

function nextAllowedMode(from: GroupMode): GroupMode {
  const maxHops = 10;
  let cur = from;
  for (let i = 0; i < maxHops; i++) {
    cur = coerceToV1GroupMode(cur);
    if (cur === 'none' || cur === 'date') return cur;
  }
  return 'none';
}

const AgendaTimelineList = ({
  dayISO,
  openMode = true,
  initialTab = 'ambos',
  historyLimit = 500,
}: Props) => {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('todas');
  const [search, setSearch] = useState('');

  const [loadingDay, setLoadingDay] = useState(false);
  const [loadingHist, setLoadingHist] = useState(false);
  const [errDay, setErrDay] = useState<string | null>(null);
  const [errHist, setErrHist] = useState<string | null>(null);

  const [dayItems, setDayItems] = useState<AXChat[]>([]);
  const [histItems, setHistItems] = useState<AXChat[]>([]);

  const [groupMode, setGroupMode] = useState<GroupMode>('none');
  const groupByDate = groupMode === 'date';

  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoadingDay(true);
    setErrDay(null);
    setDayItems([]);

    getTimelineChatsByDay(dayISO)
      .then((items) => {
        if (!alive) return;
        setDayItems(items);
      })
      .catch((e) => {
        console.warn('[AgendaTimelineList] dia error:', e);
        if (!alive) return;
        setErrDay('Falha ao carregar os chats do dia.');
      })
      .finally(() => alive && setLoadingDay(false));

    return () => {
      alive = false;
    };
  }, [dayISO]);

  const loadHistory = async () => {
    setLoadingHist(true);
    setErrHist(null);
    setHistItems([]);

    try {
      const items = await getTimelineChatsHistory({
        dayISO,
        search: search || undefined,
        limit: historyLimit,
      });
      setHistItems(items);
    } catch (e) {
      console.warn('[AgendaTimelineList] historico error:', e);
      setErrHist('Falha ao carregar o histórico.');
    } finally {
      setLoadingHist(false);
    }
  };

  useEffect(() => {
    if (tab === 'historico' || tab === 'ambos') {
      loadHistory();
    } else {
      setHistItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, dayISO]);

  const onApplySearch = () => {
    if (tab === 'historico' || tab === 'ambos') loadHistory();
  };

  const daySearched = useMemo(() => dayItems.filter((c) => matchesSearch(c, search)), [dayItems, search]);
  const histSearched = useMemo(() => histItems.filter((c) => matchesSearch(c, search)), [histItems, search]);

  const dayFiltered = useMemo(() => applyQuickFilter(daySearched, quickFilter, now), [daySearched, quickFilter, now]);
  const histFiltered = useMemo(() => applyQuickFilter(histSearched, quickFilter, now), [histSearched, quickFilter, now]);

  const daySorted = useMemo(() => sortByDateTimeAsc(dayFiltered), [dayFiltered]);
  const histSorted = useMemo(() => sortByDateTimeAsc(histFiltered), [histFiltered]);

  const histGroups = useMemo(() => (groupByDate ? groupByDateSorted(histFiltered) : []), [histFiltered, groupByDate]);
  const dayGroups = useMemo(() => (groupByDate ? groupByDateSorted(dayFiltered) : []), [dayFiltered, groupByDate]);

  const onChangeGroupMode = (next: GroupMode) => {
    const coerced = coerceToV1GroupMode(next);
    if (coerced === 'none' || coerced === 'date') {
      setGroupMode(coerced);
      return;
    }
    setGroupMode(nextAllowedMode(next));
  };

  return (
    <div className="bg-plate dark:bg-plate-dark p-4 rounded-2xl neumorphic-convex">
      <div className="mb-3 space-y-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex overflow-hidden rounded-xl neumorphic-convex">
            {Tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx('px-3 py-2 text-sm', t === tab ? 'bg-primary text-white' : 'hover:neumorphic-concave')}
                aria-pressed={t === tab}
              >
                {t === 'dia' && <>Do Dia</>}
                {t === 'historico' && <>Histórico</>}
                {t === 'ambos' && <>Ambos</>}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="w-[180px]">
              <GroupingModeButton mode={groupMode} onModeChange={onChangeGroupMode} />
            </div>

            <input
              className="px-3 py-2 rounded-lg neumorphic-convex text-sm bg-transparent outline-none"
              placeholder="Buscar (assunto/corpo)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onApplySearch(); }}
            />
            <button
              onClick={onApplySearch}
              className="px-3 py-2 rounded-lg neumorphic-convex hover:neumorphic-concave text-sm"
              title="Aplicar busca"
            >
              🔎
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {QUICK_FILTERS.map((f) => {
            const active = f.key === quickFilter;
            return (
              <button
                key={f.key}
                onClick={() => setQuickFilter(f.key)}
                className={clsx(
                  'px-3 py-1.5 rounded-full text-xs font-semibold',
                  'neumorphic-convex hover:neumorphic-concave transition',
                  active && 'bg-primary text-white'
                )}
                aria-pressed={active}
                title={`Filtrar: ${f.label}`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'dia' && (
        <div>
          {loadingDay && (<><SkeletonRow /><SkeletonRow /><SkeletonRow /></>)}
          {errDay && <div className="text-red-600 dark:text-red-400 text-sm mb-2">{errDay}</div>}

          {!loadingDay && !groupByDate && daySorted.length === 0 && !errDay && (
            <div className="text-sm text-gray-500 italic">Nenhuma ação neste dia.</div>
          )}
          {!loadingDay && !groupByDate && daySorted.map((c) => (
            <ChatTimelineRow key={c.id} chat={c} header={buildHeader(c)} now={now} openMode={openMode} />
          ))}

          {!loadingDay && groupByDate && (
            <div>
              {dayGroups.length === 0 ? (
                <div className="text-sm text-gray-500 italic">Nenhuma ação neste dia.</div>
              ) : (
                dayGroups.map((g) => (
                  <div key={`dg-${g.day}`} className="mb-3">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                      📅 {formatDateOnly(g.day)}
                    </div>
                    {g.rows.map((c) => (
                      <ChatTimelineRow key={`dg-row-${c.id}`} chat={c} header={buildHeader(c)} now={now} openMode={openMode} />
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'historico' && (
        <div>
          {loadingHist && histItems.length === 0 && (<><SkeletonRow /><SkeletonRow /><SkeletonRow /></>)}
          {errHist && <div className="text-red-600 dark:text-red-400 text-sm mb-2">{errHist}</div>}

          {!loadingHist && !groupByDate && histSorted.length === 0 && !errHist && (
            <div className="text-sm text-gray-500 italic">Nenhum registro encontrado.</div>
          )}

          {!loadingHist && !groupByDate && histSorted.map((c) => (
            <ChatTimelineRow key={c.id} chat={c} header={buildHeader(c)} now={now} openMode={openMode} />
          ))}

          {!loadingHist && groupByDate && (
            <div>
              {histGroups.length === 0 ? (
                <div className="text-sm text-gray-500 italic">Nenhum registro encontrado.</div>
              ) : (
                histGroups.map((g) => (
                  <div key={g.day} className="mb-3">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                      📅 {formatDateOnly(g.day)}
                    </div>
                    {g.rows.map((c) => (
                      <ChatTimelineRow key={`hg-${g.day}-${c.id}`} chat={c} header={buildHeader(c)} now={now} openMode={openMode} />
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'ambos' && (
        <div>
          <div className="mb-2 text-xs text-gray-500">Do Dia</div>
          {loadingDay && (<><SkeletonRow /><SkeletonRow /></>)}
          {errDay && <div className="text-red-600 dark:text-red-400 text-sm mb-2">{errDay}</div>}

          {!loadingDay && !groupByDate && daySorted.length === 0 && !errDay && (
            <div className="text-sm text-gray-500 italic mb-2">Nenhuma ação neste dia.</div>
          )}
          {!loadingDay && !groupByDate && daySorted.map((c) => (
            <ChatTimelineRow key={`d-${c.id}`} chat={c} header={buildHeader(c)} now={now} openMode={openMode} />
          ))}

          <div className="mt-3 mb-2 text-xs text-gray-500">Histórico</div>
          {loadingHist && histItems.length === 0 && (<><SkeletonRow /><SkeletonRow /></>)}
          {errHist && <div className="text-red-600 dark:text-red-400 text-sm mb-2">{errHist}</div>}

          {!loadingHist && !groupByDate && histSorted.length === 0 && !errHist && (
            <div className="text-sm text-gray-500 italic">Nenhum registro encontrado.</div>
          )}
          {!loadingHist && !groupByDate && histSorted.map((c) => (
            <ChatTimelineRow key={`h-${c.id}`} chat={c} header={buildHeader(c)} now={now} openMode={openMode} />
          ))}

          {!loadingDay && !loadingHist && groupByDate && (
            <div className="mt-2">
              {groupByDateSorted([...dayFiltered, ...histFiltered]).map((g) => (
                <div key={`ag-${g.day}`} className="mb-3">
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                    📅 {formatDateOnly(g.day)}
                  </div>
                  {g.rows.map((c) => (
                    <ChatTimelineRow key={`ag-${g.day}-${c.id}`} chat={c} header={buildHeader(c)} now={now} openMode={openMode} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgendaTimelineList;

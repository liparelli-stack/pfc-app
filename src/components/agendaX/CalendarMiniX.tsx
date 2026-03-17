/*
-- ===================================================
-- Código             : /src/components/agendaX/CalendarMiniX.tsx
-- Versão (.v20)      : 1.5.3
-- Data/Hora          : 2025-11-14 11:55 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Calendário compacto (read-only) com:
--                      • Aro laranja no dia selecionado
--                      • Aro cinza-claro em "hoje" quando não selecionado
--                      • Sem alterar o fundo (bg) do dia selecionado — mantém azul/vermelho/cinza
--                      • Badge verde para dias com ações concluídas (is_done = true)
-- Alterações (1.5.3) :
--   • [DONE] Adicionada contagem opcional de concluídas (done) por dia.
--   • [BADGE] Exibição de badge verde para concluídas, sem alterar a cor de fundo do dia.
-- Alterações (1.5.2) :
--   • [FIX] Removido o highlight de fundo do dia selecionado (bg-gray-100 / dark:bg-white/10).
--     Agora a seleção não sobrescreve o estado azul dos dias.
-- ===================================================
*/

import { useEffect, useMemo, useState } from 'react';
import { getDaySplitCountsForMonth } from '@/services/agendaXBridge';

interface CalendarMiniXProps {
  selectedDate: Date | null;
  onSelect: (d: Date) => void;
  size?: 'md' | 'lg';
}

// done é opcional para manter compatibilidade com a função atual
type SplitCounts = Record<string, { todayActive: number; overdue: number; done?: number }>;

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function addMonths(d: Date, delta: number): Date { return new Date(d.getFullYear(), d.getMonth() + delta, 1); }
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

const CalendarMiniX = ({ selectedDate, onSelect, size = 'md' }: CalendarMiniXProps) => {
  const today = new Date();
  const [viewDate, setViewDate] = useState<Date>(selectedDate ?? new Date());
  const [counts, setCounts] = useState<SplitCounts>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedDate) return;
    setViewDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [selectedDate]);

  useEffect(() => {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    setLoading(true);
    setErr(null);
    setCounts({});
    (async () => {
      try {
        const cnt = await getDaySplitCountsForMonth(y, m);
        setCounts(cnt as SplitCounts);
      } catch (e) {
        console.warn('[CalendarMiniX] load month error:', e);
        setErr('Falha ao carregar dados deste mês.');
      } finally {
        setLoading(false);
      }
    })();
  }, [viewDate]);

  const monthMatrix = useMemo(() => {
    const start = startOfMonth(viewDate);
    const end = endOfMonth(viewDate);
    const startWeekday = start.getDay();
    const daysInMonth = end.getDate();

    const cells: Array<Date | null> = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(viewDate.getFullYear(), viewDate.getMonth(), d));
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: Array<Array<Date | null>> = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [viewDate]);

  const title = useMemo(
    () => viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    [viewDate]
  );

  const cellDims =
    size === 'lg'
      ? { w: 'w-18', h: 'h-28', text: 'text-base' }
      : { w: 'w-16', h: 'h-24', text: 'text-base' };
  const gapClass = 'gap-3';

  const getSplit = (d: Date | null) => {
    if (!d) return { todayActive: 0, overdue: 0, done: 0 };
    const ymd = toYmd(d);
    const raw = counts[ymd] ?? { todayActive: 0, overdue: 0, done: 0 };
    return {
      todayActive: raw.todayActive ?? 0,
      overdue: raw.overdue ?? 0,
      done: raw.done ?? 0,
    };
  };

  const getDayColorClass = (d: Date | null) => {
    if (!d) return 'text-gray-300 dark:text-gray-600';
    const baseBorder = 'border';

    const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
    const dayMidnight = new Date(d);  dayMidnight.setHours(0,0,0,0);
    const { todayActive, overdue } = getSplit(d);

    // Mesma lógica original: vermelho (atrasadas), azul (hoje/ativas/futuro), cinza demais
    if (overdue > 0)  return `${baseBorder} bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30`;
    if (todayActive > 0) return `${baseBorder} bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30`;
    if (dayMidnight > todayMidnight) return `${baseBorder} bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20`;
    return `${baseBorder} bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-500/20`;
  };

  const getButtonBase = () =>
    `${cellDims.w} ${cellDims.h} rounded-lg transition flex flex-col items-center justify-start relative ` +
    `neumorphic-convex hover:neumorphic-concave px-1.5 pt-1.5`;

  return (
    <div className="neumorphic-convex p-4 rounded-2xl bg-plate dark:bg-plate-dark">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold capitalize">{title}</h3>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 rounded-xl neumorphic-convex hover:neumorphic-concave text-sm"
            onClick={() => setViewDate((d) => addMonths(d, -1))}
            aria-label="Mês anterior"
          >‹</button>
          <button
            className="px-4 py-1 rounded-xl neumorphic-convex hover:neumorphic-concave text-sm font-semibold"
            onClick={() => { const t = new Date(); setViewDate(t); onSelect(t); }}
            title="Hoje"
          >Hoje</button>
          <button
            className="px-3 py-1 rounded-xl neumorphic-convex hover:neumorphic-concave text-sm"
            onClick={() => setViewDate((d) => addMonths(d, 1))}
            aria-label="Próximo mês"
          >›</button>
        </div>
      </div>

      {/* Week header */}
      <div className={`grid grid-cols-7 ${gapClass} mb-2 text-sm text-gray-500 dark:text-gray-400`}>
        {WEEKDAYS.map((w, i) => (<div key={`wd-${i}`} className="text-center">{w}</div>))}
      </div>

      {/* Loading */}
      {loading && (
        <div className={`grid grid-cols-7 ${gapClass} animate-pulse`}>
          {Array.from({ length: 42 }).map((_, i) => (
            <div key={`sk-${i}`} className={`${cellDims.w} ${cellDims.h} rounded-lg bg-gray-200 dark:bg-gray-800`} />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && err && <div className="text-red-500 text-sm mb-2">{err}</div>}

      {/* Grid */}
      {!loading && (
        <div className={`grid grid-cols-7 ${gapClass}`}>
          {monthMatrix.flat().map((cell, idx) => {
            const key = cell ? `d-${toYmd(cell)}` : `e-${idx}`;
            const split = cell ? getSplit(cell) : { todayActive: 0, overdue: 0, done: 0 };
            const total = split.todayActive + split.overdue + split.done;
            const isSelected = !!(selectedDate && cell && isSameDay(cell, selectedDate));
            const isToday = !!(cell && isSameDay(cell, new Date()));

            return (
              <div key={key} className="flex items-start justify-center">
                {cell ? (
                  <button
                    className={`${getButtonBase()} ${getDayColorClass(cell)}`}
                    onClick={() => onSelect(new Date(cell))}
                    aria-pressed={isSelected}
                    title={
                      total > 0
                        ? `${split.overdue} atrasadas, ${split.todayActive} ativas, ${split.done} concluídas — ${cell.toLocaleDateString('pt-BR')}`
                        : cell.toLocaleDateString('pt-BR')
                    }
                  >
                    {/* Aros: selecionado = laranja; hoje (não selecionado) = cinza-claro */}
                    {isSelected ? (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-[-4px] rounded-[14px]
                                   ring-4 ring-orange-500 dark:ring-orange-400
                                   ring-offset-2 ring-offset-plate dark:ring-offset-plate-dark"
                        style={{ zIndex: 1 }}
                      />
                    ) : isToday ? (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-[-4px] rounded-[14px]
                                   ring-4 ring-gray-400/70 dark:ring-gray-300/70
                                   ring-offset-2 ring-offset-plate dark:ring-offset-plate-dark"
                        style={{ zIndex: 1 }}
                      />
                    ) : null}

                    {/* Dia (top-left) */}
                    <div className={`${cellDims.text} font-semibold self-start relative z-10`}>{cell.getDate()}</div>

                    {/* Badges (bottom-right) */}
                    {total > 0 && (
                      <div className="absolute bottom-1 right-1 flex flex-col items-end gap-1 z-10">
                        {split.overdue > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] leading-[18px] font-bold
                                           text-red-600 dark:text-red-300 text-center bg-gray-900/10 dark:bg-white/10">
                            {split.overdue}
                          </span>
                        )}
                        {split.todayActive > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] leading-[18px] font-bold
                                           text-blue-600 dark:text-blue-300 text-center bg-gray-900/10 dark:bg-white/10">
                            {split.todayActive}
                          </span>
                        )}
                        {split.done > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] leading-[18px] font-bold
                                           text-green-600 dark:text-green-300 text-center bg-gray-900/10 dark:bg-white/10">
                            {split.done}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                ) : (
                  <div className={`${cellDims.w} ${cellDims.h}`} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CalendarMiniX;

/*
-- ===================================================
-- Código             : /src/components/agendaX/ChatsTimeline.tsx
-- Versão (.v20)      : 1.5.3
-- Data/Hora          : 2025-12-17 12:35 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Listagem de chats (somente leitura) com abas [Do Dia | Histórico | Ambos],
--                      busca, paginação, modo aberto e budgets detalhados.
--                      Inclui header de identificação no card (LEGADO):
--                      • Empresa → Linha do Tempo: DD/MM/YY - HH:MM | Contato (separador visual padrão).
-- Fluxo              : DayContextPanel/AgendaXPage → ChatsTimeline → agendaXBridge
-- Alterações (1.5.3) :
--   • [UX] Header L1 agora é "DD/MM/YY - HH:MM | Contato" (data primeiro).
--   • [UX] Header vira faixa separadora padrão (bg leve + barra lateral + fonte #2722b6).
--   • [SAFE] Restante do card permanece idêntico.
-- ===================================================
*/

import { useEffect, useMemo, useState } from 'react';
import {
  getCompanyChatsByDay,
  getCompanyChatsHistory,
  AXChat,
} from '@/services/agendaXBridge';
import { Flame, Thermometer, Snowflake, HelpCircle, MinusCircle } from 'lucide-react';
import clsx from 'clsx';

/* ===== Helpers de data/hora (local) ===== */
function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function localISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function localHHMM(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/* ===== Helpers de formatação ===== */
function formatDateOnly(ymd?: string | null) {
  if (!ymd) return '';
  const [y, m, d] = String(ymd).split('-');
  if (!y || !m || !d) return String(ymd);
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
}
function formatTimeHHMM(t?: string | null) {
  if (!t) return '';
  return String(t).slice(0, 5);
}
function formatDateTimeFromCalendar(ymd?: string | null, time?: string | null) {
  if (!ymd) return '';
  const date = formatDateOnly(ymd);
  const hhmm = formatTimeHHMM(time);
  return hhmm ? `${date} - ${hhmm}` : date;
}

/* ===== Ordenação e agrupamento ===== */
function cmpTimeAsc(a?: string | null, b?: string | null) {
  const aa = a ? String(a).slice(0, 5) : '';
  const bb = b ? String(b).slice(0, 5) : '';
  if (aa && bb) return aa.localeCompare(bb);
  if (aa && !bb) return -1;
  if (!aa && bb) return 1;
  return 0;
}
function cmpDateAsc(a?: string | null, b?: string | null) {
  if (a && b) return a.localeCompare(b);
  if (a && !b) return -1;
  if (!a && b) return 1;
  return 0;
}
function sortByDateTimeAsc(items: AXChat[]): AXChat[] {
  return [...items].sort((x, y) => {
    const d = cmpDateAsc(x.calendar_at, y.calendar_at);
    if (d !== 0) return d;
    const t = cmpTimeAsc(x.on_time, y.on_time);
    if (t !== 0) return t;

    const cx = (x as any)?.created_at ? String((x as any).created_at) : '';
    const cy = (y as any)?.created_at ? String((y as any).created_at) : '';
    if (cx && cy) return cx.localeCompare(cy);
    return String(x.id || '').localeCompare(String(y.id || ''));
  });
}
function groupByDateSorted(items: AXChat[]): Array<{ day: string; rows: AXChat[] }> {
  const map = new Map<string, AXChat[]>();
  for (const r of items) {
    const key = r.calendar_at || '—';
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  const days = Array.from(map.keys()).sort(cmpDateAsc);
  return days.map((day) => ({ day, rows: sortByDateTimeAsc(map.get(day) ?? []) }));
}

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

  return { label: (ch || kind || 'Tipo').replace(/\b\w/g, m => m.toUpperCase()), className: 'bg-gray-300 text-gray-900' };
}

const TYPE_LABELS = [
  'Ligação','Ligação (E)','Ligação (R)','Mensagem','Whats (E)','Whats (R)',
  'E-mail (E)','E-mail (R)','Tarefa','Orçamento','Follow-up','Visita','Informação','Interna','Almoço','Reunião',
];
const BADGE_MIN_CH = Math.max(...TYPE_LABELS.map(s => s.length)) + 2;

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

/* ===== Merge utilitário para histórico (evita duplicar IDs) ===== */
function mergeUniqueById(prev: AXChat[], next: AXChat[]): AXChat[] {
  const map = new Map<string, AXChat>();
  for (const item of prev) map.set(item.id, item);
  for (const item of next) map.set(item.id, item);
  return Array.from(map.values());
}

/* ===== Quick-filter ===== */
type QuickFilter = 'todas' | 'agendadas' | 'atrasadas' | 'concluidas';

function classifyChat(c: AXChat, now: Date) {
  const today = localISODate(now);
  const nowHH = localHHMM(now);

  const done = !!c.is_done;
  const day = c.calendar_at || null;
  const hh = c.on_time ? String(c.on_time).slice(0, 5) : null;

  if (!day) return { isDone: done, isOverdue: false, isScheduled: !done };
  if (done) return { isDone: true, isOverdue: false, isScheduled: false };

  if (day < today) return { isDone: false, isOverdue: true, isScheduled: false };
  if (day > today) return { isDone: false, isOverdue: false, isScheduled: true };

  if (!hh) return { isDone: false, isOverdue: false, isScheduled: true };
  if (hh < nowHH) return { isDone: false, isOverdue: true, isScheduled: false };
  return { isDone: false, isOverdue: false, isScheduled: true };
}

function applyQuickFilter(items: AXChat[], qf: QuickFilter, now: Date) {
  if (qf === 'todas') return items;
  return items.filter((c) => {
    const k = classifyChat(c, now);
    if (qf === 'concluidas') return k.isDone;
    if (qf === 'atrasadas') return k.isOverdue;
    if (qf === 'agendadas') return k.isScheduled;
    return true;
  });
}

/* ===== Helpers: contato (tolerante) ===== */
function resolveContactName(c: AXChat): string {
  const anyC = c as any;
  const name =
    anyC?.contact_full_name ||
    anyC?.contact_name ||
    anyC?.contact?.full_name ||
    anyC?.contact?.name ||
    '';

  return String(name || '').trim();
}

/* ============================ */
interface ChatsTimelineProps {
  companyId: string;
  dayISO: string;                              // YYYY-MM-DD
  initialTab?: 'dia' | 'historico' | 'ambos';  // default 'dia'
  pageSize?: number;                           // default 20
  openMode?: boolean;                          // default true → tudo aberto
}
const Tabs = ['dia', 'historico', 'ambos'] as const;

const SkeletonRow = () => (
  <div className="animate-pulse h-4 w-full bg-gray-200 dark:bg-gray-800 rounded mb-2" />
);

const QUICK_FILTERS: Array<{ key: QuickFilter; label: string }> = [
  { key: 'todas', label: 'Todas' },
  { key: 'agendadas', label: 'Agendadas' },
  { key: 'atrasadas', label: 'Atrasadas' },
  { key: 'concluidas', label: 'Concluídas' },
];

const ChatsTimeline = ({
  companyId,
  dayISO,
  initialTab = 'dia',
  pageSize = 20,
  openMode = true,
}: ChatsTimelineProps) => {
  const [tab, setTab] = useState<(typeof Tabs)[number]>(initialTab);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('todas');

  const [search, setSearch] = useState('');
  const [loadingDay, setLoadingDay] = useState(false);
  const [loadingHist, setLoadingHist] = useState(false);
  const [errDay, setErrDay] = useState<string | null>(null);
  const [errHist, setErrHist] = useState<string | null>(null);

  const [dayItems, setDayItems] = useState<AXChat[]>([]);
  const [histItems, setHistItems] = useState<AXChat[]>([]);
  const [histTotal, setHistTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [groupByDate, setGroupByDate] = useState(false); // OFF por padrão

  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  /* ===== Carrega "Do Dia" ===== */
  useEffect(() => {
    let alive = true;
    setLoadingDay(true);
    setErrDay(null);
    setDayItems([]);
    getCompanyChatsByDay(companyId, dayISO)
      .then((items) => {
        if (!alive) return;
        setDayItems(items);
      })
      .catch((e) => {
        console.warn('[ChatsTimeline] dia error:', e);
        if (!alive) return;
        setErrDay('Falha ao carregar os chats do dia.');
      })
      .finally(() => alive && setLoadingDay(false));
    return () => {
      alive = false;
    };
  }, [companyId, dayISO]);

  /* ===== Histórico ===== */
  const loadHistory = async (reset = false) => {
    const targetPage = reset ? 1 : page;
    setLoadingHist(true);
    setErrHist(null);
    try {
      const { items, total } = await getCompanyChatsHistory(companyId, {
        page: targetPage,
        pageSize,
        search: search || undefined,
        dayISO,
      });
      if (reset) {
        setHistItems(items);
        setPage(1);
      } else {
        setHistItems(prev => mergeUniqueById(prev, items));
      }
      setHistTotal(total);
    } catch (e) {
      console.warn('[ChatsTimeline] historico error:', e);
      setErrHist('Falha ao carregar o histórico.');
    } finally {
      setLoadingHist(false);
    }
  };

  useEffect(() => {
    if (tab === 'historico' || tab === 'ambos') {
      loadHistory(true);
    } else {
      setHistItems([]);
      setHistTotal(0);
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, companyId, dayISO]);

  const onApplySearch = () => {
    if (tab === 'historico' || tab === 'ambos') {
      loadHistory(true);
    }
  };

  const canLoadMore = useMemo(
    () => histItems.length < histTotal && !loadingHist,
    [histItems.length, histTotal, loadingHist]
  );

  const onLoadMore = async () => {
    if (!canLoadMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    try {
      const { items } = await getCompanyChatsHistory(companyId, {
        page: nextPage,
        pageSize,
        search: search || undefined,
        dayISO,
      });
      setHistItems(prev => mergeUniqueById(prev, items));
    } catch (e) {
      console.warn('[ChatsTimeline] load more error:', e);
      setErrHist('Falha ao carregar mais registros.');
    }
  };

  /* ===== Budgets detalhados ===== */
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

  /* ===== Linha ===== */
  const Row = ({ c }: { c: AXChat }) => {
    const activeBudgets = Array.isArray(c.budgets)
      ? c.budgets.filter((b: any) => {
          const status = (b?.status ?? '').toString().trim().toLowerCase();
          return status !== 'terminado';
        })
      : [];

    const status = classifyChat(c, now);

    const contactName = resolveContactName(c);
    const contactLabel = contactName ? contactName : 'Sem contato';
    const whenLabel = formatDateTimeFromCalendar(c.calendar_at, c.on_time) || '—';

    // ✅ Legado (modo empresa): DataHora primeiro
    const header = (
  <>
    <span className="font-semibold">{whenLabel}</span>
    <span className="mx-2 text-gray-400">|</span>
    <span className="font-medium">{contactLabel}</span>
  </>
   );


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
            'mb-2 rounded-md px-2 py-1',
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
            <TempIcon temp={c.temperature} />
            <strong>{c.subject || '(Sem assunto)'}</strong>
            {c.priority ? (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {c.priority}
              </span>
            ) : null}
          </div>

          <div className="text-xs text-gray-500 flex items-center gap-2">
            {c.is_done ? <ConcludedBadge /> : null}
            {!c.is_done && status.isOverdue ? <OverdueBadge /> : null}
            <TypeBadge row={c} />
          </div>
        </div>

        {c.body ? (
          <div className={`text-xs text-gray-700 dark:text-gray-200 mt-1 ${openMode ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
            {c.body}
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

  /* ===== Preparação de dados: filtro → ordenação → agrupamento ===== */
  const dayFiltered = useMemo(
    () => applyQuickFilter(dayItems, quickFilter, now),
    [dayItems, quickFilter, now]
  );
  const histFiltered = useMemo(
    () => applyQuickFilter(histItems, quickFilter, now),
    [histItems, quickFilter, now]
  );

  const dayItemsSorted = useMemo(
    () => sortByDateTimeAsc(dayFiltered),
    [dayFiltered]
  );

  const histItemsSorted = useMemo(() => {
    if (groupByDate) return histFiltered;
    return sortByDateTimeAsc(histFiltered);
  }, [histFiltered, groupByDate]);

  const histGroups = useMemo(() => {
    if (!groupByDate) return [];
    return groupByDateSorted(histFiltered);
  }, [histFiltered, groupByDate]);

  return (
    <div className="bg-plate dark:bg-plate-dark p-4 rounded-2xl neumorphic-convex">
      <div className="mb-3 space-y-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex overflow-hidden rounded-xl neumorphic-convex">
            {Tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-2 text-sm ${t === tab ? 'bg-primary text-white' : 'hover:neumorphic-concave'}`}
                aria-pressed={t === tab}
              >
                {t === 'dia' && <>Do Dia</>}
                {t === 'historico' && <>Histórico</>}
                {t === 'ambos' && <>Ambos</>}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setGroupByDate(v => !v)}
              className={clsx(
                'px-3 py-2 rounded-lg neumorphic-convex hover:neumorphic-concave text-sm',
                groupByDate && 'bg-primary text-white'
              )}
              aria-pressed={groupByDate}
              title="Ativar agrupamento por data"
            >
              Agrupar
            </button>

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

          {!loadingDay && !groupByDate && dayItemsSorted.length === 0 && !errDay && (
            <div className="text-sm text-gray-500 italic">Nenhuma ação neste dia.</div>
          )}
          {!loadingDay && !groupByDate && dayItemsSorted.map((c) => <Row key={c.id} c={c} />)}

          {groupByDate && !loadingDay && (
            <div>
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                📅 {formatDateOnly(dayISO)}
              </div>
              {dayItemsSorted.length === 0 ? (
                <div className="text-sm text-gray-500 italic">Nenhuma ação neste dia.</div>
              ) : (
                dayItemsSorted.map((c) => <Row key={`dg-${c.id}`} c={c} />)
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'historico' && (
        <div>
          {loadingHist && histItems.length === 0 && (<><SkeletonRow /><SkeletonRow /><SkeletonRow /></>)}
          {errHist && <div className="text-red-600 dark:text-red-400 text-sm mb-2">{errHist}</div>}

          {!loadingHist && !groupByDate && histItemsSorted.length === 0 && !errHist && (
            <div className="text-sm text-gray-500 italic">Nenhum registro encontrado.</div>
          )}
          {!loadingHist && !groupByDate && histItemsSorted.map((c) => <Row key={c.id} c={c} />)}

          {!loadingHist && groupByDate && (
            <div>
              {histGroups.length === 0 ? (
                <div className="text-sm text-gray-500 italic">Nenhum registro encontrado.</div>
              ) : (
                histGroups.map(g => (
                  <div key={g.day} className="mb-3">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                      📅 {formatDateOnly(g.day)}
                    </div>
                    {g.rows.map(c => <Row key={c.id} c={c} />)}
                  </div>
                ))
              )}
            </div>
          )}

          {!groupByDate && canLoadMore && (
            <div className="mt-2">
              <button
                onClick={onLoadMore}
                className="px-3 py-2 rounded-lg neumorphic-convex hover:neumorphic-concave text-sm"
              >
                Carregar mais
              </button>
              <span className="ml-2 text-xs text-gray-500">
                {histItems.length} / {histTotal}
              </span>
            </div>
          )}
        </div>
      )}

      {tab === 'ambos' && (
        <div>
          <div className="mb-2 text-xs text-gray-500">Do Dia</div>
          {loadingDay && (<><SkeletonRow /><SkeletonRow /></>)}
          {errDay && <div className="text-red-600 dark:text-red-400 text-sm mb-2">{errDay}</div>}
          {!loadingDay && !groupByDate && dayItemsSorted.length === 0 && !errDay && (
            <div className="text-sm text-gray-500 italic mb-2">Nenhuma ação neste dia.</div>
          )}
          {!loadingDay && !groupByDate && dayItemsSorted.map((c) => <Row key={`d-${c.id}`} c={c} />)}
          {!loadingDay && groupByDate && (
            <div className="mb-2">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                📅 {formatDateOnly(dayISO)}
              </div>
              {dayItemsSorted.length === 0 ? (
                <div className="text-sm text-gray-500 italic mb-2">Nenhuma ação neste dia.</div>
              ) : (
                dayItemsSorted.map((c) => <Row key={`dg-${c.id}`} c={c} />)
              )}
            </div>
          )}

          <div className="mt-3 mb-2 text-xs text-gray-500">Histórico</div>
          {loadingHist && histItems.length === 0 && (<><SkeletonRow /><SkeletonRow /></>)}
          {errHist && <div className="text-red-600 dark:text-red-400 text-sm mb-2">{errHist}</div>}
          {!loadingHist && !groupByDate && histItemsSorted.length === 0 && !errHist && (
            <div className="text-sm text-gray-500 italic">Nenhum registro encontrado.</div>
          )}
          {!loadingHist && !groupByDate && histItemsSorted.map((c) => <Row key={`h-${c.id}`} c={c} />)}
          {!loadingHist && groupByDate && (
            <div>
              {histGroups.length === 0 ? (
                <div className="text-sm text-gray-500 italic">Nenhum registro encontrado.</div>
              ) : (
                histGroups.map(g => (
                  <div key={`hg-${g.day}`} className="mb-3">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                      📅 {formatDateOnly(g.day)}
                    </div>
                    {g.rows.map(c => <Row key={`hg-${g.day}-${c.id}`} c={c} />)}
                  </div>
                ))
              )}
            </div>
          )}
          {!groupByDate && canLoadMore && (
            <div className="mt-2">
              <button
                onClick={onLoadMore}
                className="px-3 py-2 rounded-lg neumorphic-convex hover:neumorphic-concave text-sm"
              >
                Carregar mais
              </button>
              <span className="ml-2 text-xs text-gray-500">
                {histItems.length} / {histTotal}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatsTimeline;

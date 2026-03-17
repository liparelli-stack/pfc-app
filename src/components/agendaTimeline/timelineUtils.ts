/*
-- ===================================================
-- Código             : /src/components/agendaTimeline/timelineUtils.ts
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-12-17 12:10 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Utilitários compartilhados da Timeline (V1): data local,
--                      formatação, ordenação, agrupamento, classificação (agendada/atrasada/concluída),
--                      e helpers de busca tolerante.
-- Fluxo              : AgendaTimelinePanel -> AgendaTimelineList -> ChatTimelineRow
-- Alterações (1.0.0) :
--   • [NEW] Helpers locais para evitar bug UTC.
--   • [NEW] Classificação compatível com legado.
-- ===================================================
*/

import type { AXChat } from '@/services/agendaXBridge';

/* ===== Helpers de data/hora (local) ===== */
export function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function localISODate(d: Date) {
  // YYYY-MM-DD em timezone local (evita "vazar" para UTC via toISOString)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function localHHMM(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/* ===== Helpers de formatação ===== */
export function formatDateOnly(ymd?: string | null) {
  if (!ymd) return '';
  const [y, m, d] = String(ymd).split('-');
  if (!y || !m || !d) return String(ymd);
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
}

export function formatTimeHHMM(t?: string | null) {
  if (!t) return '';
  return String(t).slice(0, 5);
}

export function formatDateTimeFromCalendar(ymd?: string | null, time?: string | null) {
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

export function sortByDateTimeAsc(items: AXChat[]): AXChat[] {
  return [...items].sort((x, y) => {
    const d = cmpDateAsc(x.calendar_at, y.calendar_at);
    if (d !== 0) return d;
    const t = cmpTimeAsc(x.on_time, y.on_time);
    if (t !== 0) return t;

    // Fallback estável: created_at -> id
    const cx = (x as any)?.created_at ? String((x as any).created_at) : '';
    const cy = (y as any)?.created_at ? String((y as any).created_at) : '';
    if (cx && cy) return cx.localeCompare(cy);
    return String(x.id || '').localeCompare(String(y.id || ''));
  });
}

export function groupByDateSorted(items: AXChat[]): Array<{ day: string; rows: AXChat[] }> {
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

/* ===== Quick-filter ===== */
export type QuickFilter = 'todas' | 'agendadas' | 'atrasadas' | 'concluidas';

export function classifyChat(c: AXChat, now: Date) {
  const today = localISODate(now);
  const nowHH = localHHMM(now);

  const done = !!c.is_done;
  const day = c.calendar_at || null;
  const hh = c.on_time ? String(c.on_time).slice(0, 5) : null;

  if (!day) {
    return { isDone: done, isOverdue: false, isScheduled: !done };
  }

  if (done) {
    return { isDone: true, isOverdue: false, isScheduled: false };
  }

  if (day < today) return { isDone: false, isOverdue: true, isScheduled: false };
  if (day > today) return { isDone: false, isOverdue: false, isScheduled: true };

  // hoje:
  if (!hh) return { isDone: false, isOverdue: false, isScheduled: true };
  if (hh < nowHH) return { isDone: false, isOverdue: true, isScheduled: false };
  return { isDone: false, isOverdue: false, isScheduled: true };
}

export function applyQuickFilter(items: AXChat[], qf: QuickFilter, now: Date) {
  if (qf === 'todas') return items;
  return items.filter((c) => {
    const k = classifyChat(c, now);
    if (qf === 'concluidas') return k.isDone;
    if (qf === 'atrasadas') return k.isOverdue;
    if (qf === 'agendadas') return k.isScheduled;
    return true;
  });
}

/* ===== Busca tolerante (cliente) ===== */
export function matchesSearch(c: AXChat, raw: string) {
  const s = (raw || '').trim().toLowerCase();
  if (!s) return true;
  const subj = String(c.subject || '').toLowerCase();
  const body = String(c.body || '').toLowerCase();
  return subj.includes(s) || body.includes(s);
}

/* ===== Helpers: contato/empresa (tolerante) ===== */
export function resolveContactName(c: AXChat): string {
  const anyC = c as any;
  const name =
    anyC?.contact_full_name ||
    anyC?.contact_name ||
    anyC?.contact?.full_name ||
    anyC?.contact?.name ||
    '';
  return String(name || '').trim();
}

export function resolveCompanyName(c: AXChat): string {
  const anyC = c as any;
  const name =
    anyC?.company_trade_name ||
    anyC?.company_name ||
    anyC?.company?.trade_name ||
    anyC?.company?.name ||
    '';
  return String(name || '').trim();
}

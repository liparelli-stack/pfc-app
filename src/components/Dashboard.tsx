/*
-- ===================================================
-- Código                 : /src/components/Dashboard.tsx
-- Versão (.v19)          : 2.10.13
-- Data/Hora              : 2025-12-17 00:00 America/Sao_Paulo
-- Autor                  : FL / Execução via você EVA
-- Objetivo               : Alpidação final no Quadro 2 – Agenda:
--                          • Resumo: reduzir competição visual de “Demais semanas”
--                          • Resumo: melhorar respiro vertical (divisor/linhas)
-- Fluxo                  : App.tsx → AuthContext(currentProfileLite,user) → Dashboard.tsx
-- Alterações (2.10.13)   :
--   • AgendaSummaryCard:
--      - “Demais semanas” com menor opacidade
--      - Mais espaçamento entre divisor de ano e linhas subsequentes
--      - Pequeno respiro entre blocos
-- Dependências           : React, AuthContext, Supabase, useDashboardQuadro1,
--                          useDashboardQuadro3, MiniPie, lucide-react
-- ===================================================
*/

import React, { useMemo, useEffect, useState } from "react";
import {
  Users,
  TrendingUp,
  Briefcase,
  Clock,
  Phone,
  FileText,
  BarChart2,
  DollarSign,
  Building,
  CalendarDays,
  ArrowRightCircle,
  AlertCircle,
  UserCheck,
  UserX,
  Flame,
  Thermometer,
  MinusCircle,
  Snowflake,
  User, // ✅ ícone pessoa
  HelpCircle,
  CalendarCheck2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { useDashboardQuadro1 } from "@/hooks/useDashboardQuadro1";
import { useDashboardQuadro3, TemperatureKey } from "@/hooks/useDashboardQuadro3";
import MiniPie from "@/components/vision360/mini/MiniPie";

/* ============================== Tipos util ============================== */
type SalutationPref = "masculino" | "feminino" | "neutro";

interface ChatRow {
  id: string;
  subject: string | null;
  calendar_at: string | null; // YYYY-MM-DD
  on_time: string | null; // HH:MM:SS
  kind: string | null;
  direction: string | null;
  channel_type: string | null;
  is_done: boolean;

  company_name?: string | null;
  contact_name?: string | null;
}

interface AgendaTodayItem {
  id: string;
  title: string;
  tag: string;
  tagColor: string;
  timeLabel?: string;
  overdue: boolean;
  kind: string | null;
  calendarDate: string | null; // YYYY-MM-DD | null
  isToday: boolean;
  isTomorrow: boolean;
  isNoDate: boolean;

  companyName?: string | null;
  contactName?: string | null;
  contactFull?: string | null;
}

/* ============================== Helpers =============================== */
function resolveTimeZone(profileTz?: string | null): string {
  if (profileTz) return profileTz;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) return tz;
  } catch {}
  return "America/Sao_Paulo";
}

function getLocalHour(tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hour12: false,
      timeZone: tz,
    }).formatToParts(new Date());
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    return Number.isFinite(hour) ? hour : new Date().getHours();
  } catch {
    return new Date().getHours();
  }
}

function getGreetingByHour(hour: number): "Bom dia" | "Boa tarde" | "Boa noite" {
  if (hour <= 11) return "Bom dia";
  if (hour <= 17) return "Boa tarde";
  return "Boa noite";
}

function getGenderPrefix(pref?: SalutationPref | null): "Bem-vindo" | "Bem-vinda" | "Bem-vindo(a)" {
  if (pref === "masculino") return "Bem-vindo";
  if (pref === "feminino") return "Bem-vinda";
  return "Bem-vindo(a)";
}

function getCardGradient(hour: number): string {
  if (hour <= 11) return "linear-gradient(135deg, rgba(251,191,36,0.50) 0%, rgba(249,115,22,0.60) 100%)";
  if (hour <= 17) return "linear-gradient(135deg, rgba(14,165,233,0.50) 0%, rgba(79,70,229,0.60) 100%)";
  return "linear-gradient(135deg, rgba(79,70,229,0.50) 0%, rgba(30,58,138,0.60) 100%)";
}

/**
 * Gera string YYYY-MM-DD respeitando o timezone, com deslocamento em dias.
 * offsetDays: 0 = hoje, 1 = amanhã, -7 = 7 dias atrás, etc.
 */
function getDateYMD(timezone: string, offsetDays: number): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(shifted);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function formatDDMM(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}`;
}

function formatDDMMYY(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  const yy = y.slice(-2);
  return `${d}/${m}/${yy}`;
}

function normalizeText(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function toCanonUpper(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function stripCommonLeadingWord(company: string): string {
  const normalized = normalizeText(company);
  const firstRaw = normalized.split(" ")[0] ?? "";
  const firstCanon = toCanonUpper(firstRaw).replace(/[^A-Z.]/g, "");

  const STOP = new Set(["HOSPITAL", "HOSP.", "HOSP", "HOSPITALAR"]);

  if (!STOP.has(firstCanon)) return normalized;

  const rest = normalized.split(" ").slice(1).join(" ").trim();
  return rest.length > 0 ? rest : normalized;
}

function smartTruncate(input: string, max: number): string {
  const s = normalizeText(input);
  if (s.length <= max) return s;

  const cut = s.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base =
    lastSpace > Math.floor(max * 0.6)
      ? cut.slice(0, lastSpace).trim()
      : s.slice(0, max).trim();

  return `${base}…`;
}

/**
 * L2: Diferenciador (SEM UF)
 */
function buildCompanyDifferentiatorLine(companyRaw?: string | null): { text: string; title: string } {
  const full = normalizeText(companyRaw ?? "");
  if (!full) return { text: "", title: "" };

  const diff = stripCommonLeadingWord(full);
  const text = smartTruncate(diff, 44);

  return { text, title: full };
}

function buildLine1Subject(subject?: string | null): string {
  const s = (subject ?? "").trim();
  return s.length > 0 ? s.toUpperCase() : "COMPROMISSO SEM TÍTULO";
}

function buildLine1Contact(contact?: string | null): string {
  const c = normalizeText(contact ?? "");
  return c ? smartTruncate(c, 24) : "";
}

function getWeekdayIndexForYMDInTZ(tz: string, ymd: string): number | null {
  const [yy, mm, dd] = ymd.split("-").map(Number);
  if (!yy || !mm || !dd) return null;

  const dt = new Date(Date.UTC(yy, mm - 1, dd, 12, 0, 0));
  try {
    const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(dt);
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[wd] ?? null;
  } catch {
    return dt.getUTCDay();
  }
}

function addDaysToYMD(tz: string, ymd: string, deltaDays: number): string {
  const [yy, mm, dd] = ymd.split("-").map(Number);
  const base = new Date(Date.UTC(yy, (mm || 1) - 1, dd || 1, 12, 0, 0));
  const shifted = new Date(base.getTime() + deltaDays * 24 * 60 * 60 * 1000);

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(shifted);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

/**
 * Semana útil seg–sex com sáb/dom agrupados na semana da sexta anterior.
 */
function getBusinessWeekRangeForYMD(tz: string, ymd: string): { startYMD: string; endYMD: string } | null {
  const wd = getWeekdayIndexForYMDInTZ(tz, ymd);
  if (wd == null) return null;

  let effectiveYMD = ymd;
  if (wd === 6) effectiveYMD = addDaysToYMD(tz, ymd, -1);
  if (wd === 0) effectiveYMD = addDaysToYMD(tz, ymd, -2);

  const wdEff = getWeekdayIndexForYMDInTZ(tz, effectiveYMD);
  if (wdEff == null) return null;

  const backToMonday = -((wdEff + 6) % 7);
  const startYMD = addDaysToYMD(tz, effectiveYMD, backToMonday);
  const endYMD = addDaysToYMD(tz, startYMD, 4);
  return { startYMD, endYMD };
}

function getWeekdayIndexInTZForNow(tz: string): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date());
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? new Date().getDay();
}

function getBusinessWeekRangeForNow(tz: string, offsetWeeks: number): { startYMD: string; endYMD: string } {
  const wd = getWeekdayIndexInTZForNow(tz);

  let backToMonday = -((wd + 6) % 7);
  if (wd === 6) backToMonday = -5;
  if (wd === 0) backToMonday = -6;

  const startOffset = backToMonday + offsetWeeks * 7;
  const startYMD = getDateYMD(tz, startOffset);
  const endYMD = getDateYMD(tz, startOffset + 4);
  return { startYMD, endYMD };
}

/**
 * Resolve etiqueta (tag) e cor com base em kind/direction/channel_type.
 */
function resolveAgendaTag(row: ChatRow): { label: string; color: string } {
  const kind = row.kind ?? "";
  const channel = (row.channel_type ?? "").toLowerCase();
  const direction = (row.direction ?? "").toLowerCase();

  if (kind === "call") {
    if (direction === "outbound") return { label: "Ligação (E)", color: "#6D28D9" };
    if (direction === "inbound") return { label: "Ligação (R)", color: "#4C1D95" };
    return { label: "Ligação", color: "#4C1D95" };
  }

  if (kind === "message") {
    if (channel === "whatsapp") {
      if (direction === "outbound") return { label: "Whats (E)", color: "#047857" };
      if (direction === "inbound") return { label: "Whats (R)", color: "#065F46" };
    }
    if (channel === "email") {
      if (direction === "outbound") return { label: "E-mail (E)", color: "#1D4ED8" };
      if (direction === "inbound") return { label: "E-mail (R)", color: "#22429E" };
    }
    return { label: "Mensagem", color: "#34B4BA" };
  }

  if (kind === "task") return { label: "Tarefa", color: "#996633" };
  return { label: "Ação", color: "#9013FE" };
}

function resolveAgendaIcon(kind: string | null) {
  if (kind === "call") return Phone;
  if (kind === "task") return FileText;
  if (kind === "message") return Clock;
  return Clock;
}

function formatTimeLabelDefault(
  calendarDate: string,
  onTime: string | undefined,
  todayStr: string,
  tomorrowStr: string
): string | undefined {
  const time = onTime ? onTime.slice(0, 5) : undefined;
  if (!time) return undefined;

  if (calendarDate === todayStr) return time;
  if (calendarDate === tomorrowStr) return `Amanhã · ${time}`;

  const dateLabel = formatDDMM(calendarDate);
  return `${dateLabel} ${time}`;
}

function formatTimeLabelOverdue(ymd: string, onTime?: string | null): string | undefined {
  const time = onTime ? onTime.slice(0, 5) : undefined;
  if (!time) return undefined;
  return `${formatDDMMYY(ymd)} ${time}`;
}

/* ============================== Temperaturas (Quadro 3) =============================== */
function getTemperatureIcon(key: TemperatureKey) {
  switch (key) {
    case "hot": return Flame;
    case "warm": return Thermometer;
    case "neutral": return MinusCircle;
    case "cold": return Snowflake;
    default: return MinusCircle;
  }
}

function getTemperatureBarClass(key: TemperatureKey): string {
  switch (key) {
    case "hot": return "bg-red-500";
    case "warm": return "bg-amber-400";
    case "neutral": return "bg-slate-400";
    case "cold": return "bg-sky-500";
    default: return "bg-slate-400";
  }
}

function getTemperatureLabel(key: TemperatureKey): string {
  switch (key) {
    case "hot": return "Quente";
    case "warm": return "Morna";
    case "neutral": return "Neutra";
    case "cold": return "Fria";
    default: return "Neutra";
  }
}

function getTemperatureTooltipForActions(key: TemperatureKey): string {
  return `Ações com temperatura ${getTemperatureLabel(key)}`;
}
function getTemperatureTooltipForCompanies(key: TemperatureKey): string {
  return `Empresas com predominância ${getTemperatureLabel(key)}`;
}
function getTemperatureTooltipForTimeline(key: TemperatureKey): string {
  return `Distribuição temporal da temperatura ${getTemperatureLabel(key)}`;
}

/**
 * Hook local para carregar a Agenda do usuário logado:
 */
function useAgendaHoje(timezone: string) {
  const [items, setItems] = useState<AgendaTodayItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function fetchAgendaHoje() {
      setLoading(true);
      setError(null);

      try {
        const todayStr = getDateYMD(timezone, 0);
        const tomorrowStr = getDateYMD(timezone, 1);

        // Mantido como estava (não mexer agora)
        const now = new Date();
        const nowHours = now.getHours().toString().padStart(2, "0");
        const nowMinutes = now.getMinutes().toString().padStart(2, "0");
        const nowHM = `${nowHours}:${nowMinutes}`;

        const { data, error } = await supabase
          .from("vw_dashboard_user_agenda")
          .select("id, subject, calendar_at, on_time, kind, direction, channel_type, is_done, company_name, contact_name")
          .eq("is_done", false)
          .order("calendar_at", { ascending: true })
          .order("on_time", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(100);

        if (error) throw error;
        if (isCancelled) return;

        const rows = (data ?? []) as ChatRow[];

        const mapped: AgendaTodayItem[] = rows.map((row) => {
          const dateStr = row.calendar_at;
          const { label, color } = resolveAgendaTag(row);
          const rawTime = row.on_time ? row.on_time.slice(0, 5) : undefined;

          const isNoDate = !dateStr;
          const isToday = !!dateStr && dateStr === todayStr;
          const isTomorrow = !!dateStr && dateStr === tomorrowStr;

          const overdue =
            !!dateStr &&
            (dateStr < todayStr ||
              (isToday && !!rawTime && rawTime < nowHM));

          const timeLabel =
            dateStr && overdue
              ? formatTimeLabelOverdue(dateStr, row.on_time ?? undefined)
              : dateStr
                ? formatTimeLabelDefault(dateStr, row.on_time ?? undefined, todayStr, tomorrowStr)
                : undefined;

          const contactFull = normalizeText(row.contact_name ?? "");
          const contactCompact = buildLine1Contact(contactFull);

          return {
            id: row.id,
            title: row.subject || "Compromisso sem título",
            tag: label,
            tagColor: color,
            timeLabel,
            overdue,
            kind: row.kind,
            calendarDate: dateStr ?? null,
            isToday,
            isTomorrow,
            isNoDate,
            companyName: row.company_name ?? null,
            contactName: contactCompact || null,
            contactFull: contactFull || null,
          };
        });

        setItems(mapped);
      } catch (err) {
        console.error("[Dashboard] Erro ao carregar Agenda:", err);
        if (!isCancelled) setError("Erro ao carregar a agenda de hoje.");
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    fetchAgendaHoje();
    return () => { isCancelled = true; };
  }, [timezone]);

  const overdueCount = useMemo(() => items.filter((i) => i.overdue).length, [items]);
  const todaysCount = useMemo(() => items.filter((i) => i.isToday).length, [items]);

  return { items, loading, error, overdueCount, todaysCount };
}

/* ============================ UI Reutilizáveis ============================ */


const NeumorphicCard: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => (
  <div
    className={`relative bg-plate dark:bg-dark-s1 rounded-2xl p-6 neumorphic-convex hover:neumorphic-concave active:neumorphic-concave transition-all duration-200 ${className}`}
  >
    {children}
  </div>
);

const IndicatorCard: React.FC<{
  icon: React.ComponentType<any>;
  label: string;
  value: string | number;
  iconBg: string;
}> = ({ icon: Icon, label, value, iconBg }) => (
  <NeumorphicCard className="flex items-center p-4">
    <div className={`${iconBg} p-3 rounded-full mr-4 neumorphic-concave`}>
      <Icon className="h-6 w-6 text-primary" />
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-dark-t2">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  </NeumorphicCard>
);

const GeneralMetricPill: React.FC<{
  icon: React.ComponentType<any>;
  label: string;
  valueOwner: number;
  valueTotal: number;
  accentClass: string;
  rightSlot?: React.ReactNode;
}> = ({ icon: Icon, label, valueOwner, valueTotal, accentClass, rightSlot }) => (
  <div className={`rounded-xl px-3 py-2 flex items-center gap-3 neumorphic-concave ${accentClass}`}>
    <div className="rounded-full p-2 bg-white/40 dark:bg-black/20 flex items-center justify-center">
      <Icon className="h-4 w-4" />
    </div>
    <div className="flex-1">
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        <span className="text-lg font-bold">
          {valueTotal > 0 ? `${valueOwner} de ${valueTotal}` : valueOwner}
        </span>
      </div>
    </div>
    {rightSlot && <div className="ml-2 flex-shrink-0">{rightSlot}</div>}
  </div>
);

const AgendaItem: React.FC<{
  icon: React.ComponentType<any>;
  subject: string;
  subjectClassName?: string;
  contact?: string;
  contactTooltip?: string;
  companyLine?: string;
  companyTooltip?: string;
  tag: string;
  tagColor: string;
  time?: string;
  overdue?: boolean;
}> = ({
  icon: Icon,
  subject,
  subjectClassName,
  contact,
  contactTooltip,
  companyLine,
  companyTooltip,
  tag,
  tagColor,
  time,
  overdue,
}) => (
  <div className={`flex items-start py-3 ${overdue ? "text-red-500" : ""}`}>
    <Icon className="h-5 w-5 mt-1 mr-4 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <div className="flex items-baseline justify-between gap-3 min-w-0">
        <p className={`font-semibold text-[12px] truncate min-w-0 ${subjectClassName ?? ""}`}>
          {subject}
        </p>

        {contact && contact.trim().length > 0 && (
          <div
            className="flex items-center gap-1 flex-shrink-0 text-[11px] text-gray-700 dark:text-dark-t1"
            title={contactTooltip || contact}
          >
            <User className="h-3.5 w-3.5 opacity-80" />
            <span className="max-w-[180px] truncate">{contact}</span>
          </div>
        )}
      </div>

      {companyLine && companyLine.trim().length > 0 && (
        <p
          className="text-[11px] text-gray-600 dark:text-dark-t1 mt-0.5 truncate"
          title={companyTooltip || companyLine}
        >
          {companyLine}
        </p>
      )}

      <div className="flex items-center text-xs mt-1">
        <span
          className="px-2 py-0.5 rounded-full text-white"
          style={{ backgroundColor: tagColor }}
        >
          {tag}
        </span>
        {time && <span className="ml-2 text-gray-500 dark:text-dark-t1 tabular-nums">{time}</span>}
      </div>
    </div>
  </div>
);

const AgendaSummaryCard: React.FC<{
  nextWeekCount: number;
  extraWeeks: Array<{ year: number; startDDMM: string; endDDMM: string; count: number }>;
  currentYear: number;
}> = ({ nextWeekCount, extraWeeks, currentYear }) => {
  let lastDividerYear: number | null = null;

  const IconLine = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-start gap-2">
      <CalendarCheck2 className="h-4 w-4 mt-[2px] opacity-90" />
      <div className="flex-1 leading-snug">{children}</div>
    </div>
  );

  return (
    <div
      className="mt-3 rounded-xl p-3 border border-border text-white"
      style={{ backgroundColor: "#2722B6" }}
    >
      {/* Próxima semana */}
      <div className="text-sm font-semibold tabular-nums">
        <IconLine>
          {nextWeekCount === 0 ? (
            <span>Nenhum compromisso na próxima semana</span>
          ) : (
            <span>{nextWeekCount} compromissos na próxima semana</span>
          )}
        </IconLine>
      </div>

      {/* Demais semanas */}
      <div className="mt-3">
        {/* ✅ menos competição visual */}
        <div className="text-[11px] opacity-75 font-semibold">Demais semanas</div>

        {extraWeeks.length === 0 ? (
          <div className="mt-2 text-xs opacity-95 tabular-nums">
            <IconLine>
              <span>Nenhum compromisso nas próximas semanas</span>
            </IconLine>
          </div>
        ) : (
          // ✅ mais respiro entre blocos
          <div className="mt-2 space-y-2">
            {extraWeeks.map((w) => {
              const needsYearDivider = w.year !== currentYear && w.year !== lastDividerYear;
              if (needsYearDivider) lastDividerYear = w.year;

              return (
                <div key={`${w.year}-${w.startDDMM}-${w.endDDMM}`} className="space-y-2">
                  {needsYearDivider && (
                    // ✅ divisor com mais “cara de divisor”
                    <div className="pt-3 border-t border-white/20">
                      <div className="text-[11px] font-semibold opacity-95">
                        <IconLine>
                          <span>Para o ano de {w.year}</span>
                        </IconLine>
                      </div>
                    </div>
                  )}

                  <div className="text-xs opacity-95 tabular-nums">
                    <IconLine>
                      <span>
                        {w.count} compromissos entre {w.startDDMM} ~ {w.endDDMM}
                      </span>
                    </IconLine>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ================================ Dashboard ================================ */

const Dashboard: React.FC = () => {
  const { currentProfileLite, user } = useAuth() as unknown as {
    currentProfileLite?: {
      displayName?: string | null;
      salutationPref?: SalutationPref | null;
      timezone?: string | null;
    };
    user?: { id?: string | null } | null;
  };

  const ownerAuthId = user?.id ?? null;

  const tz = useMemo(
    () => resolveTimeZone(currentProfileLite?.timezone),
    [currentProfileLite?.timezone]
  );
  const hour = useMemo(() => getLocalHour(tz), [tz]);
  const greeting = useMemo(() => getGreetingByHour(hour), [hour]);
  const gradient = useMemo(() => getCardGradient(hour), [hour]);

  const genderPrefix = useMemo(
    () => getGenderPrefix(currentProfileLite?.salutationPref ?? "neutro"),
    [currentProfileLite?.salutationPref]
  );

  const displayName = currentProfileLite?.displayName?.trim() || "";

  const {
    items: agendaItems,
    loading: agendaLoading,
    error: agendaError,
  } = useAgendaHoje(tz);

  const {
    metrics,
    loading: metricsLoading,
    error: metricsError,
    refetch: refetchQuadro1,
  } = useDashboardQuadro1(ownerAuthId || undefined);

  const {
    metrics: quadro3Metrics,
    loading: quadro3Loading,
    error: quadro3Error,
    refetch: refetchQuadro3,
  } = useDashboardQuadro3();

  useEffect(() => {
    const handler = () => {
      refetchQuadro1();
      refetchQuadro3();
    };

    window.addEventListener("chats:changed", handler as any);
    window.addEventListener("companies:changed", handler as any);

    return () => {
      window.removeEventListener("chats:changed", handler as any);
      window.removeEventListener("companies:changed", handler as any);
    };
  }, [refetchQuadro1, refetchQuadro3]);

  const todayItems = useMemo(
    () => agendaItems.filter((item) => item.isToday && !item.overdue),
    [agendaItems]
  );

  const tomorrowItems = useMemo(
    () => agendaItems.filter((item) => item.isTomorrow && !item.overdue),
    [agendaItems]
  );

  const overdueItems = useMemo(
    () => agendaItems.filter((item) => item.overdue),
    [agendaItems]
  );

  const noDateItems = useMemo(
    () => agendaItems.filter((item) => item.isNoDate && !item.overdue),
    [agendaItems]
  );

  const ownerTotalCompanies =
    metrics
      ? metrics.clientsOwner + metrics.leadsOwner + metrics.prospectsOwner
      : 0;

  const tenantTotalCompanies =
    metrics
      ? metrics.clientsTotal + metrics.leadsTotal + metrics.prospectsTotal
      : 0;

  const percentOwnerOnTenant =
    metrics && tenantTotalCompanies > 0
      ? Math.round((ownerTotalCompanies * 100) / tenantTotalCompanies)
      : 0;

  const buildActionsPieTooltip = (label: string, active: number, total: number) => {
    const done = Math.max(0, total - active);
    return `Ativas (verde): ${active} • Concluídas (cinza): ${done} • Total: ${total}`;
  };

  // ✅ Resumo: semana útil (seg–sex), sáb/dom agrupados na semana da sexta anterior.
  const todayYMD = useMemo(() => getDateYMD(tz, 0), [tz]);
  const currentYear = useMemo(() => Number(todayYMD.slice(0, 4)) || new Date().getFullYear(), [todayYMD]);

  const { startYMD: nextWeekStartYMD, endYMD: nextWeekEndYMD } = useMemo(
    () => getBusinessWeekRangeForNow(tz, 1),
    [tz]
  );

  const futureDatedItems = useMemo(() => {
    return agendaItems.filter((i) => !!i.calendarDate && !i.overdue && (i.calendarDate as string) >= todayYMD) as Array<
      AgendaTodayItem & { calendarDate: string }
    >;
  }, [agendaItems, todayYMD]);

  const nextWeekCount = useMemo(() => {
    return futureDatedItems.filter((i) => {
      const wr = getBusinessWeekRangeForYMD(tz, i.calendarDate);
      if (!wr) return false;
      return wr.startYMD === nextWeekStartYMD && wr.endYMD === nextWeekEndYMD;
    }).length;
  }, [futureDatedItems, tz, nextWeekStartYMD, nextWeekEndYMD]);

  const extraWeeks = useMemo(() => {
    const buckets = new Map<string, { startYMD: string; endYMD: string; count: number }>();

    for (const it of futureDatedItems) {
      const wr = getBusinessWeekRangeForYMD(tz, it.calendarDate);
      if (!wr) continue;

      if (wr.startYMD < nextWeekStartYMD) continue;

      const isNextWeek = wr.startYMD === nextWeekStartYMD && wr.endYMD === nextWeekEndYMD;
      if (isNextWeek) continue;

      const key = wr.startYMD;
      const prev = buckets.get(key);
      if (prev) prev.count += 1;
      else buckets.set(key, { startYMD: wr.startYMD, endYMD: wr.endYMD, count: 1 });
    }

    return Array.from(buckets.values())
      .sort((a, b) => a.startYMD.localeCompare(b.startYMD))
      .map((w) => ({
        year: Number(w.startYMD.slice(0, 4)) || currentYear,
        startDDMM: formatDDMM(w.startYMD),
        endDDMM: formatDDMM(w.endYMD),
        count: w.count,
      }));
  }, [futureDatedItems, tz, nextWeekStartYMD, nextWeekEndYMD, currentYear]);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-6 rounded-2xl text-white shadow-lg" style={{ background: gradient }}>
        <h2 className="text-2xl font-bold">
          {greeting}
          {displayName ? `, ${displayName}!` : "!"} 👋
        </h2>
        <p>{genderPrefix} de volta. Aqui está um resumo das suas atividades hoje.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Métricas Gerais */}
        <NeumorphicCard className="lg:col-span-1">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold">Métricas Gerais</h3>
              <p className="text-xs text-gray-500 dark:text-dark-t2 mt-1 flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>Sua carteira • Total de Empresas • Ações </span>
              </p>
            </div>
          </div>

          {metricsLoading && (
            <p className="text-sm text-gray-500 dark:text-dark-t2">
              Carregando métricas...
            </p>
          )}

          {!metricsLoading && metricsError && (
            <p className="text-sm text-red-500 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {metricsError}
            </p>
          )}

          {!metricsLoading && !metricsError && metrics && (
            <>
              <div className="grid grid-cols-1 gap-3">
                <GeneralMetricPill
                  icon={Users}
                  label="Clientes"
                  valueOwner={metrics.clientsOwner}
                  valueTotal={metrics.clientsTotal}
                  accentClass="bg-blue-50 dark:bg-blue-900/40"
                  rightSlot={
                    <MiniPie
                      active={metrics.clientsActiveActions}
                      completed={Math.max(
                        0,
                        metrics.clientsTotalActions - metrics.clientsActiveActions
                      )}
                      width={40}
                      height={40}
                      tooltip={buildActionsPieTooltip(
                        "Clientes",
                        metrics.clientsActiveActions,
                        metrics.clientsTotalActions
                      )}
                    />
                  }
                />
                <GeneralMetricPill
                  icon={TrendingUp}
                  label="Leads"
                  valueOwner={metrics.leadsOwner}
                  valueTotal={metrics.leadsTotal}
                  accentClass="bg-emerald-50 dark:bg-emerald-900/40"
                  rightSlot={
                    <MiniPie
                      active={metrics.leadsActiveActions}
                      completed={Math.max(
                        0,
                        metrics.leadsTotalActions - metrics.leadsActiveActions
                      )}
                      width={40}
                      height={40}
                      tooltip={buildActionsPieTooltip(
                        "Leads",
                        metrics.leadsActiveActions,
                        metrics.leadsTotalActions
                      )}
                    />
                  }
                />
                <GeneralMetricPill
                  icon={Briefcase}
                  label="Prospects"
                  valueOwner={metrics.prospectsOwner}
                  valueTotal={metrics.prospectsTotal}
                  accentClass="bg-purple-50 dark:bg-purple-900/40"
                  rightSlot={
                    <MiniPie
                      active={metrics.prospectsActiveActions}
                      completed={Math.max(
                        0,
                        metrics.prospectsTotalActions - metrics.prospectsActiveActions
                      )}
                      width={40}
                      height={40}
                      tooltip={buildActionsPieTooltip(
                        "Prospects",
                        metrics.prospectsActiveActions,
                        metrics.prospectsTotalActions
                      )}
                    />
                  }
                />
                <GeneralMetricPill
                  icon={UserCheck}
                  label="Ativos"
                  valueOwner={metrics.activeOwner}
                  valueTotal={metrics.activeTotal}
                  accentClass="bg-amber-50 dark:bg-amber-900/40"
                />
                <GeneralMetricPill
                  icon={UserX}
                  label="Inativos"
                  valueOwner={metrics.inactiveOwner}
                  valueTotal={metrics.inactiveTotal}
                  accentClass="bg-slate-50 dark:bg-slate-800/60"
                />
              </div>

              {tenantTotalCompanies > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-[11px] mb-1 text-gray-600 dark:text-dark-t2">
                    <span>
                      Sua carteira {ownerTotalCompanies} ({percentOwnerOnTenant}%)
                    </span>
                    <span>Empresas {tenantTotalCompanies}</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden flex">
                    <div
                      className="h-2 bg-amber-400"
                      style={{ width: `${Math.min(percentOwnerOnTenant, 100)}%` }}
                    />
                    <div className="flex-1 h-2 bg-black" />
                  </div>
                </div>
              )}

              {tenantTotalCompanies === 0 && (
                <p className="text-[11px] text-gray-500 dark:text-dark-t2 mt-3">
                  Nenhuma empresa encontrada para cálculo da carteira.
                </p>
              )}
            </>
          )}

          {!metricsLoading && !metricsError && !metrics && (
            <p className="text-sm text-gray-500 dark:text-dark-t2">
              Nenhuma empresa encontrada.
            </p>
          )}
        </NeumorphicCard>

        {/* Agenda */}
        <NeumorphicCard className="lg:col-span-1">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Agenda</h3>
          </div>

          {agendaLoading && (
            <p className="text-sm text-gray-500 dark:text-dark-t2">
              Carregando compromissos...
            </p>
          )}

          {!agendaLoading && agendaError && (
            <p className="text-sm text-red-500">{agendaError}</p>
          )}

          {!agendaLoading && !agendaError && agendaItems.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-dark-t2">
              Nenhum compromisso agendado.
            </p>
          )}

          {!agendaLoading && !agendaError && agendaItems.length > 0 && (
            <div className="space-y-3">
              {/* Hoje */}
              {todayItems.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-100 mb-1">
                    <CalendarDays className="h-4 w-4" />
                    <span>
                      Hoje ({todayItems.length}{" "}
                      {todayItems.length === 1 ? "compromisso" : "compromissos"})
                    </span>
                  </div>
                  <div>
                    {todayItems.map((item) => {
                      const Icon = resolveAgendaIcon(item.kind);
                      const company = buildCompanyDifferentiatorLine(item.companyName ?? null);
                      return (
                        <div
                          key={item.id}
                          className="rounded-lg p-2 -mx-2 my-1"
                          style={{ backgroundColor: "#FFBA66" }}
                        >
                          <AgendaItem
                            icon={Icon}
                            subject={buildLine1Subject(item.title)}
                            subjectClassName="text-slate-900"
                            contact={item.contactName ?? undefined}
                            contactTooltip={item.contactFull ?? undefined}
                            companyLine={company.text}
                            companyTooltip={company.title}
                            tag={item.tag}
                            tagColor={item.tagColor}
                            time={item.timeLabel}
                            overdue={false}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Amanhã */}
              {tomorrowItems.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-100 mb-1">
                    <ArrowRightCircle className="h-4 w-4" />
                    <span>
                      Amanhã ({tomorrowItems.length}{" "}
                      {tomorrowItems.length === 1 ? "compromisso" : "compromissos"})
                    </span>
                  </div>
                  <div>
                    {tomorrowItems.map((item) => {
                      const Icon = resolveAgendaIcon(item.kind);
                      const company = buildCompanyDifferentiatorLine(item.companyName ?? null);
                      return (
                        <div
                          key={item.id}
                          className="bg-emerald-50 dark:bg-emerald-900/25 rounded-lg p-2 -mx-2 my-1"
                        >
                          <AgendaItem
                            icon={Icon}
                            subject={buildLine1Subject(item.title)}
                            subjectClassName="text-emerald-950 dark:text-emerald-50"
                            contact={item.contactName ?? undefined}
                            contactTooltip={item.contactFull ?? undefined}
                            companyLine={company.text}
                            companyTooltip={company.title}
                            tag={item.tag}
                            tagColor={item.tagColor}
                            time={item.timeLabel}
                            overdue={false}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Atrasadas */}
              {overdueItems.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-200 mb-1">
                    <AlertCircle className="h-4 w-4" />
                    <span>
                      Atrasadas ({overdueItems.length}{" "}
                      {overdueItems.length === 1 ? "compromisso" : "compromissos"})
                    </span>
                  </div>
                  <div className="mt-1">
                    {overdueItems.map((item) => {
                      const Icon = resolveAgendaIcon(item.kind);
                      const company = buildCompanyDifferentiatorLine(item.companyName ?? null);
                      return (
                        <div
                          key={item.id}
                          className="bg-red-500/10 dark:bg-red-900/30 rounded-lg p-2 -mx-2 my-1"
                        >
                          <AgendaItem
                            icon={Icon}
                            subject={buildLine1Subject(item.title)}
                            subjectClassName="text-red-600 dark:text-red-200"
                            contact={item.contactName ?? undefined}
                            contactTooltip={item.contactFull ?? undefined}
                            companyLine={company.text}
                            companyTooltip={company.title}
                            tag={item.tag}
                            tagColor={item.tagColor}
                            time={item.timeLabel}
                            overdue={true}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sem data */}
              {noDateItems.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-100 mb-1">
                    <HelpCircle className="h-4 w-4" />
                    <span>
                      Sem data ({noDateItems.length}{" "}
                      {noDateItems.length === 1 ? "compromisso" : "compromissos"})
                    </span>
                  </div>
                  <div className="mt-1">
                    {noDateItems.map((item) => {
                      const Icon = resolveAgendaIcon(item.kind);
                      const company = buildCompanyDifferentiatorLine(item.companyName ?? null);
                      return (
                        <div
                          key={item.id}
                          className="bg-violet-50 dark:bg-violet-900/20 rounded-lg p-2 -mx-2 my-1"
                        >
                          <AgendaItem
                            icon={Icon}
                            subject={buildLine1Subject(item.title)}
                            subjectClassName="text-violet-950 dark:text-violet-50"
                            contact={item.contactName ?? undefined}
                            contactTooltip={item.contactFull ?? undefined}
                            companyLine={company.text}
                            companyTooltip={company.title}
                            tag={item.tag}
                            tagColor={item.tagColor}
                            time={item.timeLabel}
                            overdue={false}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <AgendaSummaryCard
                nextWeekCount={nextWeekCount}
                extraWeeks={extraWeeks}
                currentYear={currentYear}
              />
            </div>
          )}
        </NeumorphicCard>

        {/* Quadro 3 – Temperaturas */}
        <NeumorphicCard className="lg:col-span-1">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold">Temperaturas ⬅️30•Hoje•45➡️</h3>
              <p className="text-xs text-gray-500 dark:text-dark-t2 mt-1 flex items-center gap-1">
                <BarChart2 className="h-3 w-3" />
                <span>Ações, empresas e tempo sob a lente da temperatura</span>
              </p>
            </div>
          </div>

          {quadro3Loading && (
            <p className="text-sm text-gray-500 dark:text-dark-t2">
              Carregando métricas de temperatura...
            </p>
          )}

          {!quadro3Loading && quadro3Error && (
            <p className="text-sm text-red-500 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {quadro3Error}
            </p>
          )}

          {!quadro3Loading && !quadro3Error && quadro3Metrics && (
            <div className="space-y-3">
              <div>
                <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-100 mb-1">
                  Distribuição de ações por temperatura
                </div>
                <div className="space-y-2">
                  {quadro3Metrics.actionsByTemperature.map((item) => {
                    const Icon = getTemperatureIcon(item.key);
                    const barClass = getTemperatureBarClass(item.key);
                    const tooltip = getTemperatureTooltipForActions(item.key);
                    const pct = Math.min(Math.max(item.actionsPct, 0), 100);

                    return (
                      <div key={item.key} className="flex items-center gap-3">
                        <div
                          className="flex items-center justify-center rounded-full p-1.5 bg-white/70 dark:bg-black/40 shadow-sm"
                          title={tooltip}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="w-full bg-dark-shadow dark:bg-dark-dark-shadow rounded-full h-2 overflow-hidden">
                            <div
                              className={`${barClass} h-2 rounded-full`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-end min-w-[52px]">
                          <span className="text-xs font-semibold tabular-nums">
                            {item.actionsTotal}
                          </span>
                          <span className="text-[10px] text-gray-500 dark:text-dark-t2 tabular-nums">
                            {Math.round(item.actionsPct)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-100 mb-2">
                  Empresas por temperatura predominante
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  {quadro3Metrics.companiesByTemperature.map((item) => {
                    const Icon = getTemperatureIcon(item.key);
                    const companyNames = item.topCompanies ?? [];
                    const tooltip =
                      companyNames.length > 0
                        ? `Top empresas: ${companyNames.join(", ")}`
                        : getTemperatureTooltipForCompanies(item.key);

                    return (
                      <div
                        key={item.key}
                        className="flex items-center gap-1"
                        title={tooltip}
                      >
                        <div className="flex items-center justify-center rounded-full p-1 bg-white/70 dark:bg-black/40 shadow-sm">
                          <Icon className="h-3 w-3" />
                        </div>
                        <span className="font-semibold tabular-nums">
                          {item.companiesCount}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify_between mb-1">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-100">
                    Linha temporal por temperatura
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-dark-t2">
                    ← passadas | hoje | futuras →
                  </span>
                </div>
                <div className="space-y-1">
                  {quadro3Metrics.timelineByTemperature.map((item) => {
                    const Icon = getTemperatureIcon(item.key);
                    const tooltip = getTemperatureTooltipForTimeline(item.key);
                    return (
                      <div
                        key={item.key}
                        className="flex items-center gap-2 text-[11px]"
                        title={tooltip}
                      >
                        <div className="flex items-center justify-center rounded-full p-1 bg-white/70 dark:bg-black/40 shadow-sm">
                          <Icon className="h-3 w-3" />
                        </div>
                        <div className="flex-1 flex items-center justify-between">
                          <span className="tabular-nums">← {item.pastCount}</span>
                          <span className="tabular-nums">{item.todayCount}</span>
                          <span className="tabular-nums">{item.futureCount} →</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {!quadro3Loading && !quadro3Error && !quadro3Metrics && (
            <p className="text-sm text-gray-500 dark:text-dark-t2">
              Nenhuma métrica de temperatura encontrada.
            </p>
          )}
        </NeumorphicCard>
      </div>

    </div>
  );
};

export default Dashboard;

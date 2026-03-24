/*
-- ===================================================
-- Código             : /src/components/cockpit/ConversationHistoryCard.tsx
-- Versão (.v20)      : 4.25.0
-- Data/Hora          : 2025-12-07 11:30 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do código : Exibir histórico de ações (Cockpit / Visão 360) com agrupamento multiestado
--                      e ordenação corrigida para diferentes tipos de dados.
-- Fluxo              : CockpitPage → ConversationHistoryCard
-- Alterações (4.25.0) :
--   • [FIX] Correção da lógica de ordenação (sort) para tratar corretamente datas, strings e categorias.
--   • [UI] Ícones de ordenação (ArrowUp/ArrowDown) dinâmicos conforme estado.
-- Dependências       : react, lucide-react, clsx, @/lib/events, @/components/ui/{Button,Skeleton,Modal},
--                      @/components/shared/GroupingModeButton,
--                      @/services/{chatsService,cockpitService}, @/types/{chat,cockpit}, @/lib/supabaseClient
-- ===================================================
*/

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pencil,
  Snowflake,
  Thermometer,
  Flame,
  HelpCircle,
  MinusCircle,
  Eraser,
} from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import clsx from "clsx";
import { Modal } from "@/components/ui/Modal";
import EditActionForm from "./EditActionForm";
import { getChatById } from "@/services/chatsService";
import { getCompanyDetails } from "@/services/cockpitService";
import type { Chat } from "@/types/chat";
import type { CompanyDetails } from "@/types/cockpit";
import { onChatChanged } from "@/lib/events";
import GroupingModeButton, {
  GroupMode,
} from "@/components/shared/GroupingModeButton";

/* ========================================================= */

type Props = { companyId: string | null; showEdit?: boolean };

type ChatRow = {
  id: string;
  kind: "conversation" | "followup" | "task" | "call" | "message";
  channel_type: string | null;
  company_name: string | null;
  contact_name: string | null;
  subject: string | null;
  body: string | null;
  priority: string | null;
  temperature: string | null;
  calendar_at: string | null;
  on_time: string | null;
  created_at: string;
  updated_at: string;
  is_done: boolean;
  direction?: "inbound" | "outbound" | "internal" | "inout" | null;
  budgets?: BudgetItem[];
};

type BudgetItem = {
  id?: string;
  description?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  pipeline_stage?: string | null;
  company_id?: string | null;
  primary_contact_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type OrderBy =
  | "channel_type"
  | "company_name"
  | "subject"
  | "calendar_at"
  | "updated_at";

type GroupedByDate = { day: string; rows: ChatRow[] };
type GroupedByCompany = { company: string; rows: ChatRow[] };

/* ========================================================= */

const kindLabel = (k: ChatRow["kind"]) =>
  k === "conversation"
    ? "Conversa"
    : k === "followup"
    ? "Follow-up"
    : k === "task"
    ? "Tarefa"
    : String(k);

function titleCase(s: string) {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
  const time = d.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date}, ${time}`;
}
function formatDateOnly(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  const [y, m, d] = String(dateStr).split("-");
  if (!y || !m || !d) return String(dateStr);
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}
function formatTimeHHMM(timeStr: string | null | undefined) {
  if (!timeStr) return "";
  return String(timeStr).slice(0, 5);
}
function formatMoneyBR(value?: number | null, currency?: string | null) {
  if (value == null) return "—";
  const curr = currency || "BRL";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: curr,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${Number(value).toFixed(2)} ${curr}`;
  }
}

/* ===== helpers de data para visões ===== */

function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type TabKind = "day" | "history" | "both";

/* ========================================================= */

const StatusDot = ({ done }: { done: boolean }) => (
  <span
    className={clsx(
      "inline-block w-2.5 h-2.5 rounded-full",
      done ? "bg-green-500" : "bg-red-500"
    )}
    title={done ? "Concluída" : "Andamento"}
  />
);

/* ========================================================= */
/* Ícones de Temperatura — com tooltip visual                 */
/* ========================================================= */
function TempIcon({ temp }: { temp?: string | null }) {
  const v = (temp || "").toLowerCase().trim();
  const base = "w-4 h-4";

  const Tooltip = ({
    text,
    children,
  }: {
    text: string;
    children: React.ReactNode;
  }) => (
    <div className="relative group inline-flex">
      {children}
      <span
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap 
                   rounded-md bg-gray-800 text-white dark:bg-dark-s3 dark:text-dark-t1 
                   text-[10px] py-1 px-2 opacity-0 group-hover:opacity-100 
                   pointer-events-none transition-opacity duration-200 shadow-lg z-10"
      >
        {text}
      </span>
    </div>
  );

  if (!v || v === "neutra" || v.includes("neut")) {
    return (
      <Tooltip text="Temperatura: neutra">
        <MinusCircle className={clsx(base, "text-gray-400")} />
      </Tooltip>
    );
  }
  if (v === "quente" || v.includes("alta")) {
    return (
      <Tooltip text="Temperatura: quente">
        <Flame className={clsx(base, "text-red-500")} />
      </Tooltip>
    );
  }
  if (
    v === "morna" ||
    v === "morno" ||
    v.includes("morn") ||
    v.includes("média") ||
    v.includes("media") ||
    v.includes("medio")
  ) {
    return (
      <Tooltip text="Temperatura: morna">
        <Thermometer className={clsx(base, "text-amber-500")} />
      </Tooltip>
    );
  }
  if (v === "fria" || v === "frio" || v.includes("baixa")) {
    return (
      <Tooltip text="Temperatura: fria">
        <Snowflake className={clsx(base, "text-blue-500")} />
      </Tooltip>
    );
  }
  return (
    <Tooltip text={`Temperatura: ${temp || "desconhecida"}`}>
      <HelpCircle className={clsx(base, "text-gray-400")} />
    </Tooltip>
  );
}

/* ====================== Badge “Tipo” ====================== */

type TypeBadgeData = { label: string; className: string; title?: string };

function resolveTypeBadge(
  r: Pick<ChatRow, "kind" | "direction" | "channel_type">
): TypeBadgeData {
  const kind = String(r.kind || "").toLowerCase();
  const direction = (r.direction ?? "inout") as
    | "inbound"
    | "outbound"
    | "internal"
    | "inout";
  const ch = String(r.channel_type || "").toLowerCase();

  if (kind === "call") {
    if (direction === "outbound" && ch === "phone")
      return {
        label: "Ligação (E)",
        className: "bg-[#6D28D9] text-white",
      };
    if (direction === "inbound" && ch === "phone")
      return {
        label: "Ligação (R)",
        className: "bg-[#4C1D95] text-white",
      };
    return { label: "Ligação", className: "bg-[#4C1D95] text-white" };
  }

  if (kind === "message") {
    if (ch === "whatsapp") {
      if (direction === "outbound")
        return {
          label: "Whats (E)",
          className: "bg-[#047857] text-white",
        };
      if (direction === "inbound")
        return {
          label: "Whats (R)",
          className: "bg-[#065F46] text-white",
        };
    }
    if (ch === "email") {
      if (direction === "outbound")
        return {
          label: "E-mail (E)",
          className: "bg-[#1D4ED8] text-white",
        };
      if (direction === "inbound")
        return {
          label: "E-mail (R)",
          className: "bg-[#22429E] text-white",
        };
    }
    return { label: "Mensagem", className: "bg-[#34B4BA] text-white" };
  }

  if (kind === "task") {
    if (ch === "orcamento")
      return { label: "Orçamento", className: "bg-[#BE123C] text-white" };
    if (ch === "followup")
      return { label: "Follow-up", className: "bg-[#DA8200] text-white" };
    if (ch === "visita")
      return { label: "Visita", className: "bg-[#F600B6] text-white" };
    if (ch === "informacao")
      return { label: "Informação", className: "bg-[#DA8200] text-white" };
    if (ch === "interna")
      return { label: "Interna", className: "bg-[#DA8200] text-white" };
    if (ch === "almoco")
      return { label: "Almoço", className: "bg-[#F600B6] text-white" };
    if (ch === "reuniao")
      return { label: "Reunião", className: "bg-[#F600B6] text-white" };
    return { label: "Tarefa", className: "bg-[#996633] text-white" };
  }

  const label = titleCase(ch || kind || "Tipo");
  return { label, className: "bg-gray-300 text-gray-900" };
}

const TYPE_LABEL_CANDIDATES = [
  "Ligação",
  "Ligação (E)",
  "Ligação (R)",
  "Mensagem",
  "Whats (E)",
  "Whats (R)",
  "E-mail (E)",
  "E-mail (R)",
  "Tarefa",
  "Orçamento",
  "Follow-up",
  "Visita",
  "Informação",
  "Interna",
  "Almoço",
  "Reunião",
];
const MAX_LABEL_CH = TYPE_LABEL_CANDIDATES.reduce(
  (m, s) => Math.max(m, s.length),
  0
);
const BADGE_MIN_CH = MAX_LABEL_CH + 2;

const TypeBadge = ({
  row,
}: {
  row: Pick<ChatRow, "kind" | "direction" | "channel_type">;
}) => {
  const t = resolveTypeBadge(row);
  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center text-center",
        "px-2 py-0.5 rounded-full text-[11px] font-medium",
        t.className
      )}
      style={{ minWidth: `${BADGE_MIN_CH}ch` }}
      title={t.title || t.label}
    >
      {t.label}
    </span>
  );
};

/* ========================================================= */
/* Helper: budgets visíveis (deleção fria de "terminado")    */
/* ========================================================= */

function getVisibleBudgets(list?: BudgetItem[] | null): BudgetItem[] {
  if (!Array.isArray(list)) return [];
  return list.filter(
    (b) => (b.status || "").toLowerCase() !== "terminado"
  );
}

/* ========================================================= */
/* Helpers de agrupamento                                    */
/* ========================================================= */

function groupRowsByDate(rows: ChatRow[]): GroupedByDate[] {
  if (!rows.length) return [];
  const map = new Map<string, ChatRow[]>();

  for (const row of rows) {
    const key = row.calendar_at || "—";
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }

  const days = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
  return days.map((day) => ({ day, rows: map.get(day) ?? [] }));
}

function groupRowsByCompany(rows: ChatRow[]): GroupedByCompany[] {
  if (!rows.length) return [];
  const map = new Map<string, ChatRow[]>();

  for (const row of rows) {
    const key = row.company_name || "—";
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }

  const companies = Array.from(map.keys()).sort((a, b) =>
    a.localeCompare(b)
  );
  return companies.map((company) => ({
    company,
    rows: map.get(company) ?? [],
  }));
}

/* ========================================================= */
/* Componente principal                                      */
/* ========================================================= */

const ConversationHistoryCard: React.FC<Props> = ({
  companyId,
  showEdit = true,
}) => {
  const { addToast } = useToast();

  const [baseRows, setBaseRows] = useState<ChatRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"false" | "true" | "all">(
    "all"
  );
  const [orderBy, setOrderBy] = useState<OrderBy>("updated_at");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"detailed" | "compact">("detailed");

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedChatForEdit, setSelectedChatForEdit] = useState<Chat | null>(
    null
  );
  const [companyDetailsForEdit, setCompanyDetailsForEdit] =
    useState<CompanyDetails | null>(null);

  const [highlightId, setHighlightId] = useState<string | null>(null);
  const lastEditedIdRef = useRef<string | null>(null);

  const [tab, setTab] = useState<TabKind>("day");
  const [groupMode, setGroupMode] = useState<GroupMode>("none");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const todayISO = useMemo(() => getTodayISO(), []);

  const triggerHighlight = useCallback((id: string | null) => {
    if (!id) return;
    setHighlightId(id);
    window.setTimeout(() => setHighlightId(null), 1500);
  }, []);

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("chats")
        .select(`
          id, kind, direction, channel_type, subject, temperature,
          calendar_at, on_time, created_at, updated_at, is_done,
          body, priority, budgets,
          company:companies(trade_name),
          contact:contacts(full_name)
        `)
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map(
        (d: any) =>
          ({
            id: d.id,
            kind: (d.kind ?? "task") as ChatRow["kind"],
            direction: (d.direction ?? "inout") as any,
            channel_type: d.channel_type ?? null,
            company_name: d.company?.trade_name ?? "—",
            contact_name: d.contact?.full_name ?? "—",
            subject: d.subject ?? "—",
            body: d.body ?? null,
            priority: d.priority ?? null,
            temperature: d.temperature ?? null,
            calendar_at: d.calendar_at,
            on_time: d.on_time,
            created_at: d.created_at,
            updated_at: d.updated_at,
            is_done: d.is_done,
            budgets: Array.isArray(d.budgets)
              ? (d.budgets as BudgetItem[])
              : [],
          }) as ChatRow
      );

      setBaseRows(mapped);
      setSelectedId((prev) =>
        prev && mapped.some((m) => m.id === prev) ? prev : null
      );
    } catch (e: any) {
      addToast(e?.message || "Falha ao carregar histórico.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [companyId, addToast]);

  useEffect(() => {
    fetchData();
    const h1 = () => fetchData();
    const h2 = () => {
      // 4.22.0: qualquer mudança em chats dispara refresh do histórico desta empresa
      fetchData();
    };
    window.addEventListener("cockpit:refreshHistory", h1);
    window.addEventListener("chats:changed", h1 as any);
    const off = onChatChanged(h2);
    return () => {
      window.removeEventListener("cockpit:refreshHistory", h1);
      window.removeEventListener("chats:changed", h1 as any);
      off();
    };
  }, [fetchData, companyId]);

  const rows = useMemo(() => {
    let r = baseRows.slice();

    // filtro de status
    if (statusFilter !== "all") {
      const wantDone = statusFilter === "true";
      r = r.filter((x) => x.is_done === wantDone);
    }

    // filtro por aba (Do Dia | Histórico | Ambos)
    if (tab === "day") {
      r = r.filter((row) => row.calendar_at === todayISO);
    } else if (tab === "history") {
      r = r.filter(
        (row) => row.calendar_at && row.calendar_at !== todayISO
      );
    }
    // "both" = tudo, sem filtro adicional

    // busca em assunto/corpo
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      r = r.filter(
        (row) =>
          (row.subject || "").toLowerCase().includes(q) ||
          (row.body || "").toLowerCase().includes(q)
      );
    }

    // ordenação robusta
    r.sort((a, b) => {
      const dir = orderDir === "asc" ? 1 : -1;

      if (orderBy === "updated_at") {
        const tA = new Date(a.updated_at).getTime();
        const tB = new Date(b.updated_at).getTime();
        return (tA - tB) * dir;
      }

      if (orderBy === "calendar_at") {
        // Se não tem data, joga para o final (ou início, dependendo da lógica)
        // Aqui: nulls sempre no final visualmente
        const hasA = !!a.calendar_at;
        const hasB = !!b.calendar_at;
        if (!hasA && !hasB) return 0;
        if (!hasA) return 1; // a is null -> a goes last
        if (!hasB) return -1; // b is null -> b goes last

        // Ambos têm data -> compara data + hora
        const tA = new Date(`${a.calendar_at}T${a.on_time || "00:00"}`).getTime();
        const tB = new Date(`${b.calendar_at}T${b.on_time || "00:00"}`).getTime();
        return (tA - tB) * dir;
      }

      if (orderBy === "channel_type") {
        // Ordena por categoria/tipo
        const valA = (a.channel_type || a.kind || "").toLowerCase();
        const valB = (b.channel_type || b.kind || "").toLowerCase();
        return valA.localeCompare(valB) * dir;
      }

      // Strings gerais (subject, company_name)
      const valA = (a[orderBy] || "").toString().toLowerCase();
      const valB = (b[orderBy] || "").toString().toLowerCase();
      return valA.localeCompare(valB) * dir;
    });

    return r;
  }, [
    baseRows,
    statusFilter,
    tab,
    todayISO,
    searchTerm,
    orderBy,
    orderDir,
  ]);

  const handleEdit = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const [chat, companyDetails] = await Promise.all([
        getChatById(id),
        getCompanyDetails(companyId!),
      ]);
      setSelectedChatForEdit(chat);
      setCompanyDetailsForEdit(companyDetails);
      setIsEditModalOpen(true);
    } catch (err: any) {
      addToast(err?.message || "Falha ao abrir edição.", "error");
    }
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setSelectedChatForEdit(null);
    setCompanyDetailsForEdit(null);
  };

  const handleSaved = () => {
    handleCloseModal();
    fetchData().then(() => {
      if (lastEditedIdRef.current) triggerHighlight(lastEditedIdRef.current);
    });
  };

  const COLSPAN = showEdit ? 6 : 5;

  const applySearchFromInput = () => {
    setSearchTerm(searchInput.trim());
  };

  const handleClearFilters = () => {
    setStatusFilter("all");
    setOrderBy("updated_at");
    setOrderDir("desc");
    setSelectedId(null);
    setViewMode("detailed");
    setTab("day");
    setGroupMode("none");
    setSearchInput("");
    setSearchTerm("");
  };

  // helper local para renderizar uma linha + detalhes (independente do agrupamento)
  const renderRowBlock = (r: ChatRow) => {
    const isSelected = selectedId === r.id;
    const showDetails = viewMode === "detailed" || isSelected;

    return (
      <React.Fragment key={r.id}>
        <tr
          onClick={() =>
            setSelectedId((prev) => (prev === r.id ? null : r.id))
          }
          className={clsx(
            "border-b border-sepia-border dark:border-white/10 transition-colors cursor-pointer",
            isSelected
              ? "bg-blue-50 dark:bg-blue-950/30"
              : "hover:bg-[rgba(59,42,20,0.03)]",
            r.id === highlightId &&
              "animate-pulse bg-green-100/70 dark:bg-green-900/30 ring-2 ring-green-400/70"
          )}
        >
          <td className="py-2 px-2">{formatDateTime(r.updated_at)}</td>

          <td className="py-2 px-2">
            {r.calendar_at
              ? `${formatDateOnly(r.calendar_at)}${
                  r.on_time ? " às " + formatTimeHHMM(r.on_time) : ""
                }`
              : "—"}
          </td>

          <td className="py-2 px-2">
            <TypeBadge row={r} />
          </td>

          <td className="py-2 px-2">
            <div className="flex items-center gap-2 min-h-[20px]">
              <StatusDot done={r.is_done} />
              <TempIcon temp={r.temperature} />
              <span className="flex-1 line-clamp-2 break-words">
                {r.subject}
              </span>
              {r.is_done && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-semibold
                             bg-green-500 text-white shadow-sm whitespace-nowrap"
                >
                  Concluída
                </span>
              )}
            </div>
          </td>

          <td className="py-2 px-2 text-xs">{r.company_name}</td>

          {showEdit && (
            <td className="py-2 px-2">
              <Button
                type="button"
                variant="default"
                className="!px-2 !py-1.5 text-xs flex items-center gap-1"
                onClick={(e) => handleEdit(e, r.id)}
                aria-label={`Editar ${kindLabel(r.kind).toLowerCase()}`}
                title={`Editar ${kindLabel(r.kind)}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </td>
          )}
        </tr>

        {showDetails && (
          <tr className="bg-light-s2 dark:bg-dark-s2">
            <td colSpan={COLSPAN} className="p-4">
              <div className="p-4 bg-white dark:bg-dark-s2 border border-light-bmd dark:border-dark-bmd rounded-[8px]">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="md:col-span-2">
                    <strong className="block text-[#3b2e1a] dark:text-dark-t1 mb-1">
                      Descrição:
                    </strong>
                    <p className="text-[#3b2e1a] dark:text-dark-t1 whitespace-pre-wrap">
                      {r.body || "Nenhuma descrição fornecida."}
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <strong className="block text-[#3b2e1a] dark:text-dark-t1">
                        Contato:
                      </strong>
                      <p className="text-[#3b2e1a] dark:text-dark-t1">
                        {r.contact_name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <strong className="block text-[#3b2e1a] dark:text-dark-t1">
                        Prioridade:
                      </strong>
                      <p className="text-[#3b2e1a] dark:text-dark-t1">
                        {r.priority || "Não definida"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {(() => {
                const visibleBudgets = getVisibleBudgets(r.budgets);
                if (!visibleBudgets.length) return null;

                return (
                  <div className="mt-4 p-4 bg-white dark:bg-dark-s2 border border-light-bmd dark:border-dark-bmd rounded-[8px]">
                    <div className="mb-3 font-semibold text-[#3b2e1a] dark:text-dark-t1">
                      Orçamentos ({visibleBudgets.length})
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {visibleBudgets.map((b, idx) => (
                        <div
                          key={b.id ?? idx}
                          className="rounded-lg border border-[rgba(59,42,20,0.10)] dark:border-white/10 bg-[#fffdf9] dark:bg-dark-s3 px-3 h-10 flex items-center gap-4 overflow-hidden"
                          title={[
                            b.description || "Orçamento sem descrição",
                            b.amount != null
                              ? ` • ${formatMoneyBR(
                                  b.amount,
                                  b.currency || "BRL"
                                )}`
                              : "",
                            b.status ? ` • ${b.status}` : "",
                            b.pipeline_stage ? ` • ${b.pipeline_stage}` : "",
                            (b.updated_at || b.created_at) &&
                              ` • ${formatDateTime(
                                b.updated_at || b.created_at
                              )}`,
                          ].join("")}
                        >
                          <span className="text-sm font-medium flex-1 min-w-0 truncate">
                            {b.description || "Orçamento sem descrição"}
                          </span>
                          <span className="text-[12px] whitespace-nowrap">
                            {formatMoneyBR(
                              b.amount ?? null,
                              b.currency ?? "BRL"
                            )}
                          </span>
                          <span className="flex items-center gap-2 whitespace-nowrap">
                            <span
                              className={clsx(
                                "text-[11px] px-2 py-0.5 rounded-full font-medium",
                                (b.status || "")
                                  .toLowerCase()
                                  .includes("ganh")
                                  ? "bg-green-100 text-green-700"
                                  : (b.status || "")
                                      .toLowerCase()
                                      .includes("perd")
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                              )}
                              title={`Status: ${b.status || "—"}`}
                            >
                              {b.status || "—"}
                            </span>
                            <TempIcon temp={r.temperature} />
                          </span>
                          <span className="text-[12px] text-[#3b2e1a] dark:text-dark-t1 whitespace-nowrap">
                            {b.pipeline_stage || "—"}
                          </span>
                          <span className="text-[12px] text-[#9a7d5a] dark:text-dark-t2 whitespace-nowrap">
                            {formatDateTime(
                              b.updated_at || b.created_at || null
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <section className="p-4 bg-light-bg dark:bg-dark-s1 border border-light-bmd dark:border-dark-bmd rounded-xl">
      {/* Estilo scoped: opções do select nativo não aceitam classes Tailwind */}
      <style>{`
        .dark .chc-status-filter option {
          background-color: #1a1d24;
          color: #9096a3;
        }
        .dark .chc-status-filter option:checked {
          background-color: rgba(59,104,245,0.12);
          color: #3b68f5;
        }
        .dark .chc-status-filter option:hover {
          background-color: #22262f;
          color: #f0eeec;
        }
      `}</style>
      {/* [--BLOCO--] Cabeçalho unificado e responsivo */}
      {/* 1) Título isolado em linha própria (w-full) */}
      <div className="mb-4 w-full">
        <h3 className="text-lg font-semibold text-[#3b2e1a] dark:text-dark-t1">
          Histórico das Ações
        </h3>
      </div>

      {/* 2) Filtros reorganizados (flex-wrap, justify-between, w-full) */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 w-full">
        {/* 1. Abas (Do Dia | Histórico | Ambos) */}
        <div className="inline-flex gap-1 w-full sm:w-auto">
          {[
            { key: "day" as TabKind, label: "Do Dia" },
            { key: "history" as TabKind, label: "Histórico" },
            { key: "both" as TabKind, label: "Ambos" },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={clsx(
                "flex-1 px-3 py-1.5 text-sm font-medium transition-colors text-center cursor-pointer rounded-[8px]",
                tab === t.key
                  ? "bg-[#3b68f5] text-white border-none"
                  : "bg-transparent border border-light-bmd text-[#9a7d5a]"
              )}
              aria-pressed={tab === t.key}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 2. Agrupamento multiestado */}
        <div className="w-[170px] flex-shrink-0">
          <GroupingModeButton mode={groupMode} onModeChange={setGroupMode} />
        </div>

        {/* 3. Detalhada/Compacta */}
        <div className="inline-flex gap-1 select-none">
          <button
            type="button"
            title="Detalhada"
            className={clsx(
              "px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer rounded-[8px]",
              viewMode === "detailed"
                ? "bg-[#3b68f5] text-white border-none"
                : "bg-transparent border border-light-bmd text-[#9a7d5a]"
            )}
            onClick={() => setViewMode("detailed")}
            aria-pressed={viewMode === "detailed"}
          >
            Detalhada
          </button>
          <button
            type="button"
            title="Compacta"
            className={clsx(
              "px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer rounded-[8px]",
              viewMode === "compact"
                ? "bg-[#3b68f5] text-white border-none"
                : "bg-transparent border border-light-bmd text-[#9a7d5a]"
            )}
            onClick={() => setViewMode("compact")}
            aria-pressed={viewMode === "compact"}
          >
            Compacta
          </button>
        </div>

        {/* 3) Ordem DOM: Botão Limpar antes da Busca */}
        
        {/* Botão: limpar filtros */}
        <Button
          type="button"
          variant="default"
          onClick={handleClearFilters}
          title="Limpar filtros"
          aria-label="Limpar filtros"
          className={clsx(
            "!px-0 !py-0",
            "h-9 w-9 flex items-center justify-center",
            "rounded-full border border-dark-shadow/60 dark:border-dark-dark-shadow/60",
            "bg-white dark:bg-dark-s1 shadow-sm",
            "hover:bg-light-s1 dark:hover:bg-dark-s2 transition-colors"
          )}
        >
          <Eraser className="h-4 w-4 text-[#9a7d5a] dark:text-dark-t1" />
        </Button>

        {/* 4. Busca */}
        <div className="flex-1 min-w-[150px]">
          <input
            className="h-9 px-3 w-full text-sm outline-none"
            placeholder="Buscar (assunto/corpo)…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applySearchFromInput();
            }}
          />
        </div>

        {/* 5. Status */}
        <select
          className="chc-status-filter text-sm font-medium cursor-pointer outline-none appearance-none bg-[#3b68f5] text-white rounded-[8px] border-none py-[7px] px-[15px]"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "false" | "true" | "all")
          }
          aria-label="Filtrar por status"
          title="Filtrar por status"
        >
          <option value="all">Todas</option>
          <option value="false">Andamento</option>
          <option value="true">Concluída</option>
        </select>
      </div>

      {isLoading ? (
        <Skeleton className="w-full h-24" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-dark-shadow/40 dark:border-dark-dark-shadow/40 bg-white dark:bg-dark-s1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left bg-light-s1 dark:bg-dark-s2">
                {[
                  { key: "updated_at", label: "Atualizado" },
                  { key: "calendar_at", label: "Agendamento" },
                  { key: "channel_type", label: "Tipo" },
                  { key: "subject", label: "Assunto" },
                  { key: "company_name", label: "Empresa" },
                  ...(showEdit
                    ? ([{ key: "actions", label: "Ações" }] as const)
                    : []),
                ].map((col) => (
                  <th
                    key={col.key}
                    className={`py-2 px-2 dark:text-dark-t2 ${
                      col.key !== "actions"
                        ? "cursor-pointer select-none hover:text-blue-600 dark:hover:text-accent"
                        : ""
                    }`}
                    onClick={
                      col.key !== "actions"
                        ? () => {
                            const c = col.key as OrderBy;
                            if (c === orderBy) {
                              setOrderDir((prev) =>
                                prev === "asc" ? "desc" : "asc"
                              );
                            } else {
                              setOrderBy(c);
                              setOrderDir(
                                // Default sort direction for new column
                                c === "updated_at" || c === "calendar_at" ? "desc" : "asc"
                              );
                            }
                          }
                        : undefined
                    }
                    aria-sort={
                      col.key !== "actions" && orderBy === col.key
                        ? orderDir === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {col.key !== "actions" && (
                        <span className="inline-block">
                          {orderBy === col.key ? (
                            orderDir === "asc" ? (
                              <ArrowUp className="h-4 w-4 text-blue-600" />
                            ) : (
                              <ArrowDown className="h-4 w-4 text-blue-600" />
                            )
                          ) : (
                            <ArrowUpDown className="h-4 w-4 opacity-30" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLSPAN}
                    className="px-3 py-4 text-center text-sm text-[#9a7d5a] dark:text-dark-t2"
                  >
                    Nenhuma ação encontrada.
                  </td>
                </tr>
              ) : groupMode === "none" ? (
                rows.map(renderRowBlock)
              ) : groupMode === "date" ? (
                groupRowsByDate(rows).map((g) => (
                  <React.Fragment key={`day-${g.day}`}>
                    <tr className="bg-[#3b68f5]">
                      <td
                        colSpan={COLSPAN}
                        className="px-3 py-1"
                        style={{ fontSize: '13px', fontWeight: 500, color: '#ffffff' }}
                      >
                        📅 {g.day === "—" ? "Sem data" : formatDateOnly(g.day)}
                      </td>
                    </tr>
                    {g.rows.map(renderRowBlock)}
                  </React.Fragment>
                ))
              ) : groupMode === "company" ? (
                groupRowsByCompany(rows).map((c) => (
                  <React.Fragment key={`company-${c.company}`}>
                    <tr className="bg-[#3b68f5]">
                      <td
                        colSpan={COLSPAN}
                        className="px-3 py-1"
                        style={{ fontSize: '13px', fontWeight: 500, color: '#ffffff' }}
                      >
                        🏢 {c.company || "Sem empresa"}
                      </td>
                    </tr>
                    {c.rows.map(renderRowBlock)}
                  </React.Fragment>
                ))
              ) : groupMode === "company_date" ? (
                groupRowsByCompany(rows).map((c) => (
                  <React.Fragment key={`company-${c.company}`}>
                    {/* 1º nível: Empresa */}
                    <tr className="bg-[#3b68f5]">
                      <td
                        colSpan={COLSPAN}
                        className="px-3 py-1"
                        style={{ fontSize: '13px', fontWeight: 500, color: '#ffffff' }}
                      >
                        🏢 {c.company || "Sem empresa"}
                      </td>
                    </tr>
                    {/* 2º nível: Data */}
                    {groupRowsByDate(c.rows).map((g) => (
                      <React.Fragment
                        key={`company-${c.company}-day-${g.day}`}
                      >
                        <tr className="bg-[#3b68f5]">
                          <td
                            colSpan={COLSPAN}
                            className="px-6 py-1"
                            style={{ fontSize: '13px', fontWeight: 500, color: '#ffffff' }}
                          >
                            📅{" "}
                            {g.day === "—"
                              ? "Sem data"
                              : formatDateOnly(g.day)}
                          </td>
                        </tr>
                        {g.rows.map(renderRowBlock)}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                /* groupMode === "date_company" */
                groupRowsByDate(rows).map((g) => (
                  <React.Fragment key={`day-${g.day}`}>
                    {/* 1º nível: Data */}
                    <tr className="bg-[#3b68f5]">
                      <td
                        colSpan={COLSPAN}
                        className="px-3 py-1"
                        style={{ fontSize: '13px', fontWeight: 500, color: '#ffffff' }}
                      >
                        📅 {g.day === "—" ? "Sem data" : formatDateOnly(g.day)}
                      </td>
                    </tr>
                    {/* 2º nível: Empresa */}
                    {groupRowsByCompany(g.rows).map((c) => (
                      <React.Fragment
                        key={`day-${g.day}-company-${c.company}`}
                      >
                        <tr className="bg-[#3b68f5]">
                          <td
                            colSpan={COLSPAN}
                            className="px-6 py-1"
                            style={{ fontSize: '13px', fontWeight: 500, color: '#ffffff' }}
                          >
                            🏢 {c.company || "Sem empresa"}
                          </td>
                        </tr>
                        {c.rows.map(renderRowBlock)}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={isEditModalOpen}
        onClose={handleCloseModal}
        title="Editar Ação"
        size="2xl"
      >
        {selectedChatForEdit && (
          <EditActionForm
            companyDetails={companyDetailsForEdit ?? undefined}
            editingChat={selectedChatForEdit}
            onSaved={() => {
              lastEditedIdRef.current = selectedChatForEdit.id;
              handleSaved();
            }}
            onCancel={handleCloseModal}
          />
        )}
      </Modal>
    </section>
  );
};

export default ConversationHistoryCard;

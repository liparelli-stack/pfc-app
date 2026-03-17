/*
-- ===================================================
-- Código             : /src/components/ui/HierarchicalActionSelect.tsx
-- Versão (.v20)      : 1.8.0
-- Data/Hora          : 2025-11-25 18:10 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Dropdown hierárquico “Ação*” com PAI NÃO selecionável
--                      e filhos obrigatórios:
--                        • Cabeçalho do grupo serve apenas como organizador/expansor.
--                        • Clique na SETA ou no cabeçalho expande/recolhe (sem seleção).
--                        • Clique no FILHO seleciona o FILHO (ex.: "task:null:orcamento") e fecha.
--                        • Ao abrir, todos os grupos iniciam EXPANDIDOS (reduz 1 clique).
--                        • Abrir e sair sem escolher não altera o valor atual.
-- Fluxo              : EditActionForm → HierarchicalActionSelect
-- Alterações (1.8.0) :
--   • [UX] Pais deixam de ser opções selecionáveis; apenas filhos podem ser escolhidos.
--   • [UX] Todos os grupos iniciam expandidos por padrão (salvo override do cache por perfil).
--   • [UX] Cabeçalho agora só controla expand/colapse via clique/teclado.
-- Alterações (1.7.2) :
--   • [FIX][Modal] Eleva o menu acima do overlay do Modal: z-index de z-[1000] → z-[30000].
--   • [FIX] Remove dependência de getElementById; usa menuRef para clique-fora (robusto com múltiplas instâncias).
--   • [SAFE] Mantém portal em document.body e locks de scroll existentes.
-- Alterações (1.7.1) :
--   • [FIX] Evita rolagem da página ao selecionar item: lock de scroll do <body> ao abrir
--           e focus({preventScroll:true}) no trigger ao fechar.
--   • [SAFE] Bloqueio de wheel/touch dentro do menu para não propagar ao window.
-- Alterações (1.7.0) :
--   • PAI agora tem id explícito (derivado do grupo): "call" | "message" | "task".
--   • Removido mapeamento para default de filho ao clicar no cabeçalho.
--   • Mantida navegação por seta separada do clique de seleção.
-- Dependências        : react, react-dom, clsx, lucide-react
-- ===================================================
*/

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import clsx from "clsx";
import { ChevronDown, ChevronRight } from "lucide-react";

type Option = { id: string; label: string };
type Group = { group: string; parentId: "call" | "message" | "task"; options: Option[] };

export interface HierarchicalActionSelectProps {
  label?: string;
  error?: string;
  groups: Array<{ group: string; options: { id: string; label: string }[] }>;
  value: string | "";
  onChange: (id: string) => void;
  /** Persistência por usuário; se omitido, não persiste (evita cache compartilhado). */
  profileId?: string;
  placeholder?: string;
}

const storageKey = (pid: string) => `ui:actionsDropdown:${pid}`;
const MIN_W = 360;
const MAX_W = 640;

function normalizeGroups(raw: HierarchicalActionSelectProps["groups"]): Group[] {
  return raw.map((g) => {
    const name = g.group.toLowerCase();
    let parentId: Group["parentId"] = "task";
    if (name.includes("lig")) parentId = "call";          // "Ligação"
    else if (name.includes("mens")) parentId = "message"; // "Mensagem"
    else if (name.includes("tare")) parentId = "task";    // "Tarefa"
    return { group: g.group, parentId, options: g.options };
  });
}

type MenuPos = { top: number; left: number; width: number };

const HierarchicalActionSelect: React.FC<HierarchicalActionSelectProps> = ({
  label = "Ação*",
  error,
  groups: rawGroups,
  value,
  onChange,
  profileId,
  placeholder = "Selecione uma ação...",
}) => {
  const groups = useMemo(() => normalizeGroups(rawGroups), [rawGroups]);

  const [open, setOpen] = useState(false);

  // expanded: inicia com todos grupos true; depois pode ser sobrescrito pelo cache
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Refs e dimensões
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [autoWidth, setAutoWidth] = useState<number | undefined>(undefined);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);

  // Guardar overflow anterior do body para restaurar
  const prevBodyOverflow = useRef<string | null>(null);

  // Default: todos grupos expandidos (caso não haja cache ainda)
  useEffect(() => {
    setExpanded((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const allOpen: Record<string, boolean> = {};
      for (const g of groups) {
        allOpen[g.group] = true;
      }
      return allOpen;
    });
  }, [groups]);

  // Load/Save expandido
  useEffect(() => {
    if (!profileId) return;
    try {
      const raw = localStorage.getItem(storageKey(profileId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setExpanded((prev) => ({ ...prev, ...parsed }));
        }
      }
    } catch {}
  }, [profileId]);

  const persistExpanded = useCallback(
    (next: Record<string, boolean>) => {
      setExpanded(next);
      if (!profileId) return;
      try {
        localStorage.setItem(storageKey(profileId), JSON.stringify(next));
      } catch {}
    },
    [profileId]
  );

  // Label selecionada
  const selectedLabel = useMemo(() => {
    // Mantém compatibilidade: se o value for um id de PAI antigo, exibe o nome do grupo.
    const parent = groups.find((g) => g.parentId === value);
    if (parent) return parent.group;
    for (const g of groups) {
      const match = g.options.find((o) => o.id === value);
      if (match) return match.label;
    }
    return "";
  }, [groups, value]);

  // Largura automática
  const longestText = useMemo(() => {
    const texts: string[] = [];
    for (const g of groups) {
      texts.push(g.group);
      for (const o of g.options) texts.push(o.label);
    }
    if (selectedLabel) texts.push(selectedLabel);
    texts.push(placeholder || "");
    texts.push("Recebida (WhatsApp)");
    return texts.reduce((acc, t) => (t.length > acc.length ? t : acc), "");
  }, [groups, selectedLabel, placeholder]);

  useEffect(() => {
    if (!triggerRef.current) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cs = getComputedStyle(triggerRef.current);
    const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.font = font;

    const textWidth = ctx.measureText(longestText).width;
    const extras = 16 * 2 + 16 + 8 + 10; // paddings + ícone + gap + folga
    const computed = Math.ceil(textWidth + extras);
    const finalWidth = Math.max(MIN_W, Math.min(MAX_W, computed));
    setAutoWidth(finalWidth);
  }, [longestText]);

  // Posição do menu
  const computeMenuPos = useCallback((): MenuPos | null => {
    const el = triggerRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const width = Math.max(r.width, autoWidth ?? MIN_W);
    return {
      top: Math.round(r.bottom + 6),
      left: Math.round(r.left),
      width: Math.min(Math.max(width, MIN_W), MAX_W),
    };
  }, [autoWidth]);

  const openMenu = useCallback(() => {
    setOpen(true);
    setMenuPos(computeMenuPos());
    // 🔒 trava o scroll do body ao abrir
    try {
      prevBodyOverflow.current = document.body.style.overflow || "";
      document.body.style.overflow = "hidden";
    } catch {}
  }, [computeMenuPos]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    // 🔓 restaura scroll do body e refoca o trigger sem rolar a página
    requestAnimationFrame(() => {
      try {
        document.body.style.overflow = prevBodyOverflow.current ?? "";
      } catch {}
      try {
        triggerRef.current?.focus({ preventScroll: true });
      } catch {}
    });
  }, []);

  // Recalcular em scroll/resize
  useEffect(() => {
    if (!open) return;
    const handler = () => setMenuPos(computeMenuPos());
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open, computeMenuPos]);

  // Clique fora: fecha sem alterar valor (robusto com múltiplas instâncias e portal)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const trg = triggerRef.current;
      const menu = menuRef.current;
      const t = e.target as Node;
      if (trg?.contains(t)) return;
      if (menu?.contains(t)) return;
      closeMenu();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, closeMenu]);

  // Ações
  const toggleGroup = (gName: string) => {
    const next = { ...expanded, [gName]: !expanded[gName] };
    persistExpanded(next);
  };

  const handleToggleClick = (e: React.MouseEvent, gName: string) => {
    e.stopPropagation();
    toggleGroup(gName);
  };

  const handleChooseChild = (id: string) => {
    onChange(id);
    closeMenu();
  };

  // Teclado
  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open ? closeMenu() : openMenu();
    } else if (e.key === "Escape") {
      closeMenu();
    }
  };

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") closeMenu();
  };

  // Cabeçalho do grupo: só expande/recolhe (não seleciona)
  const onGroupKeyDown =
    (gName: string, isOpen: boolean) =>
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowRight") {
        if (!isOpen) toggleGroup(gName);
      } else if (e.key === "ArrowLeft") {
        if (isOpen) toggleGroup(gName);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleGroup(gName);
      } else if (e.key === "Escape") {
        closeMenu();
      }
    };

  // Render
  return (
    <div className="w-auto inline-block" ref={rootRef}>
      {label && <label className="block text-sm font-medium mb-1">{label}</label>}

      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onKeyDown={onTriggerKeyDown}
        onClick={() => (open ? closeMenu() : openMenu())}
        className={clsx(
          "h-11 px-4 rounded-lg bg-plate dark:bg-plate-dark neumorphic-concave",
          "text-left inline-flex items-center justify-between gap-2",
          error ? "ring-1 ring-red-500" : "focus:outline-none"
        )}
        style={autoWidth ? { width: autoWidth } : undefined}
      >
        <span className={clsx(!selectedLabel && "text-gray-400", "whitespace-nowrap")}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          className={clsx("w-4 h-4 shrink-0 transition-transform", open && "rotate-180")}
        />
      </button>

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

      {/* Menu (em portal) */}
      {open && menuPos &&
        ReactDOM.createPortal(
          <div
            ref={menuRef}
            role="listbox"
            tabIndex={-1}
            onKeyDown={onMenuKeyDown}
            /* 🚫 impede que wheel/touch do menu role a página de fundo */
            onWheelCapture={(e) => e.stopPropagation()}
            onTouchMoveCapture={(e) => e.stopPropagation()}
            className={clsx(
              "z-[30000] fixed",
              "rounded-xl shadow-lg border border-dark-shadow dark:border-dark-dark-shadow",
              "bg-plate dark:bg-plate-dark"
            )}
            style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
          >
            <div className="max-h-72 overflow-auto py-1">
              {groups.map((g) => {
                const isOpen = !!expanded[g.group];
                const someChildActive = g.options.some((o) => o.id === value);

                return (
                  <div key={g.group} className="px-1 py-1">
                    {/* Cabeçalho do grupo: apenas expande/recolhe (não seleciona valor) */}
                    <div
                      className={clsx(
                        "flex items-center justify-between px-3 py-2 rounded-lg select-none",
                        "cursor-pointer",
                        someChildActive
                          ? "bg-blue-50 dark:bg-blue-900/40 text-blue-800 dark:text-blue-100"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                      onClick={() => toggleGroup(g.group)}
                      onKeyDown={onGroupKeyDown(g.group, isOpen)}
                      role="button"
                      aria-expanded={isOpen}
                      tabIndex={0}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={isOpen ? "Recolher" : "Expandir"}
                          className={clsx(
                            "p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
                          )}
                          onClick={(e) => handleToggleClick(e, g.group)}
                        >
                          {isOpen ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        <span className="font-semibold whitespace-nowrap">
                          {g.group}
                        </span>
                      </div>
                    </div>

                    {/* Filhos */}
                    {isOpen && (
                      <div className="mt-1 space-y-1 pl-9 pr-2">
                        {g.options.map((opt) => {
                          const active = value === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              role="option"
                              aria-selected={active}
                              className={clsx(
                                "w-full text-left px-3 py-2 rounded-md whitespace-nowrap",
                                active
                                  ? "bg-blue-600 text-white"
                                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
                              )}
                              onMouseDown={(e) => e.preventDefault()} // evita blur antes do clique
                              onClick={() => handleChooseChild(opt.id)}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default HierarchicalActionSelect;

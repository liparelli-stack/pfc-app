// Código             : /src/components/shared/TaggingBar.tsx
// Versão (.v20)      : 0.3.0
// Data/Hora          : 2025-11-15 21:30 America/Sao_Paulo
// Autor              : FL / Execução via você EVA
// Objetivo do codigo : Linha fixa/ancorada de tagging com:
//                      • Barra "TAGS · CONTEXTO" (chips + placeholder + ícone etiqueta).
//                      • Janela de tagging "Pesquisar ou Criar" (painel não-modal).
//                      • Seleção/criação de tags + paleta de cor no rodapé.
// Fluxo              : TaggingBar -> tagsService -> public.tags + chats.tags (jsonb: slug[])
// Alterações (0.3.0) :
//   • Mantida janela aberta após adicionar tag (ENTER múltiplo em sequência).
//   • Removido seletor de cor por tag ("..."); agora paleta única no rodapé.
//   • Criação de tag usa cor escolhida ou rotação automática em COLOR_PRESETS.
//   • Chips com “anel” (border) calculado na UI e remoção apenas pelo “X”.
//   • Busca limitada a tags de origem 'user' nesta UI de tagging.
// Dependências       :
//   • React
//   • @/components/ui/Button
//   • @/services/tagsService
//   • @/types/tag

import React, {
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/Button";
import type { Tag } from "@/types/tag";
import { createTag, searchTags } from "@/services/tagsService";

export interface TaggingBarProps {
  selectedSlugs: string[];
  onChange: (slugs: string[]) => void;
  context?: "chat" | "ticket" | "deal" | "company" | string;
  allowCreate?: boolean;
}

// Paleta de cores para escolha rápida na janela de tagging
const COLOR_PRESETS = [
  "#4C1D95", // roxo escuro
  "#6D28D9", // roxo
  "#34B4BA", // ciano
  "#047857", // verde
  "#065F46", // verde escuro
  "#1D4ED8", // azul
  "#996633", // ocre/marrom
  "#BE123C", // vermelho
  "#DA8200", // laranja
  "#F600B6", // rosa
];

function getContrastColor(hexColor: string): string {
  let c = hexColor.replace("#", "");
  if (c.length === 3) {
    c = c
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111827" : "#F9FAFB"; // preto ou quase branco
}

function darkenHex(hexColor: string, factor = 0.8): string {
  let c = hexColor.replace("#", "");
  if (c.length === 3) {
    c = c
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  const r = Math.max(0, Math.min(255, Math.round(parseInt(c.slice(0, 2), 16) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(parseInt(c.slice(2, 4), 16) * factor)));
  const b = Math.max(0, Math.min(255, Math.round(parseInt(c.slice(4, 6), 16) * factor)));

  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

interface TagChipProps {
  slug: string;
  label?: string;
  color?: string | null;
  onRemove: () => void;
}

const TagChip: React.FC<TagChipProps> = ({ slug, label, color, onRemove }) => {
  const baseColor = color || "#6D28D9";
  const textColor = getContrastColor(baseColor);
  const outlineColor = darkenHex(baseColor, 0.8);

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium shadow-sm border-2 transition-transform hover:scale-[1.01]"
      style={{
        backgroundColor: baseColor,
        color: textColor,
        borderColor: outlineColor,
        boxShadow: `0 0 6px ${baseColor}55`,
      }}
      title={label || slug}
    >
      <span className="truncate max-w-[160px]">{label || slug}</span>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[11px] font-bold hover:bg-white/20 focus:outline-none"
        aria-label={`Remover tag "${label || slug}"`}
        title={`Remover tag "${label || slug}"`}
      >
        ×
      </button>
    </span>
  );
};

export const TaggingBar: React.FC<TaggingBarProps> = ({
  selectedSlugs,
  onChange,
  context = "chat",
  allowCreate = true,
}) => {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pendingColor, setPendingColor] = useState<string | null>(null);
  const [autoColorIndex, setAutoColorIndex] = useState(0);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const lowerSelected = useMemo(
    () => new Set(selectedSlugs.map((s) => s.toLowerCase())),
    [selectedSlugs]
  );

  const selectedDetails = useMemo(() => {
    const bySlug = new Map<string, Tag>();
    suggestions.forEach((t) => {
      bySlug.set(t.slug, t);
    });
    return selectedSlugs.map((slug) => ({
      slug,
      tag: bySlug.get(slug),
    }));
  }, [selectedSlugs, suggestions]);

  // Fecha painel ao clicar fora
  useEffect(() => {
    if (!isPanelOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsPanelOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isPanelOpen]);

  // Busca de tags na janela (Pesquisar ou Criar)
  useEffect(() => {
    if (!isPanelOpen) return;

    let active = true;

    async function load() {
      const q = inputValue.trim();
      if (q.length === 0) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await searchTags({
          q,
          limit: 20,
          includeSystem: false, // aqui só trabalhamos com tags 'user'
          includeUser: true,
        });
        if (!active) return;
        setSuggestions(data);
      } catch (err: any) {
        if (!active) return;
        console.error("TaggingPanel search error", err);
        setError("Erro ao buscar tags.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    const handle = setTimeout(load, 250); // debounce
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [inputValue, isPanelOpen]);

  function handleAddSlug(slug: string) {
    const normalized = slug.toLowerCase();
    if (lowerSelected.has(normalized)) {
      // Já selecionada: apenas limpa o input, mantêm painel aberto
      setInputValue("");
      return;
    }
    onChange([...selectedSlugs, slug]);
    // Mantém painel aberto, limpa o campo para próxima tag
    setInputValue("");
  }

  function handleRemoveSlug(slug: string) {
    onChange(selectedSlugs.filter((s) => s !== slug));
  }

  async function handleCreateTag() {
    const name = inputValue.trim();
    if (!name || !allowCreate) return;

    setIsCreating(true);
    setError(null);

    try {
      let colorToUse = pendingColor;
      if (!colorToUse) {
        // Rotação automática na paleta quando usuário não escolhe cor
        const idx = autoColorIndex % COLOR_PRESETS.length;
        colorToUse = COLOR_PRESETS[idx];
        setAutoColorIndex((prev) => (prev + 1) % COLOR_PRESETS.length);
      }

      const tag = await createTag({
        name,
        origin: "user",
        color: colorToUse,
      });

      handleAddSlug(tag.slug);
    } catch (err: any) {
      console.error("TaggingPanel createTag error", err);
      setError("Não foi possível criar a tag.");
    } finally {
      setIsCreating(false);
    }
  }

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = inputValue.trim();
      if (!q) return;

      const existing =
        suggestions.find(
          (t) =>
            t.slug.toLowerCase() === q.toLowerCase() ||
            t.name.toLowerCase() === q.toLowerCase()
        ) || null;

      if (existing) {
        handleAddSlug(existing.slug);
        return;
      }

      if (allowCreate) {
        void handleCreateTag();
      }
    }

    if (e.key === "Escape") {
      setIsPanelOpen(false);
    }
  }

  const contextLabel =
    context && context.length > 0
      ? `TAGS · ${context.toString().toUpperCase()}`
      : "TAGS";

  const effectivePendingColor = pendingColor ?? COLOR_PRESETS[autoColorIndex % COLOR_PRESETS.length];

  return (
    <div className="relative space-y-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-semibold tracking-wide text-slate-500">
          {contextLabel}
        </span>
        {(isLoading || isCreating) && (
          <span className="text-[10px] text-slate-400">
            {isCreating ? "Criando tag…" : "Buscando…"}
          </span>
        )}
      </div>

      {/* Barra fixa/ancorada (campo Etiquetas) */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-gradient-to-b from-slate-50 to-slate-200 px-3 py-2 shadow-inner">
        {/* Chips selecionados */}
        <div className="flex flex-wrap gap-2 flex-1 min-w-0">
          {selectedDetails.map(({ slug, tag }) => (
            <TagChip
              key={slug}
              slug={slug}
              label={tag?.name ?? slug}
              color={tag?.color ?? null}
              onRemove={() => handleRemoveSlug(slug)}
            />
          ))}

          {selectedSlugs.length === 0 && (
            <span className="text-xs text-slate-500">
              Adicionar tag após pesquisar ou criar…
            </span>
          )}
        </div>

        {/* Botão/ícone para abrir janela de tagging (etiqueta) */}
        <button
          type="button"
          ref={triggerRef}
          onClick={() => {
            setIsPanelOpen((prev) => !prev);
            setInputValue("");
            setSuggestions([]);
            setError(null);
            // não resetamos pendingColor; se usuário escolheu, mantemos.
          }}
          className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-400 bg-slate-100 text-slate-700 shadow-sm hover:bg-slate-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/60"
          title="Abrir janela de tagging"
        >
          {/* Ícone de etiqueta minimalista/geométrico */}
          <span className="block h-4 w-4 border-2 border-slate-700 border-b-transparent border-l-transparent rounded-sm rotate-45 translate-y-[1px]" />
        </button>
      </div>

      {/* Janela de tagging (painel não-modal) */}
      {isPanelOpen && (
        <div
          ref={panelRef}
          className="absolute z-40 mt-2 w-80 rounded-xl border border-slate-700 bg-slate-900/95 p-3 text-xs text-slate-100 shadow-2xl"
        >
          <div className="mb-2">
            <div className="mb-1 text-[11px] font-semibold tracking-wide text-slate-300">
              Pesquisar ou Criar
            </div>
            <input
              autoFocus
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Digite para buscar ou criar…"
              className="h-8 w-full rounded-md border border-slate-600 bg-slate-800 px-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/70"
            />
          </div>

          {error && (
            <div className="mb-2 text-[10px] text-red-400">{error}</div>
          )}

          {/* Lista de sugestões */}
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1 mb-2">
            {suggestions.map((tag) => {
              const selected = lowerSelected.has(tag.slug.toLowerCase());
              const baseColor = tag.color || "#4B5563"; // fallback cinza
              const textColor = getContrastColor(baseColor);
              const outlineColor = darkenHex(baseColor, 0.85);

              return (
                <div
                  key={tag.id}
                  className="flex items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-slate-800/80"
                >
                  <button
                    type="button"
                    onClick={() => handleAddSlug(tag.slug)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    {/* “Handle” visual + chip com anel */}
                    <span className="text-slate-500 text-[10px] mr-1">⋮⋮</span>
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border"
                      style={{
                        backgroundColor: selected ? baseColor : "#111827",
                        color: selected ? textColor : "#E5E7EB",
                        borderColor: outlineColor,
                        boxShadow: selected
                          ? `0 0 6px ${baseColor}66`
                          : "none",
                      }}
                    >
                      <span
                        className="mr-1 inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: baseColor }}
                      />
                      {tag.name}
                    </span>
                  </button>

                  {/* Checkbox simples indicando seleção */}
                  <input
                    type="checkbox"
                    className="ml-2 h-3 w-3 rounded border-slate-500 bg-slate-800 text-primary focus:ring-0"
                    checked={selected}
                    onChange={() => {
                      if (selected) {
                        handleRemoveSlug(tag.slug);
                      } else {
                        handleAddSlug(tag.slug);
                      }
                    }}
                  />
                </div>
              );
            })}

            {/* Opção de criar tag se nada bater */}
            {allowCreate &&
              inputValue.trim().length >= 2 &&
              !isLoading && (
                <button
                  type="button"
                  onClick={handleCreateTag}
                  className="mt-1 w-full rounded-md bg-slate-800 px-2 py-1 text-left text-[11px] text-slate-200 hover:bg-slate-700"
                >
                  + Criar tag “{inputValue.trim()}”
                </button>
              )}
          </div>

          {/* Paleta de cores no rodapé da janela */}
          <div className="border-t border-slate-700 pt-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] text-slate-300">
                Cor da próxima tag
              </span>
              <span className="text-[10px] text-slate-400">
                {effectivePendingColor}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {COLOR_PRESETS.map((c) => {
                const isActive = effectivePendingColor === c;
                return (
                  <button
                    key={c}
                    type="button"
                    className="h-4 w-4 rounded-sm border hover:scale-110 focus:outline-none"
                    style={{
                      backgroundColor: c,
                      borderColor: isActive ? "#F9FAFB" : "#020617",
                      boxShadow: isActive ? `0 0 6px ${c}AA` : "none",
                    }}
                    onClick={() => setPendingColor(c)}
                    title={c}
                  />
                );
              })}

              <button
                type="button"
                className="ml-2 px-2 h-5 rounded-full border border-slate-600 bg-slate-800 text-[9px] text-slate-200 hover:bg-slate-700"
                onClick={() => setPendingColor(null)}
              >
                auto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

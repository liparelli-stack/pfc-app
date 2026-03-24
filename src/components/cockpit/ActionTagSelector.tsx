import React from "react";
import type { KeyboardEvent, MutableRefObject } from "react";
import clsx from "clsx";
import { Tag as TagIcon } from "lucide-react";
import type { Tag } from "@/types/tag";
import { TagChip } from "@/components/ui/TagChip";
import { COLOR_PRESETS } from "@/config/actionConstants";
import { getContrastColor, darkenHex } from "@/utils/colors";

interface ActionTagSelectorProps {
  tags: string[];
  tagMapBySlug: Map<string, Tag>;
  lowerSelectedTags: Set<string>;
  isTagPanelOpen: boolean;
  tagSearch: string;
  tagSuggestions: Tag[];
  tagLoading: boolean;
  tagCreating: boolean;
  tagError: string | null;
  effectivePendingColor: string;
  tagButtonRef: MutableRefObject<HTMLButtonElement | null>;
  tagPanelRef: MutableRefObject<HTMLDivElement | null>;
  onTogglePanel: () => void;
  onTagAdd: (slug: string) => void;
  onTagRemove: (slug: string) => void;
  onTagCreate: () => Promise<void>;
  onTagSearchKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onTagSearchChange: (v: string) => void;
  onColorSelect: (c: string | null) => void;
  onClosePanel: () => void;
}

const ActionTagSelector: React.FC<ActionTagSelectorProps> = ({
  tags,
  tagMapBySlug,
  lowerSelectedTags,
  isTagPanelOpen,
  tagSearch,
  tagSuggestions,
  tagLoading,
  tagCreating,
  tagError,
  effectivePendingColor,
  tagButtonRef,
  tagPanelRef,
  onTogglePanel,
  onTagAdd,
  onTagRemove,
  onTagCreate,
  onTagSearchKeyDown,
  onTagSearchChange,
  onColorSelect,
  onClosePanel,
}) => {
  return (
    <div className="relative">
      <label className="block text-sm font-medium mb-1">Etiquetas</label>
      <div className="flex items-start gap-3">
        <div
          ref={tagButtonRef as any}
          title="Etiqueta"
          aria-label="Etiqueta"
          onClick={onTogglePanel}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
          style={{
            backgroundColor: '#3b68f5',
            color: '#ffffff',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: 1,
          }}
        >
          <TagIcon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-h-[44px] px-3 py-2 rounded-lg bg-plate dark:bg-dark-s1 neumorphic-concave flex flex-wrap gap-2 items-center">
          {tags.length === 0 && (
            <span className="text-xs text-gray-500 dark:text-dark-t2">
              Use o botão de etiqueta para pesquisar ou criar novas
              etiquetas que resumam o assunto ou contexto da ação.
            </span>
          )}
          {tags.map((slug) => (
            <TagChip
              key={slug}
              slug={slug}
              tag={tagMapBySlug.get(slug.toLowerCase())}
              onRemove={() => onTagRemove(slug)}
            />
          ))}
        </div>
      </div>

      {isTagPanelOpen && (
        <div
          ref={tagPanelRef}
          className="absolute z-30 mt-2 w-full max-w-xl rounded-xl bg-slate-900 text-slate-50 shadow-xl border border-slate-700 p-3"
        >
          <div className="mb-2 flex items-start justify_between gap-2">
            <div className="text-[11px] text-slate-300">
              <div className="font-semibold mb-0.5">Etiquetas desta ação</div>
              <div className="text-slate-400">
                Busque por nome para reaproveitar etiquetas existentes ou
                crie novas com uma cor padrão. Isso ajuda a organizar o
                contexto sobre a conversa/tarefa.
              </div>
            </div>
            <button
              type="button"
              onClick={onClosePanel}
              className="ml-2 text-[10px] text-slate-400 hover:text-slate-100"
            >
              Fechar
            </button>
          </div>

          <div className="mb-2 flex flex-col gap-2">
            <input
              type="text"
              value={tagSearch}
              onChange={(e) => onTagSearchChange(e.target.value)}
              onKeyDown={onTagSearchKeyDown}
              placeholder="Buscar ou criar etiqueta..."
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs outline-none placeholder:text-slate-500"
            />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">Cor sugerida:</span>
              <div className="flex flex-wrap gap-1">
                {COLOR_PRESETS.map((c) => {
                  const selected = c === effectivePendingColor;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onColorSelect(c)}
                      className={clsx(
                        "h-4 w-4 rounded-full border border-slate-600",
                        selected && "ring-2 ring-offset-1 ring-offset-slate-900"
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={onTagCreate}
              disabled={tagCreating || !tagSearch.trim()}
              className="self-start mt-1 inline-flex items-center rounded-md border border-slate-600 bg-slate-800 px-2 py-0.5 text-[11px] font-medium hover:bg-slate-700 disabled:opacity-50"
            >
              {tagCreating ? "Criando..." : "Criar etiqueta com esse nome"}
            </button>
          </div>

          {tagError && (
            <div className="mb-2 text-[10px] text-red-400">{tagError}</div>
          )}

          <div className="max-h-56 space-y-1 overflow-y-auto pr-1 mb-2">
            {tagLoading && (
              <div className="text-[10px] text-slate-400">Buscando tags...</div>
            )}

            {tagSuggestions.map((tag) => {
              const selected = lowerSelectedTags.has(tag.slug.toLowerCase());
              const baseColor = tag.color || "#4B5563";
              const textColor = getContrastColor(baseColor);
              const outlineColor = darkenHex(baseColor, 0.85);

              return (
                <div
                  key={tag.id}
                  className="flex items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-slate-800/80"
                >
                  <button
                    type="button"
                    onClick={() => onTagAdd(tag.slug)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <span className="text-slate-500 text-[10px] mr-1">⋮⋮</span>
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border"
                      style={{
                        backgroundColor: baseColor,
                        color: textColor,
                        borderColor: outlineColor,
                      }}
                    >
                      <span
                        className="mr-1 inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: baseColor }}
                      />
                      {tag.name}
                    </span>
                  </button>
                  <input
                    type="checkbox"
                    className="ml-2 h-3 w-3 rounded border-slate-500 bg-slate-800 text-primary focus:ring-0"
                    checked={selected}
                    onChange={() => {
                      if (selected) {
                        onTagRemove(tag.slug);
                      } else {
                        onTagAdd(tag.slug);
                      }
                    }}
                  />
                </div>
              );
            })}

            {!tagLoading && tagSuggestions.length === 0 && tagSearch && (
              <div className="text-[10px] text-slate-500">
                Nenhuma etiqueta encontrada para &quot;{tagSearch}&quot;.
                Você pode criar uma nova usando o botão acima.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionTagSelector;

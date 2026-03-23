import { useState, useEffect, useMemo, useRef, KeyboardEvent } from "react";
import type { MutableRefObject } from "react";
import type { Tag as TagEntity } from "@/types/tag";
import { searchTags, createTag, getTagsBySlugs } from "@/services/tagsService";
import { COLOR_PRESETS } from "@/config/actionConstants";
import { normalizeText } from "@/utils/textNormalization";

interface UseTagsManagerParams {
  editingChatId?: string | null;
  editingChatTags?: string[] | null;
}

export interface UseTagsManagerReturn {
  // Selected tags (slugs) — used in onSubmit to persist
  tags: string[];
  // Full tag entities for rendering chips
  tagEntities: TagEntity[];
  tagMapBySlug: Map<string, TagEntity>;
  lowerSelectedTags: Set<string>;
  // Panel state
  isTagPanelOpen: boolean;
  tagSearch: string;
  tagSuggestions: TagEntity[];
  tagLoading: boolean;
  tagCreating: boolean;
  tagError: string | null;
  pendingColor: string | null;
  effectivePendingColor: string;
  // Refs (para detectar clique fora do painel)
  tagButtonRef: MutableRefObject<HTMLButtonElement | null>;
  tagPanelRef: MutableRefObject<HTMLDivElement | null>;
  // Handlers
  handleTagAdd: (slug: string) => void;
  handleTagRemove: (slug: string) => void;
  handleTagCreate: () => Promise<void>;
  handleTagSearchKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  setTagSearch: (v: string) => void;
  setIsTagPanelOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setPendingColor: (v: string | null) => void;
}

export function useTagsManager({
  editingChatId,
  editingChatTags,
}: UseTagsManagerParams): UseTagsManagerReturn {
  // ----- Tags selecionadas (slugs) -----
  const [tags, setTags] = useState<string[]>(() => {
    if (!editingChatTags) return [];
    if (Array.isArray(editingChatTags)) {
      return editingChatTags.filter((t): t is string => typeof t === "string");
    }
    return [];
  });

  useEffect(() => {
    if (!editingChatTags) {
      setTags([]);
      return;
    }
    if (Array.isArray(editingChatTags)) {
      setTags(
        editingChatTags.filter((t) => typeof t === "string") as string[]
      );
      return;
    }
    setTags([]);
  }, [editingChatTags]);

  // ----- Entidades completas (nome, cor) -----
  const [tagEntities, setTagEntities] = useState<TagEntity[]>([]);

  const tagMapBySlug = useMemo(() => {
    const map = new Map<string, TagEntity>();
    tagEntities.forEach((t) => map.set(t.slug.toLowerCase(), t));
    return map;
  }, [tagEntities]);

  const ensureTagInEntities = (tag: TagEntity) => {
    setTagEntities((prev) => {
      if (prev.some((t) => t.id === tag.id)) return prev;
      return [...prev, tag];
    });
  };

  // Carrega entidades ao abrir em modo edição
  useEffect(() => {
    if (!editingChatTags || !Array.isArray(editingChatTags)) return;

    const slugs = editingChatTags.filter(
      (t): t is string => typeof t === "string" && t.trim().length > 0
    );
    if (slugs.length === 0) return;

    let active = true;

    const load = async () => {
      try {
        const fetched = await getTagsBySlugs(slugs);
        if (!active || !fetched?.length) return;
        setTagEntities((prev) => {
          const map = new Map(prev.map((t) => [t.id, t]));
          fetched.forEach((t) => map.set(t.id, t));
          return Array.from(map.values());
        });
      } catch (err) {
        console.error("Erro ao carregar tags do chat (edição):", err);
      }
    };

    void load();
    return () => { active = false; };
  }, [editingChatId, editingChatTags]);

  // ----- Estado do painel -----
  const [isTagPanelOpen, setIsTagPanelOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<TagEntity[]>([]);
  const [tagLoading, setTagLoading] = useState(false);
  const [tagCreating, setTagCreating] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const [pendingColor, setPendingColor] = useState<string | null>(null);
  const [autoColorIndex, setAutoColorIndex] = useState(0);

  const tagButtonRef = useRef<HTMLButtonElement | null>(null);
  const tagPanelRef = useRef<HTMLDivElement | null>(null);

  const lowerSelectedTags = useMemo(
    () => new Set(tags.map((s) => normalizeText(s))),
    [tags]
  );

  const effectivePendingColor =
    pendingColor ?? COLOR_PRESETS[autoColorIndex % COLOR_PRESETS.length];

  // Fechar ao clicar fora
  useEffect(() => {
    if (!isTagPanelOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        tagPanelRef.current &&
        !tagPanelRef.current.contains(e.target as Node) &&
        tagButtonRef.current &&
        !tagButtonRef.current.contains(e.target as Node)
      ) {
        setIsTagPanelOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isTagPanelOpen]);

  // Busca com debounce de 250ms
  useEffect(() => {
    if (!isTagPanelOpen) return;

    const q = tagSearch.trim();
    if (!q) {
      setTagSuggestions([]);
      setTagError(null);
      return;
    }

    let active = true;

    async function run() {
      setTagLoading(true);
      setTagError(null);
      try {
        const found = await searchTags({
          q,
          limit: 20,
          includeUser: true,
          includeSystem: false,
        });
        if (!active) return;
        setTagSuggestions(found);
        setTagEntities((prev) => {
          const map = new Map(prev.map((t) => [t.id, t]));
          found.forEach((t) => map.set(t.id, t));
          return Array.from(map.values());
        });
      } catch (err: any) {
        if (!active) return;
        console.error("Erro ao buscar tags:", err);
        setTagError("Erro ao buscar tags.");
      } finally {
        if (active) setTagLoading(false);
      }
    }

    const handle = window.setTimeout(run, 250);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [tagSearch, isTagPanelOpen]);

  // ----- Handlers -----
  const handleTagAdd = (slug: string) => {
    const norm = normalizeText(slug);
    if (lowerSelectedTags.has(norm)) {
      setTagSearch("");
      return;
    }
    setTags((prev) => [...prev, slug]);
    setTagSearch("");
  };

  const handleTagRemove = (slug: string) => {
    setTags((prev) => prev.filter((s) => s !== slug));
  };

  const handleTagCreate = async () => {
    const name = tagSearch.trim();
    if (!name) return;

    setTagCreating(true);
    setTagError(null);

    try {
      let colorToUse = pendingColor;
      if (!colorToUse) {
        const idx = autoColorIndex % COLOR_PRESETS.length;
        colorToUse = COLOR_PRESETS[idx];
        setAutoColorIndex((prev) => (prev + 1) % COLOR_PRESETS.length);
      }

      const tag = await createTag({
        name,
        color: colorToUse,
        origin: "user",
      });

      ensureTagInEntities(tag);
      handleTagAdd(tag.slug);
    } catch (err: any) {
      console.error("Erro ao criar tag:", err);
      setTagError("Não foi possível criar a tag.");
    } finally {
      setTagCreating(false);
    }
  };

  const handleTagSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = tagSearch.trim();
      if (!q) return;

      const normQ = normalizeText(q);
      const existing =
        tagSuggestions.find(
          (t) =>
            normalizeText(t.slug) === normQ ||
            normalizeText(t.name) === normQ
        ) || null;

      if (existing) {
        handleTagAdd(existing.slug);
        return;
      }

      void handleTagCreate();
    }

    if (e.key === "Escape") {
      setIsTagPanelOpen(false);
    }
  };

  return {
    tags,
    tagEntities,
    tagMapBySlug,
    lowerSelectedTags,
    isTagPanelOpen,
    tagSearch,
    tagSuggestions,
    tagLoading,
    tagCreating,
    tagError,
    pendingColor,
    effectivePendingColor,
    tagButtonRef,
    tagPanelRef,
    handleTagAdd,
    handleTagRemove,
    handleTagCreate,
    handleTagSearchKeyDown,
    setTagSearch,
    setIsTagPanelOpen,
    setPendingColor,
  };
}

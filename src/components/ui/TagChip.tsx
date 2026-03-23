import React from "react";
import type { Tag as TagEntity } from "@/types/tag";
import { getContrastColor, darkenHex } from "@/utils/colors";

export type TagChipProps = {
  slug: string;
  tag?: TagEntity;
  onRemove: () => void;
};

export const TagChip: React.FC<TagChipProps> = ({ slug, tag, onRemove }) => {
  const baseColor = tag?.color || "#6D28D9";
  const textColor = getContrastColor(baseColor);
  const outlineColor = darkenHex(baseColor, 0.8);
  const label = tag?.name || slug;

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium shadow-sm border-2 transition-transform hover:scale-[1.01]"
      style={{
        backgroundColor: baseColor,
        color: textColor,
        borderColor: outlineColor,
        boxShadow: `0 0 6px ${baseColor}55`,
      }}
      title={label}
    >
      <span className="truncate max-w-[160px]">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[11px] font-bold hover:bg-white/20 focus:outline-none"
        aria-label={`Remover tag "${label}"`}
        title={`Remover tag "${label}"`}
      >
        ×
      </button>
    </span>
  );
};

import { byId } from "@/config/actionConstants";
import type { Dir } from "@/config/actionConstants";

export function reconstructSelectionId(params?: {
  kind?: string | null;
  direction?: Dir;
  channel_type?: string | null;
}): string {
  const k = (params?.kind ?? "").trim() as "call" | "message" | "task" | "";
  const d = (params?.direction ?? null) as Dir;
  const c = (params?.channel_type ?? "").trim();

  if (!k) return "";
  if (!c) return k;
  if (k === "task") {
    const key = `task:null:${c}`;
    return byId.has(key) ? key : "task";
  }
  const key = `${k}:${d ?? "null"}:${c}`;
  return byId.has(key) ? key : k;
}

export function toTripleFromSelection(selectionId: string) {
  if (selectionId === "call")
    return {
      kind: "call" as const,
      direction: null as Dir,
      channel_type: "call" as const,
    };
  if (selectionId === "message")
    return {
      kind: "message" as const,
      direction: null as Dir,
      channel_type: "message" as const,
    };
  if (selectionId === "task")
    return {
      kind: "task" as const,
      direction: "internal" as Dir,
      channel_type: "task" as const,
    };

  const opt = byId.get(selectionId);
  if (!opt)
    return {
      kind: "task" as const,
      direction: "internal" as Dir,
      channel_type: "task" as const,
    };
  const dir = opt.kind === "task" ? "internal" : opt.direction;
  return { kind: opt.kind, direction: dir, channel_type: opt.channel_type };
}

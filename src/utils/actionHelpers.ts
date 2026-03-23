import { byId } from "@/config/actionConstants";

export function resolveActionLabel(selectionId: string | undefined | null): string {
  if (!selectionId) return "";
  const opt = byId.get(selectionId);
  return opt?.label ?? "";
}

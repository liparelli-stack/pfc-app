/*
================================================================================
Código: /src/schemas/channelSchema.ts
Versão: 1.0.0
Data/Hora: 2025-10-09 19:55 -03
Autor: FL / Eva (E.V.A.)
Objetivo: Validar e normalizar os itens do JSON de canais do contato.
Fluxo: Usado por contactChannelsService.ts e UI (via service).
Regras (acordadas):
  - Obrigatórios por item: type (email|phone|messaging|link|other) e guard.
  - guard default = "Temporário".
  - value pode ser vazio ("") — contato pode nascer como indicação.
  - type='other' exige label.custom preenchido.
  - Múltiplos is_primary=true permitidos (sem unicidade).
  - Nunca persistir null/undefined (aplicar defaults).
Dependências: zod, @/types/channel
================================================================================
*/

import { z } from 'zod';
import type { ChannelItem, ChannelType, ContactGuard } from '../types/channel';

/* Enums alinhados ao tipo */
export const channelTypeEnum = z.enum(
  ['email', 'phone', 'messaging', 'link', 'other'] as [ChannelType, ...ChannelType[]]
);

export const contactGuardEnum = z.enum(
  ['Principal', 'Decisor', 'Secundário', 'Temporário'] as [ContactGuard, ...ContactGuard[]]
);

/* Label: strings nunca nulas ("" como default) */
export const channelLabelSchema = z.object({
  code: z.string().default('A'),
  custom: z.string().default(''),
});

/* Item do canal — com defaults seguros para evitar null/undefined */
export const channelItemSchema = z
  .object({
    id: z.string().min(1, 'id obrigatório'),
    type: channelTypeEnum,
    value: z.string().default(''),
    label: channelLabelSchema.default({ code: 'A', custom: '' }),
    is_primary: z.boolean().default(false),
    guard: contactGuardEnum.default('Temporário'),
    active: z.boolean().default(true),
    notes: z.string().default(''),
  })
  // Regra: se type='other', exigir label.custom não-vazio
  .refine((it) => (it.type === 'other' ? it.label.custom.trim().length > 0 : true), {
    message: "Para 'other', 'label.custom' deve ser preenchido",
    path: ['label', 'custom'],
  });

/* Array dos canais (sem unicidade de is_primary) */
export const channelsArraySchema = z.array(channelItemSchema);

/* ----------------------------- Helpers úteis -------------------------------- */

/** Safe-parse: retorna {ok,data} ou {ok:false,issues[]} para UI/Logs. */
export function parseChannelsArray(
  input: unknown
): { ok: true; data: ChannelItem[] } | { ok: false; issues: string[] } {
  const result = channelsArraySchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data as ChannelItem[] };
  const issues = result.error.issues.map((i) => {
    const path = i.path?.length ? `[${i.path.join('.')}] ` : '';
    return `${path}${i.message}`;
  });
  return { ok: false, issues };
}

/** Normaliza parciais aplicando defaults e valida com o schema (sem nulls). */
export function normalizeItem(partial: Partial<ChannelItem>): ChannelItem {
  const candidate = {
    id: partial.id ?? (globalThis.crypto?.randomUUID?.() ?? String(Date.now())),
    type: partial.type ?? 'phone',
    value: partial.value ?? '',
    label: {
      code: partial.label?.code ?? 'A',
      custom: partial.label?.custom ?? '',
    },
    is_primary: partial.is_primary ?? false,
    guard: partial.guard ?? 'Temporário',
    active: partial.active ?? true,
    notes: partial.notes ?? '',
  };
  return channelItemSchema.parse(candidate) as ChannelItem;
}

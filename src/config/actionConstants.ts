export type Dir = "outbound" | "inbound" | "internal" | null;

export type ActionOpt = {
  id: string;
  label: string;
  kind: "call" | "message" | "task";
  direction: Dir;
  channel_type:
    | "phone"
    | "whatsapp"
    | "email"
    | "orcamento"
    | "followup"
    | "visita"
    | "informacao"
    | "interna"
    | "almoco"
    | "reuniao"
    | null;
};

export const ACTION_GROUPS: Array<{ group: string; options: ActionOpt[] }> = [
  {
    group: "Ligação",
    options: [
      {
        id: "call:outbound:phone",
        label: "Efetuada",
        kind: "call",
        direction: "outbound",
        channel_type: "phone",
      },
      {
        id: "call:inbound:phone",
        label: "Recebida",
        kind: "call",
        direction: "inbound",
        channel_type: "phone",
      },
    ],
  },
  {
    group: "Mensagem",
    options: [
      {
        id: "message:outbound:whatsapp",
        label: "Enviada (WhatsApp)",
        kind: "message",
        direction: "outbound",
        channel_type: "whatsapp",
      },
      {
        id: "message:inbound:whatsapp",
        label: "Recebida (WhatsApp)",
        kind: "message",
        direction: "inbound",
        channel_type: "whatsapp",
      },
      {
        id: "message:outbound:email",
        label: "Enviada (E-mail)",
        kind: "message",
        direction: "outbound",
        channel_type: "email",
      },
      {
        id: "message:inbound:email",
        label: "Recebida (E-mail)",
        kind: "message",
        direction: "inbound",
        channel_type: "email",
      },
    ],
  },
  {
    group: "Tarefa",
    options: [
      {
        id: "task:null:orcamento",
        label: "Orçamento",
        kind: "task",
        direction: null,
        channel_type: "orcamento",
      },
      {
        id: "task:null:followup",
        label: "Follow-up",
        kind: "task",
        direction: null,
        channel_type: "followup",
      },
      {
        id: "task:null:visita",
        label: "Visita",
        kind: "task",
        direction: null,
        channel_type: "visita",
      },
      {
        id: "task:null:informacao",
        label: "Informação",
        kind: "task",
        direction: null,
        channel_type: "informacao",
      },
      {
        id: "task:null:interna",
        label: "Interna",
        kind: "task",
        direction: null,
        channel_type: "interna",
      },
      {
        id: "task:null:almoco",
        label: "Almoço",
        kind: "task",
        direction: null,
        channel_type: "almoco",
      },
      {
        id: "task:null:reuniao",
        label: "Reunião",
        kind: "task",
        direction: null,
        channel_type: "reuniao",
      },
    ],
  },
];

export const FLAT_OPTIONS: ActionOpt[] = ACTION_GROUPS.flatMap((g) => g.options);
export const byId = new Map(FLAT_OPTIONS.map((o) => [o.id, o]));

export const COLOR_PRESETS = [
  "#4C1D95",
  "#6D28D9",
  "#34B4BA",
  "#047857",
  "#065F46",
  "#1D4ED8",
  "#996633",
  "#BE123C",
  "#DA8200",
  "#F600B6",
];

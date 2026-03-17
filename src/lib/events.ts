/*
-- ===================================================
-- Código             : /src/lib/events.ts
-- Versão (.v17)      : 1.0.0
-- Data/Hora          : 2025-11-03 19:05 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo           : Event-bus leve para sincronizar alterações de chats entre componentes (e abas).
-- Fluxo              : EditActionForm → emitChatChanged → CockpitPage/ConversationHistoryCard onChatChanged
-- Alterações (1.0.0) : Criação do bus com CustomEvent + BroadcastChannel (multiaba).
-- Dependências       : n/a (web APIs)
-- ===================================================
*/

export type ChatChangedReason = "create" | "update" | "status";
export type ChatChangedEvent = {
  type: "chat:changed";
  chatId: string;
  companyId: string;
  reason: ChatChangedReason;
};

const TOPIC = "chat:changed";
const CHANNEL = "chat-events";

export function emitChatChanged(e: Omit<ChatChangedEvent, "type">) {
  const payload: ChatChangedEvent = { type: TOPIC, ...e };
  window.dispatchEvent(new CustomEvent(TOPIC, { detail: payload }));
}

let bc: BroadcastChannel | null = null;
function ensureBC() {
  if (!bc) bc = new BroadcastChannel(CHANNEL);
  return bc!;
}

export function broadcastChatChanged(e: Omit<ChatChangedEvent, "type">) {
  const payload: ChatChangedEvent = { type: TOPIC, ...e };
  ensureBC().postMessage(payload);
}

export function onChatChanged(handler: (e: ChatChangedEvent) => void) {
  const w = (ev: Event) => handler((ev as CustomEvent<ChatChangedEvent>).detail);
  window.addEventListener(TOPIC, w);

  const chan = ensureBC();
  const bcHandler = (msg: MessageEvent<ChatChangedEvent>) => {
    if (msg?.data?.type === TOPIC) handler(msg.data);
  };
  chan.addEventListener("message", bcHandler);

  return () => {
    window.removeEventListener(TOPIC, w);
    chan.removeEventListener("message", bcHandler);
  };
}

/*
-- ===================================================
-- Código             : /src/components/shared/ContactMiniCard.tsx
-- Versão (.v17)      : 1.2.0
-- Data/Hora          : 2025-11-30 18:45 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Card compacto (1 contato/linha) com status e canal preferencial.
-- Alterações (1.2.0) :
--  • Conectado ao hook useContactChannels(contact.id), consumindo a tabela contacts_channel.
--  • Mantido fallback para contact.channels (JSON legado) via adaptação para ContactChannel.
--  • Ordenação de canais agora usa sempre ContactChannel (hook + fallback).
-- Dependências          : react, clsx, lucide-react, @/types/contact, @/types/channel,
--                         @/hooks/useContactChannels
-- ===================================================
*/

import React, { useMemo } from "react";
import clsx from "clsx";
import type { Contact } from "@/types/contact";
import type { ContactChannel } from "@/types/channel";
import { Mail, Phone, MessageSquare, Link as LinkIcon } from "lucide-react";
import { useContactChannels } from "@/hooks/useContactChannels";

type Props = { contact: Contact };

const StatusDot: React.FC<{ active?: boolean }> = ({ active }) => (
  <span
    className={clsx("inline-block h-2.5 w-2.5 rounded-full", active ? "bg-green-500" : "bg-gray-400")}
    title={active ? "Ativo" : "Inativo"}
    aria-label={active ? "Ativo" : "Inativo"}
  />
);

const ensureHttp = (value?: string | null) => {
  if (!value) return "";
  const v = value.trim();
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};

const extractDomain = (value?: string | null): string | null => {
  if (!value) return null;
  try {
    const url = value.match(/^https?:\/\//i) ? value : `https://${value}`;
    const domain = new URL(url).hostname.replace(/^www\./i, "");
    return domain || null;
  } catch {
    const m = value.match(/([a-z0-9-]+\.)+[a-z]{2,}/i);
    return m ? m[0].replace(/^www\./i, "") : null;
  }
};

const getChannelIcon = (type: ContactChannel["type"]) => {
  switch (type) {
    case "email":
      return <Mail className="h-3.5 w-3.5" aria-hidden="true" />;
    case "phone":
      return <Phone className="h-3.5 w-3.5" aria-hidden="true" />;
    case "messaging":
      return <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />;
    case "link":
      return <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />;
    default:
      return <span className="h-3.5 w-3.5" />;
  }
};

const getChannelLabel = (type: ContactChannel["type"], value?: string | null): string => {
  switch (type) {
    case "phone": {
      const digits = (value ?? "").replace(/\D/g, "");
      const isCell = digits.length >= 11 && digits.includes("9");
      return isCell ? "Celular" : "Fixo";
    }
    case "email":
      return "E-mail";
    case "messaging":
      return "Mensageria";
    case "link":
      return extractDomain(value ?? "") ?? "Link";
    default:
      return "Canal";
  }
};

const sortWeight: Record<ContactChannel["type"], number> = {
  email: 1,
  phone: 2,
  messaging: 3,
  link: 4,
  other: 5,
};

const ContactMiniCard: React.FC<Props> = ({ contact }) => {
  const isInactive = contact.status === "inactive";
  const subtitle = [contact.position || "Cargo não informado", contact.department ? `— ${contact.department}` : ""]
    .join(" ")
    .trim();

  // 1) Canais oficiais: tabela contacts_channel via hook
  const { channels: hookChannels } = useContactChannels(contact.id);

  // 2) Fallback legado: contact.channels (JSON embutido em contacts.channels_json)
  const channels: ContactChannel[] = useMemo(() => {
    if (hookChannels && hookChannels.length > 0) {
      return [...hookChannels].sort(
        (a, b) => (sortWeight[a.type] ?? 99) - (sortWeight[b.type] ?? 99)
      );
    }

    const legacy = ((contact as any).channels ?? []) as any[];
    if (!legacy.length) return [];

    const adapted: ContactChannel[] = legacy.map((ch) => ({
      id: String(ch.id ?? ""),
      type: (ch.type ?? "phone") as ContactChannel["type"],
      value: ch.value ?? "",
      label_custom: ch.label_custom ?? ch.label?.custom ?? null,
      is_preferred: !!(ch.is_preferred ?? ch.is_primary),
      notes: ch.notes ?? null,
      verified_at: ch.verified_at ?? null,
      created_at: ch.created_at ?? new Date().toISOString(),
      updated_at: ch.updated_at ?? new Date().toISOString(),
      export_state: ch.export_state ?? "Create",
    }));

    return adapted.sort(
      (a, b) => (sortWeight[a.type] ?? 99) - (sortWeight[b.type] ?? 99)
    );
  }, [hookChannels, contact]);

  return (
    <div className="w-full bg-plate dark:bg-dark-s1 rounded-2xl p-4 neumorphic-convex flex flex-col gap-3">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h4 className="text-lg font-bold text-gray-800 dark:text-dark-t1">{contact.full_name}</h4>
            {contact.contact_guard && (
              <span
                className={clsx(
                  "px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                  contact.contact_guard === "Principal"
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : contact.contact_guard === "Decisor"
                    ? "bg-amber-500/10 border-amber-500/40 text-amber-500"
                    : contact.contact_guard === "Secundário"
                    ? "bg-sky-500/10 border-sky-500/40 text-sky-500"
                    : "bg-gray-500/10 border-gray-500/30 text-gray-500"
                )}
                aria-label={`Papel do contato: ${contact.contact_guard}`}
              >
                {contact.contact_guard}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-dark-t2">{subtitle}</p>
        </div>
        <StatusDot active={!isInactive} />
      </div>

      {/* Linhas de canais (moldura leve + mesmo fundo do card) */}
      {channels.length > 0 && (
        <div className="flex flex-col gap-2">
          {channels.map((ch) => {
            const isEmail = ch.type === "email";
            const isLink = ch.type === "link";
            const label = getChannelLabel(ch.type, ch.value);
            const shown = isLink ? extractDomain(ch.value ?? "") ?? (ch.value ?? "") : (ch.value ?? "");
            const href = isEmail ? `mailto:${(ch.value ?? "").trim()}` : isLink ? ensureHttp(ch.value ?? "") : undefined;

            return (
              <div
                key={ch.id}
                className={clsx(
                  "w-full inline-flex items-center gap-2 text-sm leading-tight px-3 py-1.5 rounded-full",
                  "border",
                  "bg-plate dark:bg-dark-s1",
                  "border-dark-shadow/30 dark:border-dark-dark-shadow/30"
                )}
                role="listitem"
                aria-label={[
                  `Canal: ${label}`,
                  ch.label_custom ? `, Etiqueta: ${ch.label_custom}` : "",
                  ch.is_preferred ? `, Preferencial` : "",
                  shown ? `, Valor: ${shown}` : "",
                ]
                  .join("")
                  .trim()}
              >
                <span className="inline-flex items-center gap-1.5 text-gray-700 dark:text-dark-t1">
                  {getChannelIcon(ch.type)}
                  <span className="font-semibold">{label}:</span>
                </span>

                {shown && (isEmail || isLink) ? (
                  <a
                    href={href}
                    target={isLink ? "_blank" : undefined}
                    rel={isLink ? "noopener noreferrer" : undefined}
                    className="underline underline-offset-2 decoration-1 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-sm text-gray-700 dark:text-dark-t1"
                    title={isEmail ? "Abrir e-mail" : "Abrir link em nova aba"}
                  >
                    {shown}
                  </a>
                ) : (
                  <span className="text-gray-700 dark:text-dark-t1">{shown}</span>
                )}

                {/* Bolinha laranja: preferencial */}
                {ch.is_preferred && (
                  <span
                    className="inline-block h-2 w-2 rounded-full bg-orange-500"
                    title="Canal preferencial"
                    aria-label="Canal preferencial"
                  />
                )}

                {/* Etiqueta do canal */}
                {ch.label_custom && (
                  <span
                    className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/10 border border-slate-400/40 text-slate-600 dark:text-slate-300"
                    aria-label={`Etiqueta do canal: ${ch.label_custom}`}
                    title={ch.label_custom}
                  >
                    {ch.label_custom}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ContactMiniCard;

/*
-- ===================================================
-- Código: /src/components/catalogs/ContactCard.tsx
-- Versão: 4.5.0
-- Data/Hora: 2025-10-16 16:35 -03
-- Autor: FL / Eva (E.V.A.)
-- Objetivo: Card do contato com ações por ícones e indicador de preferência
--           do CANAL como bolinha laranja após o valor e antes das etiquetas.
-- Notas:
--   - Ordem das ações: [Editar] [Canais] [•status] [Excluir]
--   - Sem textos nos botões, somente ícones SVG.
--   - is_preferred -> bolinha laranja viva (#f97316 ~ orange-500)
-- Dependências: react, clsx, lucide-react, @/types/contact, @/types/channel
-- ===================================================
*/
import React from 'react';
import clsx from 'clsx';
import { Contact } from '@/types/contact';
import type { ContactChannel } from '@/types/channel';
import { Mail, Phone, MessageSquare, Link as LinkIcon, Tag, Trash2, Pencil } from 'lucide-react';

interface ContactCardProps {
  contact: Contact;
  onOpenChannels: (contactId: string) => void;  // obrigatório
  onDelete: (contactId: string) => void;
  onEditContact?: (contact: Contact) => void;   // opcional
}

/* ---------- helpers ---------- */
const sortWeight: Record<ContactChannel['type'], number> = {
  email: 1,
  phone: 2,
  messaging: 3,
  link: 4,
  other: 5,
};

const ensureHttp = (value: string): string => {
  if (!value) return '';
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
};

const extractDomain = (value: string): string | null => {
  if (!value) return null;
  const v = value.trim();
  try {
    const url = v.match(/^https?:\/\//i) ? v : `https://${v}`;
    const domain = new URL(url).hostname.replace(/^www\./i, '');
    return domain || null;
  } catch {
    const m = v.match(/([a-z0-9-]+\.)+[a-z]{2,}/i);
    return m ? m[0].replace(/^www\./i, '') : null;
  }
};

const getChannelLabel = (type: ContactChannel['type'], value: string): string => {
  switch (type) {
    case 'phone': {
      const digits = (value || '').replace(/\D/g, '');
      const isCell = digits.length >= 11 && digits.includes('9');
      return isCell ? 'Celular' : 'Fixo';
    }
    case 'messaging':
      return 'Mensageria';
    case 'link': {
      const lower = (value || '').toLowerCase();
      if (lower.includes('linkedin')) return 'LinkedIn';
      return 'Domínio';
    }
    case 'other':
      return 'Outros';
    case 'email':
    default:
      return 'E-mail';
  }
};

const getChannelIcon = (type: ContactChannel['type']) => {
  switch (type) {
    case 'email': return <Mail className="h-3.5 w-3.5" aria-hidden="true" />;
    case 'phone': return <Phone className="h-3.5 w-3.5" aria-hidden="true" />;
    case 'messaging': return <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />;
    case 'link': return <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />;
    default: return <Tag className="h-3.5 w-3.5" aria-hidden="true" />;
  }
};

const formatDisplayedValue = (type: ContactChannel['type'], value: string): string => {
  if (!value) return '';
  if (type === 'link') {
    const domain = extractDomain(value);
    return domain ?? value;
  }
  return value;
};

/* --------------------------- Component --------------------------- */

const ContactCard: React.FC<ContactCardProps> = ({ contact, onOpenChannels, onDelete, onEditContact }) => {
  const isInactive = contact.status === 'inactive';

  // Fonte única: a view já entrega contact.channels
  const channels = [...(contact.channels ?? [])].sort(
    (a, b) => (sortWeight[a.type] ?? 99) - (sortWeight[b.type] ?? 99)
  );

  const subtitle = [
    contact.position || 'Cargo não informado',
    contact.department ? `— ${contact.department}` : '',
  ].join(' ').trim();

  return (
    <div className="w-full bg-plate dark:bg-dark-s1 rounded-2xl p-4 neumorphic-convex flex flex-col gap-3">
      {/* Cabeçalho */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h4 className="text-lg font-bold text-gray-800 dark:text-dark-t1">{contact.full_name}</h4>
            {contact.contact_guard && (
              <span
                className={clsx(
                  'px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                  contact.contact_guard === 'Principal'
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : contact.contact_guard === 'Decisor'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-500'
                    : contact.contact_guard === 'Secundário'
                    ? 'bg-sky-500/10 border-sky-500/40 text-sky-500'
                    : 'bg-gray-500/10 border-gray-500/30 text-gray-500'
                )}
                aria-label={`Papel do contato: ${contact.contact_guard}`}
              >
                {contact.contact_guard}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-dark-t2">{subtitle}</p>
        </div>

        {/* Ações: [Editar] [Canais] [•status] [Excluir] */}
        <div className="flex items-center gap-1.5">
          {/* Editar */}
          {onEditContact && (
            <button
              onClick={() => onEditContact(contact)}
              className="p-2 rounded-full hover:bg-dark-shadow/60 focus:outline-none focus:ring-2 focus:ring-slate-400/60 transition"
              title="Editar contato"
              aria-label="Editar contato"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          {/* Canais */}
          <button
            onClick={() => onOpenChannels(contact.id)}
            className="p-2 rounded-full hover:bg-dark-shadow/60 focus:outline-none focus:ring-2 focus:ring-primary/60 transition"
            title="Abrir canais do contato"
            aria-label="Abrir canais do contato"
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Status: somente bolinha */}
          <div
            className={clsx(
              "h-2.5 w-2.5 rounded-full mx-1",
              isInactive ? 'bg-gray-400' : 'bg-green-500'
            )}
            title={isInactive ? 'Inativo' : 'Ativo'}
            aria-label={`Status do contato: ${isInactive ? 'Inativo' : 'Ativo'}`}
          />

          {/* Excluir */}
          <button
            onClick={() => onDelete(contact.id)}
            className="p-2 rounded-full hover:bg-dark-shadow/60 hover:text-red-500 focus:outline-none focus:ring-2 focus:ring-red-400/60 transition"
            aria-label="Excluir contato"
            title="Excluir contato"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Chips de canais */}
      {channels.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2" role="list" aria-label="Canais do contato">
          {channels.map((ch) => {
            const label = getChannelLabel(ch.type, ch.value ?? '');
            const icon = getChannelIcon(ch.type);
            const shown = formatDisplayedValue(ch.type, ch.value ?? '');
            const isEmail = ch.type === 'email';
            const isLink = ch.type === 'link';
            const href = isEmail ? `mailto:${(ch.value ?? '').trim()}` : isLink ? ensureHttp(ch.value ?? '') : '';
            const preferred = !!ch.is_preferred; // trata null como false

            const chipAria = [
              `Canal: ${label}`,
              ch.label_custom ? `, Etiqueta: ${ch.label_custom}` : '',
              preferred ? `, Preferencial` : '',
              shown ? `, Valor: ${shown}` : ''
            ].join('');

            return (
              <div
                key={ch.id}
                role="listitem"
                aria-label={chipAria}
                className={clsx(
                  "flex items-center gap-2 px-2.5 py-1 rounded-full text-xs border",
                  "bg-plate dark:bg-dark-s1 border-dark-shadow/30 dark:border-dark-dark-shadow/30"
                )}
                title={[
                  label,
                  ch.label_custom ? `· ${ch.label_custom}` : '',
                  preferred ? '· Preferencial' : '',
                ].join(' ').trim()}
              >
                <span className="inline-flex items-center gap-1">
                  {icon}
                  <span className="font-semibold text-gray-700 dark:text-dark-t1">{label}:</span>
                </span>

                {/* Valor (clicável quando e-mail ou link) */}
                {shown && (isEmail || isLink) ? (
                  <a
                    href={href}
                    target={isLink ? "_blank" : undefined}
                    rel={isLink ? "noopener noreferrer" : undefined}
                    className="underline underline-offset-2 decoration-1 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-sm text-gray-600 dark:text-dark-t1"
                    title={isEmail ? 'Abrir e-mail' : 'Abrir link em nova aba'}
                    aria-label={isEmail ? `Enviar e-mail para ${shown}` : `Abrir ${shown} em nova aba`}
                  >
                    {shown}
                  </a>
                ) : (
                  shown && <span className="text-gray-600 dark:text-dark-t1">{shown}</span>
                )}

                {/* Indicador de preferência do CANAL: bolinha laranja viva */}
                {preferred && (
                  <span
                    aria-label="Canal preferencial"
                    title="Canal preferencial"
                    className="inline-block h-2 w-2 rounded-full bg-orange-500"
                  />
                )}

                {/* Etiqueta do canal */}
                {ch.label_custom && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/10 border border-slate-400/40 text-slate-500" aria-label={`Etiqueta do canal: ${ch.label_custom}`}>
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

export default ContactCard;

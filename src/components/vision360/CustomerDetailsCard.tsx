/*
-- ===================================================
-- Código             : /src/components/vision360/CustomerDetailsCard.tsx
-- Versão (.v21)      : 1.2.1
-- Data/Hora          : 2025-12-03 10:40 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Exibir os detalhes consolidados de um cliente (Visão 360),
--                      com contatos (1 por linha) e seção de Notas (histórico).
-- Fluxo              : Vision360Page -> CustomerDetailsCard
-- Alterações (1.2.1) :
--   • Campo "Dono" passa a exibir owner_name (profiles.full_name)
--     com fallback para owner (UUID) caso não resolvido.
--   • Mantido layout; canais agora chegam via contacts.channels.
-- Alterações (1.2.0) :
--   • Inclusão de NotesSection (CRUD via companiesService/RPCs).
--   • Mantido layout de contatos: 1 card por linha (grid-cols-1).
-- Dependências        : react, lucide-react, clsx,
--                       @/types/vision360, @/types/contact,
--                       ./NotesSection
-- ===================================================
*/
import React, { useState } from 'react';
import { CustomerDetails } from '@/types/vision360';
import { Contact } from '@/types/contact';
import { CompanyNote } from '@/types/company';
import { Building, Mail, Phone, Globe, MapPin, User, Star } from 'lucide-react';
import clsx from 'clsx';
import NotesSection from './NotesSection';

// Helper para evitar valores nulos na UI
const InfoItem: React.FC<{ icon: React.ElementType; label?: string; value?: string | null; href?: string }> = ({ icon: Icon, label, value, href }) => {
  if (!value) return null;
  const content = (
    <span className="inline-flex items-center gap-2">
      <Icon className="h-4 w-4 text-gray-500 flex-shrink-0" />
      {label && <span className="font-medium">{label}:</span>}
      <span className="text-gray-700 dark:text-gray-300">{value}</span>
    </span>
  );
  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">{content}</a>;
  }
  return content;
};

const ContactCard: React.FC<{ contact: Contact }> = ({ contact }) => {
  const statusColor = contact.status === 'active' ? 'bg-green-500' : 'bg-gray-400';

  return (
    <div className="neumorphic-convex rounded-xl p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold text-lg text-gray-800 dark:text-white">{contact.full_name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">{contact.position || 'Cargo não informado'}</p>
          {contact.department && <p className="text-xs text-gray-500">{contact.department}</p>}
        </div>
        <div className="flex items-center gap-2">
          {contact.contact_guard && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-primary/10 text-primary">{contact.contact_guard}</span>
          )}
          <span title={`Status: ${contact.status}`} className={clsx('h-2.5 w-2.5 rounded-full', statusColor)} />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {contact.channels?.map(channel => (
          <InfoItem
            key={channel.id}
            icon={channel.type === 'email' ? Mail : Phone}
            value={channel.value}
            href={channel.type === 'email' ? `mailto:${channel.value}` : undefined}
          />
        ))}
      </div>
    </div>
  );
};

const CustomerDetailsCard: React.FC<{ details: CustomerDetails }> = ({ details }) => {
  const { contacts, ...company } = details;
  const companyId = (company as any).id as string | undefined;
  const initialNotes = (details as any).notes as CompanyNote[] | undefined;

  // Estado local para refletir mutações sem depender de refetch externo
  const [notesLocal, setNotesLocal] = useState<CompanyNote[]>(initialNotes ?? []);

  const fullAddress = [company.address_line, company.city, company.state, company.zip_code].filter(Boolean).join(', ');

  // Dono: usa owner_name (profiles.full_name) com fallback para owner (UUID) se não resolvido
  const ownerDisplay =
    ((company as any).owner_name as string | null | undefined) ??
    (company.owner as string | null | undefined) ??
    null;

  return (
    <div className="bg-plate dark:bg-plate-dark rounded-2xl p-6 neumorphic-convex space-y-6">
      {/* Dados da Empresa */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div className="flex items-center gap-3">
            <Building className="h-7 w-7 text-primary" />
            <div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{company.trade_name}</h2>
              {company.legal_name && <p className="text-sm text-gray-500">{company.legal_name}</p>}
            </div>
          </div>
          {company.qualification && company.qualification > 0 && (
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={clsx(
                    'h-5 w-5',
                    i < company.qualification! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'
                  )}
                />
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <InfoItem icon={Phone} label="Telefone" value={company.phone ?? null} />
          <InfoItem icon={Mail} label="E-mail" value={company.email ?? null} href={company.email ? `mailto:${company.email}` : undefined} />
          <InfoItem
            icon={Globe}
            label="Website"
            value={company.website ?? null}
            href={company.website ? (company.website.startsWith('http') ? company.website : `https://${company.website}`) : undefined}
          />
          <InfoItem icon={MapPin} label="Endereço" value={fullAddress || null} />
          <InfoItem icon={User} label="CNPJ" value={company.tax_id ?? null} />
          <InfoItem icon={User} label="Dono" value={ownerDisplay} />
        </div>
      </section>

      <div className="border-t border-dark-shadow dark:border-dark-dark-shadow"></div>

      {/* Contatos */}
      <section>
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Contatos</h3>
        {contacts && contacts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {contacts.map(contact => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-6">
            Nenhum contato cadastrado para esta empresa.
          </div>
        )}
      </section>

      <div className="border-t border-dark-shadow dark:border-dark-dark-shadow"></div>

      {/* Notas (Histórico) */}
      <NotesSection
        companyId={companyId ?? ''}
        notes={notesLocal}
        onNotesChange={setNotesLocal}
      />
    </div>
  );
};

export default CustomerDetailsCard;

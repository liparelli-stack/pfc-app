/*
-- ===================================================
-- Código: /src/components/cockpit/CompanyDetailsCard.tsx
-- Versão: 1.8.0
-- Data/Hora: 2025-10-17 16:40 America/Sao_Paulo
-- Autor: E.V.A. (derivado do original de Dualite Alpha, ajustes por FL)
-- Objetivo: Alinhar ícones de telefone/e-mail e destacar bolinha laranja (preferencial) levemente para fora.
-- Fluxo: Renderizado pela CockpitPage.
-- Dependências: React, lucide-react, @/types/cockpit, clsx
-- Notas:
--   - Layout VISUAL inalterado (mesma estrutura de colunas/linhas).
--   - Apenas refinamento de conteúdo/comportamento e microposicionamento interno.
-- ===================================================
*/

import React from 'react';
import { CompanyDetails, ContactWithChannels } from '@/types/cockpit';
import { Building, Mail, Phone, Globe, Star, MapPin, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

interface CompanyDetailsCardProps {
  companyDetails: CompanyDetails;
}

/* =========================== */
/* Helpers */
/* =========================== */
function norm(s?: string | null) { return (s ?? '').trim(); }
function uniq(arr: string[]) { return Array.from(new Set(arr.filter(Boolean))); }

function statusDot(status?: string | null) {
  const isActive = norm(status).toLowerCase() === 'active';
  const label = isActive ? 'Ativo' : 'Inativo';
  return (
    <span
      title={label}
      className={clsx(
        'inline-block h-2.5 w-2.5 rounded-full',
        isActive ? 'bg-green-500' : 'bg-gray-400'
      )}
    />
  );
}

/** Mantém apenas canais válidos (phone/email), removendo URLs e redes sociais */
function collectChannels(channels: ContactWithChannels['channels'] | undefined, type: 'phone' | 'email') {
  if (!channels || !Array.isArray(channels) || channels.length === 0) return [];
  const blockedPatterns = /(https?:\/\/|www\.|linkedin\.com|instagram\.com|facebook\.com|t\.me|x\.com|wa\.me)/i;

  return channels
    .filter(ch => norm(ch?.type).toLowerCase() === type)
    .filter(ch => ch?.value && !blockedPatterns.test(ch.value))
    .map(ch => ({
      value: norm(ch?.value),
      label: norm(ch?.label_custom),
      isPreferred: !!ch?.is_preferred,
    }));
}

/** Ponto laranja preferencial — com espaçador quando não preferencial para manter alinhamento */
const PreferredDot: React.FC<{ show: boolean }> = ({ show }) => (
  <span
    title={show ? 'Canal preferencial' : undefined}
    className={clsx(
      'inline-block h-2 w-2 rounded-full mr-1 -ml-2', // leve saída à esquerda
      show ? 'bg-orange-400' : 'bg-transparent'
    )}
  />
);

/* =========================== */
/* COMPONENTE PRINCIPAL */
/* =========================== */
const CompanyDetailsCard: React.FC<CompanyDetailsCardProps> = ({ companyDetails }) => {
  const {
    trade_name,
    legal_name,
    tax_id,
    email,
    phone,
    website,
    qualification,
    address_line,
    city,
    state,
    zip_code,
    contacts,
  } = companyDetails;

  const fullAddress = [address_line, city, state, zip_code].filter(Boolean).join(', ');

  return (
    <section className="bg-plate dark:bg-dark-s1 rounded-2xl p-6 neumorphic-convex">
      {/* ======================= */}
      {/* Cabeçalho Empresa */}
      {/* ======================= */}
      <header className="space-y-2 mb-6">
        {/* Linha 1: Nome + link + estrelas */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex items-center min-w-0">
            <Building className="h-6 w-6 mr-3 text-primary flex-shrink-0" />
            <h3 className="text-2xl font-bold text-gray-800 dark:text-dark-t1 truncate" title={trade_name}>
              {trade_name}
            </h3>
            {website && (
              <a
                className="ml-3 inline-flex items-center text-sm underline underline-offset-4 hover:opacity-80"
                href={website.startsWith('http') ? website : `https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir website"
              >
                {website}
                <ExternalLink className="h-4 w-4 ml-1" />
              </a>
            )}
          </div>

          {qualification && qualification > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={clsx('h-5 w-5', i < qualification ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-dark-t3')}
                />
              ))}
            </div>
          )}
        </div>

        {/* Linha 1.1: Razão social */}
        {legal_name && <p className="text-gray-500 dark:text-dark-t2">{legal_name}</p>}

        {/* Linha 2: Telefone + Email */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-800 dark:text-dark-t1">
          {phone && (
            <span className="inline-flex items-center">
              <Phone className="h-4 w-4 mr-1.5" />
              {phone}
            </span>
          )}
          {email && (
            <span className="inline-flex items-center">
              <Mail className="h-4 w-4 mr-1.5" />
              {email}
            </span>
          )}
        </div>

        {/* Linha 3: Endereço + CNPJ */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-700 dark:text-dark-t1">
          {fullAddress && (
            <span className="inline-flex items-center">
              <MapPin className="h-4 w-4 mr-1.5" />
              {fullAddress}
            </span>
          )}
          {tax_id && (
            <span className="inline-flex items-center">
              <MapPin className="h-4 w-4 mr-1.5" />
              CNPJ {tax_id}
            </span>
          )}
        </div>
      </header>

      {/* ======================= */}
      {/* Tabela Contatos (layout mantido) */}
      {/* ======================= */}
      <div className="rounded-xl p-4 neumorphic-convex">
        <h4 className="text-lg font-bold mb-3 text-gray-800 dark:text-dark-t1">Contatos</h4>

        {contacts && contacts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-dark-t2 border-b border-gray-200/60 dark:border-white/10/60">
                  <th className="py-2 pr-3 font-semibold">Nome</th>
                  <th className="py-2 px-3 font-semibold">Cargo</th>
                  <th className="py-2 px-3 font-semibold">Departamento</th>
                  <th className="py-2 px-3 font-semibold">Telefones / Emails</th>
                  {/* Cabeçalho de Status removido (mantém coluna vazia) */}
                  <th className="py-2 pl-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {(contacts as ContactWithChannels[]).map((c) => {
                  const name = norm((c as any).full_name);
                  const position = norm((c as any).position) || '—';
                  const department = norm((c as any).department) || '—';
                  const phones = collectChannels(c.channels, 'phone');
                  const emails = collectChannels(c.channels, 'email');

                  return (
                    <tr
                      key={c.id}
                      className="border-b border-gray-200/60 dark:border-white/10/60 hover:bg-black/5 dark:hover:bg:white/5 transition-colors"
                    >
                      <td className="py-2 pr-3">
                        <div className="font-medium text-gray-900 dark:text-dark-t1">{name || '—'}</div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="text-gray-700 dark:text-dark-t1">{position}</div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="text-gray-700 dark:text-dark-t1">{department}</div>
                      </td>

                      <td className="py-2 px-3">
                        <div className="flex flex-col gap-1">
                          {/* Telefones */}
                          {phones.map((p, idx) => (
                            <div key={`p-${idx}`} className="inline-flex items-center">
                              {/* Bolinha laranja: mesma largura sempre → alinhamento estável */}
                              <PreferredDot show={p.isPreferred} />
                              <Phone className="h-4 w-4 mr-1.5" />
                              <span className="truncate">
                                {p.value}
                                {p.label && <span className="ml-1 text-gray-500">– {p.label}</span>}
                              </span>
                            </div>
                          ))}

                          {/* Emails */}
                          {emails.map((e, idx) => (
                            <div key={`e-${idx}`} className="inline-flex items-center">
                              <PreferredDot show={e.isPreferred} />
                              <Mail className="h-4 w-4 mr-1.5" />
                              <span className="truncate">
                                {e.value}
                                {e.label && <span className="ml-1 text-gray-500">– {e.label}</span>}
                              </span>
                            </div>
                          ))}

                          {phones.length === 0 && emails.length === 0 && <span>—</span>}
                        </div>
                      </td>

                      <td className="py-2 pl-3">{statusDot((c as any).status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center text-gray-500 dark:text-dark-t2 py-6">
            Nenhum contato cadastrado para esta empresa.
          </div>
        )}
      </div>
    </section>
  );
};

export default CompanyDetailsCard;

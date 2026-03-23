/*
-- ===================================================
-- Código             : /src/components/agendaX/CompanyProfileCardFull.tsx
-- Versão (.v21)      : 1.4.5
-- Data/Hora          : 2025-12-17 10:20 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Card de dossiê da empresa (somente leitura) consumindo agendaXBridge.getCompanyFull().
--                      Nesta etapa: remover a seção "Contatos" do card (instável) sem
--                      alterar cabeçalho, notas e layout principal.
-- Fluxo              : DayContextPanel/AgendaXPage → CompanyProfileCardFull
-- Alterações (1.4.5) :
--   • [UX] Removida a seção "Contatos" do card (temporariamente) conforme decisão de produto.
--   • [SAFE] Mantido aviso de erro e toda a área de Notas intacta.
-- ===================================================
*/

import { useEffect, useMemo, useState } from 'react';
import { Star, Phone, Mail, Globe, StickyNote } from 'lucide-react';
import { getCompanyFull, AXCompanyFull } from '@/services/agendaXBridge';

interface CompanyProfileCardFullProps {
  companyId: string;
  countsToday?: number;
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-sm font-semibold text-primary mb-2">{children}</h4>
);

const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary mr-2 mb-1">
    {children}
  </span>
);

const QualificationBadge = ({ value }: { value?: number | null }) => {
  if (typeof value !== 'number') return null;
  const v = Math.max(0, Math.min(5, Math.floor(value)));
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-700">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={12} className={`inline-block ${i < v ? 'fill-current' : ''}`} color="currentColor" />
      ))}
    </span>
  );
};

const LegalAndCnpjInline = ({ legalName, taxId }: { legalName?: string | null; taxId?: string | null }) => {
  if (!legalName && !taxId) return null;
  return (
    <div className="mt-1 text-[12px] text-gray-700 dark:text-dark-t1 flex items-baseline justify-between gap-6">
      <span className="font-medium">{legalName ?? '—'}</span>
      <span>
        <span className="text-gray-500 dark:text-dark-t2">CNPJ/CPF: </span>
        <span className="font-medium">{taxId ?? '—'}</span>
      </span>
    </div>
  );
};

const AddressInlineRow = ({
  address,
  city,
  state,
  zip,
}: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}) => {
  if (!address && !city && !state && !zip) return null;
  return (
    <div className="mt-1 text-sm text-gray-700 dark:text-dark-t1 flex flex-wrap items-center gap-x-6">
      {address && (
        <span>
          <span className="text-gray-500 dark:text-dark-t2">Endereço: </span>
          {address.trim()}
        </span>
      )}
      {city && (
        <span>
          <span className="text-gray-500 dark:text-dark-t2">Cidade: </span>
          {city}
        </span>
      )}
      {state && (
        <span>
          <span className="text-gray-500 dark:text-dark-t2">UF: </span>
          {state}
        </span>
      )}
      {zip && (
        <span>
          <span className="text-gray-500 dark:text-dark-t2">CEP: </span>
          {zip}
        </span>
      )}
    </div>
  );
};

const GeneralContactsInlineRow = ({
  phone,
  email,
  website,
}: {
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}) => {
  if (!phone && !email && !website) return null;
  const normalizedWebsite =
    website && website.trim() ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : null;
  return (
    <div className="mt-1 text-sm text-gray-700 dark:text-dark-t1 flex flex-wrap items-center gap-x-6">
      {phone && (
        <span className="inline-flex items-center gap-1">
          <Phone size={14} />
          <a href={`tel:${phone}`} className="underline hover:no-underline">
            {phone}
          </a>
        </span>
      )}
      {email && (
        <span className="inline-flex items-center gap-1">
          <Mail size={14} />
          <a href={`mailto:${email}`} className="underline hover:no-underline">
            {email}
          </a>
        </span>
      )}
      {normalizedWebsite && (
        <span className="inline-flex items-center gap-1">
          <Globe size={14} />
          <a href={normalizedWebsite} target="_blank" rel="noreferrer" className="underline hover:no-underline">
            {website}
          </a>
        </span>
      )}
    </div>
  );
};

/* --------------------------- */
/* Normalização de notas       */
/* --------------------------- */
type NormalizedNote = { data?: string; assunto?: string; nota: string };

function normalizeNotes(raw: unknown): NormalizedNote[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return { nota: item.trim() };
      if (item && typeof item === 'object') {
        const o = item as any;
        const nota = typeof o.nota === 'string' && o.nota.trim().length > 0 ? o.nota.trim() : JSON.stringify(o);
        const data = typeof o.data === 'string' ? o.data : undefined;
        const assunto = typeof o.assunto === 'string' ? o.assunto : undefined;
        return { data, assunto, nota };
      }
      return null;
    })
    .filter(Boolean) as NormalizedNote[];
}

function sortNotesDescByDate(notes: NormalizedNote[]): NormalizedNote[] {
  return [...notes].sort((a, b) => {
    const da = a.data ? Date.parse(a.data) : NaN;
    const db = b.data ? Date.parse(b.data) : NaN;
    if (isNaN(da) && isNaN(db)) return 0;
    if (isNaN(da)) return 1;
    if (isNaN(db)) return -1;
    return db - da;
  });
}

export default function CompanyProfileCardFull({ companyId }: CompanyProfileCardFullProps) {
  const [data, setData] = useState<AXCompanyFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);

    Promise.resolve(getCompanyFull(companyId))
      .then((res) => {
        if (!alive) return;
        setData(res);
      })
      .catch(() => {
        if (!alive) return;
        setData(null);
        setLoadError('Falha ao carregar dados desta empresa.');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [companyId]);

  const company = data?.company;

  const notesRaw = useMemo(() => {
    const raw = (company as any)?.notes;
    try {
      if (!raw) return [];
      if (typeof raw === 'string') return JSON.parse(raw);
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }, [company]);

  const notesNormalized = useMemo(() => sortNotesDescByDate(normalizeNotes(notesRaw)), [notesRaw]);
  const notesCount = notesNormalized.length;
  const [showNotes, setShowNotes] = useState(false);

  return (
    <div className="bg-plate dark:bg-dark-s1 p-4 rounded-2xl neumorphic-convex mb-4">
      {/* Cabeçalho e dados principais — NÃO ALTERADOS */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-base font-semibold">{company?.trade_name || 'Empresa'}</h3>
          <LegalAndCnpjInline legalName={company?.legal_name} taxId={company?.tax_id} />
          <AddressInlineRow address={company?.address_line} city={company?.city} state={company?.state} zip={company?.zip_code} />
          <GeneralContactsInlineRow phone={company?.phone} email={company?.email} website={company?.website} />
        </div>
        <div className="text-right">
          {company?.status && <Badge>{company.status}</Badge>}
          {company?.segment && <Badge>{company.segment}</Badge>}
          <QualificationBadge value={company?.qualification ?? null} />
        </div>
      </div>

      {/* Aviso de erro (sem console) */}
      {!loading && loadError && (
        <div className="mb-2 rounded-xl border border-red-300/60 bg-red-50/70 dark:bg-red-900/20 dark:border-red-500/30 p-2 text-sm text-red-700 dark:text-red-200">
          {loadError}
        </div>
      )}

      {/* Contatos — REMOVIDO nesta etapa (instável / decisão de produto) */}
      {/* (mantemos o carregamento via getCompanyFull por enquanto; otimização vem depois) */}

      {/* ===== Botão “Notas (n)” alinhado à direita ===== */}
      <div className="mt-3">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowNotes((s) => !s)}
            aria-expanded={showNotes}
            aria-controls="company-notes-panel"
            className={[
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition',
              notesCount > 0
                ? 'bg-red-500/10 text-red-700 hover:bg-red-500/20'
                : 'bg-gray-500/10 text-gray-600 dark:text-dark-t1 hover:bg-gray-500/20',
            ].join(' ')}
            title={notesCount > 0 ? `Notas (${notesCount})` : 'Sem notas'}
          >
            <StickyNote size={16} />
            <span>Notas ({notesCount})</span>
          </button>
        </div>

        {showNotes && (
          <div
            id="company-notes-panel"
            className="mt-2 rounded-xl border border-gray-300/60 dark:border-white/10 bg-white/60 dark:bg-dark-s1/5 p-3"
          >
            <SectionTitle>Notas</SectionTitle>
            {notesCount === 0 ? (
              <div className="text-sm text-gray-500 italic">Nenhuma nota registrada.</div>
            ) : (
              <ul className="space-y-2">
                {notesNormalized.map((n, idx) => (
                  <li key={idx} className="rounded-lg bg-plate/60 dark:bg-dark-s1/5 p-2">
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12px] text-gray-600 dark:text-dark-t1">
                      {n.data && (
                        <span>
                          <span className="text-gray-500 dark:text-dark-t2">Data: </span>
                          {n.data}
                        </span>
                      )}
                      {n.assunto && (
                        <span>
                          <span className="text-gray-500 dark:text-dark-t2">Assunto: </span>
                          {n.assunto}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm whitespace-pre-wrap text-gray-800 dark:text-dark-t1">{n.nota}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { CompanyDetails, ContactWithChannels } from '@/types/cockpit';
import { Building, Mail, Phone, Globe, Star, MapPin, ExternalLink, Pencil, Plus, PhoneCall } from 'lucide-react';
import clsx from 'clsx';
import Modal from '@/components/ui/Modal';
import CockpitEditCompanyForm from './CockpitEditCompanyForm';
import CockpitEditContactForm from './CockpitEditContactForm';
import CockpitContactChannels from './CockpitContactChannels';
import type { Company } from '@/types/company';
import type { Contact } from '@/types/contact';
import type { ContactChannel } from '@/types/channel';

interface CompanyDetailsCardProps {
  companyDetails: CompanyDetails;
}

/* =========================== */
/* Helpers */
/* =========================== */
function norm(s?: string | null) { return (s ?? '').trim(); }

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

function collectChannels(channels: ContactWithChannels['channels'] | undefined, type: 'phone' | 'email') {
  if (!channels || !Array.isArray(channels) || channels.length === 0) return [];
  const blockedPatterns = /(https?:\/\/|www\.|linkedin\.com|instagram\.com|facebook\.com|t\.me|x\.com|wa\.me)/i;
  return channels
    .filter(ch => norm(ch?.type).toLowerCase() === type)
    .filter(ch => ch?.value && !blockedPatterns.test(ch.value))
    .map(ch => ({ value: norm(ch?.value), label: norm(ch?.label_custom), isPreferred: !!ch?.is_preferred }));
}

const PreferredDot: React.FC<{ show: boolean }> = ({ show }) => (
  <span
    title={show ? 'Canal preferencial' : undefined}
    className={clsx('inline-block h-2 w-2 rounded-full mr-1 -ml-2', show ? 'bg-orange-400' : 'bg-transparent')}
  />
);

const IconBtn: React.FC<{ onClick: () => void; title: string; children: React.ReactNode }> = ({ onClick, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-black/8 dark:hover:bg-white/10 text-gray-400 hover:text-gray-700 dark:hover:text-dark-t1 transition-colors flex-shrink-0"
  >
    {children}
  </button>
);

/* =========================== */
/* COMPONENTE PRINCIPAL */
/* =========================== */
const CompanyDetailsCard: React.FC<CompanyDetailsCardProps> = ({ companyDetails }) => {
  // Estado local — atualizado otimisticamente após saves
  const [data, setData] = useState<CompanyDetails>(companyDetails);

  useEffect(() => {
    setData(companyDetails);
  }, [companyDetails]);

  // Estado dos modais
  const [editingCompany, setEditingCompany] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [addingContact, setAddingContact] = useState(false);
  const [channelsContactId, setChannelsContactId] = useState<string | null>(null);

  // ---- Handlers de atualização local ----

  const handleCompanySaved = (updated: Company) => {
    setData((prev) => ({ ...prev, ...updated }));
    setEditingCompany(false);
  };

  const handleContactSaved = (saved: Contact) => {
    setData((prev) => {
      const exists = prev.contacts.some((c) => c.id === saved.id);
      if (exists) {
        return {
          ...prev,
          contacts: prev.contacts.map((c) =>
            c.id === saved.id ? { ...c, ...saved } : c
          ),
        };
      }
      // Novo contato: adiciona com channels vazio
      return {
        ...prev,
        contacts: [...prev.contacts, { ...saved, channels: [] } as ContactWithChannels],
      };
    });
    setEditingContactId(null);
    setAddingContact(false);
  };

  const handleChannelsUpdated = (contactId: string, channels: ContactChannel[]) => {
    setData((prev) => ({
      ...prev,
      contacts: prev.contacts.map((c) =>
        c.id === contactId ? { ...c, channels } : c
      ),
    }));
  };

  // ---- Derivações de display ----
  const {
    trade_name, legal_name, tax_id, email, phone, website,
    qualification, address_line, city, state, zip_code, contacts,
  } = data;

  const fullAddress = [address_line, city, state, zip_code].filter(Boolean).join(', ');
  const editingContact = editingContactId
    ? contacts.find((c) => c.id === editingContactId)
    : null;
  const channelsContact = channelsContactId
    ? contacts.find((c) => c.id === channelsContactId)
    : null;

  return (
    <section className="bg-plate dark:bg-dark-s1 rounded-2xl p-6 neumorphic-convex">
      {/* ======================= */}
      {/* Cabeçalho Empresa       */}
      {/* ======================= */}
      <header className="space-y-2 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex items-center min-w-0 gap-2">
            <Building className="h-6 w-6 text-primary flex-shrink-0" />
            <h3 className="text-2xl font-bold text-gray-800 dark:text-dark-t1 truncate" title={trade_name}>
              {trade_name}
            </h3>
            {website && (
              <a
                className="ml-1 inline-flex items-center text-sm underline underline-offset-4 hover:opacity-80"
                href={website.startsWith('http') ? website : `https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir website"
              >
                {website}
                <ExternalLink className="h-4 w-4 ml-1" />
              </a>
            )}
            <IconBtn onClick={() => setEditingCompany(true)} title="Editar empresa">
              <Pencil className="h-3.5 w-3.5" />
            </IconBtn>
          </div>

          {qualification && qualification > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={clsx('h-5 w-5', i < qualification ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-dark-t3')} />
              ))}
            </div>
          )}
        </div>

        {legal_name && <p className="text-gray-500 dark:text-dark-t2">{legal_name}</p>}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-800 dark:text-dark-t1">
          {phone && <span className="inline-flex items-center"><Phone className="h-4 w-4 mr-1.5" />{phone}</span>}
          {email && <span className="inline-flex items-center"><Mail className="h-4 w-4 mr-1.5" />{email}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-700 dark:text-dark-t1">
          {fullAddress && <span className="inline-flex items-center"><MapPin className="h-4 w-4 mr-1.5" />{fullAddress}</span>}
          {tax_id && <span className="inline-flex items-center"><MapPin className="h-4 w-4 mr-1.5" />CNPJ {tax_id}</span>}
        </div>
      </header>

      {/* ======================= */}
      {/* Tabela Contatos         */}
      {/* ======================= */}
      <div className="rounded-xl p-4 neumorphic-convex">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-lg font-bold text-gray-800 dark:text-dark-t1">Contatos</h4>
          <button
            type="button"
            onClick={() => setAddingContact(true)}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:opacity-80 font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar contato
          </button>
        </div>

        {contacts && contacts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-dark-t2 border-b border-gray-200/60 dark:border-white/10">
                  <th className="py-2 pr-3 font-semibold">Nome</th>
                  <th className="py-2 px-3 font-semibold">Cargo</th>
                  <th className="py-2 px-3 font-semibold">Departamento</th>
                  <th className="py-2 px-3 font-semibold">Telefones / Emails</th>
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
                    <tr key={c.id} className="border-b border-gray-200/60 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
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
                          {phones.map((p, idx) => (
                            <div key={`p-${idx}`} className="inline-flex items-center">
                              <PreferredDot show={p.isPreferred} />
                              <Phone className="h-4 w-4 mr-1.5" />
                              <span className="truncate">
                                {p.value}
                                {p.label && <span className="ml-1 text-gray-500">– {p.label}</span>}
                              </span>
                            </div>
                          ))}
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
                      <td className="py-2 pl-3">
                        <div className="flex items-center gap-1">
                          {statusDot((c as any).status)}
                          <IconBtn onClick={() => setEditingContactId(c.id)} title="Editar contato">
                            <Pencil className="h-3.5 w-3.5" />
                          </IconBtn>
                          <IconBtn onClick={() => setChannelsContactId(c.id)} title="Gerenciar canais">
                            <PhoneCall className="h-3.5 w-3.5" />
                          </IconBtn>
                        </div>
                      </td>
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

      {/* ======================= */}
      {/* Modais                  */}
      {/* ======================= */}

      {/* Editar empresa */}
      <Modal isOpen={editingCompany} onClose={() => setEditingCompany(false)} title="Editar Empresa" size="lg">
        <CockpitEditCompanyForm
          key={data.id}
          companyId={data.id}
          initialData={{
            trade_name: data.trade_name,
            tax_id: data.tax_id,
            phone: data.phone,
            email: data.email,
            website: data.website,
            address_line: data.address_line,
            city: data.city,
            state: data.state,
            zip_code: data.zip_code,
          }}
          onSaved={handleCompanySaved}
          onCancel={() => setEditingCompany(false)}
        />
      </Modal>

      {/* Editar contato */}
      <Modal
        isOpen={!!editingContactId && !!editingContact}
        onClose={() => setEditingContactId(null)}
        title="Editar Contato"
        size="lg"
      >
        {editingContact && (
          <CockpitEditContactForm
            companyId={data.id}
            contactId={editingContact.id}
            initialData={{
              full_name: (editingContact as any).full_name,
              position: (editingContact as any).position,
              department: (editingContact as any).department,
              contact_guard: (editingContact as any).contact_guard,
              status: (editingContact as any).status ?? 'active',
            }}
            onSaved={handleContactSaved}
            onCancel={() => setEditingContactId(null)}
          />
        )}
      </Modal>

      {/* Adicionar contato */}
      <Modal isOpen={addingContact} onClose={() => setAddingContact(false)} title="Novo Contato" size="lg">
        <CockpitEditContactForm
          companyId={data.id}
          onSaved={handleContactSaved}
          onCancel={() => setAddingContact(false)}
        />
      </Modal>

      {/* Gerenciar canais */}
      <Modal
        isOpen={!!channelsContactId && !!channelsContact}
        onClose={() => setChannelsContactId(null)}
        title={`Canais — ${norm((channelsContact as any)?.full_name)}`}
        size="lg"
      >
        {channelsContact && (
          <CockpitContactChannels
            contactId={channelsContact.id}
            currentChannels={channelsContact.channels ?? []}
            onChannelsUpdated={(channels) => handleChannelsUpdated(channelsContact.id, channels)}
          />
        )}
      </Modal>
    </section>
  );
};

export default CompanyDetailsCard;

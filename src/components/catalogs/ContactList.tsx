/*
-- ===================================================
-- Código: /src/components/catalogs/ContactList.tsx
-- Versão: 5.0.0
-- Data/Hora: 2025-10-19 10:00 -03
-- Autor: Dualite Alpha (AD)
-- Objetivo: [CORREÇÃO DEFINITIVA] Remover a propriedade `onLoad` e a lógica
--           associada para impedir a seleção automática do primeiro contato.
-- ===================================================
*/
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Contact } from '@/types/contact';
import * as contactsSvc from '@/services/contactsService';
import ContactCard from '@/components/catalogs/ContactCard';
import ContactChannelsModal from '@/components/catalogs/ContactChannelsModal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/contexts/ToastContext';
import ContactForm from './ContactForm';

function reconcileContacts(prev: Contact[], next: Contact[]): Contact[] {
  if (!prev || prev.length === 0) return next || [];
  const byIdPrev = new Map(prev.map((c) => [c.id, c]));
  return (next || []).map((n) => {
    const p = byIdPrev.get(n.id);
    if (!p) return n;
    let equal = true;
    for (const k in n) {
      // @ts-ignore
      if (p[k] !== (n as any)[k]) { equal = false; break; }
    }
    return equal ? p : { ...p, ...n };
  });
}

interface ContactListProps {
  companyId: string;
  onEdit: (contact: Contact) => void;
  onDelete: (contactId: string) => void;
  refreshKey: number;
  editingContactId: string | null;
  onContactSaved: (contact: Contact) => void;
  onCancel: () => void;
}

const ContactList: React.FC<ContactListProps> = ({
  companyId,
  onEdit,
  onDelete,
  refreshKey,
  editingContactId,
  onContactSaved,
  onCancel
}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [modalContactId, setModalContactId] = useState<string | null>(null);
  const { addToast } = useToast();

  const lastCompanyIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!companyId) return;

    let isMounted = true;

    const fetchAndSetContacts = async () => {
      const isInitialLoad = lastCompanyIdRef.current !== companyId;
      lastCompanyIdRef.current = companyId;

      if (isInitialLoad) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const data = await contactsSvc.listByCompany(companyId);
        if (isMounted) {
          setContacts(prev => isInitialLoad ? (data || []) : reconcileContacts(prev, data || []));
        }
      } catch (error) {
        if (isMounted) {
          addToast('Erro ao carregar contatos da empresa.', 'error');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    fetchAndSetContacts();

    return () => {
      isMounted = false;
    };
  }, [companyId, refreshKey, addToast]);

  const refreshOneContact = useCallback(
    async (contactId: string) => {
      const getById = (contactsSvc as any)?.getById;
      if (typeof getById === 'function') {
        try {
          const updated = (await getById(contactId)) as Contact | null;
          if (updated) {
            setContacts((prev) => prev.map((c) => (c.id === contactId ? reconcileContacts([c], [updated])[0] : c)));
            return true;
          }
        } catch { /* fallback */ }
      }
      setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c } : c)));
      return false;
    },
    []
  );

  const openChannels = useCallback((contactId: string) => {
    setModalContactId(contactId);
  }, []);

  const closeChannels = useCallback(async () => {
    const id = modalContactId;
    setModalContactId(null);
    if (id) await refreshOneContact(id);
  }, [modalContactId, refreshOneContact]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!contacts || contacts.length === 0) {
    return (
      <div className="w-full bg-plate dark:bg-plate-dark rounded-2xl p-6 neumorphic-convex flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Nenhum contato cadastrado para esta empresa.</p>
      </div>
    );
  }

  return (
    <>
      {isRefreshing && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 pl-1">Atualizando…</div>
      )}

      <div className="space-y-4">
        {contacts.map((contact) => (
          <div key={contact.id} className="neumorphic-convex rounded-2xl overflow-hidden transition-all duration-300">
            <div className={editingContactId === contact.id ? 'rounded-t-2xl' : 'rounded-2xl'}>
              <ContactCard
                contact={contact}
                onOpenChannels={openChannels}
                onDelete={onDelete}
                onEditContact={() => onEdit(contact)}
              />
            </div>
            {editingContactId === contact.id && (
              <div className="p-4 bg-dark-shadow/20 dark:bg-dark-dark-shadow/20">
                 <ContactForm
                    contact={contact}
                    onSaved={onContactSaved}
                    onCancel={onCancel}
                  />
              </div>
            )}
          </div>
        ))}
      </div>

      {modalContactId && (
        <ContactChannelsModal
          contactId={modalContactId}
          open={true}
          onClose={closeChannels}
        />
      )}
    </>
  );
};

export default ContactList;

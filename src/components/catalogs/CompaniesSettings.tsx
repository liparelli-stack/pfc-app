/*
-- ===================================================
-- Código                 : /src/components/catalogs/CompaniesSettings.tsx
-- Versão (.v20)          : 5.4.0
-- Data/Hora              : 2025-11-05 12:32 America/Sao_Paulo
-- Autor                  : FL / Execução via você EVA
-- Objetivo do codigo     : Endurecer UX contra overlays "fantasmas" (sugestões e modais) que bloqueiam cliques.
-- Fluxo                  : Busca → seleção → formulário/contatos
-- Alterações (5.4.0)     :
--   • [Fix] Suggestions: close-on-escape, close-on-blur e auto-hide onMouseLeave; clique fora fecha.
--   • [Safe] Container do input tem onKeyDown/ onBlur; *portal* não é necessário, mantida UI atual.
--   • [Compat] Sem mudanças de layout; apenas robustez contra ficar "aberto" invisível.
-- Dependências           : services/companiesService, listSimpleCompanies
-- ===================================================
*/
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Company } from '@/types/company';
import { Contact } from '@/types/contact';
import { listCompanies, getCompany, deleteCompany, listSimpleCompanies } from '@/services/companiesService';
import { deleteContact, createContact } from '@/services/contactsService';
import { useToast } from '@/contexts/ToastContext';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import CompanyForm from './CompanyForm';
import ContactList from './ContactList';
import ContactForm from './ContactForm';
import { Plus, Eraser } from 'lucide-react';

const CompaniesSettings: React.FC = () => {
  // Busca / filtros
  const [nameQuery, setNameQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');

  // Select por empresa (id único)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  const [allCompanyNames, setAllCompanyNames] = useState<Company[]>([]);
  const [suggestions, setSuggestions] = useState<Company[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Contatos
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [contactListRefreshKey, setContactListRefreshKey] = useState(0);

  // Modais
  const [isDeleteCompanyModalOpen, setIsDeleteCompanyModalOpen] = useState(false);
  const [isDeleteContactModalOpen, setIsDeleteContactModalOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);

  const { addToast } = useToast();
  const lastNotFoundTermRef = useRef<string | null>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);

  // Fechar sugestões ao clicar fora do bloco do input
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!inputWrapperRef.current) return;
      if (!inputWrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Carregar nomes para dropdown
  useEffect(() => {
    const fetchCompanyNames = async () => {
      try {
        const names = await listSimpleCompanies({ status: 'all' });
        setAllCompanyNames(names);
      } catch {
        addToast('Erro ao carregar lista de empresas.', 'error');
      }
    };
    fetchCompanyNames();
  }, [addToast]);

  useEffect(() => { setSelectedCompanyId(selectedCompany?.id ?? ''); }, [selectedCompany]);
  useEffect(() => { setEditingContactId(null); setIsAddingContact(false); }, [selectedCompany]);
  useEffect(() => { setSelectedCompany(null); setEditingContactId(null); setIsAddingContact(false); }, []);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    try {
      const { items } = await listCompanies({ q, status: 'all', limit: 8, offset: 0 });
      const list = Array.isArray(items) ? (items as Company[]) : [];
      setSuggestions(list);
      setShowSuggestions(list.length > 0);
    } catch {
      setSuggestions([]); setShowSuggestions(false);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!nameQuery && !selectedCompanyId) { handleClear(); return; }
    setIsLoading(true);
    try {
      const { items } = await listCompanies({ q: nameQuery, status: statusFilter });
      const list = Array.isArray(items) ? (items as Company[]) : [];
      if (list.length === 0) {
        if (lastNotFoundTermRef.current !== nameQuery) {
          addToast('Nenhuma empresa encontrada. Crie uma nova.', 'info');
          lastNotFoundTermRef.current = nameQuery;
        }
        setSelectedCompany(null); setSuggestions([]); setShowSuggestions(false);
      } else if (list.length === 1) {
        const full = await getCompany(list[0].id!);
        setSelectedCompany(full); setNameQuery(full?.trade_name || '');
        lastNotFoundTermRef.current = null; setSuggestions([]); setShowSuggestions(false);
      } else {
        setSuggestions(list); setShowSuggestions(true);
      }
    } catch {
      addToast('Erro ao buscar empresas.', 'error'); setSuggestions([]); setShowSuggestions(false);
    } finally { setIsLoading(false); }
  }, [nameQuery, selectedCompanyId, statusFilter, addToast]);

  const handleSelectSuggestion = useCallback(async (company: Company) => {
    setShowSuggestions(false); setIsLoading(true);
    try {
      const full = await getCompany(company.id!);
      setSelectedCompany(full);
      setNameQuery(full?.trade_name || '');
      setSelectedCompanyId(full?.id || '');
    } catch { addToast('Erro ao carregar dados da empresa.', 'error'); }
    finally { setIsLoading(false); }
  }, [addToast]);

  const handleSelectCompanyById = useCallback(async (id: string) => {
    setSelectedCompanyId(id);
    // Fechar sugestões ao trocar via select
    setSuggestions([]); setShowSuggestions(false);

    if (!id) { handleClear(); return; }
    setIsLoading(true);
    try {
      const full = await getCompany(id);
      setSelectedCompany(full);
      setNameQuery(full?.trade_name || '');
    } catch { addToast('Erro ao carregar dados da empresa.', 'error'); }
    finally { setIsLoading(false); }
  }, [addToast]);

  const handleClear = useCallback(() => {
    setNameQuery(''); setSelectedCompanyId(''); setSelectedCompany(null);
    setSuggestions([]); setShowSuggestions(false);
    lastNotFoundTermRef.current = null; setEditingContactId(null); setIsAddingContact(false);
  }, []);

  const handleSaveCompany = useCallback((saved: Company, wasCreating: boolean) => {
    addToast('Empresa salva com sucesso!', 'success');
    if (wasCreating) { handleClear(); } else { setSelectedCompany(saved); }
  }, [handleClear, addToast]);

  const handleDeleteCompanyRequest = useCallback(() => { if (selectedCompany) setIsDeleteCompanyModalOpen(true); }, [selectedCompany]);

  const handleDeleteCompanyConfirm = useCallback(async () => {
    if (!selectedCompany?.id) return;
    try { await deleteCompany(selectedCompany.id); addToast('Empresa excluída com sucesso.', 'success'); handleClear(); }
    catch { addToast('Erro ao excluir a empresa. Verifique se há contatos associados.', 'error'); }
    finally { setIsDeleteCompanyModalOpen(false); }
  }, [selectedCompany, addToast, handleClear]);

  const handleSaveContact = useCallback(() => { setEditingContactId(null); setContactListRefreshKey(prev => prev + 1); }, []);
  const handleCreateContact = useCallback(() => { setIsAddingContact(false); setContactListRefreshKey(prev => prev + 1); addToast('Contato criado com sucesso!', 'success'); }, [addToast]);
  const handleDeleteContactRequest = useCallback((contactId: string) => { setContactToDelete(contactId); setIsDeleteContactModalOpen(true); }, []);
  const handleDeleteContactConfirm = useCallback(async () => {
    if (!contactToDelete) return;
    try { await deleteContact(contactToDelete); addToast('Contato excluído com sucesso!', 'success'); setContactListRefreshKey(prev => prev + 1); setEditingContactId(null); }
    catch { addToast('Erro ao excluir o contato.', 'error'); }
    finally { setIsDeleteContactModalOpen(false); setContactToDelete(null); }
  }, [contactToDelete, addToast]);

  const shouldShowContactSection = !!selectedCompany;

  // 🔒 Fechamento robusto do suggestions
  const hideSuggestions = () => { setShowSuggestions(false); };

  return (
    <>
      <div className="bg-plate dark:bg-dark-s1 rounded-2xl shadow-inner p-4 sm:p-8 space-y-6">
        {/* Busca / filtros */}
        <section className="neumorphic-convex rounded-2xl p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
            {/* Select por empresa */}
            <div className="lg:col-span-4">
              <Select
                label="Empresa (por nome)"
                value={selectedCompanyId}
                onChange={(e) => handleSelectCompanyById(e.target.value)}
              >
                <option value="">Todas</option>
                {allCompanyNames.map((c) => (
                  <option key={c.id} value={c.id!}>{c.trade_name}</option>
                ))}
              </Select>
            </div>

            {/* Input parcial + suggestions robusto */}
            <div
              ref={inputWrapperRef}
              className="relative lg:col-span-4"
              onKeyDown={(e) => {
                if (e.key === 'Escape') hideSuggestions();
                if (e.key === 'Enter') handleSearch();
              }}
              onBlur={(e) => {
                // se o foco saiu do wrapper inteiro, fechamos
                if (!e.currentTarget.contains(e.relatedTarget as Node)) hideSuggestions();
              }}
            >
              <Input
                label="Buscar ou Incluir Empresa"
                placeholder="Digite parte do nome..."
                value={nameQuery}
                onChange={(e) => { setNameQuery(e.target.value); fetchSuggestions(e.target.value); }}
              />

              {showSuggestions && Array.isArray(suggestions) && (
                <div
                  className="absolute z-20 w-full mt-1 bg-plate dark:bg-dark-s1 rounded-lg neumorphic-convex shadow-lg max-h-60 overflow-y-auto"
                  onMouseLeave={hideSuggestions}
                >
                  {suggestions.map((company) => (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => handleSelectSuggestion(company)}
                      className="w-full text-left p-3 cursor-pointer hover:bg-dark-shadow dark:hover:bg-dark-dark-shadow rounded-md"
                    >
                      <p className="font-semibold">{company.trade_name}</p>
                      <p className="text-sm text-gray-500">{company.legal_name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Status */}
            <div className="lg:col-span-2">
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="active">Ativas</option>
                <option value="inactive">Inativas</option>
                <option value="all">Todas</option>
              </Select>
            </div>

            {/* Ações */}
            <div className="lg:col-span-2 flex items-center">
              <Button onClick={handleClear} variant="default" className="h-11 w-full" title="Limpar Filtros">
                <Eraser className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </section>

        {/* Contatos */}
        {shouldShowContactSection && (
          <section className="space-y-4">
            <div className="flex justify-between items-center border-b border-dark-shadow dark:border-dark-dark-shadow pb-2">
              <h3 className="text-lg font-bold text-gray-800 dark:text-dark-t1">Contatos</h3>
              <Button onClick={() => setIsAddingContact(true)} disabled={isAddingContact} variant="default" className="!py-2 !px-4">
                <Plus className="h-4 w-4 mr-2" /> Adicionar Contato
              </Button>
            </div>

            {isAddingContact && (
              <div className="p-4 bg-dark-shadow/20 dark:bg-dark-dark-shadow/20 rounded-2xl">
                <ContactForm
                  contact={null}
                  companyId={selectedCompany!.id!}
                  tenantId={selectedCompany!.tenant_id!}
                  onSaved={() => { setIsAddingContact(false); setContactListRefreshKey(k => k + 1); addToast('Contato criado com sucesso!', 'success'); }}
                  onCancel={() => setIsAddingContact(false)}
                />
              </div>
            )}

            <ContactList
              companyId={selectedCompany!.id!}
              onEdit={(contact) => { setIsAddingContact(false); setEditingContactId(contact.id); }}
              onDelete={(id) => { setContactToDelete(id); setIsDeleteContactModalOpen(true); }}
              refreshKey={contactListRefreshKey}
              editingContactId={editingContactId}
              onContactSaved={() => { setEditingContactId(null); setContactListRefreshKey(k => k + 1); }}
              onCancel={() => setEditingContactId(null)}
            />
          </section>
        )}

        {/* CompanyForm */}
        <section className="neumorphic-convex rounded-2xl p-4 sm:p-6">
          <CompanyForm
            key={selectedCompany?.id ?? 'new-company'}
            initialData={selectedCompany}
            onSave={handleSaveCompany}
            onDelete={() => setIsDeleteCompanyModalOpen(true)}
            onClear={handleClear}
          />
        </section>
      </div>

      {/* Modais */}
      <Modal
        isOpen={isDeleteCompanyModalOpen}
        onClose={() => setIsDeleteCompanyModalOpen(false)}
        title="Confirmar Exclusão de Empresa"
      >
        <p className="mb-6">
          Tem certeza que deseja excluir a empresa <strong>{selectedCompany?.trade_name}</strong>?
          Esta ação não pode ser desfeita e pode falhar se houver contatos vinculados.
        </p>
        <div className="flex justify-end gap-4">
          <Button onClick={() => setIsDeleteCompanyModalOpen(false)} variant="default">Cancelar</Button>
          <Button onClick={handleDeleteCompanyConfirm} variant="danger">Excluir Empresa</Button>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteContactModalOpen}
        onClose={() => setIsDeleteContactModalOpen(false)}
        title="Confirmar Exclusão de Contato"
      >
        <p className="mb-6">Tem certeza que deseja excluir este contato? Esta ação não pode ser desfeita.</p>
        <div className="flex justify-end gap-4">
          <Button onClick={() => setIsDeleteContactModalOpen(false)} variant="default">Cancelar</Button>
          <Button onClick={handleDeleteContactConfirm} variant="danger">Excluir Contato</Button>
        </div>
      </Modal>
    </>
  );
};

export default CompaniesSettings;

/*
-- ===================================================
-- Código             : /src/pages/CockpitPage.tsx
-- Versão (.v20)      : 3.6.0
-- Data/Hora          : 2025-11-10 22:16 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do código : Habilitar rolagem no dropdown e comportar mais itens visíveis.
--                      Mantém tipografia 12 px (text-xs) e diferenciação visual no tema escuro.
-- Alterações (3.6.0) :
--   • [UI] Dropdown com altura máxima e overflow-y-auto (barra de rolagem).
--   • [UI] Itens com padding vertical ligeiramente reduzido (py-1.5) para caber mais por tela.
--   • [A11Y] Mantido combobox/listbox, navegação por teclado e highlight.
-- Dependências        : @/components/vision360/NotesSection, @/services/cockpitService, clsx, lucide-react
-- ===================================================
*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, X as XIcon, Search as SearchIcon } from 'lucide-react';
import {
  listCompaniesWithActiveActions,
  getCompanyDetails,
  searchCompaniesByName,
} from '@/services/cockpitService';
import { useAuth } from '@/contexts/AuthContext';
import { CompanyWithActionCount, CompanyDetails, CompanyMinimal } from '@/types/cockpit';
import CompanyDetailsCard from '@/components/cockpit/CompanyDetailsCard';
import RegisterActionCard from '@/components/cockpit/RegisterActionCard';
import ConversationHistoryCard from '@/components/cockpit/ConversationHistoryCard';
import NotesSection from '@/components/vision360/NotesSection';
import { Skeleton } from '@/components/ui/Skeleton';
import EmpresasAgrupadasList from '@/components/cockpit/EmpresasAgrupadasList';
import clsx from 'clsx';
import { onChatChanged } from '@/lib/events';


type EditingChat = Partial<{ id: string; kind: string; channel_type: string }>;
const SWITCH_THROTTLE_MS = 300;

const CockpitPage: React.FC = () => {
  const { currentProfileLite } = useAuth();
  const tenantId = currentProfileLite?.tenantId ?? null;

  // Estados principais
  const [companies, setCompanies] = useState<CompanyWithActionCount[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompanyDetails, setSelectedCompanyDetails] = useState<CompanyDetails | null>(null);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Cache/controles
  const companyCache = useRef<Record<string, CompanyDetails>>({});
  const inflight = useRef<Record<string, Promise<void>>>({});
  const activeFetchId = useRef<number>(0);
  const lastSwitchAt = useRef<number>(0);
  const switchTimer = useRef<number | null>(null);

  // Busca (type-ahead por nome)
  const [searchText, setSearchText] = useState<string>('');
  const [searchResults, setSearchResults] = useState<CompanyMinimal[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const debounceRef = useRef<number | undefined>(undefined);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = 'company-search-listbox';

  // Load inicial
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        setIsLoadingCompanies(true);
        const data = await listCompaniesWithActiveActions();
        setCompanies(data);
        if (data.length > 0 && !selectedCompanyId) setSelectedCompanyId(data[0].id);
      } catch (error) {
        console.error('Erro ao carregar empresas para o cockpit:', error);
      } finally {
        setIsLoadingCompanies(false);
      }
    };
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helpers
  const reloadCompanies = useCallback(async () => {
    try {
      const data = await listCompaniesWithActiveActions();
      setCompanies(data);
    } catch {}
  }, []);

  const reloadDetailsIfActive = useCallback(
    async (companyId?: string | null) => {
      const id = companyId ?? selectedCompanyId;
      if (!id) return;
      const hasCache = !!companyCache.current[id];
      setIsLoadingDetails(!hasCache);
      if (hasCache) setSelectedCompanyDetails(companyCache.current[id]);
      const fetchId = ++activeFetchId.current;
      try {
        const data = await getCompanyDetails(id);
        if (fetchId !== activeFetchId.current) return;
        setSelectedCompanyDetails(data);
        companyCache.current[id] = data;
      } finally {
        if (fetchId === activeFetchId.current) setIsLoadingDetails(false);
      }
    },
    [selectedCompanyId]
  );

  const prefetchCompanyDetails = useCallback(async (id: string) => {
    if (!id || companyCache.current[id] || inflight.current[id]) return;
    inflight.current[id] = (async () => {
      try {
        const data = await getCompanyDetails(id);
        companyCache.current[id] = data;
      } finally {
        delete inflight.current[id];
      }
    })();
    await inflight.current[id];
  }, []);

  const throttleSelect = useCallback((id: string) => {
    const now = Date.now();
    const elapsed = now - lastSwitchAt.current;
    if (switchTimer.current) {
      clearTimeout(switchTimer.current);
      switchTimer.current = null;
    }
    const doSelect = () => {
      lastSwitchAt.current = Date.now();
      setSelectedCompanyId(id);
    };
    if (elapsed < SWITCH_THROTTLE_MS) {
      switchTimer.current = window.setTimeout(doSelect, SWITCH_THROTTLE_MS - elapsed);
    } else {
      doSelect();
    }
  }, []);

  // Reagir à seleção
  useEffect(() => {
    if (!selectedCompanyId) {
      setSelectedCompanyDetails(null);
      return;
    }
    reloadDetailsIfActive(selectedCompanyId);
  }, [selectedCompanyId, reloadDetailsIfActive]);

  // Debounce busca por nome (type-ahead)
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const trimmed = searchText.trim();
    if (trimmed.length < 2) {
      setSearchResults([]); setIsSearching(false); setActiveIndex(-1); return;
    }
    setIsSearching(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        if (!tenantId) { setSearchResults([]); setIsSearching(false); return; }
        const results = await searchCompaniesByName(trimmed, tenantId);
        setSearchResults(results);
        setActiveIndex(results.length ? 0 : -1);
      } finally {
        setIsSearching(false);
      }
    }, 280);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
  }, [searchText]);

  // Click fora fecha dropdown
  useEffect(() => {
    const handleClickOutside = (ev: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(ev.target as Node)) {
        setSearchResults([]); setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Atualizações vindas de eventos globais
  useEffect(() => {
    const handler = () => {
      requestAnimationFrame(async () => { await reloadCompanies(); await reloadDetailsIfActive(); });
    };
    window.addEventListener('cockpit:refreshHistory', handler);
    window.addEventListener('chats:changed', handler);
    const off = onChatChanged ? onChatChanged(async (ev) => {
      requestAnimationFrame(async () => {
        await reloadCompanies();
        if (selectedCompanyId && ev.companyId === selectedCompanyId) await reloadDetailsIfActive(ev.companyId);
      });
    }) : () => {};
    return () => {
      window.removeEventListener('cockpit:refreshHistory', handler);
      window.removeEventListener('chats:changed', handler);
      off();
    };
  }, [reloadCompanies, reloadDetailsIfActive, selectedCompanyId]);

  // === Notas: manter paridade de UX ===
  const handleNotesChange = useCallback(async (updatedNotes: any[]) => {
    setSelectedCompanyDetails((prev) => prev ? { ...prev, notes: updatedNotes as any } : prev);
    if (selectedCompanyId && companyCache.current[selectedCompanyId]) {
      companyCache.current[selectedCompanyId] = {
        ...companyCache.current[selectedCompanyId],
        notes: updatedNotes as any,
      } as CompanyDetails;
    }
    await Promise.allSettled([reloadDetailsIfActive(selectedCompanyId), reloadCompanies()]);
  }, [reloadCompanies, reloadDetailsIfActive, selectedCompanyId]);

  const selectResultAt = (idx: number) => {
    if (idx < 0 || idx >= searchResults.length) return;
    const item = searchResults[idx];
    throttleSelect(item.id);
    setSearchText(''); setSearchResults([]); setActiveIndex(-1);
    searchInputRef.current?.focus();
  };

  const highlightMatch = (text: string, query: string) => {
    const q = query.trim();
    if (!q) return text;
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')})`, 'ig'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === q.toLowerCase()
            ? <mark key={i} className="px-0.5 rounded-sm bg-yellow-200 dark:bg-yellow-300/30">{part}</mark>
            : <span key={i}>{part}</span>
        )}
      </>
    );
  };

  // ---------------------- Render ----------------------
  return (
    <div className="flex flex-col md:flex-row gap-8 h-full">
      {/* Painel lateral */}
      <aside className="md:w-1/3 lg:w-1/4 flex-shrink-0">
        <div className="bg-light-bg dark:bg-dark-s1 border border-light-bmd dark:border-dark-bmd relative isolate z-[200] overflow-visible p-4 rounded-2xl flex flex-col max-h-[calc(100vh-200px)] min-h-[300px]">
          {/* Caixa de busca */}
          <div className="mb-3 relative" ref={searchBoxRef}>
            <div className="relative">
              <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-70 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                  const hasResults = searchResults.length > 0;
                  if (e.key === 'Enter' && searchText.trim().length >= 2) {
                    if (searchResults.length === 1) { e.preventDefault(); selectResultAt(0); return; }
                    if (hasResults) { e.preventDefault(); selectResultAt(activeIndex >= 0 ? activeIndex : 0); return; }
                  }
                  if (!hasResults) { if (e.key === 'Escape') { setSearchResults([]); setActiveIndex(-1); } return; }
                  if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((p) => (p + 1) % searchResults.length); return; }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((p) => (p - 1 + searchResults.length) % searchResults.length); return; }
                  if (e.key === 'Escape') { e.preventDefault(); setSearchResults([]); setActiveIndex(-1); return; }
                }}
                placeholder="Buscar empresa por nome..."
                className={clsx(
                  'w-full pl-8 pr-9 py-2 rounded-lg outline-none transition-none md:transition-all',
                  'neumorphic-inset focus:neumorphic-concave'
                )}
                aria-label="Buscar empresa por nome"
                aria-controls={listboxId}
                aria-expanded={searchResults.length > 0}
                role="combobox"
              />
              {searchText && (
                <button
                  type="button"
                  onClick={() => { setSearchText(''); setSearchResults([]); setActiveIndex(-1); searchInputRef.current?.focus(); }}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md neumorphic-convex hover:neumorphic-concave transition-none md:transition-all"
                  title="Limpar"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Dropdown de resultados — visualmente distinto, com rolagem */}
            {(isSearching || searchResults.length > 0) && (
              <div
                className={clsx(
                  'absolute left-0 right-0 mt-2 z-[220] rounded-xl p-2 shadow-lg border',
                  'bg-plate/95 backdrop-blur-md dark:bg-black/60 dark:backdrop-blur',
                  'border-black/5 dark:border-white/10',
                  'ring-1 ring-primary/10 dark:ring-primary/25'
                )}
                onMouseDown={(e) => e.preventDefault()}
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs font-medium opacity-70">Resultados da busca</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-primary/40 text-primary/90 bg-primary/5">
                    BUSCA
                  </span>
                </div>
                <div className="h-px bg-black/5 dark:bg-dark-s1/10 mx-2 mb-2" />

                {isSearching && (
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-600 dark:text-dark-t1">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando...
                  </div>
                )}
                {!isSearching && searchResults.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-500 dark:text-dark-t1">
                    Nenhuma empresa encontrada.
                  </div>
                )}
                {!isSearching && searchResults.length > 0 && (
                  // Container com rolagem e altura máxima (ex.: 18rem ~ 288px)
                  <div className="max-h-72 overflow-y-auto pr-1">
                    <ul
                      id={listboxId}
                      role="listbox"
                      aria-label="Resultados de empresas"
                      className="text-xs text-gray-700 dark:text-dark-t1"
                    >
                      {searchResults.map((c, idx) => (
                        <li key={c.id} role="option" aria-selected={idx === activeIndex}>
                          <button
                            className={clsx(
                              'w-full text-left px-3 py-1.5 rounded-lg relative',
                              'before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-full before:opacity-0',
                              idx === activeIndex
                                ? 'neumorphic-concave text-primary before:bg-primary before:opacity-100'
                                : 'neumorphic-convex hover:neumorphic-concave hover:text-primary before:bg-primary/40 hover:before:opacity-100'
                            )}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => selectResultAt(idx)}
                            title={c.trade_name}
                          >
                            <div className="flex items-center gap-2">
                              <SearchIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-80" />
                              <span className="truncate">{highlightMatch(c.trade_name, searchText)}</span>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <h2 className="text-lg font-bold mb-4 px-2">Empresas com Ações Ativas</h2>
          {isLoadingCompanies ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <EmpresasAgrupadasList
              empresas={companies}
              selectedCompanyId={selectedCompanyId}
              onSelect={throttleSelect}
              onHover={prefetchCompanyDetails}
            />
          )}
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 min-w-0">
        <div className="space-y-6">
          {isLoadingDetails ? (
            <div className="pointer-events-none space-y-6">
              <Skeleton className="h-40 w-full min-h-[160px]" />
              <Skeleton className="h-64 w-full min-h-[256px]" />
            </div>
          ) : selectedCompanyDetails ? (
            <>
              <CompanyDetailsCard companyDetails={selectedCompanyDetails} />
              <RegisterActionCard
                companyDetails={selectedCompanyDetails}
                editingChat={null as unknown as EditingChat}
                onCancelEdit={() => {}}
                onSaved={() => window.dispatchEvent(new CustomEvent('cockpit:refreshHistory'))}
              />

              {/* Card do bloco de Notas — sem cabeçalho duplicado */}
              <section className="bg-light-bg dark:bg-dark-s1 border border-light-bmd dark:border-dark-bmd rounded-2xl p-6">
                <NotesSection
                  companyId={selectedCompanyId!}
                  notes={(selectedCompanyDetails as any)?.notes}
                  onNotesChange={handleNotesChange}
                />
              </section>

              <div>
                <ConversationHistoryCard companyId={selectedCompanyId} />
              </div>
            </>
          ) : (
            !isLoadingCompanies && (
              <div className="flex items-center justify-center h-full p-8 rounded-2xl bg-light-bg dark:bg-dark-s1">
                <p className="text-gray-500">Selecione uma empresa para ver os detalhes.</p>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
};

export default CockpitPage;

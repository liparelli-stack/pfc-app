/*
-- ===================================================
-- Código             : /src/components/catalogs/CompanyList.tsx
-- Versão (.v20)      : 1.11.1
-- Data/Hora          : 2025-12-12 00:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Listagem de empresas com filtro por responsável
--                      (companies.owner = profiles.auth_user_id) e
--                      exportações ricas (PDF/CSV/Excel) com nome do responsável
--                      incluído via campo enriquecido owner_name.
-- Fluxo              : ListsPage -> CompanyList -> companiesService -> exporters
-- Alterações (1.11.1):
--   • [FIX] Busca por nome e cidade agora é independente de acentuação (client-side),
--     mantendo paginação coerente quando nameQuery/city estiverem preenchidos.
--   • [SAFE] Fallback controlado: quando há filtros textuais, busca um lote maior
--     (com demais filtros aplicados no backend) e filtra/pagina no front.
--   • Exportações também respeitam busca sem acento.
-- Dependências       : listCompanies, listAllCompaniesForExport, listSimpleCompanies,
--                      listCompanyOwners, PaginationToolbar, CompanyListCard,
--                      exportCompaniesToPDF/CSV/Excel
-- ===================================================
*/

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Company, CompanyWithContacts } from '@/types/company';
import {
  listCompanies,
  listAllCompaniesForExport,
  listSimpleCompanies,
  listCompanyOwners,
  CompanyOwnerDTO,
} from '@/services/companiesService';
import { useToast } from '@/contexts/ToastContext';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Eraser, FileText, FileSpreadsheet, File as FileIcon } from 'lucide-react';
import { debounce } from 'lodash-es';
import CompanyListCard from './CompanyListCard';
import { exportCompaniesToPDF } from '@/utils/pdfExporter';
import { exportCompaniesToCSV } from '@/utils/csvExporter';
import { exportCompaniesToExcel } from '@/utils/excelExporter';
import PaginationToolbar from '@/components/shared/PaginationToolbar';

const CLIENT_SIDE_TEXT_SEARCH_BATCH = 5000;

/**
 * Normaliza texto para busca:
 * - lower
 * - remove diacríticos (acentos)
 * - trim + colapsa espaços
 */
const normalizeForSearch = (value: unknown): string => {
  const s = String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

  return s;
};

const includesNormalized = (haystack: unknown, needle: unknown): boolean => {
  const n = normalizeForSearch(needle);
  if (!n) return true;
  const h = normalizeForSearch(haystack);
  return h.includes(n);
};

const CompanyList: React.FC = () => {
  const { addToast } = useToast();

  const [filters, setFilters] = useState({
    tradeName: '',
    nameQuery: '',
    city: '',
    state: '',
    ownerId: '', // auth_user_id do responsável
  });

  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [owners, setOwners] = useState<CompanyOwnerDTO[]>([]);
  const [pagination, setPagination] = useState<{ page: number; pageSize: 15 | 30 | 60 }>({
    page: 1,
    pageSize: 15,
  });
  const [companies, setCompanies] = useState<CompanyWithContacts[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const hasTextFilters = useMemo(() => {
    return normalizeForSearch(filters.nameQuery).length > 0 || normalizeForSearch(filters.city).length > 0;
  }, [filters.nameQuery, filters.city]);

  /* ---------------------------- Inicialização ---------------------------- */

  useEffect(() => {
    const fetchAllCompanyNames = async () => {
      try {
        const companiesData = await listSimpleCompanies({ status: 'all' });
        setAllCompanies(companiesData);
      } catch {
        addToast('Erro ao carregar lista de empresas para o filtro.', 'error');
      }
    };
    fetchAllCompanyNames();
  }, [addToast]);

  useEffect(() => {
    const fetchOwners = async () => {
      try {
        const data = await listCompanyOwners();
        setOwners(data);
      } catch {
        addToast('Erro ao carregar lista de responsáveis.', 'error');
      }
    };
    fetchOwners();
  }, [addToast]);

  /* ---------------------------- Helpers ---------------------------- */

  /**
   * Aplica filtros de texto (nameQuery/city) de forma accent-insensitive.
   * Mantém os demais filtros (tradeName/state/ownerId) no backend quando possível.
   */
  const applyClientSideTextFilters = (list: CompanyWithContacts[], currentFilters: typeof filters) => {
    const nameNeedle = normalizeForSearch(currentFilters.nameQuery);
    const cityNeedle = normalizeForSearch(currentFilters.city);

    if (!nameNeedle && !cityNeedle) return list;

    return list.filter((c) => {
      const anyC = c as any;

      const matchesName =
        !nameNeedle ||
        includesNormalized(c.trade_name, nameNeedle) ||
        includesNormalized(anyC.legal_name, nameNeedle) ||
        includesNormalized(anyC.tax_id, nameNeedle);

      const matchesCity = !cityNeedle || includesNormalized(anyC.city, cityNeedle);

      return matchesName && matchesCity;
    });
  };

  /**
   * Enriquecer empresas com nome do responsável (owner_name),
   * usando owners: profiles.auth_user_id <-> companies.owner
   */
  const enrichWithOwnerName = (list: CompanyWithContacts[]): CompanyWithContacts[] => {
    if (!owners.length) return list;

    const ownersMap = new Map<string, string>(owners.map((o) => [o.auth_user_id, o.full_name]));

    return list.map((c) => ({
      ...c,
      ...(c.owner && {
        owner_name: ownersMap.get(c.owner) || '',
      }),
    })) as CompanyWithContacts[];
  };

  /* ---------------------------- Listagem ---------------------------- */

  const fetchCompanies = useCallback(
    async (page: number, size: number, currentFilters: typeof filters) => {
      setIsLoading(true);

      try {
        // ✅ Caso SEM filtros textuais: mantém busca/paginação no backend (rápido)
        if (!hasTextFilters) {
          const { items, total } = await listCompanies({
            q: currentFilters.nameQuery,
            tradeName: currentFilters.tradeName,
            city: currentFilters.city,
            state: currentFilters.state,
            ownerId: currentFilters.ownerId || null,
            limit: size,
            offset: (page - 1) * size,
            status: 'all',
          });

          setCompanies(items);
          setTotalCount(total || 0);
          return;
        }

        // 🟡 Caso COM filtros textuais (nome/cidade):
        // Faz fallback: busca um lote maior no backend SEM q/city (para não perder por acento),
        // aplica filtro sem acento no front e pagina localmente.
        const { items } = await listCompanies({
          q: '', // desliga busca sensível a acento no backend
          city: '', // idem
          tradeName: currentFilters.tradeName,
          state: currentFilters.state,
          ownerId: currentFilters.ownerId || null,
          limit: CLIENT_SIDE_TEXT_SEARCH_BATCH,
          offset: 0,
          status: 'all',
        });

        const filtered = applyClientSideTextFilters(items, currentFilters);
        const totalFiltered = filtered.length;

        const start = (page - 1) * size;
        const pageItems = filtered.slice(start, start + size);

        setCompanies(pageItems);
        setTotalCount(totalFiltered);
      } catch {
        addToast('Erro ao carregar empresas.', 'error');
      } finally {
        setIsLoading(false);
      }
    },
    [addToast, hasTextFilters]
  );

  const debouncedFetch = useCallback(debounce(fetchCompanies, 500), [fetchCompanies]);

  useEffect(() => {
    debouncedFetch(pagination.page, pagination.pageSize, filters);
    return () => debouncedFetch.cancel();
  }, [pagination, filters, debouncedFetch]);

  /* ---------------------------- Handlers ---------------------------- */

  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    setPagination((p) => ({ ...p, page: 1 }));
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      tradeName: '',
      nameQuery: '',
      city: '',
      state: '',
      ownerId: '',
    });
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const buildExportParams = () => ({
    q: filters.nameQuery,
    tradeName: filters.tradeName,
    city: filters.city,
    state: filters.state,
    ownerId: filters.ownerId || null,
    status: 'all' as const,
  });

  /* ---------------------------- Exportações ---------------------------- */

  const getCompaniesForExportRespectingAccentInsensitiveSearch = async (): Promise<CompanyWithContacts[]> => {
    // ✅ Se não há filtros textuais, mantém export no backend (rápido)
    if (!hasTextFilters) {
      return await listAllCompaniesForExport(buildExportParams());
    }

    // 🟡 Se há filtros textuais, busca base sem q/city e filtra no front
    const base = await listAllCompaniesForExport({
      ...buildExportParams(),
      q: '',
      city: '',
    });

    return applyClientSideTextFilters(base, filters);
  };

  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    addToast('Gerando relatório PDF (gerencial)...', 'info');
    try {
      const baseCompanies = await getCompaniesForExportRespectingAccentInsensitiveSearch();
      if (baseCompanies.length === 0) {
        addToast('Nenhuma empresa encontrada para exportar.', 'warning');
        return;
      }

      const enriched = enrichWithOwnerName(baseCompanies);
      exportCompaniesToPDF(enriched as any);
      addToast('PDF gerencial gerado com sucesso!', 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      addToast('Erro ao gerar o relatório PDF.', 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExportingCSV(true);
    addToast('Gerando CSV...', 'info');
    try {
      const baseCompanies = await getCompaniesForExportRespectingAccentInsensitiveSearch();
      if (baseCompanies.length === 0) {
        addToast('Nenhuma empresa encontrada para exportar.', 'warning');
        return;
      }

      const enriched = enrichWithOwnerName(baseCompanies);
      exportCompaniesToCSV(enriched as any);
      addToast('CSV gerado com sucesso.', 'success');
    } catch (err) {
      console.error('CSV export error:', err);
      addToast('Erro ao gerar CSV.', 'error');
    } finally {
      setIsExportingCSV(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    addToast('Gerando Excel...', 'info');
    try {
      const baseCompanies = await getCompaniesForExportRespectingAccentInsensitiveSearch();
      if (baseCompanies.length === 0) {
        addToast('Nenhuma empresa encontrada para exportar.', 'warning');
        return;
      }

      const enriched = enrichWithOwnerName(baseCompanies);
      exportCompaniesToExcel(enriched as any);
      addToast('Excel gerado com sucesso!', 'success');
    } catch (err) {
      console.error('Excel export error:', err);
      addToast('Erro ao gerar Excel.', 'error');
    } finally {
      setIsExportingExcel(false);
    }
  };

  /* ---------------------------- UI ---------------------------- */

  return (
    <div className="space-y-6">
      <section className="neumorphic-convex rounded-2xl p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-x-4 gap-y-4 items-end">
          <div className="lg:col-span-3">
            <Select
              label="Empresa (por nome)"
              value={filters.tradeName}
              onChange={(e) => handleFilterChange('tradeName', e.target.value)}
            >
              <option value="">Todas</option>
              {allCompanies.map((company) => (
                <option key={company.id} value={company.trade_name!}>
                  {company.trade_name}
                </option>
              ))}
            </Select>
          </div>

          <div className="lg:col-span-3">
            <Input
              label="Buscar por nome..."
              placeholder="Parte do nome..."
              value={filters.nameQuery}
              onChange={(e) => handleFilterChange('nameQuery', e.target.value)}
            />
          </div>

          <div className="lg:col-span-2">
            <Input
              label="Cidade"
              placeholder="Buscar por cidade..."
              value={filters.city}
              onChange={(e) => handleFilterChange('city', e.target.value)}
            />
          </div>

          <div className="lg:col-span-1">
            <Input
              label="UF"
              placeholder="SP"
              maxLength={2}
              value={filters.state}
              onChange={(e) => handleFilterChange('state', e.target.value)}
            />
          </div>

          {/* Responsável (auth_user_id) */}
          <div className="lg:col-span-3">
            <Select
              label="Responsável"
              value={filters.ownerId}
              onChange={(e) => handleFilterChange('ownerId', e.target.value)}
            >
              <option value="">Todos</option>
              {owners.map((o) => (
                <option key={o.id} value={o.auth_user_id}>
                  {o.full_name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-transparent select-none">Ação</label>
            <Button
              onClick={clearFilters}
              variant="default"
              className="h-11 w-full flex-1 !p-2"
              title="Limpar Filtros"
            >
              <Eraser className="h-5 w-5" />
            </Button>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-medium mb-1 text-gray-600 dark:text-gray-300">
              Exportações
            </label>
            <div className="flex items-center gap-2 h-11">
              <Button
                onClick={handleExportPDF}
                variant="default"
                className="h-full flex-1 !p-2"
                title="Gerar PDF (Gerencial)"
                isLoading={isExportingPDF}
              >
                <FileText className="h-5 w-5 text-red-500" />
              </Button>
              <Button
                onClick={handleExportCSV}
                variant="default"
                className="h-full flex-1 !p-2"
                title="Exportar CSV"
                isLoading={isExportingCSV}
              >
                <FileIcon className="h-5 w-5 text-gray-500" />
              </Button>
              <Button
                onClick={handleExportExcel}
                variant="default"
                className="h-full flex-1 !p-2"
                title="Exportar Excel"
                isLoading={isExportingExcel}
              >
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <PaginationToolbar
        page={pagination.page}
        pageSize={pagination.pageSize}
        total={totalCount}
        onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
        onPageSizeChange={(size) => setPagination((p) => ({ ...p, pageSize: size, page: 1 }))}
        itemTypeLabel="empresas"
        className="neumorphic-convex rounded-2xl p-3"
      />

      <section className="space-y-4">
        {isLoading ? (
          [...Array(pagination.pageSize)].map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)
        ) : companies.length > 0 ? (
          companies.map((company) => <CompanyListCard key={company.id} company={company} />)
        ) : (
          <div className="text-center py-16 neumorphic-convex rounded-2xl">
            <p className="text-gray-500">Nenhuma empresa encontrada com os filtros aplicados.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default CompanyList;

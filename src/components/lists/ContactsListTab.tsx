/*
-- ===================================================
-- Código             : /src/components/lists/ContactsListTab.tsx
-- Versão (.v20)      : 1.4.0
-- Data/Hora          : 2025-12-07 15:15 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Integrar novos filtros avançados.
-- Alterações (1.4.0) :
--   • [FEAT] Passar novos campos de filtro para ContactsFilterBar.
-- Dependências       : react, @/hooks/useContactsList
-- ===================================================
*/
import React, { useState } from 'react';
import { useContactsList } from '@/hooks/useContactsList';
import ContactsFilterBar from './ContactsFilterBar';
import ContactsTable from './ContactsTable';
import PaginationToolbar from '@/components/shared/PaginationToolbar';
import { exportContactsToCsv, exportContactsToPdf, exportContactsToExcel } from '@/utils/contactsExporter';
import { useToast } from '@/contexts/ToastContext';

const ContactsListTab: React.FC = () => {
  const { items, total, loading, params, setPage, setPageSize, setFilters, setSort, clearFilters } = useContactsList();
  const { addToast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (exportFn: (data: any[]) => void, format: string) => {
    if(items.length === 0) {
      addToast(`Nenhum contato para exportar para ${format}.`, 'warning');
      return;
    }
    setIsExporting(true);
    addToast(`Gerando arquivo ${format}...`, 'info');
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      exportFn(items);
      addToast(`Arquivo ${format} gerado com sucesso!`, 'success');
    } catch (error) {
      addToast(`Falha ao gerar arquivo ${format}.`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ContactsFilterBar
        onFilterChange={setFilters}
        onClearFilters={clearFilters}
        onExportPDF={() => handleExport(exportContactsToPdf, 'PDF')}
        onExportCSV={() => handleExport(exportContactsToCsv, 'CSV')}
        onExportExcel={() => handleExport(exportContactsToExcel, 'Excel')}
        isExporting={isExporting}
        hasData={items.length > 0}
        currentFilters={{
          contactName: params.contactName,
          companyName: params.companyName,
          channelType: params.channelType,
          email: params.email,
          phone: params.phone,
          position: params.position,
          department: params.department
        }}
      />
      
      {total > 0 && (
        <PaginationToolbar
          page={params.page || 1}
          pageSize={(params.pageSize as 15 | 30 | 60) || 15}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemTypeLabel="contatos"
          className="neumorphic-convex rounded-2xl p-3"
        />
      )}

      <section className="neumorphic-convex rounded-2xl p-4 sm:p-6">
        <ContactsTable 
          contacts={items} 
          loading={loading} 
          sortConfig={{ sortBy: params.sortBy, sortOrder: params.sortOrder }}
          onSort={setSort}
        />
      </section>
    </div>
  );
};

export default ContactsListTab;

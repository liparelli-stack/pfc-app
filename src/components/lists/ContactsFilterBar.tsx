/*
-- ===================================================
-- Código             : /src/components/lists/ContactsFilterBar.tsx
-- Versão (.v20)      : 1.4.0
-- Data/Hora          : 2025-12-07 16:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Adicionar painel expansível de filtros avançados.
-- Alterações (1.4.0) :
--   • [UX] Movido botão "Filtros Avançados" para linha dedicada.
-- Dependências       : react, lodash-es, clsx
-- ===================================================
*/
import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { FileText, File as FileIcon, FileSpreadsheet, Eraser, ChevronDown } from 'lucide-react';
import { debounce } from 'lodash-es';
import clsx from 'clsx';

interface ContactsFilterBarProps {
  onFilterChange: (filters: { 
    contactName?: string; 
    companyName?: string; 
    channelType?: string;
    email?: string;
    phone?: string;
    position?: string;
    department?: string;
  }) => void;
  onClearFilters: () => void;
  onExportPDF: () => void;
  onExportCSV: () => void;
  onExportExcel: () => void;
  isExporting: boolean;
  hasData: boolean;
  currentFilters: { 
    contactName?: string; 
    companyName?: string; 
    channelType?: string;
    email?: string;
    phone?: string;
    position?: string;
    department?: string;
  };
}

const ContactsFilterBar: React.FC<ContactsFilterBarProps> = ({ 
  onFilterChange, 
  onClearFilters,
  onExportPDF, 
  onExportCSV, 
  onExportExcel, 
  isExporting, 
  hasData, 
  currentFilters 
}) => {
  const [contactName, setContactName] = useState(currentFilters.contactName || '');
  const [companyName, setCompanyName] = useState(currentFilters.companyName || '');
  const [channelType, setChannelType] = useState(currentFilters.channelType || 'all');
  
  // Novos estados para filtros avançados
  const [email, setEmail] = useState(currentFilters.email || '');
  const [phone, setPhone] = useState(currentFilters.phone || '');
  const [position, setPosition] = useState(currentFilters.position || '');
  const [department, setDepartment] = useState(currentFilters.department || '');
  
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Sincroniza estado local se os filtros forem limpos externamente
  useEffect(() => {
    setContactName(currentFilters.contactName || '');
    setCompanyName(currentFilters.companyName || '');
    setChannelType(currentFilters.channelType || 'all');
    setEmail(currentFilters.email || '');
    setPhone(currentFilters.phone || '');
    setPosition(currentFilters.position || '');
    setDepartment(currentFilters.department || '');
  }, [currentFilters]);

  const debouncedFilterChange = React.useCallback(
    debounce((filters) => {
      onFilterChange(filters);
    }, 300),
    [onFilterChange]
  );

  useEffect(() => {
    debouncedFilterChange({ 
      contactName, 
      companyName, 
      channelType,
      email,
      phone,
      position,
      department
    });
    return () => debouncedFilterChange.cancel();
  }, [contactName, companyName, channelType, email, phone, position, department, debouncedFilterChange]);

  return (
    <section className="neumorphic-convex rounded-2xl p-4 sm:p-6 space-y-4 transition-all duration-300">
      {/* Filtros Básicos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
        <div className="lg:col-span-3">
          <Input
            label="Contato"
            placeholder="Nome do contato..."
            value={contactName}
            onChange={e => setContactName(e.target.value)}
          />
        </div>
        <div className="lg:col-span-3">
          <Input
            label="Empresa"
            placeholder="Nome da empresa..."
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
          />
        </div>
        <div className="lg:col-span-2">
          <Select label="Filtrar por Canal" value={channelType} onChange={e => setChannelType(e.target.value)}>
            <option value="all">Todos</option>
            <option value="email">Email</option>
            <option value="phone">Telefone</option>
            <option value="messaging">WhatsApp</option>
          </Select>
        </div>
        
        {/* Botões de Ação (Limpar + Exportar) */}
        <div className="lg:col-span-4 flex items-end justify-end gap-2 flex-wrap">
            <Button onClick={onClearFilters} variant="default" className="text-sm !py-2 !px-3 flex items-center gap-2" title="Limpar Filtros">
              <Eraser className="h-4 w-4" />
            </Button>
            <div className="h-8 w-px bg-gray-300 dark:bg-gray-700 mx-1 hidden sm:block"></div>
            <Button onClick={onExportPDF} variant="default" className="text-sm !py-2 !px-3 flex items-center gap-2" isLoading={isExporting} disabled={isExporting || !hasData}>
              <FileText className="h-4 w-4 text-red-500" /> PDF
            </Button>
            <Button onClick={onExportCSV} variant="default" className="text-sm !py-2 !px-3 flex items-center gap-2" isLoading={isExporting} disabled={isExporting || !hasData}>
              <FileIcon className="h-4 w-4 text-gray-500" /> CSV
            </Button>
            <Button onClick={onExportExcel} variant="default" className="text-sm !py-2 !px-3 flex items-center gap-2" isLoading={isExporting} disabled={isExporting || !hasData}>
              <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel
            </Button>
        </div>
      </div>

      {/* Linha do Botão Filtros Avançados */}
      <div className="flex justify-start">
        <Button 
          onClick={() => setShowAdvanced(!showAdvanced)} 
          variant="default" 
          className={clsx(
            "text-sm !py-2 !px-4 flex items-center gap-2 transition-colors w-full sm:w-auto justify-center",
            showAdvanced && "bg-primary/10 text-primary border-primary/20"
          )}
          title="Filtros Avançados"
        >
          Filtros Avançados
          <ChevronDown className={clsx("h-4 w-4 transition-transform duration-200", showAdvanced && "rotate-180")} />
        </Button>
      </div>

      {/* Filtros Avançados Expansíveis */}
      <div 
        className={clsx(
          "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-hidden transition-all duration-300 ease-in-out",
          showAdvanced ? "max-h-96 opacity-100 pt-2" : "max-h-0 opacity-0 pt-0"
        )}
      >
        <Input
          label="Email"
          placeholder="Buscar por email..."
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="focus:ring-primary/30"
        />
        <Input
          label="Telefone"
          placeholder="Buscar por telefone..."
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="focus:ring-primary/30"
        />
        <Input
          label="Cargo"
          placeholder="Buscar por cargo..."
          value={position}
          onChange={e => setPosition(e.target.value)}
          className="focus:ring-primary/30"
        />
        <Input
          label="Departamento"
          placeholder="Buscar por departamento..."
          value={department}
          onChange={e => setDepartment(e.target.value)}
          className="focus:ring-primary/30"
        />
      </div>
    </section>
  );
};

export default ContactsFilterBar;

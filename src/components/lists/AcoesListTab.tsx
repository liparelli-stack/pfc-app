/*
-- ===================================================
-- Código             : /src/components/lists/AcoesListTab.tsx
-- Versão (.v20)      : 1.7.0
-- Data/Hora          : 2025-12-06 15:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Remover o nome do contato da coluna "Empresa".
-- Alterações (1.7.0) :
--   • [CLEANUP] Removida a linha que exibia o nome do contato abaixo do nome da empresa.
-- Dependências       : jspdf, jspdf-autotable, xlsx, e as dependências anteriores.
-- ===================================================
*/
import React, { useState, useEffect, useCallback } from 'react';
import { useAcoesList } from '@/hooks/useAcoesList';
import { ChatListItem } from '@/types/chat';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import PaginationToolbar from '@/components/shared/PaginationToolbar';
import { ArrowUpDown, ChevronDown, FileText, File, FileSpreadsheet, Thermometer, Flame, Snowflake, MinusCircle, Eraser } from 'lucide-react';
import clsx from 'clsx';
import { isPast, parseISO } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useToast } from '@/contexts/ToastContext';
import { exportAcoesToCsv, exportAcoesToExcel } from '@/utils/acoesExporter';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}


// --- Helpers ---
const formatDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
const formatTime = (time: string | null) => time ? time.slice(0, 5) : '';

const StatusBadge = ({ done }: { done: boolean }) => (
  <span className={clsx(
    'text-xs font-medium me-2 px-2.5 py-0.5 rounded',
    done
      ? 'bg-green-100 text-green-800'
      : 'bg-blue-100 text-blue-800'
  )}>
    {done ? 'Concluída' : 'Em Andamento'}
  </span>
);

const TagBadge = ({ tag }: { tag: string }) => (
  <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">{tag}</span>
);

const TemperatureCell = ({ temp }: { temp: string | null }) => {
  const normalizedTemp = (temp || 'Neutra').toLowerCase();
  const baseClasses = 'h-5 w-5';

  let icon: React.ReactNode;
  let label: string;
  let colorClass: string;

  switch (normalizedTemp) {
    case 'fria':
      icon = <Snowflake className={baseClasses} />;
      label = 'Fria';
      colorClass = 'text-blue-500';
      break;
    case 'morna':
      icon = <Thermometer className={baseClasses} />;
      label = 'Morna';
      colorClass = 'text-orange-500';
      break;
    case 'quente':
      icon = <Flame className={baseClasses} />;
      label = 'Quente';
      colorClass = 'text-red-500';
      break;
    default:
      icon = <MinusCircle className={baseClasses} />;
      label = 'Neutra';
      colorClass = 'text-gray-500';
      break;
  }

  return (
    <div className={clsx('flex items-center gap-2', colorClass)}>
      {icon}
      <span className="font-medium">{label}</span>
    </div>
  );
};

const SituationBadge = ({ is_done, calendar_at, on_time }: { is_done: boolean; calendar_at: string | null; on_time: string | null }) => {
  const baseStyle = 'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium';

  if (is_done) {
    return <span className={clsx(baseStyle, 'bg-gray-100 text-gray-800')}>Finalizada</span>;
  }

  let situation = { label: 'No prazo', style: 'bg-green-100 text-green-800' };
  if (calendar_at) {
    const dateTimeString = `${calendar_at}T${on_time || '00:00:00'}`;
    try {
      const dueDate = parseISO(dateTimeString);
      if (isPast(dueDate)) {
        situation = { label: 'Atraso', style: 'bg-red-100 text-red-800' };
      }
    } catch (e) {
      console.warn("Invalid date for situation check:", dateTimeString);
    }
  }

  return <span className={clsx(baseStyle, situation.style)}>{situation.label}</span>;
};


const SortableHeader = ({ label, sortKey, currentSort, currentOrder, onSort }: any) => (
  <th className="py-2 px-3 font-semibold cursor-pointer select-none" onClick={() => onSort(sortKey)}>
    <div className="flex items-center gap-1">
      <span>{label}</span>
      <ArrowUpDown className={clsx(
        'h-4 w-4 transition-all',
        currentSort === sortKey
          ? 'opacity-100 text-blue-600'
          : 'opacity-40',
        currentSort === sortKey && currentOrder === 'desc' && 'rotate-180'
      )} />
    </div>
  </th>
);

const AcoesListTab: React.FC = () => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { items, total, loading, params, setSort, setPage, setPageSize, setFilters, clearFilters } = useAcoesList();
  const { addToast } = useToast();
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const handleClearFilters = () => {
    clearFilters();
  };

  const handleExportPDF = () => {
    if (items.length === 0) return;
    setIsExportingPDF(true);
    try {
      const doc = new jsPDF('landscape');
      const headers = ['Data', 'Situação', 'Canal', 'Temperatura', 'Assunto', 'Empresa', 'Responsável', 'Atualizado', 'Status', 'Etiquetas'];
      
      const body = items.map(item => {
        const situation = (() => {
          if (item.is_done) return 'Finalizada';
          if (item.calendar_at) {
            const dateTimeString = `${item.calendar_at}T${item.on_time || '00:00:00'}`;
            try {
              if (isPast(parseISO(dateTimeString))) return 'Atraso';
            } catch {}
          }
          return 'No prazo';
        })();

        const temperature = (() => {
          const normalizedTemp = (item.temperature || 'Neutra').toLowerCase();
          if (normalizedTemp === 'fria') return 'Fria';
          if (normalizedTemp === 'morna') return 'Morna';
          if (normalizedTemp === 'quente') return 'Quente';
          return 'Neutra';
        })();

        return [
          `${formatDate(item.calendar_at)} ${formatTime(item.on_time)}`.trim(),
          situation,
          item.channel_type || 'N/A',
          temperature,
          item.subject || 'Sem Assunto',
          `${item.company_name || ''}`,
          item.author_name || 'N/A',
          formatDate(item.updated_at),
          item.is_done ? 'Concluída' : 'Em Andamento',
          item.tags?.join(', ') || ''
        ];
      });

      doc.autoTable({
        head: [headers],
        body: body,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [28, 76, 150] },
      });

      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      doc.save(`acoes_agenda_${date}.pdf`);
    } catch (error) {
      addToast('Falha ao gerar PDF.', 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleExportCsv = async () => {
    if (items.length === 0) return;
    setIsExportingCsv(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 100)); // allow UI to update
      exportAcoesToCsv(items);
    } catch (err) {
      addToast('Falha ao exportar para CSV.', 'error');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleExportExcel = async () => {
    if (items.length === 0) return;
    setIsExportingExcel(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 100)); // allow UI to update
      exportAcoesToExcel(items);
    } catch (err) {
      addToast('Falha ao exportar para Excel.', 'error');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const isExporting = isExportingPDF || isExportingCsv || isExportingExcel;

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros */}
      <section className="neumorphic-convex rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <Input label="Busca" placeholder="Buscar em assunto/descrição..." value={params.q || ''} onChange={e => setFilters({ q: e.target.value })} />
          <Select label="Status" value={params.status} onChange={e => setFilters({ status: e.target.value as any })}>
            <option value="all">Todos</option>
            <option value="false">Em Andamento</option>
            <option value="true">Concluído</option>
          </Select>
          <Select label="Tipo" value={params.type} onChange={e => setFilters({ type: e.target.value })}>
            <option value="">Todos</option>
            <option value="conversation">Conversa</option>
            <option value="followup">Follow-up</option>
            <option value="task">Tarefa</option>
            <option value="call">Ligação</option>
            <option value="message">Mensagem</option>
          </Select>
          <Select label="Canal" value={params.channel} onChange={e => setFilters({ channel: e.target.value })}>
            <option value="">Todos</option>
            <option value="phone">Telefone</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">E-mail</option>
          </Select>
        </div>
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button variant="default" onClick={() => setShowAdvanced(!showAdvanced)} className="text-sm !py-2 !px-3">
              Filtros Avançados <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </Button>
            <Button variant="default" onClick={handleClearFilters} className="text-sm !py-2 !px-3 flex items-center gap-2">
              <Eraser className="h-4 w-4" /> Limpar Filtros
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleExportPDF} variant="default" className="text-sm !py-2 !px-3 flex items-center gap-2" isLoading={isExportingPDF} disabled={isExporting || items.length === 0}>
              <FileText className="h-4 w-4 text-red-500" /> PDF
            </Button>
            <Button onClick={handleExportCsv} variant="default" className="text-sm !py-2 !px-3 flex items-center gap-2" isLoading={isExportingCsv} disabled={isExporting || items.length === 0}>
              <File className="h-4 w-4 text-gray-500" /> CSV
            </Button>
            <Button onClick={handleExportExcel} variant="default" className="text-sm !py-2 !px-3 flex items-center gap-2" isLoading={isExportingExcel} disabled={isExporting || items.length === 0}>
              <FileSpreadsheet className="h-4 w-4 text-green-600" /> Excel
            </Button>
          </div>
        </div>
        {showAdvanced && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-dark-shadow/20">
            <Input label="Empresa" placeholder="Nome da empresa..." value={params.companyName || ''} onChange={e => setFilters({ companyName: e.target.value })} />
            <Input label="Contato" placeholder="Nome do contato..." value={params.contactName || ''} onChange={e => setFilters({ contactName: e.target.value })} />
            <Select label="Temperatura" value={params.temperature} onChange={e => setFilters({ temperature: e.target.value })}>
              <option value="">Todas</option>
              <option value="Neutra">Neutra</option>
              <option value="Fria">Fria</option>
              <option value="Morna">Morna</option>
              <option value="Quente">Quente</option>
            </Select>
          </div>
        )}
      </section>
      
      {total > 0 && (
        <PaginationToolbar
          page={params.page || 1}
          pageSize={(params.pageSize as 15 | 30 | 60) || 15}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          className="neumorphic-convex rounded-2xl p-3"
        />
      )}

      <section className="neumorphic-convex rounded-2xl p-4 sm:p-6">
        {loading && items.length === 0 ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : !loading && items.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Nenhuma ação encontrada para os filtros aplicados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-dark-t2 border-b border-gray-200/60 dark:border-white/10/60">
                  <SortableHeader label="Data" sortKey="calendar_at" currentSort={params.sortBy} currentOrder={params.sortOrder} onSort={setSort} />
                  <SortableHeader label="Situação" sortKey="is_done" currentSort={params.sortBy} currentOrder={params.sortOrder} onSort={setSort} />
                  <SortableHeader label="Canal" sortKey="channel_type" currentSort={params.sortBy} currentOrder={params.sortOrder} onSort={setSort} />
                  <SortableHeader label="Temperatura" sortKey="temperature" currentSort={params.sortBy} currentOrder={params.sortOrder} onSort={setSort} />
                  <SortableHeader label="Detalhes da Ação" sortKey="subject" currentSort={params.sortBy} currentOrder={params.sortOrder} onSort={setSort} />
                  <SortableHeader label="Empresa" sortKey="companies.trade_name" currentSort={params.sortBy} currentOrder={params.sortOrder} onSort={setSort} />
                  <SortableHeader label="Responsável" sortKey="author_name" currentSort={params.sortBy} currentOrder={params.sortOrder} onSort={setSort} />
                  <SortableHeader label="Atualizado" sortKey="updated_at" currentSort={params.sortBy} currentOrder={params.sortOrder} onSort={setSort} />
                  <SortableHeader label="Status" sortKey="is_done" currentSort={params.sortBy} currentOrder={params.sortOrder} onSort={setSort} />
                  <th className="py-2 px-3 font-semibold hidden lg:table-cell">Etiquetas</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-gray-200/60 dark:border-white/10/60 hover:bg-black/5 dark:hover:bg-white/5">
                    <td className="py-3 px-3 align-top">
                      <div>{formatDate(item.calendar_at)}</div>
                      <div className="text-xs text-gray-500">{formatTime(item.on_time)}</div>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <SituationBadge is_done={item.is_done} calendar_at={item.calendar_at} on_time={item.on_time} />
                    </td>
                    <td className="py-3 px-3 align-top">{item.channel_type || 'N/A'}</td>
                    <td className="py-3 px-3 align-top">
                      <TemperatureCell temp={item.temperature} />
                    </td>
                    <td className="py-3 px-3 align-top">
                      <div className="flex flex-col">
                        <div className="font-bold">{item.subject || 'Sem Assunto'}</div>
                        <p className="text-xs text-gray-600 dark:text-dark-t2 mt-1 line-clamp-2">{item.body}</p>
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top">
                      <div>{item.company_name}</div>
                    </td>
                    <td className="py-3 px-3 align-top hidden md:table-cell">{item.author_name}</td>
                    <td className="py-3 px-3 align-top text-xs text-gray-500">{formatDate(item.updated_at)}</td>
                    <td className="py-3 px-3 align-top">
                      <StatusBadge done={item.is_done} />
                    </td>
                    <td className="py-3 px-3 align-top hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {item.tags?.map(tag => <TagBadge key={tag} tag={tag} />)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default AcoesListTab;

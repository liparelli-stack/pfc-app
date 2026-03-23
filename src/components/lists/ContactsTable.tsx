/*
-- ===================================================
-- Código             : /src/components/lists/ContactsTable.tsx
-- Versão (.v20)      : 1.3.0
-- Data/Hora          : 2025-12-07 14:20 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Reordenar colunas e adicionar ordenação visual.
-- Alterações (1.3.0) :
--   • [UI] Coluna "Contato" movida para a primeira posição.
--   • [FEAT] Cabeçalhos clicáveis com indicador de ordenação (ArrowUpDown).
-- Dependências       : react, lucide-react, clsx
-- ===================================================
*/
import React from 'react';
import { ContactWithCompany } from '@/types/contact';
import { Mail, Phone, MessageSquare, Star, ArrowUpDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import clsx from 'clsx';

interface ContactsTableProps {
  contacts: ContactWithCompany[];
  loading: boolean;
  sortConfig?: {
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  };
  onSort?: (column: string) => void;
}

const ChannelIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'email': return <Mail className="h-4 w-4 text-blue-500" />;
    case 'phone': return <Phone className="h-4 w-4 text-green-500" />;
    case 'messaging': return <MessageSquare className="h-4 w-4 text-teal-500" />;
    default: return null;
  }
};

const StatusBadge: React.FC<{ status: string | null | undefined }> = ({ status }) => {
  const isActive = status === 'active';
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        isActive
          ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
          : 'bg-gray-100 text-gray-800 dark:bg-dark-s2 dark:text-dark-t1'
      )}
    >
      {isActive ? 'Ativo' : 'Inativo'}
    </span>
  );
};

const formatBirthday = (birthDayMonth: string | null | undefined): string => {
  if (!birthDayMonth) return '—';
  const parts = birthDayMonth.split('-');
  if (parts.length === 2) {
    const [month, day] = parts;
    if (!isNaN(parseInt(day)) && !isNaN(parseInt(month))) {
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}`;
    }
  }
  if (parts.length === 1) {
    const monthIndex = parseInt(parts[0], 10) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      const date = new Date(2000, monthIndex);
      return date.toLocaleString('pt-BR', { month: 'long' });
    }
  }
  return birthDayMonth;
};

const SortableHeader = ({ label, sortKey, currentSort, currentOrder, onSort }: any) => (
  <th 
    className="py-2 px-3 font-semibold cursor-pointer select-none hover:text-primary transition-colors" 
    onClick={() => onSort && onSort(sortKey)}
  >
    <div className="flex items-center gap-1">
      <span>{label}</span>
      <ArrowUpDown className={clsx(
        'h-4 w-4 transition-all',
        currentSort === sortKey
          ? 'opacity-100 text-primary'
          : 'opacity-30',
        currentSort === sortKey && currentOrder === 'desc' && 'rotate-180'
      )} />
    </div>
  </th>
);

const ContactsTable: React.FC<ContactsTableProps> = ({ contacts, loading, sortConfig, onSort }) => {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(15)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (!loading && contacts.length === 0) {
    return (
      <p className="text-center text-gray-500 py-8">Nenhum contato encontrado.</p>
    );
  }

  const { sortBy, sortOrder } = sortConfig || {};

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 dark:text-dark-t2 border-b border-gray-200/60 dark:border-white/10/60">
            <SortableHeader label="Contato" sortKey="full_name" currentSort={sortBy} currentOrder={sortOrder} onSort={onSort} />
            <SortableHeader label="Empresa" sortKey="company.trade_name" currentSort={sortBy} currentOrder={sortOrder} onSort={onSort} />
            <th className="py-2 px-3 font-semibold">Canais</th>
            <SortableHeader label="Cargo" sortKey="position" currentSort={sortBy} currentOrder={sortOrder} onSort={onSort} />
            <SortableHeader label="Status" sortKey="status" currentSort={sortBy} currentOrder={sortOrder} onSort={onSort} />
            <SortableHeader label="Departamento" sortKey="department" currentSort={sortBy} currentOrder={sortOrder} onSort={onSort} />
            <SortableHeader label="Mês Aniv." sortKey="birth_day_month" currentSort={sortBy} currentOrder={sortOrder} onSort={onSort} />
            <th className="py-2 px-3 font-semibold">Notas</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map(contact => (
            <tr key={contact.id} className="border-b border-gray-200/60 dark:border-white/10/60 hover:bg-black/5 dark:hover:bg-white/5">
              <td className="py-3 px-3 align-top font-medium text-gray-900 dark:text-dark-t1">{contact.full_name}</td>
              <td className="py-3 px-3 align-top">{contact.company?.trade_name || 'N/A'}</td>
              <td className="py-3 px-3 align-top">
                <div className="flex flex-col gap-2">
                  {contact.channels?.map(channel => (
                    <div key={channel.id} className="flex items-center gap-2">
                      <ChannelIcon type={channel.type!} />
                      <span className="truncate">{channel.value}</span>
                      {channel.label_custom && (
                        <span className="text-xs text-gray-500">({channel.label_custom})</span>
                      )}
                      {channel.is_preferred && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                    </div>
                  ))}
                </div>
              </td>
              <td className="py-3 px-3 align-top">{contact.position || '—'}</td>
              <td className="py-3 px-3 align-top"><StatusBadge status={contact.status} /></td>
              <td className="py-3 px-3 align-top">{contact.department || '—'}</td>
              <td className="py-3 px-3 align-top">{formatBirthday(contact.birth_day_month)}</td>
              <td className="py-3 px-3 align-top text-gray-600 dark:text-dark-t2 max-w-xs truncate" title={contact.notes || ''}>{contact.notes || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ContactsTable;

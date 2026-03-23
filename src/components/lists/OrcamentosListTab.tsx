/*
-- ===================================================
-- Código             : /src/components/lists/OrcamentosListTab.tsx
-- Versão (.v20)      : 2.1.3
-- Data/Hora          : 2025-11-16 23:10 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Corrigir a exibição dos valores de orçamentos na listagem,
--                      que estavam sendo tratados como centavos.
-- Alterações (2.1.3) :
--   • [FIX] `formatCurrency` passou a usar o valor diretamente em reais,
--           removendo a divisão por 100.
--   • [FIX] Agregadores (`totalsByCompany`, `totalsByStatus`) agora somam o
--           valor em reais (`amount`) em vez de supostos centavos.
-- Dependências       : react, @/hooks/useAcoesList, @/types/chat, @/components/ui/Skeleton, clsx
-- ===================================================
*/
import React, { useMemo } from 'react';
import { useAcoesList } from '@/hooks/useAcoesList';
import { ChatListItem } from '@/types/chat';
import { Skeleton } from '@/components/ui/Skeleton';
import clsx from 'clsx';

// --- Types ---
type Budget = NonNullable<NonNullable<ChatListItem['budgets']>[0]>;
type FlattenedBudget = Budget & {
  chatId: string;
  companyName: string;
  contactName: string;
};
type TotalsMap = Map<string, number>;

// --- Helpers ---
/**
 * Formata um valor monetário assumindo que o número já está em reais.
 * Ex.: 80000 -> "R$ 80.000,00"
 */
const formatCurrency = (amount: number | null | undefined): string => {
  const safeAmount = amount ?? 0;
  return safeAmount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Data inválida';
  }
};

// --- Components ---

const StatusBadge: React.FC<{ status: Budget['status'] }> = ({ status }) => {
  const styles: Record<string, string> = {
    aberta: 'bg-yellow-100 text-yellow-800',
    ganha: 'bg-green-100 text-green-800',
    perdida: 'bg-red-100 text-red-800',
  };
  const safeStatus = status || 'aberta';
  const label = safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1);
  return (
    <span
      className={clsx(
        'text-xs font-medium me-2 px-2.5 py-0.5 rounded',
        styles[safeStatus] || styles['aberta']
      )}
    >
      {label}
    </span>
  );
};

const OrcamentosSummary: React.FC<{
  totalsByCompany: TotalsMap;
  totalsByStatus: TotalsMap;
}> = ({ totalsByCompany, totalsByStatus }) => (
  <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
    <div className="neumorphic-convex rounded-2xl p-4">
      <h3 className="font-semibold mb-2 text-gray-700 dark:text-dark-t1">
        Total por Empresa
      </h3>
      <div className="space-y-1 text-sm">
        {Array.from(totalsByCompany.entries()).map(([name, total]) => (
          <div key={name} className="flex justify-between">
            <span>{name}</span>
            <span className="font-mono">{formatCurrency(total)}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="neumorphic-convex rounded-2xl p-4">
      <h3 className="font-semibold mb-2 text-gray-700 dark:text-dark-t1">
        Total por Status
      </h3>
      <div className="space-y-1 text-sm">
        {Array.from(totalsByStatus.entries()).map(([status, total]) => (
          <div key={status} className="flex justify-between">
            <span className="capitalize">{status}</span>
            <span className="font-mono">{formatCurrency(total)}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const OrcamentosTable: React.FC<{ items: FlattenedBudget[] }> = ({ items }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500 dark:text-dark-t2 border-b border-gray-200/60 dark:border-white/10/60">
          <th className="py-2 px-3 font-semibold">Empresa</th>
          <th className="py-2 px-3 font-semibold">Contato</th>
          <th className="py-2 px-3 font-semibold">Descrição</th>
          <th className="py-2 px-3 font-semibold text-right">Valor</th>
          <th className="py-2 px-3 font-semibold">Status</th>
          <th className="py-2 px-3 font-semibold">Última Atualização</th>
          <th className="py-2 px-3 font-semibold">Motivo da Perda</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr
            key={`${item.chatId}-${item.id || item.description}`}
            className="border-b border-gray-200/60 dark:border-white/10/60 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <td className="py-3 px-3 align-top font-medium">
              {item.companyName}
            </td>
            <td className="py-3 px-3 align-top">{item.contactName}</td>
            <td className="py-3 px-3 align-top">
              {item.description || '-'}
            </td>
            <td className="py-3 px-3 align-top text-right font-mono">
              {formatCurrency(item.amount)}
            </td>
            <td className="py-3 px-3 align-top">
              <StatusBadge status={item.status} />
            </td>
            <td className="py-3 px-3 align-top">
              {formatDateTime(item.updated_at)}
            </td>
            <td className="py-3 px-3 align-top">
              {item.loss_reason || '-'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const OrcamentosListTab: React.FC = () => {
  const { items: chatItems, loading, error } = useAcoesList({ pageSize: 5000 });

  const {
    flattenedBudgets,
    totalsByCompany,
    totalsByStatus,
  } = useMemo(() => {
    const flattened: FlattenedBudget[] = [];
    const byCompany: TotalsMap = new Map();
    const byStatus: TotalsMap = new Map([
      ['aberta', 0],
      ['ganha', 0],
      ['perdida', 0],
    ]);

    const budgetChats = chatItems.filter(
      (chat) => chat.channel_type === 'orcamento'
    );

    budgetChats.forEach((chat) => {
      if (chat.budgets && chat.budgets.length > 0) {
        chat.budgets.forEach((budget) => {
          const amount = budget.amount ?? 0; // valor em REAIS

          flattened.push({
            ...budget,
            chatId: chat.id,
            companyName: chat.company_name || 'N/A',
            contactName: chat.contact_name || 'N/A',
          });

          // Aggregate totals em reais
          const companyKey = chat.company_name || 'N/A';
          const companyTotal = byCompany.get(companyKey) || 0;
          byCompany.set(companyKey, companyTotal + amount);

          const statusKey = budget.status || 'aberta';
          const statusTotal = byStatus.get(statusKey) || 0;
          byStatus.set(statusKey, statusTotal + amount);
        });
      }
    });

    return {
      flattenedBudgets: flattened,
      totalsByCompany: byCompany,
      totalsByStatus: byStatus,
    };
  }, [chatItems]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500">{error}</p>;
  }

  if (flattenedBudgets.length === 0) {
    return (
      <div className="neumorphic-convex rounded-2xl p-8 text-center text-gray-500">
        Nenhum orçamento encontrado.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <OrcamentosSummary
        totalsByCompany={totalsByCompany}
        totalsByStatus={totalsByStatus}
      />
      <section className="neumorphic-convex rounded-2xl p-4 sm:p-6">
        <OrcamentosTable items={flattenedBudgets} />
      </section>
    </div>
  );
};

export default OrcamentosListTab;

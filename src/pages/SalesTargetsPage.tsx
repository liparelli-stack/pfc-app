/*
-- =====================================================================================================
-- Código             : src/pages/SalesTargetsPage.tsx
-- Versão (.v20)      : 0.1.0
-- Data/Hora          : 2026-03-24 19:00 America/Sao_Paulo
-- Autor              : FL / Execução via (Eva Claude Modelo) (Alpha Dualite modelo LLM)
-- Objetivo do codigo : Tela de Metas Mensais:
--                      • Grid vendedores × meses (últimos 12)
--                      • Células editáveis inline com máscara BRL (admin only)
--                      • Salvar automático com debounce 1s
--                      • Linha de total no rodapé (soma por mês)
--                      • Scroll horizontal, primeira coluna sticky
-- Dependências       : useSalesTargets, profilesService, AuthContext, Design System v0101
-- Versão/Alteração   :
-- [ 0.1.0 ]          : Versão inicial
-- =====================================================================================================
*/

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentProfile } from '@/services/profilesService';
import { useSalesTargets } from '@/hooks/useSalesTargets';
import { Target, Loader2, AlertTriangle } from 'lucide-react';

/* ============================================================
   Helpers de formatação BRL
   ============================================================ */

const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatMonthHeader(mes: string): string {
  const [y, m] = mes.split('-');
  return `${MONTH_ABBR[parseInt(m, 10) - 1]}/${y.slice(2)}`;
}

function formatBRL(value: number): string {
  if (!value) return '';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

/** Converte string editada pelo usuário em número */
function parseBRL(raw: string): number {
  // Remove R$, espaços, pontos de milhar; troca vírgula decimal por ponto
  const cleaned = raw.replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.max(0, num);
}

/** Formata número para exibição no input (sem símbolo, com vírgula decimal) */
function toInputDisplay(value: number): string {
  if (!value) return '';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/* ============================================================
   Tipos internos
   ============================================================ */

type CellKey = string; // `${sellerId}|${YYYY-MM-DD}`

/* ============================================================
   Subcomponente: Célula editável
   ============================================================ */

interface TargetCellProps {
  cellKey: CellKey;
  savedValue: number;
  isAdmin: boolean;
  onCommit: (key: CellKey, amount: number) => void;
}

const TargetCell: React.FC<TargetCellProps> = ({ cellKey, savedValue, isAdmin, onCommit }) => {
  const [focused, setFocused] = useState(false);
  const [inputVal, setInputVal] = useState('');

  const handleFocus = () => {
    setFocused(true);
    setInputVal(toInputDisplay(savedValue));
  };

  const handleBlur = () => {
    setFocused(false);
    const amount = parseBRL(inputVal);
    onCommit(cellKey, amount);
    setInputVal('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputVal(e.target.value);
  };

  if (!isAdmin) {
    return (
      <td className="py-2.5 px-3 text-right text-sm tabular-nums text-light-t1 dark:text-dark-t1 whitespace-nowrap">
        {savedValue ? formatBRL(savedValue) : <span className="text-light-t3 dark:text-dark-t3">—</span>}
      </td>
    );
  }

  return (
    <td className="py-1.5 px-2 text-right">
      {focused ? (
        <input
          type="text"
          autoFocus
          value={inputVal}
          onChange={handleChange}
          onBlur={handleBlur}
          className="w-full min-w-[110px] text-right text-sm tabular-nums
                     bg-white dark:bg-dark-s2 border border-accent-light dark:border-accent-dark
                     rounded-r text-light-t1 dark:text-dark-t1 px-2 py-1 outline-none
                     focus:ring-2 focus:ring-accent-light/30 dark:focus:ring-accent-dark/30"
          placeholder="0,00"
        />
      ) : (
        <button
          onClick={handleFocus}
          className="w-full min-w-[110px] text-right text-sm tabular-nums px-2 py-1 rounded-r
                     hover:bg-light-s2 dark:hover:bg-dark-s2 transition-colors
                     text-light-t1 dark:text-dark-t1"
        >
          {savedValue
            ? formatBRL(savedValue)
            : <span className="text-light-t3 dark:text-dark-t3">—</span>}
        </button>
      )}
    </td>
  );
};

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */

const SalesTargetsPage: React.FC = () => {
  const { session } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  /* Verificação de admin — mesmo padrão de MonthlyClosurePage */
  useEffect(() => {
    let mounted = true;
    getCurrentProfile()
      .then((p) => { if (mounted) setIsAdmin(p?.role === 'admin'); })
      .catch(() => { if (mounted) setIsAdmin(false); });
    return () => { mounted = false; };
  }, [session]);

  const { sellers, months, targetMap, isLoading, isError, saveMutation } = useSalesTargets();

  /** Salva direto no blur — sem debounce */
  const handleCommit = useCallback(
    (key: CellKey, amount: number) => {
      const [sellerId, mes] = key.split('|');
      saveMutation.mutate({ sellerId, mes, amount });
    },
    [saveMutation],
  );

  /* ---- Totais por mês ---- */
  const monthTotal = (mes: string): number =>
    sellers.reduce((sum, s) => sum + (targetMap[`${s.id}|${mes}`] ?? 0), 0);

  /* ---- Render ---- */
  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-accent-light dark:text-accent-dark" />
          <h2 className="text-lg font-semibold text-light-t1 dark:text-dark-t1">
            Metas Mensais
          </h2>
        </div>
        {!isAdmin && (
          <span className="text-xs text-light-t3 dark:text-dark-t3">
            Somente administradores podem editar metas.
          </span>
        )}
        {saveMutation.isPending && (
          <span className="flex items-center gap-1.5 text-xs text-light-t3 dark:text-dark-t3">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Salvando…
          </span>
        )}
      </div>

      {/* Estados de carregamento / erro */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-accent-light dark:text-accent-dark" />
          <span className="ml-2 text-sm text-light-t2 dark:text-dark-t2">Carregando metas…</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className="flex items-center gap-2 rounded-rlg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Erro ao carregar metas. Tente recarregar a página.</span>
        </div>
      )}

      {saveMutation.isError && (
        <div className="flex items-center gap-2 rounded-rlg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Erro ao salvar: {saveMutation.error?.message}</span>
        </div>
      )}

      {/* Grid */}
      {!isLoading && !isError && (
        <div className="overflow-x-auto rounded-xl border border-light-bmd dark:border-dark-bmd shadow-sh1">
          <table className="min-w-full border-collapse text-sm">
            {/* Cabeçalho */}
            <thead>
              <tr className="bg-light-s2 dark:bg-dark-s2 border-b border-light-bmd dark:border-dark-bmd">
                {/* Coluna vendedor — sticky */}
                <th
                  className="sticky left-0 z-10 bg-light-s2 dark:bg-dark-s2
                             py-3 px-4 text-left font-semibold text-light-t1 dark:text-dark-t1
                             border-r border-light-bmd dark:border-dark-bmd whitespace-nowrap"
                >
                  Vendedor
                </th>
                {months.map((mes) => (
                  <th
                    key={mes}
                    className="py-3 px-3 text-right font-semibold text-light-t1 dark:text-dark-t1 whitespace-nowrap"
                  >
                    {formatMonthHeader(mes)}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Corpo */}
            <tbody className="divide-y divide-light-bmd dark:divide-dark-bmd">
              {console.log('Renderizando vendedores:', sellers) as unknown as null}
              {sellers.length === 0 && (
                <tr>
                  <td
                    colSpan={months.length + 1}
                    className="py-8 px-4 text-center text-sm text-light-t3 dark:text-dark-t3"
                  >
                    Nenhum vendedor encontrado.
                  </td>
                </tr>
              )}
              {sellers.map((seller, idx) => (
                <tr
                  key={seller.id}
                  className={
                    idx % 2 === 0
                      ? 'bg-light-s1 dark:bg-dark-s1'
                      : 'bg-light-s2/40 dark:bg-dark-s2/40'
                  }
                >
                  {/* Nome do vendedor — sticky */}
                  <td
                    className="sticky left-0 z-10 py-2.5 px-4
                               font-medium text-light-t1 dark:text-dark-t1 whitespace-nowrap
                               border-r border-light-bmd dark:border-dark-bmd"
                    style={{
                      background: idx % 2 === 0
                        ? 'var(--color-light-s1, #EEF0F4)'
                        : 'rgba(var(--color-light-s2-rgb, 248 249 251) / 0.4)',
                    }}
                  >
                    {seller.full_name}
                  </td>
                  {months.map((mes) => (
                    <TargetCell
                      key={mes}
                      cellKey={`${seller.id}|${mes}`}
                      savedValue={targetMap[`${seller.id}|${mes}`] ?? 0}
                      isAdmin={isAdmin}
                      onCommit={handleCommit}
                    />
                  ))}
                </tr>
              ))}
            </tbody>

            {/* Rodapé — totais por mês */}
            <tfoot>
              <tr className="border-t-2 border-light-bmd dark:border-dark-bmd bg-light-s2 dark:bg-dark-s2">
                <td
                  className="sticky left-0 z-10 bg-light-s2 dark:bg-dark-s2
                             py-3 px-4 font-bold text-light-t1 dark:text-dark-t1
                             border-r border-light-bmd dark:border-dark-bmd whitespace-nowrap"
                >
                  Total
                </td>
                {months.map((mes) => {
                  const total = monthTotal(mes);
                  return (
                    <td
                      key={mes}
                      className="py-3 px-3 text-right font-bold tabular-nums text-light-t1 dark:text-dark-t1 whitespace-nowrap"
                    >
                      {total ? formatBRL(total) : <span className="text-light-t3 dark:text-dark-t3">—</span>}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default SalesTargetsPage;

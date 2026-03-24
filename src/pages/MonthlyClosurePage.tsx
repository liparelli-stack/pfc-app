/*
-- =====================================================================================================
-- Código             : src/pages/MonthlyClosurePage.tsx
-- Versão (.v20)      : 0.1.0
-- Data/Hora          : 2026-03-24 19:00 America/Sao_Paulo
-- Autor              : FL / Execução via (Eva Claude Modelo) (Alpha Dualite modelo LLM)
-- Objetivo do codigo : Página de fechamento mensal de orçamentos no Hub de Gestão:
--                      • Visualização híbrida: mês aberto (tempo real) vs fechado (snapshot)
--                      • Comparação meta vs realizado por vendedor
--                      • Fechamento manual com confirmação (só admin)
--                      • Exportação Excel/CSV/PDF
-- Dependências       : monthlyClosureService.ts → useMonthlyClosureData.ts → MonthlyClosurePage.tsx
-- Versão/Alteração   :
-- [ 0.1.0 ]          : Versão inicial - SUP-000004
-- =====================================================================================================
*/

import React, { useState, useEffect } from 'react';
import { Lock, RefreshCw, FileSpreadsheet, FileText, FileDown, AlertTriangle, TrendingUp, TrendingDown, Target, DollarSign } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentProfile } from '@/services/profilesService';
import { useMonthlyClosureData } from '@/hooks/useMonthlyClosureData';
import { exportToExcel, exportToCSV, exportToPDF } from '@/utils/exporters/monthlyClosureExporter';
import type { SellerRow } from '@/services/monthlyClosureService';

/* ============================================================
   Helpers
   ============================================================ */

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

/** Gera lista dos últimos N meses no formato YYYY-MM */
function buildMonthOptions(count = 12): string[] {
  const options: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    options.push(`${yyyy}-${mm}`);
  }
  return options;
}

function currentYYYYMM(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/* ============================================================
   Sub-componente: Card de resumo
   ============================================================ */
interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon, label, value, sub, highlight }) => (
  <div
    className={clsx(
      'rounded-xl p-4 flex items-center gap-3',
      'bg-light-s1 border border-light-bmd shadow-[var(--sh1)]',
      highlight && 'border-accent-light/40',
    )}
  >
    <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-accent-light/10 flex items-center justify-center text-accent-light">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-xs text-light-t3 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-light-t1 leading-tight">{value}</p>
      {sub && <p className="text-xs text-light-t2">{sub}</p>}
    </div>
  </div>
);

/* ============================================================
   Sub-componente: Barra de progresso
   ============================================================ */
const ProgressBar: React.FC<{ pct: number }> = ({ pct }) => {
  const clamped = Math.min(pct, 200);
  const color =
    pct >= 100 ? '#3ecf8e' :
    pct >= 70  ? '#f59e0b' :
                 '#f06060';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-light-s2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(clamped / 200) * 100}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold w-11 text-right" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
};

/* ============================================================
   Sub-componente: Modal de confirmação de fechamento
   ============================================================ */
interface ConfirmCloseModalProps {
  mes: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}

const ConfirmCloseModal: React.FC<ConfirmCloseModalProps> = ({ mes, onConfirm, onCancel, isPending }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
    <div className="bg-light-s1 rounded-2xl shadow-[var(--sh2)] p-8 max-w-md w-full mx-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-full bg-warning/15 flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-warning" />
        </div>
        <h2 className="text-xl font-bold text-light-t1">Fechar Mês {mes}?</h2>
      </div>
      <p className="text-light-t2 text-sm mb-6">
        Esta ação é <strong className="text-light-t1">irreversível</strong>. O fechamento cria um
        snapshot permanente dos dados atuais. Após fechado, o mês não poderá ser reaberto.
      </p>
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-medium text-light-t2 hover:bg-light-s2 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className="px-4 py-2 rounded-lg text-sm font-bold bg-warning text-white hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {isPending ? 'Fechando…' : 'Confirmar Fechamento'}
        </button>
      </div>
    </div>
  </div>
);

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
const MonthlyClosurePage: React.FC = () => {
  const { session } = useAuth();
  const [selectedMes, setSelectedMes] = useState<string>(currentYYYYMM);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const monthOptions = buildMonthOptions(12);

  /* Verificação de admin */
  useEffect(() => {
    let mounted = true;
    getCurrentProfile()
      .then((p) => { if (mounted) setIsAdmin(p?.role === 'admin'); })
      .catch(() => { if (mounted) setIsAdmin(false); });
    return () => { mounted = false; };
  }, [session]);

  const { data, isLoading, isError, error, isClosed, closeMutation } =
    useMonthlyClosureData(selectedMes);

  /* Handlers de exportação */
  const handleExportExcel = () => data && exportToExcel(data);
  const handleExportCSV   = () => data && exportToCSV(data);
  const handleExportPDF   = () => data && exportToPDF(data);

  const handleCloseMonth = () => {
    closeMutation.mutate();
    setShowConfirm(false);
  };

  /* ---- Render ---- */
  return (
    <div className="space-y-6">
      {/* ---- Cabeçalho ---- */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-light-t1">Fechamento Mensal</h2>

          {/* Status badge */}
          {data && (
            <span
              className={clsx(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold',
                isClosed
                  ? 'bg-light-t3/20 text-light-t2'
                  : 'bg-success/15 text-success',
              )}
            >
              {isClosed ? (
                <><Lock className="h-3.5 w-3.5" /> Fechado</>
              ) : (
                <><RefreshCw className="h-3.5 w-3.5" /> Aberto — tempo real</>
              )}
            </span>
          )}
        </div>

        {/* Controles direita */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor de mês */}
          <select
            value={selectedMes}
            onChange={(e) => setSelectedMes(e.target.value)}
            className="rounded-lg border border-light-bmd bg-light-s1 text-light-t1 text-sm px-3 py-2 shadow-[var(--sh1)] focus:outline-none focus:ring-2 focus:ring-accent-light/40"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Exportar */}
          {data && data.sellers.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleExportExcel}
                title="Exportar Excel"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-light-s1 border border-light-bmd text-light-t2 hover:text-accent-light hover:border-accent-light/40 shadow-[var(--sh1)] transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </button>
              <button
                type="button"
                onClick={handleExportCSV}
                title="Exportar CSV"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-light-s1 border border-light-bmd text-light-t2 hover:text-accent-light hover:border-accent-light/40 shadow-[var(--sh1)] transition-colors"
              >
                <FileText className="h-4 w-4" /> CSV
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                title="Exportar PDF"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-light-s1 border border-light-bmd text-light-t2 hover:text-accent-light hover:border-accent-light/40 shadow-[var(--sh1)] transition-colors"
              >
                <FileDown className="h-4 w-4" /> PDF
              </button>
            </>
          )}

          {/* Fechar mês (admin + aberto) */}
          {isAdmin && !isClosed && data && (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-warning text-white hover:opacity-90 shadow-[var(--sh1)] transition-opacity"
            >
              <Lock className="h-4 w-4" /> Fechar Mês
            </button>
          )}
        </div>
      </div>

      {/* ---- Loading ---- */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 text-light-t2">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Carregando dados de {selectedMes}…
        </div>
      )}

      {/* ---- Erro ---- */}
      {isError && (
        <div className="rounded-xl bg-danger/10 border border-danger/30 p-4 text-danger text-sm">
          <strong>Erro ao carregar dados:</strong> {error?.message ?? 'Falha desconhecida.'}
        </div>
      )}

      {/* ---- Conteúdo principal ---- */}
      {!isLoading && !isError && data && (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              icon={<DollarSign className="h-5 w-5" />}
              label="Total Ganho"
              value={brl(data.total_realized)}
              highlight
            />
            <SummaryCard
              icon={<Target className="h-5 w-5" />}
              label="Total Meta"
              value={brl(data.total_goal)}
            />
            <SummaryCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Performance Geral"
              value={`${data.performance}%`}
              sub={data.total_goal > 0 ? `de ${brl(data.total_goal)}` : 'Meta não definida'}
            />
            <SummaryCard
              icon={<TrendingDown className="h-5 w-5" />}
              label="Total Perdido"
              value={brl(data.total_lost)}
            />
          </div>

          {/* Info de fechamento */}
          {isClosed && data.closed_at && (
            <div className="flex items-center gap-2 text-xs text-light-t2 px-1">
              <Lock className="h-3.5 w-3.5" />
              Snapshot registrado em {new Date(data.closed_at).toLocaleString('pt-BR')}
            </div>
          )}

          {/* Tabela de vendedores */}
          {data.sellers.length === 0 ? (
            <div className="rounded-xl bg-light-s1 border border-light-bmd shadow-[var(--sh1)] p-10 text-center text-light-t2 text-sm">
              Nenhum orçamento registrado para {selectedMes}.
            </div>
          ) : (
            <div className="rounded-xl bg-light-s1 border border-light-bmd shadow-[var(--sh1)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-light-bmd bg-light-s2/50">
                      <th className="py-3 px-4 text-left font-semibold text-light-t2">Vendedor</th>
                      <th className="py-3 px-4 text-right font-semibold text-light-t2">Meta R$</th>
                      <th className="py-3 px-4 text-right font-semibold text-light-t2">Realizado R$</th>
                      <th className="py-3 px-4 text-right font-semibold text-light-t2">Qtd</th>
                      <th className="py-3 px-4 text-left font-semibold text-light-t2 min-w-[160px]">Performance</th>
                      <th className="py-3 px-4 text-right font-semibold text-light-t2">Perdido R$</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.sellers]
                      .sort((a, b) => b.performance - a.performance)
                      .map((seller: SellerRow) => (
                        <tr
                          key={seller.profile_id}
                          className="border-b border-light-bmd/60 hover:bg-light-s2/50 transition-colors"
                        >
                          <td className="py-3 px-4 font-medium text-light-t1">{seller.seller_name}</td>
                          <td className="py-3 px-4 text-right text-light-t2">
                            {seller.goal > 0 ? brl(seller.goal) : <span className="text-light-t3">—</span>}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-light-t1">
                            {brl(seller.realized)}
                          </td>
                          <td className="py-3 px-4 text-right text-light-t2">{seller.count}</td>
                          <td className="py-3 px-4">
                            {seller.goal > 0 ? (
                              <ProgressBar pct={seller.performance} />
                            ) : (
                              <span className="text-xs text-light-t3">Sem meta</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right text-danger/80">
                            {seller.lost > 0 ? brl(seller.lost) : <span className="text-light-t3">—</span>}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  {/* Linha de totais */}
                  <tfoot>
                    <tr className="border-t-2 border-light-bmd bg-light-s2/70">
                      <td className="py-3 px-4 font-bold text-light-t1">Total</td>
                      <td className="py-3 px-4 text-right font-bold text-light-t1">
                        {data.total_goal > 0 ? brl(data.total_goal) : <span className="text-light-t3">—</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-light-t1">
                        {brl(data.total_realized)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-light-t1">
                        {data.sellers.reduce((s, r) => s + r.count, 0)}
                      </td>
                      <td className="py-3 px-4">
                        {data.total_goal > 0 ? (
                          <ProgressBar pct={data.performance} />
                        ) : (
                          <span className="text-xs text-light-t3">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-danger/80">
                        {data.total_lost > 0 ? brl(data.total_lost) : <span className="text-light-t3">—</span>}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Erro ao fechar mês */}
          {closeMutation.isError && (
            <div className="rounded-lg bg-danger/10 border border-danger/30 p-3 text-danger text-sm">
              {closeMutation.error?.message ?? 'Falha ao fechar o mês.'}
            </div>
          )}
        </>
      )}

      {/* Modal de confirmação */}
      {showConfirm && (
        <ConfirmCloseModal
          mes={selectedMes}
          onConfirm={handleCloseMonth}
          onCancel={() => setShowConfirm(false)}
          isPending={closeMutation.isPending}
        />
      )}
    </div>
  );
};

export default MonthlyClosurePage;

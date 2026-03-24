/*
-- =====================================================================================================
-- Código             : src/pages/MonthlyClosurePage.tsx
-- Versão (.v20)      : 0.2.0
-- Data/Hora          : 2026-03-24 19:00 America/Sao_Paulo
-- Autor              : FL / Execução via (Eva Claude Modelo) (Alpha Dualite modelo LLM)
-- Objetivo do codigo : Página de fechamento mensal de orçamentos no Hub de Gestão:
--                      • Visualização híbrida: mês aberto (tempo real) vs fechado (snapshot)
--                      • Tabela de resumo por status (ganha/perdida/aberta/encerrada)
--                      • Fechamento manual com confirmação (só admin)
--                      • Exportação Excel/CSV/PDF
-- Dependências       : monthlyClosureService.ts → useMonthlyClosureData.ts → MonthlyClosurePage.tsx
-- Versão/Alteração   :
-- [ 0.1.0 ]          : Versão inicial
-- [ 0.2.0 ]          : selectedMonth inicia null (sem autoload); carrega no onChange;
--                      display atualizado para schema real (qty_X/total_X, sem sellers[])
-- =====================================================================================================
*/

import React, { useState, useEffect } from 'react';
import {
  Lock, RefreshCw, FileSpreadsheet, FileText, FileDown,
  AlertTriangle, TrendingUp, TrendingDown, Target, DollarSign, CalendarSearch,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentProfile } from '@/services/profilesService';
import { useMonthlyClosureData } from '@/hooks/useMonthlyClosureData';
import { exportToExcel, exportToCSV, exportToPDF } from '@/utils/exporters/monthlyClosureExporter';

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
        Esta ação é <strong className="text-light-t1">irreversível</strong>. Após fechado,
        os dados do período serão travados e não poderão ser reabertos.
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
  // Estado inicial null: nenhuma query disparada até o usuário selecionar um mês
  const [selectedMes, setSelectedMes] = useState<string | null>(null);
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

  // Hook recebe '' quando null → hook interno tem `enabled: !!mes`, não dispara
  const { data, isLoading, isError, error, isClosed, closeMutation } =
    useMonthlyClosureData(selectedMes ?? '');

  const hasData = !!data && (data.qty_ganha > 0 || data.total_ganha > 0 ||
    data.qty_perdida > 0 || data.qty_aberta > 0 || data.qty_encerrada > 0);

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

          {/* Status badge — só aparece após seleção */}
          {selectedMes && data && (
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
          {/* Seletor de mês — carrega no onChange, sem botão Buscar */}
          <select
            value={selectedMes ?? ''}
            onChange={(e) => setSelectedMes(e.target.value || null)}
            className="rounded-lg border border-light-bmd bg-light-s1 text-light-t1 text-sm px-3 py-2 shadow-[var(--sh1)] focus:outline-none focus:ring-2 focus:ring-accent-light/40"
          >
            <option value="" disabled>— Selecione um mês —</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Exportar — só quando há dados */}
          {selectedMes && hasData && (
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

          {/* Fechar mês (admin + aberto + mês selecionado) */}
          {isAdmin && selectedMes && !isClosed && data && (
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

      {/* ---- Estado: nenhum mês selecionado ---- */}
      {!selectedMes && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-light-t2">
          <CalendarSearch className="h-12 w-12 text-light-t3" />
          <p className="text-base font-medium">Selecione um mês para visualizar</p>
          <p className="text-sm text-light-t3">Use o seletor acima para escolher o período.</p>
        </div>
      )}

      {/* ---- Loading ---- */}
      {selectedMes && isLoading && (
        <div className="flex items-center justify-center py-20 text-light-t2">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Carregando dados de {selectedMes}…
        </div>
      )}

      {/* ---- Erro ---- */}
      {selectedMes && isError && (
        <div className="rounded-xl bg-danger/10 border border-danger/30 p-4 text-danger text-sm">
          <strong>Erro ao carregar dados:</strong> {error?.message ?? 'Falha desconhecida.'}
        </div>
      )}

      {/* ---- Conteúdo principal ---- */}
      {selectedMes && !isLoading && !isError && data && (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              icon={<DollarSign className="h-5 w-5" />}
              label="Total Ganho"
              value={brl(data.total_ganha)}
              sub={`${data.qty_ganha} negócio${data.qty_ganha !== 1 ? 's' : ''}`}
              highlight
            />
            <SummaryCard
              icon={<Target className="h-5 w-5" />}
              label="Meta do Período"
              value={data.target_amount > 0 ? brl(data.target_amount) : '—'}
              sub={data.target_quantity > 0 ? `${data.target_quantity} qtd alvo` : undefined}
            />
            <SummaryCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Performance"
              value={data.target_amount > 0 ? `${data.performance_pct}%` : '—'}
              sub={data.target_amount > 0 ? `de ${brl(data.target_amount)}` : 'Meta não definida'}
            />
            <SummaryCard
              icon={<TrendingDown className="h-5 w-5" />}
              label="Total Perdido"
              value={brl(data.total_perdida)}
              sub={`${data.qty_perdida} negócio${data.qty_perdida !== 1 ? 's' : ''}`}
            />
          </div>

          {/* Info de fechamento */}
          {isClosed && data.closed_at && (
            <div className="flex items-center gap-2 text-xs text-light-t2 px-1">
              <Lock className="h-3.5 w-3.5" />
              Fechado em {new Date(data.closed_at).toLocaleString('pt-BR')}
              {data.auto_closed && <span className="ml-1 text-light-t3">(automático)</span>}
            </div>
          )}

          {/* Tabela de resumo por status */}
          {!hasData ? (
            <div className="rounded-xl bg-light-s1 border border-light-bmd shadow-[var(--sh1)] p-10 text-center text-light-t2 text-sm">
              Nenhum orçamento registrado para {selectedMes}.
            </div>
          ) : (
            <div className="rounded-xl bg-light-s1 border border-light-bmd shadow-[var(--sh1)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-light-bmd bg-light-s2/50">
                      <th className="py-3 px-4 text-left font-semibold text-light-t2">Status</th>
                      <th className="py-3 px-4 text-right font-semibold text-light-t2">Qtd</th>
                      <th className="py-3 px-4 text-right font-semibold text-light-t2">Total R$</th>
                      {data.target_amount > 0 && (
                        <th className="py-3 px-4 text-left font-semibold text-light-t2 min-w-[160px]">
                          Performance
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Ganha */}
                    <tr className="border-b border-light-bmd/60 hover:bg-light-s2/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-2 font-medium text-success">
                          <span className="h-2 w-2 rounded-full bg-success inline-block" />
                          Ganha
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-light-t1">{data.qty_ganha}</td>
                      <td className="py-3 px-4 text-right font-semibold text-light-t1">{brl(data.total_ganha)}</td>
                      {data.target_amount > 0 && (
                        <td className="py-3 px-4"><ProgressBar pct={data.performance_pct} /></td>
                      )}
                    </tr>
                    {/* Perdida */}
                    <tr className="border-b border-light-bmd/60 hover:bg-light-s2/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-2 font-medium text-danger">
                          <span className="h-2 w-2 rounded-full bg-danger inline-block" />
                          Perdida
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-light-t1">{data.qty_perdida}</td>
                      <td className="py-3 px-4 text-right text-light-t1">{brl(data.total_perdida)}</td>
                      {data.target_amount > 0 && <td className="py-3 px-4" />}
                    </tr>
                    {/* Aberta */}
                    {data.qty_aberta > 0 && (
                      <tr className="border-b border-light-bmd/60 hover:bg-light-s2/50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-2 font-medium text-warning">
                            <span className="h-2 w-2 rounded-full bg-warning inline-block" />
                            Aberta
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-light-t1">{data.qty_aberta}</td>
                        <td className="py-3 px-4 text-right text-light-t1">{brl(data.total_aberta)}</td>
                        {data.target_amount > 0 && <td className="py-3 px-4" />}
                      </tr>
                    )}
                    {/* Encerrada */}
                    {data.qty_encerrada > 0 && (
                      <tr className="border-b border-light-bmd/60 hover:bg-light-s2/50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-2 font-medium text-light-t2">
                            <span className="h-2 w-2 rounded-full bg-light-t3 inline-block" />
                            Encerrada
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-light-t1">{data.qty_encerrada}</td>
                        <td className="py-3 px-4 text-right text-light-t1">{brl(data.total_encerrada)}</td>
                        {data.target_amount > 0 && <td className="py-3 px-4" />}
                      </tr>
                    )}
                  </tbody>
                  {/* Linha de totais */}
                  <tfoot>
                    <tr className="border-t-2 border-light-bmd bg-light-s2/70">
                      <td className="py-3 px-4 font-bold text-light-t1">Total</td>
                      <td className="py-3 px-4 text-right font-bold text-light-t1">
                        {data.qty_ganha + data.qty_perdida + data.qty_aberta + data.qty_encerrada}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-light-t1">
                        {brl(data.total_ganha + data.total_perdida + data.total_aberta + data.total_encerrada)}
                      </td>
                      {data.target_amount > 0 && <td className="py-3 px-4" />}
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
      {showConfirm && selectedMes && (
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

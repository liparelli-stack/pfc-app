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
  Lock, RefreshCw, FileSpreadsheet, FileText, FileDown, Search,
  AlertTriangle, TrendingUp, TrendingDown, Target, DollarSign, CalendarSearch,
  HelpCircle, X, Database,
} from 'lucide-react';
import clsx from 'clsx';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { getCurrentProfile } from '@/services/profilesService';
import { getVendedorData, createBaseline, checkBaselineExists, getDetalhamentoMes } from '@/services/monthlyClosureService';
import { supabase } from '@/lib/supabaseClient';
import { useMonthlyClosureData } from '@/hooks/useMonthlyClosureData';
import { exportToCSV, exportDetalhamentoExcel } from '@/utils/exporters/monthlyClosureExporter';

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
  const { session, currentProfileLite } = useAuth();
  const { addToast } = useToast();
  // Estado inicial null: nenhuma query disparada até o usuário selecionar um mês
  const [selectedMes, setSelectedMes] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [hasBaseline, setHasBaseline] = useState(true);
  const [showBaselineModal, setShowBaselineModal] = useState(false);
  const [baselineLoading, setBaselineLoading] = useState(false);
  const monthOptions = buildMonthOptions(12);

  /* Verificação de admin */
  useEffect(() => {
    let mounted = true;
    getCurrentProfile()
      .then((p) => { if (mounted) setIsAdmin(p?.role === 'admin'); })
      .catch(() => { if (mounted) setIsAdmin(false); });
    return () => { mounted = false; };
  }, [session]);

  /* Verificação de baseline */
  useEffect(() => {
    let mounted = true;
    checkBaselineExists()
      .then((exists) => { if (mounted) setHasBaseline(exists); })
      .catch(() => { if (mounted) setHasBaseline(true); }); // conservador: não exibe botão em caso de erro
    return () => { mounted = false; };
  }, []);

  const handleCreateBaseline = async () => {
    setBaselineLoading(true);
    try {
      const result = await createBaseline();
      addToast(`Baseline criado: ${result.records} orçamentos importados.`, 'success');
      setHasBaseline(true);
      setShowBaselineModal(false);
    } catch (e: any) {
      addToast(e?.message || 'Falha ao criar baseline.', 'error');
    } finally {
      setBaselineLoading(false);
    }
  };

  // Hook recebe '' quando null → hook interno tem `enabled: !!mes`, não dispara
  const { data, isLoading, isError, error, isClosed, closeMutation } =
    useMonthlyClosureData(selectedMes ?? '');

  const hasData = !!data && (data.qty_ganha > 0 || data.total_ganha > 0 ||
    data.qty_perdida > 0 || data.qty_aberta > 0 || data.qty_encerrada > 0);

  /* Handlers de exportação */
  const handleExportExcel = async () => {
    if (!selectedMes) return;
    const [yearStr, monthStr] = selectedMes.split('-');
    const selectedYear  = parseInt(yearStr, 10);
    const selectedMonth = monthStr;
    try {
      const vendedorData = await getVendedorData(selectedMonth, selectedYear, supabase);

      const headers = [
        'Vendedor', 'Meta (R$)', 'Ganhos (R$)', '(%) Atingido Meta',
        '% Participação Resultado', 'Qtd Ganhos', 'Ticket Médio (R$)',
        'Em Espera (R$)', 'Qtd', 'Perdido (R$)', '% Perda sobre Ganhos', 'Qtd Perdidos',
      ];

      const rows = vendedorData.map(v => [
        v.vendedor, v.meta, v.ganhos, v.percentualAtingido,
        v.participacao, v.qtdGanhos, v.ticketMedio,
        v.emEspera, v.qtdEspera, v.perdidos, v.percentualPerda, v.qtdPerdidos,
      ]);

      const totais = vendedorData.reduce(
        (acc, v) => ({
          meta:        acc.meta        + v.meta,
          ganhos:      acc.ganhos      + v.ganhos,
          qtdGanhos:   acc.qtdGanhos   + v.qtdGanhos,
          emEspera:    acc.emEspera    + v.emEspera,
          qtdEspera:   acc.qtdEspera   + v.qtdEspera,
          perdidos:    acc.perdidos    + v.perdidos,
          qtdPerdidos: acc.qtdPerdidos + v.qtdPerdidos,
        }),
        { meta: 0, ganhos: 0, qtdGanhos: 0, emEspera: 0, qtdEspera: 0, perdidos: 0, qtdPerdidos: 0 },
      );

      // Recalcular percentuais do total (nunca somar frações)
      const percentualAtingidoTotal = totais.meta     > 0 ? totais.ganhos   / totais.meta    : 0; // fração pura
      const ticketMedioTotal        = totais.qtdGanhos > 0 ? totais.ganhos  / totais.qtdGanhos : 0;
      const participacaoTotal       = 1; // 100% formatado pelo Excel
      const percentualPerdaTotal    = totais.ganhos   > 0 ? totais.perdidos / totais.ganhos  : 0; // fração pura

      rows.push([
        'TOTAL', totais.meta, totais.ganhos, percentualAtingidoTotal,
        participacaoTotal, totais.qtdGanhos, ticketMedioTotal,
        totais.emEspera, totais.qtdEspera, totais.perdidos,
        percentualPerdaTotal, totais.qtdPerdidos,
      ]);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      const currencyCols = ['B', 'C', 'G', 'H', 'J'];
      const percentCols  = ['D', 'E', 'K'];
      rows.forEach((_, rowIndex) => {
        const excelRow = rowIndex + 2;
        currencyCols.forEach(col => { const ref = `${col}${excelRow}`; if (ws[ref]) ws[ref].z = 'R$ #,##0.00'; });
        percentCols.forEach(col  => { const ref = `${col}${excelRow}`; if (ws[ref]) ws[ref].z = '0.00%'; });
      });

      XLSX.utils.book_append_sheet(wb, ws, 'Fechamento Mensal');
      XLSX.writeFile(wb, `fechamento-mensal-${selectedYear}-${selectedMonth}.xlsx`);
      addToast('Excel exportado com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao exportar Excel:', err);
      addToast('Erro ao exportar Excel', 'error');
    }
  };

  const handleExportCSV = () => data && exportToCSV(data);

  const handleExportPDF = async () => {
    if (!selectedMes) return;
    const [yearStr, monthStr] = selectedMes.split('-');
    const selectedYear  = parseInt(yearStr, 10);
    const selectedMonth = monthStr;
    try {
      const vendedorData = await getVendedorData(selectedMonth, selectedYear, supabase);

      const totais = vendedorData.reduce(
        (acc, v) => ({
          meta:        acc.meta        + v.meta,
          ganhos:      acc.ganhos      + v.ganhos,
          qtdGanhos:   acc.qtdGanhos   + v.qtdGanhos,
          emEspera:    acc.emEspera    + v.emEspera,
          qtdEspera:   acc.qtdEspera   + v.qtdEspera,
          perdidos:    acc.perdidos    + v.perdidos,
          qtdPerdidos: acc.qtdPerdidos + v.qtdPerdidos,
        }),
        { meta: 0, ganhos: 0, qtdGanhos: 0, emEspera: 0, qtdEspera: 0, perdidos: 0, qtdPerdidos: 0 },
      );
      // Recalcular percentuais do total (nunca somar frações)
      const percentualAtingidoTotal = totais.meta     > 0 ? totais.ganhos   / totais.meta    : 0; // fração pura
      const ticketMedioTotal        = totais.qtdGanhos > 0 ? totais.ganhos  / totais.qtdGanhos : 0;
      const percentualPerdaTotal    = totais.ganhos   > 0 ? totais.perdidos / totais.ganhos  : 0; // fração pura

      // PDF: frações × 100 para exibição textual (sem formatação automática de %)
      const pct = (f: number) => `${(f * 100).toFixed(2)}%`;

      const tableData = vendedorData.map(v => [
        v.vendedor,
        `R$ ${v.meta.toFixed(2)}`,
        `R$ ${v.ganhos.toFixed(2)}`,
        pct(v.percentualAtingido),
        pct(v.participacao),
        String(v.qtdGanhos),
        `R$ ${v.ticketMedio.toFixed(2)}`,
        `R$ ${v.emEspera.toFixed(2)}`,
        String(v.qtdEspera),
        `R$ ${v.perdidos.toFixed(2)}`,
        pct(v.percentualPerda),
        String(v.qtdPerdidos),
      ]);

      tableData.push([
        'TOTAL',
        `R$ ${totais.meta.toFixed(2)}`,
        `R$ ${totais.ganhos.toFixed(2)}`,
        pct(percentualAtingidoTotal),
        '100,00%',
        String(totais.qtdGanhos),
        `R$ ${ticketMedioTotal.toFixed(2)}`,
        `R$ ${totais.emEspera.toFixed(2)}`,
        String(totais.qtdEspera),
        `R$ ${totais.perdidos.toFixed(2)}`,
        pct(percentualPerdaTotal),
        String(totais.qtdPerdidos),
      ]);

      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(13);
      doc.text(`Fechamento Mensal — ${selectedMonth}/${selectedYear}`, 14, 15);

      autoTable(doc, {
        head: [[
          'Vendedor', 'Meta', 'Ganhos', '% Ating.', '% Partic.',
          'Qtd Ganhos', 'Ticket Médio', 'Em Espera', 'Qtd',
          'Perdido', '% Perda', 'Qtd Perd.',
        ]],
        body: tableData,
        startY: 20,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 104, 245] },
        didParseCell: (hookData) => {
          if (hookData.row.index === tableData.length - 1) {
            hookData.cell.styles.fontStyle = 'bold';
          }
        },
      });

      doc.save(`fechamento-mensal-${selectedYear}-${selectedMonth}.pdf`);
      addToast('PDF exportado com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao exportar PDF:', err);
      addToast('Erro ao exportar PDF', 'error');
    }
  };

  const handleExportDetalhamento = async () => {
    if (!selectedMes) return;
    // Admin: null = sem filtro (todos os vendedores)
    // Vendedor: undefined = usa auth.uid() (só os próprios)
    const vendedorId = isAdmin ? null : undefined;
    try {
      const dados = await getDetalhamentoMes(selectedMes, vendedorId);
      exportDetalhamentoExcel(dados, selectedMes);
      addToast('Conferência exportada com sucesso!', 'success');
    } catch (err) {
      console.error('Erro ao exportar conferência:', err);
      addToast('Erro ao exportar conferência', 'error');
    }
  };

  const handleCloseMonth = () => {
    closeMutation.mutate();
    setShowConfirm(false);
  };

  /* ---- Modal de Ajuda ---- */
  const HelpModal = () => (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => setShowHelpModal(false)}
    >
      <div
        className="bg-light-bg dark:bg-dark-bg border border-light-bmd dark:border-dark-bmd rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-light-bg dark:bg-dark-bg border-b border-light-bmd dark:border-dark-bmd p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-6 h-6 text-accent-light dark:text-accent-dark" />
            <h2 className="text-xl font-semibold text-light-t1 dark:text-dark-t1">
              Ajuda — Fechamento Mensal
            </h2>
          </div>
          <button
            onClick={() => setShowHelpModal(false)}
            className="p-2 hover:bg-light-s1 dark:hover:bg-dark-s1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-light-t2 dark:text-dark-t2" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 space-y-6">

          {/* === SEÇÃO: O QUE É O MÓDULO === */}
          <section className="bg-accent-light/5 dark:bg-accent-dark/5 border border-accent-light/20 dark:border-accent-dark/20 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-accent-light dark:text-accent-dark mb-3 flex items-center gap-2">
              📅 O que é o Fechamento Mensal?
            </h3>
            <div className="space-y-3 text-sm text-light-t2 dark:text-dark-t2">
              <p>
                O <strong>Fechamento Mensal</strong> é o módulo onde você visualiza e consolida todos os resultados de vendas de um período específico (mês/ano). Ele oferece uma <strong>visão consolidada</strong> dos negócios por status (Ganha, Perdida, Em Espera) para análise rápida e tomada de decisão.
              </p>

              <div className="bg-light-s1 dark:bg-dark-s1 rounded-lg p-3 border border-light-blo dark:border-dark-blo">
                <div className="font-medium text-light-t1 dark:text-dark-t1 mb-2 flex items-center gap-2">
                  🗓️ <strong>Como selecionar o período:</strong>
                </div>
                <p className="text-light-t2 dark:text-dark-t2">
                  Use o <strong>dropdown de mês/ano</strong> (no topo da página) para escolher qual período você quer analisar. Os dados exibidos na tela são automaticamente filtrados para o mês selecionado.
                </p>
              </div>

              <div className="bg-light-s1 dark:bg-dark-s1 rounded-lg p-3 border border-light-blo dark:border-dark-blo">
                <div className="font-medium text-light-t1 dark:text-dark-t1 mb-2 flex items-center gap-2">
                  🎯 <strong>Propósito do fechamento:</strong>
                </div>
                <ul className="space-y-1 text-light-t2 dark:text-dark-t2 list-disc list-inside">
                  <li>Criar um <strong>snapshot imutável</strong> dos resultados do mês</li>
                  <li>Facilitar análises comparativas mês a mês</li>
                  <li>Gerar relatórios detalhados por vendedor (via exportação)</li>
                  <li>Bloquear alterações retroativas em períodos já encerrados</li>
                </ul>
              </div>

              <p className="text-xs italic text-light-t3 dark:text-dark-t3">
                💡 <strong>Dica:</strong> A tela mostra a <strong>sumarização rápida</strong> (por status). Para ver o <strong>detalhamento completo por pessoa</strong>, use os botões de exportação (Excel/CSV/PDF).
              </p>
            </div>
          </section>

          <div className="h-px bg-light-bmd dark:bg-dark-bmd my-6"></div>

          {/* === SEÇÃO: MINI CARDS === */}
          <section>
            <h3 className="text-lg font-semibold text-light-t1 dark:text-dark-t1 mb-4 flex items-center gap-2">
              📊 Mini Cards (Indicadores)
            </h3>
            <div className="space-y-3 text-sm">

              <div className="p-3 bg-light-s1 dark:bg-dark-s1 rounded-lg border border-light-blo dark:border-dark-blo">
                <div className="font-medium text-light-t1 dark:text-dark-t1 mb-1 flex items-center gap-2">
                  💰 <strong>Total Ganho</strong>
                </div>
                <p className="text-light-t2 dark:text-dark-t2">
                  Soma de todos os negócios com status <span className="text-success font-medium">"Ganha"</span> no período selecionado.
                </p>
                <code className="block mt-2 text-xs bg-light-s2 dark:bg-dark-s2 p-2 rounded font-mono text-accent-light dark:text-accent-dark">
                  Total Ganho = Σ (valor dos negócios ganhos)
                </code>
              </div>

              <div className="p-3 bg-light-s1 dark:bg-dark-s1 rounded-lg border border-light-blo dark:border-dark-blo">
                <div className="font-medium text-light-t1 dark:text-dark-t1 mb-1 flex items-center gap-2">
                  🎯 <strong>Meta do Período</strong>
                </div>
                <p className="text-light-t2 dark:text-dark-t2">
                  Meta de vendas definida para o mês selecionado. Se não houver meta cadastrada, aparece <span className="italic">"—"</span>.
                </p>
              </div>

              <div className="p-3 bg-light-s1 dark:bg-dark-s1 rounded-lg border border-light-blo dark:border-dark-blo">
                <div className="font-medium text-light-t1 dark:text-dark-t1 mb-1 flex items-center gap-2">
                  📈 <strong>Performance</strong>
                </div>
                <p className="text-light-t2 dark:text-dark-t2">
                  Percentual de atingimento da meta. Só é exibido se houver meta definida.
                </p>
                <code className="block mt-2 text-xs bg-light-s2 dark:bg-dark-s2 p-2 rounded font-mono text-accent-light dark:text-accent-dark">
                  Performance = (Total Ganho / Meta) × 100
                </code>
              </div>

              <div className="p-3 bg-light-s1 dark:bg-dark-s1 rounded-lg border border-light-blo dark:border-dark-blo">
                <div className="font-medium text-light-t1 dark:text-dark-t1 mb-1 flex items-center gap-2">
                  📉 <strong>Total Perdido</strong>
                </div>
                <p className="text-light-t2 dark:text-dark-t2">
                  Soma de todos os negócios com status <span className="text-danger font-medium">"Perdida"</span> no período.
                </p>
                <code className="block mt-2 text-xs bg-light-s2 dark:bg-dark-s2 p-2 rounded font-mono text-accent-light dark:text-accent-dark">
                  Total Perdido = Σ (valor dos negócios perdidos)
                </code>
              </div>

            </div>
          </section>

          <div className="h-px bg-light-bmd dark:bg-dark-bmd"></div>
          {/* === SEÇÃO: COLUNAS DA TABELA === */}
          <section>
            <h3 className="text-lg font-semibold text-light-t1 dark:text-dark-t1 mb-4 flex items-center gap-2">
              📋 Colunas da Tabela
            </h3>
            <div className="space-y-3 text-sm">

              <div className="p-3 bg-light-s1 dark:bg-dark-s1 rounded-lg border border-light-blo dark:border-dark-blo">
                <div className="font-medium text-light-t1 dark:text-dark-t1 mb-1">
                  <strong>Status</strong>
                </div>
                <p className="text-light-t2 dark:text-dark-t2">
                  Classificação do negócio: <span className="text-success">Ganha</span>, <span className="text-danger">Perdida</span>, <span className="text-warning">Em Espera</span>, ou <span className="text-light-t3 dark:text-dark-t3">Encerrado</span> (informativo).
                </p>
              </div>

              <div className="p-3 bg-light-s1 dark:bg-dark-s1 rounded-lg border border-light-blo dark:border-dark-blo">
                <div className="font-medium text-light-t1 dark:text-dark-t1 mb-1">
                  <strong>Qtd</strong>
                </div>
                <p className="text-light-t2 dark:text-dark-t2">
                  Quantidade de negócios naquele status no período.
                </p>
              </div>

              <div className="p-3 bg-light-s1 dark:bg-dark-s1 rounded-lg border border-light-blo dark:border-dark-blo">
                <div className="font-medium text-light-t1 dark:text-dark-t1 mb-1">
                  <strong>Total R$</strong>
                </div>
                <p className="text-light-t2 dark:text-dark-t2">
                  Soma do valor de todos os negócios daquele status.
                </p>
              </div>

              <div className="p-3 bg-light-s1 dark:bg-dark-s1 rounded-lg border border-light-blo dark:border-dark-blo">
                <div className="font-medium text-light-t1 dark:text-dark-t1 mb-1">
                  <strong>% Participação</strong>
                </div>
                <p className="text-light-t2 dark:text-dark-t2">
                  Percentual que aquele status representa no total geral de vendas (excluindo "Encerrado").
                </p>
                <code className="block mt-2 text-xs bg-light-s2 dark:bg-dark-s2 p-2 rounded font-mono text-accent-light dark:text-accent-dark">
                  % Participação = (Total do Status / Total Geral) × 100
                </code>
              </div>

              <div className="p-3 bg-light-s1 dark:bg-dark-s1 rounded-lg border border-light-blo dark:border-dark-blo">
                <div className="font-medium text-light-t1 dark:text-dark-t1 mb-1">
                  <strong>Ticket Médio (R$)</strong>
                </div>
                <p className="text-light-t2 dark:text-dark-t2">
                  Valor médio de cada negócio daquele status.
                </p>
                <code className="block mt-2 text-xs bg-light-s2 dark:bg-dark-s2 p-2 rounded font-mono text-accent-light dark:text-accent-dark">
                  Ticket Médio = Total R$ / Qtd
                </code>
              </div>

              <div className="p-3 bg-light-s1 dark:bg-dark-s1 rounded-lg border border-light-blo dark:border-dark-blo">
                <div className="font-medium text-light-t1 dark:text-dark-t1 mb-1 flex items-center gap-2">
                  🎯 <strong>TOTAL GERAL</strong>
                </div>
                <p className="text-light-t2 dark:text-dark-t2">
                  Soma de <strong>Ganha + Perdida + Em Espera</strong> (status "Encerrado" não entra no total).
                </p>
                <p className="text-light-t2 dark:text-dark-t2 mt-2">
                  O <strong>Ticket Médio Geral</strong> é calculado dividindo o Total Geral pela Quantidade Geral.
                </p>
                <code className="block mt-2 text-xs bg-light-s2 dark:bg-dark-s2 p-2 rounded font-mono text-accent-light dark:text-accent-dark">
                  Ticket Médio Geral = Total Geral R$ / Qtd Geral
                </code>
              </div>

            </div>
          </section>

          <div className="h-px bg-light-bmd dark:bg-dark-bmd"></div>

          {/* === SEÇÃO: OBSERVAÇÕES === */}
          <section>
            <h3 className="text-lg font-semibold text-light-t1 dark:text-dark-t1 mb-3 flex items-center gap-2">
              ℹ️ Observações Importantes
            </h3>
            <ul className="space-y-2 text-sm text-light-t2 dark:text-dark-t2 list-disc list-inside">
              <li>Negócios com status <strong>"Encerrado"</strong> aparecem na tabela apenas como <span className="italic">linha informativa</span> (não entram no cálculo do Total).</li>
              <li>O botão <strong>"Fechar Mês"</strong> cria um snapshot imutável do período e bloqueia alterações retroativas.</li>
              <li>Exportações (Excel/CSV/PDF) incluem todas as colunas exibidas na tabela.</li>
            </ul>
          </section>

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-light-bg dark:bg-dark-bg border-t border-light-bmd dark:border-dark-bmd p-4 text-center">
          <button
            onClick={() => setShowHelpModal(false)}
            className="px-6 py-2 bg-accent-light dark:bg-accent-dark text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );

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
          <button
            onClick={() => setShowHelpModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-light-s1 dark:bg-dark-s1 border border-light-bmd dark:border-dark-bmd rounded-lg hover:bg-light-s2 dark:hover:bg-dark-s2 transition-colors"
            title="Ajuda sobre Fechamento Mensal"
          >
            <HelpCircle className="w-4 h-4 text-accent-light dark:text-accent-dark" />
            <span className="text-sm font-medium text-light-t1 dark:text-dark-t1">Ajuda</span>
          </button>

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
              <button
                type="button"
                onClick={handleExportDetalhamento}
                title="Exportar detalhamento completo para auditoria"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-light-s1 border border-light-bmd text-light-t2 hover:text-accent-light hover:border-accent-light/40 shadow-[var(--sh1)] transition-colors"
              >
                <Search className="h-4 w-4" /> Conferência
              </button>
            </>
          )}

          {/* Baseline inicial (admin + sem eventos em budget_events) */}
          {isAdmin && !hasBaseline && (
            <button
              type="button"
              onClick={() => setShowBaselineModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-danger text-white hover:opacity-90 shadow-[var(--sh1)] transition-opacity"
            >
              <Database className="h-4 w-4" /> Criar Baseline
            </button>
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
                    <tr className="border-b border-light-bmd dark:border-dark-bmd">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-light-t2 dark:text-dark-t2">
                        Status
                      </th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-light-t2 dark:text-dark-t2">
                        Qtd
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-light-t2 dark:text-dark-t2">
                        Total R$
                      </th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-light-t2 dark:text-dark-t2">
                        % Participação
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-light-t2 dark:text-dark-t2">
                        Ticket Médio (R$)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Ganha */}
                    <tr className="border-b border-light-blo dark:border-dark-blo hover:bg-light-s1 dark:hover:bg-dark-s1 transition-colors">
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-2 font-medium text-success">
                          <span className="h-2 w-2 rounded-full bg-success inline-block" />
                          Ganha
                        </span>
                      </td>
                      <td className="text-center py-3 px-4 text-light-t1 dark:text-dark-t1">{data.qty_ganha}</td>
                      <td className="text-right py-3 px-4 font-mono font-semibold text-light-t1 dark:text-dark-t1">{brl(data.total_ganha)}</td>
                      <td className="text-center py-3 px-4 font-medium text-light-t1 dark:text-dark-t1">
                        {((data.total_ganha + data.total_perdida + data.total_aberta) > 0
                          ? (data.total_ganha / (data.total_ganha + data.total_perdida + data.total_aberta)) * 100
                          : 0
                        ).toFixed(2)}%
                      </td>
                      <td className="text-right py-3 px-4 font-mono text-light-t2 dark:text-dark-t2">
                        {brl(data.qty_ganha > 0 ? data.total_ganha / data.qty_ganha : 0)}
                      </td>
                    </tr>
                    {/* Perdida */}
                    <tr className="border-b border-light-blo dark:border-dark-blo hover:bg-light-s1 dark:hover:bg-dark-s1 transition-colors">
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-2 font-medium text-danger">
                          <span className="h-2 w-2 rounded-full bg-danger inline-block" />
                          Perdida
                        </span>
                      </td>
                      <td className="text-center py-3 px-4 text-light-t1 dark:text-dark-t1">{data.qty_perdida}</td>
                      <td className="text-right py-3 px-4 font-mono text-light-t1 dark:text-dark-t1">{brl(data.total_perdida)}</td>
                      <td className="text-center py-3 px-4 font-medium text-light-t1 dark:text-dark-t1">
                        {((data.total_ganha + data.total_perdida + data.total_aberta) > 0
                          ? (data.total_perdida / (data.total_ganha + data.total_perdida + data.total_aberta)) * 100
                          : 0
                        ).toFixed(2)}%
                      </td>
                      <td className="text-right py-3 px-4 font-mono text-light-t2 dark:text-dark-t2">
                        {brl(data.qty_perdida > 0 ? data.total_perdida / data.qty_perdida : 0)}
                      </td>
                    </tr>
                    {/* Em Espera */}
                    {data.qty_aberta > 0 && (
                      <tr className="border-b border-light-blo dark:border-dark-blo hover:bg-light-s1 dark:hover:bg-dark-s1 transition-colors">
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-2 font-medium text-warning">
                            <span className="h-2 w-2 rounded-full bg-warning inline-block" />
                            Em Espera
                          </span>
                        </td>
                        <td className="text-center py-3 px-4 text-light-t1 dark:text-dark-t1">{data.qty_aberta}</td>
                        <td className="text-right py-3 px-4 font-mono text-light-t1 dark:text-dark-t1">{brl(data.total_aberta)}</td>
                        <td className="text-center py-3 px-4 font-medium text-light-t1 dark:text-dark-t1">
                          {((data.total_ganha + data.total_perdida + data.total_aberta) > 0
                            ? (data.total_aberta / (data.total_ganha + data.total_perdida + data.total_aberta)) * 100
                            : 0
                          ).toFixed(2)}%
                        </td>
                        <td className="text-right py-3 px-4 font-mono text-light-t2 dark:text-dark-t2">
                          {brl(data.qty_aberta > 0 ? data.total_aberta / data.qty_aberta : 0)}
                        </td>
                      </tr>
                    )}
                    {/* Linha TOTAL GERAL */}
                    <tr className="border-t-2 border-light-bmd dark:border-dark-bmd bg-light-s2 dark:bg-dark-s2 font-semibold">
                      <td className="py-4 px-4 text-light-t1 dark:text-dark-t1">
                        TOTAL GERAL
                      </td>
                      <td className="text-center py-4 px-4 text-light-t1 dark:text-dark-t1">
                        {data.qty_ganha + data.qty_perdida + data.qty_aberta}
                      </td>
                      <td className="text-right py-4 px-4 font-mono text-light-t1 dark:text-dark-t1">
                        {brl(data.total_ganha + data.total_perdida + data.total_aberta)}
                      </td>
                      <td className="text-center py-4 px-4 text-light-t1 dark:text-dark-t1">
                        100%
                      </td>
                      <td className="text-right py-4 px-4 font-mono text-accent-light dark:text-accent-dark">
                        {brl(
                          (data.qty_ganha + data.qty_perdida + data.qty_aberta) > 0
                            ? (data.total_ganha + data.total_perdida + data.total_aberta) /
                              (data.qty_ganha + data.qty_perdida + data.qty_aberta)
                            : 0
                        )}
                      </td>
                    </tr>
                  </tbody>
                  {/* Encerrado — informativo, fora da soma */}
                  <tfoot>
                    {/* Encerrado — informativo, fora da soma */}
                    {data.qty_encerrada > 0 && (
                      <tr className="border-t border-light-bmd/60 hover:bg-light-s2/50 transition-colors">
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-2 font-medium text-light-t3">
                            <span className="h-2 w-2 rounded-full bg-light-t3 inline-block" />
                            Encerrado
                          </span>
                        </td>
                        <td className="text-center py-3 px-4 text-light-t2">{data.qty_encerrada}</td>
                        <td className="text-right py-3 px-4 font-mono text-light-t2">{brl(data.total_encerrada)}</td>
                        <td className="text-center py-3 px-4 text-light-t3">—</td>
                        <td className="text-right py-3 px-4 font-mono text-light-t2">
                          {brl(data.qty_encerrada > 0 ? data.total_encerrada / data.qty_encerrada : 0)}
                        </td>
                      </tr>
                    )}
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

      {/* Modal de baseline */}
      {showBaselineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-light-s1 rounded-2xl shadow-[var(--sh2)] p-8 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-danger/15 flex items-center justify-center">
                <Database className="h-5 w-5 text-danger" />
              </div>
              <h2 className="text-xl font-bold text-light-t1">Criar Baseline Inicial</h2>
            </div>
            <p className="text-light-t2 text-sm mb-3">
              Importa todos os orçamentos existentes para a tabela de eventos de forma que
              o Fechamento Mensal possa calcular os dados corretamente.
            </p>
            <p className="text-light-t3 text-xs mb-6">
              Fotografia em: <strong className="text-light-t2">{new Date().toLocaleString('pt-BR')}</strong>
              {' '}— operação idempotente (orçamentos já importados são ignorados).
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowBaselineModal(false)}
                disabled={baselineLoading}
                className="px-4 py-2 rounded-lg text-sm font-medium text-light-t2 hover:bg-light-s2 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateBaseline}
                disabled={baselineLoading}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-danger text-white hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {baselineLoading ? 'Importando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de ajuda */}
      {showHelpModal && <HelpModal />}
    </div>
  );
};

export default MonthlyClosurePage;

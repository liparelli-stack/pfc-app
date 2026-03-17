/*
-- ===================================================
-- Código             : /src/components/vision360/cards/BudgetStageValueCard.tsx
-- Versão (.v20)      : 1.6.0
-- Data/Hora          : 2025-11-05 21:42 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Card "Orçamento por estágio (R$)" com switch (R$ ↔ R$×1.000)
--                      + minigráfico horizontal de contagens com TOOLTIP numérico (qtd + %)
-- Fluxo              : InsightsStrip → BudgetStageValueCard
-- Alterações (1.6.0) :
--  • Adicionado tooltip leve e acessível na minifaixa de contagens (qtd + percentual).
--  • Mantidos badges de contagem e switch de valores.
-- Dependências       : react, tailwindcss, @/components/vision360/mini/MiniBar
-- ===================================================
*/

import React from 'react';
import MiniBar from '@/components/vision360/mini/MiniBar';

type StageKey = 'em_espera' | 'ganha' | 'perdida';

type Props = {
  /** Valores em BRL REAIS por estágio (sem escala aplicada) */
  valuesBRL: Record<StageKey, number>;
  /** Contagens por estágio (mesmo shape dos valores) */
  counts: Record<StageKey, number>;
  /** Título do card (default ajustado pelo FL) */
  title?: string;
  /** Inicia em milhares? (opcional) */
  defaultThousands?: boolean;
  className?: string;
};

/** Formata número em BRL integral */
function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}
/** Formata número em BRL × 1.000 (exibe sufixo k) */
function fmtBRLk(v: number) {
  const base = v / 1000;
  const digits = base < 100 ? 1 : 0;
  return `R$ ${base.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} k`;
}
function fmtPct(p: number) {
  return `${p.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

const LABELS: Record<StageKey, string> = {
  em_espera: 'Em espera',
  ganha: 'Ganha',
  perdida: 'Perdida',
};

type TipInfo = {
  label: string;
  count: number;
  pct: number;
  x: number; // px relativo ao container
};

const BudgetStageValueCard: React.FC<Props> = ({
  valuesBRL,
  counts,
  title = 'Orçamento por estágio (R$)',
  defaultThousands = false,
  className,
}) => {
  const [thousands, setThousands] = React.useState<boolean>(defaultThousands);

  // ===== Valores (R$) =====
  const items = React.useMemo(
    () => [
      { key: LABELS.em_espera, value: Math.max(0, valuesBRL.em_espera || 0) },
      { key: LABELS.ganha, value: Math.max(0, valuesBRL.ganha || 0) },
      { key: LABELS.perdida, value: Math.max(0, valuesBRL.perdida || 0) },
    ],
    [valuesBRL]
  );
  const total = items.reduce((acc, it) => acc + it.value, 0);
  const displayItems = React.useMemo(
    () =>
      items.map((it) => ({
        key: it.key,
        value: thousands ? it.value / 1000 : it.value,
      })),
    [items, thousands]
  );

  // ===== Contagens =====
  const cEmEspera = Math.max(0, counts?.em_espera ?? 0);
  const cGanha = Math.max(0, counts?.ganha ?? 0);
  const cPerdida = Math.max(0, counts?.perdida ?? 0);
  const cTotal = Math.max(1, cEmEspera + cGanha + cPerdida); // evita divisão por zero

  const pEmEspera = (cEmEspera / cTotal) * 100;
  const pGanha = (cGanha / cTotal) * 100;
  const pPerdida = (cPerdida / cTotal) * 100;

  // ===== Tooltip minifaixa =====
  const barRef = React.useRef<HTMLDivElement | null>(null);
  const [tip, setTip] = React.useState<TipInfo | null>(null);

  function showTip(e: React.MouseEvent, label: string, count: number, pct: number) {
    const host = barRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    setTip({
      label,
      count,
      pct,
      x: Math.min(Math.max(e.clientX - rect.left, 8), rect.width - 8),
    });
  }
  function hideTip() {
    setTip(null);
  }

  const headerRight = (
    <button
      type="button"
      onClick={() => setThousands((v) => !v)}
      className="inline-flex items-center gap-1 rounded-full border border-current/40 px-2.5 py-1 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-100/60 dark:hover:bg-zinc-800/60 transition"
      title={thousands ? 'Mostrar valores integrais (R$)' : 'Mostrar em milhares (R$ × 1.000)'}
    >
      <span className="font-medium">{thousands ? 'R$k' : 'R$'}</span>
      <span className="opacity-60">↔</span>
    </button>
  );

  return (
    <section
      className={
        'rounded-2xl border shadow-sm p-4 sm:p-6 bg-white dark:bg-zinc-950 border-gray-200 dark:border-zinc-800 ' +
        (className ?? '')
      }
    >
      {/* Cabeçalho do card com switch discreto à direita */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {headerRight}
      </div>

      {/* Área do gráfico (valores em R$ / R$k) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <MiniBar items={displayItems} width={220} height={64} className="text-gray-700 dark:text-gray-200" />

        {/* Sumário à direita (valores) */}
        <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-300">
          <div className="rounded-xl border px-2 py-1 border-gray-200 dark:border-zinc-800">
            <div className="opacity-70">{LABELS.em_espera}</div>
            <div className="font-semibold">
              {thousands ? fmtBRLk(items[0].value) : fmtBRL(items[0].value)}
            </div>
          </div>
          <div className="rounded-xl border px-2 py-1 border-gray-200 dark:border-zinc-800">
            <div className="opacity-70">{LABELS.ganha}</div>
            <div className="font-semibold">
              {thousands ? fmtBRLk(items[1].value) : fmtBRL(items[1].value)}
            </div>
          </div>
          <div className="rounded-xl border px-2 py-1 border-gray-200 dark:border-zinc-800">
            <div className="opacity-70">{LABELS.perdida}</div>
            <div className="font-semibold">
              {thousands ? fmtBRLk(items[2].value) : fmtBRL(items[2].value)}
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé de valores (total) */}
      <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
        Total no período:{' '}
        <span className="font-medium">
          {thousands ? fmtBRLk(total) : total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
      </div>

      {/* Linha divisória sutil */}
      <div className="my-3 h-px bg-gray-200 dark:bg-zinc-800" />

      {/* Minigráfico horizontal de contagens (proporções) + TOOLTIP */}
      <div
        ref={barRef}
        className="relative w-full rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800"
        role="img"
        aria-label={`Distribuição de orçamentos por estágio: ${LABELS.em_espera} ${cEmEspera}, ${LABELS.ganha} ${cGanha}, ${LABELS.perdida} ${cPerdida}`}
      >
        <div className="flex h-4">
          <div
            className="bg-blue-400/50 dark:bg-blue-500/40"
            style={{ width: `${pEmEspera}%` }}
            title={`${LABELS.em_espera}: ${cEmEspera} (${fmtPct(pEmEspera)})`}
            aria-label={`${LABELS.em_espera}: ${cEmEspera} (${fmtPct(pEmEspera)})`}
            onMouseEnter={(e) => showTip(e, LABELS.em_espera, cEmEspera, pEmEspera)}
            onMouseMove={(e) => showTip(e, LABELS.em_espera, cEmEspera, pEmEspera)}
            onMouseLeave={hideTip}
          />
          <div
            className="bg-emerald-400/50 dark:bg-emerald-500/40"
            style={{ width: `${pGanha}%` }}
            title={`${LABELS.ganha}: ${cGanha} (${fmtPct(pGanha)})`}
            aria-label={`${LABELS.ganha}: ${cGanha} (${fmtPct(pGanha)})`}
            onMouseEnter={(e) => showTip(e, LABELS.ganha, cGanha, pGanha)}
            onMouseMove={(e) => showTip(e, LABELS.ganha, cGanha, pGanha)}
            onMouseLeave={hideTip}
          />
          <div
            className="bg-rose-400/50 dark:bg-rose-500/40"
            style={{ width: `${pPerdida}%` }}
            title={`${LABELS.perdida}: ${cPerdida} (${fmtPct(pPerdida)})`}
            aria-label={`${LABELS.perdida}: ${cPerdida} (${fmtPct(pPerdida)})`}
            onMouseEnter={(e) => showTip(e, LABELS.perdida, cPerdida, pPerdida)}
            onMouseMove={(e) => showTip(e, LABELS.perdida, cPerdida, pPerdida)}
            onMouseLeave={hideTip}
          />
        </div>

        {/* Tooltip flutuante */}
        {tip && (
          <div
            className="pointer-events-none absolute -top-9 translate-x-[-50%] whitespace-nowrap rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-900 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100"
            style={{ left: `${tip.x}px` }}
          >
            <span className="font-medium">{tip.label}</span>
            <span className="mx-1">—</span>
            <span>{tip.count}</span>
            <span className="ml-1 opacity-70">({fmtPct(tip.pct)})</span>
          </div>
        )}
      </div>

      {/* Contagens (badges) */}
      <div className="mt-2 text-xs text-gray-700 dark:text-gray-200">
        <span className="opacity-70 mr-2">Quantidade por estágio:</span>
        <div className="mt-1 flex flex-wrap gap-2">
          <span className="rounded-xl border px-2 py-1 border-gray-200 dark:border-zinc-800" title={`${LABELS.em_espera}: ${cEmEspera} (${fmtPct(pEmEspera)})`}>
            {LABELS.em_espera}: <strong>{cEmEspera}</strong>
          </span>
          <span className="rounded-xl border px-2 py-1 border-gray-200 dark:border-zinc-800" title={`${LABELS.ganha}: ${cGanha} (${fmtPct(pGanha)})`}>
            {LABELS.ganha}: <strong>{cGanha}</strong>
          </span>
          <span className="rounded-xl border px-2 py-1 border-gray-200 dark:border-zinc-800" title={`${LABELS.perdida}: ${cPerdida} (${fmtPct(pPerdida)})`}>
            {LABELS.perdida}: <strong>{cPerdida}</strong>
          </span>
        </div>
      </div>
    </section>
  );
};

export default BudgetStageValueCard;

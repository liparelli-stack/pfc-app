/*
-- =====================================================================================================
-- Código             : src/pages/SalesTargetsPage.tsx
-- Versão (.v20)      : 0.2.0
-- Data/Hora          : 2026-03-25 America/Sao_Paulo
-- Autor              : FL / Execução via Eva (Claude)
-- Objetivo do codigo : Tela de Metas Mensais:
--                      • Grid vendedores × meses (Jan-Dez do ano corrente)
--                      • Células editáveis inline com máscara BRL (admin only)
--                      • Salvar automático com debounce + indicador visual
--                      • Linha de total no rodapé (soma por mês)
--                      • Scroll horizontal, primeira coluna sticky
-- Alterações (0.2.0) :
--   • [FEAT] Tecla R: replica valor da célula atual nas próximas N células (mesma linha)
--   • [FEAT] Tecla L: limpa N células a partir da célula atual (mesma linha)
--   • [FEAT] Navegação por setas (←↑→↓), Enter (desce), Tab (mantido)
--   • [FEAT] Indicador auto-save: "Salvando…" vermelho → "Salvo ✓" verde (min 800ms)
-- Dependências       : useSalesTargets, profilesService, AuthContext, Design System v0101
-- =====================================================================================================
*/

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentProfile } from '@/services/profilesService';
import { useSalesTargets } from '@/hooks/useSalesTargets';
import { Target, Loader2, AlertTriangle, Check } from 'lucide-react';
import clsx from 'clsx';

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

function parseBRL(raw: string): number {
  const cleaned = raw.replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.max(0, num);
}

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

type CellKey  = string; // `${sellerId}|${YYYY-MM-DD}`
type CellCoord = { r: number; c: number };
type NavDir   = 'right' | 'left' | 'up' | 'down' | 'enter' | 'escape';

interface PopoverState {
  r: number;
  c: number;
  type: 'R' | 'L';
  count: string;
  value: number; // valor da célula atual (para replicar)
}

type SaveStatus = 'idle' | 'saving' | 'saved';

/* ============================================================
   Subcomponente: Célula editável
   ============================================================ */

interface TargetCellProps {
  cellKey: CellKey;
  savedValue: number;
  isAdmin: boolean;
  isFocused: boolean;
  popover: { type: 'R' | 'L'; count: string } | null;
  onCommit: (key: CellKey, amount: number) => void;
  onFocusRequest: () => void;
  onNavigate: (dir: NavDir, currentValue: number) => void;
  onTriggerAction: (type: 'R' | 'L', currentValue: number) => void;
  onPopoverCountChange: (count: string) => void;
  onPopoverConfirm: () => void;
  onPopoverCancel: () => void;
  registerInputRef: (el: HTMLInputElement | null) => void;
}

const TargetCell: React.FC<TargetCellProps> = ({
  cellKey,
  savedValue,
  isAdmin,
  isFocused,
  popover,
  onCommit,
  onFocusRequest,
  onNavigate,
  onTriggerAction,
  onPopoverCountChange,
  onPopoverConfirm,
  onPopoverCancel,
  registerInputRef,
}) => {
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverInputRef = useRef<HTMLInputElement>(null);

  // Registra ref no pai para navegação programática
  const setRef = useCallback((el: HTMLInputElement | null) => {
    (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
    registerInputRef(el);
  }, [registerInputRef]);

  // Quando isFocused muda para true, foca o input e preenche com valor salvo
  useEffect(() => {
    if (isFocused && inputRef.current) {
      setInputVal(toInputDisplay(savedValue));
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isFocused]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quando popover aparece, foca o input do popover
  useEffect(() => {
    if (popover && popoverInputRef.current) {
      popoverInputRef.current.focus();
      popoverInputRef.current.select();
    }
  }, [popover]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const key = e.key;

    if (key === 'r' || key === 'R') {
      e.preventDefault();
      onTriggerAction('R', parseBRL(inputVal));
      return;
    }
    if (key === 'l' || key === 'L') {
      e.preventDefault();
      onTriggerAction('L', parseBRL(inputVal));
      return;
    }
    if (key === 'ArrowRight') { e.preventDefault(); onNavigate('right', parseBRL(inputVal)); return; }
    if (key === 'ArrowLeft')  { e.preventDefault(); onNavigate('left',  parseBRL(inputVal)); return; }
    if (key === 'ArrowDown')  { e.preventDefault(); onNavigate('down',  parseBRL(inputVal)); return; }
    if (key === 'ArrowUp')    { e.preventDefault(); onNavigate('up',    parseBRL(inputVal)); return; }
    if (key === 'Enter')      { e.preventDefault(); onNavigate('enter', parseBRL(inputVal)); return; }
    if (key === 'Escape')     { e.preventDefault(); onNavigate('escape', parseBRL(inputVal)); return; }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Não salva no blur se o foco foi para o popover
    if (popover) return;
    const amount = parseBRL(inputVal);
    onCommit(cellKey, amount);
  };

  // Readonly
  if (!isAdmin) {
    return (
      <td className="py-2.5 px-3 text-right text-sm tabular-nums text-light-t1 dark:text-dark-t1 whitespace-nowrap">
        {savedValue ? formatBRL(savedValue) : <span className="text-light-t3 dark:text-dark-t3">—</span>}
      </td>
    );
  }

  return (
    <td className="py-1 px-2 text-right relative">
      {isFocused ? (
        <input
          ref={setRef}
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full min-w-[110px] text-right text-sm tabular-nums
                     bg-white dark:bg-dark-s2 border border-accent-light dark:border-accent-dark
                     rounded text-light-t1 dark:text-dark-t1 px-2 py-1.5 outline-none
                     focus:ring-2 focus:ring-accent-light/30 dark:focus:ring-accent-dark/30"
          placeholder="0,00"
        />
      ) : (
        <button
          ref={registerInputRef as unknown as React.Ref<HTMLButtonElement>}
          onClick={onFocusRequest}
          className="w-full min-w-[110px] text-right text-sm tabular-nums px-2 py-1.5 rounded
                     hover:bg-light-s2 dark:hover:bg-dark-s2 transition-colors
                     text-light-t1 dark:text-dark-t1"
        >
          {savedValue
            ? formatBRL(savedValue)
            : <span className="text-light-t3 dark:text-dark-t3">—</span>}
        </button>
      )}

      {/* Popover R / L */}
      {popover && (
        <div
          className={clsx(
            'absolute z-50 top-full mt-1',
            'right-0', // alinha pela direita da célula
            'bg-light-s1 dark:bg-dark-s2',
            'border border-light-bmd dark:border-dark-bmd',
            'rounded-lg shadow-sh2 p-3',
            'flex flex-col gap-2 min-w-[180px]'
          )}
          onMouseDown={(e) => e.stopPropagation()} // evita blur no input da célula
        >
          <span className="text-xs font-semibold text-light-t2 dark:text-dark-t2">
            {popover.type === 'R'
              ? `Replicar nas próximas N células`
              : `Limpar N células a partir daqui`}
          </span>
          <input
            ref={popoverInputRef}
            type="number"
            min={1}
            max={11}
            value={popover.count}
            onChange={(e) => onPopoverCountChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onPopoverConfirm(); }
              if (e.key === 'Escape') { e.preventDefault(); onPopoverCancel(); }
            }}
            placeholder="Qtd. de células"
            className="w-full text-sm text-center tabular-nums px-2 py-1.5 rounded
                       bg-white dark:bg-dark-s3 border border-light-bmd dark:border-dark-bmd
                       outline-none focus:ring-2 focus:ring-accent-light/30"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onPopoverCancel}
              className="text-xs px-2 py-1 rounded border border-light-bmd dark:border-dark-bmd
                         hover:bg-light-s2 dark:hover:bg-dark-s3 transition-colors
                         text-light-t2 dark:text-dark-t2"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onPopoverConfirm}
              className="text-xs px-3 py-1 rounded bg-accent-light dark:bg-accent-dark
                         text-white font-medium hover:opacity-90 transition-opacity"
            >
              OK
            </button>
          </div>
        </div>
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

  useEffect(() => {
    let mounted = true;
    getCurrentProfile()
      .then((p) => { if (mounted) setIsAdmin(p?.role === 'admin'); })
      .catch(() => { if (mounted) setIsAdmin(false); });
    return () => { mounted = false; };
  }, [session]);

  const { sellers, months, targetMap, isLoading, isError, saveMutation } = useSalesTargets();

  /* ---- Controle de célula focada ---- */
  const [focusedCell, setFocusedCell] = useState<CellCoord | null>(null);

  /* ---- Popover R/L ---- */
  const [popover, setPopover] = useState<PopoverState | null>(null);

  /* ---- Refs para navegação programática ---- */
  // Mapa: `${r}-${c}` → HTMLInputElement | HTMLButtonElement
  const cellRefs = useRef<Map<string, HTMLElement>>(new Map());

  const registerRef = useCallback(
    (r: number, c: number) => (el: HTMLElement | null) => {
      const key = `${r}-${c}`;
      if (el) cellRefs.current.set(key, el);
      else    cellRefs.current.delete(key);
    },
    []
  );

  const focusCellAt = useCallback((r: number, c: number) => {
    setFocusedCell({ r, c });
    // o useEffect no TargetCell cuida do .focus() real
  }, []);

  /* ---- Fechar popover ao clicar fora ---- */
  useEffect(() => {
    if (!popover) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-popover]')) {
        setPopover(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popover]);

  /* ---- Indicador auto-save ---- */
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const savingStartRef = useRef(0);

  useEffect(() => {
    if (saveMutation.isPending) {
      savingStartRef.current = Date.now();
      setSaveStatus('saving');
      return;
    }
    // Mutation acabou
    if (saveStatus === 'saving') {
      const elapsed = Date.now() - savingStartRef.current;
      const delay = Math.max(0, 800 - elapsed);
      const t = setTimeout(() => setSaveStatus('saved'), delay);
      return () => clearTimeout(t);
    }
  }, [saveMutation.isPending]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (saveStatus !== 'saved') return;
    const t = setTimeout(() => setSaveStatus('idle'), 1500);
    return () => clearTimeout(t);
  }, [saveStatus]);

  /* ---- Commit de célula individual ---- */
  const handleCommit = useCallback(
    (key: CellKey, amount: number) => {
      const [sellerId, mes] = key.split('|');
      saveMutation.mutate({ sellerId, mes, amount });
    },
    [saveMutation],
  );

  /* ---- Navegação por teclado ---- */
  const handleNavigate = useCallback(
    (r: number, c: number, dir: NavDir, currentValue: number) => {
      // Salva célula atual antes de navegar
      const seller = sellers[r];
      const mes    = months[c];
      if (seller && mes) handleCommit(`${seller.id}|${mes}`, currentValue);

      if (dir === 'escape') {
        setFocusedCell(null);
        return;
      }

      const numRows = sellers.length;
      const numCols = months.length;
      let nr = r, nc = c;

      switch (dir) {
        case 'right': nc = Math.min(c + 1, numCols - 1); break;
        case 'left':  nc = Math.max(c - 1, 0); break;
        case 'down':
        case 'enter': nr = Math.min(r + 1, numRows - 1); break;
        case 'up':    nr = Math.max(r - 1, 0); break;
      }

      focusCellAt(nr, nc);
    },
    [sellers, months, handleCommit, focusCellAt],
  );

  /* ---- Trigger R / L ---- */
  const handleTriggerAction = useCallback(
    (r: number, c: number, type: 'R' | 'L', currentValue: number) => {
      // Salva célula atual imediatamente
      const seller = sellers[r];
      const mes    = months[c];
      if (seller && mes) handleCommit(`${seller.id}|${mes}`, currentValue);
      setPopover({ r, c, type, count: '', value: currentValue });
    },
    [sellers, months, handleCommit],
  );

  /* ---- Confirmar popover ---- */
  const handlePopoverConfirm = useCallback(() => {
    if (!popover) return;
    const count = parseInt(popover.count, 10);
    if (isNaN(count) || count < 1) return;

    const { r, c, type, value } = popover;
    const seller = sellers[r];
    if (!seller) { setPopover(null); return; }

    if (type === 'R') {
      // Replica valor nas próximas `count` células (c+1, c+2, ...)
      for (let i = 1; i <= count; i++) {
        const tc = c + i;
        if (tc >= months.length) break;
        handleCommit(`${seller.id}|${months[tc]}`, value);
      }
    } else {
      // Limpa `count` células a partir de c (inclusive)
      for (let i = 0; i < count; i++) {
        const tc = c + i;
        if (tc >= months.length) break;
        handleCommit(`${seller.id}|${months[tc]}`, 0);
      }
    }

    setPopover(null);
    focusCellAt(r, c);
  }, [popover, sellers, months, handleCommit, focusCellAt]);

  /* ---- Totais por mês ---- */
  const monthTotals = useMemo(
    () => months.map((mes) =>
      sellers.reduce((sum, s) => sum + (targetMap[`${s.id}|${mes}`] ?? 0), 0)
    ),
    [months, sellers, targetMap],
  );

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

        <div className="flex items-center gap-3">
          {/* Legenda de atalhos */}
          {isAdmin && (
            <span className="hidden sm:flex items-center gap-2 text-xs text-light-t3 dark:text-dark-t3">
              <kbd className="px-1.5 py-0.5 rounded border border-light-bmd dark:border-dark-bmd font-mono text-[10px]">R</kbd>
              Replicar
              <kbd className="px-1.5 py-0.5 rounded border border-light-bmd dark:border-dark-bmd font-mono text-[10px]">L</kbd>
              Limpar
              <kbd className="px-1.5 py-0.5 rounded border border-light-bmd dark:border-dark-bmd font-mono text-[10px]">↵</kbd>
              Desce
            </span>
          )}
          {!isAdmin && (
            <span className="text-xs text-light-t3 dark:text-dark-t3">
              Somente administradores podem editar metas.
            </span>
          )}

          {/* Indicador auto-save */}
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-danger">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Salvando…
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs font-medium text-success">
              <Check className="h-3.5 w-3.5" />
              Salvo ✓
            </span>
          )}
        </div>
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
              {sellers.map((seller, rowIdx) => (
                <tr
                  key={seller.id}
                  className={
                    rowIdx % 2 === 0
                      ? 'bg-light-s1 dark:bg-dark-s1'
                      : 'bg-light-s2/40 dark:bg-dark-s2/40'
                  }
                >
                  {/* Nome — sticky */}
                  <td
                    className="sticky left-0 z-10 py-2.5 px-4
                               font-medium text-light-t1 dark:text-dark-t1 whitespace-nowrap
                               border-r border-light-bmd dark:border-dark-bmd"
                    style={{
                      background: rowIdx % 2 === 0
                        ? 'var(--color-light-s1, #EEF0F4)'
                        : 'rgba(var(--color-light-s2-rgb, 248 249 251) / 0.4)',
                    }}
                  >
                    {seller.full_name}
                  </td>

                  {months.map((mes, colIdx) => {
                    const cellKey = `${seller.id}|${mes}`;
                    const isFocused = focusedCell?.r === rowIdx && focusedCell?.c === colIdx;
                    const cellPopover = (
                      popover?.r === rowIdx && popover?.c === colIdx
                        ? { type: popover.type, count: popover.count }
                        : null
                    );

                    return (
                      <TargetCell
                        key={mes}
                        cellKey={cellKey}
                        savedValue={targetMap[cellKey] ?? 0}
                        isAdmin={isAdmin}
                        isFocused={isFocused}
                        popover={cellPopover}
                        onCommit={handleCommit}
                        onFocusRequest={() => focusCellAt(rowIdx, colIdx)}
                        onNavigate={(dir, val) => handleNavigate(rowIdx, colIdx, dir, val)}
                        onTriggerAction={(type, val) => handleTriggerAction(rowIdx, colIdx, type, val)}
                        onPopoverCountChange={(count) =>
                          setPopover((prev) => prev ? { ...prev, count } : prev)
                        }
                        onPopoverConfirm={handlePopoverConfirm}
                        onPopoverCancel={() => {
                          setPopover(null);
                          focusCellAt(rowIdx, colIdx);
                        }}
                        registerInputRef={registerRef(rowIdx, colIdx) as (el: HTMLInputElement | null) => void}
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>

            {/* Rodapé — totais */}
            <tfoot>
              <tr className="border-t-2 border-light-bmd dark:border-dark-bmd bg-light-s2 dark:bg-dark-s2">
                <td
                  className="sticky left-0 z-10 bg-light-s2 dark:bg-dark-s2
                             py-3 px-4 font-bold text-light-t1 dark:text-dark-t1
                             border-r border-light-bmd dark:border-dark-bmd whitespace-nowrap"
                >
                  Total
                </td>
                {monthTotals.map((total, idx) => (
                  <td
                    key={months[idx]}
                    className="py-3 px-3 text-right font-bold tabular-nums text-light-t1 dark:text-dark-t1 whitespace-nowrap"
                  >
                    {total
                      ? formatBRL(total)
                      : <span className="text-light-t3 dark:text-dark-t3">—</span>}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default SalesTargetsPage;

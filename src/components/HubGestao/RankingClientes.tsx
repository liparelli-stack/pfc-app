/*
-- ===================================================
-- Código             : /src/components/HubGestao/RankingClientes.tsx
-- Versão             : 1.0.0
-- Data/Hora          : 2026-03-28 America/Sao_Paulo
-- Autor              : FL / Claude
-- Objetivo           : Tabela de ranking de clientes por performance de deals.
--                      Cabeçalho duplo agrupado por status (espera/ganha/perdida/encerrado).
--                      Ordenação client-side, filtros por vendedor e período.
-- Dependências       :
--   @/contexts/AuthContext (useAuth)
--   @/services/profilesService (getCurrentProfile)
--   @/hooks/useSalespersons (useSalespersons)
--   @/services/clientRankingService (fetchClientRanking, ClientRankingRow)
-- ===================================================
*/

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentProfile } from '@/services/profilesService';
import {
  fetchClientRanking,
  ClientRankingRow,
} from '@/services/clientRankingService';
import { useSalespersons } from '@/hooks/useSalespersons';
import { normalizeText } from '@/utils/textNormalization';
import ClientDetailModal from './ClientDetailModal';

/* ========================================================= */
/* Helpers                                                   */
/* ========================================================= */

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

function fmtBrl(v: number | null | undefined): string {
  if (v == null || v === 0) return '—';
  return brl.format(v);
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return pct.format(v / 100);
}

function fmtQty(v: number | null | undefined): string {
  if (v == null || v === 0) return '—';
  return String(Math.round(v));
}

function fmtTkm(v: number | null | undefined): string {
  if (v == null || v === 0) return '—';
  return brl.format(v);
}

function fmtDays(v: number | null | undefined): string {
  if (v == null) return '—';
  const d = Math.round(v);
  return `${d}d`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/** Acessa propriedade aninhada via path "a.b" */
function getNestedValue(row: ClientRankingRow, path: string): unknown {
  return path.split('.').reduce((obj: any, key) => obj?.[key], row);
}

function compareRows(a: ClientRankingRow, b: ClientRankingRow, key: string, dir: 'asc' | 'desc'): number {
  const va = getNestedValue(a, key);
  const vb = getNestedValue(b, key);

  let cmp = 0;
  if (va == null && vb == null) cmp = 0;
  else if (va == null) cmp = 1;
  else if (vb == null) cmp = -1;
  else if (typeof va === 'string' && typeof vb === 'string') {
    cmp = va.localeCompare(vb, 'pt-BR');
  } else {
    cmp = (va as number) < (vb as number) ? -1 : (va as number) > (vb as number) ? 1 : 0;
  }

  return dir === 'asc' ? cmp : -cmp;
}

/* ========================================================= */
/* Subcomponentes de UI                                      */
/* ========================================================= */

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ChevronsUpDown className="inline h-3 w-3 opacity-30 ml-0.5" />;
  return dir === 'asc'
    ? <ChevronUp   className="inline h-3 w-3 ml-0.5" style={{ color: 'var(--acc)' }} />
    : <ChevronDown className="inline h-3 w-3 ml-0.5" style={{ color: 'var(--acc)' }} />;
}

/* ========================================================= */
/* Definição de colunas                                      */
/* ========================================================= */

interface SubCol {
  key: string;        // dot-path para ordenação
  label: string;
  fmt: (row: ClientRankingRow) => string;
  align?: 'right';
}

interface ColGroup {
  label: string;
  cols: SubCol[];
  groupStyle?: React.CSSProperties;
}

const GROUPS: ColGroup[] = [
  {
    label: 'Em Espera',
    groupStyle: { background: 'rgba(245,158,11,0.08)', borderBottom: '2px solid rgba(245,158,11,0.4)' },
    cols: [
      { key: 'espera.total',   label: 'R$',  fmt: r => fmtBrl(r.espera.total),   align: 'right' },
      { key: 'espera.qty',     label: 'Qtd', fmt: r => fmtQty(r.espera.qty),     align: 'right' },
      { key: 'espera.tkm',     label: 'TKM', fmt: r => fmtTkm(r.espera.tkm),     align: 'right' },
      { key: 'espera.pct',     label: '%',   fmt: r => fmtPct(r.espera.pct),     align: 'right' },
      { key: 'espera.tmeDays', label: 'TME', fmt: r => fmtDays(r.espera.tmeDays),align: 'right' },
    ],
  },
  {
    label: 'Ganha',
    groupStyle: { background: 'rgba(62,207,142,0.08)', borderBottom: '2px solid rgba(62,207,142,0.4)' },
    cols: [
      { key: 'ganha.total',   label: 'R$',  fmt: r => fmtBrl(r.ganha.total),   align: 'right' },
      { key: 'ganha.qty',     label: 'Qtd', fmt: r => fmtQty(r.ganha.qty),     align: 'right' },
      { key: 'ganha.tkm',     label: 'TKM', fmt: r => fmtTkm(r.ganha.tkm),     align: 'right' },
      { key: 'ganha.pct',     label: '%',   fmt: r => fmtPct(r.ganha.pct),     align: 'right' },
      { key: 'ganha.tmaDays', label: 'TMA', fmt: r => fmtDays(r.ganha.tmaDays),align: 'right' },
    ],
  },
  {
    label: 'Perdido',
    groupStyle: { background: 'rgba(240,96,96,0.08)', borderBottom: '2px solid rgba(240,96,96,0.4)' },
    cols: [
      { key: 'perdida.total', label: 'R$',  fmt: r => fmtBrl(r.perdida.total), align: 'right' },
      { key: 'perdida.qty',   label: 'Qtd', fmt: r => fmtQty(r.perdida.qty),   align: 'right' },
      { key: 'perdida.pct',   label: '%',   fmt: r => fmtPct(r.perdida.pct),   align: 'right' },
    ],
  },
  {
    label: 'Encerrado',
    groupStyle: { background: 'rgba(144,150,163,0.08)', borderBottom: '2px solid rgba(144,150,163,0.3)' },
    cols: [
      { key: 'encerrado.total', label: 'R$',  fmt: r => fmtBrl(r.encerrado.total), align: 'right' },
      { key: 'encerrado.qty',   label: 'Qtd', fmt: r => fmtQty(r.encerrado.qty),   align: 'right' },
      { key: 'encerrado.pct',   label: '%',   fmt: r => fmtPct(r.encerrado.pct),   align: 'right' },
    ],
  },
];

/* ========================================================= */
/* Estilos inline compartilhados                             */
/* ========================================================= */

const thBase: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--t3)',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  cursor: 'pointer',
};

const thFixed: React.CSSProperties = {
  ...thBase,
  cursor: 'default',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--s2)',
  border: '0.5px solid var(--bmd)',
  borderRadius: '6px',
  padding: '5px 10px',
  fontSize: '13px',
  color: 'var(--t1)',
  outline: 'none',
};

/* ========================================================= */
/* Componente principal                                      */
/* ========================================================= */

const RankingClientes: React.FC = () => {
  const { currentProfileLite } = useAuth();
  const tenantId  = currentProfileLite?.tenantId ?? null;
  const userId    = currentProfileLite?.id ?? null;

  const [isAdmin,         setIsAdmin]         = useState<boolean | null>(null);
  const [selectedSellerId, setSelectedSellerId] = useState<string | undefined>(undefined);
  const [rows,         setRows]         = useState<ClientRankingRow[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [sortKey,      setSortKey]      = useState<string>('ganha.total');
  const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>('desc');
  const [periodStart,  setPeriodStart]  = useState<string | undefined>(undefined);
  const [periodEnd,    setPeriodEnd]    = useState<string | undefined>(undefined);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [pageSize,     setPageSize]     = useState(15);
  const [filterClient, setFilterClient] = useState('');

  const { salespersons } = useSalespersons();
  const [selectedCompany, setSelectedCompany] = useState<{
    id: string; name: string; row: ClientRankingRow;
  } | null>(null);

  /* ── Resolver role ── */
  useEffect(() => {
    let mounted = true;
    getCurrentProfile()
      .then((p) => { if (mounted) setIsAdmin(p?.role === 'admin'); })
      .catch(() => { if (mounted) setIsAdmin(false); });
    return () => { mounted = false; };
  }, []);

  /* ── Fetch ── */
  const load = useCallback(async () => {
    if (!tenantId) return;
    if (isAdmin === null) return;                    // role ainda não resolvido
    if (isAdmin && !selectedSellerId) return;        // admin: aguarda seleção explícita

    const authorUserId = isAdmin
      ? (selectedSellerId === 'ALL' ? undefined : selectedSellerId)
      : (userId ?? undefined);

    setLoading(true);
    setError(null);
    try {
      const data = await fetchClientRanking({
        tenantId,
        authorUserId,
        periodStart,
        periodEnd,
      });
      setRows(data);
    } catch (err: any) {
      setError(err?.message ?? 'Falha ao carregar ranking de clientes.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, userId, selectedSellerId, periodStart, periodEnd, isAdmin]);

  useEffect(() => { void load(); }, [load]);


  /* ── Filtro por nome de cliente ── */
  const filtered = useMemo(() =>
    filterClient
      ? rows.filter(r => normalizeText(r.companyName).includes(normalizeText(filterClient)))
      : rows,
    [rows, filterClient]
  );

  /* ── Ordenação client-side ── */
  const sorted = useMemo(
    () => filtered.slice().sort((a, b) => compareRows(a, b, sortKey, sortDir)),
    [filtered, sortKey, sortDir]
  );

  /* ── Paginação client-side ── */
  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginated  = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  /* ── Handler de coluna sortável ── */
  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function clearFilters() {
    setFilterClient('');
    if (isAdmin === true) {
      setSelectedSellerId(undefined);
      setRows([]);
    }
    setPeriodStart(undefined);
    setPeriodEnd(undefined);
    setCurrentPage(1);
  }

  const hasFilter = filterClient !== '' || (isAdmin === true && selectedSellerId != null) || periodStart != null || periodEnd != null;

  /* ── Score color ── */
  const getScoreColor = (score: number) =>
    score >= 70 ? 'var(--success)' : score >= 40 ? 'var(--warning)' : 'var(--danger)';

  /* ── PaginationBar ── */
  function PaginationBar() {
    const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const to   = Math.min(currentPage * pageSize, totalItems);
    const btnStyle = (disabled: boolean): React.CSSProperties => ({
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '28px', height: '28px',
      background: 'var(--s2)', border: '0.5px solid var(--bmd)', borderRadius: '6px',
      fontSize: '13px', color: 'var(--t2)', cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1, userSelect: 'none',
    });
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: '8px', padding: '8px 0',
        fontSize: '12px', color: 'var(--t3)',
      }}>
        {/* Itens por página */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Itens por página:</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            style={{ ...inputStyle, padding: '3px 8px', fontSize: '12px' }}
          >
            <option value={15}>15</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </div>

        {/* Navegação */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Mostrando {from}–{to} de {totalItems} clientes</span>
          <button
            style={btnStyle(currentPage === 1)}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            title="Página anterior"
          >‹</button>
          <span style={{ color: 'var(--t2)' }}>Página {currentPage} de {totalPages}</span>
          <button
            style={btnStyle(currentPage === totalPages)}
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            title="Próxima página"
          >›</button>
        </div>
      </div>
    );
  }

  /* ── Th helper ── */
  function Th({ colKey, children, align }: { colKey: string; children: React.ReactNode; align?: 'right' }) {
    const active = sortKey === colKey;
    return (
      <th
        style={{ ...thBase, textAlign: align ?? 'left' }}
        onClick={() => handleSort(colKey)}
        title={`Ordenar por ${colKey}`}
      >
        {children}
        <SortIcon active={active} dir={sortDir} />
      </th>
    );
  }

  /* ── Render ── */
  return (
    <div style={{ background: 'var(--s1)', border: '0.5px solid var(--bmd)', borderRadius: '12px', padding: '20px' }}>

      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--t1)', margin: 0 }}>
          Performance das Carteiras
        </h2>

        {/* Filtros */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Select de vendedor — só para admin */}
          {isAdmin === true && (
            <select
              value={selectedSellerId ?? ''}
              onChange={(e) => { setSelectedSellerId(e.target.value || undefined); setCurrentPage(1); }}
              style={inputStyle}
            >
              <option value="" disabled>Selecione um vendedor ou todos</option>
              <option value="ALL">Todos os vendedores</option>
              {salespersons.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          {/* Busca por cliente */}
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={filterClient}
            onChange={(e) => { setFilterClient(e.target.value); setCurrentPage(1); }}
            style={{ ...inputStyle, minWidth: '160px' }}
          />

          {/* Período */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--t3)' }}>De</span>
            <input
              type="date"
              value={periodStart ?? ''}
              onChange={(e) => { setPeriodStart(e.target.value || undefined); setCurrentPage(1); }}
              style={inputStyle}
            />
            <span style={{ fontSize: '12px', color: 'var(--t3)' }}>Até</span>
            <input
              type="date"
              value={periodEnd ?? ''}
              onChange={(e) => { setPeriodEnd(e.target.value || undefined); setCurrentPage(1); }}
              style={inputStyle}
            />
          </div>

          {/* Limpar */}
          {hasFilter && (
            <button
              onClick={clearFilters}
              title="Limpar filtros"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                background: 'transparent', border: '0.5px solid var(--bmd)',
                borderRadius: '6px', padding: '5px 10px',
                fontSize: '12px', color: 'var(--t2)', cursor: 'pointer',
              }}
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Estado neutro — admin ainda não selecionou filtro */}
      {isAdmin === true && !selectedSellerId && (
        <p style={{ padding: '32px', textAlign: 'center', color: 'var(--t3)', fontSize: '13px', margin: 0 }}>
          Selecione um vendedor ou utilize o filtro &ldquo;Todos&rdquo; para carregar os dados.
        </p>
      )}

      {/* Estados: loading / erro / vazio */}
      {loading && (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--t3)', fontSize: '13px' }}>
          Carregando...
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: '16px', background: 'rgba(240,96,96,0.08)', borderRadius: '8px', color: '#f06060', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {!loading && !error && sorted.length === 0 && (isAdmin === false || !!selectedSellerId) && (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--t3)', fontSize: '13px' }}>
          Nenhum dado encontrado para os filtros selecionados.
        </div>
      )}

      {/* Tabela */}
      {!loading && !error && sorted.length > 0 && (
        <div>
          <PaginationBar />
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              {/* Linha 1 — grupos */}
              <tr style={{ borderBottom: '0.5px solid var(--bmd)' }}>
                {/* Colunas fixas — rowSpan=2 */}
                <th style={{ ...thFixed, width: '32px', textAlign: 'center' }} rowSpan={2}>#</th>
                <th style={{ ...thBase, minWidth: '140px' }} rowSpan={2} onClick={() => handleSort('companyName')}>
                  Cliente <SortIcon active={sortKey === 'companyName'} dir={sortDir} />
                </th>
                <th style={{ ...thBase, minWidth: '100px' }} rowSpan={2} onClick={() => handleSort('ownerName')}>
                  Vendedor <SortIcon active={sortKey === 'ownerName'} dir={sortDir} />
                </th>
                <th style={{ ...thBase, minWidth: '80px' }} rowSpan={2} onClick={() => handleSort('lastInteraction')}>
                  Última Inter. <SortIcon active={sortKey === 'lastInteraction'} dir={sortDir} />
                </th>
                <th style={{ ...thFixed, textAlign: 'center', minWidth: '80px' }} colSpan={2}>
                  Chats
                </th>

                {/* Grupos */}
                {GROUPS.map((g) => (
                  <th
                    key={g.label}
                    colSpan={g.cols.length}
                    style={{ ...thFixed, textAlign: 'center', ...g.groupStyle }}
                  >
                    {g.label}
                  </th>
                ))}

                {/* Score — rowSpan=2 */}
                <th style={{ ...thBase, textAlign: 'center', width: '48px' }} rowSpan={2} onClick={() => handleSort('healthScore')}>
                  Score <SortIcon active={sortKey === 'healthScore'} dir={sortDir} />
                </th>
              </tr>

              {/* Linha 2 — sub-colunas */}
              <tr style={{ borderBottom: '0.5px solid var(--bmd)' }}>
                <th style={{ ...thBase, textAlign: 'right' }} onClick={() => handleSort('totalChats')} title="Total de chats">
                  Tot <SortIcon active={sortKey === 'totalChats'} dir={sortDir} />
                </th>
                <th style={{ ...thBase, textAlign: 'right' }} onClick={() => handleSort('chatsWithBudget')} title="Chats com orçamento">
                  Orc <SortIcon active={sortKey === 'chatsWithBudget'} dir={sortDir} />
                </th>
                {GROUPS.flatMap((g) =>
                  g.cols.map((c) => (
                    <th
                      key={c.key}
                      style={{ ...thBase, textAlign: c.align ?? 'left', ...g.groupStyle }}
                      onClick={() => handleSort(c.key)}
                      title={`Ordenar por ${c.label}`}
                    >
                      {c.label}
                      <SortIcon active={sortKey === c.key} dir={sortDir} />
                    </th>
                  ))
                )}
              </tr>
            </thead>

            <tbody>
              {paginated.map((row, idx) => (
                <tr
                  key={row.companyId}
                  style={{
                    borderBottom: '0.5px solid var(--blo)',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--s2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* # */}
                  <td style={{ padding: '8px', textAlign: 'center', color: 'var(--t3)', fontVariantNumeric: 'tabular-nums' }}>
                    {(currentPage - 1) * pageSize + idx + 1}
                  </td>

                  {/* Cliente */}
                  <td style={{ padding: '8px 8px 8px 4px', color: 'var(--t1)', fontWeight: 500 }}>
                    {row.companyName}
                  </td>

                  {/* Vendedor */}
                  <td style={{ padding: '8px', color: 'var(--t2)' }}>
                    {row.ownerName ?? '—'}
                  </td>

                  {/* Última Interação */}
                  <td style={{ padding: '8px', color: 'var(--t2)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtDate(row.lastInteraction)}
                  </td>

                  {/* Chats — Tot */}
                  <td style={{ padding: '8px', textAlign: 'right', color: 'var(--t2)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtQty(row.totalChats)}
                  </td>

                  {/* Chats — Orc */}
                  <td style={{ padding: '8px', textAlign: 'right', color: 'var(--t2)', fontVariantNumeric: 'tabular-nums' }}>
                    {fmtQty(row.chatsWithBudget)}
                  </td>

                  {/* Grupos */}
                  {GROUPS.flatMap((g) =>
                    g.cols.map((c) => (
                      <td
                        key={c.key}
                        style={{
                          padding: '8px',
                          textAlign: c.align ?? 'left',
                          color: 'var(--t2)',
                          fontVariantNumeric: 'tabular-nums',
                          fontFamily: 'var(--font-mono, monospace)',
                          fontSize: '11px',
                        }}
                      >
                        {c.fmt(row)}
                      </td>
                    ))
                  )}

                  {/* Score */}
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <button
                      onClick={() => setSelectedCompany({ id: row.companyId, name: row.companyName, row })}
                      title="Ver detalhes do cliente"
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        padding: '2px 6px', fontFamily: 'var(--mono)', fontSize: '12px',
                        fontWeight: 500, color: getScoreColor(row.healthScore),
                      }}
                    >
                      {row.healthScore}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <PaginationBar />
        </div>
      )}

      {/* Modal de detalhe */}
      {selectedCompany && (
        <ClientDetailModal
          companyId={selectedCompany.id}
          companyName={selectedCompany.name}
          rankingRow={selectedCompany.row}
          onClose={() => setSelectedCompany(null)}
        />
      )}
    </div>
  );
};

export default RankingClientes;

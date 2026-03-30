/*
-- ===================================================
-- Código             : /src/components/HubGestao/ClientDetailModal.tsx
-- Versão             : 1.0.0
-- Data/Hora          : 2026-03-28 America/Sao_Paulo
-- Autor              : FL / Claude
-- Objetivo           : Modal de detalhe de cliente com 4 seções:
--                      1. Números (rankingRow)
--                      2. Comportamento (cadência, temperatura, canal)
--                      3. Score de Risco
--                      4. IA ✨ — análise Gemini on-demand
-- Dependências       :
--   @/components/ui/Modal
--   @/services/clientDetailService
--   @/services/ai/geminiChatService
--   @/contexts/AuthContext
--   echarts-for-react
-- ===================================================
*/

import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { Sparkles, AlertTriangle, CheckCircle, Clock, BookmarkPlus, BookmarkCheck } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { fetchClientDetail, ClientDetail } from '@/services/clientDetailService';
import { generateGeminiContent } from '@/services/ai/geminiChatService';
import type { ClientRankingRow } from '@/services/clientRankingService';

/* ========================================================= */
/* Props                                                     */
/* ========================================================= */

interface Props {
  companyId: string;
  companyName: string;
  rankingRow: ClientRankingRow;
  onClose: () => void;
}

/* ========================================================= */
/* Helpers de formatação                                     */
/* ========================================================= */

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

function fmtBrl(v: number | null | undefined): string {
  if (v == null || v === 0) return '—';
  return brl.format(v);
}
function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return pctFmt.format(v / 100);
}
function fmtQty(v: number | null | undefined): string {
  if (v == null || v === 0) return '—';
  return String(Math.round(v));
}
function fmtDays(v: number | null | undefined, suffix = 'd'): string {
  if (v == null) return '—';
  return `${Math.round(v)}${suffix}`;
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/* ========================================================= */
/* Risk helpers                                              */
/* ========================================================= */

function riskColor(score: number): string {
  if (score < 30) return '#3ecf8e';
  if (score < 60) return '#f59e0b';
  return '#f06060';
}
function riskBg(score: number): string {
  if (score < 30) return 'rgba(62,207,142,0.12)';
  if (score < 60) return 'rgba(245,158,11,0.12)';
  return 'rgba(240,96,96,0.12)';
}

function healthLabel(h: number): string {
  if (h >= 80) return 'Excelente';
  if (h >= 50) return 'Regular';
  return 'Crítico';
}
function healthColor(h: number): string {
  if (h >= 80) return '#3ecf8e';
  if (h >= 50) return '#f59e0b';
  return '#f06060';
}
function healthBg(h: number): string {
  if (h >= 80) return 'rgba(62,207,142,0.12)';
  if (h >= 50) return 'rgba(245,158,11,0.12)';
  return 'rgba(240,96,96,0.12)';
}

/* ========================================================= */
/* Sub-componentes de seção                                  */
/* ========================================================= */

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t3)', marginBottom: '12px' }}>
    {children}
  </h3>
);

const StatCard: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div style={{ background: 'var(--s2)', border: '0.5px solid var(--bmd)', borderRadius: '8px', padding: '10px 12px' }}>
    <div style={{ fontSize: '10px', color: 'var(--t3)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--t1)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    {sub && <div style={{ fontSize: '10px', color: 'var(--t3)', marginTop: '2px' }}>{sub}</div>}
  </div>
);

/* ========================================================= */
/* Componente principal                                      */
/* ========================================================= */

const ClientDetailModal: React.FC<Props> = ({ companyId, companyName, rankingRow, onClose }) => {
  const { currentProfileLite } = useAuth();
  const tenantId = currentProfileLite?.tenantId ?? '';

  const [detail, setDetail]           = useState<ClientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError]  = useState<string | null>(null);
  const [aiText, setAiText]           = useState<string | null>(null);
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiError, setAiError]         = useState<string | null>(null);
  const [notaSalva, setNotaSalva]     = useState(false);

  /* ── Carrega detalhe ao abrir ── */
  useEffect(() => {
    if (!tenantId) return;
    let mounted = true;
    setDetailLoading(true);
    setDetailError(null);

    fetchClientDetail(companyId, tenantId)
      .then((d) => { if (mounted) setDetail(d); })
      .catch((err: any) => {
        console.error('fetchClientDetail ERRO COMPLETO:', err);
        console.log('params:', { companyId, tenantId });
        if (mounted) setDetailError(err?.message ?? 'Erro ao carregar dados.');
      })
      .finally(() => { if (mounted) setDetailLoading(false); });

    return () => { mounted = false; };
  }, [companyId, tenantId]);

  /* ── Gera análise IA ── */
  async function handleGenerateAi() {
    if (!detail) return;
    setAiLoading(true);
    setAiError(null);
    setAiText(null);

    try {
      const tendencia =
        detail.currentTempScore >= detail.peakTempScore
          ? 'estável no pico'
          : detail.currentTempScore < detail.peakTempScore - 1
          ? 'esfriando significativamente'
          : 'leve queda';

      const canalPreferido =
        Object.entries(detail.channelMix).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'desconhecido';

      const dadosIA = {
        nomeCliente:          companyName,
        diasSemContato:       detail.daysSilent,
        intervaloMedioDias:   detail.avgIntervalDays,
        temperatureAtual:     detail.currentTemp,
        temperaturaPico:      detail.peakTemp,
        tendenciaTemperatura: tendencia,
        totalOrcamentos:      detail.totalBudgets,
        orcamentosPerdidos:   detail.lostBudgets,
        orcamentosEmEspera:   rankingRow.espera.qty,
        valorEmEspera:        rankingRow.espera.total,
        diasUltimoOrcamento:  detail.daysNoBudget,
        acoesEmAberto:        detail.openActions,
        acoesAtrasadas:       detail.overdueActions,
        proximaAcao:          detail.nextAction,
        canalPreferido,
        scoreDeRisco:         detail.riskScore,
        scoreDeSaude:         100 - detail.riskScore,
        penalidades:          detail.riskBreakdown,
      };

      console.log('PROMPT IA enxuto:', JSON.stringify(dadosIA, null, 2));

      const system = `Você é um consultor comercial especialista em vendas B2B para hospitais e clínicas.
Analise os dados do relacionamento comercial abaixo e gere um parecer com EXATAMENTE 3 parágrafos:

Parágrafo 1 — PERFIL: Descreva o relacionamento (cadência, temperatura, engajamento, canal preferido).
Parágrafo 2 — ATENÇÃO: Aponte riscos e oportunidades (score de saúde, orçamentos em espera, ações atrasadas).
Parágrafo 3 — RECOMENDAÇÃO: Indique a próxima ação comercial específica e objetiva para este cliente.

Regras:
- Tom consultivo e direto, sem formalidades como "Prezado Analista"
- Sem markdown, sem asteriscos
- Cada parágrafo deve começar com seu subtítulo em maiúsculas seguido de dois pontos:
  "PERFIL: ..."
  "ATENÇÃO: ..."
  "RECOMENDAÇÃO: ..."
- Máximo 220 palavras no total
- Sempre escrever o parágrafo RECOMENDAÇÃO com ação concreta`;

      const prompt = `Dados do cliente:\n${JSON.stringify(dadosIA, null, 2)}`;

      const response = await generateGeminiContent({ prompt, system });
      const cleaned = response
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/#{1,6}\s/g, '')
        .trim();
      setAiText(cleaned);
    } catch (err: any) {
      setAiError(err?.message ?? 'Falha ao gerar análise.');
    } finally {
      setAiLoading(false);
    }
  }

  /* ── Salva análise como nota IA ── */
  async function handleSaveNote() {
    if (!aiText || !detail) return;
    try {
      await supabase.from('ai_notes').insert({
        tenant_id:        tenantId,
        owner_profile_id: userId,
        title:            `Análise IA — ${companyName}`,
        body:             aiText,
        tags:             ['analise-ia', 'performance-carteiras'],
        metadata: {
          company_id:    companyId,
          company_name:  companyName,
          health_score:  100 - detail.riskScore,
          risk_score:    detail.riskScore,
          generated_at:  new Date().toISOString(),
          source:        'performance-carteiras',
        },
      });
      setNotaSalva(true);
    } catch (err) {
      console.error('[ClientDetailModal] handleSaveNote error:', err);
    }
  }

  /* ── ECharts option para temperatura ── */
  function buildTempChartOption(timeline: ClientDetail['tempTimeline']) {
    const tempLabels: Record<number, string> = { 1: 'Fria', 2: 'Neutra', 3: 'Morna', 4: 'Quente' };
    return {
      grid: { top: 20, right: 10, bottom: 30, left: 52 },
      xAxis: {
        type: 'time',
        axisLabel: { show: false },
        axisTick:  { show: false },
        axisLine:  { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      },
      yAxis: {
        type: 'value',
        min: 1,
        max: 4,
        interval: 1,
        axisLabel: {
          fontSize: 10,
          color: '#9096a3',
          formatter: (v: number) => tempLabels[v] ?? '',
        },
        splitLine: { lineStyle: { color: 'rgba(144,150,163,0.15)' } },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#13151a',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#f0eeec', fontSize: 11 },
        formatter: (params: any[]) => {
          const p = params[0];
          const d = new Date(p.value[0]);
          const day = String(d.getUTCDate()).padStart(2, '0');
          const mon = String(d.getUTCMonth() + 1).padStart(2, '0');
          return `${day}/${mon}<br/>${p.value[2]} (${p.value[1]})`;
        },
      },
      series: [{
        type: 'line',
        data: timeline.map((t) => [t.ts, t.score, t.temperature]),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#3b68f5', width: 2 },
        itemStyle: { color: '#3b68f5' },
        areaStyle: { color: 'rgba(59,104,245,0.1)' },
      }],
    };
  }

  /* ── Render seção de loading/erro do detail ── */
  const renderDetailBody = () => {
    if (detailLoading) {
      return (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--t3)', fontSize: '13px' }}>
          Carregando dados comportamentais...
        </div>
      );
    }
    if (detailError) {
      return (
        <div style={{ padding: '16px', background: riskBg(100), borderRadius: '8px', color: '#f06060', fontSize: '13px' }}>
          {detailError}
        </div>
      );
    }
    if (!detail) return null;

    const riskC = riskColor(detail.riskScore);
    const hs = 100 - detail.riskScore;
    const hColor = healthColor(hs);
    const hBg    = healthBg(hs);
    const hLabel = healthLabel(hs);

    return (
      <>
        {/* ── SEÇÃO 2: COMPORTAMENTO ── */}
        <div style={{ marginBottom: '24px' }}>
          <SectionTitle>Comportamento</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>

            {/* a) Cadência */}
            <div style={{ background: 'var(--s2)', border: '0.5px solid var(--bmd)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', marginBottom: '8px', textTransform: 'uppercase' }}>Cadência</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {[
                  { label: 'Dias em silêncio',   value: fmtDays(detail.daysSilent) },
                  { label: 'Intervalo médio',    value: detail.avgIntervalDays != null ? fmtDays(detail.avgIntervalDays) : '—' },
                  { label: 'Primeiro chat',      value: fmtDate(detail.firstChatAt) },
                  { label: 'Ações em aberto',    value: fmtQty(detail.openActions) },
                  { label: 'Atrasadas',     value: fmtQty(detail.overdueActions) },
                  {
                    label: 'Próxima ação',
                    value: detail.nextAction
                      ? `${detail.nextAction.kind} • ${fmtDate(detail.nextAction.calendarAt)}`
                      : '—',
                  },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: 'var(--t3)' }}>{label}</span>
                    <span style={{ color: 'var(--t1)', fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* b) Temperatura */}
            <div style={{ background: 'var(--s2)', border: '0.5px solid var(--bmd)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', marginBottom: '6px', textTransform: 'uppercase' }}>Temperatura</div>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--t3)' }}>Atual</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--t1)' }}>
                    {detail.currentTemp}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '10px', color: 'var(--t3)' }}>Pico</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--t1)' }}>{detail.peakTemp}</span>
                    {detail.firstChatAt && detail.lastChatAt && (() => {
                      const fmt = (iso: string) => {
                        const d = new Date(iso);
                        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
                        const yy = String(d.getUTCFullYear()).slice(2);
                        return `${mm}/${yy}`;
                      };
                      return (
                        <span style={{ fontSize: '11px', color: 'var(--t3)' }}>
                          {fmt(detail.firstChatAt)} a {fmt(detail.lastChatAt)}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
              {detail.tempTimeline.length > 0 ? (
                <ReactECharts
                  option={buildTempChartOption(detail.tempTimeline)}
                  style={{ height: '140px' }}
                  opts={{ renderer: 'svg' }}
                />
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--t3)', padding: '8px 0' }}>Sem histórico de temperatura.</div>
              )}
            </div>

            {/* c) Mix de canais */}
            <div style={{ background: 'var(--s2)', border: '0.5px solid var(--bmd)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--t3)', marginBottom: '8px', textTransform: 'uppercase' }}>Mix de Canais</div>
              {Object.keys(detail.channelMix).length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--t3)' }}>Sem dados.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {Object.entries(detail.channelMix)
                    .sort((a, b) => b[1] - a[1])
                    .map(([canal, valor]) => (
                      <div key={canal} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                        <span style={{ color: 'var(--t2)', textTransform: 'capitalize' }}>{canal}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '60px', height: '4px', borderRadius: '2px', background: 'var(--s3)', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(valor, 100)}%`, height: '100%', background: 'var(--acc)', borderRadius: '2px' }} />
                          </div>
                          <span style={{ color: 'var(--t1)', fontWeight: 500, minWidth: '32px', textAlign: 'right' }}>
                            {pctFmt.format(valor / 100)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── SEÇÃO 3: SCORE DE SAÚDE ── */}
        <div style={{ marginBottom: '24px' }}>
          <SectionTitle>Score de Saúde</SectionTitle>
          <div style={{ background: 'var(--s2)', border: `0.5px solid ${hColor}40`, borderRadius: '8px', padding: '16px' }}>
            {/* Score + barra */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              <div style={{
                fontSize: '36px', fontWeight: 700, color: hColor,
                minWidth: '64px', textAlign: 'center',
                background: hBg, borderRadius: '8px', padding: '8px',
              }}>
                {hs}
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: hColor }}>{hLabel}</div>
                <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '4px' }}>Score 0–100</div>
                <div style={{ width: '160px', height: '6px', background: 'var(--s3)', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(hs, 100)}%`,
                    height: '100%',
                    background: hColor,
                    borderRadius: '3px',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            </div>

            {/* Tabela explicativa */}
            {(() => {
              const SCORE_MAX = { silence: 40, cooling: 20, no_budget: 20, loss_rate: 10, overdue: 10 };
              const thS: React.CSSProperties = { padding: '6px 8px', textAlign: 'left', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--t3)', whiteSpace: 'nowrap' };
              const thR: React.CSSProperties = { ...thS, textAlign: 'right' };
              const rows = [
                { indicador: 'Silêncio',      pergunta: 'Há quanto tempo sem contato?',         dado: `${detail.daysSilent}d`,                                          maxPts: SCORE_MAX.silence,   pen: detail.riskBreakdown.silence   },
                { indicador: 'Esfriamento',   pergunta: 'Temperatura caiu do pico?',             dado: `Atual: ${detail.currentTemp} / Pico: ${detail.peakTemp}`,        maxPts: SCORE_MAX.cooling,   pen: detail.riskBreakdown.cooling   },
                { indicador: 'Sem orçamento', pergunta: 'Último orçamento há quantos dias?',     dado: detail.daysNoBudget != null ? `${detail.daysNoBudget}d` : '—',    maxPts: SCORE_MAX.no_budget, pen: detail.riskBreakdown.no_budget },
                { indicador: 'Taxa de perda', pergunta: '% de orçamentos perdidos?',             dado: `${detail.lostBudgets} perdidos / ${detail.totalBudgets} total`,  maxPts: SCORE_MAX.loss_rate, pen: detail.riskBreakdown.loss_rate },
                { indicador: 'Atrasadas',     pergunta: 'Tarefas com data vencida?',             dado: `${detail.overdueActions} tarefas atrasadas`,                    maxPts: SCORE_MAX.overdue,   pen: detail.riskBreakdown.overdue   },
              ];
              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '0.5px solid var(--blo)' }}>
                      <th style={thS}>Indicador</th>
                      <th style={thS}>Pergunta</th>
                      <th style={thS}>Dado Real</th>
                      <th style={thR}>Máx</th>
                      <th style={thR}>Penalidade</th>
                      <th style={thR}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const saldo = row.maxPts - row.pen;
                      const penColor  = row.pen > 0 ? '#f06060' : 'var(--t3)';
                      const saldoColor = saldo === row.maxPts ? '#3ecf8e' : saldo === 0 ? '#f06060' : '#f59e0b';
                      return (
                        <tr key={row.indicador} style={{ borderBottom: '0.5px solid var(--blo)' }}>
                          <td style={{ padding: '7px 8px', fontWeight: 600, color: 'var(--t2)' }}>{row.indicador}</td>
                          <td style={{ padding: '7px 8px', color: 'var(--t3)' }}>{row.pergunta}</td>
                          <td style={{ padding: '7px 8px', color: 'var(--t1)', fontVariantNumeric: 'tabular-nums' }}>{row.dado}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--t3)', fontVariantNumeric: 'tabular-nums' }}>{row.maxPts}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600, color: penColor, fontVariantNumeric: 'tabular-nums' }}>-{row.pen}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: saldoColor, fontVariantNumeric: 'tabular-nums' }}>{saldo}</td>
                        </tr>
                      );
                    })}
                    {/* Rodapé */}
                    <tr style={{ borderTop: '0.5px solid var(--bmd)' }}>
                      <td colSpan={3} />
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase' }}>Total</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: '#f06060', fontVariantNumeric: 'tabular-nums' }}>-{detail.riskScore} pts</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: hColor, fontVariantNumeric: 'tabular-nums' }}>{hs} pts</td>
                    </tr>
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>

        {/* ── SEÇÃO 4: IA ── */}
        <div>
          <SectionTitle>✨ Análise IA</SectionTitle>
          <div style={{ background: 'var(--s2)', border: '0.5px solid var(--bmd)', borderRadius: '8px', padding: '16px' }}>
            <button
              onClick={handleGenerateAi}
              disabled={aiLoading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: aiLoading ? 'var(--s3)' : '#3b68f5',
                color: aiLoading ? 'var(--t3)' : '#ffffff',
                border: '0.5px solid rgba(59,104,245,0.38)',
                borderRadius: '8px', padding: '8px 16px',
                fontSize: '13px', fontWeight: 500, cursor: aiLoading ? 'not-allowed' : 'pointer',
                boxShadow: aiLoading ? 'none' : '0 1px 8px rgba(59,104,245,0.35)',
                marginBottom: '12px',
              }}
            >
              <Sparkles className="h-4 w-4" />
              {aiLoading ? 'Gerando análise...' : 'Gerar análise IA'}
            </button>

            {aiError && (
              <div style={{ padding: '10px 12px', background: 'rgba(240,96,96,0.08)', borderRadius: '6px', color: '#f06060', fontSize: '12px', marginBottom: '8px' }}>
                {aiError}
              </div>
            )}

            {aiText && (
              <div style={{
                background: 'var(--s2)', border: '0.5px solid var(--bmd)',
                borderRadius: '8px', padding: '16px',
                fontSize: '13px', lineHeight: '1.75',
                display: 'flex', flexDirection: 'column', gap: '12px',
              }}>
                {aiText.split(/\n\n+/).filter(Boolean).map((para, i) => {
                  const match = para.match(/^(PERFIL|ATENÇÃO|RECOMENDAÇÃO):\s*/);
                  if (match) {
                    const subtitle = match[1] + ':';
                    const body = para.slice(match[0].length);
                    return (
                      <p key={i} style={{ margin: 0, color: 'var(--t2)' }}>
                        <span style={{ fontWeight: 500, color: '#3b68f5', marginRight: '4px' }}>{subtitle}</span>
                        {body}
                      </p>
                    );
                  }
                  return <p key={i} style={{ margin: 0, color: 'var(--t2)' }}>{para}</p>;
                })}
              </div>
            )}

            {aiText && (
              <div style={{ marginTop: '8px' }}>
                {notaSalva ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: '#3ecf8e' }}>
                    <BookmarkCheck className="h-3.5 w-3.5" />
                    Salvo em Notas IA
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      background: 'transparent', border: '0.5px solid var(--bmd)',
                      color: 'var(--t2)', borderRadius: '8px', padding: '6px 12px',
                      fontSize: '12px', cursor: 'pointer',
                    }}
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    Salvar em Notas IA
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  /* ── Render ── */
  const hs        = 100 - (detail?.riskScore ?? 0);
  const hColor    = healthColor(hs);
  const hBadgeBg  = healthBg(hs);
  const hLabelBadge = healthLabel(hs);

  return (
    <Modal isOpen onClose={onClose} title={companyName} size="2xl">
      {/* Badge de saúde (logo após o título do Modal) */}
      {detail && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', marginTop: '-8px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            background: hBadgeBg, color: hColor,
            border: `0.5px solid ${hColor}40`,
            borderRadius: '20px', padding: '3px 10px', fontSize: '11px', fontWeight: 600,
          }}>
            {hs >= 80
              ? <CheckCircle className="h-3 w-3" />
              : hs >= 50
              ? <Clock className="h-3 w-3" />
              : <AlertTriangle className="h-3 w-3" />
            }
            {hLabelBadge} · {hs}pts
          </span>
        </div>
      )}

      {/* ── SEÇÃO 1: NÚMEROS (rankingRow) ── */}
      <div style={{ marginBottom: '24px' }}>
        <SectionTitle>Números</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
          {/* Em Espera */}
          <StatCard label="Espera R$"  value={fmtBrl(rankingRow.espera.total)} sub={`Qtd ${fmtQty(rankingRow.espera.qty)}`} />
          <StatCard label="Espera TKM" value={fmtBrl(rankingRow.espera.tkm)}   sub={`TME ${fmtDays(rankingRow.espera.tmeDays)}`} />
          {/* Ganha */}
          <StatCard label="Ganha R$"   value={fmtBrl(rankingRow.ganha.total)}  sub={`Qtd ${fmtQty(rankingRow.ganha.qty)}`} />
          <StatCard label="Ganha TKM"  value={fmtBrl(rankingRow.ganha.tkm)}    sub={`TMA ${fmtDays(rankingRow.ganha.tmaDays)}`} />
          {/* Perdido */}
          <StatCard label="Perdido R$" value={fmtBrl(rankingRow.perdida.total)} sub={`Qtd ${fmtQty(rankingRow.perdida.qty)} · ${fmtPct(rankingRow.perdida.pct)}`} />
          {/* Encerrado */}
          <StatCard label="Encerrado R$" value={fmtBrl(rankingRow.encerrado.total)} sub={`Qtd ${fmtQty(rankingRow.encerrado.qty)} · ${fmtPct(rankingRow.encerrado.pct)}`} />
          {/* Totais de chats */}
          <StatCard label="Total Chats" value={fmtQty(rankingRow.totalChats)} />
          {/* Orçamentos */}
          <StatCard
            label="Total Orçamentos"
            value={detail != null ? String(detail.totalBudgets) : '—'}
            sub={detail != null ? `${detail.lostBudgets} perdidos` : undefined}
          />
        </div>
      </div>

      {/* Seções 2, 3, 4 (dependem do fetch de detail) */}
      {renderDetailBody()}
    </Modal>
  );
};

export default ClientDetailModal;

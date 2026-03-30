/*
-- ===================================================
-- Código             : src/components/HubGestao/BaseDiagnostics.tsx
-- Versão             : 1.0.0
-- Data/Hora          : 2026-03-29 America/Sao_Paulo
-- Autor              : FL / Claude
-- Objetivo           : Diagnóstico da base de clientes (totais, cobertura).
-- ===================================================
*/

import { useState } from 'react';
import { Loader2, AlertCircle, Sparkles, Loader2 as AiLoader, Save, CheckCircle } from 'lucide-react';
import useBaseDiagnostics from '@/hooks/useBaseDiagnostics';
import { generateGeminiContent } from '@/services/geminiModelsService';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const KINDS = ['lead', 'prospect', 'client'] as const;

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function coverageColor(pct: number): string {
  if (pct >= 80) return '#3ecf8e';
  if (pct >= 50) return '#f59e0b';
  return '#f06060';
}

const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--t3)',
  marginBottom: '12px',
};

export default function BaseDiagnostics() {
  const { data, isLoading, error } = useBaseDiagnostics();
  const { currentProfileLite } = useAuth();
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '40px', color: 'var(--t3)', fontSize: '13px' }}>
        <Loader2 size={20} className="animate-spin" />
        Carregando diagnóstico...
      </div>
    );
  }

  if (error || !data) {
    console.error('[BaseDiagnostics] error:', error);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '20px', color: 'var(--danger)', fontSize: '13px' }}>
        <AlertCircle size={16} />
        Erro ao carregar dados.
      </div>
    );
  }

  /* ── IA — funções ── */
  function buildPrompt(): string {
    const totalAtivo = (data!.totals.lead.active + data!.totals.prospect.active + data!.totals.client.active);
    const cov = data!.coverage;
    const bud = data!.budgets;

    const clientesBudgets = bud.filter(b => b.kind === 'client');
    const aberta  = clientesBudgets.find(b => b.status === 'aberta');
    const ganha   = clientesBudgets.find(b => b.status === 'ganha');
    const perdida = clientesBudgets.find(b => b.status === 'perdida');

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

    return `Você é um analista de CRM especialista em PMEs brasileiras.
Analise os dados abaixo de uma base comercial e gere um diagnóstico estruturado em tópicos.
Para cada tópico: interpretação dos dados, análise contextual do porquê está assim, e ações sugeridas quando cabível.
Seja direto, prático e use linguagem de negócios. Não use markdown pesado — apenas texto limpo com títulos de seção.
Não analise Classificação ABC.

BASE COMERCIAL — DIAGNÓSTICO:
- Total de empresas ativas: ${totalAtivo} (${data!.totals.client.active} clientes | ${data!.totals.lead.active} leads | ${data!.totals.prospect.active} prospects)

COBERTURA DE CONTATO:
- Leads: ${cov.lead.pct_covered}% contactados (${cov.lead.with_contact} de ${cov.lead.total}) | ${cov.lead.never_contacted} nunca contactados
- Prospects: ${cov.prospect.pct_covered}% contactados (${cov.prospect.with_contact} de ${cov.prospect.total}) | ${cov.prospect.never_contacted} nunca contactados
- Clientes: ${cov.client.pct_covered}% contactados (${cov.client.with_contact} de ${cov.client.total}) | ${cov.client.never_contacted} nunca contactados

ATIVIDADE RECENTE (clientes):
- Últimos 30 dias: ${data!.activity_buckets.last_30d ?? 0}
- 31–60 dias: ${data!.activity_buckets['31_60d'] ?? 0}
- 61–90 dias: ${data!.activity_buckets['61_90d'] ?? 0}
- Nunca contactados: ${data!.activity_buckets.never ?? 0}

PIPELINE DE ORÇAMENTOS (clientes):
- Em aberto: ${fmt(aberta?.amount ?? 0)} (${aberta?.qty ?? 0} orçamentos)
- Ganhos: ${fmt(ganha?.amount ?? 0)} (${ganha?.qty ?? 0} orçamentos)
- Perdidos: ${fmt(perdida?.amount ?? 0)} (${perdida?.qty ?? 0} orçamentos)

Gere o diagnóstico agora.`;
  }

  async function handleGenerateAi() {
    setAiLoading(true);
    setAiError(null);
    setAiSaved(false);
    try {
      const prompt = buildPrompt();
      const response = await generateGeminiContent({ prompt });
      const cleaned = response.replace(/\*\*(.*?)\*\*/g, '$1');
      setAiText(cleaned);
    } catch {
      setAiError('Erro ao gerar análise. Verifique a chave Gemini.');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSaveAi() {
    if (!aiText || !currentProfileLite?.tenantId || !currentProfileLite?.id) return;
    const { error: saveError } = await supabase.from('ai_notes').insert({
      tenant_id:        currentProfileLite.tenantId,
      owner_profile_id: currentProfileLite.id,
      title:            `Diagnóstico de Base — ${new Date().toLocaleDateString('pt-BR')}`,
      body:             aiText,
      tags:             ['diagnostico-base', 'ia'],
      metadata:         { source: 'base-diagnostics', generated_at: new Date().toISOString() },
    });
    if (!saveError) setAiSaved(true);
  }

  /* ── Seção 4 — formatador de moeda ── */
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  const statusLabel: Record<string, string> = {
    aberta: 'Em aberto',
    ganha: 'Ganhos',
    perdida: 'Perdidos',
    encerrado: 'Encerrados',
  };

  const budgetsClient  = data.budgets.filter(b => b.kind === 'client');
  const budgetsProspLead = data.budgets
    .filter(b => b.kind === 'prospect' || b.kind === 'lead')
    .reduce<Record<string, { qty: number; amount: number }>>((acc, b) => {
      if (!acc[b.status]) acc[b.status] = { qty: 0, amount: 0 };
      acc[b.status].qty    += b.qty;
      acc[b.status].amount += b.amount;
      return acc;
    }, {});

  /* ── Seção 5 — derivados ABC ── */
  const abcClients     = data.abc.filter(r => r.kind === 'client');
  const unclassified   = abcClients.find(r => r.abc_analysis === 'unclassified')?.total ?? 0;
  const totalClients   = data.totals.client.active;
  const pctUnclassified = totalClients > 0 ? ((unclassified / totalClients) * 100).toFixed(1) : '0.0';
  const getAbc = (label: string) => abcClients.find(r => r.abc_analysis === label)?.total ?? 0;

  /* ── Seção 1 — derivados ── */
  const totalActive = KINDS.reduce((sum, k) => sum + data.totals[k].active, 0);
  const clientActive = data.totals.client.active;
  const clientPct = totalActive > 0 ? ((clientActive / totalActive) * 100).toFixed(1) : '0.0';
  const leadActive = data.totals.lead.active;
  const prospectActive = data.totals.prospect.active;

  return (
    <div className="space-y-8 p-1">

      {/* ── Seção 1 — Visão geral da base ativa ── */}
      <div>
        <p style={sectionLabel}>Visão geral da base ativa</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>

          {/* Card 1 — Total ativo */}
          <div className="bg-light-s1 dark:bg-dark-s1 border border-light-bmd dark:border-dark-bmd rounded-xl" style={{ padding: '16px 20px' }}>
            <p className="text-light-t3 dark:text-dark-t3" style={{ fontSize: '12px', marginBottom: '6px' }}>Total ativo</p>
            <p className="text-light-t1 dark:text-dark-t1" style={{ fontSize: '28px', fontWeight: 500, lineHeight: 1, marginBottom: '4px' }}>
              {totalActive.toLocaleString('pt-BR')}
            </p>
            <p className="text-light-t3 dark:text-dark-t3" style={{ fontSize: '12px' }}>empresas cadastradas</p>
          </div>

          {/* Card 2 — Clientes */}
          <div className="bg-light-s1 dark:bg-dark-s1 border border-light-bmd dark:border-dark-bmd rounded-xl" style={{ padding: '16px 20px' }}>
            <p className="text-light-t3 dark:text-dark-t3" style={{ fontSize: '12px', marginBottom: '6px' }}>Clientes</p>
            <p className="text-light-t1 dark:text-dark-t1" style={{ fontSize: '28px', fontWeight: 500, lineHeight: 1, marginBottom: '4px' }}>
              {clientActive.toLocaleString('pt-BR')}
            </p>
            <p className="text-light-t3 dark:text-dark-t3" style={{ fontSize: '12px' }}>{clientPct}% da base</p>
          </div>

          {/* Card 3 — Leads + Prospects */}
          <div className="bg-light-s1 dark:bg-dark-s1 border border-light-bmd dark:border-dark-bmd rounded-xl" style={{ padding: '16px 20px' }}>
            <p className="text-light-t3 dark:text-dark-t3" style={{ fontSize: '12px', marginBottom: '6px' }}>Leads + Prospects</p>
            <p className="text-light-t1 dark:text-dark-t1" style={{ fontSize: '28px', fontWeight: 500, lineHeight: 1, marginBottom: '4px' }}>
              {(leadActive + prospectActive).toLocaleString('pt-BR')}
            </p>
            <p className="text-light-t3 dark:text-dark-t3" style={{ fontSize: '12px' }}>
              {leadActive.toLocaleString('pt-BR')} leads · {prospectActive.toLocaleString('pt-BR')} prospects
            </p>
          </div>

        </div>
      </div>

      {/* ── Seção 2 — Cobertura de contato por tipo ── */}
      <div>
        <p style={sectionLabel}>Cobertura de interações por tipo</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {KINDS.map((kind) => {
            const cov = data.coverage[kind];
            const pct = cov.pct_covered ?? 0;
            return (
              <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Label */}
                <span className="text-light-t2 dark:text-dark-t2" style={{ width: '140px', flexShrink: 0, fontSize: '12px' }}>
                  {capitalize(kind)} <span className="text-light-t3 dark:text-dark-t3">({cov.total.toLocaleString('pt-BR')})</span>
                </span>

                {/* Barra de progresso */}
                <div style={{ flex: 1, height: '6px', borderRadius: '99px', background: 'var(--s3, #e5e7eb)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(pct, 100)}%`,
                    borderRadius: '99px',
                    background: coverageColor(pct),
                    transition: 'width 0.4s ease',
                  }} />
                </div>

                {/* Percentual */}
                <span style={{ width: '40px', textAlign: 'right', fontSize: '12px', fontWeight: 500, color: coverageColor(pct), flexShrink: 0 }}>
                  {pct.toFixed(1)}%
                </span>

                {/* Detalhe */}
                <span className="text-light-t3 dark:text-dark-t3" style={{ fontSize: '11px', flexShrink: 0 }}>
                  {cov.with_contact.toLocaleString('pt-BR')} interações
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <hr className="border-light-blo dark:border-dark-blo" />

      {/* ── Seção 3 — Distribuição de atividade — clientes ── */}
      <div>
        <p className="text-light-t3 dark:text-dark-t3 mb-3" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Distribuição de atividade — clientes
        </p>
        <div>
          {[
            { label: 'Nunca contactados',  variant: 'danger',  value: data.activity_buckets.never ?? 0 },
            { label: 'Últimos 30 dias',    variant: 'success', value: data.activity_buckets.last_30d ?? 0 },
            { label: '31–60 dias',         variant: 'warning', value: data.activity_buckets['31_60d'] ?? 0 },
            { label: '61–90 dias',         variant: 'warning', value: data.activity_buckets['61_90d'] ?? 0 },
            { label: 'Mais de 90 dias',    variant: 'danger',  value: (data.activity_buckets['91_180d'] ?? 0) + (data.activity_buckets.over_180d ?? 0) },
          ].map(({ label, variant, value }, i, arr) => (
            <div key={label} className={`flex justify-between items-center py-2${i < arr.length - 1 ? ' border-b border-light-blo dark:border-dark-blo' : ''}`}>
              <span className="text-light-t2 dark:text-dark-t2" style={{ fontSize: '13px' }}>{label}</span>
              <span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] mr-2 bg-${variant}/10 text-${variant}`}>
                  {variant === 'success' ? 'Ativo' : variant === 'warning' ? 'Risco' : 'Crítico'}
                </span>
                <span className="text-light-t1 dark:text-dark-t1" style={{ fontSize: '14px', fontWeight: 500 }}>
                  {value.toLocaleString('pt-BR')}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <hr className="border-light-blo dark:border-dark-blo" />

      {/* ── Seção 4 — Pipeline de orçamentos ── */}
      <div>
        <p className="text-light-t3 dark:text-dark-t3 mb-3" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Pipeline de orçamentos
        </p>
        <div className="grid grid-cols-2 gap-6">
          {/* Coluna esquerda — Clientes */}
          <div>
            <p className="text-light-t3 dark:text-dark-t3 mb-3" style={{ fontSize: '12px' }}>Clientes</p>
            {budgetsClient.map(b => (
              <div key={b.status} className="flex justify-between items-center py-1.5">
                <span className="text-light-t2 dark:text-dark-t2" style={{ fontSize: '13px' }}>
                  {statusLabel[b.status] ?? b.status}
                </span>
                <span className="text-light-t1 dark:text-dark-t1" style={{ fontSize: '14px', fontWeight: 500 }}>
                  {brl.format(b.amount)} ({b.qty})
                </span>
              </div>
            ))}
          </div>

          {/* Coluna direita — Prospects & Leads */}
          <div>
            <p className="text-light-t3 dark:text-dark-t3 mb-3" style={{ fontSize: '12px' }}>Prospects &amp; Leads</p>
            {Object.entries(budgetsProspLead).map(([status, agg]) => (
              <div key={status} className="flex justify-between items-center py-1.5">
                <span className="text-light-t2 dark:text-dark-t2" style={{ fontSize: '13px' }}>
                  {statusLabel[status] ?? status}
                </span>
                <span className="text-light-t1 dark:text-dark-t1" style={{ fontSize: '14px', fontWeight: 500 }}>
                  {brl.format(agg.amount)} ({agg.qty})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <hr className="border-light-blo dark:border-dark-blo" />

      {/* ── Seção 5 — Classificação ABC ── */}
      <div>
        <p className="text-light-t3 dark:text-dark-t3 mb-3" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Classificação ABC — cobertura atual
        </p>
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-4">
          <p className="text-warning" style={{ fontSize: '13px', fontWeight: 500 }}>
            {unclassified.toLocaleString('pt-BR')} clientes sem classificação ABC ({pctUnclassified}%)
          </p>
          <p className="text-warning/70 mt-1" style={{ fontSize: '12px' }}>
            Classificados: A={getAbc('A')} · B={getAbc('B')} · C={getAbc('C')} · D={getAbc('D')} · X={getAbc('X')}
          </p>
        </div>
        <div className="grid grid-cols-5 gap-2 mt-2">
          {(['A', 'B', 'C', 'D', 'X'] as const).map(label => (
            <div key={label} className="bg-light-s1 dark:bg-dark-s1 border border-light-bmd dark:border-dark-bmd rounded-lg p-3 text-center">
              <p className="text-light-t3 dark:text-dark-t3 mb-1" style={{ fontSize: '12px', fontWeight: 500 }}>{label}</p>
              <p className="text-light-t1 dark:text-dark-t1" style={{ fontSize: '20px', fontWeight: 500 }}>{getAbc(label).toLocaleString('pt-BR')}</p>
            </div>
          ))}
        </div>
      </div>

      <hr className="border-light-blo dark:border-dark-blo" />

      {/* ── Seção 6 — Análise de IA ── */}
      <section>
        <p className="text-light-t3 dark:text-dark-t3 mb-3" style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Análise de IA
        </p>

        {/* Botão Gerar Análise */}
        {!aiText && !aiLoading && (
          <div className="border-2 border-dashed border-light-bmd dark:border-dark-bmd rounded-xl p-10 flex flex-col items-center justify-center gap-3">
            <Sparkles size={24} className="text-accent-light dark:text-accent-dark" />
            <span className="text-light-t1 dark:text-dark-t1" style={{ fontSize: '14px', fontWeight: 500 }}>Análise de IA</span>
            <span className="text-light-t3 dark:text-dark-t3 text-center" style={{ fontSize: '12px' }}>
              Interpretação contextual dos dados por grupo com ações sugeridas
            </span>
            <button
              onClick={handleGenerateAi}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium bg-accent-light dark:bg-accent-dark text-white"
            >
              <Sparkles size={14} />
              Gerar análise
            </button>
            {aiError && <span className="text-[12px] mt-1" style={{ color: '#f06060' }}>{aiError}</span>}
          </div>
        )}

        {/* Loading */}
        {aiLoading && (
          <div className="flex items-center gap-3 p-6 text-light-t2 dark:text-dark-t2 text-[13px]">
            <AiLoader size={16} className="animate-spin" />
            Gerando análise com Gemini...
          </div>
        )}

        {/* Resultado */}
        {aiText && !aiLoading && (
          <div className="bg-light-s1 dark:bg-dark-s1 border border-light-bmd dark:border-dark-bmd rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[13px] font-medium text-light-t1 dark:text-dark-t1 flex items-center gap-2">
                <Sparkles size={14} className="text-accent-light dark:text-accent-dark" />
                Análise gerada por IA
              </span>
              <div className="flex items-center gap-2">
                {aiSaved ? (
                  <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: '#3ecf8e' }}>
                    <CheckCircle size={13} /> Salvo em AI Notes
                  </span>
                ) : (
                  <button
                    onClick={handleSaveAi}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] border border-light-bmd dark:border-dark-bmd text-light-t2 dark:text-dark-t2 hover:bg-light-s2 dark:hover:bg-dark-s2"
                  >
                    <Save size={13} />
                    Salvar em AI Notes
                  </button>
                )}
                <button
                  onClick={handleGenerateAi}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] border border-light-bmd dark:border-dark-bmd text-light-t2 dark:text-dark-t2 hover:bg-light-s2 dark:hover:bg-dark-s2"
                >
                  <Sparkles size={13} />
                  Regerar
                </button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-[13px] text-light-t2 dark:text-dark-t2 leading-relaxed font-sans">
              {aiText}
            </pre>
          </div>
        )}
      </section>

    </div>
  );
}

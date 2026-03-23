/*
-- ===================================================
-- Código             : /src/components/agendaX/CompanyDayBlock.tsx
-- Versão (.v20)      : 1.3.0
-- Data/Hora          : 2025-11-07 10:26 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Exibir blocos de empresas com fallback visual e limite de dados (lazy display).
-- Fluxo              : DayContextPanel → CompanyDayBlock
-- Alterações (1.3.0) :
--   • [UX] Badges vivas (verde/azul/roxo) para prioridade; remoção de âmbar.
--   • [UX] Formatação monetária pt-BR (milhar) para deals.amount (ex.: 8.975,77 BRL).
--   • [UX] Microajustes de contraste mantendo estilo neumórfico.
-- Dependências        : react, lucide-react
-- Restrições          : Escopo limitado a AgendaX; nenhuma outra rotina alterada.
-- ===================================================
*/

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CompanyDayBlockProps {
  snapshot: {
    id: string;
    trade_name: string;
    contacts: any[];
    chats: any[];
    deals: any[];
  };
}

/* ------------------------- Helpers ------------------------- */

const fmtMoney = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function normalizeTag(s: string) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

const VividTag = ({ children }: { children: React.ReactNode }) => {
  const raw = String(children ?? '').trim();
  const norm = normalizeTag(raw);

  // Paleta viva (sem âmbar):
  //  - "concluido" -> verde
  //  - "media"     -> azul
  //  - "orcamento" -> roxo
  //  - fallback    -> azul
  let cls =
    'text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';

  if (norm.includes('concluido')) {
    cls =
      'text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  } else if (norm.includes('orcamento')) {
    cls =
      'text-[11px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
  }
  // 'media' permanece azul (default)

  return <span className={`${cls} ml-1`}>{raw}</span>;
};

const getTempIcon = (temp?: string) => {
  if (!temp) return '🌡️';
  const t = temp.toLowerCase();
  if (t.includes('fria')) return '❄️';
  if (t.includes('morna')) return '🌤️';
  if (t.includes('quente')) return '🔥';
  return '🌡️';
};

/* ----------------------- Componente ------------------------ */

const CompanyDayBlock = ({ snapshot }: CompanyDayBlockProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-plate dark:bg-dark-s1 mb-4 p-4 rounded-2xl neumorphic-convex transition-all duration-200">
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <h4 className="font-semibold text-primary">{snapshot.trade_name}</h4>
          <p className="text-sm text-gray-500">
            {snapshot.contacts.length} contato(s) • {snapshot.chats.length} ação(ões) •{' '}
            {snapshot.deals.length} negócio(s)
          </p>
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </div>

      {expanded && (
        <div className="mt-3 border-t border-gray-300 dark:border-white/10 pt-3 space-y-3">
          {/* Contatos (até 2) */}
          {snapshot.contacts.slice(0, 2).map((ct) => (
            <p key={ct.id} className="text-sm">
              📇 <strong>{ct.full_name}</strong> {ct.phone ? `— ${ct.phone}` : ''}
            </p>
          ))}

          {/* Chats (até 3) com badges vivas */}
          {snapshot.chats.slice(0, 3).map((ch) => (
            <div key={ch.id} className="text-sm text-gray-700 dark:text-dark-t1">
              💬 {getTempIcon(ch.temperature)} <strong>{ch.subject}</strong>
              {ch.priority && <VividTag>{ch.priority}</VividTag>}
              {ch.kind && <VividTag>{ch.kind}</VividTag>}
              {ch.is_done && <VividTag>concluído</VividTag>}
            </div>
          ))}

          {/* Negócios (até 2) com valores pt-BR */}
          {snapshot.deals.slice(0, 2).map((d) => {
            const amount =
              typeof d?.amount === 'number'
                ? fmtMoney.format(d.amount)
                : d?.amount ?? '-';
            return (
              <div key={d.id} className="text-sm text-purple-700 dark:text-purple-300">
                💼 <strong>{d.name || 'Negócio sem nome'}</strong>
                {` — ${amount} ${d?.currency ?? ''}`}
                {d?.status ? <VividTag>{d.status}</VividTag> : null}
                {d?.pipeline_stage ? <VividTag>{d.pipeline_stage}</VividTag> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CompanyDayBlock;

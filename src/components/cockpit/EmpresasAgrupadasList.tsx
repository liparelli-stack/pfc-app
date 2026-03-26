/*
-- ===================================================
-- Código             : /src/components/cockpit/EmpresasAgrupadasList.tsx
-- Versão             : 1.0.0
-- Data/Hora          : 2026-03-26 America/Sao_Paulo
-- Objetivo           : Lista de empresas com ações ativas agrupada alfabeticamente.
--                      Substitui a flat list do CockpitPage com agrupamento por letra,
--                      collapse/expand por grupo e scroll interno.
-- Dependências       : @/types/cockpit, @/utils/textNormalization, clsx, lucide-react
-- ===================================================
*/

import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import type { CompanyWithActionCount } from '@/types/cockpit';
import { normalizeText } from '@/utils/textNormalization';

function formatCurrencyK(value: number): string {
  return `R$ ${(value / 1000).toFixed(1).replace('.', ',')}k`;
}

interface Props {
  empresas: CompanyWithActionCount[];
  selectedCompanyId: string | null;
  onSelect: (id: string) => void;
  onHover?: (id: string) => void;
}

const EmpresasAgrupadasList: React.FC<Props> = ({
  empresas,
  selectedCompanyId,
  onSelect,
  onHover,
}) => {
  const grupos = useMemo(() => {
    const map: Record<string, CompanyWithActionCount[]> = {};
    for (const emp of empresas) {
      const letra = normalizeText(emp.trade_name)[0]?.toUpperCase() ?? '#';
      if (!map[letra]) map[letra] = [];
      map[letra].push(emp);
    }
    for (const letra of Object.keys(map)) {
      map[letra].sort((a, b) =>
        normalizeText(a.trade_name).localeCompare(normalizeText(b.trade_name))
      );
    }
    return map;
  }, [empresas]);

  const letras = useMemo(() => Object.keys(grupos).sort(), [grupos]);

  // Inicializa com todos os grupos abertos (empresas já carregadas pelo pai antes do mount)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const letters = new Set<string>();
    for (const emp of empresas) {
      const letra = normalizeText(emp.trade_name)[0]?.toUpperCase() ?? '#';
      letters.add(letra);
    }
    return letters;
  });

  // Auto-expande grupos que aparecem após recarregamentos (nova empresa em nova letra)
  useEffect(() => {
    setExpandedGroups((prev) => {
      const novos = letras.filter((l) => !prev.has(l));
      if (novos.length === 0) return prev;
      return new Set([...prev, ...novos]);
    });
  }, [letras]);

  // Auto-expande o grupo da empresa selecionada quando muda externamente
  useEffect(() => {
    if (!selectedCompanyId) return;
    for (const [letra, emps] of Object.entries(grupos)) {
      if (emps.some((e) => e.id === selectedCompanyId)) {
        setExpandedGroups((prev) => {
          if (prev.has(letra)) return prev;
          return new Set([...prev, letra]);
        });
        break;
      }
    }
  }, [selectedCompanyId, grupos]);

  const toggleGroup = (letra: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(letra)) next.delete(letra);
      else next.add(letra);
      return next;
    });
  };

  if (empresas.length === 0) {
    return (
      <p className="text-center text-light-t3 dark:text-dark-t3 text-sm p-4">
        Nenhuma empresa com ações ativas.
      </p>
    );
  }

  return (
    <div
      className="overflow-y-auto"
      style={{ maxHeight: 'calc(100vh - 320px)', minHeight: '400px' }}
    >
      {letras.map((letra) => {
        const isOpen = expandedGroups.has(letra);
        const emps = grupos[letra];

        return (
          <div key={letra}>
            {/* Cabeçalho do grupo */}
            <button
              type="button"
              onClick={() => toggleGroup(letra)}
              className={clsx(
                'w-full flex items-center gap-2 text-left',
                'px-3.5 py-1.5',
                'border-b border-light-blo dark:border-dark-blo',
                'hover:bg-light-s2 dark:hover:bg-dark-s2',
                'transition-colors duration-200'
              )}
            >
              <ChevronDown
                className={clsx(
                  'h-3.5 w-3.5 flex-shrink-0 text-light-t3 dark:text-dark-t3',
                  'transition-transform duration-200',
                  !isOpen && '-rotate-90'
                )}
              />
              <span className="text-body font-medium text-light-t1 dark:text-dark-t1">
                {letra}
              </span>
              <span className="text-label text-light-t3 dark:text-dark-t3">
                ({emps.length} {emps.length === 1 ? 'empresa' : 'empresas'})
              </span>
            </button>

            {/* Itens do grupo */}
            {isOpen && (
              <ul>
                {emps.map((emp) => {
                  const isActive = selectedCompanyId === emp.id;
                  return (
                    <li key={emp.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(emp.id)}
                        onMouseEnter={() => onHover?.(emp.id)}
                        className={clsx(
                          'w-full flex items-center gap-2 text-left',
                          'pl-[38px] pr-3 py-[7px]',
                          'border-b border-light-blo dark:border-dark-blo',
                          'transition-colors duration-150',
                          isActive
                            ? 'bg-light-s2 dark:bg-dark-s3 text-accent'
                            : 'text-light-t1 dark:text-dark-t1 hover:bg-light-blo dark:hover:bg-dark-blo'
                        )}
                      >
                        <span
                          className="text-caption font-normal truncate flex-1 min-w-0"
                          title={emp.trade_name}
                        >
                          {emp.trade_name}
                        </span>
                        <span className="text-micro font-mono text-light-t2 dark:text-dark-t2 flex-shrink-0 tabular-nums whitespace-nowrap hidden sm:inline">
                          {emp.action_count} {emp.action_count === 1 ? 'ação' : 'ações'}
                        </span>
                        {/* Valor com tooltip de breakdown por status */}
                        <div className="relative group hidden sm:inline-block flex-shrink-0">
                          <span className="cursor-help text-micro font-mono font-medium text-accent tabular-nums tracking-tight-md whitespace-nowrap">
                            {formatCurrencyK(emp.valor_total_orcamentos)}
                          </span>
                          <div className={clsx(
                            'pointer-events-none absolute top-full right-0 mt-2 z-20',
                            'hidden group-hover:block',
                            'rounded-lg border border-light-bmd dark:border-dark-bmd',
                            'bg-light-s2 dark:bg-dark-s2 shadow-sh2',
                            'px-3 py-2 min-w-[152px]'
                          )}>
                            <div className="flex items-center justify-between gap-3 mb-0.5">
                              <span className="text-label text-light-t3 dark:text-dark-t3 whitespace-nowrap">Em Aberto</span>
                              <span className="text-label font-mono text-light-t1 dark:text-dark-t1 tabular-nums">{formatCurrencyK(emp.valor_abertos)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 mb-0.5">
                              <span className="text-label text-light-t3 dark:text-dark-t3 whitespace-nowrap">Ganhos</span>
                              <span className="text-label font-mono text-success tabular-nums">{formatCurrencyK(emp.valor_ganhos)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-label text-light-t3 dark:text-dark-t3 whitespace-nowrap">Perdidos</span>
                              <span className="text-label font-mono text-danger tabular-nums">{formatCurrencyK(emp.valor_perdidos)}</span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight
                          className={clsx(
                            'h-3 w-3 flex-shrink-0',
                            isActive
                              ? 'text-accent'
                              : 'text-light-t3 dark:text-dark-t3'
                          )}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default EmpresasAgrupadasList;

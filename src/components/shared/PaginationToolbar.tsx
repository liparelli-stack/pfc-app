/*
-- ===================================================
-- Código             : /src/components/shared/PaginationToolbar.tsx
-- Versão (.v20)      : 1.1.0
-- Data/Hora          : 2025-12-04 18:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Tornar o rótulo do tipo de item dinâmico (ex: "empresas", "contatos").
-- Alterações (1.1.0) :
--  • [FEAT] Adicionada a prop `itemTypeLabel` para customizar o texto de contagem.
-- Dependências          : react, clsx, lucide-react
-- ===================================================
*/

import React from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type PaginationToolbarProps = {
  page: number;
  pageSize: 15 | 30 | 60;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: 15 | 30 | 60) => void;
  className?: string;
  itemTypeLabel?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

const PaginationToolbar: React.FC<PaginationToolbarProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  className,
  itemTypeLabel = "itens",
}) => {
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));
  const current = clamp(page || 1, 1, totalPages);
  const start = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const end = total === 0 ? 0 : Math.min(current * pageSize, total);

  const changePage = (next: number) => {
    const p = clamp(next, 1, totalPages);
    if (p !== current) onPageChange(p);
  };

  return (
    <div
      className={clsx(
        "mt-4 mb-2 flex flex-wrap items-center justify-between gap-3",
        "text-sm",
        className
      )}
      aria-label="Barra de paginação"
    >
      {/* Label "Mostrando X–Y de Z" */}
      <div className="text-gray-600 dark:text-dark-t1">
        Mostrando <strong>{start}</strong>–<strong>{end}</strong> de{" "}
        <strong>{total}</strong> {itemTypeLabel}
      </div>

      {/* Controles */}
      <div className="flex items-center gap-3">
        {/* Page size */}
        <label className="inline-flex items-center gap-2">
          <span className="text-gray-600 dark:text-dark-t1">Por página</span>
          <select
            className={clsx(
              "rounded-lg border border-dark-shadow/30 dark:border-dark-dark-shadow/30",
              "bg-plate dark:bg-dark-s1 px-2 py-1",
              "focus:outline-none focus:ring-2 focus:ring-primary/30"
            )}
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as 15 | 30 | 60)}
            aria-label="Itens por página"
          >
            <option value={15}>15</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </label>

        {/* Navegação */}
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            className={clsx(
              "inline-flex items-center justify-center h-8 w-8 rounded-full",
              "border border-dark-shadow/30 dark:border-dark-dark-shadow/30",
              "bg-plate dark:bg-dark-s1 hover:opacity-90 disabled:opacity-50"
            )}
            onClick={() => changePage(current - 1)}
            disabled={current <= 1}
            aria-label="Página anterior"
            title="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="px-2 tabular-nums text-gray-700 dark:text-dark-t1" aria-live="polite">
            {current} / {totalPages}
          </span>

          <button
            type="button"
            className={clsx(
              "inline-flex items-center justify-center h-8 w-8 rounded-full",
              "border border-dark-shadow/30 dark:border-dark-dark-shadow/30",
              "bg-plate dark:bg-dark-s1 hover:opacity-90 disabled:opacity-50"
            )}
            onClick={() => changePage(current + 1)}
            disabled={current >= totalPages}
            aria-label="Próxima página"
            title="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaginationToolbar;

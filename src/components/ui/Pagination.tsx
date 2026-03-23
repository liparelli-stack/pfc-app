/*
-- ===================================================
-- Código: /src/components/ui/Pagination.tsx
-- Versão: 1.0.0
-- Data/Hora: 2025-10-23 15:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Componente de UI reutilizável para paginação.
-- Fluxo: Usado por CompanyList.tsx para navegar entre as páginas de empresas.
-- Dependências: react, lucide-react, clsx
-- ===================================================
*/
import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import clsx from 'clsx';

interface PaginationProps {
  currentPage: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalCount, pageSize, onPageChange }) => {
  const totalPages = Math.ceil(totalCount / pageSize);

  if (totalPages <= 1) {
    return null;
  }

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };
  
  const pageNumbers = [];
  const maxPagesToShow = 5;
  let startPage, endPage;

  if (totalPages <= maxPagesToShow) {
    startPage = 1;
    endPage = totalPages;
  } else {
    if (currentPage <= Math.ceil(maxPagesToShow / 2)) {
      startPage = 1;
      endPage = maxPagesToShow;
    } else if (currentPage + Math.floor(maxPagesToShow / 2) >= totalPages) {
      startPage = totalPages - maxPagesToShow + 1;
      endPage = totalPages;
    } else {
      startPage = currentPage - Math.floor(maxPagesToShow / 2);
      endPage = currentPage + Math.floor(maxPagesToShow / 2);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  const buttonClass = "p-2 rounded-lg neumorphic-convex hover:neumorphic-concave disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-sm text-gray-600 dark:text-dark-t2">
        Total de {totalCount} registros
      </span>
      <div className="flex items-center gap-2">
        <button onClick={() => handlePageChange(1)} disabled={currentPage === 1} className={buttonClass}>
          <ChevronsLeft className="h-5 w-5" />
        </button>
        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className={buttonClass}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        
        {pageNumbers.map(number => (
          <button
            key={number}
            onClick={() => handlePageChange(number)}
            className={clsx(
              "px-4 py-2 rounded-lg",
              currentPage === number 
                ? "neumorphic-concave text-primary font-bold" 
                : "neumorphic-convex hover:neumorphic-concave"
            )}
          >
            {number}
          </button>
        ))}

        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className={buttonClass}>
          <ChevronRight className="h-5 w-5" />
        </button>
        <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} className={buttonClass}>
          <ChevronsRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;

/*
-- ===================================================
-- Código             : /src/components/lists/NotasPorEmpresa.tsx
-- Versão (.v20)      : 1.0.1
-- Data/Hora          : 2025-12-18 00:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Componente para listar notas agrupadas por empresa, com filtros.
-- Fluxo              : ListsPage -> NotasPorEmpresa -> useNotesByCompany
-- Alterações (1.0.1) :
--  • [FIX] Filtro por empresa e busca em notas agora são acento/ç/case-insensitive
--          (normalização via NFD + remoção de diacríticos).
--  • [HARD] Tratamento defensivo para campos nulos/indefinidos nas comparações.
-- Dependências       : react, @/hooks/useNotesByCompany, @/components/ui/*
-- ===================================================
*/
import React, { useState, useMemo } from 'react';
import { useNotesByCompany } from '@/hooks/useNotesByCompany';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Data desconhecida';
  try {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
};

/**
 * Normaliza texto para filtro acento/ç/case-insensitive:
 * - trim
 * - lower
 * - remove diacríticos (ex.: "São" -> "sao", "ação" -> "acao", "ç" -> "c")
 */
const normalize = (value: unknown): string => {
  const s = String(value ?? '').trim().toLowerCase();
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

const NotasPorEmpresa: React.FC = () => {
  const { companies, loading, error } = useNotesByCompany();
  const [companyFilter, setCompanyFilter] = useState('');
  const [noteFilter, setNoteFilter] = useState('');

  const filteredCompanies = useMemo(() => {
    if (!companies) return [];

    const companyNeedle = normalize(companyFilter);
    const noteNeedle = normalize(noteFilter);

    const companiesByName = companyNeedle
      ? companies.filter((c) => normalize(c.trade_name).includes(companyNeedle))
      : companies;

    const result = companiesByName
      .map((company) => {
        const notesArr = Array.isArray(company.notes) ? company.notes : [];
        const filteredNotes = noteNeedle
          ? notesArr.filter((note: any) => normalize(note?.nota).includes(noteNeedle))
          : notesArr;

        return { ...company, notes: filteredNotes };
      })
      .filter((company) => Array.isArray(company.notes) && company.notes.length > 0);

    return result;
  }, [companies, companyFilter, noteFilter]);

  return (
    <div className="space-y-6">
      <section className="neumorphic-convex rounded-2xl p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Filtrar por empresa..."
            placeholder="Nome da empresa"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
          />
          <Input
            label="Buscar em notas..."
            placeholder="Conteúdo da nota"
            value={noteFilter}
            onChange={(e) => setNoteFilter(e.target.value)}
          />
        </div>
      </section>

      {loading ? (
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="neumorphic-convex rounded-2xl p-6 space-y-4">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center text-red-500 py-8">{error}</div>
      ) : filteredCompanies.length === 0 ? (
        <div className="text-center text-gray-500 py-16 neumorphic-convex rounded-2xl">
          <p>
            {companyFilter || noteFilter
              ? 'Nenhum resultado encontrado para os filtros aplicados.'
              : 'Nenhuma nota cadastrada.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredCompanies.map((company: any) => (
            <div
              key={company.id}
              className="bg-white dark:bg-zinc-900/50 shadow-md rounded-lg p-6"
            >
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
                {company.trade_name}
              </h3>
              <div className="space-y-4">
                {(company.notes ?? []).map((note: any, index: number) => (
                  <div
                    key={`${company.id}-${index}`}
                    className="border-t border-gray-200 dark:border-gray-700 pt-4"
                  >
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {note?.nota}
                    </p>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex justify-between">
                      <span>{note?.assunto || 'Geral'}</span>
                      <span>{formatDate(note?.data)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotasPorEmpresa;

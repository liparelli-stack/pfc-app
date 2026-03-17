/*
-- ===================================================
-- Código             : /src/components/knowledge/AiNotesPanel.tsx
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-12-18 19:35 America/Sao_Paulo
-- Autor              : FL / Execução via E.V.A.
-- Objetivo do codigo : Orquestrador do painel "Notas da IA"
--                      (layout + coordenação Lista ↔ Viewer).
-- Fluxo              : KnowledgePage
--                      -> AiNotesPanel
--                      -> AiNotesListPanel / AiNoteViewerPanel
-- Observações:
--   • Não acessa Supabase diretamente
--   • Estado mínimo: nota selecionada (id)
--   • Dois painéis internos (lista + visualizador)
-- ===================================================
*/

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

import { useAiNotes } from '@/hooks/useAiNotes';
import AiNotesListPanel from '@/components/knowledge/AiNotesListPanel';
import AiNoteViewerPanel from '@/components/knowledge/AiNoteViewerPanel';

const AiNotesPanel: React.FC = () => {
  const {
    notes,
    selectedNote,
    loading,
    error,
    searchTerm,
    setSearchTerm,
    selectNote,
    updateNote,
    deleteNote,
    refresh,
  } = useAiNotes({ pageSize: 30 });

  // Mantém seleção simples (id já resolvido pelo hook)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const handleSelect = async (noteId: string) => {
    setSelectedNoteId(noteId);
    await selectNote(noteId);
  };

  return (
    <div className="bg-plate dark:bg-plate-dark rounded-2xl p-6 neumorphic-convex h-full">
      {/* Header do painel */}
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50">
            <Sparkles className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Notas da IA</h2>
            <p className="text-sm text-slate-500">
              Memória pessoal das análises geradas pela IA.
            </p>
          </div>
        </div>

        {/* Ação global simples (refresh) */}
        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full neumorphic-convex hover:neumorphic-concave text-sm disabled:opacity-60"
        >
          Atualizar
        </button>
      </header>

      {/* Estados globais */}
      {error && (
        <div className="mb-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Conteúdo principal: dois painéis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100%-96px)]">
        {/* Lista (sem finder) */}
        <div className="md:col-span-1 h-full">
          <AiNotesListPanel
            notes={notes}
            loading={loading}
            selectedNoteId={selectedNoteId}
            onSelect={handleSelect}
            onDelete={deleteNote}
          />
        </div>

        {/* Viewer + Finder */}
        <div className="md:col-span-2 h-full">
          <AiNoteViewerPanel
            note={selectedNote}
            loading={loading}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onUpdate={updateNote}
          />
        </div>
      </div>
    </div>
  );
};

export default AiNotesPanel;

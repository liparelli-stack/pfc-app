/*
-- ===================================================
-- Código             : /src/components/knowledge/AiNotesListPanel.tsx
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2025-12-18 20:05 America/Sao_Paulo
-- Autor              : FL / Execução via E.V.A.
-- Objetivo do codigo : Lista lateral de Notas da IA
--                      (seleção + exclusão).
-- Fluxo              : AiNotesPanel
--                      -> AiNotesListPanel
-- Observações:
--   • Não possui finder (fica no Viewer)
--   • Lista simples, scroll interno
--   • Confirmação para delete (soft delete)
-- ===================================================
*/

import React, { useState } from 'react';
import { Trash2, FileText } from 'lucide-react';
import clsx from 'clsx';
import type { AiNote } from '@/services/aiNotesService';

interface Props {
  notes: AiNote[];
  loading: boolean;
  selectedNoteId: string | null;
  onSelect: (noteId: string) => void;
  onDelete: (noteId: string) => Promise<boolean>;
}

const AiNotesListPanel: React.FC<Props> = ({
  notes,
  loading,
  selectedNoteId,
  onSelect,
  onDelete,
}) => {
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirmed = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    await onDelete(deleteTargetId);
    setDeleteTargetId(null);
    setIsDeleting(false);
  };

  return (
    <div className="bg-white/70 dark:bg-slate-900/60 rounded-2xl shadow-inner h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-black/5 dark:border-white/10">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Suas notas
        </h3>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-500">
            Carregando notas...
          </div>
        ) : notes.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-400">
            Nenhuma nota encontrada.
          </div>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {notes.map((note) => (
              <li
                key={note.id}
                className={clsx(
                  'flex items-center justify-between gap-2 px-4 py-3 cursor-pointer transition-colors',
                  selectedNoteId === note.id
                    ? 'bg-sky-50 dark:bg-sky-900/30'
                    : 'hover:bg-black/5 dark:hover:bg-white/5'
                )}
                onClick={() => onSelect(note.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
                  <span className="text-sm font-medium truncate">
                    {note.title}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTargetId(note.id);
                  }}
                  className="text-slate-400 hover:text-red-600"
                  title="Excluir nota"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal de confirmação */}
      {deleteTargetId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
          <div className="bg-plate dark:bg-dark-s1 rounded-2xl p-6 max-w-sm w-full neumorphic-convex">
            <h4 className="text-lg font-bold mb-3">
              Excluir nota
            </h4>

            <p className="text-sm text-slate-600 dark:text-slate-300">
              Deseja realmente excluir esta nota da IA?
              <br />
              Esta ação pode ser desfeita apenas recriando a nota.
            </p>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setDeleteTargetId(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-full neumorphic-convex text-sm disabled:opacity-60"
              >
                Cancelar
              </button>

              <button
                onClick={handleDeleteConfirmed}
                disabled={isDeleting}
                className="px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 text-sm disabled:opacity-60"
              >
                {isDeleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiNotesListPanel;

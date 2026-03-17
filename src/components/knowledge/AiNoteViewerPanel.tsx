/*
-- ===================================================
-- Código             : /src/components/knowledge/AiNoteViewerPanel.tsx
-- Versão (.v20)      : 1.1.0
-- Data/Hora          : 2025-12-18 23:15 America/Sao_Paulo
-- Autor              : FL / Execução via E.V.A.
-- Objetivo do codigo : Visualizador / editor de Nota da IA
--                      com auto-save silencioso (debounce).
-- Alterações (1.1.0):
--   • Removido botão "Salvar"
--   • Auto-save somente quando há alteração
--   • Status visual discreto de salvamento
-- ===================================================
*/

import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { AiNote } from '@/services/aiNotesService';

interface Props {
  note: AiNote | null;
  loading: boolean;

  // Finder
  searchTerm: string;
  onSearchChange: (v: string) => void;

  // Update
  onUpdate: (
    noteId: string,
    updates: Partial<Pick<AiNote, 'title' | 'body' | 'tags' | 'metadata'>>
  ) => Promise<boolean>;
}

const AUTO_SAVE_DELAY = 900; // ms

const AiNoteViewerPanel: React.FC<Props> = ({
  note,
  loading,
  searchTerm,
  onSearchChange,
  onUpdate,
}) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastPersistedRef = useRef<{ title: string; body: string } | null>(null);

  // Sync quando muda a nota selecionada
  useEffect(() => {
    setTitle(note?.title ?? '');
    setBody(note?.body ?? '');
    setLastSavedAt(note?.updated_at ?? null);

    lastPersistedRef.current = note
      ? { title: note.title, body: note.body }
      : null;
  }, [note?.id]);

  // Auto-save com debounce
  useEffect(() => {
    if (!note) return;

    const last = lastPersistedRef.current;
    if (!last) return;

    const hasChanges = title !== last.title || body !== last.body;
    if (!hasChanges) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setIsSaving(true);

      const success = await onUpdate(note.id, { title, body });

      if (success) {
        lastPersistedRef.current = { title, body };
        setLastSavedAt(new Date().toISOString());
      }

      setIsSaving(false);
    }, AUTO_SAVE_DELAY);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [title, body, note, onUpdate]);

  // Header padronizado
  const meta = note?.metadata ?? {};
  const companyName = meta.company?.trade_name;
  const origin = meta.origin;
  const generatedAt = meta.generated_at;
  const period = meta.period;

  return (
    <div className="bg-white/70 dark:bg-slate-900/60 rounded-2xl shadow-inner h-full flex flex-col">
      {/* Finder */}
      <div className="px-4 py-3 border-b border-black/5 dark:border-white/10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar nas notas da IA..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm"
          />
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="text-sm text-slate-500">Carregando nota...</p>
        ) : !note ? (
          <p className="text-sm text-slate-400">
            Selecione uma nota para visualizar.
          </p>
        ) : (
          <>
            {/* Header informativo */}
            <div className="mb-4 text-xs text-slate-500 space-y-1">
              {companyName && (
                <div>
                  <strong>Empresa:</strong> {companyName}
                </div>
              )}
              {origin && (
                <div>
                  <strong>Origem:</strong> {origin}
                </div>
              )}
              {generatedAt && (
                <div>
                  <strong>Gerada em:</strong>{' '}
                  {new Date(generatedAt).toLocaleString()}
                </div>
              )}
              {period?.start_date && period?.end_date && (
                <div>
                  <strong>Período:</strong>{' '}
                  {period.start_date} → {period.end_date}
                </div>
              )}
            </div>

            {/* Título */}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full mb-3 text-lg font-bold border-b bg-transparent focus:outline-none"
              placeholder="Título da nota"
            />

            {/* Corpo */}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full min-h-[240px] text-sm leading-relaxed border rounded-lg p-3 focus:outline-none"
              placeholder="Conteúdo da nota da IA..."
            />
          </>
        )}
      </div>

      {/* Rodapé informativo */}
      {note && (
        <div className="px-4 py-2 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-xs text-slate-400">
          <div>
            {isSaving
              ? 'Salvando…'
              : lastSavedAt
              ? `Salvo automaticamente • ${new Date(lastSavedAt).toLocaleTimeString()}`
              : ''}
          </div>

          <div>
            Última atualização:{' '}
            {new Date(note.updated_at).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default AiNoteViewerPanel;

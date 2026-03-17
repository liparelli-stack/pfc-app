/*
-- ===================================================
-- Código             : /src/components/vision360/NotesSection.tsx
-- Versão (.v21)      : 1.0.0
-- Data/Hora          : 2025-11-05 16:45 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Seção reutilizável de "Notas (histórico)" para Visão 360,
--                      reaproveitando o CRUD (RPCs) existente em companiesService.
-- Fluxo              : Vision360 -> NotesSection → companiesService (RPCs) → DB (companies.notes JSONB)
-- Alterações (1.0.0) :
--   • Componente isolado com Add/Edit/Delete, sugestões de assunto e ordenação por data desc.
--   • Props: companyId, notes?, onNotesChange?.
--   • Reuso de NOTE_SUBJECTS/SUBJECT_PRECEDENCE/classifySubjects.
-- Dependências        : react, ToastContext, Modal, Button, Select, Switch, lucide-react,
--                       @/services/companiesService, @/config/noteSubjects, @/types/company
-- ===================================================
*/
import React, { useMemo, useState } from 'react';
import { PlusCircle, Edit3, Trash2 } from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import type { CompanyNote } from '@/types/company';
import { appendCompanyNote, updateCompanyNoteAt, deleteCompanyNoteAt } from '@/services/companiesService';
import { NOTE_SUBJECTS, SUBJECT_PRECEDENCE, classifySubjects } from '@/config/noteSubjects';

type Props = {
  companyId: string;
  notes?: CompanyNote[];
  onNotesChange?: (updated: CompanyNote[]) => void;
};

const fmtDateTimeBR = (iso?: string) => {
  try {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR');
  } catch {
    return iso || '—';
  }
};

const NotesSection: React.FC<Props> = ({ companyId, notes = [], onNotesChange }) => {
  const { addToast } = useToast();

  // Add Modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');

  // Edit Modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [editNoteAssunto, setEditNoteAssunto] = useState('Geral');
  const [editRecompute, setEditRecompute] = useState(true);

  const subjectOptions = useMemo(() => {
    const precedenceSet = new Set(SUBJECT_PRECEDENCE);
    const unique = Array.from(new Set(NOTE_SUBJECTS.map(s => s.name)));
    return unique.sort((a, b) => {
      const ia = precedenceSet.has(a) ? SUBJECT_PRECEDENCE.indexOf(a) : Number.MAX_SAFE_INTEGER;
      const ib = precedenceSet.has(b) ? SUBJECT_PRECEDENCE.indexOf(b) : Number.MAX_SAFE_INTEGER;
      if (ia !== ib) return ia - ib;
      return a.localeCompare(b);
    });
  }, []);

  const suggestionSubjects = useMemo(() => {
    if (!editNoteText?.trim()) return [];
    const { matches } = classifySubjects(editNoteText);
    return matches.map(m => m.subject).filter(s => s !== 'Geral');
  }, [editNoteText]);

  const handleAppend = async () => {
    const text = (newNoteText || '').trim();
    if (!text) {
      addToast('Digite a nota antes de salvar.', 'warning');
      return;
    }
    try {
      const updated = await appendCompanyNote(companyId, text);
      onNotesChange?.(updated);
      setNewNoteText('');
      setIsAddOpen(false);
      addToast('Nota adicionada com sucesso!', 'success');
    } catch (err: any) {
      addToast(err.message || 'Falha ao adicionar a nota.', 'error');
    }
  };

  const openEdit = (idx: number, item: CompanyNote) => {
    setEditIndex(idx);
    setEditNoteText(item.nota || '');
    setEditNoteAssunto(item.assunto || 'Geral');
    setEditRecompute(true);
    setIsEditOpen(true);
  };

  const handleEdit = async () => {
    if (editIndex === null) return;
    try {
      const patch: Partial<CompanyNote> = {};
      patch.nota = editNoteText || '';
      if (!editRecompute) patch.assunto = editNoteAssunto || 'Geral';
      const updated = await updateCompanyNoteAt(companyId, editIndex, patch, editRecompute);
      onNotesChange?.(updated);
      setIsEditOpen(false);
      addToast('Nota atualizada com sucesso!', 'success');
    } catch (err: any) {
      addToast(err.message || 'Falha ao atualizar a nota.', 'error');
    }
  };

  const handleDelete = async (idx: number) => {
    try {
      const updated = await deleteCompanyNoteAt(companyId, idx);
      onNotesChange?.(updated);
      addToast('Nota excluída com sucesso!', 'success');
    } catch (err: any) {
      addToast(err.message || 'Falha ao excluir a nota.', 'error');
    }
  };

  return (
    <section className="space-y-4">
      <h3 className="text-xl font-bold text-gray-800 dark:text-white">Notas (histórico)</h3>

      {!companyId ? (
        <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm">
          Selecione/salve a empresa para habilitar o histórico de notas.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Registre fatos e decisões. O assunto pode ser recalculado automaticamente.
            </p>
            <Button type="button" variant="primary" onClick={() => setIsAddOpen(true)}>
              <PlusCircle className="h-4 w-4 mr-2" />
              Adicionar nota
            </Button>
          </div>

          <div className="rounded-xl p-4 neumorphic-convex">
            {Array.isArray(notes) && notes.length > 0 ? (
              <ul className="space-y-3">
                {[...notes]
                  .map((n, idx) => ({ ...n, _idx: idx }))
                  .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
                  .map(item => (
                    <li key={`${item._idx}-${item.data}`} className="rounded-lg p-3 bg-plate/60 dark:bg-plate-dark/60">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            <span className="font-medium">{item.assunto || 'Geral'}</span>
                            <span className="mx-2">•</span>
                            <span>{fmtDateTimeBR(item.data)}</span>
                          </div>
                          <div className="text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words mt-1">
                            {item.nota || '—'}
                          </div>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2">
                          <Button type="button" variant="default" onClick={() => openEdit(item._idx, item)} title="Editar nota">
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button type="button" variant="danger" onClick={() => handleDelete(item._idx)} title="Excluir nota">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-4">Nenhuma nota registrada.</div>
            )}
          </div>

          {/* Modal: Adicionar Nota */}
          <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Adicionar nota">
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nota</label>
              <textarea
                className="w-full min-h-[120px] rounded-lg p-3 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-gray-700 outline-none"
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Descreva a nota. Ex.: 'Cliente solicitou novo budget anual para 2026.'"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="default" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
                <Button type="button" variant="primary" onClick={handleAppend}>Salvar</Button>
              </div>
            </div>
          </Modal>

          {/* Modal: Editar Nota */}
          <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Editar nota">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nota</label>
                <textarea
                  className="w-full min-h-[120px] rounded-lg p-3 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-gray-700 outline-none"
                  value={editNoteText}
                  onChange={(e) => setEditNoteText(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg p-3 bg-black/5 dark:bg-white/5">
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-200">Recalcular assunto automaticamente</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Se ativo, o assunto será recalculado pelas regras determinísticas ao salvar.</div>
                </div>
                <Switch id="recompute" checked={editRecompute} onCheckedChange={setEditRecompute} />
              </div>

              {!editRecompute && (
                <div className="space-y-2">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Assunto (manual)</label>
                    <Select value={editNoteAssunto} onChange={(e) => setEditNoteAssunto(e.target.value)}>
                      {subjectOptions.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </Select>
                  </div>

                  {suggestionSubjects.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Sugestões de assunto (clique para aplicar):</div>
                      <div className="flex flex-wrap gap-2">
                        {suggestionSubjects.map(s => (
                          <Button
                            key={s}
                            type="button"
                            variant="default"
                            onClick={() => { setEditNoteAssunto(s); setEditRecompute(false); }}
                            title={`Aplicar "${s}" como assunto`}
                            className="!py-1 !px-2 text-xs"
                          >
                            {s}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="default" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
                <Button type="button" variant="primary" onClick={handleEdit}>Salvar alterações</Button>
              </div>
            </div>
          </Modal>
        </>
      )}
    </section>
  );
};

export default NotesSection;

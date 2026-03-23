/*
-- ===================================================
-- Código             : /src/components/catalogs/TagsManager.tsx
-- Versão (.v20)      : 5.1.0
-- Data/Hora          : 2025-12-06 12:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Exibir "Usuário" ou "Sistema" na coluna Origem.
-- Alterações (5.1.0) :
--   • [UI] A coluna "Origem" agora exibe o rótulo em português em vez do valor do banco de dados.
-- Dependências       : react, @/types/tag, @/services/tagsService, @/components/ui/*, ./TagForm, clsx
-- ===================================================
*/
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Tag } from '@/types/tag';
import * as tagsService from '@/services/tagsService';
import { useToast } from '@/contexts/ToastContext';
import { Skeleton } from '@/components/ui/Skeleton';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Plus, Edit, Trash2 } from 'lucide-react';
import TagForm from './TagForm';
import clsx from 'clsx';

const getContrastColor = (hexColor: string): string => {
  if (!hexColor) return '#000000';
  let c = hexColor.startsWith('#') ? hexColor.substring(1) : hexColor;
  if (c.length === 3) {
    c = c.split('').map(char => char + char).join('');
  }
  if (c.length !== 6) {
    return '#000000';
  }
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

const ColorCell: React.FC<{ color: string | null }> = ({ color }) => {
  const bgColor = color || '#A0A0A0';
  const textColor = getContrastColor(bgColor);

  return (
    <div
      className="w-28 h-8 flex items-center justify-center rounded-md text-xs font-mono shadow-inner border border-black/10"
      style={{ backgroundColor: bgColor, color: textColor }}
    >
      {bgColor.toUpperCase()}
    </div>
  );
};

const StatusBadge: React.FC<{ isActive: boolean }> = ({ isActive }) => (
  <span
    className={clsx(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
      isActive
        ? 'bg-green-100 text-green-800'
        : 'bg-gray-100 text-gray-700'
    )}
  >
    {isActive ? 'Ativo' : 'Inativo'}
  </span>
);

const TagsManager: React.FC = () => {
  const { addToast } = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Partial<Tag> | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);

  const fetchTags = useCallback(async () => {
    setIsLoading(true);
    try {
      const { tags: data } = await tagsService.listTags({ limit: 1000 });
      setTags(data);
    } catch (error) {
      addToast('Erro ao carregar etiquetas.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const filteredTags = useMemo(() => {
    if (!searchTerm) return tags;
    const lowercasedFilter = searchTerm.toLowerCase();
    return tags.filter(
      tag =>
        tag.name.toLowerCase().includes(lowercasedFilter) ||
        tag.slug.toLowerCase().includes(lowercasedFilter)
    );
  }, [tags, searchTerm]);

  const handleOpenCreate = () => {
    setEditingTag(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (tag: Tag) => {
    setEditingTag(tag);
    setIsFormOpen(true);
  };

  const handleOpenDelete = (tag: Tag) => {
    setTagToDelete(tag);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!tagToDelete) return;
    try {
      await tagsService.deleteTag(tagToDelete.id);
      setTags(prev => prev.filter(t => t.id !== tagToDelete.id));
      addToast('Etiqueta excluída com sucesso!', 'success');
    } catch (error) {
      addToast('Erro ao excluir etiqueta.', 'error');
    } finally {
      setIsDeleteConfirmOpen(false);
      setTagToDelete(null);
    }
  };

  const handleSave = (savedTag: Tag) => {
    setTags(prev => {
      const index = prev.findIndex(t => t.id === savedTag.id);
      if (index > -1) {
        const newTags = [...prev];
        newTags[index] = savedTag;
        return newTags;
      }
      return [...prev, savedTag];
    });
    fetchTags();
  };

  return (
    <>
      <div className="space-y-6">
        <section className="neumorphic-convex rounded-2xl p-4 sm:p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-dark-t1">Gerenciador de Etiquetas</h2>
            <Button onClick={handleOpenCreate} variant="primary">
              <Plus className="h-5 w-5 mr-2" />
              Adicionar Nova Etiqueta
            </Button>
          </div>

          <div className="mb-4 max-w-md">
            <Input
              label="Buscar por Nome ou Slug"
              placeholder="Digite para filtrar..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredTags.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 dark:text-dark-t2">
                {searchTerm ? 'Nenhum resultado encontrado.' : 'Nenhuma etiqueta encontrada. Crie uma nova!'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-dark-t2 border-b border-gray-200/60 dark:border-white/10/60">
                    <th className="py-2 px-3 font-semibold">Nome / Slug</th>
                    <th className="py-2 px-3 font-semibold">Cor</th>
                    <th className="py-2 px-3 font-semibold">Grupo</th>
                    <th className="py-2 px-3 font-semibold">Origem</th>
                    <th className="py-2 px-3 font-semibold">Status</th>
                    <th className="py-2 px-3 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTags.map(tag => (
                    <tr key={tag.id} className="border-b border-gray-200/60 dark:border-white/10/60 hover:bg-black/5 dark:hover:bg-white/5">
                      <td className="py-3 px-3">
                        <div className="font-bold text-gray-800 dark:text-dark-t1">{tag.name}</div>
                        <div className="text-xs text-gray-500 font-mono">{tag.slug}</div>
                      </td>
                      <td className="py-3 px-3">
                        <ColorCell color={tag.color} />
                      </td>
                      <td className="py-3 px-3 text-gray-600 dark:text-dark-t1">
                        {tag.tag_group || '—'}
                      </td>
                      <td className="py-3 px-3 text-gray-600 dark:text-dark-t1">
                        <span className={clsx(
                          'px-2 py-1 text-xs rounded-md',
                          tag.origin === 'system' 
                            ? 'bg-gray-200 text-gray-800' 
                            : 'bg-blue-100 text-blue-800'
                        )}>
                          {tag.origin === 'user' ? 'Usuário' : 'Sistema'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge isActive={tag.is_active} />
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <Button onClick={() => handleOpenEdit(tag)} variant="default" className="!p-2">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button onClick={() => handleOpenDelete(tag)} variant="danger" className="!p-2">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <TagForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSave}
        initialData={editingTag}
      />

      <Modal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} title="Confirmar Exclusão">
        <p className="mb-6">Tem certeza que deseja excluir a etiqueta <strong>{tagToDelete?.name}</strong>? Esta ação não pode ser desfeita.</p>
        <div className="flex justify-end gap-4">
          <Button onClick={() => setIsDeleteConfirmOpen(false)} variant="default">Cancelar</Button>
          <Button onClick={handleConfirmDelete} variant="danger">Excluir</Button>
        </div>
      </Modal>
    </>
  );
};

export default TagsManager;

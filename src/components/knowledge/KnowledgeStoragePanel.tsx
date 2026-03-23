/*
-- ===================================================
-- Código             : /src/components/knowledge/KnowledgeStoragePanel.tsx
-- Versão (.v20)      : 1.5.0
-- Data/Hora          : 2025-12-09 10:10
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Painel de Armazenamento da Base de Conhecimento
--                      (upload, download, delete, URL pública, proteção KB).
-- Fluxo              : Renderizado na aba "Armazenamento" da KnowledgePage.tsx.
-- Alterações (1.5.0) :
--   • handleCopyUrl revisado:
--       - Tenta usar navigator.clipboard.writeText quando disponível.
--       - Fallback com textarea + document.execCommand('copy').
--       - Em caso de falha total, mostra mensagem informativa (info), não erro vermelho.
--       - Limpa mensagem de erro ao copiar com sucesso.
-- Dependências       : knowledgeStorageService.ts, errorMessages.ts, lucide-react
-- ===================================================
*/

import React, { useEffect, useRef, useState } from 'react';
import {
  Download,
  Trash2,
  UploadCloud,
  HardDrive,
  ShieldAlert,
  Copy,
  Check,
} from 'lucide-react';

import {
  getKnowledgeFiles,
  uploadKnowledgeFileWithRules,
  deleteKnowledgeFileWithRules,
  downloadKnowledgeFileWithUrl,
  KnowledgeFile,
} from '@/services/knowledgeStorageService';

import { getFriendlyErrorMessage } from '@/utils/errorMessages';

type Props = {
  /** slug do tenant: ex.: 'geigerscope' */
  tenantSlug: string;
};

const KnowledgeStoragePanel: React.FC<Props> = ({ tenantSlug }) => {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<KnowledgeFile | null>(null);

  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Nome do arquivo padrão kb<slug>.md
  const defaultKbFilename = `kb${tenantSlug}.md`;

  // ============================================================
  // Carregar arquivos
  // ============================================================
  const loadFiles = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await getKnowledgeFiles(tenantSlug);
      setFiles(list);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'kb-storage-list'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  // ============================================================
  // Upload
  // ============================================================
  const handleUploadClick = () => fileInputRef.current?.click();

  const handleUploadChange: React.ChangeEventHandler<HTMLInputElement> = async (
    e
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setInfo(null);

    try {
      await uploadKnowledgeFileWithRules({ tenantSlug, file });
      setInfo('Arquivo enviado com sucesso.');
      await loadFiles();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'kb-storage-upload'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ============================================================
  // Download
  // ============================================================
  const handleDownload = async (file: KnowledgeFile) => {
    setError(null);
    try {
      const { url, suggestedFilename } = await downloadKnowledgeFileWithUrl(
        file.path
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'kb-storage-download'));
    }
  };

  // ============================================================
  // Exclusão
  // ============================================================
  const confirmDelete = (file: KnowledgeFile) => {
    if (file.isKbDefault) {
      setError(
        `O arquivo padrão ${defaultKbFilename} não pode ser excluído. Utilize upload para substituí-lo.`
      );
      return;
    }
    setDeleteTarget(file);
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setError(null);
    setInfo(null);

    try {
      await deleteKnowledgeFileWithRules({
        tenantSlug,
        path: deleteTarget.path,
      });
      setInfo('Arquivo excluído com sucesso.');
      setDeleteTarget(null);
      await loadFiles();
    } catch (err) {
      setError(getFriendlyErrorMessage(err, 'kb-storage-delete'));
    } finally {
      setIsDeleting(false);
    }
  };

  // ============================================================
  // Copiar URL (Clipboard API + fallback)
  // ============================================================
  const handleCopyUrl = async (file: KnowledgeFile) => {
    const textToCopy = file.publicUrl || '';

    if (!textToCopy) {
      setError('URL pública não disponível para este arquivo.');
      return;
    }

    setError(null);
    setInfo(null);

    let copied = false;

    // 1) Tenta Clipboard API moderna (requer contexto seguro)
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        copied = true;
      } catch (err) {
        console.warn('Clipboard API falhou, tentando fallback...', err);
      }
    }

    // 2) Fallback com textarea + execCommand('copy')
    if (!copied && typeof document !== 'undefined') {
      try {
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = textToCopy;
        tempTextArea.style.position = 'fixed';
        tempTextArea.style.top = '0';
        tempTextArea.style.left = '-9999px';
        document.body.appendChild(tempTextArea);
        tempTextArea.focus();
        tempTextArea.select();

        const success = document.execCommand('copy');
        document.body.removeChild(tempTextArea);

        if (success) {
          copied = true;
        }
      } catch (err) {
        console.warn('Fallback de cópia falhou.', err);
      }
    }

    if (copied) {
      setCopiedPath(file.path);
      setTimeout(() => setCopiedPath(null), 2000);
    } else {
      // Não quebra com erro vermelho; apenas orienta o usuário.
      setInfo(
        'Não foi possível copiar automaticamente. Selecione a URL e use Ctrl+C (ou ⌘C) para copiar.'
      );
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="bg-plate dark:bg-dark-s1 rounded-2xl p-6 neumorphic-convex">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Armazenamento de arquivos
          </h2>
          <p className="text-sm text-gray-500 dark:text-dark-t2 mt-1">
            Gerencie arquivos da sua Base de Conhecimento.{' '}
            O arquivo padrão <code>{defaultKbFilename}</code> não pode ser excluído,
            somente alterado.
          </p>
        </div>

        {/* Upload */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".md,.png,.jpg,.jpeg,.webp,.gif,.svg,.mp4,.mp3"
            onChange={handleUploadChange}
          />

          <button
            onClick={handleUploadClick}
            disabled={isUploading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full neumorphic-concave disabled:opacity-60"
          >
            <UploadCloud className="h-4 w-4" />
            {isUploading ? 'Enviando...' : 'Upload de arquivo'}
          </button>
        </div>
      </header>

      {/* Alerts */}
      {(error || info) && (
        <div className="mb-4 text-sm space-y-1">
          {error && <p className="text-red-500">{error}</p>}
          {info && <p className="text-emerald-600 dark:text-emerald-400">{info}</p>}
        </div>
      )}

      {/* Tabela */}
      <div className="rounded-2xl bg-white/70 dark:bg-slate-900/60 shadow-inner overflow-hidden">
        <div className="max-h-[calc(100vh-320px)] overflow-y-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-black/5 dark:bg-dark-s1/5">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Arquivo</th>
                <th className="px-4 py-3 text-left font-semibold">Atualizado em</th>
                <th className="px-4 py-3 text-left font-semibold">URL (Markdown)</th>
                <th className="px-4 py-3 text-left font-semibold">Proteção</th>
                <th className="px-4 py-3 text-right font-semibold">Ações</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    Carregando arquivos...
                  </td>
                </tr>
              ) : files.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    Nenhum arquivo encontrado.
                  </td>
                </tr>
              ) : (
                files.map((file) => (
                  <tr
                    key={file.path}
                    className="border-t border-black/5 dark:border-white/10"
                  >
                    {/* Nome */}
                    <td className="px-4 py-3">{file.name}</td>

                    {/* Atualizado */}
                    <td className="px-4 py-3 text-gray-500 dark:text-dark-t2">
                      {file.updatedAt ? file.updatedAt.toLocaleString() : '—'}
                    </td>

                    {/* URL Pública */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 max-w-xs">
                        <input
                          readOnly
                          value={file.publicUrl}
                          className="flex-1 px-2 py-1 rounded border text-xs truncate"
                        />

                        <button
                          onClick={() => handleCopyUrl(file)}
                          className="w-8 h-8 rounded-full neumorphic-convex hover:neumorphic-concave flex items-center justify-center"
                        >
                          {copiedPath === file.path ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Proteção */}
                    <td className="px-4 py-3">
                      {file.isKbDefault && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
                          <ShieldAlert className="h-3 w-3" />
                          kb padrão
                        </span>
                      )}
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleDownload(file)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full neumorphic-convex hover:neumorphic-concave text-xs"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </button>

                        <button
                          disabled={file.isKbDefault}
                          onClick={() => confirmDelete(file)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full neumorphic-convex hover:neumorphic-concave text-xs text-red-600 disabled:opacity-40"
                        >
                          <Trash2 className="h-3 w-3" />
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Exclusão */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-40">
          <div className="bg-plate dark:bg-dark-s1 rounded-2xl p-6 max-w-md w-full neumorphic-convex">
            <h3 className="text-lg font-bold mb-3">Confirmar exclusão</h3>

            <p className="text-sm text-gray-600 dark:text-dark-t1">
              Deseja excluir o arquivo <strong>{deleteTarget.name}</strong>?{' '}
              Esta ação não pode ser desfeita.
            </p>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-full neumorphic-convex disabled:opacity-60 text-sm"
              >
                Cancelar
              </button>

              <button
                onClick={handleDeleteConfirmed}
                disabled={isDeleting}
                className="px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 text-sm"
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

export default KnowledgeStoragePanel;

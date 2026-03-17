/*
-- =========================================================
-- Código             : /src/components/knowledge/MarkdownEditor.tsx
-- Versão (.v20)      : 1.4.3
-- Data/Hora          : 2025-12-09 11:30
-- Autor              : FL / Execução via E.V.A.
-- Objetivo do código : Editor MD Appy com suporte a leitura/gravação de arquivos .md na nuvem
-- Fluxo              : KnowledgePage (tenantSlug) -> MarkdownEditor -> knowledgeMdEditorService -> Supabase Storage
-- Alterações (1.4.3) :
--   • Ao confirmar a limpeza (borracha), além do conteúdo o nome do arquivo
--     também é limpo (setFileName('')), exibindo o placeholder na toolbar.
--   • Mantidas alterações anteriores:
--       - focusWithoutScroll para evitar "jump" da página ao clicar na toolbar.
--       - Integração com nuvem e modais de overwrite/delete.
-- Dependências       :
--   • /src/components/knowledge/markdown/MarkdownToolbar.tsx
--   • /src/components/knowledge/markdown/MarkdownStatusBar.tsx
--   • /src/components/knowledge/markdown/FindReplaceBar.tsx
--   • /src/services/knowledgeMdEditorService.ts
-- =========================================================
*/

import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeRaw from 'rehype-raw';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useHistory } from '@/hooks/useHistory';
import { MarkdownToolbar } from './markdown/MarkdownToolbar';
import { MarkdownStatusBar } from './markdown/MarkdownStatusBar';
import { FindReplaceBar } from './markdown/FindReplaceBar';
import { useToast } from '@/contexts/ToastContext';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import clsx from 'clsx';

// @ts-ignore
import html2pdf from 'html2pdf.js';

// Serviço de integração com o Storage (.md)
import {
  listMarkdownFiles,
  loadMarkdownFile,
  saveMarkdownFile,
  fileExists,
} from '@/services/knowledgeMdEditorService';

const STORAGE_KEY_CONTENT = 'md_editor_content';
const STORAGE_KEY_FILENAME = 'md_editor_filename';
const STORAGE_KEY_LAYOUT = 'md_editor_layout';
const STORAGE_KEY_THEME = 'md_editor_theme';

interface Match {
  start: number;
  end: number;
}

interface MarkdownEditorProps {
  /** Slug do tenant, ex.: 'geigerscope' */
  tenantSlug: string;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ tenantSlug }) => {
  // State principal
  const [fileName, setFileName] = useState('untitled.md');
  const {
    state: content,
    set: setContent,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory('');
  const [layout, setLayout] = useState<'horizontal' | 'vertical'>('horizontal');
  const [theme, setTheme] = useState<'light' | 'dark' | 'sepia'>('sepia'); // default SÉPIA

  // Search State
  const [showSearch, setShowSearch] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState('');

  // Cloud Storage State (.md)
  const [cloudFiles, setCloudFiles] = useState<string[]>([]);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [overwriteFileName, setOverwriteFileName] = useState<string | null>(
    null
  );

  // Modal de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetFileName, setDeleteTargetFileName] = useState<
    string | null
  >(null);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { addToast } = useToast();

  // Nome do KB padrão: kb[slug].md
  const protectedKbFileName = useMemo(
    () => `kb${tenantSlug}.md`,
    [tenantSlug]
  );

  // Helper: foca sem provocar scroll global
  const focusWithoutScroll = (el: HTMLTextAreaElement) => {
    if (!el) return;
    try {
      // Alguns browsers suportam preventScroll
      // @ts-ignore
      el.focus({ preventScroll: true });
    } catch {
      // Fallback padrão
      el.focus();
    }
  };

  // --- Helpers de nome de arquivo ---
  const normalizeFileName = (name: string): string => {
    const trimmed = name.trim();
    if (!trimmed) return 'semtítulo.md';
    if (trimmed.toLowerCase().endsWith('.md')) return trimmed;
    return `${trimmed}.md`;
  };

  const loadCloudFiles = async () => {
    try {
      const list = await listMarkdownFiles(tenantSlug);
      setCloudFiles(list);
    } catch (error) {
      console.error(error);
      addToast('Não foi possível carregar os arquivos da nuvem.', 'error');
    }
  };

  // --- Initialization ---
  useEffect(() => {
    const savedContent = localStorage.getItem(STORAGE_KEY_CONTENT);
    const savedName = localStorage.getItem(STORAGE_KEY_FILENAME);
    const savedLayout = localStorage.getItem(
      STORAGE_KEY_LAYOUT
    ) as 'horizontal' | 'vertical';
    const savedTheme = localStorage.getItem(
      STORAGE_KEY_THEME
    ) as 'light' | 'dark' | 'sepia';

    if (savedContent) setContent(savedContent);
    if (savedName) setFileName(savedName);
    if (savedLayout) setLayout(savedLayout);
    if (savedTheme) setTheme(savedTheme); // se não houver, mantém 'sepia'
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Carrega lista de arquivos .md da nuvem na inicialização
  useEffect(() => {
    loadCloudFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  // --- Persistence ---
  useEffect(() => {
    const handler = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY_CONTENT, content);
      localStorage.setItem(STORAGE_KEY_FILENAME, fileName);
      localStorage.setItem(STORAGE_KEY_LAYOUT, layout);
      localStorage.setItem(STORAGE_KEY_THEME, theme);
    }, 1000);
    return () => clearTimeout(handler);
  }, [content, fileName, layout, theme]);

  // --- Sync Scroll ---
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = target.scrollTop;
      highlightRef.current.scrollLeft = target.scrollLeft;
    }
    // Sync preview (approximate)
    if (previewRef.current) {
      const percent =
        target.scrollTop / (target.scrollHeight - target.clientHeight || 1);
      previewRef.current.scrollTop =
        percent *
        (previewRef.current.scrollHeight - previewRef.current.clientHeight);
    }
  };

  // --- Text Insertion ---
  const insertText = (
    prefix: string,
    suffix: string = '',
    placeholder: string = ''
  ) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    const before = text.substring(0, start);
    const after = text.substring(end);

    const newText =
      before + prefix + (selected || placeholder) + suffix + after;

    setContent(newText);

    setTimeout(() => {
      const newCursorPos =
        start + prefix.length + (selected || placeholder).length + suffix.length;

      // Foca sem causar scroll da página
      focusWithoutScroll(textarea);
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // --- Search Logic ---
  const performSearch = (query: string, options: { caseSensitive: boolean }) => {
    setSearchQuery(query);
    if (!query) {
      setMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }

    const regex = new RegExp(
      query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      options.caseSensitive ? 'g' : 'gi'
    );
    const newMatches: Match[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      newMatches.push({
        start: match.index,
        end: match.index + match[0].length,
      });
    }
    setMatches(newMatches);
    if (newMatches.length > 0) {
      setCurrentMatchIndex(0);
      scrollToMatchInternal(newMatches[0].start, newMatches);
    } else {
      setCurrentMatchIndex(-1);
    }
  };

  const scrollToMatchInternal = (index: number, list: Match[]) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const match = list.find((m) => m.start === index);
    if (!match) return;

    textarea.setSelectionRange(match.start, match.end);
    focusWithoutScroll(textarea);
  };

  const scrollToMatch = (index: number) => {
    if (matches.length === 0) return;
    scrollToMatchInternal(index, matches);
  };

  const nextMatch = () => {
    if (matches.length === 0) return;
    const next = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(next);
    scrollToMatch(matches[next].start);
  };

  const prevMatch = () => {
    if (matches.length === 0) return;
    const prev = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prev);
    scrollToMatch(matches[prev].start);
  };

  const replaceCurrent = (replacement: string) => {
    if (currentMatchIndex === -1 || matches.length === 0) return;
    const match = matches[currentMatchIndex];
    const newContent =
      content.substring(0, match.start) +
      replacement +
      content.substring(match.end);
    setContent(newContent);
    setMatches([]);
  };

  const replaceAll = (replacement: string) => {
    if (!searchQuery) return;
    const regex = new RegExp(
      searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'gi'
    );
    const newContent = content.replace(regex, replacement);
    setContent(newContent);
    setMatches([]);
  };

  // --- Highlighting Overlay ---
  const renderHighlights = () => {
    if (!searchQuery || matches.length === 0) return content;

    let lastIndex = 0;
    const elements: React.ReactNode[] = [];

    matches.forEach((match, i) => {
      elements.push(content.substring(lastIndex, match.start));
      const isCurrent = i === currentMatchIndex;
      elements.push(
        <span
          key={i}
          className={
            isCurrent
              ? 'bg-[#ff6b35] text-transparent'
              : 'bg-[#ffd60a] text-transparent'
          }
        >
          {content.substring(match.start, match.end)}
        </span>
      );
      lastIndex = match.end;
    });

    elements.push(content.substring(lastIndex));
    return elements;
  };

  // --- File Operations (local) ---
  const handleLoad = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setContent(ev.target?.result as string);
      setFileName(file.name);
      addToast('Arquivo carregado com sucesso!', 'success');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExport = async (type: 'md' | 'pdf' | 'docx') => {
    if (type === 'md') {
      const blob = new Blob([content], {
        type: 'text/markdown;charset=utf-8',
      });
      saveAs(blob, fileName.endsWith('.md') ? fileName : `${fileName}.md`);
    } else if (type === 'pdf') {
      const element = document.createElement('div');
      element.innerHTML = previewRef.current?.innerHTML || '';
      element.className = 'prose max-w-none p-8';

      const opt = {
        margin: 10,
        filename: fileName.replace(/\.md$/, '') + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      };

      html2pdf().set(opt).from(element).save();
    } else if (type === 'docx') {
      const lines = content.split('\n');
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: lines.map(
              (line) =>
                new Paragraph({
                  children: [new TextRun(line)],
                  heading: line.startsWith('# ')
                    ? 'Heading1'
                    : line.startsWith('## ')
                    ? 'Heading2'
                    : undefined,
                  bullet: line.startsWith('- ')
                    ? { level: 0 }
                    : undefined,
                })
            ),
          },
        ],
      });

      Packer.toBlob(doc).then((blob) => {
        saveAs(blob, fileName.replace(/\.md$/, '') + '.docx');
      });
    }
  };

  // --- Integração com Storage (.md) ---

  const handleSaveToCloud = async () => {
    try {
      const finalName = normalizeFileName(fileName);
      const isProtectedKb = finalName === protectedKbFileName;

      // Regra: para sobrescrever kb[slug].md precisa ter conteúdo
      if (isProtectedKb && !content.trim()) {
        addToast(
          'Para sobrescrever o KB padrão, o editor não pode estar vazio.',
          'warning'
        );
        return;
      }

      const exists = await fileExists(tenantSlug, finalName);

      if (exists) {
        setOverwriteFileName(finalName);
        setShowOverwriteModal(true);
        return;
      }

      await saveMarkdownFile(tenantSlug, finalName, content);
      addToast('Arquivo salvo na nuvem!', 'success');
      await loadCloudFiles();
    } catch (error) {
      console.error(error);
      addToast('Não foi possível salvar o arquivo na nuvem.', 'error');
    }
  };

  const handleConfirmOverwrite = async () => {
    if (!overwriteFileName) {
      setShowOverwriteModal(false);
      return;
    }

    try {
      await saveMarkdownFile(tenantSlug, overwriteFileName, content);
      addToast('Arquivo sobrescrito na nuvem!', 'success');
      setShowOverwriteModal(false);
      setOverwriteFileName(null);
      await loadCloudFiles();
    } catch (error) {
      console.error(error);
      addToast('Não foi possível sobrescrever o arquivo na nuvem.', 'error');
    }
  };

  const handleOpenFromCloud = async (name: string) => {
    try {
      const text = await loadMarkdownFile(tenantSlug, name);
      setContent(text);
      setFileName(name);
      addToast('Arquivo carregado da nuvem!', 'success');
    } catch (error) {
      console.error(error);
      addToast('Não foi possível carregar o arquivo da nuvem.', 'error');
    }
  };

  // Pedido de exclusão vindo da toolbar (abre modal)
  const handleRequestDeleteFromCloud = (name: string) => {
    setDeleteTargetFileName(name);
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteFromCloud = async () => {
    if (!deleteTargetFileName) {
      setShowDeleteModal(false);
      return;
    }

    try {
      // import dinâmico para não quebrar build caso deleteMarkdownFile não exista
      const service = await import('@/services/knowledgeMdEditorService');
      const deleteFn: ((tenantSlug: string, fileName: string) => Promise<void>) |
        undefined = service.deleteMarkdownFile;

      if (typeof deleteFn !== 'function') {
        addToast(
          'Função de exclusão (deleteMarkdownFile) não está implementada no serviço.',
          'warning'
        );
      } else {
        await deleteFn(tenantSlug, deleteTargetFileName);
        addToast('Arquivo excluído da nuvem!', 'success');
        await loadCloudFiles();
      }

      setShowDeleteModal(false);
      setDeleteTargetFileName(null);
    } catch (error) {
      console.error(error);
      addToast('Não foi possível excluir o arquivo da nuvem.', 'error');
      setShowDeleteModal(false);
      setDeleteTargetFileName(null);
    }
  };

  const handleCancelDeleteFromCloud = () => {
    setShowDeleteModal(false);
    setDeleteTargetFileName(null);
  };

  const handleClearEditor = () => {
    setShowClearModal(true);
  };

  const handleCancelClearEditor = () => {
    setShowClearModal(false);
  };

  const handleConfirmClearEditor = () => {
    setContent('');
    setFileName(''); // limpa o nome do arquivo -> volta a mostrar placeholder
    setShowClearModal(false);
    addToast('Conteúdo do editor e nome do arquivo limpos.', 'success');
  };

  // --- Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault();
            addToast('Salvo automaticamente!', 'success');
            break;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
          case 'f':
            e.preventDefault();
            setShowSearch(true);
            break;
          case 'h':
            e.preventDefault();
            setShowSearch(true);
            break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, addToast]);

  // --- Theme Classes ---
  const themeClasses = useMemo(() => {
    switch (theme) {
      case 'dark':
        return 'bg-gray-900 text-gray-100';
      case 'sepia':
        return 'bg-[#f4ecd8] text-[#5b4636]';
      default:
        return 'bg-white text-gray-900';
    }
  }, [theme]);

  return (
    <div
      className={clsx(
        'flex flex-col h-full w-full overflow-hidden rounded-xl shadow-xl border border-gray-200 dark:border-gray-700',
        themeClasses
      )}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".md"
        onChange={onFileChange}
      />

      <MarkdownToolbar
        onInsert={insertText}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onSave={() => addToast('Salvo!', 'success')}
        onLoad={handleLoad}
        onExport={handleExport}
        onToggleSearch={() => setShowSearch(!showSearch)}
        layout={layout}
        onToggleLayout={() =>
          setLayout((l) => (l === 'horizontal' ? 'vertical' : 'horizontal'))
        }
        theme={theme}
        onCycleTheme={() =>
          setTheme((t) =>
            t === 'light' ? 'dark' : t === 'dark' ? 'sepia' : 'light'
          )
        }
        fileName={fileName}
        setFileName={setFileName}
        // Storage + limpar conteúdo
        onSaveToCloud={handleSaveToCloud}
        onOpenFromCloud={handleOpenFromCloud}
        cloudFileList={cloudFiles}
        onClearEditor={handleClearEditor}
        // Exclusão com lista (dropdown)
        onDeleteFromCloud={handleRequestDeleteFromCloud}
        protectedKbFileName={protectedKbFileName}
      />

      <div className="relative flex-1 min-h-0">
        <FindReplaceBar
          isOpen={showSearch}
          onClose={() => setShowSearch(false)}
          onSearch={performSearch}
          onNext={nextMatch}
          onPrev={prevMatch}
          onReplace={replaceCurrent}
          onReplaceAll={replaceAll}
          matchCount={matches.length}
          currentMatchIndex={currentMatchIndex}
        />

        <PanelGroup direction={layout} className="h-full">
          <Panel defaultSize={50} minSize={20}>
            <div className="relative w-full h-full bg-transparent">
              {/* Highlight Overlay */}
              <div
                ref={highlightRef}
                className="absolute inset-0 p-4 font-mono text-sm whitespace-pre-wrap break-words text-transparent pointer-events-none overflow-hidden z-0"
                aria-hidden="true"
              >
                {renderHighlights()}
              </div>

              {/* Editor */}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onScroll={handleScroll}
                className={clsx(
                  'absolute inset-0 w-full h-full p-4 font-mono text-sm resize-none outline-none bg-transparent z-10',
                  theme === 'dark'
                    ? 'text-gray-100 caret-white'
                    : 'text-gray-900 caret-black'
                )}
                spellCheck={false}
                placeholder="Comece a escrever..."
              />
            </div>
          </Panel>

          <PanelResizeHandle
            className={clsx(
              'transition-colors',
              layout === 'horizontal'
                ? 'w-1 hover:bg-primary/50 cursor-col-resize'
                : 'h-1 hover:bg-primary/50 cursor-row-resize',
              'bg-gray-200 dark:bg-gray-700'
            )}
          />

          <Panel defaultSize={50} minSize={20}>
            <div
              ref={previewRef}
              className={clsx(
                'w-full h-full p-8 overflow-auto markdown-body',
                theme === 'dark' ? 'prose-invert' : '',
                theme === 'sepia' ? '' : ''
              )}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                rehypePlugins={[rehypeRaw]}
              >
                {content}
              </ReactMarkdown>
            </div>
          </Panel>
        </PanelGroup>
      </div>

      <MarkdownStatusBar text={content} />

      {/* Modal: Limpar conteúdo do editor */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-bold mb-3">Limpar conteúdo</h3>
            <p className="text-sm mb-4 text-gray-700 dark:text-gray-200">
              Tem certeza que deseja limpar todo o conteúdo do editor e o nome
              do arquivo? Esta ação não poderá ser desfeita.
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={handleCancelClearEditor}
                className="px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 text-sm"
              >
                Não
              </button>
              <button
                onClick={handleConfirmClearEditor}
                className="px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 text-sm"
              >
                Sim, limpar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Sobrescrever arquivo na nuvem */}
      {showOverwriteModal && overwriteFileName && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-plate dark:bg-plate-dark rounded-2xl p-6 max-w-md w-full neumorphic-convex">
            <h3 className="text-lg font-bold mb-3">Confirmar sobrescrita</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Deseja sobrescrever o arquivo <strong>{overwriteFileName}</strong>
              ? Esta ação não pode ser desfeita e o conteúdo atual não poderá
              ser recuperado.
            </p>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowOverwriteModal(false);
                  setOverwriteFileName(null);
                }}
                className="px-4 py-2 rounded-full neumorphic-convex disabled:opacity-60 text-sm"
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirmOverwrite}
                className="px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 text-sm"
              >
                Sobrescrever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Excluir arquivo da nuvem */}
      {showDeleteModal && deleteTargetFileName && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-plate dark:bg-plate-dark rounded-2xl p-6 max-w-md w-full neumorphic-convex">
            <h3 className="text-lg font-bold mb-3">Excluir arquivo</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Tem certeza que deseja excluir o arquivo{' '}
              <strong>{deleteTargetFileName}</strong> da nuvem? Esta ação não
              poderá ser desfeita.
            </p>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={handleCancelDeleteFromCloud}
                className="px-4 py-2 rounded-full neumorphic-convex disabled:opacity-60 text-sm"
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirmDeleteFromCloud}
                className="px-4 py-2 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 text-sm"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkdownEditor;

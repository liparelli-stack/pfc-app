/*
-- =========================================================
-- Código             : /src/components/knowledge/markdown/MarkdownToolbar.tsx
-- Versão (.v20)      : 1.9.2
-- Data/Hora          : 2025-12-09 11:30
-- Autor              : FL / Execução via E.V.A.
-- Objetivo do código : Toolbar do Editor MD Appy com:
--                      • botões locais
--                      • exportação
--                      • salvar/abrir nuvem
--                      • limpar editor
--                      • exclusão de arquivos da nuvem (dropdown)
-- Fluxo              : MarkdownEditor -> MarkdownToolbar -> handlers
-- Alterações (1.9.2) :
--   • Caixa do nome do arquivo com fundo levemente alaranjado
--     (bg-orange-50) e borda sutil, mantendo boa leitura em dark mode.
--   • Mantidas alterações anteriores:
--       - preventDefault/stopPropagation em todos os botões.
--       - Dropdowns sem provocar scroll para o topo.
-- Dependências       : lucide-react, clsx
-- =========================================================
*/

import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Table as TableIcon,
  Code,
  Quote,
  Minus,
  MessageSquare,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
  Save,
  FolderOpen,
  Download,
  Search,
  Columns,
  Rows,
  Sun,
  Moon,
  Coffee,
  Highlighter,
  Type,
  ChevronDown,
  Eraser,
  CloudUpload,
  CloudDownload,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';

// ------------------------------------------------------------------
// COMPONENTES PADRÃO DA TOOLBAR
// ------------------------------------------------------------------

interface ToolbarButtonProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) onClick();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={label}
      className={clsx(
        'p-1.5 rounded-md transition-all duration-200 flex items-center justify-center',
        active
          ? 'bg-primary text-white shadow-inner'
          : 'text-gray-600 dark:text-dark-t1 hover:bg-gray-200 dark:hover:bg-dark-s3',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
};

// ------------------------------------------------------------------
// DROPDOWN PADRÃO
// ------------------------------------------------------------------

interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  color?: string;
}

interface ToolbarDropdownProps {
  icon: React.ElementType;
  label: string;
  items: DropdownItem[];
}

const ToolbarDropdown: React.FC<ToolbarDropdownProps> = ({
  icon: Icon,
  label,
  items,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  if (!items.length) return null;

  const handleToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const handleItemClick =
    (onClick: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
      setIsOpen(false);
    };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleToggle}
        title={label}
        className={clsx(
          'p-1.5 rounded-md flex items-center gap-1',
          isOpen
            ? 'bg-gray-200 dark:bg-dark-s2 text-primary'
            : 'text-gray-600 dark:text-dark-t1 hover:bg-gray-200 dark:hover:bg-dark-s3'
        )}
      >
        <Icon className="h-4 w-4" />
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-dark-s2 border border-gray-300 dark:border-white/10 rounded-lg shadow-xl z-50">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={handleItemClick(item.onClick)}
              className="px-3 py-2 w-full text-left text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-dark-s3"
            >
              {item.icon}
              {item.color && (
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
              )}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// PROPS DA TOOLBAR PRINCIPAL
// ------------------------------------------------------------------

interface MarkdownToolbarProps {
  onInsert: (prefix: string, suffix?: string, placeholder?: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  onLoad: () => void;
  onExport: (type: 'md' | 'pdf' | 'docx') => void;
  onToggleSearch: () => void;
  layout: 'horizontal' | 'vertical';
  onToggleLayout: () => void;
  theme: 'light' | 'dark' | 'sepia';
  onCycleTheme: () => void;
  fileName: string;
  setFileName: (name: string) => void;

  // STORAGE
  onSaveToCloud: () => void;
  onOpenFromCloud: (name: string) => void;
  cloudFileList: string[];
  onClearEditor: () => void;

  // EXCLUSÃO NA NUVEM (opcional)
  onDeleteFromCloud?: (name: string) => void;

  // Nome do kb padrão (ex.: kb[slug].md) -> não aparece na lista de exclusão
  protectedKbFileName?: string;
}

// ------------------------------------------------------------------
// TOOLBAR PRINCIPAL
// ------------------------------------------------------------------

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({
  onInsert,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSave,
  onLoad,
  onExport,
  onToggleSearch,
  layout,
  onToggleLayout,
  theme,
  onCycleTheme,
  fileName,
  setFileName,

  onSaveToCloud,
  onOpenFromCloud,
  cloudFileList,
  onClearEditor,
  onDeleteFromCloud,
  protectedKbFileName,
}) => {
  // ------------------------------------------------------------------
  // Dropdowns complexos: highlight + tamanho
  // ------------------------------------------------------------------

  const highlightOptions: DropdownItem[] = [
    {
      label: 'Amarelo',
      color: '#facc15',
      onClick: () =>
        onInsert('<mark style="background-color:#facc15;">', '</mark>', 'texto'),
    },
    {
      label: 'Vermelho',
      color: '#f87171',
      onClick: () =>
        onInsert('<mark style="background-color:#f87171;">', '</mark>', 'texto'),
    },
    {
      label: 'Verde',
      color: '#4ade80',
      onClick: () =>
        onInsert('<mark style="background-color:#4ade80;">', '</mark>', 'texto'),
    },
    {
      label: 'Azul',
      color: '#60a5fa',
      onClick: () =>
        onInsert('<mark style="background-color:#60a5fa;">', '</mark>', 'texto'),
    },
  ];

  const sizeOptions: DropdownItem[] = [
    {
      label: 'Pequeno',
      onClick: () =>
        onInsert('<span style="font-size:0.8em;">', '</span>', 'texto'),
    },
    { label: 'Normal', onClick: () => onInsert('', '', 'texto') },
    {
      label: 'Médio',
      onClick: () =>
        onInsert('<span style="font-size:1.2em;">', '</span>', 'texto'),
    },
    {
      label: 'Grande',
      onClick: () =>
        onInsert('<span style="font-size:1.5em;">', '</span>', 'texto'),
    },
  ];

  // ------------------------------------------------------------------
  // Dropdown de arquivos da nuvem (ABRIR .MD)
  // ------------------------------------------------------------------

  const cloudItems: DropdownItem[] = cloudFileList.map((name) => ({
    label: name,
    icon: <CloudDownload className="h-3 w-3 text-blue-600" />,
    onClick: () => onOpenFromCloud(name),
  }));

  // Dropdown de arquivos da nuvem para EXCLUSÃO
  const deleteItems: DropdownItem[] =
    onDeleteFromCloud
      ? cloudFileList
          .filter(
            (name) => !protectedKbFileName || name !== protectedKbFileName
          )
          .map((name) => ({
            label: name,
            icon: <Trash2 className="h-3 w-3 text-red-500" />,
            onClick: () => {
              onDeleteFromCloud(name);
            },
          }))
      : [];

  const Divider = () => (
    <div className="h-4 w-px bg-gray-300 dark:bg-gray-600 mx-2" />
  );

  // Handler para export menu (ícone principal)
  const handleExportClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // dropdown é aberto via CSS (group-hover)
  };

  // Handlers dos itens de export
  const handleExportType =
    (type: 'md' | 'pdf' | 'docx') =>
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      onExport(type);
    };

  return (
    <div className="flex flex-col gap-2 p-2 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-dark-s2">
      {/* ------------------------------------------------------------------
         Linha superior: grupos ESQUERDA / DIREITA
      ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between gap-2">
        {/* Grupo ESQUERDO */}
        <div className="flex items-center gap-2">
          {/* Nome do arquivo */}
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="bg-orange-50/80 dark:bg-slate-800/70 border border-orange-100 dark:border-slate-700 rounded-md px-3 py-1 text-sm font-medium w-56 text-gray-900 dark:text-dark-t1 placeholder:text-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition-colors"
            placeholder="Sem título.md"
          />

          <Divider />

          {/* Grupo local: Salvar / Abrir local / Export */}
          <div className="flex items-center gap-2">
            <ToolbarButton
              icon={Save}
              label="Salvar no navegador"
              onClick={onSave}
            />

            <ToolbarButton
              icon={FolderOpen}
              label="Abrir arquivo local"
              onClick={onLoad}
            />

            <div className="relative group">
              <button
                type="button"
                onClick={handleExportClick}
                className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-dark-s3"
                title="Exportar"
              >
                <Download className="h-4 w-4" />
              </button>
              <div className="absolute left-0 top-full mt-1 hidden group-hover:block bg-white dark:bg-dark-s2 shadow-lg rounded-md border border-gray-200 dark:border-white/10 z-50 min-w-[160px]">
                <button
                  type="button"
                  onClick={handleExportType('md')}
                  className="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 dark:hover:bg-dark-s3"
                >
                  Markdown (.md)
                </button>
                <button
                  type="button"
                  onClick={handleExportType('pdf')}
                  className="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 dark:hover:bg-dark-s3"
                >
                  PDF (.pdf)
                </button>
                <button
                  type="button"
                  onClick={handleExportType('docx')}
                  className="w-full text-left px-4 py-2 text-xs hover:bg-gray-100 dark:hover:bg-dark-s3"
                >
                  Word (.docx)
                </button>
              </div>
            </div>
          </div>

          <Divider />

          {/* Salvar na nuvem */}
          <ToolbarButton
            icon={CloudUpload}
            label="Salvar na nuvem (.md)"
            onClick={onSaveToCloud}
          />

          {/* Abrir da nuvem (.md) */}
          <ToolbarDropdown
            icon={CloudDownload}
            label="Abrir arquivo da nuvem"
            items={cloudItems}
          />

          <Divider />

          {/* Limpar editor (borracha) */}
          <ToolbarButton
            icon={Eraser}
            label="Limpar conteúdo do editor"
            onClick={onClearEditor}
          />

          {/* Excluir arquivo da nuvem (dropdown) */}
          {deleteItems.length > 0 && (
            <ToolbarDropdown
              icon={Trash2}
              label="Excluir arquivo da nuvem"
              items={deleteItems}
            />
          )}
        </div>

        {/* Grupo DIREITO */}
        <div className="flex items-center gap-2">
          <ToolbarButton
            icon={Undo}
            label="Desfazer"
            onClick={onUndo}
            disabled={!canUndo}
          />
          <ToolbarButton
            icon={Redo}
            label="Refazer"
            onClick={onRedo}
            disabled={!canRedo}
          />

          <Divider />

          <ToolbarButton icon={Search} label="Buscar" onClick={onToggleSearch} />

          <Divider />

          <ToolbarButton
            icon={layout === 'horizontal' ? Columns : Rows}
            label="Alternar layout"
            onClick={onToggleLayout}
          />

          <ToolbarButton
            icon={theme === 'light' ? Sun : theme === 'dark' ? Moon : Coffee}
            label="Alternar tema"
            onClick={onCycleTheme}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------
         Linha inferior: formatação de texto
      ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-1">
        <ToolbarButton
          icon={Bold}
          label="Negrito"
          onClick={() => onInsert('**', '**', 'texto')}
        />
        <ToolbarButton
          icon={Italic}
          label="Itálico"
          onClick={() => onInsert('*', '*', 'texto')}
        />
        <ToolbarButton
          icon={Underline}
          label="Sublinhado"
          onClick={() => onInsert('<u>', '</u>', 'texto')}
        />
        <ToolbarButton
          icon={Strikethrough}
          label="Tachado"
          onClick={() => onInsert('~~', '~~', 'texto')}
        />

        <Divider />

        <ToolbarDropdown
          icon={Highlighter}
          label="Destacar texto"
          items={highlightOptions}
        />
        <ToolbarDropdown
          icon={Type}
          label="Tamanho do texto"
          items={sizeOptions}
        />

        <Divider />

        <ToolbarButton
          icon={Heading1}
          label="Título 1"
          onClick={() => onInsert('\n# ', '\n', 'Título')}
        />
        <ToolbarButton
          icon={Heading2}
          label="Título 2"
          onClick={() => onInsert('\n## ', '\n', 'Título')}
        />
        <ToolbarButton
          icon={Heading3}
          label="Título 3"
          onClick={() => onInsert('\n### ', '\n', 'Título')}
        />

        <Divider />

        <ToolbarButton
          icon={List}
          label="Lista"
          onClick={() => onInsert('\n- ', '', 'Item')}
        />
        <ToolbarButton
          icon={ListOrdered}
          label="Lista ordenada"
          onClick={() => onInsert('\n1. ', '', 'Item')}
        />
        <ToolbarButton
          icon={CheckSquare}
          label="Checklist"
          onClick={() => onInsert('\n- [ ] ', '', 'Tarefa')}
        />

        <Divider />

        <ToolbarButton
          icon={Quote}
          label="Citação"
          onClick={() => onInsert('\n> ', '\n', 'citação')}
        />
        <ToolbarButton
          icon={Code}
          label="Código"
          onClick={() => onInsert('\n```\n', '\n```\n', 'código')}
        />

        <ToolbarButton
          icon={TableIcon}
          label="Tabela"
          onClick={() =>
            onInsert(
              '\n| Col 1 | Col 2 |\n|---|---|\n| Val 1 | Val 2 |\n'
            )
          }
        />

        <ToolbarButton
          icon={Minus}
          label="Linha horizontal"
          onClick={() => onInsert('\n---\n')}
        />

        <Divider />

        <ToolbarButton
          icon={LinkIcon}
          label="Link"
          onClick={() => onInsert('[', '](url)', 'texto')}
        />
        <ToolbarButton
          icon={ImageIcon}
          label="Imagem"
          onClick={() => onInsert('![', '](url)', 'alt')}
        />
        <ToolbarButton
          icon={MessageSquare}
          label="Comentário"
          onClick={() => onInsert('<!-- ', ' -->', 'comentário')}
        />
      </div>
    </div>
  );
};

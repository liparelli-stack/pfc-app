/*
-- ===================================================
-- Código             : /src/components/knowledge/KnowledgeBasePanel.tsx
-- Versão (.v20)      : 1.4.8
-- Data/Hora          : 2025-12-08 14:30
-- Autor              : FL / Execução via E.V.A. (derivado do original 1.4.3)
-- Objetivo do codigo : Base de Conhecimento (produto e cliente) no mesmo componente.
-- Fluxo              : Renderizado por KnowledgePage.tsx.
-- Alterações (1.4.8) :
--   • Removido "plate" interno branco; conteúdo usa apenas o plate principal (tema neumórfico).
--   • Mantido container scrollável interno com altura máxima (scroll no texto da KB).
--   • Mantidas todas as alterações de headings e marcador "::" das versões anteriores.
-- Notas:
--   - Se 'signedUrl' vier, usa leitura direta (bypass SDK/CORS).
--   - Se source='tenant', exige 'filename' EXATO (com subpasta se houver).
-- ===================================================
*/
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { debounce } from 'lodash-es';
import {
  getKbArticle,
  getClientKbArticle,
  getClientKbArticleBySignedUrl,
} from '@/services/knowledgeService';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Search, X } from 'lucide-react';

type Props = {
  source?: 'product' | 'tenant';
  /** Caminho EXATO no bucket kb-tenant, ex.: 'geigerscope/kbgeigerscope.md' */
  filename?: string;
  companyName?: string;
  /** Se presente, ignora bucket/path e lê direto via URL assinada */
  signedUrl?: string;
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const Highlight: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <mark className="bg-[#fff5a5] dark:bg-[#524a00]/80 text-black dark:text-white rounded px-1 transition-colors">
    {children}
  </mark>
);

const HighlightedText: React.FC<{ text: string; highlight: string }> = ({
  text,
  highlight,
}) => {
  if (!highlight) return <>{text}</>;
  const pattern = new RegExp(`(${escapeRegExp(highlight)})`, 'gi');
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <Highlight key={i}>{part}</Highlight> : <span key={i}>{part}</span>
      )}
    </>
  );
};

/** Moldura de seção (usada quando há marcador "::" em H2) */
const SectionH2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="mt-8 mb-3 text-xl font-semibold text-slate-900 dark:text-slate-50">
    <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-indigo-300/80 dark:border-indigo-400/80 shadow-sm">
      {children}
    </span>
  </h2>
);

/** Headings “normais” do artigo (H1, H2, H3, H4, H5, H6) */
const H1Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h1 className="mt-10 mb-4 text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50">
    {children}
  </h1>
);

const PlainH2Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="mt-8 mb-3 text-xl font-bold text-slate-900 dark:text-slate-50">
    {children}
  </h2>
);

const H3Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="mt-6 mb-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
    {children}
  </h3>
);

const H4Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className="mt-4 mb-1 text-base font-semibold text-slate-900 dark:text-slate-50">
    {children}
  </h4>
);

const H5Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h5 className="mt-3 mb-1 text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
    {children}
  </h5>
);

const H6Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h6 className="mt-2 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
    {children}
  </h6>
);

/** Utilitário: detecta se o texto do heading começa com "::" */
const hasFrameMarker = (children: React.ReactNode): boolean => {
  const flat = React.Children.toArray(children)
    .map((c) => (typeof c === 'string' ? c : ''))
    .join('');
  return /^\s*::\s*/.test(flat);
};

/** Remove o prefixo ":: " apenas do primeiro trecho de texto */
const stripFrameMarkerFromChildren = (
  children: React.ReactNode
): React.ReactNode => {
  let strippedFirst = false;
  return React.Children.map(children, (child) => {
    if (!strippedFirst && typeof child === 'string') {
      strippedFirst = true;
      return child.replace(/^\s*::\s*/, '');
    }
    return child;
  });
};

/** H2 que decide entre moldura (SectionH2) ou H2 simples, sem highlight */
const H2WithOptionalFrame: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  if (hasFrameMarker(children)) {
    const cleaned = stripFrameMarkerFromChildren(children);
    return <SectionH2>{cleaned}</SectionH2>;
  }
  return <PlainH2Tag>{children}</PlainH2Tag>;
};

/** H2 que decide entre moldura e H2 simples, mas com highlight aplicado */
const H2WithOptionalFrameHighlighted: React.FC<{
  children: React.ReactNode;
  highlight: string;
}> = ({ children, highlight }) => {
  const framed = hasFrameMarker(children);
  const cleaned = stripFrameMarkerFromChildren(children);

  const highlightedChildren = React.Children.map(cleaned, (child) =>
    typeof child === 'string' ? (
      <HighlightedText text={child} highlight={highlight} />
    ) : (
      child
    )
  );

  if (framed) {
    return <SectionH2>{highlightedChildren}</SectionH2>;
  }

  return <PlainH2Tag>{highlightedChildren}</PlainH2Tag>;
};

const KnowledgeBasePanel: React.FC<Props> = ({
  source = 'product',
  filename,
  companyName,
  signedUrl,
}) => {
  const [markdownContent, setMarkdownContent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carrega o conteúdo (produto ou cliente)
  useEffect(() => {
    const fetchContent = async () => {
      setIsLoading(true);
      setError(null);
      try {
        let content = '';
        if (signedUrl?.trim()) {
          content = await getClientKbArticleBySignedUrl(signedUrl.trim());
        } else if (source === 'tenant') {
          if (!filename?.trim()) {
            throw new Error('Filename obrigatório para leitura do cliente.');
          }
          content = await getClientKbArticle({ filename: filename.trim() });
        } else {
          content = await getKbArticle();
        }
        setMarkdownContent(content);
      } catch (err: any) {
        setError(
          err.message ||
            (signedUrl
              ? 'Erro ao carregar o manual do cliente (URL assinada).'
              : source === 'tenant'
              ? 'Erro ao carregar o manual do cliente.'
              : 'Erro ao carregar a base de conhecimento.')
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchContent();
  }, [source, filename, signedUrl]);

  // Debounce da busca
  const debouncedSearch = useCallback(
    debounce((t: string) => setDebouncedSearchTerm(t), 250),
    []
  );

  useEffect(() => {
    debouncedSearch(searchTerm);
    return () => debouncedSearch.cancel();
  }, [searchTerm, debouncedSearch]);

  // Componentes base (sem highlight)
  const baseComponents = useMemo(
    () => ({
      table: (p: any) => (
        <div className="overflow-x-auto">
          <table className="table-auto w-full">{p.children}</table>
        </div>
      ),
      thead: (p: any) => (
        <thead className="bg-black/5 dark:bg-white/5">{p.children}</thead>
      ),
      tr: (p: any) => (
        <tr className="border-b border-black/10 dark:border-white/10">
          {p.children}
        </tr>
      ),
      th: (p: any) => <th className="p-2 text-left font-semibold">{p.children}</th>,
      td: (p: any) => <td className="p-2 align-top">{p.children}</td>,
      a: (p: any) => <a {...p} className="prose-a:text-primary hover:underline" />,
      pre: (p: any) => (
        <pre className="rounded-xl p-3 overflow-auto bg-black/90 text-white dark:bg-white/10">
          {p.children}
        </pre>
      ),
      code: (p: any) => (
        <code className="rounded px-1 py-0.5 bg-black/5 dark:bg-white/10">
          {p.children}
        </code>
      ),
      // Headings
      h1: H1Tag,
      h2: H2WithOptionalFrame,
      h3: H3Tag,
      h4: H4Tag,
      h5: H5Tag,
      h6: H6Tag,
      // Listas com bullets/numeração, independente do reset global
      ul: (p: any) => (
        <ul className="list-disc pl-6 ml-1 space-y-1 marker:text-current">
          {p.children}
        </ul>
      ),
      ol: (p: any) => (
        <ol className="list-decimal pl-6 ml-1 space-y-1 marker:text-current">
          {p.children}
        </ol>
      ),
    }),
    []
  );

  // Componentes com suporte a highlight (para busca)
  const highlightComponents = useMemo(() => {
    if (!debouncedSearchTerm) return baseComponents;

    const withHighlight =
      (Tag: React.ComponentType<any>) =>
      (props: any) => {
        const { children, ...rest } = props;
        return (
          <Tag {...rest}>
            {React.Children.map(children, (child) =>
              typeof child === 'string' ? (
                <HighlightedText text={child} highlight={debouncedSearchTerm} />
              ) : (
                child
              )
            )}
          </Tag>
        );
      };

    return {
      ...baseComponents,
      p: withHighlight('p' as any),
      h1: withHighlight(H1Tag),
      h2: (props: any) => (
        <H2WithOptionalFrameHighlighted highlight={debouncedSearchTerm}>
          {props.children}
        </H2WithOptionalFrameHighlighted>
      ),
      h3: withHighlight(H3Tag),
      h4: withHighlight(H4Tag),
      h5: withHighlight(H5Tag),
      h6: withHighlight(H6Tag),
      li: withHighlight('li' as any),
      td: withHighlight('td' as any),
      th: withHighlight('th' as any),
      blockquote: withHighlight('blockquote' as any),
    };
  }, [debouncedSearchTerm, baseComponents]);

  // Filtro de conteúdo pela busca
  const filteredContent = useMemo(() => {
    if (!debouncedSearchTerm) return markdownContent;
    try {
      const pattern = new RegExp(
        `^.*${escapeRegExp(debouncedSearchTerm)}.*$`,
        'gim'
      );
      const matches = markdownContent.match(pattern);
      return matches ? matches.join('\n\n') : '';
    } catch {
      return '';
    }
  }, [markdownContent, debouncedSearchTerm]);

  const title =
    signedUrl || source === 'tenant'
      ? `Manual — ${companyName || 'Cliente'}`
      : 'Base de Conhecimento';

  return (
    <div className="bg-plate dark:bg-plate-dark rounded-2xl p-4 sm:p-8 neumorphic-convex">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
        {title}
      </h2>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          label=""
          placeholder={
            signedUrl || source === 'tenant'
              ? 'Buscar no manual do cliente...'
              : 'Buscar na base de conhecimento...'
          }
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-12 pr-10"
          aria-label="Buscar no documento"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-dark-shadow/50"
            aria-label="Limpar busca"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* Área scrollável da KB: usa apenas o plate principal, sem card branco interno */}
      <div
        className="
          mt-2 rounded-2xl
          max-h-[calc(100vh-260px)]
          overflow-y-auto
          pr-2
        "
      >
        <div className="prose dark:prose-invert max-w-none space-y-4 prose-p:my-3 prose-li:my-1 prose-h1:font-bold prose-h1:text-2xl prose-h3:mt-6 prose-h3:mb-2 prose-a:text-primary hover:prose-a:underline px-4 py-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-5/6" />
              <Skeleton className="h-5 w-full" />
            </div>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : filteredContent ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={highlightComponents}
            >
              {filteredContent}
            </ReactMarkdown>
          ) : (
            <p className="text-center text-gray-500 py-8">
              Nenhum resultado encontrado para "{debouncedSearchTerm}".
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBasePanel;

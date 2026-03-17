/*
-- ===================================================
-- Código             : /src/pages/KnowledgePage.tsx
-- Versão (.v20)      : 2.4.0
-- Data/Hora          : 2025-12-18 20:55
-- Autor              : FL / Execução via E.V.A.
-- Objetivo do codigo : Adicionar aba "Notas da IA" no painel Conhecimento,
--                      posicionada após a aba do cliente (ex.: Geiger Scope).
-- Fluxo              : Tabs -> Base (CRM Appy) -> Cliente (Geiger Scope) -> Notas da IA -> Editor -> Armazenamento
-- Alterações (2.4.0) :
--   • Adicionada seção 'ai-notes'
--   • Inserida aba "Notas da IA" após a aba do cliente
--   • Importado AiNotesPanel e ícone Sparkles
-- Dependências       : React, lucide-react, KnowledgeBasePanel, MarkdownEditor,
--                      KnowledgeStoragePanel, AiNotesPanel, clsx
-- ===================================================
*/

import React, { useState, useMemo } from 'react';
import {
  BookText,
  LucideIcon,
  FileEdit,
  HardDrive,
  Sparkles,
} from 'lucide-react';
import KnowledgeBasePanel from '@/components/knowledge/KnowledgeBasePanel';
import MarkdownEditor from '@/components/knowledge/MarkdownEditor';
import KnowledgeStoragePanel from '@/components/knowledge/KnowledgeStoragePanel';
import AiNotesPanel from '@/components/knowledge/AiNotesPanel';
import clsx from 'clsx';

type Section = 'base' | 'cliente' | 'ai-notes' | 'editor' | 'storage';

interface TabItemProps {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const TabItem: React.FC<TabItemProps> = ({
  icon: Icon,
  label,
  isActive,
  onClick,
}) => (
  <button
    role="tab"
    aria-selected={isActive}
    onClick={onClick}
    className={clsx(
      'flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200',
      {
        'neumorphic-concave text-primary': isActive,
        'neumorphic-convex hover:neumorphic-concave hover:text-primary':
          !isActive,
      }
    )}
  >
    <Icon className="h-5 w-5" />
    <span className="font-semibold">{label}</span>
  </button>
);

const KnowledgePage: React.FC = () => {
  // Mantido default em 'editor' conforme versão anterior
  const [activeSection, setActiveSection] = useState<Section>('editor');

  // ⚠️ MOCK atual: nome amigável do tenant (exibido na aba)
  // TODO: Substituir por fonte única de tenant ligada ao usuário (org_tenants).
  const companyName = 'Geiger Scope';

  const { clientKbFilename, tenantSlug } = useMemo(() => {
    const slug = companyName.toLowerCase().replace(/\s+/g, '');
    return {
      tenantSlug: slug,
      clientKbFilename: `${slug}/kb${slug}.md`,
    };
  }, [companyName]);

  const sections: {
    id: Section;
    label: string;
    icon: LucideIcon;
    node: React.ReactNode;
  }[] = [
    {
      id: 'base',
      label: 'CRM Appy',
      icon: BookText,
      node: <KnowledgeBasePanel source="product" />,
    },
    {
      id: 'cliente',
      label: companyName, // ex.: Geiger Scope
      icon: BookText,
      node: (
        <KnowledgeBasePanel
          source="tenant"
          companyName={companyName}
          filename={clientKbFilename}
        />
      ),
    },

    // ✅ NOVA ABA: inserida logo após o cliente (ex.: após Geiger Scope)
    {
      id: 'ai-notes',
      label: 'Notas da IA',
      icon: Sparkles,
      node: <AiNotesPanel />,
    },

    {
      id: 'editor',
      label: 'Editor MD Appy',
      icon: FileEdit,
      // 🔑 Editor agora recebe o mesmo tenantSlug usado pelo Storage Panel
      node: <MarkdownEditor tenantSlug={tenantSlug} />,
    },
    {
      id: 'storage',
      label: 'Armazenamento',
      icon: HardDrive,
      node: <KnowledgeStoragePanel tenantSlug={tenantSlug} />,
    },
  ];

  const active = sections.find((s) => s.id === activeSection);

  return (
    <div className="flex flex-col w-full h-full">
      {/* Navegação por Abas Horizontais */}
      <div
        role="tablist"
        className="flex flex-wrap items-center gap-2 p-2 neumorphic-convex rounded-2xl mb-6 flex-shrink-0"
      >
        {sections.map((section) => (
          <TabItem
            key={section.id}
            icon={section.icon}
            label={section.label}
            isActive={activeSection === section.id}
            onClick={() => setActiveSection(section.id)}
          />
        ))}
      </div>

      {/* Conteúdo Principal - scroll externo (viewport central) */}
      <main className="flex-1 min-h-0 overflow-y-auto">{active?.node}</main>
    </div>
  );
};

export default KnowledgePage;

/*
-- ===================================================
-- Código: /src/pages/CatalogsPage.tsx
-- Versão: 3.0.0
-- Data/Hora: 2025-11-28 12:30
-- Autor: FL / Execução via você EVA
-- Objetivo: Reorganizar a página de Catálogos para usar um sistema de abas horizontais.
-- Fluxo: O layout foi alterado de um menu lateral para uma barra de abas no topo.
-- Dependências: React, lucide-react, componentes de catálogo, clsx.
-- ===================================================
*/
import React, { useState } from 'react';
import { BookCopy, Building, List, LucideIcon, Tags } from 'lucide-react';
import ChannelsSettings from '@/components/catalogs/ChannelsSettings';
import CompaniesSettings from '@/components/catalogs/CompaniesSettings';
import CompanyList from '@/components/catalogs/CompanyList';
import TagsManager from '@/components/catalogs/TagsManager';
import clsx from 'clsx';

type Section = 'companies' | 'list' | 'tags' | 'channels';

interface TabItemProps {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const TabItem: React.FC<TabItemProps> = ({ icon: Icon, label, isActive, onClick }) => (
  <button
    role="tab"
    aria-selected={isActive}
    onClick={onClick}
    className={clsx(
      'flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200',
      {
        'neumorphic-concave text-primary': isActive,
        'neumorphic-convex hover:neumorphic-concave hover:text-primary': !isActive,
      }
    )}
  >
    <Icon className="h-5 w-5" />
    <span className="font-semibold">{label}</span>
  </button>
);

interface CatalogsPageProps {
  defaultSection?: Section;
}

const CatalogsPage: React.FC<CatalogsPageProps> = ({ defaultSection = 'companies' }) => {
  const [activeSection, setActiveSection] = useState<Section>(defaultSection);
  const [remountKey, setRemountKey] = useState(0);

  const sections: { id: Section; label: string; icon: LucideIcon; node: React.ReactNode }[] = [
    { id: 'companies', label: 'Cadastro de Empresas', icon: Building, node: <CompaniesSettings /> },
    { id: 'list', label: 'Listagem de Empresas', icon: List, node: <CompanyList /> },
    { id: 'tags', label: 'Gerenciador de Etiquetas', icon: Tags, node: <TagsManager /> },
    { id: 'channels', label: 'Canais de Comunicação', icon: BookCopy, node: <ChannelsSettings /> },
  ];

  const handleSectionClick = (sectionId: Section) => {
    setActiveSection(sectionId);
    setRemountKey(prevKey => prevKey + 1);
  };

  const active = sections.find(s => s.id === activeSection);

  return (
    <div className="flex flex-col w-full">
      {/* Navegação por Abas Horizontais */}
      <div role="tablist" className="flex flex-wrap items-center gap-2 p-2 neumorphic-convex rounded-2xl mb-6">
        {sections.map(section => (
          <TabItem
            key={section.id}
            icon={section.icon}
            label={section.label}
            isActive={activeSection === section.id}
            onClick={() => handleSectionClick(section.id)}
          />
        ))}
      </div>

      {/* Conteúdo Principal */}
      <main className="flex-1 min-w-0">
        <div key={`${activeSection}-${remountKey}`}>
          {active?.node}
        </div>
      </main>
    </div>
  );
};

export default CatalogsPage;

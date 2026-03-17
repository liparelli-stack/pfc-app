/*
-- ===================================================
-- Código             : /src/pages/SettingsPage.tsx
-- Versão (.v20)      : 4.3.0
-- Data/Hora          : 2025-12-04 17:10
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Página de Configurações com navegação por abas
--                      horizontais (Pessoas | Organização | Exportação de Tabelas | Backup | Chaves & IA).
-- Fluxo              : SettingsPage ->
--                        • PeopleSettings
--                        • OrganizationSettings
--                        • ExportTablesSettings
--                        • BackupSettings
--                        • IntegrationKeysSettings
-- Alterações (4.3.0) :
--   • [NOVO] Adicionada aba "Backup" após "Exportação de Tabelas".
--   • [NOVO] Importado componente BackupSettings.
-- Dependências       : React, lucide-react, clsx,
--                      PeopleSettings, OrganizationSettings,
--                      ExportTablesSettings, BackupSettings, IntegrationKeysSettings.
-- ===================================================
*/

import { useState } from "react";
import {
  Building2,
  Users,
  LucideIcon,
  Table as TableIcon,
  KeyRound,
  HardDrive,
} from "lucide-react";
import { OrganizationSettings } from "../components/settings/OrganizationSettings";
import PeopleSettings from "../components/settings/PeopleSettings";
import ExportTablesSettings from "../components/settings/ExportTablesSettings";
import IntegrationKeysSettings from "../components/settings/IntegrationKeysSettings";
import BackupSettings from "../components/settings/BackupSettings";
import clsx from "clsx";

type Section =
  | "people"
  | "organization"
  | "export_tables"
  | "backup"
  | "integration_keys";

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
      "flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all duration-200",
      {
        "neumorphic-concave text-primary": isActive,
        "neumorphic-convex hover:neumorphic-concave hover:text-primary":
          !isActive,
      }
    )}
  >
    <Icon className="h-5 w-5" />
    <span className="font-semibold">{label}</span>
  </button>
);

export const SettingsPage = () => {
  const [activeSection, setActiveSection] = useState<Section>("people");

  const sections: {
    id: Section;
    label: string;
    icon: LucideIcon;
    component: JSX.Element;
  }[] = [
    { id: "people", label: "Pessoas", icon: Users, component: <PeopleSettings /> },
    {
      id: "organization",
      label: "Organização",
      icon: Building2,
      component: <OrganizationSettings />,
    },
    {
      id: "export_tables",
      label: "Exportação de Tabelas",
      icon: TableIcon,
      component: <ExportTablesSettings />,
    },
    {
      id: "backup",
      label: "Backup",
      icon: HardDrive,
      component: <BackupSettings />,
    },
    {
      id: "integration_keys",
      label: "Chaves & IA",
      icon: KeyRound,
      component: <IntegrationKeysSettings />,
    },
  ];

  const activeComponent = sections.find((s) => s.id === activeSection)?.component;

  return (
    <div className="flex flex-col w-full">
      {/* Navegação por Abas Horizontais */}
      <div
        role="tablist"
        className="flex flex-wrap items-center gap-2 p-2 neumorphic-convex rounded-2xl mb-6"
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

      {/* Área de Conteúdo Principal */}
      <main className="flex-1 min-w-0">{activeComponent}</main>
    </div>
  );
};

export default SettingsPage;

/*
-- ===================================================
-- Código             : src/pages/HubGestaoPage.tsx
-- Versão (.v20)      : 1.0.0
-- Data/Hora          : 2026-03-24 19:00 America/Sao_Paulo
-- Autor              : FL / Execução via (Eva Claude Modelo) (Alpha Dualite modelo LLM)
-- Objetivo do codigo : Hub de Gestão — container de abas horizontais.
--                      [1.0.0] Primeira aba: Fechamento Mensal (SUP-000004).
--                      Padrão de abas idêntico ao CatalogsPage.tsx.
-- Dependências       : MonthlyClosurePage, lucide-react, clsx
-- ===================================================
*/

import React, { useState } from 'react';
import { CalendarCheck, Target, LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import MonthlyClosurePage from './MonthlyClosurePage';
import SalesTargetsPage from './SalesTargetsPage';

/* ============================================================
   Tipos
   ============================================================ */
type Section = 'monthly-closure' | 'sales-targets';

interface TabItemProps {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

/* ============================================================
   TabItem — mesmo padrão visual de CatalogsPage
   ============================================================ */
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

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
const HubGestaoPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>('monthly-closure');

  const sections: { id: Section; label: string; icon: LucideIcon; node: React.ReactNode }[] = [
    {
      id: 'monthly-closure',
      label: 'Fechamento Mensal',
      icon: CalendarCheck,
      node: <MonthlyClosurePage />,
    },
    {
      id: 'sales-targets',
      label: 'Metas Mensais',
      icon: Target,
      node: <SalesTargetsPage />,
    },
  ];

  const active = sections.find((s) => s.id === activeSection);

  return (
    <div className="flex flex-col w-full">
      {/* Barra de abas */}
      <div role="tablist" className="flex flex-wrap items-center gap-2 p-2 neumorphic-convex rounded-2xl mb-6">
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

      {/* Conteúdo */}
      <main className="flex-1 min-w-0">
        <div key={activeSection}>
          {active?.node}
        </div>
      </main>
    </div>
  );
};

export default HubGestaoPage;

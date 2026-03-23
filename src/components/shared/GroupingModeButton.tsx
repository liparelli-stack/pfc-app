/*
-- ===================================================
-- Código             : /src/components/shared/GroupingModeButton.tsx
-- Versão (.v20)      : 1.1.0
-- Data/Hora          : 2025-11-30 12:30 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do código : Fornecer um botão reutilizável para controlar modos de agrupamento
--                      (Sem agrupar, Data, Empresa, Empresa/Data, Data/Empresa) em listas/tabelas.
-- Fluxo              : Usado em ConversationHistoryCard e outros componentes que precisem de agrupamento.
-- Alterações (1.1.0) :
--   • [UI] Adicionado `w-full` e `justify-between` para garantir que o botão preencha
--     o container pai de tamanho fixo e distribua o conteúdo corretamente.
-- Dependências       : react, clsx, @/components/ui/Button
-- ===================================================
*/

import React from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";

export type GroupMode =
  | "none"
  | "date"
  | "company"
  | "company_date"
  | "date_company";

const GROUP_MODE_SEQUENCE: GroupMode[] = [
  "none",
  "date",
  "company",
  "company_date",
  "date_company",
];

const GROUP_MODE_LABEL: Record<GroupMode, string> = {
  none: "Agrupamento",
  date: "Data",
  company: "Empresa",
  company_date: "Empresa / Data",
  date_company: "Data / Empresa",
};

type Props = {
  mode: GroupMode;
  onModeChange: (next: GroupMode) => void;
};

const GroupingModeButton: React.FC<Props> = ({ mode, onModeChange }) => {
  const isActive = mode !== "none";

  const handleClick = () => {
    const idx = GROUP_MODE_SEQUENCE.indexOf(mode);
    const next =
      GROUP_MODE_SEQUENCE[(idx + 1) % GROUP_MODE_SEQUENCE.length] ?? "none";
    onModeChange(next);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={isActive}
      title="Alternar modo de agrupamento"
      className="h-9 px-3 text-sm font-medium w-full flex items-center justify-between cursor-pointer transition-colors"
      style={isActive ? {
        backgroundColor: '#3b68f5',
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
      } : {
        backgroundColor: 'transparent',
        border: '0.5px solid rgba(59,42,20,0.15)',
        color: '#9a7d5a',
        borderRadius: '8px',
      }}
    >
      <span className="text-xs">&lt;</span>
      <span>{GROUP_MODE_LABEL[mode]}</span>
      <span className="text-xs">&gt;</span>
    </button>
  );
};

export default GroupingModeButton;

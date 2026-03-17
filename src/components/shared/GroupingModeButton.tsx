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
    <Button
      type="button"
      variant="default"
      className={clsx(
        "h-9 px-3 text-sm font-medium w-full justify-between",
        "border border-dark-shadow/40 dark:border-dark-dark-shadow/40",
        "bg-plate dark:bg-plate-dark",
        isActive && "bg-primary text-white shadow-md border-transparent"
      )}
      onClick={handleClick}
      aria-pressed={isActive}
      title="Alternar modo de agrupamento"
    >
      <span className="text-xs">&lt;</span>
      <span>{GROUP_MODE_LABEL[mode]}</span>
      <span className="text-xs">&gt;</span>
    </Button>
  );
};

export default GroupingModeButton;

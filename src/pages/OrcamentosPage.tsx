/*
  Código             : /src/pages/OrcamentosPage.tsx
  Versão (.v20)      : 0.2.1
  Data/Hora          : 2025-11-18 01:30
  Autor              : FL / Execução via você EVA
  Objetivo do codigo : Página de Orçamentos, renderizando o Kanban de Orçamentos com menu horizontal.
  Fluxo              : Router -> OrcamentosPage -> BudgetsKanban
  Alterações (0.2.1) :
    • [RENAME] Alterado cabeçalho de "Kanban de Orçamentos" para "Negócios".
  Dependências       : BudgetsKanban, lucide-react
*/

import React from 'react';
import { ClipboardList } from 'lucide-react';
import BudgetsKanban from '@/components/budgets/BudgetsKanban';

const OrcamentosPage: React.FC = () => {
  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Menu horizontal - único item ativo "Negócios" */}
      <nav className="neumorphic-convex rounded-2xl p-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg neumorphic-concave text-primary"
            aria-current="page"
          >
            <ClipboardList className="h-5 w-5" />
            <span className="font-semibold">Orçamentos</span>
          </button>
        </div>
      </nav>

      {/* Conteúdo principal: Kanban de Orçamentos */}
      <div className="flex-1 min-h-0">
        <BudgetsKanban />
      </div>
    </div>
  );
};

export default OrcamentosPage;

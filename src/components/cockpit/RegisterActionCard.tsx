/*
-- ===================================================
-- Código             : /src/components/cockpit/RegisterActionCard.tsx
-- Versão (.v20)      : 3.2.1
-- Data/Hora          : 2025-12-02 20:05 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Unificar o formulário de "Registrar Ação" ao de "Editar Ação",
--                      reutilizando o EditActionForm em modo criação (editingChat=null),
--                      garantindo identidade visual/funcional e eliminando duplicações.
--                      [3.1.0] Adiciona ícone de IA no canto superior do card.
--                      [3.2.0] Amarra o ícone ao gatilho de análise com IA
--                      (passando trigger numérico para o EditActionForm).
--                      [3.2.1] Ajuste de UX: não dispara análise automática na
--                      montagem do formulário; só após clique explícito no ícone.
-- Fluxo              : CockpitPage → companyDetails → RegisterActionCard → EditActionForm
-- Alterações (3.0.0) :
--  • Substitui o form proprietário por <EditActionForm /> (edição/validações idênticas).
--  • Repasse de companyDetails (inclui contacts) para dropdown completo.
--  • onSaved: dispara eventos globais + callback externo opcional.
--  • onCancel: apenas reseta via remount controlado por key.
-- Alterações (3.1.0) :
--  • [UX] Inclusão de ícone circular (Sparkles) no canto superior do card,
--    espelhando o card de Métricas Gerais.
-- Alterações (3.2.0) :
--  • [IA] Clique no ícone passa um trigger incremental (aiTrigger) ao EditActionForm,
--    que executa a análise da ação/conversa com IA.
-- Alterações (3.2.1) :
--  • [IA/UX] aiTrigger inicia como undefined para evitar execução automática no
--    primeiro render; a IA só roda após o usuário clicar no ícone.
-- Dependências        : react, lucide-react, @/types/cockpit, ./EditActionForm,
--                       @/components/ui/Skeleton (opcional)
-- ===================================================
*/

import React, { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import type { CompanyDetails } from "@/types/cockpit";
import EditActionForm from "./EditActionForm";

interface RegisterActionCardProps {
  /** Detalhes da empresa corrente (deve conter contacts para popular o dropdown) */
  companyDetails: CompanyDetails | null;
  /** Callback opcional para forçar refresh externo (ex.: recarregar histórico/painéis) */
  onSaved?: () => void;
  /** Título do card (permite customização visual sem alterar o form) */
  title?: string;
}

const RegisterActionCard: React.FC<RegisterActionCardProps> = ({
  companyDetails,
  onSaved,
  title = "Registrar Ação",
}) => {
  // Remonta o formulário quando trocar a empresa ou quando solicitado via "Cancelar"
  const [remountSeed, setRemountSeed] = useState(0);
  // Remonta ao trocar de empresa (id muda) ou ao cancelar/salvar (remountSeed muda).
  // Não inclui contacts.length: novo contato atualiza o dropdown via prop sem remontagem,
  // evitando que o usuário perca dados digitados no formulário.
  const formKey = useMemo(
    () => `${companyDetails?.id ?? "na"}-${remountSeed}`,
    [companyDetails?.id, remountSeed]
  );

  // Gatilho de análise de IA: começa como undefined para NÃO disparar no mount
  const [aiTrigger, setAiTrigger] = useState<number | undefined>(undefined);

  const handleSaved = () => {
    // Eventos globais já são disparados pelo EditActionForm, mas reforçamos aqui por simetria.
    try {
      window.dispatchEvent(new CustomEvent("cockpit:refreshHistory"));
      window.dispatchEvent(new CustomEvent("chats:changed"));
    } catch {}
    onSaved?.();
    // Após salvar, cria uma nova instância "limpa" do form.
    setRemountSeed((s) => s + 1);
    // Também limpa o gatilho de IA para o próximo ciclo de uso.
    setAiTrigger(undefined);
  };

  const handleCancel = () => {
    // Para o card inline não há modal a fechar; apenas limpamos o formulário.
    setRemountSeed((s) => s + 1);
    // Reseta o gatilho de IA ao cancelar.
    setAiTrigger(undefined);
  };

  const handleAiClick = () => {
    // Agora o primeiro clique gera o primeiro valor numérico (0 → 1, etc.)
    setAiTrigger((prev) => (prev ?? 0) + 1);
  };

  return (
    <section className="bg-plate dark:bg-dark-s1 rounded-2xl p-6 neumorphic-convex relative">
      {/* Cabeçalho: título + ícone IA (mesma posição visual do card de Métricas Gerais) */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800 dark:text-dark-t1">
          {title}
        </h3>

        {/* Ícone circular – clique dispara a análise de IA */}
        <div
          onClick={handleAiClick}
          title="Analisar esta ação com IA"
          aria-label="Analisar esta ação com IA"
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
          style={{
            backgroundColor: '#3b68f5',
            color: '#ffffff',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            opacity: 1,
          }}
        >
          <Sparkles className="h-4 w-4" />
        </div>
      </div>

      {/* Reutiliza exatamente o mesmo formulário de edição, em modo criação */}
      <div key={formKey}>
        <EditActionForm
          companyDetails={companyDetails ?? ({ id: "", contacts: [] } as any)}
          editingChat={null} // ← modo criação
          onSaved={handleSaved}
          onCancel={handleCancel}
          aiTrigger={aiTrigger}
        />
      </div>
    </section>
  );
};

export default RegisterActionCard;

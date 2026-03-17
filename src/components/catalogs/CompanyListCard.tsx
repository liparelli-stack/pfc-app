/*
-- ===================================================
-- Código             : /src/components/catalogs/CompanyListCard.tsx
-- Versão (.v17)      : 2.2.0
-- Data/Hora          : 2025-11-22 10:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Corrigir a sobreposição dos cards de contato sobre o plate da empresa.
-- Alterações (2.2.0) :
--  • Removida a margem negativa (-mt-6) que causava a sobreposição.
--  • Adicionado um espaçamento positivo (mt-4) para uma separação limpa.
-- Dependências          : react, clsx, @/types/company, @/types/contact,
--                         @/components/shared/CompanyPlate, @/components/shared/ContactMiniCard
-- ===================================================
*/

import React from "react";
import clsx from "clsx";
import type { CompanyWithContacts } from "@/types/company";
import type { Contact } from "@/types/contact";
import CompanyPlate from "@/components/shared/CompanyPlate";
import ContactMiniCard from "@/components/shared/ContactMiniCard";

type Props = {
  company: CompanyWithContacts;
  onClickCompany?: () => void;
};

const CompanyListCard: React.FC<Props> = ({ company, onClickCompany }) => {
  const contacts: Contact[] = company?.contacts ?? [];

  return (
    <section className={clsx("relative max-w-6xl mx-auto")} aria-label={`Empresa: ${company?.trade_name ?? ""}`}>
      {/* Plate da empresa */}
      <CompanyPlate company={company as any} onClickCompany={onClickCompany} />

      {/* Contatos: agora com espaçamento para evitar sobreposição */}
      <div className={clsx("relative grid grid-cols-1 gap-4 mt-4 pb-4")}>
        {contacts.length > 0 ? (
          contacts.map((c) => <ContactMiniCard key={c.id} contact={c} />)
        ) : (
          <div className="col-span-full text-center text-sm text-gray-500 py-6">
            Nenhum contato cadastrado para esta empresa.
          </div>
        )}
      </div>
    </section>
  );
};

export default CompanyListCard;

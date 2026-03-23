/*
-- ===================================================
-- Código             : /src/components/shared/CompanyPlate.tsx
-- Versão (.v17)      : 1.2.0
-- Data/Hora          : 2025-11-30 19:05 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Plate completo da empresa (Visão 360) para reutilização na Listagem de Empresas.
-- Fluxo              : CompanyPlate -> cards de contato (ContactMiniCard) "flutuando" sobre o plate.
-- Alterações (1.2.0) :
--  • Dono: passa a exibir owner_name (profiles.full_name) quando disponível,
--    com fallback para owner (auth_user_id) para compatibilidade.
--  • Tipagem interna estendida: CompanyWithOwnerName = Company & { owner_name?: string | null }.
-- Dependências          : react, clsx, lucide-react, @/types/company
-- ===================================================
*/

import React from "react";
import type { Company } from "@/types/company";
import { Building, Mail, Phone, Globe, MapPin, User, Star, CalendarClock, Info } from "lucide-react";
import clsx from "clsx";

/**
 * Tipo local que estende Company com owner_name opcional,
 * usado para consumir o payload enriquecido vindo de companiesService.
 */
type CompanyWithOwnerName = Company & {
  owner_name?: string | null;
};

type CompanyPlateProps = {
  company: CompanyWithOwnerName;
  onClickCompany?: () => void; // opcional: abrir Cockpit
};

/* ================================= Helpers ================================= */

const ensureHttp = (value?: string | null) => {
  if (!value) return "";
  const v = value.trim();
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};

const joinAddress = (c: CompanyWithOwnerName) => {
  const parts = [c.address_line, [c.city, c.state].filter(Boolean).join(", "), c.zip_code]
    .filter(Boolean)
    .join(", ");
  return parts || null;
};

const formatDatePtBR = (iso?: string | null) => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
};

const StatusDot: React.FC<{ active?: boolean; titleActive?: string; titleInactive?: string }> = ({
  active,
  titleActive = "Ativa",
  titleInactive = "Inativa",
}) => (
  <span
    className={clsx(
      "inline-block h-2.5 w-2.5 rounded-full",
      active ? "bg-green-500" : "bg-gray-400"
    )}
    title={active ? titleActive : titleInactive}
    aria-label={active ? titleActive : titleInactive}
  />
);

const InfoItem: React.FC<{
  icon: React.ElementType;
  label?: string;
  value?: string | null;
  href?: string;
}> = ({ icon: Icon, label, value, href }) => {
  if (!value) return null;
  const content = (
    <span className="inline-flex items-center gap-2 text-sm leading-tight text-gray-700 dark:text-dark-t1">
      <Icon className="h-4 w-4 text-gray-500 flex-shrink-0" />
      {label && <span className="font-medium">{label}:</span>}
      <span>{value}</span>
    </span>
  );
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="hover:underline"
      title={value}
    >
      {content}
    </a>
  ) : (
    content
  );
};

/* =============================== Component ================================ */

const CompanyPlate: React.FC<CompanyPlateProps> = ({ company, onClickCompany }) => {
  const {
    trade_name,
    legal_name,
    phone,
    email,
    website,
    tax_id,
    owner,
    owner_name,
    status, // 'active' | 'inactive' (enum no schema)
    qualification, // nota numérica (0..5)
    segment,
    source_company,
    created_at,
    updated_at,
  } = company as CompanyWithOwnerName;

  const addressFull = joinAddress(company);
  const rating = Math.max(0, Math.min(5, Number(qualification ?? 0)));

  // Prioriza o nome amigável; fallback para o valor bruto de owner (auth_user_id) se necessário.
  const ownerDisplay: string | null = owner_name?.toString().trim()
    ? owner_name!
    : owner?.toString().trim() || null;

  return (
    <div className="bg-plate dark:bg-dark-s1 rounded-2xl p-6 neumorphic-convex space-y-4">
      {/* Header: Nome + status + rating */}
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Building className="h-7 w-7 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2
                className={clsx(
                  "text-2xl font-bold text-gray-800 dark:text-dark-t1 truncate",
                  onClickCompany && "cursor-pointer hover:opacity-90"
                )}
                onClick={onClickCompany}
                title={trade_name}
              >
                {trade_name}
              </h2>
              {/* Status da empresa */}
              <StatusDot active={status === "active"} />
            </div>
            {legal_name && (
              <p className="text-sm text-gray-500 truncate" title={legal_name}>
                {legal_name}
              </p>
            )}
          </div>
        </div>

        {/* Rating (★) + Nota */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1" aria-label={`Rating ${rating} de 5`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={clsx(
                  "h-5 w-5",
                  i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300 dark:text-dark-t3"
                )}
              />
            ))}
          </div>
          <span className="text-sm text-gray-600 dark:text-dark-t1" title="Nota numérica">
            {`Nota: ${rating}/5`}
          </span>
        </div>
      </header>

      {/* Informações principais (grid compacto) */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
        <InfoItem icon={Phone} label="Telefone" value={phone || undefined} />
        <InfoItem icon={Mail} label="E-mail" value={email || undefined} href={email ? `mailto:${email}` : undefined} />
        <InfoItem icon={Globe} label="Website" value={website || undefined} href={ensureHttp(website)} />
        <InfoItem icon={MapPin} label="Endereço" value={addressFull || undefined} />
        <InfoItem icon={User} label="CNPJ" value={tax_id || undefined} />
        <InfoItem icon={User} label="Dono" value={ownerDisplay || undefined} />
        <InfoItem icon={Info} label="Segmento" value={segment || undefined} />
        <InfoItem icon={Info} label="Origem" value={source_company || undefined} />
      </section>

      {/* Linha divisória */}
      <div className="border-t border-dark-shadow/40 dark:border-dark-dark-shadow/40"></div>

      {/* Auditoria temporal */}
      <footer className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-gray-600 dark:text-dark-t2">
        <span className="inline-flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          <span>
            Criado em <strong>{formatDatePtBR(created_at) ?? "-"}</strong>
          </span>
        </span>
        <span className="inline-flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          <span>
            Atualizado em <strong>{formatDatePtBR(updated_at) ?? "-"}</strong>
          </span>
        </span>
      </footer>
    </div>
  );
};

export default CompanyPlate;

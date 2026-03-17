/*
-- ===================================================
-- Código             : /src/types/cockpit.ts
-- Versão (.v17)      : 1.2.0
-- Data/Hora          : 2025-10-29 18:00 America/Sao_Paulo
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Tipos usados no Cockpit (lista, detalhes e busca).
-- Fluxo              : cockpitService -> CockpitPage -> componentes (CompanyDetailsCard, etc.)
-- Alterações (1.2.0) :
--   • [ADITIVO] Incluído tipo leve CompanyMinimal { id, trade_name } para a busca de empresas sem ações ativas.
--   • Nenhuma alteração nos tipos existentes (CompanyWithActionCount, CompanyDetails).
-- Dependências       : ./company, ./contact, ./channel
-- ===================================================
*/

import { Company } from './company';
import { Contact } from './contact';
import { ContactChannel } from './channel';

/**
 * [--TIPO--] Representa uma empresa na lista da barra lateral do Cockpit.
 * Inclui o nome da empresa, ID e a contagem de ações ativas (chats não concluídos).
 */
export interface CompanyWithActionCount {
  id: string;
  trade_name: string;
  action_count: number;
}

/**
 * [--TIPO--] Representa um contato com seus canais aninhados.
 * Usado dentro de CompanyDetails.
 */
export interface ContactWithChannels extends Omit<Contact, 'channels'> {
  channels: ContactChannel[];
}

/**
 * [--TIPO--] Representa os detalhes completos de uma empresa para exibição no Cockpit.
 * Inclui os dados da empresa e uma lista de seus contatos, cada um com seus canais.
 */
export interface CompanyDetails extends Company {
  contacts: ContactWithChannels[];
}

/**
 * [--TIPO--] Minimalista para buscas de empresa (sem acoplamento a contagens).
 * Usado por listCompaniesWithoutActiveActions(query).
 */
export interface CompanyMinimal {
  id: string;
  trade_name: string;
}

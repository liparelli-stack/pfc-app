/*
================================================================================
Código: /src/types/channel.ts
Versão: 1.2.1
Data/Hora: 2025-10-14 11:40 -03
Autor: FL / Eva (E.V.A.)
Objetivo: Tipos e constantes para canais de contato (derivados de contacts_channel).
Fluxo: Usado por services, schemas e componentes de UI.
Notas:
  - Alinhado à view `public.view_contacts_clean` e à tabela `contacts_channel`.
  - Removidos: guard (papel do contato), active, label.code.
  - Novo: label_custom (texto livre) e is_preferred (boolean).
  - Compat: ChannelItem/ChannelsArray como aliases.
================================================================================
*/

/* Tipos base */
export type ChannelType = 'email' | 'phone' | 'messaging' | 'link' | 'other';
export type ExportState = 'Create' | 'Update' | 'Restored' | 'Backedup' | string;

/* -----------------------------------------------------------------------------
   Estrutura de cada canal (VIEW JSON -> contacts_channel)
   ----------------------------------------------------------------------------- */
export interface ContactChannel {
  id: string;
  type: ChannelType;            // 'email' | 'phone' | 'messaging' | 'link' | 'other'
  value: string;                // e-mail, número, URL, @handle, etc.
  label_custom?: string | null; // 'Pessoal', 'Comercial', 'Mesa dele', etc.
  is_preferred: boolean;        // VIEW garante boolean (COALESCE false)
  notes?: string | null;
  verified_at?: string | null;
  created_at: string;
  updated_at: string;
  export_state: ExportState;

  // Campos relacionais opcionais quando a consulta é direta na tabela
  tenant_id?: string;
  contact_id?: string;
}

/* -----------------------------------------------------------------------------
   Compatibilidade com versões anteriores
   ----------------------------------------------------------------------------- */

/** @deprecated Use `ContactChannel`. Mantido apenas para compatibilidade. */
export type ChannelItem = ContactChannel;

/** @deprecated Use `ContactChannel[]`. Mantido apenas para compatibilidade. */
export type ChannelsArray = ContactChannel[];

/* -----------------------------------------------------------
   Constantes para UI
   ----------------------------------------------------------- */

/** Opções visíveis no Select de "Tipo de Canal" */
export const CHANNEL_TYPES: { value: ChannelType; label: string }[] = [
  { value: 'email',     label: 'E-mail' },
  { value: 'phone',     label: 'Telefone' },
  { value: 'messaging', label: 'Mensageria' },
  { value: 'link',      label: 'Link / Página' },
  { value: 'other',     label: 'Outro' },
];

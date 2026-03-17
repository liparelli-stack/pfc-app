/*
================================================================================
Código: /src/services/channelsService.ts
Versão: 1.2.0
Data/Hora: 2025-10-12 17:25
Autor: FL / Execução via você "AD"
Objetivo: Tornar o reset efetivo sem depender de RPC (realiza updates diretos),
          manter ordenação estável por 'kind', preservar RLS e evitar flicker.
Fluxo: Chamado pela UI (ChannelsSettings) para CRUD.
Dependências: @/lib/supabaseClient, @/types/channel
Regras/Notas:
  - [REGRA] Ordenação estável por 'kind' evita reordenação na UI.
  - [REGRA] Reset idempotente: seta valores padrão para todos os registros do tenant.
  - [NOTA] Evita qualquer integração com Auth (Diretriz 1).
  - [NOTA] Não introduz requisitos extras além do plano Free (Diretriz 2).
================================================================================
*/

import { supabase } from '@/lib/supabaseClient';
import type { Channel } from '@/types/channel';

/**
 * [--FUNÇÃO--] Lista todos os canais para o tenant corrente (RLS no backend).
 * Ordena por 'kind' para manter posição estável na UI.
 */
export const listChannels = async (): Promise<Channel[]> => {
  const { data, error } = await supabase
    .from('channels')
    .select('*')
    .order('kind', { ascending: true })     // [--REGRA--] ordem estável
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching channels:', error);
    throw error;
  }

  return data || [];
};

/**
 * [--FUNÇÃO--] Atualiza um canal específico.
 * @param id - ID do canal a ser atualizado.
 * @param updates - Campos a atualizar (is_enabled, label_custom).
 */
export const updateChannel = async (
  id: string,
  updates: Partial<Pick<Channel, 'is_enabled' | 'label_custom'>>
): Promise<Channel> => {
  const { data, error } = await supabase
    .from('channels')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating channel:', error);
    throw error;
  }

  return data;
};

/**
 * [--FUNÇÃO--] Reseta os canais do tenant para o estado padrão (sem RPC).
 * [--REGRA--] Padrões:
 *   - is_enabled = true para todos
 *   - label_custom = '' (string vazia) quando kind = 'other'; null para demais
 *   - updated_at atualizado pelo trigger do banco (se houver) ou pelo update
 *
 * [--TÉCNICA--] Executa duas operações idempotentes sob RLS:
 *   1) Atualiza is_enabled = true e label_custom = null para todos os kinds ≠ 'other'
 *   2) Atualiza is_enabled = true e label_custom = '' para kind = 'other'
 */
export const resetChannels = async (): Promise<void> => {
  // 1) Reset para todos os canais que NÃO são 'other'
  const updateNonOther = await supabase
    .from('channels')
    .update({
      is_enabled: true,
      // @ts-expect-error: label_custom pode ser null no schema
      label_custom: null,
    })
    .neq('kind', 'other');

  if (updateNonOther.error) {
    console.error('Error resetting non-other channels:', updateNonOther.error);
    throw updateNonOther.error;
  }

 // 2) Reset específico para 'other' (fica desativado por padrão)
const updateOther = await supabase
  .from('channels')
  .update({
    is_enabled: false,     // ← alterado: padrão desligado
    label_custom: '',
  })
  .eq('kind', 'other');
	
  if (updateOther.error) {
    console.error('Error resetting "other" channel:', updateOther.error);
    throw updateOther.error;
  }
};

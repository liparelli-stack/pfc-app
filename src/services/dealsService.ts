/*
-- ===================================================
-- Código             : /src/services/dealsService.ts
-- Versão (.v17)      : 2.4.0
-- Data/Hora          : 2025-11-03 22:20 America/Sao_Paulo
-- Autor              : FL / Execução via E.V.A.
-- Objetivo           : Serviços de Oportunidades (Deals)
--                      • CRUD de deals e integração com chats (origin_chat_id)
--                      • Funções genéricas create/update compatíveis com EditDealForm
-- Fluxo              : Cockpit → EditActionForm → EditDealForm → dealsService
-- Alterações (2.4.0) :
--   • Adicionadas funções create() e update() (genéricas).
--   • Mantidas createDealFromChat() e linkOriginChat() (já existentes).
--   • Mantidos nomes originais e compatibilidade com o adaptador defensivo do front.
-- Dependências       : @/lib/supabaseClient, @/services/profilesService
-- ===================================================
*/

import { supabase } from "@/lib/supabaseClient";
import { getCurrentProfile } from "@/services/profilesService";
import type { Deal } from "@/types/deal";

/* ===================================================
   CREATE DEAL FROM CHAT
   Cria uma oportunidade vinculada a uma ação (chat)
   =================================================== */
export async function createDealFromChat(chatId: string, payload: Partial<Deal>) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Perfil não encontrado.");

  const enriched = {
    ...payload,
    tenant_id: payload.tenant_id ?? profile.tenant_id,
    owner_user_id: payload.owner_user_id ?? profile.id,
    created_by: payload.created_by ?? profile.id,
    updated_by: payload.updated_by ?? profile.id,
    pipeline_stage: payload.pipeline_stage ?? "Fechamento",
    status: payload.status ?? "ganha",
  };

  const { data, error } = await supabase
    .from("deals")
    .insert([{ ...enriched, origin_chat_id: chatId }])
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar deal do chat: ${error.message}`);
  return data;
}

/* ===================================================
   LINK ORIGIN CHAT
   Vincula um deal existente a um chat (origin_chat_id)
   =================================================== */
export async function linkOriginChat(chatId: string, dealId: string) {
  const { error } = await supabase
    .from("deals")
    .update({ origin_chat_id: chatId })
    .eq("id", dealId);

  if (error) throw new Error(`Erro ao vincular chat ao deal: ${error.message}`);
  return true;
}

/* ===================================================
   GET BY ORIGIN CHAT
   Localiza deal existente vinculado a um chat
   =================================================== */
export async function getByOriginChatId(chatId: string) {
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("origin_chat_id", chatId)
    .maybeSingle();

  if (error) throw new Error(`Erro ao buscar deal por chat: ${error.message}`);
  return data;
}

/* ===================================================
   LIST BY ORIGIN CHAT
   Retorna lista (ou vazio) de deals vinculados a um chat
   =================================================== */
export async function listByOriginChat(chatId: string) {
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("origin_chat_id", chatId);

  if (error) throw new Error(`Erro ao listar deals por chat: ${error.message}`);
  return data || [];
}

/* ===================================================
   CREATE (GENÉRICO)
   Cria um deal sem vínculo direto a chat (fallback genérico)
   =================================================== */
export async function create(payload: Partial<Deal>) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Perfil não encontrado.");

  const enriched = {
    ...payload,
    tenant_id: payload.tenant_id ?? profile.tenant_id,
    owner_user_id: payload.owner_user_id ?? profile.id,
    created_by: payload.created_by ?? profile.id,
    updated_by: payload.updated_by ?? profile.id,
    pipeline_stage: payload.pipeline_stage ?? "Fechamento",
    status: payload.status ?? "ganha",
  };

  const { data, error } = await supabase
    .from("deals")
    .insert([enriched])
    .select()
    .single();

  if (error) throw new Error(`Erro ao criar deal: ${error.message}`);
  return data;
}

/* ===================================================
   UPDATE (GENÉRICO)
   Atualiza um deal existente
   =================================================== */
export async function update(id: string, payload: Partial<Deal>) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Perfil não encontrado.");

  const enriched = {
    ...payload,
    updated_by: profile.id,
  };

  const { data, error } = await supabase
    .from("deals")
    .update(enriched)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Erro ao atualizar deal: ${error.message}`);
  return data;
}

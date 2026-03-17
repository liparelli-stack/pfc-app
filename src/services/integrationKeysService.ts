/*
-- ===================================================
-- Código             : /src/services/integrationKeysService.ts
-- Versão (.v20)      : 0.3.0
-- Data/Hora          : 2025-12-02 20:20
-- Autor              : FL / Execução via você EVA
-- Objetivo do código : Serviço de acesso à tabela integration_keys (registro de chaves por tenant).
-- Fluxo              : Auth/JWT -> profilesService.getCurrentProfile -> integration_keys
--                       • listIntegrationKeys / getDefaultIntegrationKey
--                       • saveIntegrationKey (create/update)
--                       • deleteIntegrationKey
-- Alterações (0.3.0) :
--   • [MELHORIA] Para provider "gemini", aplica defaults em metadata:
--       - model_default = "models/gemini-1.5-flash" (se ausente)
--       - embed_default = "models/text-embedding-004" (se ausente)
--     Tornando o uso de IA plug-and-play ao apenas colar a chave.
--   • [MELHORIA] Criação do alias getDefaultIntegrationKeyByProvider para uso
--     mais semântico em outros serviços (IA, etc.).
-- Alterações (0.2.0) :
--   • [FIX] Busca de provider em getDefaultIntegrationKey agora é case-insensitive (.ilike),
--           evitando falha quando a chave é salva como "Gemini" e o código usa "gemini".
--   • [MELHORIA] Normalização do provider para minúsculas em saveIntegrationKey.
-- Dependências       : @/lib/supabaseClient, @/services/profilesService
-- ===================================================
*/

import { supabase } from "@/lib/supabaseClient";
import { getCurrentProfile } from "@/services/profilesService";

/* ========================================================= */
/* Tipos                                                     */
/* ========================================================= */

export type IntegrationKey = {
  id: string;
  tenantId: string;
  provider: string;
  label: string;
  apiKey: string;
  isActive: boolean;
  isDefault: boolean;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  exportState: string;
};

export type IntegrationKeyInput = {
  id?: string;
  provider: string;
  label: string;
  apiKey: string;
  isActive?: boolean;
  isDefault?: boolean;
  metadata?: Record<string, any>;
};

/* ========================================================= */
/* Helpers internos                                          */
/* ========================================================= */

function mapRowToIntegrationKey(row: any): IntegrationKey {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    provider: row.provider,
    label: row.label,
    apiKey: row.api_key,
    isActive: row.is_active,
    isDefault: row.is_default,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    exportState: row.export_state,
  };
}

function buildPayloadFromInput(
  input: IntegrationKeyInput,
  tenantId?: string
): Record<string, any> {
  const normalizedProvider = input.provider.trim().toLowerCase();

  // Clona metadata para não mutar o objeto original
  const metadata: Record<string, any> = {
    ...(input.metadata ?? {}),
  };

  // Regras específicas para provider GEMINI (plug-and-play)
  if (normalizedProvider === "gemini") {
    if (!metadata.model_default) {
      metadata.model_default = "models/gemini-1.5-flash";
    }

    if (!metadata.embed_default) {
      metadata.embed_default = "models/text-embedding-004";
    }
  }

  const payload: Record<string, any> = {
    provider: normalizedProvider,
    label: input.label.trim(),
    api_key: input.apiKey.trim(),
    is_active: input.isActive ?? true,
    is_default: input.isDefault ?? false,
    metadata,
  };

  if (tenantId) {
    payload.tenant_id = tenantId;
  }

  return payload;
}

/* ========================================================= */
/* Listagem                                                  */
/* ========================================================= */

export async function listIntegrationKeys(
  provider?: string
): Promise<IntegrationKey[]> {
  let query = supabase
    .from("integration_keys")
    .select("*")
    .order("provider", { ascending: true })
    .order("label", { ascending: true });

  if (provider) {
    // case-insensitive para não quebrar se o usuário salvou "Gemini", "GEMINI" etc.
    query = query.ilike("provider", provider.toLowerCase());
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "Falha ao listar chaves de integração.");
  }

  return (data || []).map(mapRowToIntegrationKey);
}

/* ========================================================= */
/* Chave default por provider                                */
/* ========================================================= */

export async function getDefaultIntegrationKey(
  provider: string
): Promise<IntegrationKey | null> {
  const normalized = provider.trim().toLowerCase();

  const { data, error } = await supabase
    .from("integration_keys")
    .select("*")
    .ilike("provider", normalized) // case-insensitive
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // PGRST116 = no rows returned
  if (error && error.code !== "PGRST116") {
    throw new Error(error.message || "Falha ao buscar chave default.");
  }

  if (!data) return null;
  return mapRowToIntegrationKey(data);
}

/**
 * Alias semântico para uso em serviços de IA e integrações.
 * Mantém compatibilidade com getDefaultIntegrationKey.
 */
export async function getDefaultIntegrationKeyByProvider(
  provider: string
): Promise<IntegrationKey | null> {
  return getDefaultIntegrationKey(provider);
}

/* ========================================================= */
/* Obter por ID                                              */
/* ========================================================= */

export async function getIntegrationKeyById(
  id: string
): Promise<IntegrationKey | null> {
  const { data, error } = await supabase
    .from("integration_keys")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(error.message || "Falha ao buscar chave de integração.");
  }

  if (!data) return null;
  return mapRowToIntegrationKey(data);
}

/* ========================================================= */
/* Save (create/update)                                      */
/* ========================================================= */

export async function saveIntegrationKey(
  input: IntegrationKeyInput
): Promise<IntegrationKey> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.tenant_id) {
    throw new Error("Perfil atual inválido ou sem tenant_id.");
  }

  const tenantId = profile.tenant_id as string;
  const isInsert = !input.id;

  const normalizedProvider = input.provider.trim().toLowerCase();

  // Se marcar como default, limpa outros defaults do mesmo provider no tenant.
  if (input.isDefault) {
    const { error: clearError } = await supabase
      .from("integration_keys")
      .update({ is_default: false })
      .eq("tenant_id", tenantId)
      .ilike("provider", normalizedProvider);

    if (clearError) {
      throw new Error(
        clearError.message ||
          "Falha ao ajustar chaves default antes de salvar."
      );
    }
  }

  const payload = buildPayloadFromInput(
    { ...input, provider: normalizedProvider },
    isInsert ? tenantId : undefined
  );

  let query = supabase.from("integration_keys");

  if (isInsert) {
    query = query.insert(payload).select("*").single();
  } else {
    query = query.update(payload).eq("id", input.id).select("*").single();
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message || "Falha ao salvar chave de integração.");
  }

  return mapRowToIntegrationKey(data);
}

/* ========================================================= */
/* Delete                                                    */
/* ========================================================= */

export async function deleteIntegrationKey(id: string): Promise<void> {
  const { error } = await supabase
    .from("integration_keys")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Falha ao excluir chave de integração.");
  }
}

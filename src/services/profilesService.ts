/*
-- ===================================================
-- Código                 : /src/services/profilesService.ts
-- Versão (.v17)          : 4.14.0
-- Data/Hora              : 2025-12-10 07:10 America/Sao_Paulo
-- Autor                  : FL / Execução via você EVA
-- Objetivo               : CRUD de profiles + integração pós-login,
--                          preservando o campo is_master_admin
--                          para uso do modelo MA em código.
--
-- Alterações (4.14.0)    :
--   • [MA/Auth] getCurrentProfile passou a aceitar um
--     authUserId opcional:
--       - Se informado, usa diretamente esse id (caso de uso
--         do AuthContext/SuperMA).
--       - Se não informado, mantém o comportamento anterior,
--         usando supabase.auth.getUser().
--     Assim, o SuperMA pode trabalhar 100% alinhado ao
--     AuthContext (session.user.id), evitando diferenças de
--     timing entre getSession() e getUser().
--
-- Alterações (4.13.0)    :
--   • [MA] mapRowToProfile passou a mapear o campo is_master_admin
--     vindo da tabela profiles, garantindo que getCurrentProfile()
--     exponha corretamente essa flag para o restante do app.
-- Alterações (4.12.0)    :
--   • deleteProfileById:
--       - Se existir auth_user_id: tenta Edge Function 'delete-user';
--         se falhar, tenta excluir apenas da tabela profiles.
--       - Se NÃO existir auth_user_id: exclui direto da tabela profiles.
--       - Só lança erro se até o DELETE em profiles falhar.
-- Alterações (4.11.0)    :
--   • createProfile corrigido (não chama updateProfile sem extras).
--   • updateProfile sanitiza undefined e retorna registro atual
--     quando não há campos para atualizar.
-- Dependências           : @/lib/supabaseClient, @/types/profile
-- ===================================================
*/

import { supabase } from "@/lib/supabaseClient";
import type { Profile } from "@/types/profile";

/* =============================================================================
[--BLOCO--] Utilitários
============================================================================= */

function normalizeError(e: any): Error {
  const msg = String(e?.message ?? e);
  const code = (e as any)?.code ?? (e as any)?.details ?? "";

  if (msg.includes("Failed to send a request to the Edge Function")) {
    return new Error(
      'Não foi possível comunicar com a função de criação de usuário. ' +
        'Verifique se a função SQL/RPC "app.create_user_with_profile" está correta e acessível.'
    );
  }

  if (code === "23505" || /duplicate key|unique constraint/i.test(msg)) {
    if (/profiles_tenant_id_email_key/i.test(msg)) {
      return new Error("Este e-mail já está em uso nesta organização.");
    }
    return new Error("Violação de chave única. O registro já pode existir.");
  }
  return new Error(msg);
}

function mapRowToProfile(r: any): Profile {
  return {
    id: r.id,
    tenant_id: r.tenant_id,
    auth_user_id: r.auth_user_id,
    email: r.email,
    full_name: r.full_name,
    position: r.position ?? null,
    role: r.role ?? "user",
    status: r.status ?? "inactive",
    department: r.department ?? null,
    avatar_url: r.avatar_url ?? null,
    locale: r.locale ?? "pt-BR",
    timezone: r.timezone ?? "America/Sao_Paulo",
    mfa_enabled: r.mfa_enabled ?? false,
    kb_can_edit: r.kb_can_edit ?? false,
    salutation_pref: r.salutation_pref ?? "neutro",
    created_at: r.created_at,
    updated_at: r.updated_at,
    // [MA] campo vindo direto da tabela profiles
    // se não existir na linha (back compat), assume false
    is_master_admin: (r as any).is_master_admin ?? false,
  };
}

/* =============================================================================
[--BLOCO--] Pós-login — garantir profile via RPC
============================================================================= */

export type EnsureProfileResult = {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
};

export async function ensureProfileAfterLogin(
  email: string,
  tenantId?: string
): Promise<EnsureProfileResult> {
  const { data, error } = await supabase.rpc("app.ensure_profile_after_login", {
    p_email: email,
    p_tenant_id: tenantId ?? null,
  });

  if (error) throw normalizeError(error);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id || !row?.tenant_id) {
    throw new Error("RPC ensure_profile_after_login não retornou id/tenant_id.");
  }

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    email: row.email,
    full_name: row.full_name,
  };
}

/* =============================================================================
[--BLOCO--] CRUD Profiles
============================================================================= */

export type ListParams = {
  q?: string;
  department?: string;
  status?: "active" | "inactive" | "all";
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
};

export async function listProfiles(
  params: ListParams = {}
): Promise<{ items: Profile[]; count: number }> {
  const { q, department, status = "all", limit = 50, offset = 0 } = params;

  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .order("full_name", { ascending: true });

  if (q && q.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(`full_name.ilike.${term},email.ilike.${term}`);
  }

  if (department && department.trim()) query = query.eq("department", department.trim());
  if (status && status !== "all") query = query.eq("status", status);

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw normalizeError(error);

  return { items: (data ?? []).map(mapRowToProfile), count: count ?? 0 };
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).single();

  if (error) {
    if ((error as any)?.code === "PGRST116") return null;
    throw normalizeError(error);
  }

  return data ? mapRowToProfile(data) : null;
}

/* =============================================================================
[--BLOCO--] CREATE PROFILE
============================================================================= */

export async function createProfile(
  profileData: Partial<Profile>
): Promise<{ data: Profile; status: number }> {
  try {
    const {
      email,
      full_name,
      role,
      status,

      position,
      department,
      avatar_url,
      locale,
      timezone,
      mfa_enabled,
      kb_can_edit,
      salutation_pref,
      ...rest
    } = profileData;

    if (!email || !full_name) {
      throw new Error("Email e nome completo são obrigatórios para criar um perfil.");
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "app.create_user_with_profile",
      {
        p_email: email,
        p_full_name: full_name,
        p_role: role ?? "user",
        p_status: status ?? "active",
      }
    );

    if (rpcError) throw normalizeError(rpcError);

    const authUserId =
      typeof rpcData === "string"
        ? rpcData
        : (rpcData as any)?.auth_user_id ?? (rpcData as any)?.id;

    if (!authUserId) {
      throw new Error("A função app.create_user_with_profile não retornou auth_user_id.");
    }

    const { data: profileRow, error: profileErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", authUserId)
      .single();

    if (profileErr || !profileRow) {
      throw normalizeError(profileErr ?? new Error("Perfil criado não encontrado."));
    }

    let finalProfile = mapRowToProfile(profileRow);

    const extraFields: Partial<Profile> = {
      position,
      department,
      avatar_url,
      locale,
      timezone,
      mfa_enabled,
      kb_can_edit,
      salutation_pref,
      ...rest,
    };

    const sanitizedExtras = Object.fromEntries(
      Object.entries(extraFields).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(sanitizedExtras).length > 0) {
      const { data: updated } = await updateProfile(finalProfile.id, sanitizedExtras);
      finalProfile = updated;
    }

    return { data: finalProfile, status: 201 };
  } catch (e: any) {
    throw normalizeError(e);
  }
}

/* =============================================================================
[--BLOCO--] UPDATE PROFILE
============================================================================= */

export async function updateProfile(
  id: string,
  profileData: Partial<Profile>
): Promise<{ data: Profile; status: number }> {
  const sanitized = Object.fromEntries(
    Object.entries(profileData).filter(([_, v]) => v !== undefined)
  );

  if (Object.keys(sanitized).length === 0) {
    const existing = await getProfileById(id);
    if (!existing) throw new Error("Registro não encontrado.");
    return { data: existing, status: 200 };
  }

  const { data, error, status } = await supabase
    .from("profiles")
    .update(sanitized)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw normalizeError(error);
  if (!data) throw new Error("A atualização não retornou dados.");

  return { data: mapRowToProfile(data), status };
}

/* =============================================================================
[--BLOCO--] DELETE PROFILE — corrigido (fallback seguro)
============================================================================= */

export async function deleteProfileById(id: string): Promise<void> {
  const profile = await getProfileById(id);

  if (!profile) {
    throw new Error("Perfil não encontrado para exclusão.");
  }

  if (profile.auth_user_id) {
    const { error } = await supabase.functions.invoke("delete-user", {
      body: { userId: profile.auth_user_id },
    });

    if (!error) {
      return;
    }

    const { error: delErr } = await supabase
      .from("profiles")
      .delete()
      .eq("id", id);

    if (delErr) {
      throw normalizeError(error);
    }

    return;
  }

  const { error } = await supabase.from("profiles").delete().eq("id", id);
  if (error) throw normalizeError(error);
}

/* =============================================================================
[--BLOCO--] Perfil Atual (JWT + RLS)
============================================================================= */

/**
 * Retorna o profile ativo do usuário autenticado.
 *
 * @param authUserId Opcional. Se informado, usa este auth_user_id
 *                   diretamente (caso típico: AuthContext.session.user.id).
 *                   Se omitido, mantém o comportamento anterior:
 *                   usa supabase.auth.getUser() para descobrir o usuário.
 */
export async function getCurrentProfile(authUserId?: string): Promise<Profile | null> {
  try {
    let uid = authUserId;

    if (!uid) {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.id) return null;
      uid = userData.user.id;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", uid)
      .eq("status", "active")
      .single();

    if (error) return null;
    return data ? mapRowToProfile(data) : null;
  } catch {
    return null;
  }
}

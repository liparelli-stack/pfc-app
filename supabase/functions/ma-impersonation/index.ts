// =====================================================================
// Código             : /supabase/functions/ma-impersonation/index.ts
// Versão (.v20)      : v1.1
// Data/Hora          : 2025-12-09 22:30 America/Sao_Paulo
// Autor              : FL / Execução via você EVA
// Objetivo do codigo :
//   Implementar o "Super MA" via impersonação de usuário usando Magic Link,
//   controlado pela tecla Shift+Ctrl+|, sem alterar fluxos de login/logout
//   existentes.
// =====================================================================

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

type ToggleAction = "enter" | "exit";

interface ToggleRequestBody {
  action: ToggleAction;
  simulated_profile_id?: string;
  note?: string | null;
  metadata?: Record<string, any> | null;
}

interface MaResponseBody {
  mode: "AS_USER" | "MA_GLOBAL";
  token_hash: string;
  email: string;
  session_log?: {
    id: string;
    tenant_id: string;
    ma_profile_id: string;
    simulated_profile_id: string;
    started_at: string;
    ended_at?: string | null;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Missing or invalid Authorization header" },
        401,
      );
    }

    const body = (await req.json()) as ToggleRequestBody;
    const action = body.action;

    if (action !== "enter" && action !== "exit") {
      return jsonResponse(
        { error: "Invalid action. Use 'enter' or 'exit'." },
        400,
      );
    }

    // Cliente para pegar o user atual (usa service role + Authorization do caller)
    const supabaseAuth = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Cliente admin (sem headers do caller, para chamadas admin)
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return jsonResponse(
        { error: "Unable to retrieve auth user", details: userError },
        401,
      );
    }

    if (action === "enter") {
      return await handleEnter({
        body,
        authUserId: user.id,
        supabaseAdmin,
      });
    } else {
      return await handleExit({
        authUserId: user.id,
        supabaseAdmin,
      });
    }
  } catch (error) {
    console.error("ma-impersonation error:", error);
    return jsonResponse(
      { error: "Internal error", details: String(error) },
      500,
    );
  }
});

// ---------------------------------------------------------------------
// ENTER: MA -> AS_USER
// ---------------------------------------------------------------------

async function handleEnter(params: {
  body: ToggleRequestBody;
  authUserId: string;
  supabaseAdmin: ReturnType<typeof createClient>;
}): Promise<Response> {
  const { body, authUserId, supabaseAdmin } = params;
  const { simulated_profile_id, note, metadata } = body;

  if (!simulated_profile_id) {
    return jsonResponse(
      { error: "simulated_profile_id is required for action 'enter'" },
      400,
    );
  }

  // Profile do MA
  const { data: maProfile, error: maProfileError } = await supabaseAdmin
    .from("profiles")
    .select("id, tenant_id, email, is_master_admin, status")
    .eq("auth_user_id", authUserId)
    .single();

  if (maProfileError || !maProfile) {
    return jsonResponse(
      { error: "MA profile not found", details: maProfileError },
      403,
    );
  }

  if (!maProfile.is_master_admin || maProfile.status !== "active") {
    return jsonResponse(
      { error: "User is not Master Admin or not active" },
      403,
    );
  }

  // Profile do usuário simulado
  const { data: simProfile, error: simProfileError } = await supabaseAdmin
    .from("profiles")
    .select("id, tenant_id, email, status")
    .eq("id", simulated_profile_id)
    .single();

  if (simProfileError || !simProfile) {
    return jsonResponse(
      { error: "Simulated profile not found", details: simProfileError },
      400,
    );
  }

  if (simProfile.status !== "active") {
    return jsonResponse(
      { error: "Simulated profile is not active" },
      400,
    );
  }

  // Mesmo tenant
  if (maProfile.tenant_id !== simProfile.tenant_id) {
    return jsonResponse(
      {
        error:
          "MA and simulated user belong to different tenants. Impersonation not allowed.",
      },
      403,
    );
  }

  if (!simProfile.email) {
    return jsonResponse(
      {
        error:
          "Simulated profile has no email. Cannot generate magic link for impersonation.",
      },
      400,
    );
  }

  // Criar sessão no log
  const metadataValue = metadata ?? {};
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("ma_impersonation_sessions")
    .insert({
      tenant_id: maProfile.tenant_id,
      ma_profile_id: maProfile.id,
      simulated_profile_id: simProfile.id,
      auth_user_id: authUserId,
      started_at: new Date().toISOString(),
      ended_at: null,
      ocorrencia: "abertura_normal",
      note: note ?? null,
      metadata: {
        ...(metadataValue || {}),
        source: "ctrl+pipe",
        action: "enter",
      },
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    return jsonResponse(
      { error: "Failed to create impersonation session", details: insertError },
      500,
    );
  }

  // Magic link para o usuário simulado
  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: simProfile.email,
    });

  if (linkError || !linkData?.properties?.hashed_token) {
    return jsonResponse(
      {
        error: "Failed to generate magic link for simulated user",
        details: linkError,
      },
      500,
    );
  }

  const tokenHash = linkData.properties.hashed_token;

  const body: MaResponseBody = {
    mode: "AS_USER",
    token_hash: tokenHash,
    email: simProfile.email,
    session_log: {
      id: inserted.id,
      tenant_id: inserted.tenant_id,
      ma_profile_id: inserted.ma_profile_id,
      simulated_profile_id: inserted.simulated_profile_id,
      started_at: inserted.started_at,
      ended_at: inserted.ended_at,
    },
  };

  return jsonResponse(body, 200);
}

// ---------------------------------------------------------------------
// EXIT: AS_USER -> MA
// ---------------------------------------------------------------------

async function handleExit(params: {
  authUserId: string;
  supabaseAdmin: ReturnType<typeof createClient>;
}): Promise<Response> {
  const { authUserId, supabaseAdmin } = params;

  // Profile do usuário SIMULADO (caller atual)
  const { data: simProfile, error: simProfileError } = await supabaseAdmin
    .from("profiles")
    .select("id, tenant_id, email, status")
    .eq("auth_user_id", authUserId)
    .single();

  if (simProfileError || !simProfile) {
    return jsonResponse(
      {
        error: "Simulated profile not found for current auth user",
        details: simProfileError,
      },
      400,
    );
  }

  // Sessão ativa
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("ma_impersonation_sessions")
    .select("*")
    .eq("simulated_profile_id", simProfile.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (sessionError || !session) {
    return jsonResponse(
      {
        error: "No active impersonation session found for this user",
        details: sessionError,
      },
      404,
    );
  }

  // Profile do MA original
  const { data: maProfile, error: maProfileError } = await supabaseAdmin
    .from("profiles")
    .select("id, tenant_id, email")
    .eq("id", session.ma_profile_id)
    .single();

  if (maProfileError || !maProfile) {
    return jsonResponse(
      {
        error: "MA profile not found for impersonation session",
        details: maProfileError,
      },
      500,
    );
  }

  if (!maProfile.email) {
    return jsonResponse(
      {
        error:
          "MA profile has no email. Cannot generate magic link to return to MA.",
      },
      500,
    );
  }

  // Encerrar log
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("ma_impersonation_sessions")
    .update({
      ended_at: new Date().toISOString(),
      ocorrencia: "encerramento_normal",
      metadata: {
        ...(session.metadata || {}),
        source: "ctrl+pipe",
        action: "exit",
      },
    })
    .eq("id", session.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    return jsonResponse(
      { error: "Failed to close impersonation session", details: updateError },
      500,
    );
  }

  // Magic link para o MA
  const { data: linkData, error: linkError } =
    await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: maProfile.email,
    });

  if (linkError || !linkData?.properties?.hashed_token) {
    return jsonResponse(
      {
        error: "Failed to generate magic link for MA",
        details: linkError,
      },
      500,
    );
  }

  const tokenHash = linkData.properties.hashed_token;

  const body: MaResponseBody = {
    mode: "MA_GLOBAL",
    token_hash: tokenHash,
    email: maProfile.email,
    session_log: {
      id: updated.id,
      tenant_id: updated.tenant_id,
      ma_profile_id: updated.ma_profile_id,
      simulated_profile_id: updated.simulated_profile_id,
      started_at: updated.started_at,
      ended_at: updated.ended_at,
    },
  };

  return jsonResponse(body, 200);
}

// ---------------------------------------------------------------------
function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

/*
-- ===================================================
-- Código             : /supabase/functions/generate-backup-full/index.ts
-- Versão (.v20)      : 2.0.0
-- Data/Hora          : 2025-12-04 21:15 America/Sao_Paulo
-- Autor              : FL / Execução via Eva
-- Objetivo           : Edge Function final do Backup de Dados,
--                      consumindo p_tables via RPC app.generate_backup_full().
-- Fluxo              :
--    AD Front -> supabase.functions.invoke("generate-backup-full")
--               -> RPC app.generate_backup_full()
--               -> CSV -> ZIP -> download.
-- Alterações (2.0.0):
--    • Refatorada para usar somente a função SQL.
--    • Resposta binária em ZIP com CORS completo.
-- ===================================================
*/

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

// ----------------------------------------------------------------
// CORS helpers (necessário para browsers e Supabase invoke())
// ----------------------------------------------------------------
function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

// ----------------------------------------------------------------
// UTIL: timestamp aaaammdd_hhmm
// ----------------------------------------------------------------
function ts(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}${mm}${dd}_${hh}${mi}`;
}

// ----------------------------------------------------------------
// UTIL: converte array de jsonb em CSV com separador ;
// ----------------------------------------------------------------
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows || rows.length === 0) return "";

  const cols = Object.keys(rows[0]);

  const esc = (val: unknown): string => {
    if (val === null || val === undefined) return "";

    let s = typeof val === "object" ? JSON.stringify(val) : String(val);

    if (s.includes('"')) s = s.replace(/"/g, '""');

    if (/[;\n",]/.test(s)) s = `"${s}"`;

    return s;
  };

  const header = cols.join(";");
  const lines = rows.map((r) => cols.map((c) => esc(r[c])).join(";"));

  return [header, ...lines].join("\n");
}

// ----------------------------------------------------------------
// Edge Function principal
// ----------------------------------------------------------------
serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin") ?? "*";

  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }

  try {
    // --------------------------------------------------------------
    // 1) Ler body do front
    // --------------------------------------------------------------
    const body = await req.json().catch(() => null);

    if (!body || !Array.isArray(body.tables)) {
      return json({ error: "Body inválido. Esperado { tables: string[] }" }, 400, origin);
    }

    const tables: string[] = body.tables;

    // --------------------------------------------------------------
    // 2) Criar cliente Supabase usando o JWT recebido do front
    // --------------------------------------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabase = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });

    // --------------------------------------------------------------
    // 3) Chamar a função SQL oficial do backup
    // --------------------------------------------------------------
    const { data, error } = await supabase.rpc("generate_backup_full", {
      p_tables: tables,
    });

    if (error) {
      return json(
        {
          error: "Erro ao executar RPC generate_backup_full().",
          details: error.message,
        },
        500,
        origin,
      );
    }

    // data: [{ table_name: "companies", row_data: {...}}, ... ]

    // --------------------------------------------------------------
    // 4) Organizar por tabela → CSV → ZIP
    // --------------------------------------------------------------
    const grouped: Record<string, Record<string, unknown>[]> = {};

    for (const row of data ?? []) {
      const table = row.table_name as string;
      const content = row.row_data as Record<string, unknown>;

      if (!grouped[table]) grouped[table] = [];
      grouped[table].push(content);
    }

    const zip = new JSZip();
    const timestamp = ts();

    for (const table of Object.keys(grouped)) {
      const csv = toCsv(grouped[table]);
      const fileName = `BKP${table}${timestamp}.csv`;
      zip.file(fileName, csv);
    }

    const zipContent = await zip.generateAsync({ type: "uint8array" });

    const zipName = `BACKUP_${timestamp}.zip`;

    return new Response(zipContent, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}"`,
        ...corsHeaders(origin),
      },
    });
  } catch (e) {
    return json(
      {
        error: "Erro inesperado ao gerar backup.",
        details: e instanceof Error ? e.message : String(e),
      },
      500,
      origin,
    );
  }
});

/*
  Código             : /src/services/backup/backupHistoryService.ts
  Versão (.v20)      : v1.1.0
  Data/Hora          : 2025-12-04 23:20
  Autor              : FL / Execução via você EVA
  Objetivo do codigo : Buscar histórico de backups para exibição em tela (modal)
  Fluxo              : BackupSettings -> backupHistoryService.getBackupHistory()
  Alterações (1.1.0) :
    • Inclusão do campo JSON "tables" tratado como lista de { table, rows }.
    • Inclusão de file_path e external_reference.
    • Tratamento de versões antigas em que "tables" pode ser array simples de strings.
  Dependências       : Supabase Client
*/

import { supabase } from "@/lib/supabaseClient";

export interface BackupTableInfo {
  table: string;
  rows: number | null;
}

export interface BackupHistoryItem {
  id: string;
  created_at: string;
  backup_type: string;
  status: string;
  total_tables: number | null;
  destinations: any;
  file_name: string | null;
  file_path: string | null;
  external_reference: string | null;
  error_message: string | null;
  profile_name: string | null;
  tables: BackupTableInfo[];
}

function normalizeTablesJson(tables: any): BackupTableInfo[] {
  if (!tables) return [];

  try {
    const arr = Array.isArray(tables) ? tables : JSON.parse(tables as string);

    if (!Array.isArray(arr)) return [];

    return arr.map((item: any) => {
      // Versão nova: { table: "companies", rows: 1478 }
      if (item && typeof item === "object") {
        return {
          table: String(item.table ?? item.tabela ?? item.name ?? "-"),
          rows:
            typeof item.rows === "number"
              ? item.rows
              : item.rows == null
              ? null
              : Number(item.rows),
        };
      }

      // Versão antiga: "companies"
      return {
        table: String(item),
        rows: null,
      };
    });
  } catch (_e) {
    return [];
  }
}

export async function getBackupHistory(): Promise<BackupHistoryItem[]> {
  const { data, error } = await supabase
    .from("backups")
    .select(
      `
        id,
        created_at,
        backup_type,
        status,
        total_tables,
        destinations,
        file_name,
        file_path,
        external_reference,
        error_message,
        tables,
        profiles:created_by_profile_id (
          full_name,
          email
        )
      `
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      "[backupHistoryService] Erro ao buscar histórico de backups:",
      error
    );
    throw error;
  }

  if (!data) return [];

  return data.map((row: any) => {
    const profile = row.profiles || null;

    const profileName: string | null =
      profile?.full_name ??
      profile?.email ??
      null;

    return {
      id: row.id,
      created_at: row.created_at,
      backup_type: row.backup_type,
      status: row.status,
      total_tables: row.total_tables,
      destinations: row.destinations,
      file_name: row.file_name,
      file_path: row.file_path,
      external_reference: row.external_reference,
      error_message: row.error_message,
      profile_name: profileName,
      tables: normalizeTablesJson(row.tables),
    };
  });
}

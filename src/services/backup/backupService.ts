/*
  Código             : /src/services/backup/backupService.ts
  Versão (.v20)      : v1.0.3
  Data/Hora          : 2025-12-04 18:25
  Autor              : FL / Execução via você EVA
  Objetivo do codigo : Invocar função Supabase para gerar o ZIP de Backup de Dados
  Fluxo              : BackupSettings -> backupService -> Supabase Function -> download ZIP
  Alterações (1.0.3) :
    • Corrigido erro de sintaxe na chamada ao RPC Supabase (removido caractere "5").
    • Normalizado envio de nomes de tabela para função SQL (remoção de prefixo de schema).
  Dependências       : Supabase Client, backupTablesCatalog, JSZip
*/

import { supabase } from "@/lib/supabaseClient";
import JSZip from "jszip"; // já existe no npm do AD (StackBlitz / WebContainer)

import { BACKUP_TABLES } from "@/services/backup/backupTablesCatalog";

type GenerateFullBackupParams = {
  selectedTableNames: string[];
};

export async function generateFullBackup({
  selectedTableNames,
}: GenerateFullBackupParams) {
  // 1) Normaliza os nomes de tabela:
  //    - Se vier "public.companies" → vira "companies"
  //    - Se vier só "companies" → mantém
  const normalizedTableNames = selectedTableNames.map((t) => {
    if (!t) return t;
    const parts = String(t).split(".");
    return parts[parts.length - 1]; // último segmento é o nome da tabela
  });

  // 2) Chama diretamente a RPC SQL (fonte oficial de backup)
  const { data, error } = await supabase.rpc("generate_backup_full", {
    p_tables: normalizedTableNames,
  });

  if (error) {
    console.error("Erro ao gerar backup completo via RPC:", error);
    throw error;
  }

  if (!data || !Array.isArray(data)) {
    console.warn("generate_backup_full retornou estrutura inesperada:", data);
    return;
  }

  // 3) Organiza rows por tabela
  const grouped: Record<string, any[]> = {};
  for (const row of data) {
    const table = row.table_name as string;
    if (!grouped[table]) grouped[table] = [];
    grouped[table].push(row.row_data);
  }

  // 4) Função utilitária para converter array de objetos em CSV
  const toCsv = (rows: any[]): string => {
    if (!rows.length) return "";
    const cols = Object.keys(rows[0] ?? {});
    if (!cols.length) return "";

    const esc = (v: unknown): string => {
      if (v == null) return "";
      let s =
        typeof v === "object"
          ? JSON.stringify(v)
          : String(v);

      if (s.includes('"')) s = s.replace(/"/g, '""');
      if (/[;\n",]/.test(s)) s = `"${s}"`;
      return s;
    };

    const header = cols.join(";");
    const lines = rows.map((r) => cols.map((c) => esc(r[c])).join(";"));
    return [header, ...lines].join("\n");
  };

  // 5) Cria ZIP no front
  const zip = new JSZip();

  const ts = (() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}${mm}${dd}_${hh}${mi}`;
  })();

  for (const table of Object.keys(grouped)) {
    const csv = toCsv(grouped[table]);
    // Ex: BKP_companies_20251204_1825.csv
    zip.file(`BKP_${table}_${ts}.csv`, csv);
  }

  const blob = await zip.generateAsync({ type: "blob" });

  // 6) Dispara download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `BACKUP_${ts}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/* 
-- =========================================================
-- Código             : /src/services/knowledgeMdEditorService.ts
-- Versão (.v20)      : 1.2.0
-- Data/Hora          : 2025-12-09 06:55
-- Autor              : FL / Execução via E.V.A.
-- Objetivo do código : Serviço do Editor MD Appy para ler / salvar / excluir arquivos .md no Storage
-- Fluxo              : MarkdownEditor -> knowledgeMdEditorService -> Supabase Storage
-- Alterações (1.2.0) :
--    • Adicionada função deleteMarkdownFile(tenantSlug, filename) para excluir arquivos .md na nuvem.
--    • Mantidas funções existentes (listMarkdownFiles, loadMarkdownFile, fileExists, saveMarkdownFile).
-- Dependências       : supabase client, bucket "kb-tenant"
-- =========================================================
*/

import { supabase } from '@/lib/supabaseClient';

const BUCKET = 'kb-tenant';

/* ---------------------------------------------------------
 * Lista arquivos .md do tenant
 * --------------------------------------------------------- */
export async function listMarkdownFiles(tenantSlug: string): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(`${tenantSlug}/`, {
      limit: 200,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    });

  if (error) throw error;

  return (data || [])
    .filter((f) => f.name.toLowerCase().endsWith('.md'))
    .map((f) => f.name);
}

/* ---------------------------------------------------------
 * Carrega arquivo .md
 * --------------------------------------------------------- */
export async function loadMarkdownFile(
  tenantSlug: string,
  filename: string
): Promise<string> {
  const fullPath = `${tenantSlug}/${filename}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(fullPath);

  if (error) throw error;

  const content = await data.text();
  return content;
}

/* ---------------------------------------------------------
 * Verifica se um arquivo existe
 * --------------------------------------------------------- */
export async function fileExists(
  tenantSlug: string,
  filename: string
): Promise<boolean> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(`${tenantSlug}/`);

  if (error) throw error;

  return (data || []).some((f) => f.name === filename);
}

/* ---------------------------------------------------------
 * Salva arquivo .md (overwrite controlado externamente)
 * --------------------------------------------------------- */
export async function saveMarkdownFile(
  tenantSlug: string,
  filename: string,
  content: string
): Promise<void> {
  const fullPath = `${tenantSlug}/${filename}`;

  const blob = new Blob([content], {
    type: 'text/markdown; charset=utf-8',
  });

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fullPath, blob, {
      upsert: true, // sobrescreve apenas após confirmação no Editor
    });

  if (error) throw error;
}

/* ---------------------------------------------------------
 * Exclui arquivo .md do Storage
 * --------------------------------------------------------- */
export async function deleteMarkdownFile(
  tenantSlug: string,
  filename: string
): Promise<void> {
  const fullPath = `${tenantSlug}/${filename}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([fullPath]);

  if (error) throw error;
}

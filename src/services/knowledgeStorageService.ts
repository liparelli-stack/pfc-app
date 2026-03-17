/*
-- ===================================================
-- Código             : /src/services/knowledgeStorageService.ts
-- Versão (.v20)      : 1.1.0
-- Data/Hora          : 2025-12-09 09:30
-- Autor              : FL / Execução via você EVA
-- Objetivo do codigo : Serviço de Armazenamento da Base de Conhecimento
--                      (listar, upload, download, exclusão e URL pública).
-- Fluxo              : KnowledgeStoragePanel -> knowledgeStorageService -> Supabase Storage
-- Alterações (1.1.0) :
--   • Consolidado bucket único "kb-tenant" em constante KB_BUCKET_ID.
--   • Geração de URL pública usando getPublicUrl (bucket público).
--   • downloadKnowledgeFileWithUrl utiliza createSignedUrl para download seguro.
--   • Tipagem KnowledgeFile alinhada ao componente KnowledgeStoragePanel.
-- Dependências       : supabase client, bucket "kb-tenant" (público)
-- ===================================================
*/

import { supabase } from '@/lib/supabaseClient';

export type KnowledgeFile = {
  name: string;
  path: string;
  publicUrl: string;
  updatedAt: Date | null;
  isKbDefault: boolean;
};

const KB_BUCKET_ID = 'kb-tenant';

/* ---------------------------------------------------------
 * Lista arquivos do tenant (todos os tipos)
 * --------------------------------------------------------- */
export async function getKnowledgeFiles(tenantSlug: string): Promise<KnowledgeFile[]> {
  const prefix = `${tenantSlug}/`;

  const { data, error } = await supabase.storage
    .from(KB_BUCKET_ID)
    .list(prefix, {
      limit: 200,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    });

  if (error) throw error;

  const defaultKbFilename = `kb${tenantSlug}.md`;

  return (data || []).map((obj) => {
    const path = `${tenantSlug}/${obj.name}`;

    // URL pública (bucket precisa estar marcado como público)
    const { data: publicData } = supabase.storage
      .from(KB_BUCKET_ID)
      .getPublicUrl(path);

    const publicUrl = publicData?.publicUrl ?? '';

    return {
      name: obj.name,
      path,
      publicUrl,
      updatedAt: obj.updated_at ? new Date(obj.updated_at) : null,
      isKbDefault: obj.name === defaultKbFilename,
    };
  });
}

/* ---------------------------------------------------------
 * Upload com regras de pasta por tenant
 * --------------------------------------------------------- */
type UploadKnowledgeFileArgs = {
  tenantSlug: string;
  file: File;
};

export async function uploadKnowledgeFileWithRules(
  args: UploadKnowledgeFileArgs
): Promise<void> {
  const { tenantSlug, file } = args;
  const path = `${tenantSlug}/${file.name}`;

  const { error } = await supabase.storage
    .from(KB_BUCKET_ID)
    .upload(path, file, {
      upsert: true,
    });

  if (error) throw error;
}

/* ---------------------------------------------------------
 * Exclusão com regras de pasta por tenant
 * --------------------------------------------------------- */
type DeleteKnowledgeFileArgs = {
  tenantSlug: string;
  path: string; // ex.: "geigerscope/arquivo.png"
};

export async function deleteKnowledgeFileWithRules(
  args: DeleteKnowledgeFileArgs
): Promise<void> {
  const { path } = args;

  const { error } = await supabase.storage
    .from(KB_BUCKET_ID)
    .remove([path]);

  if (error) throw error;
}

/* ---------------------------------------------------------
 * Download via URL assinada (uso temporário para <a download>)
 * --------------------------------------------------------- */
export async function downloadKnowledgeFileWithUrl(path: string): Promise<{
  url: string;
  suggestedFilename: string;
}> {
  const { data, error } = await supabase.storage
    .from(KB_BUCKET_ID)
    .createSignedUrl(path, 60); // 60s é suficiente para clique imediato

  if (error || !data?.signedUrl) {
    throw error || new Error('Não foi possível gerar URL para download.');
  }

  const parts = path.split('/');
  const suggestedFilename = parts[parts.length - 1] || 'arquivo';

  return {
    url: data.signedUrl,
    suggestedFilename,
  };
}

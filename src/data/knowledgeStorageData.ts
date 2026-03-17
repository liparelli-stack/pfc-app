/*
-- ===================================================
-- Código             : /src/data/knowledgeStorageData.ts
-- Versão (.v20)      : 1.1.0
-- Data/Hora          : 2025-12-06 19:00
-- Autor              : FL / Execução via E.V.A.
-- Objetivo do codigo : Encapsular acesso ao Supabase Storage (bucket kb-tenant),
--                      incluindo geração de URL pública.
-- Fluxo              : Utilizado por knowledgeStorageService.ts.
-- Alterações (1.1.0) :
--   • Adicionada função getKnowledgeBucketPublicUrl para expor URL pública.
-- Dependências       : Supabase client (/src/lib/supabaseClient.ts)
-- ===================================================
*/
import { supabaseClient } from '@/lib/supabaseClient';

const supabase = supabaseClient; // ajuste se o export for diferente

const BUCKET_ID = 'kb-tenant';

export type KnowledgeStorageObject = {
  id?: string | null;
  name: string;
  updated_at?: string | null;
  created_at?: string | null;
  last_accessed_at?: string | null;
  metadata?: Record<string, any> | null;
};

export async function listKnowledgeBucketObjects(
  folder: string
): Promise<KnowledgeStorageObject[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET_ID)
    .list(folder || undefined, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' },
    });

  if (error) {
    throw error;
  }

  return (data ?? []) as KnowledgeStorageObject[];
}

export async function uploadKnowledgeBucketObject(params: {
  path: string;
  file: File;
}) {
  const { path, file } = params;

  const { data, error } = await supabase.storage
    .from(BUCKET_ID)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    throw error;
  }

  return data;
}

export async function downloadKnowledgeBucketObject(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET_ID).download(path);

  if (error || !data) {
    throw error || new Error('Falha ao fazer download do arquivo.');
  }

  return data;
}

export async function deleteKnowledgeBucketObject(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET_ID).remove([path]);

  if (error) {
    throw error;
  }
}

export function getKnowledgeBucketPublicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET_ID).getPublicUrl(path);
  return data.publicUrl;
}

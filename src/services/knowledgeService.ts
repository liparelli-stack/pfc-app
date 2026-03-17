/*
-- ===================================================
-- Código: /src/services/knowledgeService.ts
-- Versão: 1.5.0
-- Data/Hora: 2025-10-28 20:00
-- Autor: Dualite Alpha (AD)
-- Objetivo: Melhorar o tratamento de erros para arquivos não encontrados (404) no Storage.
-- Fluxo: Chamado pelos painéis de conhecimento.
-- Notas:
--   - Lança um erro mais descritivo quando o Supabase retorna 'Object not found'.
-- ===================================================
*/
import { supabase } from '@/lib/supabaseClient';

const PRODUCT_BUCKET = 'kb-product';
const PRODUCT_FILE_PATH = 'product/kb.md';
const CLIENT_BUCKET = 'kb-tenant';

/* Remove front-matter YAML do início, se existir */
const stripFrontMatter = (text: string): string => {
  if (!text) return text;
  const fm = text.match(/^---\s*[\r\n]+[\s\S]*?[\r\n]+---\s*[\r\n]?/);
  return fm ? text.slice(fm[0].length) : text;
};

/* Gera URL assinada e baixa o conteúdo como texto */
const fetchSignedText = async (bucket: string, path: string): Promise<string> => {
  const { data: signedData, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);

  // [--TÉCNICA--] Tratamento de erro específico para 'Object not found' (404).
  if (error) {
    console.error(`SignedURL error (${bucket}/${path})`, error);
    if ((error as any).statusCode === '404' || error.message.includes('not found')) {
      throw new Error(`Arquivo não encontrado. Verifique se o caminho '${path}' está correto no bucket '${bucket}'.`);
    }
    throw new Error(`Não foi possível gerar a URL para o arquivo (${path}): ${error.message}`);
  }

  if (!signedData?.signedUrl) {
    throw new Error('A URL assinada retornou vazia, não foi possível acessar o arquivo.');
  }

  const res = await fetch(signedData.signedUrl);
  if (!res.ok) {
    console.error('Fetch signedUrl failed', { status: res.status, statusText: res.statusText });
    // Se a URL assinada falhar com 404, pode ser que o objeto foi deletado após a assinatura.
    if (res.status === 404) {
        throw new Error(`O arquivo '${path}' não foi encontrado ao tentar acessá-lo.`);
    }
    throw new Error(`Falha ao baixar o arquivo (${path}). Status: ${res.status}`);
  }
  const raw = await res.text();
  return stripFrontMatter(raw).trim();
};

/* ================= Produto (kb-product) ================= */
export const getKbArticle = async (): Promise<string> => {
  try {
    return await fetchSignedText(PRODUCT_BUCKET, PRODUCT_FILE_PATH);
  } catch (e: any) {
    console.error('Error product KB:', e);
    // [--NOTA--] Propaga a mensagem de erro específica do fetchSignedText.
    throw new Error(e.message || 'Não foi possível carregar a base de conhecimento do produto.');
  }
};

/* ================= Cliente (kb-tenant) ================= */
type GetClientKbArticleOpts = {
  /** Caminho EXATO no bucket, pode incluir subpasta. Ex.: 'geigerscope/kbgeigerscope.md' */
  filename: string;
};

export const getClientKbArticle = async (opts: GetClientKbArticleOpts): Promise<string> => {
  const path = (opts?.filename || '').trim();
  if (!path) throw new Error('Parâmetro "filename" obrigatório.');
  try {
    return await fetchSignedText(CLIENT_BUCKET, path);
  } catch (e: any) {
    console.error(`Error client KB (${path}):`, e);
    // [--NOTA--] Propaga a mensagem de erro específica.
    throw new Error(e.message || `Não foi possível carregar o manual do cliente (${path}).`);
  }
};

/* ================= Leitura direta por URL assinada ================= */
export const getClientKbArticleBySignedUrl = async (signedUrl: string): Promise<string> => {
  const url = (signedUrl || '').trim();
  if (!url) throw new Error('URL assinada inválida.');
  const res = await fetch(url);
  if (!res.ok) throw new Error('Falha ao baixar o arquivo pela URL assinada.');
  const raw = await res.text();
  return stripFrontMatter(raw).trim();
};

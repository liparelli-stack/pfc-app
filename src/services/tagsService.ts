// Código             : /src/services/tagsService.ts
// Versão (.v20)      : v1.1.0
// Data/Hora          : 2025-12-06 11:00 America/Sao_Paulo
// Autor              : FL / Execução via você EVA
// Objetivo do codigo : Adicionar o campo `is_active` na criação de tags.
// Alterações (1.1.0) :
//   • [FEAT] A função `createTag` agora aceita o parâmetro `is_active`.
// Dependências       : @/lib/supabaseClient, @/types/tag

import { supabaseClient } from "@/lib/supabaseClient";
import type { Tag, TagOrigin } from "@/types/tag";
import { normalizeText } from "@/utils/textNormalization";

const TABLE_NAME = "tags";

export interface CreateTagInput {
  name: string;
  color?: string | null;
  tag_group?: string | null;
  origin?: TagOrigin; // default 'user'
  is_active?: boolean;
}

export interface SearchTagsOptions {
  q?: string;
  limit?: number;
  includeSystem?: boolean;
  includeUser?: boolean;
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ============================================================
   BUSCAR TAGS (campo de busca / painel de tagging)
============================================================ */
export async function searchTags(
  options: SearchTagsOptions = {}
): Promise<Tag[]> {
  const {
    q,
    limit = 20,
    includeSystem = true,
    includeUser = true,
  } = options;

  let query = supabaseClient
    .from(TABLE_NAME)
    .select("*")
    .eq("is_active", true)
    .order("origin", { ascending: false }) // user primeiro, depois system
    .order("name", { ascending: true })
    .limit(limit);

  if (q && q.trim().length > 0) {
    const raw = q.trim();
    // Busca pelo nome original (case-insensitive) OU pelo slug normalizado
    // (sem acentos), para que "licitacao" encontre "LICITAÇÃO".
    const normalized = normalizeText(raw).replace(/\s+/g, "-");
    query = query.or(`name.ilike.%${raw}%,slug.ilike.%${normalized}%`);
  }

  if (!includeSystem || !includeUser) {
    const origins: TagOrigin[] = [];
    if (includeUser) origins.push("user");
    if (includeSystem) origins.push("system");
    if (origins.length === 1) {
      query = query.eq("origin", origins[0]);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("searchTags error:", error);
    throw error;
  }

  return (data ?? []) as Tag[];
}

/* ============================================================
   LISTAR TAGS (para o Gerenciador de Etiquetas)
============================================================ */
export async function listTags(options: {
  q?: string;
  origin?: 'all' | 'user' | 'system';
  status?: 'all' | 'active' | 'inactive';
  limit?: number;
  offset?: number;
}): Promise<{ tags: Tag[]; count: number | null }> {
  const { q, origin = 'all', status = 'all', limit = 20, offset = 0 } = options;

  let query = supabaseClient
    .from(TABLE_NAME)
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (q && q.trim()) {
    query = query.or(`name.ilike.%${q.trim()}%,slug.ilike.%${q.trim()}%`);
  }

  if (origin !== 'all') {
    query = query.eq('origin', origin);
  }

  if (status !== 'all') {
    query = query.eq('is_active', status === 'active');
  }

  const { data, error, count } = await query;
  if (error) {
    console.error('listTags error:', error);
    throw error;
  }

  return { tags: (data ?? []) as Tag[], count };
}


/* ============================================================
   LISTAR TODAS AS TAGS ATIVAS (por tenant, limitado)
============================================================ */
export async function listAllTags(limit = 100): Promise<Tag[]> {
  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("listAllTags error:", error);
    throw error;
  }

  return (data ?? []) as Tag[];
}

/* ============================================================
   RESOLVER TAGS POR SLUG (para chats.tags = slugs[])
============================================================ */
export async function getTagsBySlugs(slugs: string[]): Promise<Tag[]> {
  if (!slugs || slugs.length === 0) return [];

  const normalized = Array.from(
    new Set(
      slugs
        .map((s) => s?.toString().trim().toLowerCase())
        .filter((s) => s && s.length > 0)
    )
  );
  if (normalized.length === 0) return [];

  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .select("*")
    .in("slug", normalized)
    .eq("is_active", true);

  if (error) {
    console.error("getTagsBySlugs error:", error);
    throw error;
  }

  return (data ?? []) as Tag[];
}

/* ============================================================
   CRIAR NOVA TAG (RLS cuida do tenant_id)
============================================================ */
export async function createTag(input: CreateTagInput): Promise<Tag> {
  const { name, color = null, tag_group = null, origin = "user", is_active = true } = input;

  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("Nome da tag é obrigatório.");
  }

  const slug = slugify(trimmedName);
  if (!slug) {
    throw new Error("Não foi possível gerar um slug válido para a tag.");
  }

  const payload = {
    name: trimmedName,
    slug,
    color,
    tag_group,
    origin,
    is_active,
  };

  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("createTag error:", error);
    if (error.code === '23505') { // unique_violation
      throw new Error('Uma etiqueta com este nome ou slug já existe.');
    }
    throw error;
  }

  return data as Tag;
}

/* ============================================================
   ATUALIZAR TAG
============================================================ */
export async function updateTag(
  id: string,
  payload: Partial<Omit<Tag, 'id' | 'tenant_id' | 'slug' | 'created_at' | 'updated_at'>>
): Promise<Tag> {
  if (!id) {
    throw new Error('ID da tag é obrigatório para atualização.');
  }

  // Garante que slug não seja alterado diretamente
  const { slug, ...updateData } = payload as any;

  // Se o nome for alterado, o slug deve ser recalculado
  if (updateData.name) {
    updateData.slug = slugify(updateData.name);
  }

  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('updateTag error:', error);
    throw error;
  }
  return data as Tag;
}

/* ============================================================
   ATUALIZAR SOMENTE A COR DE UMA TAG
============================================================ */
export async function updateTagColor(
  id: string,
  color: string | null
): Promise<Tag> {
  if (!id) {
    throw new Error("ID da tag é obrigatório para atualizar a cor.");
  }

  const { data, error } = await supabaseClient
    .from(TABLE_NAME)
    .update({ color })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("updateTagColor error:", error);
    throw error;
  }

  return data as Tag;
}

/* ============================================================
   EXCLUIR TAG
============================================================ */
export async function deleteTag(id: string): Promise<void> {
  if (!id) {
    throw new Error('ID da tag é obrigatório para exclusão.');
  }
  const { error } = await supabaseClient.from(TABLE_NAME).delete().eq('id', id);
  if (error) {
    console.error('deleteTag error:', error);
    throw error;
  }
}

// Código             : /src/types/tag.ts
// Versão (.v20)      : v0.1.0
// Data/Hora          : 2025-11-15 19:30
// Autor              : FL / Execução via você EVA
// Objetivo do codigo : Tipagem da entidade Tag usada no módulo de tagging.
// Fluxo              : org_tenants -> tags -> chats.tags (jsonb: slug[])
// Alterações (0.1.0) :
//   • Criado tipo Tag alinhado com a tabela public.tags.
// Dependências       : Nenhuma direta. Importado em services e componentes.

export type TagOrigin = "user" | "system";

export interface Tag {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  color: string | null;
  tag_group: string | null;
  origin: TagOrigin;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  export_state: string;
}

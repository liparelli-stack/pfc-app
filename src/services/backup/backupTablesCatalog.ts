/*
  Código             : /src/services/backup/backupTablesCatalog.ts
  Versão (.v20)      : v1.0.3
  Data/Hora          : 2025-12-04 21:35
  Autor              : FL / Execução via você EVA
  Objetivo do codigo : Catálogo controlado de tabelas usadas no Backup de Dados
  Fluxo              : catálogo -> componente BackupSettings -> serviço backupService
  Alterações (1.0.3) :
    • Removida tabela "Auditoria de Canais" (public.contacts_channels_audit) do catálogo de backup.
  Dependências       : Nenhuma
*/

export type BackupTableGroup =
  | "organizacao"
  | "cadastros"
  | "operacoes"
  | "sistema";

export interface BackupTableItem {
  schema: "public";
  name: string;
  label: string;
  group: BackupTableGroup;
}

export const BACKUP_TABLES: BackupTableItem[] = [
  // Organização & Acesso
  {
    schema: "public",
    name: "org_tenants",
    label: "Organizações (Tenants)",
    group: "organizacao",
  },
  {
    schema: "public",
    name: "profiles",
    label: "Perfis de Usuário",
    group: "organizacao",
  },
  {
    schema: "public",
    name: "integration_keys",
    label: "Chaves de Integração",
    group: "organizacao",
  },

  // Cadastros & Relacionamentos
  {
    schema: "public",
    name: "companies",
    label: "Empresas",
    group: "cadastros",
  },
  {
    schema: "public",
    name: "contacts",
    label: "Contatos",
    group: "cadastros",
  },
  {
    schema: "public",
    name: "contacts_channel",
    label: "Canais de Contato",
    group: "cadastros",
  },
  {
    schema: "public",
    name: "channels",
    label: "Canais de Comunicação",
    group: "cadastros",
  },
  {
    schema: "public",
    name: "tags",
    label: "Tags",
    group: "cadastros",
  },

  // Operações & Negócios
  {
    schema: "public",
    name: "deals",
    label: "Negócios (Deals)",
    group: "operacoes",
  },
  {
    schema: "public",
    name: "tickets",
    label: "Tickets / Atendimentos",
    group: "operacoes",
  },
  {
    schema: "public",
    name: "ticket_sequences",
    label: "Sequências de Tickets",
    group: "operacoes",
  },
  {
    schema: "public",
    name: "chats",
    label: "Conversas (Chats)",
    group: "operacoes",
  },

  // Sistema / Auditoria
  {
    schema: "public",
    name: "backups",
    label: "Histórico de Backups",
    group: "sistema",
  },
];

export const BACKUP_TABLE_GROUP_LABELS: Record<BackupTableGroup, string> = {
  organizacao: "Organização & Acesso",
  cadastros: "Cadastros & Relacionamentos",
  operacoes: "Operações & Negócios",
  sistema: "Sistema & Auditoria",
};

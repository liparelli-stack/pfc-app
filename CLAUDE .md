# CLAUDE.md — CRM Appy v0.1.0

## Descricao do Sistema

**CRM Appy** e uma plataforma CRM moderna e completa para gestao de relacionamento com clientes, vendas, agenda e base de conhecimento. Possui design neumorfico, suporte multi-tenant, integracoes com IA (Google Gemini) e impersonacao de usuarios via Master Admin.

- **Idioma da interface**: Portugues Brasileiro (pt-BR)
- **Gerado com**: Dualite Alpha (AI design system)
- **Deploy**: Netlify (SPA)
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | React 18.2 + TypeScript 5.2 |
| Build | Vite 5.4 |
| Estilizacao | Tailwind CSS 3.4 (design neumorfico) |
| Estado servidor | TanStack React Query 5 |
| Formularios | React Hook Form 7 + Zod 4 |
| Componentes base | Radix UI (Select, Switch, Popover) |
| Icones | Lucide React 0.395 |
| Animacoes | Framer Motion 11 |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Graficos | ECharts (echarts-for-react) |
| Exportacao | xlsx, jsPDF + jspdf-autotable, docx, file-saver |
| Markdown | react-markdown + rehype-raw + remark-gfm |
| Utilitarios | lodash-es, date-fns, clsx |
| Banco de dados | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth (JWT, email+senha) |
| Edge Functions | Deno (Supabase Functions) |
| IA | Google Gemini API |
| Deploy | Netlify |

---

## Estrutura de Pastas

```
crmappy-v0100/
├── src/
│   ├── pages/              # Paginas da aplicacao (13 paginas)
│   ├── components/         # Componentes por feature + UI base
│   │   ├── Dashboard/      # Widgets e metricas do dashboard
│   │   ├── Cockpit/        # Pipeline de vendas
│   │   ├── Vision360/      # Visao 360 do cliente (cards, kpis, skeletons)
│   │   ├── Deals/          # Gestao de oportunidades
│   │   ├── AgendaX/        # Timeline de agenda
│   │   ├── AgendaTimeline/ # Visualizacao de linha do tempo
│   │   ├── Catalogs/       # Catalogo de produtos/servicos
│   │   ├── Budgets/        # Orcamentos (Kanban)
│   │   ├── Knowledge/      # Base de conhecimento + markdown/
│   │   ├── Lists/          # Listas customizaveis
│   │   ├── Settings/       # Configuracoes
│   │   ├── Support/        # Central de ajuda
│   │   ├── Shared/         # Componentes reutilizaveis
│   │   ├── UI/             # Componentes base (Button, Modal, Input…)
│   │   ├── Charts/         # Wrappers ECharts
│   │   ├── SuperMa/        # Modal Master Admin
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── DebugOverlay.tsx
│   ├── services/           # Camada de negocio (~38 servicos)
│   │   ├── ai/             # Gemini chat, vision360 AI, actions AI
│   │   └── backup/         # Backup service, history, catalog
│   ├── hooks/              # Custom hooks (~16 hooks)
│   ├── types/              # Schemas Zod + tipos TypeScript
│   ├── contexts/           # AuthContext, ToastContext, DebugContext
│   ├── providers/          # ReactQueryProvider
│   ├── lib/
│   │   └── supabaseClient.ts
│   ├── utils/              # Helpers (icons, status, exporters, errors)
│   ├── schemas/            # Schemas de validacao extra
│   ├── config/             # Constantes de configuracao
│   ├── data/               # Dados estaticos / mock
│   ├── superMa/            # Logica Master Admin (factory, service, types)
│   ├── App.tsx             # Roteamento, providers, hotkeys, temas
│   └── main.tsx            # Entry point React
├── supabase/
│   ├── config.toml         # Config local Supabase
│   ├── functions/          # Edge Functions (Deno)
│   │   ├── create-user-with-profile/
│   │   ├── delete-user/
│   │   ├── generate-backup-full/
│   │   ├── ma-impersonation/
│   │   └── _shared/cors.ts
│   └── migrations/         # 32 arquivos SQL incrementais
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.app.json
├── netlify.toml
├── package.json
└── .env
```

---

## Padroes Arquiteturais

### Multi-Tenant
- Todos os dados possuem `tenant_id` (FK → `org_tenants`)
- Isolamento garantido por RLS no Supabase
- Profiles: constraint unica `(tenant_id, auth_user_id)`

### Service Layer
- Cada dominio tem `*Service.ts` dedicado em `src/services/`
- Servicos encapsulam queries Supabase + logica de negocio
- Consumidos por componentes via React Query ou hooks customizados

### React Query (Server State)
- TanStack React Query v5 para cache e sincronizacao
- QueryClient singleton configurado em `App.tsx`
- Hooks de fetch encapsulados em `src/hooks/`

### Zod + React Hook Form
- Todos os tipos de dominio definidos como schemas Zod em `src/types/`
- Inferencia: `z.infer<typeof schema>`
- Formularios validados com `react-hook-form` + Zod resolver

### Context API (Client State)
- `AuthContext`: sessao, usuario, currentProfileLite
- `ToastContext`: notificacoes toast
- `DebugContext`: overlay de debug (dev)
- Hierarquia: `QueryClientProvider → ToastProvider → AuthProvider → AppContent`

### Estrategia Factory (SuperMa)
- `superMaFactory.ts` decide entre `superMaServiceDev` (mock) e `superMaServiceProd` (real)
- Ativado por: `role = 'admin'` AND `is_master_admin = true`

### Exportacao de Dados
- Exportadores dedicados por formato: `csvExporter`, `excelExporter`, `pdfExporter`
- Exportadores por dominio: `contactsExporter`, `budgetExporter`

---

## Servicos Principais (`src/services/`)

| Arquivo | Dominio |
|---------|---------|
| `companiesService.ts` | Empresas/contas |
| `contactsService.ts` | Contatos + canais |
| `dealsService.ts` | Oportunidades |
| `profilesService.ts` | Perfis de usuarios |
| `cockpitService.ts` | Pipeline de vendas |
| `vision360Service.ts` | Visao 360 + calculos |
| `dashboardService.ts` | Agregacao dashboard |
| `chatsService.ts` | Mensagens/chat |
| `ticketsService.ts` | Tickets de suporte |
| `agendaService.ts` | Eventos de calendario |
| `budgetService.ts` | Orcamentos |
| `tenantService.ts` | Organizacoes/tenants |
| `tagsService.ts` | Tags |
| `channelsService.ts` | Canais de comunicacao |
| `knowledgeService.ts` | Base de conhecimento |
| `integrationKeysService.ts` | Chaves de API |
| `exportTablesService.ts` | Exportacao de dados |
| `aiNotesService.ts` | Notas geradas por IA |
| `geminiModelsService.ts` | Config modelos Gemini |
| `maImpersonationClient.ts` | Cliente SuperMa |
| `ai/geminiChatService.ts` | Chat Gemini |
| `ai/vision360AiService.ts` | Insights IA 360 |
| `ai/actionsAiService.ts` | Sugestoes de acoes IA |
| `backup/backupService.ts` | Geracao de backup |
| `backup/backupHistoryService.ts` | Historico de backups |

---

## Edge Functions (`supabase/functions/`)

| Funcao | Metodo | Descricao |
|--------|--------|-----------|
| `create-user-with-profile` | POST | Cria auth user + profile com rollback |
| `delete-user` | DELETE | Remove auth user + profile |
| `generate-backup-full` | POST | Gera backup completo do banco |
| `ma-impersonation` | POST | Liga/desliga impersonacao Master Admin |

Todas as functions compartilham `_shared/cors.ts` com headers padrao.

---

## Autenticacao e Autorizacao

### Fluxo
1. Login/signup via Supabase Auth (email + senha) em `AuthPage.tsx`
2. `AuthContext` persiste sessao e busca `currentProfileLite` assincronamente
3. RPC `bind_profile_after_login` vincula profile ao auth user
4. Evento customizado `auth:userReady` e disparado apos profile carregado
5. Rotas protegidas: sem sessao → `AuthPage`; com sessao → dashboard

### Roles (profiles.role)
- `admin`: acesso total; pode ser Master Admin se `is_master_admin = true`
- `editor`: pode editar base de conhecimento (`kb_can_edit = true`)
- `user`: acesso padrao

### Master Admin (SuperMa)
- Hotkey: `Ctrl+Shift+|`
- Requer: `role = 'admin'` E `is_master_admin = true`
- Modal de selecao de usuario para impersonacao
- Tema overlay: `data-theme="super-ma"`
- Edge Function `ma-impersonation` realiza o swap de sessao

---

## Banco de Dados

### Tabelas Principais

| Tabela | Descricao |
|--------|-----------|
| `org_tenants` | Organizacoes/empresas clientes |
| `profiles` | Usuarios com tenant_id + role |
| `companies` | Contas/empresas do CRM |
| `contacts` | Contatos com canais (email, phone, whatsapp…) |
| `contact_channels` | Canais de comunicacao por contato |
| `deals` | Oportunidades/negociacoes |
| `tickets` | Tickets de suporte |
| `chats` | Mensagens e chats |
| `agenda` | Eventos de calendario |
| `tags` | Tags de categorizacao |
| `budget` | Orcamentos |
| `channels` | Canais de comunicacao |

### Convencoes do Banco
- Todas as tabelas tem `tenant_id` (multi-tenant)
- Campos de auditoria em todas: `created_at`, `updated_at`, `created_by`, `updated_by`
- Soft delete com `deleted_at` (onde aplicavel)
- RLS habilitado em todas as tabelas
- Triggers de auto-update: `app_set_updated_at`
- Enums em Portugues: `aberta`, `ganha`, `perdida`, `em_espera`

### Supabase Local
- API: porta `54321`
- Banco: porta `54322`
- Studio: porta `54323`
- Email testing (Inbucket): porta `54324`

---

## Design System (Neumorfico)

### Principio
Design neumorfico com sombras suaves criando efeito de profundidade em superficies.

### Tokens Tailwind Customizados

```js
// tailwind.config.js
boxShadow: {
  'neumorphic-convex': '6px 6px 12px #a9b1c0, -6px -6px 12px #ffffff',
  'neumorphic-concave': 'inset 6px 6px 12px #a9b1c0, inset -6px -6px 12px #ffffff',
  // dark mode
  'dark-neumorphic-convex': '...',
  'dark-neumorphic-concave': '...',
}
```

### Cores Customizadas
- `plate` / `plate-dark`: Cor de fundo dos paineis
- `primary`: `#1c4c96` (azul primario)
- Sombras: claro `#ffffff` / escuro `#a9b1c0`

### Dark Mode
- Ativado via classe CSS: `dark` no elemento raiz
- Tailwind `darkMode: 'class'`
- Toggle no Sidebar

### Status Colors (statusHelper.ts)
- Verde: concluido (`isDone = true`)
- Vermelho: atrasado (data passada + nao concluido)
- Azul: pendente

---

## Convencoes de Codigo

### Importacoes
- Alias `@/` aponta para `src/`
- Exemplo: `import { supabase } from '@/lib/supabaseClient'`

### Tipos
- Schemas Zod em `src/types/*.ts`
- Sempre exportar schema + tipo inferido:
  ```ts
  export const profileSchema = z.object({ ... })
  export type Profile = z.infer<typeof profileSchema>
  ```

### Servicos
- Cada servico e um modulo com funcoes puras (sem estado)
- Funcoes nomeadas descritivamente: `getCompaniesByTenant`, `updateDealStatus`
- Sempre filtrar por `tenant_id` nas queries

### Componentes
- Organizados por feature dentro de `src/components/[Feature]/`
- Componentes de UI base em `src/components/UI/`
- Skeletons de loading junto ao componente: `src/components/Vision360/skeletons/`

### Hooks
- Prefixo `use`: `useAuth`, `useMediaQuery`, `useDashboardQuadro1`
- Encapsulam React Query + side effects
- Localizados em `src/hooks/`

### Hotkeys (App.tsx)
- `Ctrl+Shift+|`: Abre modal SuperMa
- `Ctrl+Shift+0`: Toggle DebugOverlay

### Icones
- Sempre via `iconHelper.tsx` para canais de contato
- Lucide React para icones gerais

---

## Variaveis de Ambiente

Arquivo `.env` na raiz (prefixo `VITE_` obrigatorio para Vite):

```env
VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
VITE_SUPABASE_ANON_KEY="<anon-key-jwt>"
```

> A chave anonima e segura para client-side. RLS garante isolamento de dados.
> Nunca commitar `service_role` key no frontend.

---

## Comandos

```bash
# Desenvolvimento
npm run dev           # Inicia servidor de dev (Vite, porta 3000)

# Build
npm run build         # Compila TS + build Vite (output: dist/)

# Preview
npm run preview       # Serve build de producao localmente

# Lint
npm run lint          # ESLint com max-warnings 0

# Supabase local
supabase start        # Inicia stack Supabase local
supabase stop         # Para stack local
supabase db reset     # Reset + replay de todas as migrations
supabase migration new <name>    # Nova migration
supabase functions serve         # Serve Edge Functions localmente
supabase functions deploy <name> # Deploy de uma Edge Function
```

---

## Pipeline de Vendas (Cockpit)

Estagios do pipeline em ordem:
1. **Captura**
2. **Qualificacao**
3. **Proposta**
4. **Negociacao**
5. **Fechamento**

Status de deals: `aberta` | `ganha` | `perdida` | `em_espera`

---

## Integracao com IA

- **Provedor**: Google Gemini API
- **Servicos**:
  - `geminiChatService.ts`: Chat assistente
  - `vision360AiService.ts`: Insights sobre cliente 360
  - `actionsAiService.ts`: Sugestoes de proximas acoes
  - `aiNotesService.ts`: Notas auto-geradas
- **Config de modelos**: `geminiModelsService.ts`
- As chaves da API Gemini sao gerenciadas via `integrationKeysService.ts` (salvas no banco)

---

## Deploy (Netlify)

```toml
# netlify.toml
[build]
  command = "npm install && npm run build"
  publish = "dist"
  environment: NODE_VERSION = "18"

[dev]
  command = "vite"
  port = 3000
```

SPA: Todas as rotas redirecionam para `index.html` (configurado no Netlify).

---

## Regras Importantes

1. **Nunca commitar service_role key** do Supabase no frontend.
2. **Sempre filtrar por tenant_id** em todas as queries — o RLS e permissivo no MVP, entao o filtro no codigo e a linha de defesa.
3. **Schemas Zod sao a fonte de verdade** dos tipos — nao criar interfaces TypeScript manualmente para dominios que ja tem schema.
4. **Servicos nao tem estado** — toda logica de estado fica em hooks ou componentes.
5. **React Query e o padrao para dados remotos** — nao usar useState + useEffect para fetch de dados.
6. **Design neumorfico** — usar as shadow utilities customizadas do Tailwind, nao sombras brutas inline.
7. **Exportadores existem** — antes de criar logica de export, verificar `src/utils/*Exporter.ts`.
8. **SuperMa requer confirmacao** — nunca alterar a logica de `is_master_admin` sem entender o impacto de seguranca.
9. **Migrations sao incrementais** — nunca editar migrations existentes; sempre criar novas.
10. **Edge Functions usam Deno** — sintaxe e imports sao diferentes do Node.js.
11. **Alias `@/`** — sempre usar em vez de caminhos relativos longos (`../../..`).
12. **Idioma** — strings de UI em Portugues Brasileiro; codigo e comentarios podem ser em ingles.

---

## COMPLEMENTO EVA — Verificado via MCP Supabase (2026-03-16)

### ⚠️ Correcoes em relacao ao CLAUDE.md gerado pelo Claude Code

#### Tabela com nome incorreto
- ❌ `contact_channels` (documentado acima) — tabela NAO existe no banco
- ✅ `contacts_channel` — nome real no banco (verificado via MCP)

Ao referenciar no codigo, sempre usar `contacts_channel`.

#### Tabelas ausentes na documentacao
As tabelas abaixo existem em producao mas nao foram documentadas:

| Tabela | Descricao |
|--------|-----------|
| `contacts_channel` | Canais de contato — nome correto (ver correcao acima) |
| `ticket_sequences` | Controle de numeracao sequencial de tickets por tenant |
| `integration_keys` | Chaves de API externas (Gemini, etc) |
| `backups` | Registro historico de backups gerados pela aplicacao |
| `ma_impersonation_sessions` | Log de sessoes de impersonacao Master Admin |
| `ai_notes` | Notas geradas automaticamente por IA — com `search_tsv` full-text |

#### Correcao — Regra #2 (RLS)
A regra original diz: *"o RLS e permissivo no MVP, entao o filtro no codigo e a linha de defesa"*

⚠️ **Isso esta impreciso e e perigoso como instrucao para o Claude Code.**

**Correcao:**
- RLS esta habilitado em **todas** as 15 tabelas e e a linha de defesa primaria
- O filtro por `tenant_id` no codigo e uma camada adicional de seguranca e boas praticas
- **Nunca** depender apenas do filtro no codigo — o RLS deve ser sempre a protecao principal
- Ao criar novas tabelas, sempre: `ALTER TABLE public.<tabela> ENABLE ROW LEVEL SECURITY` + policy correspondente

---

### Informacoes de Infraestrutura (via MCP)

| Item | Valor |
|------|-------|
| Project ID | `oadnblyoqmqvnfekisxp` |
| Regiao | `us-east-2` (Ohio) |
| PostgreSQL | 17.6 |
| URL | `https://oadnblyoqmqvnfekisxp.supabase.co` |
| Migrations registradas no CLI | 0 (banco construido manualmente) |
| Migrations no repositorio | 35+ arquivos (mai/2025 → dez/2025) |
| Edge Functions deployadas | 4 |
| Plano | Free |

---

### Backlog v0101 — Referencia rapida

Ver documento completo: `auditoria_360_crmappy_v0100_20260316.md`

**Ordem de ataque:**
1. ⚡ Quick Win: mover extensao `http` para schema `extensions` (5 min)
2. 🎨 FASE 1 — Design System Premium (migrar Neumorfismo para identidade propria)
3. 🏗️ FASE 2 — Refatoracao `EditActionForm.tsx` + melhorias solicitadas pelo usuario
4. 🔧 FASE 3 — Arquitetura restante + migrations CLI
5. 🗄️ FASE 4 — Banco (RLS, indices, politicas duplicadas)

**Tickets ativos:**
- SUP-000001: CRUD no Cockpit — editar empresa/contatos/canais durante ligacao
- SUP-000005: Bug — status da acao nao salva como Concluida
- SUP-000006: Bug — agendamento nao aparece no icone do dia
- SUP-000004: Fechamento mensal de negocios (ganhos/perdidos por mes)
- Card "Empresas com Acoes Ativas" — lista longa demais (+20/30 empresas)
- Hub de Gestao — ultima entrega apos tudo concluido

---

### Protocolo Novo Chat — CRMappy

```
"Eva, novo chat do projeto CRMappy v0101. Contexto completo abaixo:"
[colar este CLAUDE.md completo incluindo o complemento Eva]
```

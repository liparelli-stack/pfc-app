# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **CRM Appy v0.1.2** | Branch: `crmappy-v0102`

---

## Comandos

```bash
npm run dev       # Dev server (Vite, porta 3000)
npm run build     # tsc + vite build → dist/
npm run lint      # ESLint (TypeScript + React, zero warnings)
npm run preview   # Preview do build de produção
```

> Não há test runner configurado (Vitest/Jest).

Supabase local:
```bash
supabase start
supabase db reset
supabase migration new <name>
supabase functions deploy <name>
```

---

## Descrição do Sistema

CRM Appy é uma plataforma CRM moderna para gestão de relacionamento com clientes, vendas, agenda e base de conhecimento. Suporte multi-tenant, integrações com IA (Google Gemini) e impersonação de usuários via Master Admin.

- Idioma da interface: Português Brasileiro (pt-BR)
- Deploy: Netlify (SPA)
- Backend: Supabase (PostgreSQL + Auth + Edge Functions)

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | React 18.2 + TypeScript 5.2 |
| Build | Vite 5.4 |
| Estilização | Tailwind CSS 3.4 (design system próprio) |
| Estado servidor | TanStack React Query 5 |
| Formulários | React Hook Form 7 + Zod 4 |
| Componentes base | Radix UI (Select, Switch, Popover) |
| Ícones | Lucide React |
| Animações | Framer Motion 11 |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Gráficos | ECharts (echarts-for-react) |
| Exportação | xlsx, jsPDF + jspdf-autotable, docx, file-saver |
| Markdown | react-markdown + rehype-raw + remark-gfm |
| Utilitários | lodash-es, date-fns, clsx |
| Banco de dados | Supabase (PostgreSQL 17.6) |
| Auth | Supabase Auth (JWT, email+senha) |
| Edge Functions | Deno (Supabase Functions) |
| IA | Google Gemini API |
| Deploy | Netlify |

---

## Estrutura de Pastas

```
src/
├── pages/              # 19 páginas (uma por rota)
├── components/         # Componentes por feature + UI base
│   ├── Cockpit/        # Pipeline kanban + CRUD inline
│   ├── Dashboard/
│   ├── Vision360/
│   ├── Deals/
│   ├── AgendaX/
│   ├── Knowledge/
│   ├── Shared/
│   └── UI/             # Design System v0101 (componentes base)
├── services/           # 34 serviços — funções puras, sem estado
│   ├── ai/             # actionsAiService, geminiChatService, vision360AiService
│   └── backup/         # backupService, backupHistoryService, backupTablesCatalog
├── hooks/              # 21 hooks customizados (React Query)
├── types/              # 16 arquivos — schemas Zod + tipos TypeScript inferidos
├── contexts/           # AuthContext, ToastContext, DebugContext
├── utils/              # Helpers + exporters (Excel, PDF, CSV)
│   └── exporters/      # monthlyClosureExporter
├── superMa/            # Módulo Master Admin (impersonação)
├── schemas/            # Schemas adicionais
├── providers/          # Providers React
├── config/             # Constantes de configuração
├── data/               # Dados estáticos
└── lib/
    └── supabaseClient.ts
supabase/
├── functions/          # Edge Functions (Deno)
└── migrations/         # Migrations incrementais SQL
```

---

## Fluxo de Dados

```
Page → Hook (src/hooks/use*.ts) → Service (src/services/*Service.ts) → Supabase (RLS) → PostgreSQL
```

- **Hooks** gerenciam cache via React Query; **não usar** `useState + useEffect` para fetch.
  - **Exceção:** hooks de lookup simples para dropdowns (`useCompaniesLookup.ts`, `useSalespersons.ts`) usam `useState + useEffect` — listas estáticas sem necessidade de cache/invalidação.
- **Services** são funções puras sem estado.
- **RLS é a proteção primária** — filtro no código é camada adicional, não substituto.

---

## Padrões Arquiteturais

### Multi-Tenant

- Todos os dados possuem `tenant_id` (FK → `org_tenants`)
- Isolamento garantido por RLS no Supabase
- **IMPORTANTE:** No Cockpit, filtro adicional por `owner_user_id` — cada vendedor vê só suas empresas (inclusive admin)

### React Query (Server State)

- TanStack React Query v5 para cache e sincronização
- Sempre invalidar queries após mutations: `queryClient.invalidateQueries({ queryKey: [...] })`

### Zod + React Hook Form

- Todos os tipos de domínio definidos como schemas Zod em `src/types/`
- Nunca criar interfaces TypeScript manualmente — usar `z.infer<typeof schema>`

### Context API (Client State)

- Hierarquia: `QueryClientProvider → ToastProvider → AuthProvider → AppContent`

---

## Banco de Dados

### Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `org_tenants` | Organizações/empresas clientes |
| `profiles` | Usuários com `tenant_id` + `role` |
| `companies` | Contas/empresas do CRM |
| `contacts` | Contatos |
| `contacts_channel` | Canais de contato (não `contact_channels`) |
| `deals` | Oportunidades/negociações |
| `tickets` | Tickets de suporte |
| `chats` | Ações/mensagens (usado no Cockpit) |
| `agenda` | Eventos de calendário |
| `tags` | Tags de categorização |
| `budget` | Orçamentos |
| `budget_events` | Log append-only de mudanças em orçamentos |
| `sales_monthly_targets` | Metas mensais por vendedor |
| `budget_monthly_closures` | Snapshots imutáveis de meses fechados |

### Convenções

- Todas as tabelas têm `tenant_id` (multi-tenant)
- Campos de auditoria: `created_at`, `updated_at`, `created_by`, `updated_by`
- Soft delete com `deleted_at` (onde aplicável)
- RLS habilitado em todas as tabelas
- Trigger de auto-update: `app_set_updated_at`
- Enums em Português: `aberta | ganha | perdida | em_espera`
- **Migrations são incrementais** — nunca editar existentes; sempre criar novas

### Supabase Produção

- Project ID: `oadnblyoqmqvnfekisxp`
- Região: us-east-2 (Ohio) | PostgreSQL 17.6 | Plano Free

---

## Autenticação e RLS

### Fluxo

1. Supabase Auth gera JWT → `auth.uid()` disponível no banco
2. Funções helper resolvem contexto:
   - `app.current_profile_id()` → `profiles.id` do usuário ativo
   - `app.current_tenant_id()` → `tenant_id` do usuário ativo
   - `app.is_master_admin()` → flag MA do usuário ativo
3. RLS usa funções helper: `USING (tenant_id = app.current_tenant_id())`

O `AuthContext` propaga `user`, `profile`, `tenantId` via React Context — não passar `tenant_id` manualmente em queries.

### Regra de Ouro

- **RLS garante:** Isolamento de tenant (segurança do banco)
- **Frontend garante:** Controle de permissões (admin, MA, visibilidade)
- Validações de role (`admin`, `MA`) são implementadas no código, **não** no RLS

```sql
-- ✅ Correto: só isolamento de tenant
CREATE POLICY example_tenant_isolation ON tabela FOR ALL TO authenticated
USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

-- ❌ Evitar: validar role no RLS
-- USING (... AND app.current_role() = 'admin')
```

### Roles

- `admin`: acesso total; pode ser Master Admin se `is_master_admin = true`
- `editor`: pode editar base de conhecimento (`kb_can_edit = true`)
- `user`: acesso padrão

### Master Admin (SuperMa)

- Hotkey: `Ctrl+Shift+|`
- Requer: `role = 'admin'` E `is_master_admin = true`
- Edge Function `ma-impersonation` realiza swap de sessão
- Módulo isolado em `src/superMa/`

---

## Design System v0101

Sistema de profundidade com 4 layers. Usar sempre os tokens — nunca cores hardcoded.

```js
// tailwind.config.js — tokens principais
colors: {
  // Light mode
  'light-bg': '#F4F5F7',   // App background
  'light-s1': '#EEF0F4',   // Cards base
  'light-s2': '#F8F9FB',   // Hover/active
  'light-t1': '#1a1d24',   // Texto principal
  'light-t2': '#555b68',   // Texto secundário
  'light-t3': '#9096a3',   // Texto muted

  // Dark mode
  'dark-bg':  '#0c0d10',
  'dark-s1':  '#13151a',
  'dark-s2':  '#1a1d24',
  'dark-t1':  '#f0eeec',
  'dark-t2':  '#9096a3',
  'dark-t3':  '#555b68',

  // Accent
  'accent-light': '#3b68f5',
  'accent-dark':  '#4f7cff',
  'success':      '#3ecf8e',
  'warning':      '#f59e0b',
  'danger':       '#f06060',
  'ai-insight':   '#a78bfa',
}

boxShadow: {
  'sh1': '0 1px 3px rgba(0,0,0,0.32), 0 4px 16px rgba(0,0,0,0.22)',
  'sh2': '0 2px 8px rgba(0,0,0,0.38), 0 8px 28px rgba(0,0,0,0.28)',
}

borderRadius: { 'r': '8px', 'rlg': '12px', 'rxl': '16px' }
fontFamily:   { 'sans': ['DM Sans'], 'mono': ['DM Mono'] }
```

Padrão de cards:

```tsx
className="bg-light-s1 dark:bg-dark-s1
           border border-light-bmd dark:border-dark-bmd
           rounded-xl shadow-[var(--sh1)] hover:shadow-[var(--sh2)]"
```

---

## Pipeline de Vendas (Cockpit)

Estágios em ordem: Captura → Qualificação → Proposta → Negociação → Fechamento

Status de deals: `aberta | ganha | perdida | em_espera`

---

## Integração com IA

- **Provedor:** Google Gemini API
- `src/services/ai/geminiChatService.ts` — Chat assistente
- `src/services/ai/vision360AiService.ts` — Insights sobre cliente 360
- `src/services/ai/actionsAiService.ts` — Sugestões de próximas ações
- `src/services/aiNotesService.ts` — Notas auto-geradas
- `src/services/geminiModelsService.ts` — Config de modelos

---

## Variáveis de Ambiente

```env
VITE_SUPABASE_URL="https://oadnblyoqmqvnfekisxp.supabase.co"
VITE_SUPABASE_ANON_KEY="<anon-key-jwt>"
```

Alias `@/` aponta para `src/` — usar sempre em vez de caminhos relativos.

---

## Regras Importantes

1. **Schemas Zod são fonte de verdade** — não criar interfaces TypeScript manualmente
2. **Serviços não têm estado** — toda lógica de estado fica em hooks ou componentes
3. **React Query para dados remotos** — sempre invalidar queries após mutations
4. **Design System v0101** — usar tokens CSS, nunca cores hardcoded
5. **Timezone:** sempre usar `.toISOString()` ou getters UTC (`getUTCFullYear/Month/Date`)
6. **Migrations são incrementais** — nunca editar existentes; sempre criar novas
7. **Edge Functions usam Deno** — sintaxe diferente do Node.js
8. **Normalização de texto:** usar `normalizeText()` de `src/utils/textNormalization.ts` para buscas
9. **Cockpit:** filtrar por `tenant_id` E `owner_user_id` — RLS é primeira linha, código é segunda

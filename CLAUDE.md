# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **CRM Appy v0.1.1** | Última atualização: 2026-03-25 | Branch: `crmappy-v0101-m2503`

---

## Comandos

```bash
npm run dev       # Dev server (Vite, porta 3000)
npm run build     # tsc + vite build → dist/
npm run lint      # ESLint (TypeScript + React, zero warnings)
npm run preview   # Preview do build de produção
```

> Não há test runner configurado (Vitest/Jest). Para adicionar, instalar Vitest.

---

## Fluxo de dados

```
Page → Hook (src/hooks/use*.ts) → Service (src/services/*Service.ts) → Supabase (RLS) → PostgreSQL
```

- **Hooks** gerenciam cache via React Query; nunca use `useState + useEffect` para fetch.
- **Services** são funções puras sem estado.
- **RLS é a proteção primária** — filtro no código é camada adicional, não substituto.

---

## Descrição do Sistema

CRM Appy é uma plataforma CRM moderna e completa para gestão de relacionamento com clientes, vendas, agenda e base de conhecimento. Possui design system próprio (migrado de neumorfismo), suporte multi-tenant, integrações com IA (Google Gemini) e impersonação de usuários via Master Admin.

- Idioma da interface: Português Brasileiro (pt-BR)
- Deploy: Netlify (SPA)
- Backend: Supabase (PostgreSQL + Auth + Edge Functions)
- Branch atual: crmappy-v0101-m2403 (24/03/2026)

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | React 18.2 + TypeScript 5.2 |
| Build | Vite 5.4 |
| Estilização | Tailwind CSS 3.4 (design system próprio — ver seção Design System) |
| Estado servidor | TanStack React Query 5 |
| Formulários | React Hook Form 7 + Zod 4 |
| Componentes base | Radix UI (Select, Switch, Popover) |
| Ícones | Lucide React 0.395 |
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
crmappy-v0101/
├── src/
│   ├── pages/              # 13 páginas
│   ├── components/         # Componentes por feature + UI base
│   │   ├── Cockpit/        # Pipeline + CRUD inline + hooks
│   │   ├── Dashboard/
│   │   ├── Vision360/
│   │   ├── Deals/
│   │   ├── AgendaX/
│   │   ├── Knowledge/
│   │   ├── Shared/
│   │   └── UI/             # Design System v0101
│   ├── services/           # ~38 serviços
│   ├── hooks/              # ~16 hooks customizados
│   ├── types/              # Schemas Zod + tipos TypeScript
│   ├── contexts/           # AuthContext, ToastContext, DebugContext
│   ├── utils/              # Helpers + exporters
│   └── lib/
│       └── supabaseClient.ts
├── supabase/
│   ├── functions/          # 4 Edge Functions
│   └── migrations/         # 35+ arquivos SQL
├── tailwind.config.js      # Design System v0101 tokens
├── vite.config.ts
├── netlify.toml
└── package.json

```
---

Padrões Arquiteturais
Multi-Tenant

Todos os dados possuem tenant_id (FK → org_tenants)
Isolamento garantido por RLS no Supabase
IMPORTANTE: No Cockpit, filtro adicional por owner_user_id (cada vendedor vê só suas empresas)

Service Layer

Cada domínio tem *Service.ts dedicado em src/services/
Servicos encapsulam queries Supabase + lógica de negócio
Consumidos por componentes via React Query ou hooks customizados

React Query (Server State)

TanStack React Query v5 para cache e sincronização
Sempre invalidar queries após mutations (create/update/delete)

Zod + React Hook Form

Todos os tipos de domínio definidos como schemas Zod em src/types/
Inferência: z.infer<typeof schema>

Context API (Client State)

AuthContext: sessão, usuario, currentProfileLite
ToastContext: notificações toast
Hierarquia: QueryClientProvider → ToastProvider → AuthProvider → AppContent


Banco de Dados
Tabelas Principais
TabelaDescriçãoorg_tenantsOrganizações/empresas clientesprofilesUsuários com tenant_id + rolecompaniesContas/empresas do CRMcontactsContatoscontacts_channelNome correto (não contact_channels)dealsOportunidades/negociaçõesticketsTickets de suportechatsAções/mensagens (usado no Cockpit)agendaEventos de calendáriotagsTags de categorizaçãobudgetOrçamentos
Convenções

Todas as tabelas têm tenant_id (multi-tenant)
Campos de auditoria: created_at, updated_at, created_by, updated_by
Soft delete com deleted_at (onde aplicável)
RLS habilitado em todas as tabelas
Triggers de auto-update: app_set_updated_at
Enums em Português: aberta, ganha, perdida, em_espera

Supabase Produção

Project ID: oadnblyoqmqvnfekisxp
Região: us-east-2 (Ohio)
PostgreSQL: 17.6
Plano: Free


Design System v0101
Princípio
Substituiu neumorfismo por identidade visual própria com sistema de profundidade (4 layers).
Tokens Principais
javascript// tailwind.config.js
colors: {
  // Light mode
  'light-bg': '#F4F5F7',    // App background
  'light-s1': '#EEF0F4',    // Cards base
  'light-s2': '#F8F9FB',    // Hover/active
  'light-t1': '#1a1d24',    // Texto principal
  'light-t2': '#555b68',    // Texto secundário
  'light-t3': '#9096a3',    // Texto muted
  
  // Dark mode
  'dark-bg': '#0c0d10',     // App background
  'dark-s1': '#13151a',     // Cards base
  'dark-s2': '#1a1d24',     // Hover/active
  'dark-t1': '#f0eeec',     // Texto principal
  'dark-t2': '#9096a3',     // Texto secundário
  'dark-t3': '#555b68',     // Texto muted
  
  // Accent colors
  'accent-light': '#3b68f5',
  'accent-dark': '#4f7cff',
  'success': '#3ecf8e',
  'warning': '#f59e0b',
  'danger': '#f06060',
  'ai-insight': '#a78bfa',
}

boxShadow: {
  'sh1': '0 1px 3px rgba(0,0,0,0.32), 0 4px 16px rgba(0,0,0,0.22)',
  'sh2': '0 2px 8px rgba(0,0,0,0.38), 0 8px 28px rgba(0,0,0,0.28)',
}

borderRadius: {
  'r': '8px',
  'rlg': '12px',
  'rxl': '16px',
}

fontFamily: {
  'sans': ['DM Sans', 'sans-serif'],
  'mono': ['DM Mono', 'monospace'],
}
Padrão de Cards
tsxclassName="bg-light-s1 dark:bg-dark-s1 
           border border-light-bmd dark:border-dark-bmd 
           rounded-xl 
           shadow-[var(--sh1)]
           hover:shadow-[var(--sh2)]"

Refatoração v0101 (FASE 2 Concluída)
EditActionForm.tsx

Antes: ~2.000 linhas (god component)
Depois: 507 linhas (-74,65%)
Arquivos criados:

Hooks: useTagsManager.ts, useActionAI.ts, useBudgetManager.ts, useActionSubmit.ts
Componentes: ActionTagSelector.tsx, AiInsightsPanel.tsx, SegmentedToggle.tsx, TagChip.tsx
Utils: colors.ts, actionMappers.ts, actionHelpers.ts, textNormalization.ts
Config: actionConstants.ts


CRUD Inline no Cockpit (SUP-000001)
Componentes criados:

CockpitEditCompanyForm.tsx — Editar empresa
CockpitEditContactForm.tsx — Criar/editar contato
CockpitContactChannels.tsx — CRUD de canais

Regra importante: Sempre invalidar queries após salvar:
typescriptqueryClient.invalidateQueries({ queryKey: ['contacts', companyId] })
queryClient.invalidateQueries({ queryKey: ['company-details', companyId] })

Correções Críticas Aplicadas (m2403 - 24/03/2026)
1. Segurança — Filtro owner_user_id no Cockpit
Problema: Usuário via empresas de outros vendedores
Solução: Adicionado filtro .eq('owner_user_id', userId) em queries de busca
Regra: No Cockpit, TODOS (incluindo admin) veem só suas empresas
2. SUP-000005 — Status "Concluída" não salvava
Commits: 4c72a6d + c0053bb
Bug #1 (Crítico): useEffect resetava form antes de salvar
typescript// ANTES (bug):
useEffect(() => {
  if (!nextOpen) reset(defaults);
}, [defaults, nextOpen, reset]); // ← defaults recriava, resetava is_done

// DEPOIS (corrigido):
useEffect(() => {
  if (!nextOpen) reset(defaults);
}, [nextOpen]); // ← só reseta quando nextOpen muda
Bug #2 (Consistência): done_at não era preenchido
typescript// Adicionado em useActionSubmit.ts:
done_at: formData.is_done ? new Date().toISOString() : null
3. Dropdown de Contato — Cache não invalidava
Problema: Contato criado não aparecia no dropdown
Solução: queryClient.invalidateQueries() após criar contato
4. SUP-000006 — Ícone de agenda (timezone)
Commit: 3564861
Bug: Último dia do mês não aparecia no badge do calendário (UTC-3)
Causa: toIsoYmdUTC() usava getters locais em Date UTC
typescript// ANTES (bug em UTC-3):
function toIsoYmdUTC(d: Date): string {
  const tz = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return tz.toISOString().slice(0, 10);
}

// DEPOIS (correto em qualquer timezone):
function toIsoYmdUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}
Arquivo: src/services/agendaXBridge.ts linha 112

Autenticação e Autorização
Fluxo

Login/signup via Supabase Auth em AuthPage.tsx
AuthContext persiste sessão e busca currentProfileLite
RPC bind_profile_after_login vincula profile ao auth user
Evento customizado auth:userReady disparado após profile carregado

Roles

admin: acesso total; pode ser Master Admin se is_master_admin = true
editor: pode editar base de conhecimento (kb_can_edit = true)
user: acesso padrão

Master Admin (SuperMa)

Hotkey: Ctrl+Shift+|
Requer: role = 'admin' E is_master_admin = true
Edge Function ma-impersonation realiza swap de sessão


Variáveis de Ambiente
envVITE_SUPABASE_URL="https://oadnblyoqmqvnfekisxp.supabase.co"
VITE_SUPABASE_ANON_KEY="<anon-key-jwt>"

Nunca commitar service_role key no frontend.

Comando

Comandos
bash# Desenvolvimento
npm run dev           # Vite, porta 3000

# Build
npm run build         # Compila TS + build Vite (output: dist/)

# Supabase local
supabase start
supabase db reset
supabase migration new <name>
supabase functions deploy <name>
```

---

## Pipeline de Vendas (Cockpit)

Estágios em ordem:
1. Captura
2. Qualificação
3. Proposta
4. Negociação
5. Fechamento

Status de deals: `aberta` | `ganha` | `perdida` | `em_espera`

---

## Integração com IA

- **Provedor:** Google Gemini API
- **Serviços:**
  - `geminiChatService.ts`: Chat assistente
  - `vision360AiService.ts`: Insights sobre cliente 360
  - `actionsAiService.ts`: Sugestões de próximas ações
  - `aiNotesService.ts`: Notas auto-geradas
- **Config:** `geminiModelsService.ts`

---

## Regras Importantes

1. **Nunca commitar service_role key** do Supabase no frontend
2. **Sempre filtrar por tenant_id E owner_user_id no Cockpit** — RLS é primeira linha, filtro no código é segunda
3. **Schemas Zod são fonte de verdade** — não criar interfaces TypeScript manualmente
4. **Serviços não têm estado** — toda lógica de estado fica em hooks ou componentes
5. **React Query é padrão para dados remotos** — sempre invalidar queries após mutations
6. **Design System v0101** — usar tokens CSS, nunca cores hardcoded
7. **Timezone:** sempre usar `.toISOString()` ou getters UTC (getUTCFullYear/Month/Date)
8. **Migrations são incrementais** — nunca editar existentes; sempre criar novas
9. **Edge Functions usam Deno** — sintaxe diferente do Node.js
10. **Alias `@/`** — sempre usar em vez de caminhos relativos longos
11. **Normalização de texto:** usar `normalizeText()` de `textNormalization.ts` para buscas

---
## 🔐 Autenticação e RLS

### Fonte de Verdade: JWT + Funções Helper

**Fluxo de autenticação:**
1. Supabase Auth gera JWT → `auth.uid()` disponível no banco
2. Funções helper resolvem contexto do usuário:
   - `app.current_profile_id()` → `profiles.id` do usuário ativo
   - `app.current_tenant_id()` → `tenant_id` do usuário ativo
   - `app.is_master_admin()` → flag MA do usuário ativo

3. RLS usa funções helper para isolamento:
```sql
   USING (tenant_id = app.current_tenant_id())
```

**Frontend:**
- `AuthContext` propaga `user`, `profile`, `tenantId` via React Context
- Não há necessidade de passar `tenant_id` manualmente em queries
- RLS filtra automaticamente por tenant

**Regra de Ouro:**
- **RLS garante:** Isolamento de tenant (segurança do banco)
- **Frontend garante:** Controle de permissões (admin, MA, visibilidade)
- Validações de role (`admin`, `MA`) são implementadas no código, não no RLS

**Exemplo - Política Correta:**
```sql
-- ✅ Correto: só isolamento de tenant
CREATE POLICY example_tenant_isolation
ON tabela FOR ALL TO authenticated
USING (tenant_id = app.current_tenant_id())
WITH CHECK (tenant_id = app.current_tenant_id());

-- ❌ Evitar: validar role no RLS (fazer no frontend)
-- USING (... AND app.current_role() = 'admin')
```

**Referência:** Ver `Controle_via_Profiles__Auth__JWT.pdf` para detalhes completos.

---

## Changelog

### [m2503] - 2026-03-25

#### ✅ Adicionado
- **SUP-000006**: Sistema de Fechamento Mensal
  - Tabelas: `budget_events`, `sales_monthly_targets`, `budget_monthly_closures`
  - RPCs: `get_month_data`, `is_month_closed`, `close_month`
  - Edge Function: auto-close mensal (dia 5)
  - Interface: `/hub` → Fechamento Mensal (cards, tabela, exportação Excel/CSV/PDF)
  - Lógica: Encerrado não entra no total (linha informativa)

- **Metas Mensais**: Grid Jan-Dez para planejamento
  - Filtro automático por vendedores (`position ILIKE '%vendedor%'`)
  - Edição inline com auto-save
  - Cálculo de totais por mês
  - RLS: isolamento por tenant

#### 🔧 Corrigido
- Trigger `log_budget_change`: mapeamento correto de status "terminado" → "Encerrado"
- Trigger `log_budget_change`: campo `amount` vs `value` no JSONB
- Dados contaminados removidos (R$ 11M → R$ 959k em orçamentos abertos)
- RLS `sales_monthly_targets`: política simplificada (tenant isolation)
- Hook `useSalesTargets`: filtro case-insensitive para vendedores
- Cache invalidation após exclusão de orçamentos

#### 🗄️ Banco de Dados
- `budget_events`: log append-only de mudanças em orçamentos
- `sales_monthly_targets`: metas mensais por vendedor (target_quantity nullable)
- `budget_monthly_closures`: snapshots imutáveis de meses fechados
- Índices: `(tenant_id, salesperson_id, created_at)` em budget_events

#### 📋 Tech Debt identificado
- Criar tenant de testes com dados fictícios
- Corrigir 17 políticas RLS com initplan
- Criar 20 índices para FKs sem cobertura
- Atualizar `generate-backup-full` (incluir novas tabelas)

#### 📚 Documentação
- Seção "Autenticação e RLS" adicionada ao CLAUDE.md
- Padrão arquitetural: JWT + funções helper + tenant isolation

---

## Backlog v0101 (Atualizado 25/03/2026)

### ✅ Concluído
- ~~Segurança: filtro owner_user_id~~ (m2403)
- ~~SUP-000005: Status "Concluída" não salvava~~ (m2403)
- ~~SUP-000006: Ícone de agenda (timezone)~~ (m2403)
- ~~Dropdown contato não atualizava~~ (m2403)
- ~~SUP-000004: Fechamento Mensal de negócios~~ (m2503)
- ~~Metas Mensais: Grid Jan-Dez por vendedor~~ (m2503)

### 🆕 Features Pendentes
- **Card "Empresas com Ações Ativas":** Paginação (lista longa +20/30 empresas)

### 🎨 UX
- 1% final padronização DS no Cockpit

### 🔧 FASE 3 — Arquitetura
- Registrar migrations no Supabase CLI (`supabase migration repair`)
- Atualizar `generate-backup-full` (incluir `ai_notes` + `ma_impersonation_sessions` + novas tabelas m2503)

### 🗄️ FASE 4 — Banco
- Corrigir RLS initplan (17 políticas) — substituir `auth.uid()` por `(SELECT auth.uid())`
- Criar 20 índices para FKs sem cobertura
- Consolidar políticas RLS duplicadas
- Avaliar remoção de 18 índices não utilizados
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **CRM Appy v0.1.1** | Última atualização: 2026-03-23 | Branch: `crmappy-v0101-m2003`

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

**CRM Appy** é uma plataforma CRM moderna e completa para gestão de relacionamento com clientes, vendas, agenda e base de conhecimento. Possui design system próprio (Dark / Light / Sépia), suporte multi-tenant, integrações com IA (Google Gemini) e impersonação de usuários via Master Admin.

- **Idioma da interface:** Português Brasileiro (pt-BR)
- **Gerado com:** Dualite Alpha (AI design system)
- **Deploy:** Netlify (SPA)
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)

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
│   ├── pages/              # Páginas da aplicação (13 páginas)
│   ├── components/         # Componentes por feature + UI base
│   │   ├── Dashboard/
│   │   ├── Cockpit/
│   │   ├── Vision360/
│   │   ├── Deals/
│   │   ├── AgendaX/
│   │   ├── AgendaTimeline/
│   │   ├── Catalogs/
│   │   ├── Budgets/
│   │   ├── Knowledge/
│   │   ├── Lists/
│   │   ├── Settings/
│   │   ├── Support/
│   │   ├── Shared/
│   │   ├── UI/             # ← card, button, badge, input (v0101)
│   │   ├── Charts/
│   │   ├── SuperMa/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── DebugOverlay.tsx
│   ├── services/
│   ├── hooks/
│   ├── types/
│   ├── contexts/
│   ├── providers/
│   ├── lib/supabaseClient.ts
│   ├── utils/
│   ├── schemas/
│   ├── config/
│   ├── data/
│   ├── superMa/
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   ├── config.toml
│   ├── functions/
│   │   ├── create-user-with-profile/
│   │   ├── delete-user/
│   │   ├── generate-backup-full/
│   │   ├── ma-impersonation/
│   │   └── _shared/cors.ts
│   └── migrations/         # 35+ arquivos SQL + migration v0101
├── vite.config.ts
├── tailwind.config.js      # ← tokens v0101 ✅ APLICADO
├── tsconfig.app.json
├── netlify.toml
├── package.json
└── .env
```

---

## Design System v0101 — APROVADO ✅
> Substituiu o Neumorfismo. Referências: Linear + Vercel + Raycast.
> Aprovado em 2026-03-20 após 3 iterações + revisão Eva GPT.

### Fontes
| Uso | Fonte | Pesos |
|-----|-------|-------|
| Interface | DM Sans | 300 / 400 / 500 |
| Código / IDs | DM Mono | 400 / 500 |

> ⚠️ **Nunca usar font-weight 600 ou 700.** Destoa do padrão Linear/Vercel e fica pesado no dark mode.

### Temas suportados
`light` · `sépia` — ativos. `dark` descontinuado temporariamente na v0101 (fallback → sépia no localStorage).
A troca de tema alterna apenas entre light e sépia (`toggleTheme` em `App.tsx`).

### Paleta de cores

| Token | Light | Dark | Uso |
|-------|-------|------|-----|
| `--acc` | `#3b68f5` | `#4f7cff` | Ações primárias, links, seleção ativa |
| `--green` | `#0f9e62` | `#3ecf8e` | Ganha / Concluído / Success |
| `--amber` | `#b07408` | `#f59e0b` | Em espera / Warning / Morno |
| `--red` | `#d94040` | `#f06060` | Perdido / Atrasado / Danger |
| `--purple` | `#7c5cbf` | `#a78bfa` | AI Insight (exclusivo) |

> Cores descartadas: `#2563EB` (Tailwind blue-600 — azul mais genérico do mercado).

### Escala de superfícies

**Dark mode:**
```
layer 0 → #0c0d10  (app background)
layer 1 → #13151a  (cards base — shadow sh1 + border-top highlight)
layer 2 → #1a1d24  (hover / active)
layer 3 → #22262f  (selected / focus — accent ring)
layer 4 → #2c313c  (elementos internos de card)
```

**Light mode:**
```
layer 0 → #f4f5f7
layer 1 → #ffffff  (cards)
layer 2 → #f8f9fb
layer 3 → #eef0f4
neutro  → #5a5e6a  (text-2)
```

**Sépia:**
```
background → #f5ead8
text-1     → #3b2e1a
text-2     → #6b5438
text-3     → #9a7d5a
border     → rgba(100,70,30,0.15)
```

### Borders
```css
/* Dark */
--blo: rgba(255,255,255,0.06)   /* padrão */
--bmd: rgba(255,255,255,0.11)   /* hover / emphasis */
--bhi: rgba(255,255,255,0.17)   /* border-top highlight dos cards */

/* Light */
--blo: rgba(0,0,0,0.07)
--bmd: rgba(0,0,0,0.10)
--bhi: rgba(0,0,0,0.16)
```

> **Regra dos cards:** `border: 0.5px solid --bmd` + `border-top: 0.5px solid --bhi`
> Simula luz vinda de cima — cria volume sem sombra pesada. Padrão Linear.

### Shadows
```css
--sh1: 0 1px 3px rgba(0,0,0,0.32), 0 4px 16px rgba(0,0,0,0.22)   /* card base */
--sh2: 0 2px 8px rgba(0,0,0,0.38), 0 8px 28px rgba(0,0,0,0.28)   /* hover */
--sha: 0 0 0 1px var(--abrd), 0 4px 20px rgba(59,104,245,0.18)    /* focus/selected */
```

### Border-radius
```css
--r:   8px   /* botões, inputs, stages, action rows */
--rlg: 12px  /* cards, cockpit card, sidebar, modais */
--rxl: 16px  /* containers, wrapper externo */
```

### Transitions
```css
/* Global — aplicar em TODOS os elementos interativos */
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
```

### Hover pattern
```css
.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--sh2);
  border-color: var(--bhi);
}
/* Botão primário hover: opacity: 0.88 (não filter: brightness — some no dark) */
```

### Focus / Acessibilidade
```css
/* Botões */
:focus-visible { outline: 2px solid var(--acc); outline-offset: 2px; }

/* Inputs */
input:focus {
  border-color: var(--acc);
  box-shadow: 0 0 0 3px rgba(59,104,245,0.15);
}
```

### Componentes — anatomia aprovada

**Badges:** `border: 0.5px solid rgba(cor, 0.22)` + `background: cor-dim` + `color: cor`

**Pipeline stages:** active com `border-bottom: 2px solid var(--acc)` + `background: layer2`

**KPI cards:** valor em `color: #fff`, `font-weight: 500`, `letter-spacing: -0.03em`

**Sidebar nav item active:** `background: acc-dim` + `border: 0.5px solid rgba(acc, 0.20)` + `color: acc`

**Action rows:** hover `background: layer2` + `border-color: --bmd`

---

## Banco de Dados

### Infraestrutura
| Item | Valor |
|------|-------|
| Project ID | `oadnblyoqmqvnfekisxp` |
| Região | `us-east-2` (Ohio) |
| PostgreSQL | 17.6 |
| URL | `https://oadnblyoqmqvnfekisxp.supabase.co` |
| Plano | Free |
| Migrations no CLI | 0 registradas (banco construído manualmente — registrar na Fase 3) |

### Tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `org_tenants` | Organizações/empresas clientes |
| `profiles` | Usuários com tenant_id + role |
| `companies` | Contas/empresas do CRM |
| `contacts` | Contatos |
| `contacts_channel` | Canais de contato — ⚠️ nome correto (não `contact_channels`) |
| `deals` | Oportunidades/negociações |
| `tickets` | Tickets de suporte |
| `ticket_sequences` | Controle de numeração sequencial por tenant |
| `chats` | Mensagens e chats |
| `agenda` | Eventos de calendário |
| `tags` | Tags de categorização |
| `budget` | Orçamentos |
| `channels` | Canais de comunicação |
| `integration_keys` | Chaves de API externas (Gemini, etc) |
| `backups` | Registro histórico de backups |
| `ma_impersonation_sessions` | Log de sessões de impersonação Master Admin |
| `ai_notes` | Notas geradas por IA (com `search_tsv` full-text) |

### Convenções do banco
- Todas as tabelas têm `tenant_id` (multi-tenant)
- Campos de auditoria: `created_at`, `updated_at`, `created_by`, `updated_by`
- Soft delete com `deleted_at` (onde aplicável)
- RLS habilitado em **todas** as tabelas — é a linha de defesa primária
- Triggers de auto-update: `app_set_updated_at`
- Enums em Português: `aberta`, `ganha`, `perdida`, `em_espera`

### Status de segurança do banco
| Item | Status |
|------|--------|
| Extensão `http` no schema correto (`extensions`) | ✅ CORRIGIDO em 2026-03-20 |
| Leaked Password Protection | ⚠️ Indisponível no Free — ativar ao migrar para Pro |
| RLS initplan (`auth.uid()` por linha) | ⏳ Fase 4 — afeta 17 políticas em 7 tabelas |
| 20 FKs sem índice | ⏳ Fase 4 |
| Políticas RLS duplicadas | ⏳ Fase 4 |

---

## Padrões Arquiteturais

### Navegação (sem React Router)
A aplicação usa navegação por estado (`activeView: string`) em `App.tsx` — um switch `renderContent()` mapeia strings para componentes de página. Não há React Router. Para adicionar uma nova página:
1. Criar o componente em `src/pages/`
2. Importar e adicionar um `case` em `renderContent()`
3. Adicionar o item no `Sidebar.tsx`

### Multi-Tenant
- Todos os dados têm `tenant_id` (FK → `org_tenants`)
- RLS habilitado em todas as 15 tabelas — proteção primária
- Filtro por `tenant_id` no código — camada adicional de boas práticas
- **Nunca depender apenas do filtro no código**

### Service Layer
- `src/services/` — cada domínio tem `*Service.ts` dedicado
- Serviços encapsulam queries Supabase + lógica de negócio
- Funções puras, sem estado

### React Query (Server State)
- TanStack React Query v5 para cache e sincronização
- Hooks de fetch em `src/hooks/`
- **Não usar useState + useEffect para fetch de dados**

### Zod + React Hook Form
- Schemas Zod em `src/types/*.ts` — fonte de verdade dos tipos
- `z.infer<typeof schema>` — nunca criar interfaces manualmente para domínios com schema

---

## Edge Functions

| Função | Método | Descrição |
|--------|--------|-----------|
| `create-user-with-profile` | POST | Cria auth user + profile com rollback |
| `delete-user` | DELETE | Remove auth user + profile |
| `generate-backup-full` | POST | Gera backup completo — ⚠️ não cobre `ai_notes` e `ma_impersonation_sessions` (corrigir na Fase 3) |
| `ma-impersonation` | POST | Liga/desliga impersonação Master Admin |

---

## Autenticação e Autorização

### Roles
- `admin`: acesso total; pode ser Master Admin se `is_master_admin = true`
- `editor`: pode editar base de conhecimento (`kb_can_edit = true`)
- `user`: acesso padrão

### Master Admin (SuperMa)
- Hotkey: `Ctrl+Shift+|`
- Requer: `role = 'admin'` E `is_master_admin = true`
- Edge Function `ma-impersonation` realiza o swap de sessão
- DebugOverlay: `Ctrl+Shift+0` — painel de debug interno (apenas devs)

---

## Pipeline de Vendas (Cockpit)

1. Captura → 2. Qualificação → 3. Proposta → 4. Negociação → 5. Fechamento

Status de deals: `aberta` | `ganha` | `perdida` | `em_espera`

---

## Variáveis de Ambiente

```env
VITE_SUPABASE_URL="https://oadnblyoqmqvnfekisxp.supabase.co"
VITE_SUPABASE_ANON_KEY="<anon-key-jwt>"
```

> Nunca commitar `service_role` key no frontend.

---

## Regras Importantes

1. **Nunca commitar service_role key** do Supabase no frontend.
2. **RLS é a proteção primária** — sempre habilitado em todas as tabelas. Filtro no código é camada adicional, não substituto.
3. **Schemas Zod são a fonte de verdade** — não criar interfaces TypeScript manualmente para domínios que já têm schema.
4. **Serviços não têm estado** — toda lógica de estado fica em hooks ou componentes.
5. **React Query é o padrão para dados remotos** — não usar useState + useEffect para fetch.
6. **Design system próprio** — usar as classes e variáveis do novo DS (v0101). Não usar sombras neumórficas.
7. **Exportadores existem** — verificar `src/utils/*Exporter.ts` antes de criar lógica de export.
8. **SuperMa requer confirmação** — nunca alterar `is_master_admin` sem entender o impacto de segurança.
9. **Migrations são incrementais** — nunca editar migrations existentes; sempre criar novas.
10. **Edge Functions usam Deno** — sintaxe e imports são diferentes do Node.js.
11. **Alias `@/`** — sempre usar em vez de caminhos relativos longos.
12. **Idioma** — strings de UI em Português Brasileiro; código e comentários podem ser em inglês.
13. **Tabela `contacts_channel`** — esse é o nome correto no banco. `contact_channels` não existe.
14. **font-weight máximo: 500** — nunca usar 600 ou 700 no design system.

---

## Histórico de Decisões — Sessão 2026-03-20

### ✅ Concluído

#### Quick Win — Extensão `http` movida para `extensions`
- Migration `move_http_extension_to_extensions_schema` aplicada e verificada via MCP
- Método: `DROP EXTENSION IF EXISTS http CASCADE` + `CREATE EXTENSION http SCHEMA extensions`
- A extensão não suporta `SET SCHEMA` nativo — DROP+CREATE é o caminho correto
- Verificado: `SELECT extname, nspname FROM pg_extension JOIN pg_namespace...` → `schema: extensions` ✅

#### FASE 1 — Design System — Definição aprovada
Após 3 iterações de preview (dark → light → refined → final) + revisão externa:
- **Fontes:** DM Sans 300/400/500 + DM Mono 400/500
- **Temas:** dark, light, sépia — mesma anatomia
- **Accent aprovado:** `#3b68f5` (light) / `#4f7cff` (dark)
- **Depth system:** 4 layers de superfície com border-top highlight e shadow progressiva
- **Transition global:** `all 0.2s cubic-bezier(0.4,0,0.2,1)`
- **Focus state:** `outline: 2px solid accent + offset 2px` / inputs com ring
- **Hover KPI cards:** `translateY(-2px)` + shadow elevada

#### Descartado (com motivo registrado)
| Item | Motivo |
|------|--------|
| Neumorfismo | Identidade genérica — substituído por depth system próprio |
| `font-weight: 600` | Pesado demais no dark mode, fora do padrão Linear/Vercel |
| `#2563EB` Tailwind blue | Azul mais genérico do mercado SaaS |
| `filter: brightness(1.05)` no hover | Some no dark mode — substituído por `opacity: 0.88` |

---

### Backlog v0101 — Status atualizado

| Item | Status |
|------|--------|
| ⚡ Extensão `http` → schema `extensions` | ✅ DONE 2026-03-20 |
| 🎨 Design System — definição e aprovação | ✅ DONE 2026-03-20 |
| 🎨 Design System — `tailwind.config.js` com tokens | ✅ DONE 2026-03-20 |
| 🎨 Design System — componentes base (`card`, `button`, `badge`, `input`) | ✅ DONE 2026-03-20 |
| 🎨 Design System — `Sidebar.tsx` + `Header.tsx` | ✅ DONE 2026-03-20 |
| 🎨 Design System — migração global páginas (via index.css) | ⏳ **PRÓXIMO — Claude Code** |
| 🏗️ Refatoração `EditActionForm.tsx` | ⏳ FASE 2 |
| 🐛 SUP-000005 — status da ação não salva como Concluída | ⏳ FASE 2 |
| 🐛 SUP-000006 — agendamento não aparece no ícone do dia | ⏳ FASE 2 |
| 🆕 SUP-000001 — CRUD inline no cockpit | ⏳ FASE 2 |
| 🆕 UX — Card "Empresas com Ações Ativas" (lista longa) | ⏳ FASE 2 |
| 🆕 SUP-000004 — Fechamento mensal de negócios | ⏳ FASE 2 |
| 🔧 Registrar migrations no Supabase CLI | ⏳ FASE 3 |
| 🔧 Atualizar `generate-backup-full` (+2 tabelas) | ⏳ FASE 3 |
| 🗄️ Corrigir RLS initplan — 17 políticas | ⏳ FASE 4 |
| 🗄️ Criar 20 índices para FKs sem cobertura | ⏳ FASE 4 |
| 🗄️ Consolidar políticas RLS duplicadas | ⏳ FASE 4 |
| 🗄️ Remover índice duplicado `contacts_channel` | ⏳ FASE 4 |
| 🟢 Hub de Gestão | ⏳ última entrega |

---

---

### FASE 1 — Design System — Implementação (sessão tarde 2026-03-20)

#### Arquivos entregues e aplicados em `~/projetos/crmappy-v0101`

| Arquivo | Destino | O que fez |
|---------|---------|-----------|
| `tailwind.config.js` | raiz | Tokens completos: cores, shadows, radius, tipografia, 3 temas |
| `index.html` | raiz | Import Google Fonts DM Sans + DM Mono |
| `src/index.css` | src/ | Body dark migrado, sépia cobre tokens DS, neumorfismo legado mantido |
| `src/App.tsx` | src/ | Wrapper `bg-dark-bg`, prop `theme` passada ao Header |
| `src/components/UI/Button.tsx` | src/components/UI/ | 4 variantes + loading + ícones |
| `src/components/UI/Card.tsx` | src/components/UI/ | Depth system + subcomponentes KPI |
| `src/components/UI/Badge.tsx` | src/components/UI/ | 5 variantes + semânticos CRMappy |
| `src/components/UI/Input.tsx` | src/components/UI/ | Focus ring, label, erro, Textarea |
| `src/components/Sidebar.tsx` | src/components/ | 3 temas via objeto `t`, divisores corrigidos |
| `src/components/Header.tsx` | src/components/ | 3 temas via objeto `t`, prop `theme` adicionada |

#### Decisões técnicas desta sessão
- **Estratégia de 3 temas:** objeto `t` com classes condicionais por tema — não depende do prefixo `dark:` do Tailwind (que só funciona com classe `.dark` no `<html>`). Sépia usa CSS vars `var(--app-*)` definidas no `index.css`.
- **Neumorfismo legado:** mantido no `index.css` e `tailwind.config.js` — não quebra componentes ainda não migrados.
- **Divisores:** usar `h-px` + `bg-*` — `border-t-[0.5px]` não é classe Tailwind válida.
- **Header recebe prop `theme`:** necessário para colorização correta nos 3 modos.
- **Light mode:** Sidebar e Header corretos. Páginas internas ainda usam `bg-plate` (legado) — migrar via `index.css` no próximo passo.

#### Próximo passo — Claude Code
Migração global sobrescrevendo classes neumórficas no `index.css`:
```css
/* Estratégia: redefinir .neumorphic-* para renderizar com DS v0101 */
/* Cobre todos os componentes sem tocar em cada arquivo individualmente */
.neumorphic-convex  → shadow-sh1 + bg dark-s1
.neumorphic-concave → bg dark-s2 + border 0.5px
.bg-plate           → #f4f5f7 (light) / já coberto pelo dark mode
```
Após: ajuste fino nas páginas críticas (Cockpit, Dashboard, Vision360).


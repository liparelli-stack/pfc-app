# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 1. IDENTIDADE DO PROJETO

- **Nome:** MGB - Money Get Back Personal Control Finance
- **Repositório:** https://github.com/liparelli-stack/pfc-app
- **Deploy:** https://mgbpcf.netlify.app
- **Supabase projeto:** moneygetback_appy
- **Supabase URL:** https://inagloqzkzgubfqrlwxb.supabase.co

---

## 2. STACK COMPLETA

| Categoria       | Ferramenta                    |
|----------------|-------------------------------|
| Frontend        | React 19 + Vite + TypeScript  |
| CSS             | Tailwind CSS v3 + shadcn/ui   |
| Banco de dados  | Supabase (PostgreSQL + Auth)  |
| Roteamento      | React Router DOM v7           |
| Formulários     | React Hook Form + Zod         |
| Gráficos        | Recharts                      |
| CSV parsing     | PapaParse                     |
| Markdown        | react-markdown                |
| Toasts          | Sonner                        |
| Ícones          | lucide-react                  |

---

## 3. AMBIENTE DE DESENVOLVIMENTO

- Windows 11 + WSL2 / Ubuntu 24.04 LTS
- Claude Code v2.1.70
- Node.js v20 + npm
- Projeto em: `~/projetos/pfc-app`

```bash
npm run dev       # Vite dev server → localhost:5173
npm run build     # TypeScript check + build produção
npm run lint      # ESLint
npm run preview   # Preview do build
```

Sem test runner configurado.

---

## 4. ARQUITETURA — 3 CAMADAS

| Camada | Localização | Responsabilidade |
|--------|-------------|-----------------|
| 1 — Dados | Supabase / PostgreSQL | Persistência, RLS, triggers |
| 2 — Serviços | `src/services/` | Lógica de negócio, chamadas Supabase e LLM APIs |
| 3 — UI | `src/pages/` + `src/components/` | React, formulários, navegação |

**Regra fundamental:** componentes React nunca chamam Supabase ou APIs LLM diretamente. Sempre via service layer.

---

## 5. PÁGINAS E ROTAS

| Arquivo | Rota | Descrição |
|---------|------|-----------|
| `Login.tsx` | `/login` | Login com senha ou Google |
| `Register.tsx` | `/register` | Cadastro de novo usuário |
| `ForgotPassword.tsx` | `/esqueci-senha` | Solicitar reset de senha |
| `ResetPassword.tsx` | `/redefinir-senha` | Redefinir senha via link Supabase |
| `Dashboard.tsx` | `/` | Resumo financeiro com gráficos |
| `Banks.tsx` | `/bancos` | CRUD de bancos |
| `Cards.tsx` | `/cartoes` | CRUD de cartões de crédito |
| `Transactions.tsx` | `/transacoes` | Listagem e classificação manual |
| `Import.tsx` | `/importar` | Upload e importação de CSV |
| `Categories.tsx` | `/categorias` | CRUD de categorias e regras |
| `Analysis.tsx` | `/analise` | Análise IA (chat, análise, sugestões, classificação) |
| `Budget.tsx` | `/orcamento` | Orçamento mensal vs realizado |
| `Settings.tsx` | `/configuracoes` | Configurações LLM e preferências |

Rotas públicas: `/login`, `/register`, `/esqueci-senha`, `/redefinir-senha`.
Demais rotas: protegidas por `RequireAuth`.

---

## 6. SERVICES

| Arquivo | Descrição |
|---------|-----------|
| `auth.service.ts` | signIn, signUp, signOut, Google OAuth, magic link, reset/update password |
| `banks.service.ts` | CRUD de bancos |
| `cards.service.ts` | CRUD de cartões de crédito |
| `categories.service.ts` | CRUD de categorias + regras de classificação |
| `classification.service.ts` | Motor de classificação por keywords (contains, starts_with, exact, word) |
| `transactions.service.ts` | Upsert de transações banco/cartão, override manual de categoria |
| `transactions-view.service.ts` | Queries unificadas de leitura (banco + cartão) |
| `dashboard.service.ts` | Agregações para cards de resumo e gráficos |
| `import-history.service.ts` | Registro de lotes de importação |
| `budget.service.ts` | CRUD de orçamento mensal, cálculo planejado vs realizado |
| `llm.service.ts` | Configuração de provedores LLM, chat, análise financeira |
| `analysis.service.ts` | Análise IA: busca transações, monta prompt, chama LLM, salva resultado |
| `import/csv.parser.ts` | Detecção de encoding (UTF-8/Windows-1252), roteamento para parsers |
| `import/parsers/` | Parsers específicos por banco/cartão (ver seção 8) |

---

## 7. TABELAS SUPABASE

Todas as tabelas têm RLS habilitado. Todas referenciam `auth.users(id)` via `user_id`.

### `banks`
`id, user_id, name, short_name, logo_url, active, created_at, deleted_at`

### `credit_cards`
`id, user_id, bank_id, name, last_four, closing_day, due_day, credit_limit, active, created_at, deleted_at`

### `categories`
`id, user_id (nullable — NULL = sistema), name, icon, color, active, created_at, deleted_at`

### `category_rules`
`id, user_id (nullable — NULL = global), category_id, keyword, match_type (contains|starts_with|exact|word), priority, active, created_at`
- 198 regras globais (user_id = NULL)

### `bank_transactions`
`id, user_id, bank_id, category_id, date, description, amount, type (debit|credit), balance, auto_classified, notes, import_hash, import_id, reference_month, created_at, deleted_at`

### `card_transactions`
`id, user_id, card_id, category_id, date, description, amount, installment_current, installment_total, auto_classified, notes, import_hash, import_id, reference_month, created_at, deleted_at`

### `budget`
`id, user_id, category_id, year, month, amount, is_base, created_at, updated_at`
- `is_base = true`: valor base recorrente; `is_base = false`: override pontual do mês

### `import_history`
`id, user_id, type (bank|card), origin_id, origin_name, file_name, reference_month, total_rows, imported_rows, duplicate_rows, error_rows, status (success|partial|error), created_at`

### `user_llm_configs`
`id, user_id, provider (gemini|openai|deepseek), display_name, api_key (text), api_key_enc (bytea), model, is_default, active, created_at, updated_at`

### `ai_analyses`
`id, user_id, llm_config_id, source_type (card|bank|both), source_ids[], period_from, period_to, transaction_count, total_amount, prompt_text, analysis_summary, alerts (jsonb), suggestions (jsonb), status (pending|processing|completed|error), error_message, created_at, completed_at`

---

## 8. PARSERS DE IMPORTAÇÃO

Todos os parsers saem com o mesmo objeto normalizado:
```ts
{ date: "YYYY-MM-DD", description: string, amount: number,
  type: "debit" | "credit", origin_id: string, origin_type: "bank" | "card" }
```

| Parser | Formato | Separador | Encoding | Colunas |
|--------|---------|-----------|----------|---------|
| `nubank-card` | CSV com header | vírgula | UTF-8 | `date, title, amount` |
| `nubank-bank` | CSV com header | vírgula | UTF-8 | `Data, Valor, Identificador, Descrição` |
| `itau-card` | CSV com header | vírgula | Windows-1252 | `data, lançamento, valor` |
| `itau-bank` | CSV sem header | ponto e vírgula | Windows-1252 | 3 colunas: data, descrição, valor |
| `bradesco-bank` | CSV com header | ponto e vírgula | Windows-1252 | detectado automaticamente |

---

## 9. INTEGRAÇÕES LLM

| Provider | Código | Modelo padrão |
|----------|--------|---------------|
| Anthropic | `claude` | `claude-sonnet-4-20250514` |
| OpenAI | `chatgpt` | `gpt-4o` |
| Google | `gemini` | `gemini-2.0-flash` |
| DeepSeek | `deepseek` | `deepseek-chat` |

- API keys salvas em `user_llm_configs` (campo `api_key` texto ou `api_key_enc` bytea)
- RLS garante que apenas o dono acessa sua key
- Um único LLM padrão por usuário (`is_default = true`)
- Toda análise é salva em `ai_analyses` independente de sucesso ou erro

---

## 10. MOTOR DE CLASSIFICAÇÃO

- Regras em `category_rules` (globais: `user_id = NULL`; personalizadas: `user_id = <id>`)
- Tipos de match: `contains`, `starts_with`, `exact`, `word`
- Case insensitive, prioridade pelo campo `priority`
- Regras do usuário têm precedência sobre globais
- Implementado em `src/services/classification.service.ts`

---

## 11. IDENTIDADE VISUAL

- Logo: `/public/LogoMGB.png` — usado com `src="/LogoMGB.png"` no Vite/Netlify
- Cor primária: `blue-600` (`#2563EB`)
- Fundo auth: `bg-gray-50`; cards auth: `bg-white rounded-2xl shadow-md`
- Favicons: `favicon.ico`, `favicon.svg`, `favicon-96x96.png`, `apple-touch-icon.png`
- Manifests: `site.webmanifest`, `web-app-manifest-192x192.png`, `web-app-manifest-512x512.png`

---

## 12. PADRÕES DO PROJETO

- **Idioma:** português brasileiro para UI; inglês para código, variáveis, funções, arquivos
- **Commits:** português
- **Toasts:** `sonner` — `toast.success` / `toast.error`, posição `top-right`, `richColors`
- **Formulários:** `react-hook-form` + `zod`, componentes shadcn/ui `<Form>`
- **Exclusão:** sempre `AlertDialog` de confirmação; soft delete via `deleted_at`
- **Gráficos:** `recharts` — apenas em componentes de Dashboard
- **shadcn/ui:** adicionar via `npx shadcn@latest add <component>` → `src/components/ui/`
- **RLS:** habilitado em todas as tabelas — nunca bypassar

### Estrutura de componentes
```
src/components/
  ui/          ← shadcn/ui gerados (não editar)
  layout/      ← AppLayout, Sidebar, Topbar, RequireAuth
  ai/          ← AISettings + tabs/ (AnalysisTab, ChatTab, ClassificationTab, SuggestionsTab)
  banks/       ← BankForm, BankList
  budget/      ← BudgetChart, BudgetForm, BudgetKPICards, BudgetMatrix, BudgetTable
  cards/       ← CardForm, CardList
  categories/  ← CategoryForm, CategoryList, RulesManager
  dashboard/   ← SummaryCards, charts, UncategorizedAlert
  import/      ← ImportForm, ImportHistory
  transactions/← TransactionList, CategoryOverride
```

---

## 13. VARIÁVEIS DE AMBIENTE

```
VITE_SUPABASE_URL=https://inagloqzkzgubfqrlwxb.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
```

Arquivo: `.env.local` — nunca commitar.

---

## 14. PROTOCOLO NOVO CHAT

Para abrir novo chat com contexto completo:
1. Copiar o conteúdo deste CLAUDE.md
2. Colar no início do novo chat com:
   > "Eva, novo chat do projeto MGB. Contexto completo abaixo:"
3. Colar o CLAUDE.md
4. Eva já tem todo o contexto para trabalhar

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## IDENTIDADE

- **Nome:** MGB - Money Get Back Personal Control Finance
- **GitHub:** https://github.com/liparelli-stack/pfc-app
- **Deploy:** https://mgbpcf.netlify.app
- **Supabase:** https://inagloqzkzgubfqrlwxb.supabase.co (projeto: moneygetback_appy)

---

## STACK

React 19 + Vite + TypeScript · Tailwind CSS v3 + shadcn/ui · Supabase JS · React Router DOM v7 · React Hook Form + Zod · Recharts · PapaParse · react-markdown · Sonner · lucide-react

---

## AMBIENTE

- Windows 11 + WSL2 / Ubuntu 24.04 · Node.js v20 · npm
- Projeto: `~/projetos/pfc-app`

```bash
npm run dev      # localhost:5173
npm run build    # tsc + vite build
npm run lint     # ESLint
```

---

## ARQUITETURA — 3 CAMADAS

1. **Dados** — Supabase/PostgreSQL (RLS em todas as tabelas, sem lógica de negócio)
2. **Serviços** — `src/services/` (toda lógica + chamadas Supabase e LLM)
3. **UI** — `src/pages/` + `src/components/` (sem chamadas diretas a Supabase ou APIs)

---

## PÁGINAS (`src/pages/`)

| Arquivo | Rota | Status |
|---------|------|--------|
| `Login.tsx` | `/login` | Senha + Google OAuth |
| `Register.tsx` | `/register` | Cadastro novo usuário |
| `ForgotPassword.tsx` | `/esqueci-senha` | Solicitar reset |
| `ResetPassword.tsx` | `/redefinir-senha` | Redefinir via link Supabase |
| `Dashboard.tsx` | `/` | Resumo financeiro + gráficos |
| `Banks.tsx` | `/bancos` | CRUD bancos |
| `Cards.tsx` | `/cartoes` | CRUD cartões de crédito |
| `Transactions.tsx` | `/transacoes` | Listagem + classificação manual |
| `Import.tsx` | `/importar` | Upload e importação CSV |
| `Categories.tsx` | `/categorias` | CRUD categorias + regras |
| `Analysis.tsx` | `/analise` | Análise IA (chat, análise, sugestões, classificação) |
| `Budget.tsx` | `/orcamento` | Orçamento mensal vs realizado |
| `Settings.tsx` | `/configuracoes` | Configurações LLM |

Rotas públicas: `/login`, `/register`, `/esqueci-senha`, `/redefinir-senha`. Demais: `RequireAuth`.

---

## SERVICES (`src/services/`)

| Arquivo | Responsabilidade |
|---------|-----------------|
| `auth.service.ts` | signIn, signUp, signOut, Google OAuth, magic link, reset/update password |
| `banks.service.ts` | CRUD bancos |
| `cards.service.ts` | CRUD cartões |
| `categories.service.ts` | CRUD categorias + regras de classificação |
| `classification.service.ts` | Motor keyword classifier (contains/starts_with/exact/word) |
| `transactions.service.ts` | Upsert banco/cartão, override manual de categoria |
| `transactions-view.service.ts` | Queries unificadas de leitura (banco + cartão) |
| `dashboard.service.ts` | Agregações para resumos e gráficos |
| `import-history.service.ts` | Registro de lotes de importação |
| `budget.service.ts` | CRUD orçamento, cálculo planejado vs realizado |
| `llm.service.ts` | Config provedores LLM, chat, análise financeira |
| `analysis.service.ts` | Busca transações → monta prompt → chama LLM → salva em ai_analyses |
| `import/csv.parser.ts` | Detecção encoding (UTF-8/Windows-1252), roteamento para parsers |

### Parsers (`src/services/import/parsers/`)

| Parser | Separador | Encoding | Colunas principais |
|--------|-----------|----------|--------------------|
| `nubank-card.parser.ts` | vírgula | UTF-8 | `date, title, amount` |
| `nubank-bank.parser.ts` | vírgula | UTF-8 | `Data, Valor, Identificador, Descrição` |
| `itau-card.parser.ts` | vírgula | Windows-1252 | `data, lançamento, valor` |
| `itau-bank.parser.ts` | ponto e vírgula | Windows-1252 | sem header, 3 colunas |
| `bradesco-bank.parser.ts` | ponto e vírgula | Windows-1252 | header detectado automaticamente |

Saída normalizada de todos os parsers:
```ts
{ date: "YYYY-MM-DD", description: string, amount: number,
  type: "debit"|"credit", origin_id: string, origin_type: "bank"|"card" }
```

---

## TABELAS SUPABASE

Todas têm `user_id → auth.users(id)` e RLS habilitado.

| Tabela | Colunas principais |
|--------|--------------------|
| `banks` | id, user_id, name, short_name, logo_url, active, deleted_at |
| `credit_cards` | id, user_id, bank_id, name, last_four, closing_day, due_day, credit_limit, active, deleted_at |
| `categories` | id, user_id (NULL=sistema), name, icon, color, active, deleted_at |
| `category_rules` | id, user_id (NULL=global), category_id, keyword, match_type, priority, active |
| `bank_transactions` | id, user_id, bank_id, category_id, date, description, amount, type, balance, import_hash, import_id, reference_month, auto_classified, deleted_at |
| `card_transactions` | id, user_id, card_id, category_id, date, description, amount, installment_current, installment_total, import_hash, import_id, reference_month, auto_classified, deleted_at |
| `budget` | id, user_id, category_id, year, month, amount, is_base (base recorrente vs override pontual) |
| `import_history` | id, user_id, type, origin_id, origin_name, file_name, reference_month, total_rows, imported_rows, duplicate_rows, error_rows, status |
| `user_llm_configs` | id, user_id, provider (gemini\|openai\|deepseek), model, api_key, api_key_enc, is_default, active |
| `ai_analyses` | id, user_id, llm_config_id, source_type, period_from/to, transaction_count, analysis_summary, alerts (jsonb), suggestions (jsonb), status, error_message |

---

## INTEGRAÇÕES LLM

| Provider | Código | Modelo padrão |
|----------|--------|---------------|
| Anthropic | `claude` | `claude-sonnet-4-20250514` |
| OpenAI | `chatgpt` | `gpt-4o` |
| Google | `gemini` | `gemini-2.0-flash` |
| DeepSeek | `deepseek` | `deepseek-chat` |

Keys em `user_llm_configs`. Toda análise salva em `ai_analyses` (sucesso ou erro).

---

## IDENTIDADE VISUAL

- Logo: `/public/LogoMGB.png` → `src="/LogoMGB.png"` (Vite + Netlify)
- Cor primária: `blue-600`
- Auth: fundo `bg-gray-50`, card `bg-white rounded-2xl shadow-md p-8 max-w-md`
- Sidebar: logo `w-7 h-7` + texto "MGB"

---

## PADRÕES E CONVENÇÕES

- **Idioma:** PT-BR para UI; inglês para código, arquivos, variáveis
- **Commits:** português
- **Toasts:** `sonner` — `toast.success/error`, `top-right`, `richColors`
- **Formulários:** `react-hook-form` + `zod` + shadcn `<Form>`
- **Exclusão:** `AlertDialog` de confirmação + soft delete (`deleted_at`)
- **Gráficos:** `recharts` somente em componentes de Dashboard
- **shadcn/ui:** `npx shadcn@latest add <component>` → `src/components/ui/` (não editar)
- **RLS:** nunca bypassar

---

## VARIÁVEIS DE AMBIENTE (`.env.local` — nunca commitar)

```
VITE_SUPABASE_URL=https://inagloqzkzgubfqrlwxb.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
```

---

## PROTOCOLO NOVO CHAT

```
"Eva, novo chat do projeto MGB. Contexto completo abaixo:"
[colar este CLAUDE.md]
```

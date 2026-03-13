# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Development Commands

```bash
npm run dev       # Start Vite dev server (localhost:5173)
npm run build     # TypeScript check + Vite production build
npm run lint      # ESLint check
npm run preview   # Preview production build locally
```

No test runner is configured yet.

---

## Current Implementation State

All dependencies are installed. The following is built and functional:

**Auth:** Supabase Auth with `AuthContext`, `RequireAuth` guard, Login / ForgotPassword / ResetPassword pages.

**Services (all implemented):**
- `auth.service.ts` — sign in, sign out, password reset
- `banks.service.ts`, `cards.service.ts` — CRUD for banks and credit cards
- `categories.service.ts` — CRUD for categories + category rules
- `transactions.service.ts` — upsert bank/card transactions, manual category override
- `transactions-view.service.ts` — unified read queries across both transaction tables
- `classification.service.ts` — keyword-based auto-classifier with built-in rules + user rules
- `dashboard.service.ts` — aggregations for summary cards and charts
- `import-history.service.ts` — import batch tracking
- `import/csv.parser.ts` — encoding detection (UTF-8 / Windows-1252), FNV-1a deduplication hash, parser routing
- `import/parsers/` — Itaú bank, Itaú card, Nubank bank, Nubank card, Bradesco bank

**Pages (all functional):** Dashboard (with Recharts charts), Banks, Cards, Transactions, Import, Categories, Budget (placeholder), Analysis (placeholder), Settings (placeholder).

**Not yet built:** `budget.service.ts`, `llm.service.ts`, `analysis.service.ts`, `LlmConfigForm`, `AnalysisForm/Result/History`, `BudgetTable/BudgetVsActual`.

---

# Personal Finance Control (PFC)
## Project Overview
A personal finance management web application for FL (CognosLabAlpha).
Allows importing bank statements and credit card bills, classifying expenses,
building a personal budget, and requesting AI-powered financial analysis.

---

## AI Ecosystem & Roles
- **Eva (Claude Pro)** = Principal Reasoning Core. All architecture decisions go through Eva.
- **Gemini Pro** = Co-creation and brainstorming (not coding).
- **Qwen** = Primary technical validation inside this pipeline.
- **DeepSeek** = Secondary technical validation inside this pipeline.
- FL makes all final decisions. Eva never imposes conclusions.

---

## Architecture: 3-Layer Pattern

### Layer 1 — Data (Supabase / PostgreSQL)
- All tables, policies, and data persistence live here.
- Never put business logic in this layer.

### Layer 2 — Service (`src/services/`)
- Business logic, validation rules, external integrations (parsers, LLM APIs).
- Bridge between data and application layers.
- All Supabase and LLM API calls happen here — never from React components directly.

### Layer 3 — Application (`src/` React)
- UI, user interaction flows, calls to service layer only.
- No direct Supabase or LLM API calls from this layer.

---

## Tech Stack
| Category        | Tool           | Version   | Environment |
|----------------|----------------|-----------|-------------|
| OS             | Windows 11     | 25H2      | Host        |
| Virtualization | WSL2           | 2.6.2.0   | Windows     |
| Linux          | Ubuntu         | 24.04 LTS | WSL         |
| Runtime        | Node.js        | v20.20.1  | WSL         |
| Package Manager| npm            | 10.8.2    | WSL         |
| Version Control| Git            | 2.43.0    | WSL         |
| Containers     | Docker Engine  | 29.2.1    | WSL         |
| AI CLI         | Claude Code    | v2.1.70   | WSL         |
| Database       | Supabase       | cloud     | Production  |
| Frontend       | React + Vite   | latest    | WSL         |
| UI Components  | shadcn/ui      | latest    | WSL         |
| CSS            | Tailwind CSS   | v3        | WSL         |
| Deploy         | Netlify        | cloud     | Production  |

---

## Project Structure
```
pfc-app/
├── CLAUDE.md
├── .env.local                       ← Supabase keys (never commit)
├── vite.config.ts
├── tailwind.config.ts
├── components.json                  ← shadcn/ui config
│
├── src/
│   ├── main.tsx
│   ├── App.tsx                      ← wraps RouterProvider + AuthProvider + Toaster
│   ├── router.tsx                   ← React Router; protected routes via RequireAuth
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx          ← session state via Supabase onAuthStateChange
│   │
│   ├── lib/
│   │   ├── supabase.ts              ← Supabase client instance
│   │   └── utils.ts                 ← cn() helper
│   │
│   ├── services/                    ← LAYER 2: all business logic + DB calls
│   │   ├── auth.service.ts
│   │   ├── banks.service.ts
│   │   ├── cards.service.ts
│   │   ├── categories.service.ts
│   │   ├── classification.service.ts ← keyword classifier + BUILTIN_RULES
│   │   ├── dashboard.service.ts
│   │   ├── import-history.service.ts
│   │   ├── transactions.service.ts  ← upsert + manual override
│   │   ├── transactions-view.service.ts ← unified read queries
│   │   ├── budget.service.ts        ← NOT YET IMPLEMENTED
│   │   ├── llm.service.ts           ← NOT YET IMPLEMENTED
│   │   ├── analysis.service.ts      ← NOT YET IMPLEMENTED
│   │   └── import/
│   │       ├── csv.parser.ts        ← detectAndDecode + parseCSV + parser routing
│   │       └── parsers/             ← itau-bank, itau-card, nubank-bank, nubank-card, bradesco-bank
│   │
│   ├── components/
│   │   ├── ui/                      ← shadcn/ui generated (do not edit)
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── RequireAuth.tsx      ← route guards (RequireAuth + RedirectIfAuth)
│   │   │   ├── Sidebar.tsx
│   │   │   └── Topbar.tsx
│   │   ├── banks/, cards/, categories/, transactions/, import/
│   │   └── dashboard/               ← SummaryCards, charts (Recharts), UncategorizedAlert
│   │
│   └── pages/
│       ├── Login.tsx, ForgotPassword.tsx, ResetPassword.tsx  ← public
│       ├── Dashboard.tsx, Banks.tsx, Cards.tsx, Transactions.tsx
│       ├── Import.tsx, Categories.tsx                        ← functional
│       └── Analysis.tsx, Budget.tsx, Settings.tsx            ← placeholders
```

---

## Database Schema

### Core Tables
- `banks` — registered banks per user
- `credit_cards` — registered credit cards per user (may link to a bank)
- `bank_transactions` — bank statement transactions (linked to bank)
- `card_transactions` — credit card transactions (linked to card)
- `categories` — expense categories (system defaults + user custom)
- `category_rules` — auto-classification rules (keyword → category)
- `budget` — monthly budget per category per user

### LLM Integration Tables
- `user_llm_configs` — LLM provider + encrypted API key per user (one per provider)
- `ai_analyses` — full history of AI analyses requested, with results

### Key Principles
- Every transaction preserves origin (bank_id or card_id) — traceability is non-negotiable.
- All tables have `user_id` referencing `auth.users(id)` — RLS enforced on all tables.
- Soft delete preferred (`deleted_at`) over hard delete.
- `import_hash` on transactions prevents duplicate imports.
- API keys stored encrypted via pgcrypto (BYTEA) — never stored as plain text.

---

## LLM Integration Module

### Supported Providers
| Provider  | Models (examples)           |
|-----------|-----------------------------|
| gemini    | gemini-1.5-pro, gemini-2.0  |
| openai    | gpt-4o, gpt-4-turbo         |
| deepseek  | deepseek-chat               |

### Analysis Flow
1. User selects: period (from/to) + source type (card / bank / both) + specific accounts
2. Service layer fetches transactions matching filters
3. Service layer builds structured prompt with transaction summary
4. Service layer calls selected LLM provider API
5. LLM returns structured JSON: summary, alerts, suggestions
6. Result stored in `ai_analyses` with full traceability
7. React renders formatted analysis to user

### LLM Response Structure (expected JSON)
```json
{
  "summary": "string",
  "alerts": [
    { "category": "string", "amount": number, "message": "string" }
  ],
  "suggestions": [
    { "title": "string", "description": "string", "estimated_saving": number }
  ]
}
```

### Security Rules
- API keys encrypted before insert, decrypted only inside service layer.
- Keys never exposed to React layer.
- RLS: only key owner can read/update their configs.
- One default LLM per user enforced by database trigger.

---

## Build Phases

### Phase 1 — Foundation ✅ Schema ready
- Supabase schema (core tables + LLM tables)
- Bank and credit card registration UI

### Phase 1b — LLM Integration ✅ Schema ready
- user_llm_configs + ai_analyses tables
- Trigger: single default LLM per user

### Phase 2 — Project Bootstrap ✅ Structure ready
- Vite + React + Tailwind + shadcn/ui
- Supabase client configured
- Routing and layout shell

### Phase 3 — CSV Import ✅ Done
- Upload and parse CSV files
- Normalize to internal transaction format
- Preserve origin traceability

### Phase 4 — Classification Engine ✅ Done
- Match descriptions to categories via rules
- Manual override always available

### Phase 5 — AI Analysis Screen
- Filter: period + source type + accounts
- LLM config panel in Settings
- Display: summary, alerts, suggestions + history

### Phase 6 — Consolidated Dashboard
- Unified view: all banks + all cards
- Filter by bank, card, category, period

### Phase 7 — Budget
- Monthly budget per category
- Planned vs actual comparison

---

## Key Library Conventions
- **Forms:** `react-hook-form` + `zod` for validation. Use shadcn/ui `<Form>` wrappers.
- **Toasts:** `sonner` (`toast.success`, `toast.error`) — Toaster is mounted in `App.tsx`.
- **Charts:** `recharts` — used in Dashboard components only.
- **Icons:** `lucide-react`.
- **Adding shadcn/ui components:** `npx shadcn@latest add <component>` — output goes to `src/components/ui/`.

---

## Coding Standards
- English for all code, variables, functions, comments, and file names.
- Portuguese only for user-facing UI text.
- Component-based React (one component per file).
- Service layer handles all Supabase and LLM API calls — never from components.
- Always validate inputs in service layer before persisting.
- Prefer explicit error handling over silent failures.
- Use shadcn/ui components from `src/components/ui/` — do not edit them directly.
- LLM calls must always save result to ai_analyses regardless of success/error.

---

## CSV Import Rules
All parsers must output this normalized object:
```json
{
  "date": "YYYY-MM-DD",
  "description": "string",
  "amount": number,
  "type": "debit | credit",
  "origin_id": "bank_id or card_id",
  "origin_type": "bank | card"
}
```

---

## Environment Variables (.env.local)
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```
Never commit .env.local. Add to .gitignore.

---

## FL Profile (Project Owner)
- Systems analyst background (COBOL, BASIC, Clipper, Zim, HP-UX, DOS).
- Current role: business consultant and systems architect.
- Not an active programmer — acts as architect and decision-maker.
- Prefers clear Portuguese explanations without unnecessary technical jargon.
- All final decisions belong to FL.

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

The codebase is at the **Vite + React scaffold stage**. Only the default template files exist in `src/`. The planned dependencies below are **not yet installed** and must be added before building any feature:

| Dependency | Purpose | Install command |
|---|---|---|
| `@supabase/supabase-js` | Database client | `npm install @supabase/supabase-js` |
| `react-router-dom` | Routing | `npm install react-router-dom` |
| `tailwindcss` | CSS | see shadcn/ui docs |
| `shadcn/ui` | Component library | `npx shadcn@latest init` |

All architecture described below is **planned**. What currently exists:
- `src/lib/utils.ts` — `cn()` helper
- `src/lib/supabase.ts` — Supabase client
- `src/router.tsx` — React Router with all 8 routes
- `src/components/layout/` — `AppLayout`, `Sidebar`, `Topbar` (functional)
- `src/pages/` — all 8 pages as placeholders ("em construção")
- Nothing in `src/services/` or `src/components/ui/` yet

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
├── CLAUDE.md                        ← this file
├── .env.local                       ← Supabase keys (never commit)
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── components.json                  ← shadcn/ui config
│
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── router.tsx                   ← React Router routes
│   │
│   ├── lib/
│   │   ├── supabase.ts              ← Supabase client instance
│   │   └── utils.ts                 ← shadcn/ui cn() helper + shared utils
│   │
│   ├── services/                    ← LAYER 2: all business logic here
│   │   ├── banks.service.ts
│   │   ├── cards.service.ts
│   │   ├── transactions.service.ts
│   │   ├── categories.service.ts
│   │   ├── budget.service.ts
│   │   ├── llm.service.ts           ← LLM provider calls (Gemini, OpenAI, DeepSeek)
│   │   ├── analysis.service.ts      ← builds prompt, calls llm.service, saves result
│   │   └── import/
│   │       ├── csv.parser.ts        ← generic CSV normalizer
│   │       └── parsers/             ← one file per bank format
│   │
│   ├── components/                  ← LAYER 3: React UI components
│   │   ├── ui/                      ← shadcn/ui generated components (do not edit)
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx        ← sidebar + topbar shell
│   │   │   ├── Sidebar.tsx
│   │   │   └── Topbar.tsx
│   │   ├── banks/
│   │   │   ├── BankList.tsx
│   │   │   └── BankForm.tsx
│   │   ├── cards/
│   │   │   ├── CardList.tsx
│   │   │   └── CardForm.tsx
│   │   ├── transactions/
│   │   │   ├── TransactionTable.tsx
│   │   │   └── TransactionFilters.tsx
│   │   ├── import/
│   │   │   └── CsvUploader.tsx
│   │   ├── analysis/
│   │   │   ├── AnalysisForm.tsx     ← period + source filters + LLM selector
│   │   │   ├── AnalysisResult.tsx   ← renders summary, alerts, suggestions
│   │   │   └── AnalysisHistory.tsx
│   │   ├── llm/
│   │   │   └── LlmConfigForm.tsx    ← provider + model + API key input
│   │   └── budget/
│   │       ├── BudgetTable.tsx
│   │       └── BudgetVsActual.tsx
│   │
│   └── pages/                       ← one file per route
│       ├── Dashboard.tsx
│       ├── Banks.tsx
│       ├── Cards.tsx
│       ├── Transactions.tsx
│       ├── Import.tsx
│       ├── Analysis.tsx
│       ├── Budget.tsx
│       └── Settings.tsx             ← LLM config lives here
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

### Phase 3 — CSV Import
- Upload and parse CSV files
- Normalize to internal transaction format
- Preserve origin traceability

### Phase 4 — Classification Engine
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

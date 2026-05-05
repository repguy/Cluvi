# BotBuilder — AI Chatbot SaaS

A multi-tenant SaaS platform to create, manage, and embed AI chatbots into any website. Built for selling to local businesses.

## Architecture

### Artifacts
- **`artifacts/chatbot-saas`** — React + Vite dashboard (preview at `/`)
- **`artifacts/api-server`** — Express API server (preview at `/api`)

### Shared Libraries
- **`lib/db`** — Drizzle ORM schema + PostgreSQL client
- **`lib/api-spec`** — OpenAPI spec (used for codegen)
- **`lib/api-zod`** — Zod schemas generated from OpenAPI
- **`lib/api-client-react`** — React Query hooks generated from OpenAPI

## Core Features

### Dashboard (chatbot-saas)
- Login / Register with username + password auth
- Bot list with status toggle, edit, delete, embed code
- Bot editor with 5 tabs:
  - **General** — Name, description, active toggle
  - **AI Provider** — Provider selection, model, API key
  - **Appearance** — Colors, avatar, welcome/fallback messages, tone, quick actions, business info
  - **System Prompt** — Custom prompt with auto-generator
  - **Integration** — Embed code, lead webhook, live preview

### API Server
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Session login
- `POST /api/auth/logout` — Clear session
- `GET /api/auth/me` — Get current user
- `GET /api/bots` — List bots (auth required)
- `POST /api/bots` — Create bot (auth required)
- `GET /api/bots/:id` — Get bot details (auth required)
- `PUT /api/bots/:id` — Update bot (auth required)
- `DELETE /api/bots/:id` — Delete bot (auth required)
- `GET /api/widget/:publicId/config` — Public bot config (for widget)
- `POST /api/widget/:publicId/chat` — Chat proxy endpoint (public)
- `GET /api/widget.js?botId=xxx` — Serve embeddable widget JS

### Embeddable Widget
Vanilla JS widget served at `/api/widget.js?botId=PUBLIC_BOT_ID`. Paste one line to embed on any website:
```html
<script src="https://DOMAIN/api/widget.js?botId=YOUR_BOT_PUBLIC_ID"></script>
```

## AI Providers Supported
- **Anthropic Claude** — claude-opus-4-5, claude-sonnet-4-5, claude-haiku-3-5
- **OpenAI GPT** — gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo
- **Google Gemini** — gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash
- **OpenRouter** — Llama 3.1, Mistral 7B, Gemma 2, Phi-3, DeepSeek R1, Qwen 2.5 (all free), custom model IDs

## Database Schema (PostgreSQL via Drizzle ORM)

### `users`
- `id` (uuid, PK)
- `username` (text, unique)
- `email` (text, unique)
- `password_hash` (text)
- `created_at` (timestamp)

### `bots`
- `id` (uuid, PK)
- `user_id` (uuid, FK → users)
- `name`, `description` (text)
- `provider`, `model`, `api_key`, `system_prompt` (text)
- `appearance` (jsonb) — colors, messages, quick actions, business info
- `is_active` (boolean)
- `public_id` (uuid, unique) — used in embed code
- `lead_webhook_url` (text)
- `created_at`, `updated_at` (timestamp)

## Auth
Session-based auth using `express-session` + `connect-pg-simple` PostgreSQL session store. Session secret from `SESSION_SECRET` env var.

## Key Files
- `artifacts/chatbot-saas/src/App.tsx` — Router with auth guards
- `artifacts/chatbot-saas/src/pages/Dashboard.tsx` — Bot list page
- `artifacts/chatbot-saas/src/pages/BotEditor.tsx` — Bot creation/editing
- `artifacts/chatbot-saas/src/pages/Login.tsx` — Auth page
- `artifacts/chatbot-saas/src/lib/api.ts` — API client
- `artifacts/chatbot-saas/src/contexts/AuthContext.tsx` — Auth state
- `artifacts/api-server/src/routes/auth.ts` — Auth routes
- `artifacts/api-server/src/routes/bots.ts` — Bot CRUD routes
- `artifacts/api-server/src/routes/widget.ts` — Widget serve + chat proxy
- `lib/db/src/schema/users.ts` — Users table
- `lib/db/src/schema/bots.ts` — Bots table

# BotBuilder — AI Chatbot SaaS

A single-owner AI chatbot studio where the owner creates AI bots and embeds them on client websites.

## Run & Operate
- API server: `pnpm --filter @workspace/api-server run dev`
- Dashboard: `pnpm --filter @workspace/chatbot-saas run dev`
- DB migration: run raw SQL via `psql "$DATABASE_URL"` (startup migrations auto-run on server start)
- Required env vars: `DATABASE_URL`, `SESSION_SECRET`
- VPS deploy guide: `DEPLOYMENT.md` in project root

## Stack
- **Frontend**: React + Vite + Tailwind CSS + Wouter routing + Recharts
- **Backend**: Express.js + Pino logging
- **Database**: PostgreSQL via Drizzle ORM (`lib/db`)
- **Auth**: Session-based (`express-session` + `connect-pg-simple`)
- **AI**: Anthropic, OpenAI, Gemini, OpenRouter (proxied server-side)

## Where things live
- `artifacts/chatbot-saas/` — React dashboard (preview at `/`)
- `artifacts/api-server/` — Express API (preview at `/api`)
- `lib/db/src/schema/` — DB schema source of truth
- `artifacts/api-server/src/routes/` — All API routes
- `artifacts/api-server/src/routes/widget.ts` — Widget JS, rate limiting, domain whitelist
- `artifacts/api-server/src/routes/conversations.ts` — Message detail + CSV export
- `DEPLOYMENT.md` — Full VPS + Nginx + SSL deployment guide

## Architecture decisions
- `requireAuth` applied per-route; public widget routes stay open
- Widget JS served as a runtime template literal — no build step for the widget
- All AI API keys stored server-side; never sent to browser
- Booking notifications (Resend/Twilio/Zapier) fired async in background
- `notificationsConfig` + `appearance` stored as JSONB on bots table
- `allowedDomains` stored as JSONB on bots table; domain check in widget routes
- Rate limiting is in-memory (Map) — 30 req/min chat, 10 req/min booking, per IP
- Startup DB migrations (idempotent `ALTER TABLE … IF NOT EXISTS`) run in `app.ts`
- Messages stored as JSONB array on conversations table (appended on each chat turn)

## Product
- **Dashboard**: Bot list with inline toggle, duplicate (Copy), template picker (8 industries)
- **Bot Editor** (8 tabs): General, AI Provider, Appearance, System Prompt, Booking, Security, Stats, Integration
- **Security tab**: Domain whitelist CRUD + rate limit info panel
- **Stats tab**: Total conversations/messages/bookings + 7-day area chart (per bot)
- **Booking tab**: Owner contact, services, confirmation message, Resend/Twilio/Zapier
- **Conversations page**: Session list, click any row to view full transcript, CSV export
- **Bookings page**: Table with status management, CSV export
- **Templates**: 8 industry presets (Dental, Restaurant, Law, Real Estate, Salon, Medical, Gym, E-commerce)
- **Widget**: Booking flow, typing delay, sound, retry logic, rate limiting, domain whitelist enforcement

## User preferences
- Sidebar: slate-950 bg, indigo-500 accent
- Design: Inter font, Lucide icons, clean card-based layout

## Gotchas
- Widget JS uses string concat internally (not template literals) to avoid TS escaping issues
- `messages` and `allowed_domains` columns added via startup migration in `app.ts`
- `bookings`, `notifications_config` columns created via raw SQL migration (one-time)
- Bot duplication sets `isActive: false` on the copy to prevent accidental live deployment

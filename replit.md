# BotBuilder — AI Chatbot SaaS

A multi-tenant SaaS platform to create, manage, and embed AI chatbots into any website. Built for selling to local businesses.

## Run & Operate
- API server: `pnpm --filter @workspace/api-server run dev`
- Dashboard: `pnpm --filter @workspace/chatbot-saas run dev`
- DB migration: run raw SQL via `psql "$DATABASE_URL"` or via `@workspace/db`
- Required env vars: `DATABASE_URL`, `SESSION_SECRET`

## Stack
- **Frontend**: React + Vite + Tailwind CSS + Wouter routing
- **Backend**: Express.js + Pino logging
- **Database**: PostgreSQL via Drizzle ORM (`lib/db`)
- **Auth**: Session-based (`express-session` + `connect-pg-simple`)
- **AI**: Anthropic, OpenAI, Gemini, OpenRouter (proxied server-side)

## Where things live
- `artifacts/chatbot-saas/` — React dashboard (preview at `/`)
- `artifacts/api-server/` — Express API (preview at `/api`)
- `lib/db/src/schema/` — DB schema source of truth
- `lib/db/src/schema/bots.ts` — BotAppearance + NotificationsConfig interfaces
- `lib/db/src/schema/bookings.ts` — Bookings table
- `artifacts/api-server/src/routes/` — All API routes

## Architecture decisions
- `requireAuth` applied **per-route** (never `router.use`): public widget routes must stay open
- Widget JS served as runtime template literal from `widget.ts` — no build step for widget
- All AI API keys stored server-side; never sent to browser
- Booking notifications (Resend/Twilio/Zapier) fired async in background; won't block response
- `notificationsConfig` stored as JSONB on bots table (separate from `appearance`)

## Product
- **Dashboard**: Login/Register, Bot list, Analytics, Bookings, Conversations
- **Bot Editor** (6 tabs): General, AI Provider, Appearance, System Prompt, Booking, Integration
- **Booking tab**: Owner contact, services list, confirmation message, office hours, sound toggle, Resend/Twilio/Zapier notifications
- **Widget**: Embeddable chat with booking flow (name→phone→service→date→time→confirm), Google Calendar link, typing delay, sound, mobile full-screen, 50-msg rate limit, retry logic
- **Bookings page**: Table with status management (pending/confirmed/cancelled), CSV export
- **Conversations page**: Session list with message counts

## User preferences
- Sidebar: slate-950 bg, indigo-500 accent
- Design: Inter font, Lucide icons, pill-shaped quick action buttons

## Gotchas
- Widget JS uses `\${JSON.stringify(botId)}` template expressions only for TS interpolation; JS inside uses string concat to avoid escaping issues
- `notifications_config` column was added via raw SQL migration (not auto-migrated)
- `bookings` table was also created via raw SQL migration

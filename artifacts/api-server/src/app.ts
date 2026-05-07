import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const app: Express = express();

app.set("trust proxy", 1);

// ── Security headers ───────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  })
);

// ── Request logging ────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  })
);

// ── CORS ───────────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));

// ── Body parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Startup DB migrations (idempotent — safe to run on every boot) ─────────
await pool
  .query(`
    -- Core tables (created in dependency order)
    CREATE TABLE IF NOT EXISTS users (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      username      TEXT        NOT NULL UNIQUE,
      email         TEXT        NOT NULL UNIQUE,
      password_hash TEXT        NOT NULL,
      created_at    TIMESTAMP   NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bots (
      id                   UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id              UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name                 TEXT      NOT NULL,
      description          TEXT      NOT NULL DEFAULT '',
      provider             TEXT      NOT NULL DEFAULT 'anthropic',
      model                TEXT      NOT NULL DEFAULT 'claude-haiku-3-5',
      api_key              TEXT      NOT NULL DEFAULT '',
      system_prompt        TEXT      NOT NULL DEFAULT '',
      appearance           JSONB     NOT NULL DEFAULT '{}'::jsonb,
      notifications_config JSONB     NOT NULL DEFAULT '{}'::jsonb,
      allowed_domains      JSONB     NOT NULL DEFAULT '[]'::jsonb,
      is_active            BOOLEAN   NOT NULL DEFAULT true,
      public_id            UUID      NOT NULL DEFAULT gen_random_uuid() UNIQUE,
      lead_webhook_url     TEXT      NOT NULL DEFAULT '',
      created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id            UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
      bot_id        UUID      NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
      session_id    TEXT      NOT NULL,
      message_count INTEGER   NOT NULL DEFAULT 0,
      messages      JSONB     NOT NULL DEFAULT '[]'::jsonb,
      created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id              UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
      bot_id          UUID      NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
      session_id      TEXT      NOT NULL DEFAULT '',
      name            TEXT      NOT NULL DEFAULT '',
      phone           TEXT      NOT NULL DEFAULT '',
      service         TEXT      NOT NULL DEFAULT '',
      date            TEXT      NOT NULL DEFAULT '',
      time_preference TEXT      NOT NULL DEFAULT '',
      status          TEXT      NOT NULL DEFAULT 'pending',
      created_at      TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS settings (
      id                       UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id                  UUID      NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      domain_whitelist_enabled BOOLEAN   NOT NULL DEFAULT false,
      rate_limit_enabled       BOOLEAN   NOT NULL DEFAULT true,
      rate_limit_chat          INTEGER   NOT NULL DEFAULT 30,
      rate_limit_booking       INTEGER   NOT NULL DEFAULT 10,
      custom_templates         JSONB     NOT NULL DEFAULT '[]'::jsonb,
      updated_at               TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "session" (
      "sid"    varchar      NOT NULL COLLATE "default",
      "sess"   json         NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
    );
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

    CREATE TABLE IF NOT EXISTS leads (
      id          UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
      bot_id      UUID      NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
      session_id  TEXT      NOT NULL DEFAULT '',
      name        TEXT      NOT NULL DEFAULT '',
      email       TEXT      NOT NULL DEFAULT '',
      skipped     BOOLEAN   NOT NULL DEFAULT false,
      created_at  TIMESTAMP NOT NULL DEFAULT NOW()
    );

    -- Additive column migrations (safe on existing installs)
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS messages JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS allowed_domains JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS notifications_config JSONB NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE bots ADD COLUMN IF NOT EXISTS lead_webhook_url TEXT NOT NULL DEFAULT '';
  `)
  .catch((err: Error) => logger.warn({ err }, "startup migration warning"));

// ── Session store ──────────────────────────────────────────────────────────
const PgStore = connectPgSimple(session);

app.use(
  session({
    store: new PgStore({
      pool,
      // Table is guaranteed to exist from the migration above
    }),
    secret: process.env.SESSION_SECRET ?? "dev-secret-change-in-prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    },
  })
);

// ── Notification service availability check ────────────────────────────────
console.log("📧 Email notifications:", process.env.RESEND_API_KEY ? "✅ Ready" : "❌ No API key");
console.log("📱 SMS/WhatsApp:", process.env.TWILIO_ACCOUNT_SID ? "✅ Ready" : "❌ No credentials");

// ── Routes ─────────────────────────────────────────────────────────────────
app.use("/api", router);

export default app;

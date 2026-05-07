import { Router } from "express";
import { db, settingsTable, usersTable } from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireAuth } from "../middlewares/auth";
import { randomUUID } from "crypto";

const router = Router();

// ── In-memory settings cache (keyed by userId, refreshed every 60s) ────────
const settingsCache = new Map<string, { data: ReturnType<typeof normalizeSettings>; expiresAt: number }>();

function normalizeSettings(raw: { domainWhitelistEnabled: boolean; rateLimitEnabled: boolean; rateLimitChat: number; rateLimitBooking: number; customTemplates: unknown[] } | null) {
  return {
    domainWhitelistEnabled: raw?.domainWhitelistEnabled ?? false,
    rateLimitEnabled: raw?.rateLimitEnabled ?? true,
    rateLimitChat: raw?.rateLimitChat ?? 30,
    rateLimitBooking: raw?.rateLimitBooking ?? 10,
    customTemplates: (raw?.customTemplates ?? []) as import("@workspace/db").CustomTemplate[],
  };
}

export async function getSettingsForUser(userId: string) {
  const cached = settingsCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId)).limit(1);
  const data = normalizeSettings(row ?? null);
  settingsCache.set(userId, { data, expiresAt: Date.now() + 60_000 });
  return data;
}

function invalidateCache(userId: string) {
  settingsCache.delete(userId);
}

// ── GET /api/admin/settings ────────────────────────────────────────────────
router.get("/admin/settings", requireAuth, async (req, res) => {
  try {
    const data = await getSettingsForUser(req.session.userId!);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "get settings error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── PUT /api/admin/settings ────────────────────────────────────────────────
router.put("/admin/settings", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const { domainWhitelistEnabled, rateLimitEnabled, rateLimitChat, rateLimitBooking } = req.body;

    const updates: Partial<typeof settingsTable.$inferInsert> = { updatedAt: new Date() };
    if (domainWhitelistEnabled !== undefined) updates.domainWhitelistEnabled = !!domainWhitelistEnabled;
    if (rateLimitEnabled !== undefined) updates.rateLimitEnabled = !!rateLimitEnabled;
    if (rateLimitChat !== undefined) updates.rateLimitChat = Math.max(1, Math.min(1000, Number(rateLimitChat) || 30));
    if (rateLimitBooking !== undefined) updates.rateLimitBooking = Math.max(1, Math.min(1000, Number(rateLimitBooking) || 10));

    const existing = await db.select({ id: settingsTable.id }).from(settingsTable).where(eq(settingsTable.userId, userId)).limit(1);
    if (existing.length === 0) {
      await db.insert(settingsTable).values({ userId, ...updates });
    } else {
      await db.update(settingsTable).set(updates).where(eq(settingsTable.userId, userId));
    }

    invalidateCache(userId);
    const fresh = await getSettingsForUser(userId);
    res.json(fresh);
  } catch (err) {
    req.log.error({ err }, "update settings error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/admin/templates ───────────────────────────────────────────────
router.get("/admin/templates", requireAuth, async (req, res) => {
  try {
    const data = await getSettingsForUser(req.session.userId!);
    res.json(data.customTemplates);
  } catch (err) {
    req.log.error({ err }, "get templates error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/admin/templates ──────────────────────────────────────────────
router.post("/admin/templates", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const { name, icon, description, provider, model, systemPrompt, quickActions, services, businessType, welcomeMessage } = req.body;

    if (!name?.trim()) { res.status(400).json({ message: "Template name is required" }); return; }

    const newTemplate: import("@workspace/db").CustomTemplate = {
      id: randomUUID(),
      name: name.trim(),
      icon: icon?.trim() || "🤖",
      description: description?.trim() || "",
      provider: provider || "openrouter",
      model: model || "meta-llama/llama-3.3-70b-instruct:free",
      systemPrompt: systemPrompt?.trim() || "",
      quickActions: Array.isArray(quickActions) ? quickActions : [],
      services: Array.isArray(services) ? services : [],
      businessType: businessType?.trim() || "",
      welcomeMessage: welcomeMessage?.trim() || "Hi! How can I help you today?",
      createdAt: new Date().toISOString(),
    };

    const current = await getSettingsForUser(userId);
    const updated = [...current.customTemplates, newTemplate];

    const existing = await db.select({ id: settingsTable.id }).from(settingsTable).where(eq(settingsTable.userId, userId)).limit(1);
    if (existing.length === 0) {
      await db.insert(settingsTable).values({ userId, customTemplates: updated as unknown as import("@workspace/db").CustomTemplate[], updatedAt: new Date() });
    } else {
      await db.update(settingsTable).set({ customTemplates: updated as unknown as import("@workspace/db").CustomTemplate[], updatedAt: new Date() }).where(eq(settingsTable.userId, userId));
    }

    invalidateCache(userId);
    res.status(201).json(newTemplate);
  } catch (err) {
    req.log.error({ err }, "create template error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── DELETE /api/admin/templates/:id ───────────────────────────────────────
router.delete("/admin/templates/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const current = await getSettingsForUser(userId);
    const updated = current.customTemplates.filter((t) => t.id !== req.params.id);

    await db.update(settingsTable).set({ customTemplates: updated as unknown as import("@workspace/db").CustomTemplate[], updatedAt: new Date() }).where(eq(settingsTable.userId, userId));
    invalidateCache(userId);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "delete template error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── GET /api/admin/accounts ───────────────────────────────────────────────
router.get("/admin/accounts", requireAuth, async (req, res) => {
  try {
    const users = await db
      .select({ id: usersTable.id, username: usersTable.username, email: usersTable.email, createdAt: usersTable.createdAt })
      .from(usersTable)
      .orderBy(asc(usersTable.createdAt));
    res.json(users);
  } catch (err) {
    req.log.error({ err }, "list accounts error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── POST /api/admin/accounts ──────────────────────────────────────────────
router.post("/admin/accounts", requireAuth, async (req, res) => {
  try {
    const { username, email, password } = req.body as { username: string; email: string; password: string };
    if (!username?.trim() || !email?.trim() || !password?.trim()) {
      res.status(400).json({ message: "Username, email and password are required" }); return;
    }
    if (password.length < 8) {
      res.status(400).json({ message: "Password must be at least 8 characters" }); return;
    }

    const existing = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim())).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ message: "An account with this email already exists" }); return;
    }

    const hash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(usersTable)
      .values({ username: username.trim(), email: email.toLowerCase().trim(), passwordHash: hash })
      .returning({ id: usersTable.id, username: usersTable.username, email: usersTable.email, createdAt: usersTable.createdAt });
    res.status(201).json(user);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      res.status(409).json({ message: "Username or email already taken" }); return;
    }
    req.log.error({ err }, "create account error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── PUT /api/admin/accounts/:id ───────────────────────────────────────────
router.put("/admin/accounts/:id", requireAuth, async (req, res) => {
  try {
    const { username, email, password } = req.body as { username?: string; email?: string; password?: string };
    const updates: Record<string, unknown> = {};
    if (username?.trim()) updates.username = username.trim();
    if (email?.trim()) updates.email = email.toLowerCase().trim();
    if (password?.trim()) {
      if (password.length < 8) { res.status(400).json({ message: "Password must be at least 8 characters" }); return; }
      updates.passwordHash = await bcrypt.hash(password, 12);
    }
    if (Object.keys(updates).length === 0) { res.status(400).json({ message: "Nothing to update" }); return; }

    const [updated] = await db.update(usersTable).set(updates)
      .where(eq(usersTable.id, req.params.id))
      .returning({ id: usersTable.id, username: usersTable.username, email: usersTable.email, createdAt: usersTable.createdAt });
    if (!updated) { res.status(404).json({ message: "Account not found" }); return; }
    res.json(updated);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      res.status(409).json({ message: "Username or email already taken" }); return;
    }
    req.log.error({ err }, "update account error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── DELETE /api/admin/accounts/:id ────────────────────────────────────────
router.delete("/admin/accounts/:id", requireAuth, async (req, res) => {
  try {
    if (req.params.id === req.session.userId) {
      res.status(400).json({ message: "You cannot delete your own account." }); return;
    }
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
    if ((count ?? 0) <= 1) {
      res.status(400).json({ message: "Cannot delete the last account." }); return;
    }
    await db.delete(usersTable).where(eq(usersTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "delete account error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── PUT /api/admin/password ────────────────────────────────────────────────
router.put("/admin/password", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: "Both current and new password are required" });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ message: "New password must be at least 8 characters" });
      return;
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ message: "User not found" }); return; }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) { res.status(401).json({ message: "Current password is incorrect" }); return; }

    const hash = await bcrypt.hash(newPassword, 12);
    await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, userId));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "change password error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;

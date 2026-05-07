import { Router } from "express";
import { db, botsTable, conversationsTable, bookingsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/bots", requireAuth, async (req, res) => {
  try {
    const bots = await db.select().from(botsTable).where(eq(botsTable.userId, req.session.userId!));
    res.json(bots);
  } catch (err) {
    req.log.error({ err }, "list bots error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/bots/mini-stats", requireAuth, async (req, res) => {
  try {
    const bots = await db.select({ id: botsTable.id }).from(botsTable).where(eq(botsTable.userId, req.session.userId!));
    const botIds = bots.map((b) => b.id);
    if (botIds.length === 0) { res.json({}); return; }
    const botIdsSql = sql`${conversationsTable.botId} = ANY(ARRAY[${sql.join(botIds.map((id) => sql`${id}::uuid`), sql`, `)}])`;
    const botIdsSqlB = sql`${bookingsTable.botId} = ANY(ARRAY[${sql.join(botIds.map((id) => sql`${id}::uuid`), sql`, `)}])`;
    const convCounts = await db
      .select({ botId: conversationsTable.botId, count: sql<number>`count(*)::int`, lastActive: sql<string>`max(${conversationsTable.createdAt})::text` })
      .from(conversationsTable).where(botIdsSql)
      .groupBy(conversationsTable.botId);
    const bookingCounts = await db
      .select({ botId: bookingsTable.botId, count: sql<number>`count(*)::int` })
      .from(bookingsTable).where(botIdsSqlB)
      .groupBy(bookingsTable.botId);
    const result: Record<string, { conversations: number; bookings: number; lastActive: string | null }> = {};
    for (const id of botIds) result[id] = { conversations: 0, bookings: 0, lastActive: null };
    for (const r of convCounts) result[r.botId] = { ...result[r.botId], conversations: r.count, lastActive: r.lastActive };
    for (const r of bookingCounts) if (result[r.botId]) result[r.botId].bookings = r.count;
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "mini stats error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/bots", requireAuth, async (req, res) => {
  try {
    const { name, description, provider, model, apiKey, systemPrompt, appearance, isActive, leadWebhookUrl, notificationsConfig, allowedDomains } = req.body;
    if (!name?.trim()) { res.status(400).json({ message: "Bot name is required" }); return; }
    const [bot] = await db.insert(botsTable).values({
      userId: req.session.userId!,
      name: name.trim(),
      description: description ?? "",
      provider: provider ?? "anthropic",
      model: model ?? "claude-haiku-3-5",
      apiKey: apiKey ?? "",
      systemPrompt: systemPrompt ?? "",
      appearance: appearance ?? undefined,
      notificationsConfig: notificationsConfig ?? undefined,
      allowedDomains: allowedDomains ?? [],
      isActive: isActive ?? true,
      leadWebhookUrl: leadWebhookUrl ?? "",
    }).returning();
    res.status(201).json(bot);
  } catch (err) {
    req.log.error({ err }, "create bot error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/bots/:id", requireAuth, async (req, res) => {
  try {
    const [bot] = await db.select().from(botsTable).where(and(eq(botsTable.id, req.params.id), eq(botsTable.userId, req.session.userId!))).limit(1);
    if (!bot) { res.status(404).json({ message: "Bot not found" }); return; }
    res.json(bot);
  } catch (err) {
    req.log.error({ err }, "get bot error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/bots/:id", requireAuth, async (req, res) => {
  try {
    const { name, description, provider, model, apiKey, systemPrompt, appearance, isActive, leadWebhookUrl, notificationsConfig, allowedDomains } = req.body;
    const existing = await db.select().from(botsTable).where(and(eq(botsTable.id, req.params.id), eq(botsTable.userId, req.session.userId!))).limit(1);
    if (existing.length === 0) { res.status(404).json({ message: "Bot not found" }); return; }
    const updates: Partial<typeof botsTable.$inferInsert> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (provider !== undefined) updates.provider = provider;
    if (model !== undefined) updates.model = model;
    if (apiKey !== undefined) updates.apiKey = apiKey;
    if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt;
    if (appearance !== undefined) updates.appearance = appearance;
    if (isActive !== undefined) updates.isActive = isActive;
    if (leadWebhookUrl !== undefined) updates.leadWebhookUrl = leadWebhookUrl;
    if (notificationsConfig !== undefined) updates.notificationsConfig = notificationsConfig;
    if (allowedDomains !== undefined) updates.allowedDomains = allowedDomains;
    const [bot] = await db.update(botsTable).set(updates).where(eq(botsTable.id, req.params.id)).returning();
    res.json(bot);
  } catch (err) {
    req.log.error({ err }, "update bot error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/bots/:id", requireAuth, async (req, res) => {
  try {
    const existing = await db.select().from(botsTable).where(and(eq(botsTable.id, req.params.id), eq(botsTable.userId, req.session.userId!))).limit(1);
    if (existing.length === 0) { res.status(404).json({ message: "Bot not found" }); return; }
    await db.delete(botsTable).where(eq(botsTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "delete bot error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/bots/:id/duplicate", requireAuth, async (req, res) => {
  try {
    const [original] = await db.select().from(botsTable).where(and(eq(botsTable.id, req.params.id), eq(botsTable.userId, req.session.userId!))).limit(1);
    if (!original) { res.status(404).json({ message: "Bot not found" }); return; }
    const [duplicate] = await db.insert(botsTable).values({
      userId: req.session.userId!,
      name: `${original.name} (Copy)`,
      description: original.description,
      provider: original.provider,
      model: original.model,
      apiKey: original.apiKey,
      systemPrompt: original.systemPrompt,
      appearance: original.appearance,
      notificationsConfig: original.notificationsConfig,
      allowedDomains: original.allowedDomains,
      isActive: false,
      leadWebhookUrl: original.leadWebhookUrl,
    }).returning();
    res.status(201).json(duplicate);
  } catch (err) {
    req.log.error({ err }, "duplicate bot error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/bots/:id/stats", requireAuth, async (req, res) => {
  try {
    const [bot] = await db.select({ id: botsTable.id }).from(botsTable).where(and(eq(botsTable.id, req.params.id), eq(botsTable.userId, req.session.userId!))).limit(1);
    if (!bot) { res.status(404).json({ message: "Bot not found" }); return; }

    const convStats = await db
      .select({
        totalConversations: sql<number>`count(*)::int`,
        totalMessages: sql<number>`coalesce(sum(${conversationsTable.messageCount}), 0)::int`,
      })
      .from(conversationsTable)
      .where(eq(conversationsTable.botId, bot.id));

    const bookingStats = await db
      .select({ totalBookings: sql<number>`count(*)::int` })
      .from(bookingsTable)
      .where(eq(bookingsTable.botId, bot.id));

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const daily = await db
      .select({
        date: sql<string>`DATE(${conversationsTable.createdAt})::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(conversationsTable)
      .where(and(eq(conversationsTable.botId, bot.id), sql`${conversationsTable.createdAt} >= ${sevenDaysAgo}`))
      .groupBy(sql`DATE(${conversationsTable.createdAt})`)
      .orderBy(sql`DATE(${conversationsTable.createdAt})`);

    const dateMap = new Map(daily.map((d) => [d.date, d.count]));
    const dailyConversations = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      dailyConversations.push({ date: key, count: dateMap.get(key) ?? 0 });
    }

    res.json({
      totalConversations: convStats[0]?.totalConversations ?? 0,
      totalMessages: convStats[0]?.totalMessages ?? 0,
      totalBookings: bookingStats[0]?.totalBookings ?? 0,
      dailyConversations,
    });
  } catch (err) {
    req.log.error({ err }, "bot stats error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;

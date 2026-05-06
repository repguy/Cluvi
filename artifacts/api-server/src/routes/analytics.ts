import { Router } from "express";
import { db, botsTable, conversationsTable, bookingsTable } from "@workspace/db";
import { eq, sql, and, gte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/analytics", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const bots = await db.select({ id: botsTable.id, isActive: botsTable.isActive }).from(botsTable).where(eq(botsTable.userId, userId));
    const botIds = bots.map((b) => b.id);
    const totalBots = bots.length;
    const activeBots = bots.filter((b) => b.isActive).length;

    if (botIds.length === 0) {
      res.json({ totalBots, activeBots, totalConversations: 0, totalMessages: 0, totalBookings: 0, dailyConversations: [] });
      return;
    }

    const botIdsSql = sql`${conversationsTable.botId} = ANY(ARRAY[${sql.join(botIds.map((id) => sql`${id}::uuid`), sql`, `)}])`;
    const botIdsSqlB = sql`${bookingsTable.botId} = ANY(ARRAY[${sql.join(botIds.map((id) => sql`${id}::uuid`), sql`, `)}])`;

    const convStats = await db
      .select({ totalConversations: sql<number>`count(*)::int`, totalMessages: sql<number>`coalesce(sum(${conversationsTable.messageCount}), 0)::int` })
      .from(conversationsTable)
      .where(botIdsSql);

    const bookingStats = await db
      .select({ totalBookings: sql<number>`count(*)::int` })
      .from(bookingsTable)
      .where(botIdsSqlB);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const daily = await db
      .select({ date: sql<string>`DATE(${conversationsTable.createdAt})::text`, count: sql<number>`count(*)::int` })
      .from(conversationsTable)
      .where(and(botIdsSql, gte(conversationsTable.createdAt, sevenDaysAgo)))
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
      totalBots,
      activeBots,
      totalConversations: convStats[0]?.totalConversations ?? 0,
      totalMessages: convStats[0]?.totalMessages ?? 0,
      totalBookings: bookingStats[0]?.totalBookings ?? 0,
      dailyConversations,
    });
  } catch (err) {
    req.log.error({ err }, "analytics overview error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/analytics/conversations", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const rows = await db
      .select({ id: conversationsTable.id, botName: botsTable.name, botColor: sql<string>`(${botsTable.appearance}->>'primaryColor')`, messageCount: conversationsTable.messageCount, createdAt: conversationsTable.createdAt })
      .from(conversationsTable)
      .innerJoin(botsTable, eq(conversationsTable.botId, botsTable.id))
      .where(eq(botsTable.userId, userId))
      .orderBy(sql`${conversationsTable.createdAt} DESC`)
      .limit(100);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "analytics conversations error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;

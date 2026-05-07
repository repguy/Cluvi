import { Router } from "express";
import { createHmac } from "crypto";
import { db, botsTable, conversationsTable, bookingsTable } from "@workspace/db";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function makeToken(botId: string): string {
  const secret = process.env.REPORT_SECRET ?? "report-secret-dev-key";
  return createHmac("sha256", secret).update(botId).digest("hex").slice(0, 40);
}

router.get("/bots/:botId/report-token", requireAuth, async (req, res) => {
  try {
    const [bot] = await db
      .select({ id: botsTable.id })
      .from(botsTable)
      .where(and(eq(botsTable.id, req.params.botId), eq(botsTable.userId, req.session.userId!)))
      .limit(1);
    if (!bot) { res.status(404).json({ message: "Not found" }); return; }
    res.json({ token: makeToken(req.params.botId) });
  } catch (err) {
    req.log.error({ err }, "report token error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/report/:botId/:token", async (req, res) => {
  try {
    const { botId, token } = req.params;
    if (token !== makeToken(botId)) { res.status(403).json({ message: "Invalid report token" }); return; }

    const [bot] = await db.select().from(botsTable).where(eq(botsTable.id, botId)).limit(1);
    if (!bot) { res.status(404).json({ message: "Not found" }); return; }

    const [convRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversationsTable).where(eq(conversationsTable.botId, botId));

    const [bookingRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookingsTable).where(eq(bookingsTable.botId, botId));

    const startOfMonth = new Date();
    startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const [monthRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bookingsTable)
      .where(and(eq(bookingsTable.botId, botId), gte(bookingsTable.createdAt, startOfMonth)));

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const daily = await db
      .select({
        date: sql<string>`date_trunc('day', ${bookingsTable.createdAt})::date::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(bookingsTable)
      .where(and(eq(bookingsTable.botId, botId), gte(bookingsTable.createdAt, thirtyDaysAgo)))
      .groupBy(sql`date_trunc('day', ${bookingsTable.createdAt})`)
      .orderBy(sql`date_trunc('day', ${bookingsTable.createdAt})`);

    const recentBookings = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.botId, botId))
      .orderBy(desc(bookingsTable.createdAt))
      .limit(10);

    res.json({
      botName: (bot.appearance as { botName?: string })?.botName || bot.name,
      botColor: (bot.appearance as { primaryColor?: string })?.primaryColor || "#6366f1",
      totalConversations: convRow?.count ?? 0,
      totalBookings: bookingRow?.count ?? 0,
      bookingsThisMonth: monthRow?.count ?? 0,
      dailyBookings: daily,
      recentBookings,
    });
  } catch (err) {
    console.error("report error", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;

import { Router } from "express";
import { db, botsTable, conversationsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const [conv] = await db
      .select({
        id: conversationsTable.id,
        sessionId: conversationsTable.sessionId,
        messageCount: conversationsTable.messageCount,
        messages: conversationsTable.messages,
        botName: botsTable.name,
        botColor: sql<string>`(${botsTable.appearance}->>'primaryColor')`,
        createdAt: conversationsTable.createdAt,
      })
      .from(conversationsTable)
      .innerJoin(botsTable, eq(conversationsTable.botId, botsTable.id))
      .where(
        sql`${conversationsTable.id} = ${req.params.id} AND ${botsTable.userId} = ${userId}`
      )
      .limit(1);

    if (!conv) { res.status(404).json({ message: "Not found" }); return; }
    res.json(conv);
  } catch (err) {
    req.log.error({ err }, "get conversation messages error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/conversations/export", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const rows = await db
      .select({
        id: conversationsTable.id,
        sessionId: conversationsTable.sessionId,
        botName: botsTable.name,
        messageCount: conversationsTable.messageCount,
        createdAt: conversationsTable.createdAt,
        updatedAt: conversationsTable.updatedAt,
      })
      .from(conversationsTable)
      .innerJoin(botsTable, eq(conversationsTable.botId, botsTable.id))
      .where(eq(botsTable.userId, userId))
      .orderBy(sql`${conversationsTable.createdAt} DESC`);

    const header = "Session ID,Bot,Messages,Started,Last Active\n";
    const csvRows = rows.map((r) =>
      [r.sessionId, r.botName, r.messageCount, r.createdAt.toISOString(), r.updatedAt.toISOString()]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=conversations.csv");
    res.send(header + csvRows.join("\n"));
  } catch (err) {
    req.log.error({ err }, "export conversations error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;

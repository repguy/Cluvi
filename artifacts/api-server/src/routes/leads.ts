import { Router } from "express";
import { db, leadsTable, botsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/leads", requireAuth, async (req, res) => {
  try {
    const bots = await db.select({ id: botsTable.id }).from(botsTable).where(eq(botsTable.userId, req.session.userId!));
    const botIds = bots.map((b) => b.id);
    if (botIds.length === 0) { res.json([]); return; }

    const leads = await db
      .select({
        id: leadsTable.id,
        botId: leadsTable.botId,
        botName: botsTable.name,
        botColor: botsTable.appearance,
        sessionId: leadsTable.sessionId,
        name: leadsTable.name,
        email: leadsTable.email,
        skipped: leadsTable.skipped,
        createdAt: leadsTable.createdAt,
      })
      .from(leadsTable)
      .innerJoin(botsTable, eq(leadsTable.botId, botsTable.id))
      .where(eq(botsTable.userId, req.session.userId!))
      .orderBy(desc(leadsTable.createdAt))
      .limit(500);

    const mapped = leads.map((l) => ({
      ...l,
      botColor: (l.botColor as { primaryColor?: string })?.primaryColor ?? "#6366f1",
    }));

    res.json(mapped);
  } catch (err) {
    req.log.error({ err }, "list leads error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;

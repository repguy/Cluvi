import { Router } from "express";
import { db, botsTable, bookingsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.get("/bookings", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const bots = await db
      .select({ id: botsTable.id, name: botsTable.name })
      .from(botsTable)
      .where(eq(botsTable.userId, userId));
    const botIds = bots.map((b) => b.id);
    if (botIds.length === 0) { res.json([]); return; }
    const botMap = new Map(bots.map((b) => [b.id, b.name]));
    const rows = await db
      .select()
      .from(bookingsTable)
      .where(
        sql`${bookingsTable.botId} = ANY(ARRAY[${sql.join(botIds.map((id) => sql`${id}::uuid`), sql`, `)}])`
      )
      .orderBy(sql`${bookingsTable.createdAt} DESC`);
    res.json(rows.map((r) => ({ ...r, botName: botMap.get(r.botId) ?? "" })));
  } catch (err) {
    req.log.error({ err }, "list bookings error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/bookings/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const { status } = req.body as { status: string };
    const allowed = ["pending", "confirmed", "cancelled", "after_hours"];
    if (!allowed.includes(status)) {
      res.status(400).json({ message: "Invalid status" });
      return;
    }
    const existing = await db
      .select({ botId: bookingsTable.botId })
      .from(bookingsTable)
      .where(eq(bookingsTable.id, req.params.id))
      .limit(1);
    if (!existing[0]) { res.status(404).json({ message: "Not found" }); return; }
    const bot = await db
      .select({ userId: botsTable.userId })
      .from(botsTable)
      .where(and(eq(botsTable.id, existing[0].botId), eq(botsTable.userId, userId)))
      .limit(1);
    if (!bot[0]) { res.status(403).json({ message: "Forbidden" }); return; }
    const [updated] = await db
      .update(bookingsTable)
      .set({ status })
      .where(eq(bookingsTable.id, req.params.id))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "update booking error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/bookings/export", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const bots = await db
      .select({ id: botsTable.id, name: botsTable.name })
      .from(botsTable)
      .where(eq(botsTable.userId, userId));
    const botIds = bots.map((b) => b.id);
    const botMap = new Map(bots.map((b) => [b.id, b.name]));
    let rows: typeof bookingsTable.$inferSelect[] = [];
    if (botIds.length > 0) {
      rows = await db
        .select()
        .from(bookingsTable)
        .where(
          sql`${bookingsTable.botId} = ANY(ARRAY[${sql.join(botIds.map((id) => sql`${id}::uuid`), sql`, `)}])`
        )
        .orderBy(sql`${bookingsTable.createdAt} DESC`);
    }
    const header = "Bot,Name,Phone,Service,Date,Time,Status,Received At\n";
    const csvRows = rows.map((r) =>
      [
        botMap.get(r.botId) ?? "",
        r.name,
        r.phone,
        r.service,
        r.date,
        r.timePreference,
        r.status,
        r.createdAt.toISOString(),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=bookings.csv");
    res.send(header + csvRows.join("\n"));
  } catch (err) {
    req.log.error({ err }, "export bookings error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;

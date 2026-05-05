import { Router } from "express";
import { db, botsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.use(requireAuth);

router.get("/bots", async (req, res) => {
  try {
    const bots = await db
      .select()
      .from(botsTable)
      .where(eq(botsTable.userId, req.session.userId!));
    res.json(bots);
  } catch (err) {
    req.log.error({ err }, "list bots error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/bots", async (req, res) => {
  try {
    const {
      name,
      description,
      provider,
      model,
      apiKey,
      systemPrompt,
      appearance,
      isActive,
      leadWebhookUrl,
    } = req.body as {
      name: string;
      description?: string;
      provider: string;
      model: string;
      apiKey?: string;
      systemPrompt?: string;
      appearance?: object;
      isActive?: boolean;
      leadWebhookUrl?: string;
    };

    if (!name?.trim()) {
      res.status(400).json({ message: "Bot name is required" });
      return;
    }

    const [bot] = await db
      .insert(botsTable)
      .values({
        userId: req.session.userId!,
        name: name.trim(),
        description: description ?? "",
        provider: provider ?? "anthropic",
        model: model ?? "claude-haiku-3-5",
        apiKey: apiKey ?? "",
        systemPrompt: systemPrompt ?? "",
        appearance: (appearance as typeof botsTable.$inferInsert.appearance) ?? undefined,
        isActive: isActive ?? true,
        leadWebhookUrl: leadWebhookUrl ?? "",
      })
      .returning();

    res.status(201).json(bot);
  } catch (err) {
    req.log.error({ err }, "create bot error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/bots/:id", async (req, res) => {
  try {
    const [bot] = await db
      .select()
      .from(botsTable)
      .where(
        and(
          eq(botsTable.id, req.params.id),
          eq(botsTable.userId, req.session.userId!)
        )
      )
      .limit(1);

    if (!bot) {
      res.status(404).json({ message: "Bot not found" });
      return;
    }

    res.json(bot);
  } catch (err) {
    req.log.error({ err }, "get bot error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/bots/:id", async (req, res) => {
  try {
    const {
      name,
      description,
      provider,
      model,
      apiKey,
      systemPrompt,
      appearance,
      isActive,
      leadWebhookUrl,
    } = req.body as Partial<{
      name: string;
      description: string;
      provider: string;
      model: string;
      apiKey: string;
      systemPrompt: string;
      appearance: object;
      isActive: boolean;
      leadWebhookUrl: string;
    }>;

    const existing = await db
      .select()
      .from(botsTable)
      .where(
        and(
          eq(botsTable.id, req.params.id),
          eq(botsTable.userId, req.session.userId!)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ message: "Bot not found" });
      return;
    }

    const updates: Partial<typeof botsTable.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (provider !== undefined) updates.provider = provider;
    if (model !== undefined) updates.model = model;
    if (apiKey !== undefined) updates.apiKey = apiKey;
    if (systemPrompt !== undefined) updates.systemPrompt = systemPrompt;
    if (appearance !== undefined) updates.appearance = appearance as typeof botsTable.$inferInsert.appearance;
    if (isActive !== undefined) updates.isActive = isActive;
    if (leadWebhookUrl !== undefined) updates.leadWebhookUrl = leadWebhookUrl;

    const [bot] = await db
      .update(botsTable)
      .set(updates)
      .where(eq(botsTable.id, req.params.id))
      .returning();

    res.json(bot);
  } catch (err) {
    req.log.error({ err }, "update bot error");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/bots/:id", async (req, res) => {
  try {
    const existing = await db
      .select()
      .from(botsTable)
      .where(
        and(
          eq(botsTable.id, req.params.id),
          eq(botsTable.userId, req.session.userId!)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ message: "Bot not found" });
      return;
    }

    await db.delete(botsTable).where(eq(botsTable.id, req.params.id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "delete bot error");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;

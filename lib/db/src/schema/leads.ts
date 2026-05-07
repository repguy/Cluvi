import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { botsTable } from "./bots";

export const leadsTable = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),
  botId: uuid("bot_id").notNull().references(() => botsTable.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull().default(""),
  name: text("name").notNull().default(""),
  email: text("email").notNull().default(""),
  skipped: boolean("skipped").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

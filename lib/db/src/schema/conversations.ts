import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { botsTable } from "./bots";

export const conversationsTable = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  botId: uuid("bot_id")
    .notNull()
    .references(() => botsTable.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull(),
  messageCount: integer("message_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Conversation = typeof conversationsTable.$inferSelect;

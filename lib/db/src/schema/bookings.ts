import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { botsTable } from "./bots";

export const bookingsTable = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  botId: uuid("bot_id")
    .notNull()
    .references(() => botsTable.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull().default(""),
  name: text("name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  service: text("service").notNull().default(""),
  date: text("date").notNull().default(""),
  timePreference: text("time_preference").notNull().default(""),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Booking = typeof bookingsTable.$inferSelect;

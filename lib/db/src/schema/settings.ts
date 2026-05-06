import { pgTable, text, timestamp, uuid, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export interface CustomTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  provider: string;
  model: string;
  systemPrompt: string;
  quickActions: string[];
  services: string[];
  businessType: string;
  welcomeMessage: string;
  createdAt: string;
}

export const settingsTable = pgTable("settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" })
    .unique(),
  domainWhitelistEnabled: boolean("domain_whitelist_enabled").notNull().default(false),
  rateLimitEnabled: boolean("rate_limit_enabled").notNull().default(true),
  rateLimitChat: integer("rate_limit_chat").notNull().default(30),
  rateLimitBooking: integer("rate_limit_booking").notNull().default(10),
  customTemplates: jsonb("custom_templates")
    .$type<CustomTemplate[]>()
    .notNull()
    .$defaultFn(() => []),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Settings = typeof settingsTable.$inferSelect;

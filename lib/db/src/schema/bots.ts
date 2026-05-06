import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export interface BotAppearance {
  primaryColor: string;
  botName: string;
  welcomeMessage: string;
  fallbackMessage: string;
  tone: string;
  quickActions: string[];
  avatarText: string;
  businessType: string;
  phone: string;
  email: string;
  address: string;
  ownerEmail: string;
  ownerPhone: string;
  services: string[];
  bookingConfirmationMessage: string;
  officeHours: string;
  afterHoursMessage: string;
  soundEnabled: boolean;
  showBranding: boolean;
  brandingText?: string;
  brandingUrl?: string;
  proactiveGreetingDelay?: number;
}

export interface NotificationsConfig {
  resendApiKey: string;
  resendFromEmail: string;
  resendEnabled: boolean;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioOwnerPhone: string;
  twilioFromPhone: string;
  twilioEnabled: boolean;
  zapierEnabled: boolean;
}

export const botsTable = pgTable("bots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  provider: text("provider").notNull().default("anthropic"),
  model: text("model").notNull().default("claude-haiku-3-5"),
  apiKey: text("api_key").notNull().default(""),
  systemPrompt: text("system_prompt").notNull().default(""),
  appearance: jsonb("appearance")
    .$type<BotAppearance>()
    .notNull()
    .$defaultFn(() => ({
      primaryColor: "#6366f1",
      botName: "",
      welcomeMessage: "Hi! How can I help you today?",
      fallbackMessage: "Sorry, I didn't quite understand that. Could you rephrase?",
      tone: "friendly",
      quickActions: [] as string[],
      avatarText: "",
      businessType: "",
      phone: "",
      email: "",
      address: "",
      ownerEmail: "",
      ownerPhone: "",
      services: [] as string[],
      bookingConfirmationMessage: "Your appointment has been booked! We'll be in touch shortly to confirm. 🎉",
      officeHours: "",
      afterHoursMessage: "",
      soundEnabled: false,
    })),
  notificationsConfig: jsonb("notifications_config")
    .$type<NotificationsConfig>()
    .notNull()
    .$defaultFn(() => ({
      resendApiKey: "",
      resendFromEmail: "",
      resendEnabled: false,
      twilioAccountSid: "",
      twilioAuthToken: "",
      twilioOwnerPhone: "",
      twilioFromPhone: "",
      twilioEnabled: false,
      zapierEnabled: false,
    })),
  allowedDomains: jsonb("allowed_domains")
    .$type<string[]>()
    .notNull()
    .$defaultFn(() => []),
  isActive: boolean("is_active").notNull().default(true),
  publicId: uuid("public_id").notNull().defaultRandom().unique(),
  leadWebhookUrl: text("lead_webhook_url").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBotSchema = createInsertSchema(botsTable).omit({
  id: true,
  publicId: true,
  createdAt: true,
  updatedAt: true,
});

export const selectBotSchema = createSelectSchema(botsTable);

export type Bot = typeof botsTable.$inferSelect;
export type InsertBot = z.infer<typeof insertBotSchema>;

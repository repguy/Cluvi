const BASE = "/api";

async function req<T>(
  path: string,
  options: RequestInit = {},
  returnNullOn?: number[]
): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    if (returnNullOn?.includes(res.status)) return null;
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message || "Request failed");
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("text/csv")) return res.text() as unknown as Promise<T>;
  return res.json() as Promise<T>;
}

export interface User { id: string; username: string; email: string }

export interface OfficeHoursDaySchedule {
  open: string;
  close: string;
  closed: boolean;
}

export interface OfficeHoursSchedule {
  monday: OfficeHoursDaySchedule;
  tuesday: OfficeHoursDaySchedule;
  wednesday: OfficeHoursDaySchedule;
  thursday: OfficeHoursDaySchedule;
  friday: OfficeHoursDaySchedule;
  saturday: OfficeHoursDaySchedule;
  sunday: OfficeHoursDaySchedule;
}

export interface BotAppearance {
  primaryColor: string; botName: string; welcomeMessage: string; fallbackMessage: string;
  tone: string; quickActions: string[]; avatarText: string; businessType: string;
  phone: string; email: string; address: string; ownerEmail: string; ownerPhone: string;
  services: string[]; bookingConfirmationMessage: string; officeHours: string;
  afterHoursMessage: string; soundEnabled: boolean;
  showBranding?: boolean; brandingText?: string; brandingUrl?: string;
  proactiveGreetingDelay?: number; leadCaptureEnabled?: boolean;
  showWelcomeForm?: boolean;
  officeHoursEnabled?: boolean;
  officeHoursTimezone?: string;
  officeHoursSchedule?: OfficeHoursSchedule;
}

export interface NotificationsConfig {
  resendEnabled: boolean;
  resendFromEmail: string;
  twilioEnabled: boolean;
  twilioOwnerPhone: string;
  twilioWhatsappEnabled: boolean;
  twilioWhatsappTo: string;
  twilioWhatsappFrom: string;
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  discordEnabled: boolean;
  discordWebhookUrl: string;
  zapierEnabled: boolean;
}

export interface Bot {
  id: string; name: string; description: string; provider: string; model: string;
  apiKey: string; systemPrompt: string; appearance: BotAppearance;
  notificationsConfig: NotificationsConfig; allowedDomains: string[];
  isActive: boolean; publicId: string; leadWebhookUrl: string;
  createdAt: string; updatedAt: string;
}

export interface AdminSettings {
  domainWhitelistEnabled: boolean;
  rateLimitEnabled: boolean;
  rateLimitChat: number;
  rateLimitBooking: number;
  customTemplates: CustomTemplate[];
}

export interface CustomTemplate {
  id: string; name: string; icon: string; description: string;
  provider: string; model: string; systemPrompt: string;
  quickActions: string[]; services: string[]; businessType: string;
  welcomeMessage: string; createdAt: string;
}

export interface AnalyticsOverview {
  totalBots: number; activeBots: number; totalConversations: number;
  totalMessages: number; totalBookings: number;
  totalBookingsThisMonth: number; conversionRate: string; peakHour: number | null;
  dailyConversations: { date: string; count: number }[];
  dailyBookings: { date: string; count: number }[];
}

export interface RecentConversation {
  id: string; botName: string; botColor: string;
  sessionId: string; messageCount: number; createdAt: string;
}

export interface ConversationDetail {
  id: string; sessionId: string; botName: string; botColor: string;
  messageCount: number; messages: { role: "user" | "assistant"; content: string }[];
  createdAt: string;
}

export interface BotStats {
  totalConversations: number; totalMessages: number; totalBookings: number;
  dailyConversations: { date: string; count: number }[];
}

export interface Booking {
  id: string; botId: string; botName: string; sessionId: string;
  name: string; phone: string; service: string; date: string;
  timePreference: string; status: string; createdAt: string;
}

export interface Lead {
  id: string; botId: string; botName: string; botColor: string;
  sessionId: string; name: string; email: string; skipped: boolean; createdAt: string;
}

export interface AccountUser {
  id: string; username: string; email: string; createdAt: string;
}

export const api = {
  auth: {
    register: (data: { username: string; email: string; password: string }) =>
      req<User>("/auth/register", { method: "POST", body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      req<User>("/auth/login", { method: "POST", body: JSON.stringify(data) }),
    logout: () => req<{ ok: boolean }>("/auth/logout", { method: "POST" }),
    me: () => req<User>("/auth/me", {}, [401]),
  },
  bots: {
    list: () => req<Bot[]>("/bots"),
    miniStats: () => req<Record<string, { conversations: number; bookings: number; lastActive: string | null }>>("/bots/mini-stats"),
    get: (id: string) => req<Bot>(`/bots/${id}`),
    create: (data: Partial<Bot>) => req<Bot>("/bots", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Bot>) => req<Bot>(`/bots/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => req<{ ok: boolean }>(`/bots/${id}`, { method: "DELETE" }),
    duplicate: (id: string) => req<Bot>(`/bots/${id}/duplicate`, { method: "POST" }),
    getStats: (id: string) => req<BotStats>(`/bots/${id}/stats`),
  },
  analytics: {
    overview: () => req<AnalyticsOverview>("/analytics"),
    recent: () => req<RecentConversation[]>("/analytics/conversations"),
  },
  conversations: {
    getMessages: (id: string) => req<ConversationDetail>(`/conversations/${id}/messages`),
    export: () => req<string>("/conversations/export"),
  },
  bookings: {
    list: () => req<Booking[]>("/bookings"),
    updateStatus: (id: string, status: string) =>
      req<Booking>(`/bookings/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
    export: () => req<string>("/bookings/export"),
  },
  leads: {
    list: () => req<Lead[]>("/leads"),
  },
  reports: {
    getToken: (botId: string) => req<{ token: string }>(`/bots/${botId}/report-token`),
  },
  admin: {
    getSettings: () => req<AdminSettings>("/admin/settings", {}, [401, 403]),
    updateSettings: (data: Partial<AdminSettings>) =>
      req<AdminSettings>("/admin/settings", { method: "PUT", body: JSON.stringify(data) }, [401, 403]),
    getTemplates: () => req<CustomTemplate[]>("/admin/templates", {}, [401, 403]),
    createTemplate: (data: Partial<CustomTemplate>) =>
      req<CustomTemplate>("/admin/templates", { method: "POST", body: JSON.stringify(data) }, [401, 403]),
    deleteTemplate: (id: string) =>
      req<{ ok: boolean }>(`/admin/templates/${id}`, { method: "DELETE" }, [401, 403]),
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      req<{ ok: boolean }>("/admin/password", { method: "PUT", body: JSON.stringify(data) }, [401, 403]),
    listAccounts: () => req<AccountUser[]>("/admin/accounts", {}, [401, 403]),
    createAccount: (data: { username: string; email: string; password: string }) =>
      req<AccountUser>("/admin/accounts", { method: "POST", body: JSON.stringify(data) }, [401, 403]),
    updateAccount: (id: string, data: { username?: string; email?: string; password?: string }) =>
      req<AccountUser>(`/admin/accounts/${id}`, { method: "PUT", body: JSON.stringify(data) }, [401, 403]),
    deleteAccount: (id: string) =>
      req<{ ok: boolean }>(`/admin/accounts/${id}`, { method: "DELETE" }, [401, 403]),
  },
};

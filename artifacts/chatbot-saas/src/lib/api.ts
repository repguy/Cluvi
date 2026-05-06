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

export interface User {
  id: string;
  username: string;
  email: string;
}

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

export interface Bot {
  id: string;
  name: string;
  description: string;
  provider: string;
  model: string;
  apiKey: string;
  systemPrompt: string;
  appearance: BotAppearance;
  notificationsConfig: NotificationsConfig;
  isActive: boolean;
  publicId: string;
  leadWebhookUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsOverview {
  totalBots: number;
  activeBots: number;
  totalConversations: number;
  totalMessages: number;
  totalBookings: number;
  dailyConversations: { date: string; count: number }[];
}

export interface RecentConversation {
  id: string;
  botName: string;
  botColor: string;
  messageCount: number;
  createdAt: string;
}

export interface Booking {
  id: string;
  botId: string;
  botName: string;
  sessionId: string;
  name: string;
  phone: string;
  service: string;
  date: string;
  timePreference: string;
  status: string;
  createdAt: string;
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
    get: (id: string) => req<Bot>(`/bots/${id}`),
    create: (data: Partial<Bot>) =>
      req<Bot>("/bots", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Bot>) =>
      req<Bot>(`/bots/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) =>
      req<{ ok: boolean }>(`/bots/${id}`, { method: "DELETE" }),
  },
  analytics: {
    overview: () => req<AnalyticsOverview>("/analytics"),
    recent: () => req<RecentConversation[]>("/analytics/conversations"),
  },
  bookings: {
    list: () => req<Booking[]>("/bookings"),
    updateStatus: (id: string, status: string) =>
      req<Booking>(`/bookings/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
    export: () => req<string>("/bookings/export"),
  },
};

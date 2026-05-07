import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import {
  Settings, Bot, Palette, FileText, Code2, ChevronLeft,
  Save, Check, Eye, EyeOff, Copy, ExternalLink, Plus, X,
  Loader2, CalendarCheck, Volume2, VolumeX, Shield, BarChart2, Globe, Bell, ChevronDown, ChevronUp, Clock,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { api, Bot as BotType, BotAppearance, NotificationsConfig, BotStats, OfficeHoursSchedule } from "../lib/api";
import Layout from "../components/Layout";

const PROVIDERS = [
  { value: "anthropic", label: "Anthropic Claude", sub: "Best reasoning & safety", color: "#f97316" },
  { value: "openai", label: "OpenAI GPT", sub: "Industry standard", color: "#10b981" },
  { value: "gemini", label: "Google Gemini", sub: "Fast & multimodal", color: "#3b82f6" },
  { value: "openrouter", label: "OpenRouter", sub: "Free open-source models", color: "#a855f7" },
];

const MODELS: Record<string, { value: string; label: string; note?: string }[]> = {
  anthropic: [
    { value: "claude-opus-4-5", label: "Claude Opus 4.5", note: "Most capable" },
    { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", note: "Balanced" },
    { value: "claude-haiku-3-5", label: "Claude Haiku 3.5", note: "Fast & cheap" },
  ],
  openai: [
    { value: "gpt-4o", label: "GPT-4o", note: "Most capable" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini", note: "Best value" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo", note: "" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", note: "Budget" },
  ],
  gemini: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", note: "Fastest" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro", note: "Most capable" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash", note: "Balanced" },
  ],
  openrouter: [
    { value: "meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B", note: "Free" },
    { value: "meta-llama/llama-3.1-8b-instruct:free", label: "Llama 3.1 8B", note: "Free · Fast" },
    { value: "deepseek/deepseek-r1:free", label: "DeepSeek R1", note: "Free" },
    { value: "google/gemma-3-27b-it:free", label: "Gemma 3 27B", note: "Free" },
    { value: "qwen/qwen-2.5-72b-instruct:free", label: "Qwen 2.5 72B", note: "Free" },
    { value: "microsoft/phi-4:free", label: "Microsoft Phi-4", note: "Free" },
    { value: "_custom", label: "Custom model ID…", note: "" },
  ],
};

const KEY_LINKS: Record<string, { label: string; url: string }> = {
  anthropic: { label: "console.anthropic.com", url: "https://console.anthropic.com/" },
  openai: { label: "platform.openai.com", url: "https://platform.openai.com/api-keys" },
  gemini: { label: "aistudio.google.com", url: "https://aistudio.google.com/app/apikey" },
  openrouter: { label: "openrouter.ai/keys", url: "https://openrouter.ai/keys" },
};

const DEFAULT_OFFICE_HOURS_SCHEDULE: OfficeHoursSchedule = {
  monday: { open: "09:00", close: "18:00", closed: false },
  tuesday: { open: "09:00", close: "18:00", closed: false },
  wednesday: { open: "09:00", close: "18:00", closed: false },
  thursday: { open: "09:00", close: "18:00", closed: false },
  friday: { open: "09:00", close: "18:00", closed: false },
  saturday: { open: "10:00", close: "16:00", closed: false },
  sunday: { open: "09:00", close: "17:00", closed: true },
};

const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
];

const DAY_LABELS: { key: keyof OfficeHoursSchedule; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

const DEFAULT_APPEARANCE: BotAppearance = {
  primaryColor: "#6C63FF",
  botName: "",
  welcomeMessage: "Hi! How can I help you today?",
  fallbackMessage: "Sorry, I didn't quite understand that. Could you rephrase?",
  tone: "friendly",
  quickActions: [],
  avatarText: "",
  businessType: "",
  phone: "",
  email: "",
  address: "",
  ownerEmail: "",
  ownerPhone: "",
  services: [],
  bookingConfirmationMessage: "Your appointment has been booked! We'll be in touch shortly to confirm. 🎉",
  officeHours: "",
  afterHoursMessage: "We're currently closed! I've noted your message and our team will reach out first thing tomorrow. You can also call us and leave a voicemail! 😊",
  soundEnabled: false,
  showBranding: true,
  brandingText: "",
  brandingUrl: "",
  proactiveGreetingDelay: 0,
  showWelcomeForm: false,
  officeHoursEnabled: false,
  officeHoursTimezone: "America/New_York",
  officeHoursSchedule: { ...DEFAULT_OFFICE_HOURS_SCHEDULE },
};

const DEFAULT_NOTIFICATIONS: NotificationsConfig = {
  resendEnabled: false,
  resendFromEmail: "",
  twilioEnabled: false,
  twilioOwnerPhone: "",
  twilioWhatsappEnabled: false,
  twilioWhatsappTo: "",
  twilioWhatsappFrom: "",
  telegramEnabled: false,
  telegramBotToken: "",
  telegramChatId: "",
  discordEnabled: false,
  discordWebhookUrl: "",
  zapierEnabled: false,
};

type TabId = "general" | "ai" | "appearance" | "prompt" | "booking" | "office-hours" | "notifications" | "security" | "stats" | "integration";

const BASE_TABS: { id: TabId; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: "general", icon: Settings, label: "General" },
  { id: "ai", icon: Bot, label: "AI Provider" },
  { id: "appearance", icon: Palette, label: "Appearance" },
  { id: "prompt", icon: FileText, label: "System Prompt" },
  { id: "booking", icon: CalendarCheck, label: "Booking" },
  { id: "office-hours", icon: Clock, label: "Office Hours" },
  { id: "notifications", icon: Bell, label: "Notifications" },
  { id: "security", icon: Shield, label: "Security" },
  { id: "stats", icon: BarChart2, label: "Stats" },
  { id: "integration", icon: Code2, label: "Integration" },
];

const PALETTE = ["#6C63FF","#8b5cf6","#ec4899","#ef4444","#f97316","#eab308","#22c55e","#4ECDC4","#3b82f6","#0f172a"];
const TONES = ["friendly","professional","casual","formal","concise","enthusiastic"];

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
      {helper && <p className="text-xs text-slate-400 mt-1.5">{helper}</p>}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/30 focus:border-[#6C63FF] transition-all ${props.className ?? ""}`}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/30 focus:border-[#6C63FF] transition-all resize-none ${props.className ?? ""}`}
    />
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex w-9 h-5 rounded-full transition-colors flex-shrink-0 ${enabled ? "bg-[#6C63FF]" : "bg-slate-200"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${enabled ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

function Section({ title, helper, children }: { title: string; helper?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm">
      <div className="pb-1 border-b border-slate-100">
        <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
        {helper && <p className="text-xs text-slate-400 mt-0.5">{helper}</p>}
      </div>
      {children}
    </div>
  );
}

function NotifCard({
  icon, title, description, enabled, onToggle, hint, hintKey, expandedHints, setExpandedHints, steps, children,
}: {
  icon: string; title: string; description: string; enabled: boolean;
  onToggle: (v: boolean) => void; hint: string | null; hintKey: string;
  expandedHints: Record<string, boolean>; setExpandedHints: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  steps?: string[]; children?: React.ReactNode;
}) {
  const isExpanded = expandedHints[hintKey] ?? false;
  const toggleHint = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedHints((prev) => ({ ...prev, [hintKey]: !prev[hintKey] }));
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-xl flex-shrink-0">{icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          </div>
        </div>
        <Toggle enabled={enabled} onChange={onToggle} />
      </div>
      {enabled && (
        <div className="mt-4 space-y-3">
          {children}
          {(hint || steps) && (
            <div className="border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={toggleHint}
                className="flex items-center gap-1.5 text-xs text-[#6C63FF] hover:text-[#5a52e0] font-medium transition-colors"
              >
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {isExpanded ? "Hide setup instructions" : "How does this work?"}
              </button>
              {isExpanded && (
                <div className="mt-3 bg-slate-50 rounded-lg p-3 text-xs text-slate-600 border border-slate-100">
                  {hint && <p>{hint}</p>}
                  {steps && (
                    <ol className="space-y-1.5 mt-1">
                      {steps.map((s, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#6C63FF]/10 text-[#6C63FF] text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReportLinkSection({ botId }: { botId: string }) {
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const data = await api.reports.getToken(botId);
      if (data?.token) setReportUrl(`${window.location.origin}/report/${botId}/${data.token}`);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  async function copyUrl() {
    if (!reportUrl) return;
    await navigator.clipboard.writeText(reportUrl);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">Client Report Link</p>
        <p className="text-xs text-slate-400 mt-0.5">
          Generate a shareable, read-only report showing this bot's stats and bookings. No login required.
        </p>
      </div>
      {reportUrl ? (
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-mono text-slate-600 truncate">
            {reportUrl}
          </code>
          <button
            onClick={copyUrl}
            className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 rounded-lg text-xs text-slate-500 hover:bg-slate-50 transition-colors flex-shrink-0"
          >
            {copying ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copying ? "Copied!" : "Copy"}
          </button>
          <a
            href={reportUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 rounded-lg text-xs text-slate-500 hover:bg-slate-50 transition-colors flex-shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open
          </a>
        </div>
      ) : (
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 bg-[#6C63FF] hover:bg-[#5a52e0] disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
          Generate Report Link
        </button>
      )}
    </div>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function PromptLengthIndicator({ length }: { length: number }) {
  let color = "text-emerald-600 bg-emerald-50 border-emerald-200";
  let label = "Good length";
  let dot = "bg-emerald-500";
  if (length === 0) { color = "text-slate-400 bg-slate-50 border-slate-200"; label = "Empty"; dot = "bg-slate-300"; }
  else if (length < 100) { color = "text-amber-600 bg-amber-50 border-amber-200"; label = "Too short"; dot = "bg-amber-500"; }
  else if (length > 1000) { color = "text-red-600 bg-red-50 border-red-200"; label = "Very long — may cause slow/wordy responses"; dot = "bg-red-500"; }
  else if (length > 500) { color = "text-amber-600 bg-amber-50 border-amber-200"; label = "Getting long"; dot = "bg-amber-500"; }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {length} chars · {label}
    </span>
  );
}

export default function BotEditor() {
  const params = useParams<{ id: string }>();
  const search = useSearch();
  const isNew = params.id === "new";
  const [, navigate] = useLocation();

  const defaultTab = (new URLSearchParams(search).get("tab") as TabId) ?? "general";
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedHints, setExpandedHints] = useState<Record<string, boolean>>({});
  const [customModel, setCustomModel] = useState("");
  const [qaInput, setQaInput] = useState("");
  const [serviceInput, setServiceInput] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [stats, setStats] = useState<BotStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [bot, setBot] = useState<Partial<BotType>>({
    name: "",
    description: "",
    provider: "anthropic",
    model: "claude-haiku-3-5",
    apiKey: "",
    systemPrompt: "",
    appearance: { ...DEFAULT_APPEARANCE },
    notificationsConfig: { ...DEFAULT_NOTIFICATIONS },
    allowedDomains: [],
    isActive: true,
    leadWebhookUrl: "",
  });

  useEffect(() => {
    if (isNew) {
      const raw = localStorage.getItem("botTemplate");
      if (raw) {
        localStorage.removeItem("botTemplate");
        try {
          const tpl = JSON.parse(raw);
          setBot((prev) => ({
            ...prev,
            name: tpl.name ? `${tpl.name} Bot` : "",
            description: tpl.description ?? "",
            provider: tpl.provider ?? "openrouter",
            model: tpl.model ?? "meta-llama/llama-3.3-70b-instruct:free",
            systemPrompt: tpl.systemPrompt ?? "",
            appearance: {
              ...DEFAULT_APPEARANCE,
              botName: tpl.name ?? "",
              businessType: tpl.businessType ?? "",
              welcomeMessage: tpl.welcomeMessage ?? DEFAULT_APPEARANCE.welcomeMessage,
              quickActions: tpl.quickActions ?? [],
              services: tpl.services ?? [],
            },
          }));
        } catch { /* ignore */ }
      }
    } else {
      api.bots.get(params.id)
        .then((data) => {
          if (!data) { navigate("/"); return; }
          setBot({ ...data, allowedDomains: data.allowedDomains ?? [] });
          const models = MODELS[data.provider] ?? [];
          if (data.model && !models.find((m) => m.value === data.model)) {
            setCustomModel(data.model);
          }
        })
        .catch(() => navigate("/"))
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  useEffect(() => {
    if (activeTab === "stats" && !isNew && params.id) {
      setStatsLoading(true);
      api.bots.getStats(params.id)
        .then((data) => { if (data) setStats(data); })
        .finally(() => setStatsLoading(false));
    }
  }, [activeTab, params.id, isNew]);

  const update = useCallback((key: keyof BotType, value: unknown) => {
    setBot((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateAppearance = useCallback((key: keyof BotAppearance, value: unknown) => {
    setBot((prev) => ({
      ...prev,
      appearance: { ...(prev.appearance ?? DEFAULT_APPEARANCE), [key]: value },
    }));
  }, []);

  const updateOfficeHoursSchedule = useCallback((day: keyof OfficeHoursSchedule, field: string, value: unknown) => {
    setBot((prev) => {
      const cur = prev.appearance ?? DEFAULT_APPEARANCE;
      const curSchedule = cur.officeHoursSchedule ?? DEFAULT_OFFICE_HOURS_SCHEDULE;
      return {
        ...prev,
        appearance: {
          ...cur,
          officeHoursSchedule: {
            ...curSchedule,
            [day]: { ...curSchedule[day], [field]: value },
          },
        },
      };
    });
  }, []);

  const updateNotifications = useCallback((key: keyof NotificationsConfig, value: unknown) => {
    setBot((prev) => ({
      ...prev,
      notificationsConfig: { ...(prev.notificationsConfig ?? DEFAULT_NOTIFICATIONS), [key]: value },
    }));
  }, []);

  async function handleSave() {
    if (!bot.name?.trim()) { setError("Bot name is required"); setActiveTab("general"); return; }
    setError("");
    setSaving(true);
    try {
      const payload = { ...bot };
      if (payload.provider === "openrouter" && payload.model === "_custom") {
        payload.model = customModel;
      }
      if (isNew) {
        const created = await api.bots.create(payload);
        navigate(`/bots/${created!.id}`);
      } else {
        const updated = await api.bots.update(params.id, payload);
        if (updated) setBot({ ...updated, allowedDomains: updated.allowedDomains ?? [] });
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function copyEmbed() {
    if (!bot.publicId) return;
    const code = `<script src="${window.location.origin}/api/widget.js?botId=${bot.publicId}"></script>`;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function addDomain() {
    const d = domainInput.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    if (!d) return;
    const current = bot.allowedDomains ?? [];
    if (current.includes(d)) return;
    update("allowedDomains", [...current, d]);
    setDomainInput("");
  }

  function removeDomain(domain: string) {
    update("allowedDomains", (bot.allowedDomains ?? []).filter((d) => d !== domain));
  }

  const appearance = bot.appearance ?? DEFAULT_APPEARANCE;
  const notifications = bot.notificationsConfig ?? DEFAULT_NOTIFICATIONS;
  const models = MODELS[bot.provider ?? "anthropic"] ?? [];
  const keyLink = KEY_LINKS[bot.provider ?? "anthropic"];
  const embedCode = bot.publicId
    ? `<script src="${window.location.origin}/api/widget.js?botId=${bot.publicId}"></script>`
    : null;
  const officeSchedule = appearance.officeHoursSchedule ?? DEFAULT_OFFICE_HOURS_SCHEDULE;

  const TABS = isNew ? BASE_TABS.filter((t) => t.id !== "stats") : BASE_TABS;

  function addQA() {
    if (!qaInput.trim()) return;
    updateAppearance("quickActions", [...(appearance.quickActions ?? []), qaInput.trim()]);
    setQaInput("");
  }

  function addService() {
    if (!serviceInput.trim()) return;
    updateAppearance("services", [...(appearance.services ?? []), serviceInput.trim()]);
    setServiceInput("");
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <header className="bg-white border-b border-slate-200 px-6 h-[60px] flex items-center justify-between flex-shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Bots
          </button>
          <span className="text-slate-200">/</span>
          <span className="text-sm font-semibold text-slate-900">
            {isNew ? "New Bot" : (bot.name || "Untitled")}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-red-500 text-xs">{error}</span>}
          {saved && (
            <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-[#6C63FF] hover:bg-[#5a52e0] disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : isNew ? "Create Bot" : "Save"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-[180px] flex-shrink-0 bg-white border-r border-slate-200 py-4 px-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 mb-2">
            Configuration
          </p>
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-all duration-150 ${
                activeTab === id
                  ? "bg-[#6C63FF]/10 text-[#6C63FF]"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </aside>

        <main className="flex-1 overflow-y-auto p-8 bg-slate-50">
          <div className="max-w-xl space-y-5">

            {/* ── GENERAL ── */}
            {activeTab === "general" && (
              <>
                <Section title="Bot Details">
                  <Field label="Name *">
                    <Input value={bot.name ?? ""} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Smile Care Assistant" />
                  </Field>
                  <Field label="Description" helper="For your reference only — not shown to users.">
                    <Input value={bot.description ?? ""} onChange={(e) => update("description", e.target.value)} placeholder="e.g. Dental clinic chatbot for Dr. Smith" />
                  </Field>
                </Section>
                <Section title="Status">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Active</p>
                      <p className="text-xs text-slate-400 mt-0.5">Widget appears on the embedded website when active.</p>
                    </div>
                    <Toggle enabled={bot.isActive ?? true} onChange={(v) => update("isActive", v)} />
                  </div>
                </Section>
              </>
            )}

            {/* ── AI PROVIDER ── */}
            {activeTab === "ai" && (
              <>
                <Section title="AI Provider">
                  <Field label="Choose provider">
                    <div className="grid grid-cols-2 gap-2">
                      {PROVIDERS.map((p) => (
                        <button
                          key={p.value}
                          onClick={() => { update("provider", p.value); update("model", MODELS[p.value][0]?.value ?? ""); }}
                          className={`text-left p-3 rounded-xl border-2 transition-all ${bot.provider === p.value ? "border-[#6C63FF] bg-[#6C63FF]/5" : "border-slate-200 hover:border-slate-300 bg-white"}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                            <span className="text-xs font-semibold text-slate-900">{p.label}</span>
                          </div>
                          <p className="text-[11px] text-slate-400">{p.sub}</p>
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Model">
                    <div className="space-y-1.5">
                      {models.map((m) => (
                        <button
                          key={m.value}
                          onClick={() => update("model", m.value)}
                          className={`w-full text-left flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-sm transition-all ${
                            (bot.model === m.value || (m.value === "_custom" && bot.model && !models.find(x => x.value === bot.model && x.value !== "_custom")))
                              ? "border-[#6C63FF] bg-[#6C63FF]/5 text-slate-900"
                              : "border-slate-200 text-slate-700 hover:border-slate-300 bg-white"
                          }`}
                        >
                          <span>{m.label}</span>
                          {m.note && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${m.note.startsWith("Free") ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                              {m.note}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                    {bot.provider === "openrouter" && bot.model === "_custom" && (
                      <div className="mt-2">
                        <Input
                          value={customModel}
                          onChange={(e) => setCustomModel(e.target.value)}
                          placeholder="e.g. anthropic/claude-3-haiku"
                          className="mt-2"
                          autoFocus
                        />
                        <p className="text-xs text-slate-400 mt-1.5">
                          Browse model IDs at{" "}
                          <a href="https://openrouter.ai/models" target="_blank" rel="noreferrer" className="text-[#6C63FF] hover:underline">openrouter.ai/models</a>
                        </p>
                      </div>
                    )}
                  </Field>
                </Section>

                <Section title="API Key">
                  <Field label="Key" helper="Stored on the server — never exposed in the browser. All AI calls are proxied.">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showKey ? "text" : "password"}
                          value={bot.apiKey ?? ""}
                          onChange={(e) => update("apiKey", e.target.value)}
                          placeholder="sk-..."
                          autoComplete="off"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowKey((s) => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    {keyLink && (
                      <a href={keyLink.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#6C63FF] hover:underline mt-2">
                        Get key from {keyLink.label}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </Field>
                </Section>
              </>
            )}

            {/* ── APPEARANCE ── */}
            {activeTab === "appearance" && (
              <>
                <Section title="Branding">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Bot Display Name">
                      <Input value={appearance.botName} onChange={(e) => updateAppearance("botName", e.target.value)} placeholder={bot.name ?? "Assistant"} />
                    </Field>
                    <Field label="Avatar Text (1–2 chars)">
                      <Input value={appearance.avatarText} onChange={(e) => updateAppearance("avatarText", e.target.value.slice(0, 2))} placeholder="AB" maxLength={2} />
                    </Field>
                  </div>
                  <Field label="Primary Color">
                    <div className="flex items-center gap-2.5">
                      <input type="color" value={appearance.primaryColor} onChange={(e) => updateAppearance("primaryColor", e.target.value)} className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5 bg-white" />
                      <Input value={appearance.primaryColor} onChange={(e) => updateAppearance("primaryColor", e.target.value)} className="w-32" placeholder="#6C63FF" />
                      <div className="w-10 h-10 rounded-lg border border-slate-200 flex-shrink-0" style={{ backgroundColor: appearance.primaryColor }} />
                    </div>
                    <div className="flex gap-2 mt-2.5 flex-wrap">
                      {PALETTE.map((c) => (
                        <button key={c} onClick={() => updateAppearance("primaryColor", c)} className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${appearance.primaryColor === c ? "border-slate-400 scale-110" : "border-white shadow-sm"}`} style={{ backgroundColor: c }} title={c} />
                      ))}
                    </div>
                  </Field>
                  <div className="space-y-3 border-t border-slate-100 pt-3 mt-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-700">Show branding footer</p>
                        <p className="text-xs text-slate-400 mt-0.5">Show "Powered by …" text at the bottom of the widget.</p>
                      </div>
                      <Toggle enabled={appearance.showBranding ?? true} onChange={(v) => updateAppearance("showBranding", v)} />
                    </div>
                    {(appearance.showBranding ?? true) && (
                      <div className="grid grid-cols-2 gap-3 pl-1">
                        <Field label="Brand Name" helper='e.g. "Cluvi" — shown as clickable text'>
                          <Input value={appearance.brandingText ?? ""} onChange={(e) => updateAppearance("brandingText", e.target.value)} placeholder="Cluvi" />
                        </Field>
                        <Field label="Brand URL" helper="Where the brand name links to">
                          <Input type="url" value={appearance.brandingUrl ?? ""} onChange={(e) => updateAppearance("brandingUrl", e.target.value)} placeholder="https://cluvi.app" />
                        </Field>
                      </div>
                    )}
                  </div>
                </Section>

                <Section title="Engagement" helper="Automatically greet visitors to increase chat open rates.">
                  <Field label="Proactive Greeting (seconds)" helper="Auto-open the chat and send a greeting after this many seconds. Set to 0 to disable.">
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        min={0}
                        max={300}
                        value={appearance.proactiveGreetingDelay ?? 0}
                        onChange={(e) => updateAppearance("proactiveGreetingDelay", Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-28"
                        placeholder="0"
                      />
                      <span className="text-xs text-slate-400">seconds delay (0 = off)</span>
                    </div>
                  </Field>
                  <div className="space-y-3 border-t border-slate-100 pt-3 mt-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-700">Show welcome form before chat</p>
                        <p className="text-xs text-slate-400 mt-0.5">Ask visitors for their name &amp; email before chatting. They can skip.</p>
                      </div>
                      <Toggle enabled={appearance.showWelcomeForm ?? false} onChange={(v) => updateAppearance("showWelcomeForm", v)} />
                    </div>
                    {(appearance.showWelcomeForm ?? false) && (
                      <div className="flex items-center justify-between pl-1">
                        <div>
                          <p className="text-sm font-medium text-slate-700">Save leads to inbox</p>
                          <p className="text-xs text-slate-400 mt-0.5">Captured names &amp; emails appear in your Leads page.</p>
                        </div>
                        <Toggle enabled={appearance.leadCaptureEnabled ?? false} onChange={(v) => updateAppearance("leadCaptureEnabled", v)} />
                      </div>
                    )}
                  </div>
                </Section>

                <Section title="Messages">
                  <Field label="Welcome Message">
                    <Textarea value={appearance.welcomeMessage} onChange={(e) => updateAppearance("welcomeMessage", e.target.value)} rows={2} placeholder="Hi there! How can I help?" />
                  </Field>
                  <Field label="Fallback Message">
                    <Textarea value={appearance.fallbackMessage} onChange={(e) => updateAppearance("fallbackMessage", e.target.value)} rows={2} placeholder="Sorry, I didn't understand. Could you rephrase?" />
                  </Field>
                  <Field label="Tone">
                    <div className="flex flex-wrap gap-2">
                      {TONES.map((t) => (
                        <button key={t} onClick={() => updateAppearance("tone", t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${appearance.tone === t ? "border-[#6C63FF] bg-[#6C63FF]/10 text-[#6C63FF]" : "border-slate-200 text-slate-500 hover:border-slate-300 bg-white"}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Quick Action Buttons" helper="Shortcuts shown when the chat opens.">
                    <div className="flex flex-wrap gap-2 mb-2 min-h-[28px]">
                      {(appearance.quickActions ?? []).map((qa, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-1.5 rounded-lg">
                          {qa}
                          <button onClick={() => updateAppearance("quickActions", (appearance.quickActions ?? []).filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-slate-700 transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input value={qaInput} onChange={(e) => setQaInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addQA())} placeholder="Type a quick action and press Enter…" />
                      <button onClick={addQA} className="flex items-center gap-1 px-3 py-2.5 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors flex-shrink-0">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </Field>
                </Section>

                <Section title="Business Info" helper="Used by the AI to answer contact and location questions.">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Business Type"><Input value={appearance.businessType} onChange={(e) => updateAppearance("businessType", e.target.value)} placeholder="Dental Clinic" /></Field>
                    <Field label="Phone"><Input value={appearance.phone} onChange={(e) => updateAppearance("phone", e.target.value)} placeholder="(555) 123-4567" /></Field>
                    <Field label="Email"><Input value={appearance.email} onChange={(e) => updateAppearance("email", e.target.value)} placeholder="hello@business.com" /></Field>
                    <Field label="Address"><Input value={appearance.address} onChange={(e) => updateAppearance("address", e.target.value)} placeholder="123 Main St" /></Field>
                  </div>
                </Section>
              </>
            )}

            {/* ── PROMPT ── */}
            {activeTab === "prompt" && (
              <>
                <div className="flex items-start gap-3 bg-[#6C63FF]/5 border border-[#6C63FF]/20 rounded-xl p-4 text-sm text-[#6C63FF]">
                  <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div><strong>Tip:</strong> Be specific about what the bot knows, how it should behave, and what it should never say.</div>
                </div>
                <Section title="System Prompt">
                  <Textarea
                    value={bot.systemPrompt ?? ""}
                    onChange={(e) => update("systemPrompt", e.target.value)}
                    rows={18}
                    placeholder={`You are a helpful assistant for [Business Name]...\n\nYou help customers by:\n- Answering questions about services and pricing\n- Booking appointments\n- Providing contact info\n\nKeep all responses under 2-3 sentences. Be concise and conversational, never wordy. Get straight to the point.\n\nAlways be ${appearance.tone} and professional.`}
                  />
                  <div className="flex items-center justify-between mt-2">
                    <PromptLengthIndicator length={bot.systemPrompt?.length ?? 0} />
                    <button
                      onClick={() => update("systemPrompt", `You are a helpful AI assistant for ${bot.name ?? "this business"}${appearance.businessType ? `, a ${appearance.businessType}` : ""}.\n\nYou help customers by:\n- Answering questions about services, pricing, and hours\n- Collecting appointment bookings (ask for name, phone, preferred date/time)\n- Providing contact information when needed\n\nBusiness contact info:\n${appearance.phone ? `- Phone: ${appearance.phone}\n` : ""}${appearance.email ? `- Email: ${appearance.email}\n` : ""}${appearance.address ? `- Address: ${appearance.address}\n` : ""}\nServices offered: ${(appearance.services ?? []).join(", ") || "Ask the customer what they need"}\n\nKeep all responses under 2-3 sentences. Be concise and conversational, never wordy. Get straight to the point.\n\nTone: Be ${appearance.tone}, clear, and concise.\n\nNever make up information. If unsure, ask the customer to call directly.`)}
                      className="text-xs text-[#6C63FF] hover:underline font-medium"
                    >
                      Generate starter prompt
                    </button>
                  </div>
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3 mt-1">
                    <span className="text-sm">💡</span>
                    <p className="text-xs text-amber-700">
                      <strong>Tip:</strong> Tell your bot to keep responses short for better user experience. Example: "Keep all responses under 2-3 sentences. Be concise and conversational."
                    </p>
                  </div>
                </Section>
              </>
            )}

            {/* ── BOOKING ── */}
            {activeTab === "booking" && (
              <>
                <Section title="Owner Contact" helper="Where booking notifications will be sent.">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Owner Email">
                      <Input type="email" value={appearance.ownerEmail} onChange={(e) => updateAppearance("ownerEmail", e.target.value)} placeholder="owner@business.com" />
                    </Field>
                    <Field label="Owner Phone">
                      <Input value={appearance.ownerPhone} onChange={(e) => updateAppearance("ownerPhone", e.target.value)} placeholder="+1 (555) 000-0000" />
                    </Field>
                  </div>
                </Section>

                <Section title="Services" helper="These appear as quick-select buttons during the booking flow.">
                  <div className="flex flex-wrap gap-2 mb-2 min-h-[28px]">
                    {(appearance.services ?? []).map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-medium px-2.5 py-1.5 rounded-lg">
                        {s}
                        <button onClick={() => updateAppearance("services", (appearance.services ?? []).filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-slate-700 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    {(appearance.services ?? []).length === 0 && (
                      <p className="text-xs text-slate-400 italic">No services yet — add some below</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input value={serviceInput} onChange={(e) => setServiceInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addService())} placeholder="e.g. Haircut, Consultation, Cleaning…" />
                    <button onClick={addService} className="flex items-center gap-1 px-3 py-2.5 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors flex-shrink-0">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </Section>

                <Section title="Booking Messages">
                  <Field label="Confirmation Message" helper="Shown to visitor after they confirm a booking.">
                    <Textarea value={appearance.bookingConfirmationMessage} onChange={(e) => updateAppearance("bookingConfirmationMessage", e.target.value)} rows={2} placeholder="Your appointment has been booked! We'll be in touch shortly. 🎉" />
                  </Field>
                  <Field label="Office Hours Display Text" helper="Optional — the AI can reference this when asked about hours.">
                    <Input value={appearance.officeHours} onChange={(e) => updateAppearance("officeHours", e.target.value)} placeholder="Mon–Fri 9am–5pm, Sat 10am–2pm" />
                  </Field>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {appearance.soundEnabled ? <Volume2 className="w-4 h-4 text-[#6C63FF]" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                      <div>
                        <p className="text-sm font-medium text-slate-700">Sound notification</p>
                        <p className="text-xs text-slate-400">Play a subtle sound when the bot replies</p>
                      </div>
                    </div>
                    <Toggle enabled={appearance.soundEnabled} onChange={(v) => updateAppearance("soundEnabled", v)} />
                  </div>
                </Section>
              </>
            )}

            {/* ── OFFICE HOURS ── */}
            {activeTab === "office-hours" && (
              <>
                <div className="flex items-start gap-3 bg-[#6C63FF]/5 border border-[#6C63FF]/20 rounded-xl p-4 text-sm text-[#6C63FF]">
                  <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    When enabled, users who message outside your office hours are greeted with a friendly message and their info is collected automatically — no AI API call needed.
                  </div>
                </div>

                <Section title="After Hours Detection">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Enable after-hours detection</p>
                      <p className="text-xs text-slate-400 mt-0.5">Intercept messages outside office hours and collect lead info automatically.</p>
                    </div>
                    <Toggle enabled={appearance.officeHoursEnabled ?? false} onChange={(v) => updateAppearance("officeHoursEnabled", v)} />
                  </div>

                  {(appearance.officeHoursEnabled ?? false) && (
                    <>
                      <Field label="Timezone">
                        <select
                          value={appearance.officeHoursTimezone ?? "America/New_York"}
                          onChange={(e) => updateAppearance("officeHoursTimezone", e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/30 focus:border-[#6C63FF] transition-all"
                        >
                          {US_TIMEZONES.map((tz) => (
                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                          ))}
                        </select>
                      </Field>

                      <div>
                        <label className="block text-[13px] font-medium text-slate-700 mb-2">Weekly Schedule</label>
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                          <div className="grid grid-cols-[100px_80px_1fr_1fr] gap-0 text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2 border-b border-slate-100 bg-slate-50">
                            <span>Day</span>
                            <span>Closed</span>
                            <span>Opens</span>
                            <span>Closes</span>
                          </div>
                          {DAY_LABELS.map(({ key, label }) => {
                            const day = officeSchedule[key];
                            return (
                              <div key={key} className="grid grid-cols-[100px_80px_1fr_1fr] items-center gap-0 px-4 py-2.5 border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 transition-colors">
                                <span className="text-sm font-medium text-slate-700">{label}</span>
                                <div className="flex items-center">
                                  <Toggle
                                    enabled={day.closed}
                                    onChange={(v) => updateOfficeHoursSchedule(key, "closed", v)}
                                  />
                                </div>
                                <input
                                  type="time"
                                  value={day.open}
                                  disabled={day.closed}
                                  onChange={(e) => updateOfficeHoursSchedule(key, "open", e.target.value)}
                                  className="w-28 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/30 disabled:opacity-30 disabled:cursor-not-allowed bg-white"
                                />
                                <input
                                  type="time"
                                  value={day.close}
                                  disabled={day.closed}
                                  onChange={(e) => updateOfficeHoursSchedule(key, "close", e.target.value)}
                                  className="w-28 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/30 disabled:opacity-30 disabled:cursor-not-allowed bg-white"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}
                </Section>

                {(appearance.officeHoursEnabled ?? false) && (
                  <Section title="After-Hours Message" helper="This is the first message users see when they reach out outside business hours.">
                    <Field label="Greeting Message">
                      <Textarea
                        value={appearance.afterHoursMessage ?? ""}
                        onChange={(e) => updateAppearance("afterHoursMessage", e.target.value)}
                        rows={3}
                        placeholder="We're currently closed! I've noted your message and our team will reach out first thing tomorrow. You can also call us and leave a voicemail! 😊"
                      />
                    </Field>
                    <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg p-3">
                      <span className="text-sm">🌙</span>
                      <p className="text-xs text-blue-700">
                        After this message, the bot automatically collects the visitor's name, phone, and reason — then saves it as an "After Hours Lead" in your Bookings page and sends you a notification.
                      </p>
                    </div>
                  </Section>
                )}

                {!(appearance.officeHoursEnabled ?? false) && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Clock className="w-10 h-10 text-slate-200 mb-3" />
                    <p className="text-slate-500 font-medium">After-hours detection is disabled</p>
                    <p className="text-slate-400 text-sm mt-1 max-w-xs">
                      Enable it above to automatically handle messages received outside your business hours.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ── NOTIFICATIONS ── */}
            {activeTab === "notifications" && (
              <>
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 mb-1">
                  <Bell className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" />
                  <div>Get notified the moment a new booking or after-hours lead comes in. Enable any combination of channels below.</div>
                </div>

                <NotifCard
                  icon="📧" title="Email Notification" description="Get an email when a booking comes in"
                  enabled={notifications.resendEnabled} onToggle={(v) => updateNotifications("resendEnabled", v)}
                  hint="Just enter the business owner's email in the Booking tab → Owner Contact. No Resend account needed — Cluvi handles all email delivery."
                  hintKey="email" expandedHints={expandedHints} setExpandedHints={setExpandedHints}
                >
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-100">
                    Owner email is set in the <strong>Booking</strong> tab → Owner Contact section.
                    Cluvi sends all emails using its own Resend account — no setup required.
                  </p>
                </NotifCard>

                <NotifCard
                  icon="📱" title="SMS Notification" description="Get a text message when a booking comes in"
                  enabled={notifications.twilioEnabled} onToggle={(v) => updateNotifications("twilioEnabled", v)}
                  hint="Just enter the business owner's phone number. Cluvi sends the SMS using its own Twilio account — no Twilio account needed."
                  hintKey="sms" expandedHints={expandedHints} setExpandedHints={setExpandedHints}
                >
                  <Field label="Owner Phone Number">
                    <Input
                      value={notifications.twilioOwnerPhone}
                      onChange={(e) => updateNotifications("twilioOwnerPhone", e.target.value)}
                      placeholder="+15551234567"
                    />
                  </Field>
                </NotifCard>

                <NotifCard
                  icon="💬" title="WhatsApp Notification" description="Get a WhatsApp message when a booking comes in"
                  enabled={notifications.twilioWhatsappEnabled} onToggle={(v) => updateNotifications("twilioWhatsappEnabled", v)}
                  hint="Enter the owner's WhatsApp number (with country code). Cluvi uses the Twilio WhatsApp sandbox — the owner must message the sandbox number once to opt in."
                  hintKey="whatsapp" expandedHints={expandedHints} setExpandedHints={setExpandedHints}
                >
                  <Field label="Owner WhatsApp Number" helper="Include country code — e.g. +15551234567">
                    <Input
                      value={notifications.twilioWhatsappTo}
                      onChange={(e) => updateNotifications("twilioWhatsappTo", e.target.value)}
                      placeholder="+15551234567"
                    />
                  </Field>
                </NotifCard>

                <NotifCard
                  icon="✈️" title="Telegram Notification" description="Get a Telegram message when a booking comes in"
                  enabled={notifications.telegramEnabled} onToggle={(v) => updateNotifications("telegramEnabled", v)}
                  hint={null}
                  hintKey="telegram" expandedHints={expandedHints} setExpandedHints={setExpandedHints}
                  steps={[
                    "Open Telegram → search @BotFather → send /newbot",
                    "Follow the steps and copy the bot token it gives you",
                    "Open your new bot → send it any message",
                    "Visit: api.telegram.org/bot{YOUR_TOKEN}/getUpdates",
                    'Find "chat":{"id": 123456} — that number is your Chat ID',
                    "Paste both values below and you're done!",
                  ]}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Bot Token">
                      <Input
                        value={notifications.telegramBotToken}
                        onChange={(e) => updateNotifications("telegramBotToken", e.target.value)}
                        placeholder="123456:ABCdef..."
                        autoComplete="off"
                      />
                    </Field>
                    <Field label="Chat ID">
                      <Input
                        value={notifications.telegramChatId}
                        onChange={(e) => updateNotifications("telegramChatId", e.target.value)}
                        placeholder="123456789"
                      />
                    </Field>
                  </div>
                </NotifCard>

                <NotifCard
                  icon="🎮" title="Discord Notification" description="Post a message to your Discord server when a booking comes in"
                  enabled={notifications.discordEnabled} onToggle={(v) => updateNotifications("discordEnabled", v)}
                  hint={null}
                  hintKey="discord" expandedHints={expandedHints} setExpandedHints={setExpandedHints}
                  steps={[
                    "Open Discord and go to your server",
                    "Click the gear icon on the channel you want notifications in",
                    "Go to Integrations → Webhooks → New Webhook",
                    "Copy the Webhook URL and paste it below",
                  ]}
                >
                  <Field label="Discord Webhook URL">
                    <Input
                      value={notifications.discordWebhookUrl}
                      onChange={(e) => updateNotifications("discordWebhookUrl", e.target.value)}
                      placeholder="https://discord.com/api/webhooks/..."
                    />
                  </Field>
                </NotifCard>

                <NotifCard
                  icon="🔗" title="Zapier / Webhook" description="POST booking data to any URL — Zapier, Make, n8n, or custom"
                  enabled={notifications.zapierEnabled !== false} onToggle={(v) => updateNotifications("zapierEnabled", v)}
                  hint={null}
                  hintKey="zapier" expandedHints={expandedHints} setExpandedHints={setExpandedHints}
                  steps={[
                    "In Zapier, create a new Zap with a Webhook trigger",
                    "Choose 'Catch Hook' and copy the webhook URL",
                    "Paste the URL in the Bot → General tab → Lead Webhook URL field",
                    "Bookings will be sent as JSON with name, phone, service, date, time",
                  ]}
                >
                  <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-100">
                    Set the webhook URL in the <strong>General</strong> tab → Lead Webhook URL.
                  </p>
                </NotifCard>
              </>
            )}

            {/* ── SECURITY ── */}
            {activeTab === "security" && (
              <>
                <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-700">
                  <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" />
                  <div>
                    <strong>Domain Whitelist</strong> — if set, the widget will only respond on the listed domains. Leave empty to allow all domains.
                  </div>
                </div>

                <Section title="Allowed Domains" helper="Only these domains can load and use this bot's widget. Add without 'https://' or 'www.'">
                  <div className="space-y-2 min-h-[32px]">
                    {(bot.allowedDomains ?? []).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No restrictions — widget works on all domains</p>
                    ) : (
                      (bot.allowedDomains ?? []).map((d, i) => (
                        <div key={i} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-sm font-mono text-slate-700">{d}</span>
                          </div>
                          <button onClick={() => removeDomain(d)} className="text-slate-400 hover:text-red-500 transition-colors ml-2">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Input
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDomain())}
                      placeholder="example.com"
                    />
                    <button onClick={addDomain} className="flex items-center gap-1 px-3 py-2.5 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors flex-shrink-0">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-400">Enter domains like <code className="bg-slate-100 px-1 rounded">example.com</code> — subdomains are included automatically.</p>
                </Section>

                <Section title="Rate Limiting" helper="Built-in protection against abuse — no configuration needed.">
                  <div className="space-y-3">
                    {[
                      { label: "Chat endpoint", limit: "30 requests / minute per IP" },
                      { label: "Booking endpoint", limit: "10 requests / minute per IP" },
                    ].map(({ label, limit }) => (
                      <div key={label} className="flex items-center justify-between">
                        <p className="text-sm text-slate-700">{label}</p>
                        <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full font-medium">{limit}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              </>
            )}

            {/* ── STATS ── */}
            {activeTab === "stats" && !isNew && (
              <>
                {statsLoading ? (
                  <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
                  </div>
                ) : stats ? (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: "Conversations", value: stats.totalConversations },
                        { label: "Messages", value: stats.totalMessages },
                        { label: "Bookings", value: stats.totalBookings },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm text-center">
                          <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
                          <p className="text-xs text-slate-400 mt-1">{label}</p>
                        </div>
                      ))}
                    </div>

                    <Section title="Daily Conversations (Last 7 Days)">
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={stats.dailyConversations} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                            <defs>
                              <linearGradient id="botGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
                              labelFormatter={formatDate}
                            />
                            <Area type="monotone" dataKey="count" stroke="#6C63FF" strokeWidth={2} fill="url(#botGrad)" name="Conversations" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </Section>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <BarChart2 className="w-10 h-10 text-slate-200 mb-3" />
                    <p className="text-slate-400">No stats available yet.</p>
                    <p className="text-slate-300 text-sm mt-1">Stats appear once the widget receives its first chat.</p>
                  </div>
                )}
              </>
            )}

            {/* ── INTEGRATION ── */}
            {activeTab === "integration" && (
              <>
                {!bot.publicId ? (
                  <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
                    <Code2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                    <div>Save the bot first to generate the embed code.</div>
                  </div>
                ) : (
                  <>
                    <Section title="Embed Code" helper="Paste this just before the closing </body> tag on your client's website.">
                      <div className="relative">
                        <pre className="bg-slate-900 text-emerald-400 rounded-xl p-4 text-xs overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap break-all">
                          {embedCode}
                        </pre>
                        <button
                          onClick={copyEmbed}
                          className="absolute top-3 right-3 flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </Section>

                    <Section title="Shareable Link" helper="Send this link to anyone — it opens a branded page with your bot pre-loaded. No embedding needed.">
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono text-slate-600 truncate">
                          {`${window.location.origin}/p/${bot.publicId}`}
                        </code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/p/${bot.publicId}`); }}
                          className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 rounded-lg text-xs text-slate-500 hover:bg-slate-50 transition-colors flex-shrink-0"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </button>
                        <a
                          href={`/p/${bot.publicId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 rounded-lg text-xs text-slate-500 hover:bg-slate-50 transition-colors flex-shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Open
                        </a>
                      </div>
                    </Section>

                    <ReportLinkSection botId={bot.id!} />

                    <Section title="Bot ID (Public)" helper="Share this with developers who need to reference the bot directly.">
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-mono text-slate-600 truncate">
                          {bot.publicId}
                        </code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(bot.publicId!); }}
                          className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 rounded-lg text-xs text-slate-500 hover:bg-slate-50 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </button>
                      </div>
                    </Section>

                    <Section title="Preview" helper="Test the widget in a sandbox before embedding on a real site.">
                      <a
                        href={`/preview?botId=${bot.publicId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 bg-[#6C63FF] hover:bg-[#5a52e0] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Preview
                      </a>
                    </Section>
                  </>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </Layout>
  );
}

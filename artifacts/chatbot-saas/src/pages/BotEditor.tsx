import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import {
  Settings, Bot, Palette, FileText, Code2, ChevronLeft,
  Save, Check, Eye, EyeOff, Copy, ExternalLink, Plus, X,
  Loader2, CalendarCheck, Volume2, VolumeX, Shield, BarChart2, Globe,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { api, Bot as BotType, BotAppearance, NotificationsConfig, BotStats } from "../lib/api";
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

const DEFAULT_APPEARANCE: BotAppearance = {
  primaryColor: "#6366f1",
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
  afterHoursMessage: "",
  soundEnabled: false,
};

const DEFAULT_NOTIFICATIONS: NotificationsConfig = {
  resendApiKey: "",
  resendFromEmail: "",
  resendEnabled: false,
  twilioAccountSid: "",
  twilioAuthToken: "",
  twilioOwnerPhone: "",
  twilioFromPhone: "",
  twilioEnabled: false,
  zapierEnabled: true,
};

type TabId = "general" | "ai" | "appearance" | "prompt" | "booking" | "security" | "stats" | "integration";

const BASE_TABS: { id: TabId; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: "general", icon: Settings, label: "General" },
  { id: "ai", icon: Bot, label: "AI Provider" },
  { id: "appearance", icon: Palette, label: "Appearance" },
  { id: "prompt", icon: FileText, label: "System Prompt" },
  { id: "booking", icon: CalendarCheck, label: "Booking" },
  { id: "security", icon: Shield, label: "Security" },
  { id: "stats", icon: BarChart2, label: "Stats" },
  { id: "integration", icon: Code2, label: "Integration" },
];

const PALETTE = ["#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316","#eab308","#22c55e","#06b6d4","#3b82f6","#0f172a"];
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
      className={`w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all ${props.className ?? ""}`}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full bg-white border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all resize-none ${props.className ?? ""}`}
    />
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex w-9 h-5 rounded-full transition-colors flex-shrink-0 ${enabled ? "bg-indigo-500" : "bg-slate-200"}`}
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

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  const [showResendKey, setShowResendKey] = useState(false);
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [copied, setCopied] = useState(false);
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
      // Check for a pending template from the Dashboard
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
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  // Load stats when stats tab is activated
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
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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
                  ? "bg-indigo-50 text-indigo-600"
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
                          className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-left transition-all ${bot.provider === p.value ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 leading-tight">{p.label}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{p.sub}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </Field>
                </Section>

                <Section title="Model">
                  <Field label="Select model">
                    <div className="grid grid-cols-1 gap-1.5">
                      {models.map((m) => (
                        <button
                          key={m.value}
                          onClick={() => { update("model", m.value); if (m.value !== "_custom") setCustomModel(""); }}
                          className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-sm transition-all ${
                            (bot.model === m.value || (m.value === "_custom" && !models.find(x => x.value === bot.model && x.value !== "_custom") && bot.provider === "openrouter"))
                              ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                          }`}
                        >
                          <span className="font-medium">{m.label}</span>
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
                          <a href="https://openrouter.ai/models" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">openrouter.ai/models</a>
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
                      <a href={keyLink.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:underline mt-2">
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
                      <Input value={appearance.primaryColor} onChange={(e) => updateAppearance("primaryColor", e.target.value)} className="w-32" placeholder="#6366f1" />
                      <div className="w-10 h-10 rounded-lg border border-slate-200 flex-shrink-0" style={{ backgroundColor: appearance.primaryColor }} />
                    </div>
                    <div className="flex gap-2 mt-2.5 flex-wrap">
                      {PALETTE.map((c) => (
                        <button key={c} onClick={() => updateAppearance("primaryColor", c)} className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${appearance.primaryColor === c ? "border-slate-400 scale-110" : "border-white shadow-sm"}`} style={{ backgroundColor: c }} title={c} />
                      ))}
                    </div>
                  </Field>
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
                        <button key={t} onClick={() => updateAppearance("tone", t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${appearance.tone === t ? "border-indigo-400 bg-indigo-50 text-indigo-600" : "border-slate-200 text-slate-500 hover:border-slate-300 bg-white"}`}>
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
                <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-800">
                  <FileText className="w-4 h-4 flex-shrink-0 mt-0.5 text-indigo-500" />
                  <div><strong>Tip:</strong> Be specific about what the bot knows, how it should behave, and what it should never say.</div>
                </div>
                <Section title="System Prompt">
                  <Textarea
                    value={bot.systemPrompt ?? ""}
                    onChange={(e) => update("systemPrompt", e.target.value)}
                    rows={18}
                    placeholder={`You are a helpful assistant for [Business Name]...\n\nYou help customers by:\n- Answering questions about services and pricing\n- Booking appointments\n- Providing contact info\n\nAlways be ${appearance.tone} and professional.`}
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-slate-400">{bot.systemPrompt?.length ?? 0} characters</p>
                    <button
                      onClick={() => update("systemPrompt", `You are a helpful AI assistant for ${bot.name ?? "this business"}${appearance.businessType ? `, a ${appearance.businessType}` : ""}.\n\nYou help customers by:\n- Answering questions about services, pricing, and hours\n- Collecting appointment bookings (ask for name, phone, preferred date/time)\n- Providing contact information when needed\n\nBusiness contact info:\n${appearance.phone ? `- Phone: ${appearance.phone}\n` : ""}${appearance.email ? `- Email: ${appearance.email}\n` : ""}${appearance.address ? `- Address: ${appearance.address}\n` : ""}\nServices offered: ${(appearance.services ?? []).join(", ") || "Ask the customer what they need"}\n\nTone: Be ${appearance.tone}, clear, and concise. Keep responses to 2–3 sentences unless listing multiple items.\n\nNever make up information. If unsure, ask the customer to call directly.`)}
                      className="text-xs text-indigo-500 hover:underline font-medium"
                    >
                      Generate starter prompt
                    </button>
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
                  <Field label="Office Hours" helper="Optional — the AI can reference this when asked.">
                    <Input value={appearance.officeHours} onChange={(e) => updateAppearance("officeHours", e.target.value)} placeholder="Mon–Fri 9am–5pm, Sat 10am–2pm" />
                  </Field>
                  <Field label="After-Hours Message">
                    <Input value={appearance.afterHoursMessage} onChange={(e) => updateAppearance("afterHoursMessage", e.target.value)} placeholder="We're currently closed. Leave your details and we'll call you back!" />
                  </Field>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {appearance.soundEnabled ? <Volume2 className="w-4 h-4 text-indigo-500" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                      <div>
                        <p className="text-sm font-medium text-slate-700">Sound notification</p>
                        <p className="text-xs text-slate-400">Play a subtle sound when the bot replies</p>
                      </div>
                    </div>
                    <Toggle enabled={appearance.soundEnabled} onChange={(v) => updateAppearance("soundEnabled", v)} />
                  </div>
                </Section>

                <Section title="Email Notifications (Resend)" helper="Send a confirmation email to the owner when a booking is submitted.">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Enable Resend email</p>
                      <p className="text-xs text-slate-400">Requires a Resend API key</p>
                    </div>
                    <Toggle enabled={notifications.resendEnabled} onChange={(v) => updateNotifications("resendEnabled", v)} />
                  </div>
                  {notifications.resendEnabled && (
                    <>
                      <Field label="Resend API Key">
                        <div className="relative">
                          <Input type={showResendKey ? "text" : "password"} value={notifications.resendApiKey} onChange={(e) => updateNotifications("resendApiKey", e.target.value)} placeholder="re_..." autoComplete="off" className="pr-10" />
                          <button type="button" onClick={() => setShowResendKey(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showResendKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:underline mt-1">Get key from resend.com <ExternalLink className="w-3 h-3" /></a>
                      </Field>
                      <Field label="From Email" helper="Must be a verified sender in Resend.">
                        <Input type="email" value={notifications.resendFromEmail} onChange={(e) => updateNotifications("resendFromEmail", e.target.value)} placeholder="bookings@yourdomain.com" />
                      </Field>
                    </>
                  )}
                </Section>

                <Section title="SMS Notifications (Twilio)" helper="Send an SMS to the owner's phone when a booking is submitted.">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Enable Twilio SMS</p>
                      <p className="text-xs text-slate-400">Requires a Twilio account</p>
                    </div>
                    <Toggle enabled={notifications.twilioEnabled} onChange={(v) => updateNotifications("twilioEnabled", v)} />
                  </div>
                  {notifications.twilioEnabled && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Account SID">
                          <Input value={notifications.twilioAccountSid} onChange={(e) => updateNotifications("twilioAccountSid", e.target.value)} placeholder="ACxxxx..." autoComplete="off" />
                        </Field>
                        <Field label="Auth Token">
                          <div className="relative">
                            <Input type={showTwilioToken ? "text" : "password"} value={notifications.twilioAuthToken} onChange={(e) => updateNotifications("twilioAuthToken", e.target.value)} placeholder="••••••" autoComplete="off" className="pr-10" />
                            <button type="button" onClick={() => setShowTwilioToken(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                              {showTwilioToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Owner Phone (To)">
                          <Input value={notifications.twilioOwnerPhone} onChange={(e) => updateNotifications("twilioOwnerPhone", e.target.value)} placeholder="+15550001234" />
                        </Field>
                        <Field label="Twilio Phone (From)">
                          <Input value={notifications.twilioFromPhone} onChange={(e) => updateNotifications("twilioFromPhone", e.target.value)} placeholder="+15559876543" />
                        </Field>
                      </div>
                    </>
                  )}
                </Section>

                <Section title="Zapier / Webhook" helper="POST booking data to any URL (Zapier, Make, n8n, etc.)">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Enable webhook</p>
                      <p className="text-xs text-slate-400">Send booking data to a webhook URL</p>
                    </div>
                    <Toggle enabled={notifications.zapierEnabled !== false} onChange={(v) => updateNotifications("zapierEnabled", v)} />
                  </div>
                  {notifications.zapierEnabled !== false && (
                    <Field label="Webhook URL">
                      <Input value={bot.leadWebhookUrl ?? ""} onChange={(e) => update("leadWebhookUrl", e.target.value)} placeholder="https://hooks.zapier.com/..." />
                    </Field>
                  )}
                </Section>
              </>
            )}

            {/* ── SECURITY ── */}
            {activeTab === "security" && (
              <>
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
                  <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
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
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
                              labelFormatter={formatDate}
                            />
                            <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#botGrad)" name="Conversations" />
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
                        className="inline-flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
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

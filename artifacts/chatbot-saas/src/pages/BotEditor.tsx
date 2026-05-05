import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams } from "wouter";
import { api, Bot, BotAppearance } from "../lib/api";

const PROVIDERS = [
  { value: "anthropic", label: "Anthropic Claude", icon: "🔶" },
  { value: "openai", label: "OpenAI GPT", icon: "🟢" },
  { value: "gemini", label: "Google Gemini", icon: "🔵" },
  { value: "openrouter", label: "OpenRouter (Open Source / Free)", icon: "🟣" },
];

const MODELS: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: "claude-opus-4-5", label: "Claude Opus 4.5 — Most capable" },
    { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5 — Balanced" },
    { value: "claude-haiku-3-5", label: "Claude Haiku 3.5 — Fast & cheap" },
  ],
  openai: [
    { value: "gpt-4o", label: "GPT-4o — Most capable" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini — Balanced & affordable" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo — Budget" },
  ],
  gemini: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash — Fastest" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro — Most capable" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash — Balanced" },
  ],
  openrouter: [
    { value: "meta-llama/llama-3.1-8b-instruct:free", label: "Llama 3.1 8B (Free)" },
    { value: "mistralai/mistral-7b-instruct:free", label: "Mistral 7B (Free)" },
    { value: "google/gemma-2-9b-it:free", label: "Gemma 2 9B (Free)" },
    { value: "microsoft/phi-3-mini-128k-instruct:free", label: "Phi-3 Mini (Free)" },
    { value: "deepseek/deepseek-r1:free", label: "DeepSeek R1 (Free)" },
    { value: "qwen/qwen-2.5-72b-instruct:free", label: "Qwen 2.5 72B (Free)" },
    { value: "_custom", label: "Custom model ID..." },
  ],
};

const API_KEY_HINTS: Record<string, { label: string; url: string }> = {
  anthropic: { label: "console.anthropic.com", url: "https://console.anthropic.com/" },
  openai: { label: "platform.openai.com", url: "https://platform.openai.com/api-keys" },
  gemini: { label: "aistudio.google.com", url: "https://aistudio.google.com/apikey" },
  openrouter: { label: "openrouter.ai/keys", url: "https://openrouter.ai/keys" },
};

const DEFAULT_APPEARANCE: BotAppearance = {
  primaryColor: "#2563EB",
  botName: "",
  welcomeMessage: "Hi there! 👋 How can I help you today?",
  fallbackMessage: "Sorry, I didn't understand that. Could you rephrase?",
  tone: "friendly",
  quickActions: ["What do you offer?", "How do I contact you?", "Book an appointment"],
  avatarText: "",
  businessType: "",
  phone: "",
  email: "",
  address: "",
};

type TabId = "general" | "ai" | "appearance" | "prompt" | "integration";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "general", label: "General", icon: "⚙️" },
  { id: "ai", label: "AI Provider", icon: "🤖" },
  { id: "appearance", label: "Appearance", icon: "🎨" },
  { id: "prompt", label: "System Prompt", icon: "📝" },
  { id: "integration", label: "Integration", icon: "🔗" },
];

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 mb-1.5">{children}</label>;
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white ${props.className ?? ""}`}
    />
  );
}

function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white resize-none ${props.className ?? ""}`}
    />
  );
}

export default function BotEditor() {
  const params = useParams<{ id: string }>();
  const isNew = params.id === "new";
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [bot, setBot] = useState<Partial<Bot>>({
    name: "",
    description: "",
    provider: "anthropic",
    model: "claude-haiku-3-5",
    apiKey: "",
    systemPrompt: "",
    appearance: { ...DEFAULT_APPEARANCE },
    isActive: true,
    leadWebhookUrl: "",
  });
  const [customModel, setCustomModel] = useState("");
  const [qaInput, setQaInput] = useState("");

  useEffect(() => {
    if (!isNew) {
      api.bots.get(params.id)
        .then((data) => {
          setBot(data);
          if (data.model && !MODELS[data.provider]?.find(m => m.value === data.model)) {
            setCustomModel(data.model);
          }
        })
        .catch(() => navigate("/"))
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  const update = useCallback((key: keyof Bot, value: unknown) => {
    setBot((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateAppearance = useCallback((key: keyof BotAppearance, value: unknown) => {
    setBot((prev) => ({
      ...prev,
      appearance: { ...(prev.appearance ?? DEFAULT_APPEARANCE), [key]: value },
    }));
  }, []);

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      const payload = { ...bot };
      if (payload.provider === "openrouter" && payload.model === "_custom") {
        payload.model = customModel;
      }
      if (isNew) {
        const created = await api.bots.create(payload);
        navigate(`/bots/${created.id}`);
      } else {
        const updated = await api.bots.update(params.id, payload);
        setBot(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const appearance = bot.appearance ?? DEFAULT_APPEARANCE;
  const models = MODELS[bot.provider ?? "anthropic"] ?? [];
  const hint = API_KEY_HINTS[bot.provider ?? "anthropic"];
  const apiKey = hint;

  function addQuickAction() {
    if (!qaInput.trim()) return;
    updateAppearance("quickActions", [...(appearance.quickActions ?? []), qaInput.trim()]);
    setQaInput("");
  }

  function removeQuickAction(i: number) {
    updateAppearance("quickActions", (appearance.quickActions ?? []).filter((_, idx) => idx !== i));
  }

  const embedCode = bot.publicId
    ? `<script src="${window.location.origin}/api/widget.js?botId=${bot.publicId}"></script>`
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Loading bot...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-60 bg-slate-900 flex flex-col z-20">
        <div className="p-5 border-b border-white/5">
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-lg">🤖</div>
            <span className="text-white font-bold text-lg">BotBuilder</span>
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <div className="text-xs text-slate-500 font-medium px-3 py-2 uppercase tracking-wider">Configuration</div>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                activeTab === t.id
                  ? "bg-blue-600/10 text-blue-400"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="text-base">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/5">
          <button onClick={() => navigate("/")} className="w-full flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg text-sm transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="ml-60">
        <header className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{isNew ? "Create New Bot" : bot.name || "Edit Bot"}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{TABS.find(t => t.id === activeTab)?.label}</p>
          </div>
          <div className="flex items-center gap-3">
            {error && <span className="text-red-500 text-sm">{error}</span>}
            {saved && <span className="text-green-600 text-sm font-medium">✓ Saved</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              {saving ? "Saving..." : isNew ? "Create Bot" : "Save Changes"}
            </button>
          </div>
        </header>

        <main className="p-8 max-w-2xl">
          {/* GENERAL TAB */}
          {activeTab === "general" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
                <h2 className="font-semibold text-gray-900">Bot Details</h2>
                <div>
                  <Label>Bot Name *</Label>
                  <Input
                    value={bot.name ?? ""}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="e.g. Smile Care Assistant"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={bot.description ?? ""}
                    onChange={(e) => update("description", e.target.value)}
                    placeholder="Short description for your reference"
                  />
                </div>
                <div className="flex items-center justify-between py-2 border-t border-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Active</p>
                    <p className="text-xs text-gray-400 mt-0.5">Bot will respond to visitors when active</p>
                  </div>
                  <button
                    onClick={() => update("isActive", !bot.isActive)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${bot.isActive ? "bg-green-500" : "bg-gray-200"}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${bot.isActive ? "left-6" : "left-1"}`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AI PROVIDER TAB */}
          {activeTab === "ai" && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
                <h2 className="font-semibold text-gray-900">AI Provider</h2>
                <div>
                  <Label>Provider</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {PROVIDERS.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => {
                          update("provider", p.value);
                          update("model", MODELS[p.value]?.[0]?.value ?? "");
                        }}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                          bot.provider === p.value
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <span className="text-xl">{p.icon}</span>
                        <span className="text-sm font-medium text-gray-800 leading-tight">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Model</Label>
                  <select
                    value={bot.model === customModel && bot.provider === "openrouter" ? "_custom" : (bot.model ?? "")}
                    onChange={(e) => {
                      if (e.target.value === "_custom") {
                        update("model", "_custom");
                      } else {
                        update("model", e.target.value);
                        setCustomModel("");
                      }
                    }}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {models.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  {bot.provider === "openrouter" && (bot.model === "_custom" || customModel) && (
                    <div className="mt-2">
                      <Input
                        value={customModel}
                        onChange={(e) => { setCustomModel(e.target.value); update("model", e.target.value); }}
                        placeholder="e.g. anthropic/claude-3-haiku"
                      />
                      <p className="text-xs text-gray-400 mt-1">Find model IDs at openrouter.ai/models</p>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label>API Key</Label>
                    {apiKey && (
                      <a href={apiKey.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
                        Get from {apiKey.label} ↗
                      </a>
                    )}
                  </div>
                  <Input
                    type="password"
                    value={bot.apiKey ?? ""}
                    onChange={(e) => update("apiKey", e.target.value)}
                    placeholder="sk-..."
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    Stored securely. Never exposed to the browser — all AI calls go through our server.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* APPEARANCE TAB */}
          {activeTab === "appearance" && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
                <h2 className="font-semibold text-gray-900">Branding</h2>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <Label>Bot Display Name</Label>
                    <Input
                      value={appearance.botName}
                      onChange={(e) => updateAppearance("botName", e.target.value)}
                      placeholder={bot.name ?? "Assistant"}
                    />
                  </div>
                  <div>
                    <Label>Avatar Text (1–2 chars)</Label>
                    <Input
                      value={appearance.avatarText}
                      onChange={(e) => updateAppearance("avatarText", e.target.value.slice(0, 2))}
                      placeholder="SC"
                      maxLength={2}
                    />
                  </div>
                </div>
                <div>
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={appearance.primaryColor}
                      onChange={(e) => updateAppearance("primaryColor", e.target.value)}
                      className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer"
                    />
                    <Input
                      value={appearance.primaryColor}
                      onChange={(e) => updateAppearance("primaryColor", e.target.value)}
                      className="flex-1"
                      placeholder="#2563EB"
                    />
                    <div className="w-10 h-10 rounded-lg border border-gray-200 flex-shrink-0" style={{ backgroundColor: appearance.primaryColor }} />
                  </div>
                  <div className="flex gap-2 mt-2">
                    {["#2563EB","#7C3AED","#059669","#DC2626","#D97706","#0891B2","#1E293B"].map(c => (
                      <button key={c} onClick={() => updateAppearance("primaryColor", c)} className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
                <h2 className="font-semibold text-gray-900">Messaging</h2>
                <div>
                  <Label>Welcome Message</Label>
                  <Textarea
                    value={appearance.welcomeMessage}
                    onChange={(e) => updateAppearance("welcomeMessage", e.target.value)}
                    rows={2}
                    placeholder="Hi there! How can I help you today?"
                  />
                </div>
                <div>
                  <Label>Fallback Message</Label>
                  <Textarea
                    value={appearance.fallbackMessage}
                    onChange={(e) => updateAppearance("fallbackMessage", e.target.value)}
                    rows={2}
                    placeholder="Sorry, I didn't understand. Could you rephrase?"
                  />
                </div>
                <div>
                  <Label>Tone / Personality</Label>
                  <div className="flex flex-wrap gap-2">
                    {["friendly", "professional", "casual", "formal", "concise", "enthusiastic"].map((t) => (
                      <button
                        key={t}
                        onClick={() => updateAppearance("tone", t)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors capitalize ${
                          appearance.tone === t
                            ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Quick Action Buttons</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(appearance.quickActions ?? []).map((qa, i) => (
                      <span key={i} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full">
                        {qa}
                        <button onClick={() => removeQuickAction(i)} className="text-blue-400 hover:text-blue-700 text-sm leading-none">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={qaInput}
                      onChange={(e) => setQaInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addQuickAction())}
                      placeholder="Add a quick action..."
                    />
                    <button onClick={addQuickAction} className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors flex-shrink-0">
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
                <h2 className="font-semibold text-gray-900">Business Info</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Business Type</Label>
                    <Input value={appearance.businessType} onChange={(e) => updateAppearance("businessType", e.target.value)} placeholder="e.g. Dental Clinic" />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={appearance.phone} onChange={(e) => updateAppearance("phone", e.target.value)} placeholder="(555) 123-4567" />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input value={appearance.email} onChange={(e) => updateAppearance("email", e.target.value)} placeholder="hello@business.com" />
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Input value={appearance.address} onChange={(e) => updateAppearance("address", e.target.value)} placeholder="123 Main St" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SYSTEM PROMPT TAB */}
          {activeTab === "prompt" && (
            <div className="space-y-5">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-800">
                <strong>Tip:</strong> Tell the AI who it is, what it knows, how it should respond, and what it should never say. Be specific — the better the prompt, the better the bot.
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h2 className="font-semibold text-gray-900 mb-4">System Prompt</h2>
                <Textarea
                  value={bot.systemPrompt ?? ""}
                  onChange={(e) => update("systemPrompt", e.target.value)}
                  rows={18}
                  placeholder={`You are a helpful AI assistant for [Business Name], a [type of business].\n\nYou help customers by:\n- Answering questions about services and pricing\n- Booking appointments\n- Providing business hours and contact info\n\nAlways be ${appearance.tone} and professional. Never make up information.`}
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-400">{bot.systemPrompt?.length ?? 0} characters</p>
                  <button
                    onClick={() => {
                      const starter = `You are a helpful AI assistant for ${bot.name ?? "this business"}, a ${appearance.businessType || "local business"}.\n\nYou help customers by:\n- Answering questions about services, pricing, and hours\n- Collecting appointment bookings (name, phone, preferred time)\n- Providing contact information when needed\n\nBusiness details:\n${appearance.phone ? `- Phone: ${appearance.phone}\n` : ""}${appearance.email ? `- Email: ${appearance.email}\n` : ""}${appearance.address ? `- Address: ${appearance.address}\n` : ""}\nTone: Be ${appearance.tone}, clear, and concise. Keep responses to 2-3 sentences unless listing items.\n\nNever make up information. If you don't know something, ask the customer to call or email directly.`;
                      update("systemPrompt", starter);
                    }}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    Generate starter prompt ↗
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* INTEGRATION TAB */}
          {activeTab === "integration" && (
            <div className="space-y-5">
              {isNew ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-800 text-sm">
                  Save the bot first to generate your embed code.
                </div>
              ) : (
                <>
                  <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h2 className="font-semibold text-gray-900 mb-2">Embed Code</h2>
                    <p className="text-sm text-gray-500 mb-4">
                      Paste this single line before the <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code> tag of any website to add your chatbot.
                    </p>
                    <div className="bg-slate-950 rounded-xl p-4 font-mono text-sm text-green-400 break-all relative">
                      {embedCode}
                      <button
                        onClick={() => { if (embedCode) navigator.clipboard.writeText(embedCode); }}
                        className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">
                      Bot Public ID: <code className="bg-gray-100 px-1 rounded text-gray-600">{bot.publicId}</code>
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h2 className="font-semibold text-gray-900 mb-4">Lead Webhook</h2>
                    <p className="text-sm text-gray-500 mb-3">
                      When someone submits a booking request, we'll POST their details here (optional).
                    </p>
                    <Input
                      value={bot.leadWebhookUrl ?? ""}
                      onChange={(e) => update("leadWebhookUrl", e.target.value)}
                      placeholder="https://hooks.zapier.com/..."
                      type="url"
                    />
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-6">
                    <h2 className="font-semibold text-gray-900 mb-3">Test Your Bot</h2>
                    <p className="text-sm text-gray-500 mb-4">Preview how your bot will look on a client's website.</p>
                    <a
                      href={`/preview?botId=${bot.publicId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      Open Live Preview
                    </a>
                  </div>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

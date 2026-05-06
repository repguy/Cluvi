import { useState, useEffect } from "react";
import {
  Shield, Zap, LayoutTemplate, Lock, Plus, Trash2, X, Check,
  Loader2, Save, Globe, AlertTriangle, Eye, EyeOff, ChevronDown, ChevronUp,
} from "lucide-react";
import { api, AdminSettings, CustomTemplate } from "../lib/api";
import Layout from "../components/Layout";

type TabId = "security" | "ratelimit" | "templates" | "account";

const TABS: { id: TabId; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: "security", icon: Shield, label: "Security" },
  { id: "ratelimit", icon: Zap, label: "Rate Limiting" },
  { id: "templates", icon: LayoutTemplate, label: "Templates" },
  { id: "account", icon: Lock, label: "Account" },
];

const ICONS = ["🤖", "💼", "🏥", "⚖️", "🍽️", "🦷", "🏠", "💇", "💪", "🛍️", "📚", "🎓", "🏋️", "✈️", "🎉", "💰", "🔧", "🌿"];
const PROVIDERS = ["anthropic", "openai", "gemini", "openrouter"];
const FREE_MODELS = ["meta-llama/llama-3.3-70b-instruct:free", "meta-llama/llama-3.1-8b-instruct:free", "deepseek/deepseek-r1:free"];

function Section({ title, helper, children }: { title: string; helper?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
      <div className="pb-1 border-b border-slate-100">
        <h2 className="text-[13px] font-semibold text-slate-900">{title}</h2>
        {helper && <p className="text-xs text-slate-400 mt-0.5">{helper}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
      {helper && <p className="text-xs text-slate-400 mt-1.5">{helper}</p>}
    </div>
  );
}

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex w-9 h-5 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${enabled ? "bg-indigo-500" : "bg-slate-200"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${enabled ? "translate-x-4" : "translate-x-0"}`} />
    </button>
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

function SaveBar({ saving, saved, onSave }: { saving: boolean; saved: boolean; onSave: () => void }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        {saving ? "Saving…" : "Save Changes"}
      </button>
      {saved && (
        <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
          <Check className="w-3 h-3" /> Saved
        </span>
      )}
    </div>
  );
}

// ── Template create/edit form ─────────────────────────────────────────────
function TemplateForm({ onSave, onCancel }: { onSave: (t: Partial<CustomTemplate>) => Promise<void>; onCancel: () => void }) {
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [qaInput, setQaInput] = useState("");
  const [svcInput, setSvcInput] = useState("");
  const [form, setForm] = useState<Partial<CustomTemplate>>({
    name: "", icon: "🤖", description: "", provider: "openrouter",
    model: "meta-llama/llama-3.3-70b-instruct:free", systemPrompt: "",
    quickActions: [], services: [], businessType: "", welcomeMessage: "Hi! How can I help you today?",
  });

  function set(k: keyof CustomTemplate, v: unknown) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    if (!form.name?.trim()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">New Template</h3>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Template Name *">
          <Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Yoga Studio" autoFocus />
        </Field>
        <Field label="Icon">
          <div className="flex items-center gap-2">
            <Input value={form.icon ?? "🤖"} onChange={(e) => set("icon", e.target.value)} className="w-16 text-center text-lg" maxLength={2} />
            <div className="flex flex-wrap gap-1 flex-1">
              {ICONS.map((ic) => (
                <button key={ic} onClick={() => set("icon", ic)} className={`text-lg p-0.5 rounded transition-transform hover:scale-125 ${form.icon === ic ? "scale-125" : ""}`}>{ic}</button>
              ))}
            </div>
          </div>
        </Field>
      </div>

      <Field label="Description" helper="Shown in the templates picker.">
        <Input value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="What does this template do?" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Business Type">
          <Input value={form.businessType ?? ""} onChange={(e) => set("businessType", e.target.value)} placeholder="e.g. Yoga Studio" />
        </Field>
        <Field label="Welcome Message">
          <Input value={form.welcomeMessage ?? ""} onChange={(e) => set("welcomeMessage", e.target.value)} placeholder="Hi! How can I help?" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="AI Provider">
          <select value={form.provider ?? "openrouter"} onChange={(e) => set("provider", e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400">
            {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Model">
          <Input value={form.model ?? ""} onChange={(e) => set("model", e.target.value)} placeholder="e.g. meta-llama/llama-3.3-70b-instruct:free" />
          <p className="text-xs text-slate-400 mt-1">Free models: {FREE_MODELS[0].split("/")[1]}, etc.</p>
        </Field>
      </div>

      <button
        onClick={() => setShowAdvanced((s) => !s)}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-medium transition-colors"
      >
        {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {showAdvanced ? "Hide" : "Show"} system prompt & quick actions
      </button>

      {showAdvanced && (
        <>
          <Field label="System Prompt">
            <Textarea value={form.systemPrompt ?? ""} onChange={(e) => set("systemPrompt", e.target.value)} rows={6} placeholder="You are a helpful assistant for [Business Name]..." />
          </Field>

          <Field label="Quick Actions" helper="Shortcut buttons shown when chat opens.">
            <div className="flex flex-wrap gap-2 mb-2 min-h-[24px]">
              {(form.quickActions ?? []).map((qa, i) => (
                <span key={i} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-lg">
                  {qa}
                  <button onClick={() => set("quickActions", (form.quickActions ?? []).filter((_, j) => j !== i))} className="text-slate-400 hover:text-slate-700"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={qaInput} onChange={(e) => setQaInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (qaInput.trim()) { set("quickActions", [...(form.quickActions ?? []), qaInput.trim()]); setQaInput(""); } } }} placeholder="Add quick action, press Enter" />
              <button onClick={() => { if (qaInput.trim()) { set("quickActions", [...(form.quickActions ?? []), qaInput.trim()]); setQaInput(""); } }} className="px-3 py-2 bg-slate-900 text-white rounded-lg"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          </Field>

          <Field label="Services">
            <div className="flex flex-wrap gap-2 mb-2 min-h-[24px]">
              {(form.services ?? []).map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-lg">
                  {s}
                  <button onClick={() => set("services", (form.services ?? []).filter((_, j) => j !== i))} className="text-slate-400 hover:text-slate-700"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={svcInput} onChange={(e) => setSvcInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (svcInput.trim()) { set("services", [...(form.services ?? []), svcInput.trim()]); setSvcInput(""); } } }} placeholder="Add service, press Enter" />
              <button onClick={() => { if (svcInput.trim()) { set("services", [...(form.services ?? []), svcInput.trim()]); setSvcInput(""); } }} className="px-3 py-2 bg-slate-900 text-white rounded-lg"><Plus className="w-3.5 h-3.5" /></button>
            </div>
          </Field>
        </>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} disabled={saving || !form.name?.trim()} className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Save Template
        </button>
        <button onClick={onCancel} className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
      </div>
    </div>
  );
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabId>("security");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [templates, setTemplates] = useState<CustomTemplate[]>([]);
  const [showNewTemplate, setShowNewTemplate] = useState(false);

  // Security & rate limit state
  const [dwEnabled, setDwEnabled] = useState(false);
  const [rlEnabled, setRlEnabled] = useState(true);
  const [rlChat, setRlChat] = useState(30);
  const [rlBooking, setRlBooking] = useState(10);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Account state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState("");

  useEffect(() => {
    Promise.all([api.admin.getSettings(), api.admin.getTemplates()])
      .then(([s, t]) => {
        if (s) {
          setSettings(s);
          setDwEnabled(s.domainWhitelistEnabled);
          setRlEnabled(s.rateLimitEnabled);
          setRlChat(s.rateLimitChat);
          setRlBooking(s.rateLimitBooking);
          setTemplates(s.customTemplates);
        }
        if (t) setTemplates(t);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function saveSettings() {
    setSaving(true);
    try {
      const updated = await api.admin.updateSettings({ domainWhitelistEnabled: dwEnabled, rateLimitEnabled: rlEnabled, rateLimitChat: rlChat, rateLimitBooking: rlBooking });
      if (updated) setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  }

  async function handleCreateTemplate(data: Partial<CustomTemplate>) {
    const created = await api.admin.createTemplate(data);
    if (created) { setTemplates((prev) => [...prev, created]); setShowNewTemplate(false); }
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    await api.admin.deleteTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  async function handlePasswordChange() {
    setPwError("");
    if (!currentPw || !newPw || !confirmPw) { setPwError("All fields are required"); return; }
    if (newPw.length < 8) { setPwError("New password must be at least 8 characters"); return; }
    if (newPw !== confirmPw) { setPwError("Passwords do not match"); return; }
    setPwSaving(true);
    try {
      await api.admin.changePassword({ currentPassword: currentPw, newPassword: newPw });
      setPwSaved(true);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => setPwSaved(false), 3000);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Failed to change password");
    } finally { setPwSaving(false); }
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
      <header className="bg-white border-b border-slate-200 px-6 h-[60px] flex items-center flex-shrink-0">
        <h1 className="text-[15px] font-semibold text-slate-900">Admin Settings</h1>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar tabs */}
        <aside className="w-[180px] flex-shrink-0 bg-white border-r border-slate-200 py-4 px-2">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium mb-0.5 transition-all ${activeTab === id ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </aside>

        <main className="flex-1 overflow-y-auto p-8 bg-slate-50">
          <div className="max-w-xl space-y-5">

            {/* ── SECURITY ── */}
            {activeTab === "security" && (
              <>
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                  <div>Domain whitelisting is a <strong>global toggle</strong>. When enabled, each bot's individual allowed-domain list is enforced. When disabled, all bots accept requests from any domain.</div>
                </div>

                <Section title="Domain Whitelist" helper="Controls whether individual bot domain lists are enforced globally.">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Enable Domain Whitelisting</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {dwEnabled ? "✓ Active — bots only respond on their allowed domains" : "○ Disabled — bots respond on all domains"}
                      </p>
                    </div>
                    <Toggle enabled={dwEnabled} onChange={setDwEnabled} />
                  </div>
                  {dwEnabled && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3.5 py-3 text-xs text-indigo-700">
                      <p className="font-semibold mb-1">How to configure per-bot domains:</p>
                      <p>Open a bot → Editor → Security tab → Add allowed domains</p>
                    </div>
                  )}
                </Section>

                <Section title="Built-in Protections" helper="Always-on security measures that cannot be disabled.">
                  {[
                    { label: "Auth rate limiting", value: "10 attempts / 15 min per IP" },
                    { label: "Password hashing", value: "bcrypt (cost 12)" },
                    { label: "Session cookies", value: "httpOnly, SameSite" },
                    { label: "HTTP security headers", value: "Helmet.js" },
                    { label: "Input size limit", value: "1 MB per request" },
                    { label: "Timing-safe login", value: "Constant-time comparison" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <p className="text-sm text-slate-700">{label}</p>
                      <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full font-medium">{value}</span>
                    </div>
                  ))}
                </Section>

                <SaveBar saving={saving} saved={saved} onSave={saveSettings} />
              </>
            )}

            {/* ── RATE LIMITING ── */}
            {activeTab === "ratelimit" && (
              <>
                <Section title="Rate Limiting" helper="Protect your widget endpoints from abuse. Limits apply per IP address.">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Enable Rate Limiting</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {rlEnabled ? "Active — widget endpoints are protected" : "Disabled — no per-IP limits (not recommended)"}
                      </p>
                    </div>
                    <Toggle enabled={rlEnabled} onChange={setRlEnabled} />
                  </div>

                  <div className={`space-y-4 transition-opacity ${rlEnabled ? "" : "opacity-40 pointer-events-none"}`}>
                    <Field label="Chat limit (requests / minute / IP)" helper="Recommended: 20–60. Lower = stricter, higher = more permissive.">
                      <div className="flex items-center gap-3">
                        <input
                          type="range" min={1} max={300} value={rlChat}
                          onChange={(e) => setRlChat(Number(e.target.value))}
                          className="flex-1 accent-indigo-500"
                        />
                        <div className="w-16 text-center bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-mono font-semibold text-slate-900">
                          {rlChat}
                        </div>
                      </div>
                    </Field>

                    <Field label="Booking limit (requests / minute / IP)" helper="Recommended: 5–15. Booking submissions should be rare.">
                      <div className="flex items-center gap-3">
                        <input
                          type="range" min={1} max={100} value={rlBooking}
                          onChange={(e) => setRlBooking(Number(e.target.value))}
                          className="flex-1 accent-indigo-500"
                        />
                        <div className="w-16 text-center bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-mono font-semibold text-slate-900">
                          {rlBooking}
                        </div>
                      </div>
                    </Field>
                  </div>
                </Section>

                <Section title="Preview" helper="What happens when the limit is exceeded.">
                  <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-700">
                    <p className="font-semibold mb-1">HTTP 429 — Too Many Requests</p>
                    <p className="text-xs font-mono">{"{ \"message\": \"Too many messages. Please slow down.\" }"}</p>
                  </div>
                </Section>

                <SaveBar saving={saving} saved={saved} onSave={saveSettings} />
              </>
            )}

            {/* ── TEMPLATES ── */}
            {activeTab === "templates" && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Custom Templates</p>
                    <p className="text-xs text-slate-400 mt-0.5">{templates.length} template{templates.length !== 1 ? "s" : ""} · appear alongside built-in templates in the Dashboard</p>
                  </div>
                  {!showNewTemplate && (
                    <button
                      onClick={() => setShowNewTemplate(true)}
                      className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> New Template
                    </button>
                  )}
                </div>

                {showNewTemplate && (
                  <TemplateForm
                    onSave={handleCreateTemplate}
                    onCancel={() => setShowNewTemplate(false)}
                  />
                )}

                {templates.length === 0 && !showNewTemplate ? (
                  <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center">
                    <LayoutTemplate className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-slate-500 font-medium text-sm">No custom templates yet</p>
                    <p className="text-slate-400 text-xs mt-1">Create templates to speed up bot creation for common business types.</p>
                    <button
                      onClick={() => setShowNewTemplate(true)}
                      className="mt-4 flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors mx-auto"
                    >
                      <Plus className="w-3.5 h-3.5" /> Create First Template
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates.map((t) => (
                      <div key={t.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
                        <span className="text-2xl flex-shrink-0">{t.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-900">{t.name}</p>
                          <p className="text-xs text-slate-400 truncate">{t.description || t.businessType || t.provider}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{t.provider}</span>
                          <button
                            onClick={() => handleDeleteTemplate(t.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── ACCOUNT ── */}
            {activeTab === "account" && (
              <>
                <Section title="Change Password" helper="Must be at least 8 characters.">
                  <Field label="Current Password">
                    <div className="relative">
                      <Input
                        type={showCurrentPw ? "text" : "password"}
                        value={currentPw}
                        onChange={(e) => setCurrentPw(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="pr-10"
                      />
                      <button type="button" onClick={() => setShowCurrentPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>
                  <Field label="New Password">
                    <div className="relative">
                      <Input
                        type={showNewPw ? "text" : "password"}
                        value={newPw}
                        onChange={(e) => setNewPw(e.target.value)}
                        placeholder="Min. 8 characters"
                        autoComplete="new-password"
                        className="pr-10"
                      />
                      <button type="button" onClick={() => setShowNewPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {newPw && (
                      <div className="mt-1.5 flex gap-1">
                        {[...Array(4)].map((_, i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full ${newPw.length > i * 3 ? (newPw.length >= 12 ? "bg-emerald-400" : newPw.length >= 8 ? "bg-yellow-400" : "bg-red-400") : "bg-slate-200"}`} />
                        ))}
                        <span className="text-xs text-slate-400 ml-1">{newPw.length >= 12 ? "Strong" : newPw.length >= 8 ? "OK" : "Weak"}</span>
                      </div>
                    )}
                  </Field>
                  <Field label="Confirm New Password">
                    <Input
                      type="password"
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      onKeyDown={(e) => e.key === "Enter" && handlePasswordChange()}
                    />
                  </Field>
                  {pwError && (
                    <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      {pwError}
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={handlePasswordChange}
                      disabled={pwSaving}
                      className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      {pwSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                      {pwSaving ? "Saving…" : "Update Password"}
                    </button>
                    {pwSaved && (
                      <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                        <Check className="w-3 h-3" /> Password updated
                      </span>
                    )}
                  </div>
                </Section>

                <Section title="Security Tips">
                  {[
                    "Use a strong, unique password not used elsewhere",
                    "Never share your login credentials with clients",
                    "Keep your API keys private — they're stored securely server-side",
                    "Bot widget public IDs are safe to share — they don't expose your account",
                    "Enable domain whitelisting to prevent unauthorised widget usage",
                  ].map((tip, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Shield className="w-3 h-3 text-indigo-500" />
                      </div>
                      <p className="text-sm text-slate-700">{tip}</p>
                    </div>
                  ))}
                </Section>
              </>
            )}
          </div>
        </main>
      </div>
    </Layout>
  );
}

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Bot, Plus, Trash2, Code2, Pencil, Eye, ToggleLeft, ToggleRight, MessageSquare, Zap, Globe, Copy, Check, X, Loader2, LayoutTemplate, CalendarCheck, ChevronRight, CheckCircle2, Circle } from "lucide-react";
import { api, Bot as BotType, CustomTemplate } from "../lib/api";

import Layout from "../components/Layout";

interface BotMiniStats { conversations: number; bookings: number; lastActive: string | null; }
type MiniStatsMap = Record<string, BotMiniStats>;

const PROVIDER_META: Record<string, { label: string; color: string; bg: string }> = {
  anthropic: { label: "Claude", color: "text-orange-600", bg: "bg-orange-50 border-orange-100" },
  openai: { label: "OpenAI", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
  gemini: { label: "Gemini", color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
  openrouter: { label: "OpenRouter", color: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
};

interface BotTemplate {
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
}

const TEMPLATES: BotTemplate[] = [
  {
    id: "dental",
    name: "Dental Clinic",
    icon: "🦷",
    description: "Books cleanings, exams, and emergency visits. Answers FAQs about insurance and procedures.",
    provider: "openrouter",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    businessType: "Dental Clinic",
    welcomeMessage: "Hi! Welcome to our dental clinic. How can I help you today?",
    quickActions: ["Book Appointment", "Our Services", "Hours & Location", "Insurance Info"],
    services: ["Cleaning", "Check-up", "Whitening", "Fillings", "Root Canal", "Emergency Visit"],
    systemPrompt: `You are a friendly AI assistant for [Dental Clinic Name], a professional dental practice.

You help patients by:
- Answering questions about dental services and pricing
- Collecting appointment bookings (ask for name, phone, preferred date/time, and service needed)
- Providing information about insurance and payment options
- Sharing office hours and location details

Always be warm, reassuring, and professional. Many patients are anxious about dental visits — acknowledge this and be empathetic.

Never diagnose dental conditions. For urgent pain or emergencies, advise them to call the office directly or visit an emergency dental clinic.

Services offered: Cleaning, Check-up, Whitening, Fillings, Root Canal, Emergency Visit.

Keep responses concise — 2-3 sentences max unless listing services or answering multi-part questions.`,
  },
  {
    id: "restaurant",
    name: "Restaurant",
    icon: "🍽️",
    description: "Handles reservations, menu questions, hours, and special dietary requests.",
    provider: "openrouter",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    businessType: "Restaurant",
    welcomeMessage: "Welcome! Ready to make a reservation or have a question about our menu?",
    quickActions: ["Make Reservation", "View Menu", "Hours & Location", "Dietary Options"],
    services: ["Dinner Reservation", "Lunch Reservation", "Private Event", "Takeout Order"],
    systemPrompt: `You are a warm and welcoming AI assistant for [Restaurant Name].

You help guests by:
- Taking reservations (ask for name, phone, party size, preferred date and time)
- Answering questions about the menu, including dietary options (vegan, gluten-free, allergies)
- Sharing hours, location, and parking information
- Handling special occasion requests (birthdays, anniversaries)

Be enthusiastic about the food and create excitement about the dining experience. Always mention that the team looks forward to hosting them.

For large parties (10+) or private events, ask them to call directly.

Keep responses friendly and concise.`,
  },
  {
    id: "lawfirm",
    name: "Law Firm",
    icon: "⚖️",
    description: "Collects consultation requests, answers FAQs about practice areas and process.",
    provider: "openrouter",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    businessType: "Law Firm",
    welcomeMessage: "Hello! I'm here to help answer questions and schedule a consultation with our team.",
    quickActions: ["Schedule Consultation", "Practice Areas", "About Our Firm", "How It Works"],
    services: ["Free Consultation", "Family Law", "Personal Injury", "Business Law", "Estate Planning"],
    systemPrompt: `You are a professional AI assistant for [Law Firm Name].

You help prospective clients by:
- Scheduling initial consultations (collect name, phone, case type, brief description)
- Explaining practice areas in plain English
- Answering general questions about the legal process
- Setting expectations about next steps

Important: You are NOT providing legal advice. Always clarify that only a licensed attorney can advise on their specific situation.

Be professional, empathetic, and clear. Many people contacting a law firm are stressed — acknowledge their situation and reassure them that the team is here to help.

Never discuss case outcomes, fees without attorney approval, or give specific legal guidance.`,
  },
  {
    id: "realestate",
    name: "Real Estate Agency",
    icon: "🏠",
    description: "Captures buyer and seller leads, answers property questions, books viewings.",
    provider: "openrouter",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    businessType: "Real Estate Agency",
    welcomeMessage: "Hi! Looking to buy, sell, or just explore the market? I'm here to help!",
    quickActions: ["Schedule Viewing", "Sell My Home", "Market Update", "Talk to an Agent"],
    services: ["Property Viewing", "Free Home Valuation", "Buyer Consultation", "Seller Consultation"],
    systemPrompt: `You are an enthusiastic AI assistant for [Real Estate Agency Name].

You help clients by:
- Booking property viewings (collect name, phone, property of interest, preferred date/time)
- Collecting seller leads for home valuations
- Answering questions about neighborhoods, market trends, and the buying/selling process
- Connecting serious buyers and sellers with an agent

Be energetic and knowledgeable. Help clients feel excited about their real estate journey.

Do not quote specific prices or guarantee sale values. For specific pricing questions, recommend speaking with one of the agents.`,
  },
  {
    id: "salon",
    name: "Hair Salon / Spa",
    icon: "💇",
    description: "Books appointments, answers service questions, handles cancellations.",
    provider: "openrouter",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    businessType: "Hair Salon",
    welcomeMessage: "Hey! Ready to book an appointment or have a question about our services?",
    quickActions: ["Book Appointment", "Our Services", "Pricing", "Hours & Location"],
    services: ["Haircut", "Color", "Highlights", "Blowout", "Treatment", "Manicure", "Pedicure"],
    systemPrompt: `You are a friendly AI assistant for [Salon/Spa Name].

You help clients by:
- Booking appointments (collect name, phone, service requested, preferred date/time, and stylist preference if any)
- Describing services and rough pricing ranges
- Answering questions about products used
- Handling cancellation or rescheduling requests (direct to call/text for same-day changes)

Be upbeat, warm, and make clients feel excited about their upcoming visit. Use casual, friendly language.

Always confirm that the team will reach out to confirm the appointment time.`,
  },
  {
    id: "medical",
    name: "Medical Practice",
    icon: "🏥",
    description: "Books patient appointments, handles new patient intake, answers FAQs.",
    provider: "openrouter",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    businessType: "Medical Practice",
    welcomeMessage: "Hello! I'm here to help schedule an appointment or answer general questions.",
    quickActions: ["Book Appointment", "New Patient Info", "Hours & Location", "Insurance Accepted"],
    services: ["New Patient Visit", "Annual Check-up", "Follow-up", "Sick Visit", "Telehealth"],
    systemPrompt: `You are a professional and caring AI assistant for [Practice Name].

You help patients by:
- Scheduling appointments (collect name, phone, date of birth, reason for visit, insurance provider)
- Answering questions about accepted insurance, office policies, and new patient procedures
- Providing directions and parking information
- Clarifying what to bring to the first appointment

Important: You are NOT providing medical advice. For urgent symptoms or emergencies, always direct patients to call 911 or visit the nearest ER.

Be compassionate, clear, and reassuring. Healthcare can be stressful — make patients feel supported.`,
  },
  {
    id: "gym",
    name: "Gym / Fitness Studio",
    icon: "💪",
    description: "Books classes and trials, answers membership questions, promotes offers.",
    provider: "openrouter",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    businessType: "Gym & Fitness Studio",
    welcomeMessage: "Hey! Ready to crush your fitness goals? Let's get you started 💪",
    quickActions: ["Book Free Trial", "View Classes", "Membership Info", "Personal Training"],
    services: ["Free Trial Class", "Yoga", "HIIT", "Personal Training", "Pilates", "Spin"],
    systemPrompt: `You are an energetic AI assistant for [Gym/Studio Name].

You help members and prospects by:
- Booking free trial classes or intro sessions (collect name, phone, class interest, preferred time)
- Explaining membership options and pricing
- Sharing the class schedule and instructor info
- Answering questions about facilities, equipment, and amenities
- Promoting current offers and challenges

Be motivating, positive, and high-energy. Use encouraging language. Make prospective members feel like joining is the best decision they'll ever make.`,
  },
  {
    id: "ecommerce",
    name: "E-commerce Store",
    icon: "🛍️",
    description: "Handles order questions, returns, product info, and shipping inquiries.",
    provider: "openrouter",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    businessType: "Online Store",
    welcomeMessage: "Hi there! Need help with an order or looking for product recommendations?",
    quickActions: ["Track My Order", "Returns & Refunds", "Product Help", "Contact Support"],
    services: ["Order Tracking", "Return Request", "Product Inquiry", "Shipping Info"],
    systemPrompt: `You are a helpful AI assistant for [Store Name], an online retail store.

You help customers by:
- Answering questions about products (features, sizing, availability)
- Explaining shipping timelines and costs
- Guiding customers through the returns/refunds process
- Escalating complex order issues to a human agent

Be friendly, efficient, and solution-focused. Customers want quick answers — keep responses concise.

For specific order details (order number, tracking), let them know you'll connect them with the support team who can look up their account.`,
  },
];

function TemplatesModal({ onClose, onSelect }: { onClose: () => void; onSelect: (t: BotTemplate) => void }) {
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);

  useEffect(() => {
    api.admin.getTemplates()
      .then((data) => setCustomTemplates(data ?? []))
      .catch(() => {});
  }, []);

  const allTemplates: BotTemplate[] = [
    ...TEMPLATES,
    ...customTemplates.map((ct) => ({
      id: ct.id,
      name: ct.name,
      icon: ct.icon || "🤖",
      description: ct.description,
      provider: ct.provider,
      model: ct.model,
      systemPrompt: ct.systemPrompt,
      quickActions: ct.quickActions,
      services: ct.services,
      businessType: ct.businessType,
      welcomeMessage: ct.welcomeMessage,
    })),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Start from a Template</h2>
            <p className="text-xs text-slate-400 mt-0.5">Pre-built prompts and settings for common business types</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {allTemplates.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className="text-left flex items-start gap-3 p-4 rounded-xl border border-slate-200 hover:border-[#6C63FF]/40 hover:bg-[#6C63FF]/5 transition-all group"
            >
              <span className="text-2xl flex-shrink-0 mt-0.5">{t.icon}</span>
              <div>
                <p className="font-semibold text-slate-900 text-sm group-hover:text-[#6C63FF] transition-colors">{t.name}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{t.description}</p>
              </div>
            </button>
          ))}
        </div>
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Or start from scratch →
          </button>
        </div>
      </div>
    </div>
  );
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "No chats yet";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function BotCard({
  bot,
  miniStats,
  onDelete,
  onToggle,
  onDuplicate,
}: {
  bot: BotType;
  miniStats?: BotMiniStats;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
  onDuplicate: (id: string) => void;
}) {
  const [, navigate] = useLocation();
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);
  const provider = PROVIDER_META[bot.provider] ?? { label: bot.provider, color: "text-slate-600", bg: "bg-slate-50 border-slate-100" };
  const color = bot.appearance?.primaryColor ?? "#6C63FF";
  const initials = (bot.appearance?.avatarText || bot.appearance?.botName || bot.name)[0]?.toUpperCase() ?? "B";

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${bot.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try { await api.bots.delete(bot.id); onDelete(bot.id); }
    finally { setDeleting(false); }
  }

  async function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    setToggling(true);
    try { await api.bots.update(bot.id, { isActive: !bot.isActive }); onToggle(bot.id, !bot.isActive); }
    finally { setToggling(false); }
  }

  function copyEmbed(e: React.MouseEvent) {
    e.stopPropagation();
    if (!bot.publicId) return;
    const code = `<script src="${window.location.origin}/api/widget.js?botId=${bot.publicId}"></script>`;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      onClick={() => navigate(`/bots/${bot.id}`)}
      className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md shadow-sm transition-all duration-150 cursor-pointer group overflow-hidden"
    >
      <div className="h-1" style={{ backgroundColor: color }} />
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm"
            style={{ backgroundColor: color }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 text-sm truncate leading-tight">{bot.name}</h3>
            {bot.description ? (
              <p className="text-xs text-slate-400 truncate mt-0.5">{bot.description}</p>
            ) : (
              <p className="text-xs text-slate-300 mt-0.5 italic">No description</p>
            )}
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
            title={bot.isActive ? "Deactivate" : "Activate"}
          >
            {bot.isActive
              ? <ToggleRight className="w-6 h-6 text-emerald-500" />
              : <ToggleLeft className="w-6 h-6" />}
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md border ${provider.bg} ${provider.color}`}>
            {provider.label}
          </span>
          <span className="inline-flex items-center text-xs text-slate-400 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-md truncate max-w-[130px]" title={bot.model}>
            {bot.model.split("/").pop()?.split(":")[0]}
          </span>
          <span className={`ml-auto text-xs font-medium ${bot.isActive ? "text-emerald-600" : "text-slate-400"}`}>
            {bot.isActive ? "● Live" : "○ Off"}
          </span>
        </div>

        <div className="flex items-center gap-3 py-2.5 px-3 bg-slate-50 rounded-lg mb-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3 text-[#6C63FF]" />
            {miniStats?.conversations ?? 0} chats
          </span>
          <span className="text-slate-200">|</span>
          <span className="flex items-center gap-1">
            <CalendarCheck className="w-3 h-3 text-[#4ECDC4]" />
            {miniStats?.bookings ?? 0} bookings
          </span>
          <span className="text-slate-200 ml-auto">|</span>
          <span className="text-slate-400 text-[11px]">{timeAgo(miniStats?.lastActive ?? null)}</span>
        </div>

        <div className="flex gap-2 pt-1 border-t border-slate-100">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/bots/${bot.id}`); }}
            className="flex items-center gap-1.5 flex-1 justify-center text-xs font-medium py-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); window.open(`/preview?botId=${bot.publicId}`, "_blank"); }}
            className="flex items-center gap-1.5 flex-1 justify-center text-xs font-medium py-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <Eye className="w-3 h-3" /> Preview
          </button>
          <button
            onClick={copyEmbed}
            className="flex items-center gap-1.5 flex-1 justify-center text-xs font-medium py-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
            title="Copy embed code"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Code2 className="w-3 h-3" />}
            {copied ? "Copied!" : "Embed"}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center justify-center w-7 py-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
            aria-label="Delete bot"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

const ONBOARDING_STEPS = [
  { label: "Create your first bot", href: "/bots/new", icon: "🤖" },
  { label: "Customize appearance", href: "/bots/new?tab=appearance", icon: "🎨" },
  { label: "Set up notifications", href: "/bots/new?tab=notifications", icon: "🔔" },
  { label: "Add to your website", href: "/bots/new?tab=integration", icon: "🌐" },
  { label: "Test your bot", href: "/preview", icon: "🧪" },
];

function OnboardingChecklist() {
  const [, navigate] = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-gradient-to-br from-[#6C63FF]/5 to-[#4ECDC4]/5 border border-[#6C63FF]/20 rounded-2xl p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">⚡ Getting Started with Cluvi</h2>
          <p className="text-xs text-slate-500 mt-0.5">Complete these steps to set up your first AI chat assistant</p>
        </div>
        <button onClick={() => setDismissed(true)} className="text-slate-400 hover:text-slate-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-2">
        {ONBOARDING_STEPS.map((step, i) => (
          <button
            key={i}
            onClick={() => navigate(step.href)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 hover:border-[#6C63FF]/40 hover:shadow-sm transition-all text-left group"
          >
            <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-[#6C63FF]/10 flex items-center justify-center text-sm flex-shrink-0 transition-colors">
              {step.icon}
            </div>
            <span className="text-sm text-slate-700 group-hover:text-slate-900 flex-1">{step.label}</span>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#6C63FF] transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [bots, setBots] = useState<BotType[]>([]);
  const [miniStats, setMiniStats] = useState<MiniStatsMap>({});
  const [loading, setLoading] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    Promise.all([api.bots.list(), api.bots.miniStats()])
      .then(([data, stats]) => {
        setBots(data ?? []);
        setMiniStats(stats ?? {});
      })
      .finally(() => setLoading(false));
  }, []);

  function handleDelete(id: string) {
    setBots((prev) => prev.filter((b) => b.id !== id));
  }

  function handleToggle(id: string, active: boolean) {
    setBots((prev) => prev.map((b) => (b.id === id ? { ...b, isActive: active } : b)));
  }

  async function handleDuplicate() {
    const fresh = await api.bots.list();
    if (fresh) setBots(fresh);
  }

  function handleSelectTemplate(template: BotTemplate) {
    localStorage.setItem("botTemplate", JSON.stringify(template));
    setShowTemplates(false);
    navigate("/bots/new");
  }

  const activeBots = bots.filter((b) => b.isActive).length;

  return (
    <Layout>
      {showTemplates && (
        <TemplatesModal onClose={() => setShowTemplates(false)} onSelect={handleSelectTemplate} />
      )}

      <header className="bg-white border-b border-slate-200 px-8 h-[60px] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-semibold text-slate-900">Dashboard</h1>
          {!loading && bots.length > 0 && (
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {activeBots}/{bots.length} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates(true)}
            className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <LayoutTemplate className="w-3.5 h-3.5" />
            Templates
          </button>
          <button
            onClick={() => navigate("/bots/new")}
            className="flex items-center gap-1.5 bg-[#6C63FF] hover:bg-[#5a52e0] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Bot
          </button>
        </div>
      </header>

      {!loading && bots.length > 0 && (
        <div className="bg-white border-b border-slate-200 px-8 py-3 flex items-center gap-6 flex-shrink-0">
          {[
            { icon: Bot, label: "Total Bots", value: bots.length },
            { icon: Zap, label: "Active", value: activeBots },
            { icon: Globe, label: "Providers", value: new Set(bots.map(b => b.provider)).size },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-2">
              <Icon className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-500">{label}:</span>
              <span className="text-sm font-semibold text-slate-800">{value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 p-8 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
          </div>
        ) : bots.length === 0 ? (
          <>
            <OnboardingChecklist />
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#6C63FF]/10 flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-[#6C63FF]" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-1">Create your first bot</h2>
              <p className="text-sm text-slate-400 mb-6 max-w-xs">
                AI chat assistants that capture leads, book appointments, and answer questions 24/7.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowTemplates(true)}
                  className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <LayoutTemplate className="w-3.5 h-3.5" />
                  Use Template
                </button>
                <button
                  onClick={() => navigate("/bots/new")}
                  className="flex items-center gap-1.5 bg-[#6C63FF] hover:bg-[#5a52e0] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Bot
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map((bot) => (
              <BotCard
                key={bot.id}
                bot={bot}
                miniStats={miniStats[bot.id]}
                onDelete={handleDelete}
                onToggle={handleToggle}
                onDuplicate={handleDuplicate}
              />
            ))}
            <button
              onClick={() => navigate("/bots/new")}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 hover:border-[#6C63FF]/40 hover:bg-[#6C63FF]/5 transition-all min-h-[180px] group"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-[#6C63FF]/10 flex items-center justify-center transition-colors">
                <Plus className="w-5 h-5 text-slate-400 group-hover:text-[#6C63FF]" />
              </div>
              <span className="text-sm font-medium text-slate-400 group-hover:text-[#6C63FF] transition-colors">Add new bot</span>
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}

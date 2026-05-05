import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Bot, Plus, Trash2, Code2, Pencil, ToggleLeft, ToggleRight, MessageSquare, Zap, Globe } from "lucide-react";
import { api, Bot as BotType } from "../lib/api";
import Layout from "../components/Layout";

const PROVIDER_META: Record<string, { label: string; color: string; bg: string }> = {
  anthropic: { label: "Claude", color: "text-orange-600", bg: "bg-orange-50 border-orange-100" },
  openai: { label: "OpenAI", color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
  gemini: { label: "Gemini", color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
  openrouter: { label: "OpenRouter", color: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
};

function BotCard({ bot, onDelete, onToggle }: { bot: BotType; onDelete: (id: string) => void; onToggle: (id: string, active: boolean) => void }) {
  const [, navigate] = useLocation();
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const provider = PROVIDER_META[bot.provider] ?? { label: bot.provider, color: "text-slate-600", bg: "bg-slate-50 border-slate-100" };
  const color = bot.appearance?.primaryColor ?? "#6366f1";
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

  return (
    <div
      onClick={() => navigate(`/bots/${bot.id}`)}
      className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md shadow-sm transition-all duration-150 cursor-pointer group overflow-hidden"
    >
      {/* Top accent */}
      <div className="h-1" style={{ backgroundColor: color }} />

      <div className="p-5">
        {/* Header row */}
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
          {/* Status toggle */}
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

        {/* Badges */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
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

        {/* Actions */}
        <div className="flex gap-2 pt-1 border-t border-slate-100">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/bots/${bot.id}`); }}
            className="flex items-center gap-1.5 flex-1 justify-center text-xs font-medium py-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/bots/${bot.id}?tab=integration`); }}
            className="flex items-center gap-1.5 flex-1 justify-center text-xs font-medium py-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <Code2 className="w-3 h-3" /> Embed
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

export default function Dashboard() {
  const [bots, setBots] = useState<BotType[]>([]);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  useEffect(() => {
    api.bots.list()
      .then((data) => setBots(data ?? []))
      .finally(() => setLoading(false));
  }, []);

  function handleDelete(id: string) {
    setBots((prev) => prev.filter((b) => b.id !== id));
  }

  function handleToggle(id: string, active: boolean) {
    setBots((prev) => prev.map((b) => (b.id === id ? { ...b, isActive: active } : b)));
  }

  const activeBots = bots.filter((b) => b.isActive).length;

  return (
    <Layout>
      {/* Page header */}
      <header className="bg-white border-b border-slate-200 px-8 h-[60px] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-semibold text-slate-900">Dashboard</h1>
          {!loading && bots.length > 0 && (
            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {activeBots}/{bots.length} active
            </span>
          )}
        </div>
        <button
          onClick={() => navigate("/bots/new")}
          className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Bot
        </button>
      </header>

      {/* Stats strip */}
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
              <span className="text-sm font-semibold text-slate-900">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main */}
      <main className="flex-1 p-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 h-44 animate-pulse" />
            ))}
          </div>
        ) : bots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center max-w-sm mx-auto">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5 border border-indigo-100">
              <MessageSquare className="w-7 h-7 text-indigo-500" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">No bots yet</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              Create your first AI chatbot — connect any provider, customise its personality, and embed it on any website with one line of code.
            </p>
            <button
              onClick={() => navigate("/bots/new")}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Your First Bot
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {bots.map((bot) => (
              <BotCard key={bot.id} bot={bot} onDelete={handleDelete} onToggle={handleToggle} />
            ))}
            {/* Add card */}
            <button
              onClick={() => navigate("/bots/new")}
              className="border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 rounded-xl flex flex-col items-center justify-center gap-2.5 min-h-[168px] text-slate-400 hover:text-indigo-500 transition-all duration-150 group"
            >
              <div className="w-10 h-10 rounded-xl border-2 border-dashed border-current flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium">Add New Bot</span>
            </button>
          </div>
        )}
      </main>
    </Layout>
  );
}

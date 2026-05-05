import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { api, Bot } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Claude",
  openai: "OpenAI",
  gemini: "Gemini",
  openrouter: "OpenRouter",
};

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "bg-orange-100 text-orange-700",
  openai: "bg-green-100 text-green-700",
  gemini: "bg-blue-100 text-blue-700",
  openrouter: "bg-purple-100 text-purple-700",
};

function BotCard({ bot, onDelete, onToggle }: { bot: Bot; onDelete: (id: string) => void; onToggle: (id: string, active: boolean) => void }) {
  const [, navigate] = useLocation();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${bot.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.bots.delete(bot.id);
      onDelete(bot.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="h-1.5" style={{ backgroundColor: bot.appearance?.primaryColor ?? "#2563EB" }} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
              style={{ backgroundColor: bot.appearance?.primaryColor ?? "#2563EB" }}
            >
              {(bot.appearance?.avatarText || bot.appearance?.botName || bot.name)[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 truncate">{bot.name}</h3>
              {bot.description && (
                <p className="text-xs text-gray-400 truncate mt-0.5">{bot.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => onToggle(bot.id, !bot.isActive)}
            className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors ${bot.isActive ? "bg-green-500" : "bg-gray-200"}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${bot.isActive ? "left-5" : "left-1"}`} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${PROVIDER_COLORS[bot.provider] ?? "bg-gray-100 text-gray-600"}`}>
            {PROVIDER_LABELS[bot.provider] ?? bot.provider}
          </span>
          <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full truncate max-w-[140px]" title={bot.model}>
            {bot.model.split("/").pop()}
          </span>
          <span className={`text-xs font-medium ml-auto ${bot.isActive ? "text-green-600" : "text-gray-400"}`}>
            {bot.isActive ? "● Active" : "○ Inactive"}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/bots/${bot.id}`)}
            className="flex-1 text-sm py-2 rounded-lg bg-gray-50 hover:bg-blue-50 hover:text-blue-700 text-gray-700 font-medium transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => navigate(`/bots/${bot.id}/embed`)}
            className="flex-1 text-sm py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
          >
            Get Code
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => {
    api.bots.list()
      .then(setBots)
      .finally(() => setLoading(false));
  }, []);

  function handleDelete(id: string) {
    setBots((prev) => prev.filter((b) => b.id !== id));
  }

  async function handleToggle(id: string, active: boolean) {
    await api.bots.update(id, { isActive: active });
    setBots((prev) => prev.map((b) => b.id === id ? { ...b, isActive: active } : b));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-60 bg-slate-900 flex flex-col z-20">
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-lg">🤖</div>
            <span className="text-white font-bold text-lg">BotBuilder</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <div className="text-xs text-slate-500 font-medium px-3 py-2 uppercase tracking-wider">Menu</div>
          <a className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-600/10 text-blue-400 font-medium text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            My Bots
          </a>
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 text-sm font-bold">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.username}</p>
              <p className="text-slate-500 text-xs truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full mt-2 flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            Sign out
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="ml-60">
        <header className="bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">My Bots</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {bots.length} bot{bots.length !== 1 ? "s" : ""} total
            </p>
          </div>
          <button
            onClick={() => navigate("/bots/new")}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            New Bot
          </button>
        </header>

        <main className="p-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 h-44 animate-pulse" />
              ))}
            </div>
          ) : bots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="text-6xl mb-4">🤖</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">No bots yet</h2>
              <p className="text-gray-400 mb-6 max-w-sm">Create your first AI chatbot — customise its personality, connect an AI provider, and embed it on any website.</p>
              <button
                onClick={() => navigate("/bots/new")}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
              >
                Create Your First Bot
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {bots.map((bot) => (
                <BotCard key={bot.id} bot={bot} onDelete={handleDelete} onToggle={handleToggle} />
              ))}
              <button
                onClick={() => navigate("/bots/new")}
                className="border-2 border-dashed border-gray-200 hover:border-blue-300 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-blue-500 transition-colors min-h-[180px]"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
                <span className="text-sm font-medium">Add New Bot</span>
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { MessageSquare, Loader2, RefreshCw } from "lucide-react";
import { api, RecentConversation } from "../lib/api";
import Layout from "../components/Layout";

export default function Conversations() {
  const [conversations, setConversations] = useState<RecentConversation[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api.analytics.recent();
      setConversations(data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const totalMessages = conversations.reduce((sum, c) => sum + c.messageCount, 0);

  return (
    <Layout>
      <header className="bg-white border-b border-slate-200 px-6 h-[60px] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="w-5 h-5 text-indigo-500" />
          <h1 className="text-[15px] font-semibold text-slate-900">Conversations</h1>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-500 mb-1">Total Sessions</p>
            <p className="text-2xl font-bold text-slate-900">{conversations.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-500 mb-1">Total Messages</p>
            <p className="text-2xl font-bold text-slate-900">{totalMessages}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <MessageSquare className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">No conversations yet</p>
            <p className="text-slate-400 text-sm mt-1">
              Visitor chat sessions will appear here as they happen.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Bot", "Session ID", "Messages", "Started"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {conversations.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex-shrink-0"
                          style={{ backgroundColor: c.botColor || "#6366f1" }}
                        />
                        <span className="font-medium text-slate-900">{c.botName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400 max-w-[160px] truncate">
                      {c.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                        <MessageSquare className="w-3 h-3" />
                        {c.messageCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}

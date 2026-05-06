import { useState, useEffect } from "react";
import { MessageSquare, Loader2, RefreshCw, Download, X, Bot, User } from "lucide-react";
import { api, RecentConversation, ConversationDetail } from "../lib/api";
import Layout from "../components/Layout";

function MessageViewer({ conv, onClose }: { conv: ConversationDetail; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white h-full w-full max-w-md flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-full flex-shrink-0"
              style={{ backgroundColor: conv.botColor || "#6366f1" }}
            />
            <div>
              <p className="text-sm font-semibold text-slate-900">{conv.botName}</p>
              <p className="text-xs text-slate-400">{conv.messageCount} messages · {new Date(conv.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {conv.messages && conv.messages.length > 0 ? (
            conv.messages.map((msg, i) => (
              <div key={i} className={`flex items-start gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === "assistant" ? "text-white" : "bg-slate-200"}`}
                  style={msg.role === "assistant" ? { backgroundColor: conv.botColor || "#6366f1" } : {}}>
                  {msg.role === "assistant"
                    ? <Bot className="w-3.5 h-3.5 text-white" />
                    : <User className="w-3.5 h-3.5 text-slate-500" />}
                </div>
                <div
                  className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "assistant"
                      ? "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
                      : "text-white rounded-tr-sm"
                  }`}
                  style={msg.role === "user" ? { backgroundColor: conv.botColor || "#6366f1" } : {}}
                >
                  {msg.content}
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare className="w-8 h-8 text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">No messages recorded for this session.</p>
              <p className="text-xs text-slate-300 mt-1">Messages are recorded from new conversations going forward.</p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-white flex-shrink-0">
          <p className="text-xs text-slate-400 font-mono">Session: {conv.sessionId}</p>
        </div>
      </div>
    </div>
  );
}

export default function Conversations() {
  const [conversations, setConversations] = useState<RecentConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<ConversationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

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

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await api.conversations.export();
      if (!csv) return;
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "conversations.csv";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function handleRowClick(conv: RecentConversation) {
    setLoadingDetail(conv.id);
    try {
      const detail = await api.conversations.getMessages(conv.id);
      if (detail) setSelected(detail);
    } finally {
      setLoadingDetail(null);
    }
  }

  return (
    <Layout>
      {selected && <MessageViewer conv={selected} onClose={() => setSelected(null)} />}

      <header className="bg-white border-b border-slate-200 px-6 h-[60px] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="w-5 h-5 text-indigo-500" />
          <h1 className="text-[15px] font-semibold text-slate-900">Conversations</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting || conversations.length === 0}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export CSV
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
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
                  {["Bot", "Messages", "Started", ""].map((h, i) => (
                    <th key={i} className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {conversations.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                    onClick={() => handleRowClick(c)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex-shrink-0"
                          style={{ backgroundColor: c.botColor || "#6366f1" }}
                        />
                        <span className="font-medium text-slate-900">{c.botName}</span>
                      </div>
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
                    <td className="px-4 py-3 text-right">
                      {loadingDetail === c.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300 ml-auto" />
                      ) : (
                        <span className="text-xs text-indigo-400 font-medium opacity-0 group-hover:opacity-100 hover:underline">
                          View →
                        </span>
                      )}
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

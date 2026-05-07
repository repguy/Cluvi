import { useState, useEffect, useMemo, useRef } from "react";
import { MessageSquare, Loader2, RefreshCw, Download, Bot, User, Search } from "lucide-react";
import { api, RecentConversation, ConversationDetail } from "../lib/api";
import Layout from "../components/Layout";

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Conversations() {
  const [conversations, setConversations] = useState<RecentConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState("");
  const transcriptRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [detail]);

  const filtered = useMemo(() => conversations.filter((c) =>
    !search || c.botName.toLowerCase().includes(search.toLowerCase())
  ), [conversations, search]);

  async function handleSelect(conv: RecentConversation) {
    if (selectedId === conv.id) return;
    setSelectedId(conv.id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await api.conversations.getMessages(conv.id);
      if (d) setDetail(d);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await api.conversations.export();
      if (!csv) return;
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "conversations.csv"; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const totalMessages = conversations.reduce((s, c) => s + c.messageCount, 0);
  const selectedConv = conversations.find((c) => c.id === selectedId);

  return (
    <Layout>
      <header className="bg-white border-b border-slate-200 px-6 h-[60px] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="w-5 h-5 text-indigo-500" />
          <h1 className="text-[15px] font-semibold text-slate-900">Conversations</h1>
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium ml-1">{conversations.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />Refresh
          </button>
          <button onClick={handleExport} disabled={exporting || conversations.length === 0} className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export CSV
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left panel — conversation list */}
        <aside className="w-[300px] border-r border-slate-200 bg-white flex flex-col flex-shrink-0">
          {/* Summary bar */}
          <div className="grid grid-cols-2 gap-2 p-3 border-b border-slate-100">
            <div className="bg-slate-50 rounded-lg p-2.5 text-center">
              <p className="text-[11px] text-slate-400 font-medium">Sessions</p>
              <p className="text-lg font-bold text-slate-900 tabular-nums">{conversations.length}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2.5 text-center">
              <p className="text-[11px] text-slate-400 font-medium">Messages</p>
              <p className="text-lg font-bold text-slate-900 tabular-nums">{totalMessages}</p>
            </div>
          </div>

          {/* Search */}
          <div className="p-2.5 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by bot…"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <MessageSquare className="w-8 h-8 text-slate-200 mb-2" />
                <p className="text-sm text-slate-400">
                  {conversations.length === 0 ? "No conversations yet" : "No results"}
                </p>
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  className={`w-full text-left px-3 py-3 border-b border-slate-50 transition-all ${
                    selectedId === c.id ? "bg-indigo-50 border-l-2 border-l-indigo-500" : "hover:bg-slate-50 border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: c.botColor || "#6366f1" }}>
                      {c.botName?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-semibold text-slate-900 truncate">{c.botName}</p>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">{timeAgo(c.createdAt)}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        <span className="inline-flex items-center gap-0.5">
                          <MessageSquare className="w-2.5 h-2.5" />{c.messageCount} messages
                        </span>
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Right panel — transcript */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-50">
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                <MessageSquare className="w-7 h-7 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium text-sm">Select a conversation</p>
              <p className="text-slate-400 text-xs mt-1">Click any session on the left to read the full transcript.</p>
            </div>
          ) : detailLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
            </div>
          ) : detail ? (
            <>
              {/* Transcript header */}
              <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-3 flex-shrink-0">
                <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: selectedConv?.botColor || "#6366f1" }}>
                  {detail.botName?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{detail.botName}</p>
                  <p className="text-[11px] text-slate-400">
                    {detail.messageCount} messages · {new Date(detail.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <span className="ml-auto text-[10px] font-mono text-slate-300 truncate max-w-[160px]">
                  {detail.sessionId}
                </span>
              </div>

              {/* Messages */}
              <div ref={transcriptRef} className="flex-1 overflow-y-auto p-5 space-y-3">
                {detail.messages && detail.messages.length > 0 ? (
                  detail.messages.map((msg, i) => (
                    <div key={i} className={`flex items-start gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === "assistant" ? "text-white" : "bg-slate-200"}`}
                        style={msg.role === "assistant" ? { backgroundColor: selectedConv?.botColor || "#6366f1" } : {}}>
                        {msg.role === "assistant"
                          ? <Bot className="w-3.5 h-3.5 text-white" />
                          : <User className="w-3.5 h-3.5 text-slate-500" />}
                      </div>
                      <div
                        className={`max-w-[70%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                          msg.role === "assistant"
                            ? "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
                            : "text-white rounded-tr-sm"
                        }`}
                        style={msg.role === "user" ? { backgroundColor: selectedConv?.botColor || "#6366f1" } : {}}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <MessageSquare className="w-8 h-8 text-slate-200 mb-2" />
                    <p className="text-sm text-slate-400">No messages recorded for this session.</p>
                    <p className="text-xs text-slate-300 mt-1">Messages are recorded from new conversations going forward.</p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </main>
      </div>
    </Layout>
  );
}

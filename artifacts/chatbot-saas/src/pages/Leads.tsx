import { useState, useEffect, useMemo } from "react";
import { Users, Search, RefreshCw, Loader2, Download, SkipForward } from "lucide-react";
import Layout from "../components/Layout";
import { api } from "../lib/api";

interface Lead {
  id: string; botId: string; botName: string; botColor: string;
  sessionId: string; name: string; email: string; skipped: boolean; createdAt: string;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "captured" | "skipped">("all");

  async function load() {
    setLoading(true);
    try {
      const data = await api.leads.list();
      setLeads(data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => leads.filter((l) => {
    const matchSearch = !search ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "captured" && !l.skipped) ||
      (filter === "skipped" && l.skipped);
    return matchSearch && matchFilter;
  }), [leads, search, filter]);

  const captured = leads.filter((l) => !l.skipped);
  const skipped = leads.filter((l) => l.skipped);

  function handleExport() {
    const rows = [
      ["Name", "Email", "Bot", "Date", "Status"],
      ...filtered.map((l) => [l.name, l.email, l.botName,
        new Date(l.createdAt).toLocaleDateString(), l.skipped ? "Skipped" : "Captured"]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "leads.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Layout>
      <header className="bg-white border-b border-slate-200 px-6 h-[60px] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <Users className="w-5 h-5 text-indigo-500" />
          <h1 className="text-[15px] font-semibold text-slate-900">Leads</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />Refresh
          </button>
          <button onClick={handleExport} disabled={leads.length === 0} className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
            <Download className="w-3.5 h-3.5" />Export CSV
          </button>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 mb-1">Total Leads</p>
            <p className="text-2xl font-bold text-slate-900">{leads.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs font-medium text-emerald-600 mb-1">Captured</p>
            <p className="text-2xl font-bold text-emerald-700">{captured.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500 mb-1">Skipped</p>
            <p className="text-2xl font-bold text-slate-400">{skipped.length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
            />
          </div>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
            {(["all", "captured", "skipped"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 font-medium capitalize transition-colors ${filter === f ? "bg-indigo-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                {f}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-400 ml-auto">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Users className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">No leads yet</p>
            <p className="text-slate-400 text-sm mt-1 max-w-xs">
              Enable lead capture in your bot's Appearance tab. Visitors will be asked for their name & email before chatting.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Search className="w-8 h-8 text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">No results</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Visitor", "Email", "Bot", "Time", "Status"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: l.botColor || "#6366f1" }}>
                          {l.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <span className="font-medium text-slate-900">{l.name || <span className="text-slate-300 italic">—</span>}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{l.email || <span className="text-slate-300 italic">—</span>}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{l.botName}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{timeAgo(l.createdAt)}</td>
                    <td className="px-4 py-3">
                      {l.skipped ? (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          <SkipForward className="w-3 h-3" />Skipped
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
                          ✓ Captured
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

import { useState, useEffect, useMemo } from "react";
import { CalendarCheck, Download, Loader2, RefreshCw, Search, Filter } from "lucide-react";
import { api, Booking, Bot } from "../lib/api";
import Layout from "../components/Layout";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  confirmed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  cancelled: "bg-red-50 text-red-600 border border-red-200",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};

export default function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [botFilter, setBotFilter] = useState("all");

  async function load() {
    setLoading(true);
    try {
      const [data, botData] = await Promise.all([api.bookings.list(), api.bots.list()]);
      setBookings(data ?? []);
      setBots(botData ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleStatusChange(id: string, status: string) {
    setUpdatingId(id);
    try {
      const updated = await api.bookings.updateStatus(id, status);
      if (updated) {
        setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
      }
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await api.bookings.export();
      if (!csv) return;
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bookings.csv";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      const matchSearch =
        !search ||
        b.name?.toLowerCase().includes(search.toLowerCase()) ||
        b.phone?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || b.status === statusFilter;
      const matchBot = botFilter === "all" || b.botId === botFilter;
      return matchSearch && matchStatus && matchBot;
    });
  }, [bookings, search, statusFilter, botFilter]);

  const counts = {
    pending: bookings.filter((b) => b.status === "pending").length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
  };

  return (
    <Layout>
      <header className="bg-white border-b border-slate-200 px-6 h-[60px] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <CalendarCheck className="w-5 h-5 text-indigo-500" />
          <h1 className="text-[15px] font-semibold text-slate-900">Bookings</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || bookings.length === 0}
            className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: "Pending", count: counts.pending, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
            { label: "Confirmed", count: counts.confirmed, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
            { label: "Cancelled", count: counts.cancelled, color: "text-red-500", bg: "bg-red-50 border-red-100" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
              <p className="text-xs font-medium text-slate-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone…"
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-700"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={botFilter}
              onChange={(e) => setBotFilter(e.target.value)}
              className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-slate-700"
            >
              <option value="all">All Bots</option>
              {bots.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-slate-400 ml-auto">
            Showing {filtered.length} booking{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <CalendarCheck className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">No bookings yet</p>
            <p className="text-slate-400 text-sm mt-1">
              Bookings will appear here when visitors use the booking flow in your widget.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Search className="w-8 h-8 text-slate-200 mb-3" />
            <p className="text-slate-500 font-medium">No results found</p>
            <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Name", "Phone", "Service", "Date", "Time", "Bot", "Received", "Status"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{b.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{b.phone || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{b.service || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{b.date || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{b.timePreference || "—"}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{b.botName || "—"}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {new Date(b.createdAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {updatingId === b.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-300" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[b.status] ?? STATUS_BADGE.pending}`}>
                            {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                          </span>
                          <select
                            value={b.status}
                            onChange={(e) => handleStatusChange(b.id, e.target.value)}
                            className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 outline-none cursor-pointer ${STATUS_STYLES[b.status] ?? STATUS_STYLES.pending}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
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

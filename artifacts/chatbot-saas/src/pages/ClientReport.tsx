import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Zap, MessageSquare, CalendarCheck, TrendingUp, Loader2 } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface ReportData {
  botName: string; botColor: string;
  totalConversations: number; totalBookings: number; bookingsThisMonth: number;
  dailyBookings: { date: string; count: number }[];
  recentBookings: {
    id: string; name: string; phone: string; service: string;
    date: string; timePreference: string; status: string; createdAt: string;
  }[];
}

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") + "/api";

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
};

export default function ClientReport() {
  const { botId, token } = useParams<{ botId: string; token: string }>();
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/report/${botId}/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error("Invalid or expired report link.");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [botId, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 text-center p-6">
        <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
          <Zap className="w-6 h-6 text-red-400" />
        </div>
        <p className="text-slate-700 font-semibold">Report not found</p>
        <p className="text-slate-400 text-sm">{error || "This link may be invalid or expired."}</p>
      </div>
    );
  }

  const chartData = data.dailyBookings.map((d) => ({ ...d, date: fmtDate(d.date) }));

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: data.botColor }}>
              {data.botName[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900">{data.botName}</h1>
              <p className="text-xs text-slate-400">Performance Report</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
            <div className="w-4 h-4 rounded bg-indigo-500 flex items-center justify-center">
              <Zap className="w-2.5 h-2.5 text-white" />
            </div>
            Powered by Cluvi
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: MessageSquare, label: "Total Conversations", value: data.totalConversations, color: "text-indigo-500", bg: "bg-indigo-50" },
            { icon: CalendarCheck, label: "Total Bookings", value: data.totalBookings, color: "text-violet-500", bg: "bg-violet-50" },
            { icon: TrendingUp, label: "Bookings This Month", value: data.bookingsThisMonth, color: "text-emerald-500", bg: "bg-emerald-50" },
          ].map(({ icon: Icon, label, value, color, bg }) => (
            <div key={label} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-slate-500 font-medium">{label}</p>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bg} ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900 tabular-nums">{value}</p>
            </div>
          ))}
        </div>

        {/* Bookings chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Bookings — Last 30 Days</h2>
          <p className="text-xs text-slate-400 mb-5">Daily booking activity</p>
          {chartData.length === 0 || chartData.every((d) => d.count === 0) ? (
            <div className="h-44 flex items-center justify-center">
              <p className="text-sm text-slate-400">No bookings in this period</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={data.botColor} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={data.botColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "none", borderRadius: "8px", fontSize: "12px", color: "#e2e8f0", padding: "8px 12px" }} />
                <Area type="monotone" dataKey="count" name="Bookings" stroke={data.botColor} strokeWidth={2} fill="url(#cGrad)" dot={false} activeDot={{ r: 4, fill: data.botColor, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent bookings */}
        {data.recentBookings.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">Recent Bookings</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {["Name", "Service", "Date", "Time", "Status"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.recentBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-900">{b.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{b.service || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{b.date || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{b.timePreference || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[b.status] ?? STATUS_STYLE.pending}`}>
                        {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-center text-xs text-slate-400 pb-4">
          Report generated {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}

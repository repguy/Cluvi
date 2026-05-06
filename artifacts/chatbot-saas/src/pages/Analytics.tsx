import { useState, useEffect } from "react";
import { Bot, MessageSquare, Activity, Zap, CalendarCheck } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api, AnalyticsOverview, RecentConversation } from "../lib/api";
import Layout from "../components/Layout";

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  color: string;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
      ) : (
        <p className="text-3xl font-bold text-slate-900 tabular-nums">{value}</p>
      )}
    </div>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Analytics() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [recent, setRecent] = useState<RecentConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.analytics.overview(), api.analytics.recent()])
      .then(([ov, rec]) => {
        setOverview(ov);
        setRecent(rec ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const chartData =
    overview?.dailyConversations.map((d) => ({
      ...d,
      date: formatDate(d.date),
    })) ?? [];

  return (
    <Layout>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 h-[60px] flex items-center flex-shrink-0">
        <h1 className="text-[15px] font-semibold text-slate-900">Analytics</h1>
      </header>

      <main className="flex-1 p-8 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
          <StatCard
            icon={Bot}
            label="Total Bots"
            value={overview?.totalBots ?? 0}
            color="bg-indigo-50 text-indigo-500"
            loading={loading}
          />
          <StatCard
            icon={Zap}
            label="Active Bots"
            value={overview?.activeBots ?? 0}
            color="bg-emerald-50 text-emerald-500"
            loading={loading}
          />
          <StatCard
            icon={Activity}
            label="Conversations"
            value={overview?.totalConversations ?? 0}
            color="bg-blue-50 text-blue-500"
            loading={loading}
          />
          <StatCard
            icon={MessageSquare}
            label="Messages Sent"
            value={overview?.totalMessages ?? 0}
            color="bg-amber-50 text-amber-500"
            loading={loading}
          />
          <StatCard
            icon={CalendarCheck}
            label="Bookings"
            value={overview?.totalBookings ?? 0}
            color="bg-violet-50 text-violet-500"
            loading={loading}
          />
        </div>

        {/* Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Conversations</h2>
              <p className="text-xs text-slate-400 mt-0.5">Last 7 days</p>
            </div>
          </div>
          {loading ? (
            <div className="h-52 bg-slate-50 rounded-lg animate-pulse" />
          ) : chartData.every((d) => d.count === 0) ? (
            <div className="h-52 flex flex-col items-center justify-center text-center">
              <Activity className="w-8 h-8 text-slate-200 mb-3" />
              <p className="text-sm text-slate-400 font-medium">No conversations yet</p>
              <p className="text-xs text-slate-300 mt-1">
                Embed a bot on a website to start seeing data
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorConvos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#e2e8f0",
                    padding: "8px 12px",
                  }}
                  itemStyle={{ color: "#a5b4fc" }}
                  labelStyle={{ color: "#94a3b8", marginBottom: "2px" }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="Conversations"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#colorConvos)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#6366f1", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent conversations table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Recent Conversations</h2>
            <span className="text-xs text-slate-400">{recent.length} total</span>
          </div>
          {loading ? (
            <div className="divide-y divide-slate-100">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="px-6 py-3 flex items-center gap-4">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
                    <div className="h-2.5 w-20 bg-slate-100 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="w-6 h-6 text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">No conversations yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recent.map((conv) => (
                <div key={conv.id} className="px-6 py-3 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: conv.botColor || "#6366f1" }}
                  >
                    {conv.botName?.[0]?.toUpperCase() ?? "B"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{conv.botName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {conv.messageCount} message{conv.messageCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0 tabular-nums">
                    {timeAgo(conv.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </Layout>
  );
}

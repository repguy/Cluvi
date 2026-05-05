import { ReactNode } from "react";
import { useLocation } from "wouter";
import {
  LayoutDashboard,
  Bot,
  BarChart3,
  LogOut,
  Plus,
  Zap,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
];

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const [location, navigate] = useLocation();

  function isActive(href: string) {
    if (href === "/") return location === "/" || location === "";
    return location.startsWith(href);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-[220px] bg-[#0f172a] flex flex-col z-30 border-r border-white/5">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-[60px] border-b border-white/5 flex-shrink-0">
          <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-semibold text-[15px] tracking-tight">BotBuilder</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 pb-2 pt-1">
            Menu
          </p>
          {navItems.map(({ href, icon: Icon, label }) => (
            <button
              key={href}
              onClick={() => navigate(href)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive(href)
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isActive(href) ? "text-indigo-400" : ""}`} />
              {label}
              {isActive(href) && (
                <span className="ml-auto w-1 h-1 rounded-full bg-indigo-400" />
              )}
            </button>
          ))}

          <div className="pt-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest px-3 pb-2">
              Bots
            </p>
            <button
              onClick={() => navigate("/bots/new")}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all duration-150"
            >
              <Bot className="w-4 h-4 flex-shrink-0" />
              My Bots
            </button>
          </div>
        </nav>

        {/* New Bot CTA */}
        <div className="px-3 pb-3">
          <button
            onClick={() => navigate("/bots/new")}
            className="w-full flex items-center justify-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Bot
          </button>
        </div>

        {/* User */}
        <div className="px-3 pb-4 border-t border-white/5 pt-3 flex-shrink-0">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors group">
            <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-bold flex-shrink-0">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-300 text-xs font-medium truncate">{user?.username}</p>
              <p className="text-slate-500 text-[11px] truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="text-slate-500 hover:text-slate-300 transition-colors opacity-0 group-hover:opacity-100"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-[220px] min-h-screen flex flex-col">
        {children}
      </div>
    </div>
  );
}

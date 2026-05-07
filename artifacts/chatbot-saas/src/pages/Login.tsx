import { useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { Zap, Eye, EyeOff, Bot, Puzzle, Shield, Lock } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const [, navigate] = useLocation();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const features = [
    {
      icon: Bot,
      title: "Multi-provider AI",
      desc: "Claude, GPT-4o, Gemini, and 100+ open-source models via OpenRouter",
    },
    {
      icon: Puzzle,
      title: "One-line embed",
      desc: "Drop a single script tag on any website — no framework needed",
    },
    {
      icon: Shield,
      title: "API keys stay server-side",
      desc: "Your credentials are never exposed in the browser",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0f172a] flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col w-[480px] flex-shrink-0 px-12 py-10 border-r border-white/5">
        <div className="flex items-center gap-2.5 mb-auto">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold text-[17px]">Cluvi</span>
        </div>

        <div className="py-16">
          <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 text-xs font-semibold px-3 py-1.5 rounded-full border border-indigo-500/20 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            AI Chatbot Platform
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Build AI chatbots<br />
            <span className="text-indigo-400">for any business</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed mb-10">
            Create custom AI assistants, embed them on client websites, and capture leads — all from one dashboard.
          </p>

          <div className="space-y-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold mb-0.5">{title}</p>
                  <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-xs">
          © {new Date().getFullYear()} Cluvi. Your business, always on.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-white font-semibold text-base">Cluvi</span>
          </div>

          <div className="mb-7">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-2xl font-bold text-white">Welcome back</h2>
              <Lock className="w-4 h-4 text-slate-500 mt-0.5" />
            </div>
            <p className="text-slate-500 text-sm">Sign in to your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  required
                  minLength={6}
                  autoComplete="current-password"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl"
              >
                <span className="mt-0.5 flex-shrink-0">⚠</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-colors text-sm mt-1 flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="text-center text-slate-600 text-xs mt-8 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3" />
            Private instance — access restricted
          </p>
        </div>
      </div>
    </div>
  );
}

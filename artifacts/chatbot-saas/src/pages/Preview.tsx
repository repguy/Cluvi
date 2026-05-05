import { useEffect, useRef } from "react";
import { useSearch } from "wouter";

export default function Preview() {
  const search = useSearch();
  const botId = new URLSearchParams(search).get("botId");
  const injected = useRef(false);

  useEffect(() => {
    if (!botId || injected.current) return;
    injected.current = true;

    // Clean up any leftover widget from a previous load
    document.getElementById("_bb_preview_script")?.remove();
    document.getElementById("_cb_w")?.remove();

    const script = document.createElement("script");
    script.id = "_bb_preview_script";
    script.src = `/api/widget.js?botId=${encodeURIComponent(botId)}&_t=${Date.now()}`;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.getElementById("_bb_preview_script")?.remove();
      document.getElementById("_cb_w")?.remove();
      injected.current = false;
    };
  }, [botId]);

  if (!botId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 text-sm">No bot ID provided.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Preview banner */}
      <div className="fixed top-0 left-0 right-0 z-[999998] bg-[#0f172a] px-5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
          <span className="font-semibold text-white">Bot Preview</span>
          <span className="text-slate-500 hidden sm:inline">— This is a mock client website. Your bot appears bottom-right.</span>
        </div>
        <button
          onClick={() => window.close()}
          className="text-slate-500 hover:text-white text-xs transition-colors"
        >
          Close ✕
        </button>
      </div>

      {/* Mock website */}
      <div className="pt-10">
        {/* Nav */}
        <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-10 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-900" />
            <span className="font-bold text-slate-900">Acme Co.</span>
          </div>
          <div className="hidden sm:flex items-center gap-5 text-sm text-slate-500">
            {["Services", "About", "Pricing"].map((item) => (
              <span key={item} className="hover:text-slate-900 cursor-default">{item}</span>
            ))}
            <span className="bg-slate-900 text-white px-4 py-1.5 rounded-lg text-xs font-medium cursor-default">
              Contact
            </span>
          </div>
        </nav>

        {/* Hero */}
        <div className="bg-white px-8 py-20 text-center border-b border-slate-100">
          <div className="inline-block bg-indigo-50 text-indigo-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-5 tracking-wide uppercase border border-indigo-100">
            Welcome
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-5 leading-tight max-w-2xl mx-auto">
            Professional Services<br />
            <span className="text-indigo-500">For Your Business</span>
          </h1>
          <p className="text-slate-500 text-lg max-w-lg mx-auto mb-8 leading-relaxed">
            We provide top-quality solutions tailored to your needs. Trusted by hundreds of happy customers.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button className="bg-slate-900 text-white px-7 py-3 rounded-xl text-sm font-semibold">
              Get Started
            </button>
            <button className="border border-slate-200 text-slate-600 px-7 py-3 rounded-xl text-sm font-semibold">
              Learn More
            </button>
          </div>
        </div>

        {/* Services */}
        <div className="px-8 py-16 max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-3">Our Services</h2>
          <p className="text-slate-400 text-sm text-center mb-10">Everything you need to succeed</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { title: "Consulting", desc: "Strategic guidance to grow and scale your business.", icon: "💼" },
              { title: "Design", desc: "Beautiful, user-centred design for web and mobile.", icon: "🎨" },
              { title: "Support", desc: "24/7 dedicated support to keep things running.", icon: "🛟" },
            ].map(({ title, desc, icon }) => (
              <div key={title} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="text-3xl mb-4">{icon}</div>
                <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="bg-white border-t border-slate-100 px-8 py-14 text-center">
          <div className="max-w-xl mx-auto">
            <div className="text-amber-400 text-lg mb-3">★★★★★</div>
            <p className="text-slate-700 text-lg italic leading-relaxed mb-4">
              "The AI chat handles 80% of customer questions automatically — a total game changer."
            </p>
            <p className="text-sm font-semibold text-slate-900">Sarah M.</p>
            <p className="text-xs text-slate-400 mt-0.5">Owner, Downtown Dental</p>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-slate-900 text-slate-500 text-sm px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} Acme Co. All rights reserved.</span>
          <div className="flex gap-5">
            {["Privacy", "Terms", "Contact"].map((item) => (
              <span key={item} className="hover:text-white cursor-default transition-colors">{item}</span>
            ))}
          </div>
        </footer>
      </div>

      {/* Bouncing hint */}
      <div className="fixed bottom-[88px] right-5 pointer-events-none z-[999997] flex flex-col items-center gap-1"
        style={{ animation: "bb-bounce 2s ease-in-out infinite" }}>
        <span className="bg-white border border-slate-200 shadow-md rounded-full px-3 py-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap">
          Your bot 👇
        </span>
      </div>

      <style>{`
        @keyframes bb-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}

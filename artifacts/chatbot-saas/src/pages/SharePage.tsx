import { useEffect, useRef } from "react";
import { useParams } from "wouter";
import { Zap } from "lucide-react";

export default function SharePage() {
  const params = useParams<{ publicId: string }>();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    const script = document.createElement("script");
    script.src = `/api/widget.js?botId=${params.publicId}`;
    script.async = true;
    script.onload = () => {
      // Auto-open the widget after a short delay
      setTimeout(() => {
        if (typeof (window as { _cbToggle?: () => void })._cbToggle === "function") {
          (window as { _cbToggle?: () => void })._cbToggle!();
        }
      }, 600);
    };
    document.head.appendChild(script);

    return () => { document.head.removeChild(script); };
  }, [params.publicId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex flex-col items-center justify-center p-6">
      <div className="text-center mb-12 max-w-sm">
        <div className="w-14 h-14 bg-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/30">
          <Zap className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Chat with our AI assistant</h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Ask questions, get help, or book an appointment — our AI assistant is here 24/7.
        </p>
      </div>

      <div className="flex items-center gap-2 text-slate-500 text-xs mt-4">
        <span>Powered by</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-indigo-500 rounded flex items-center justify-center">
            <Zap className="w-2.5 h-2.5 text-white" />
          </div>
          <span className="text-slate-400 font-medium">Cluvi</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 max-w-xs w-full text-center">
        {[
          { icon: "💬", label: "Ask anything" },
          { icon: "📅", label: "Book instantly" },
          { icon: "🔒", label: "Safe & secure" },
        ].map(({ icon, label }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-3">
            <div className="text-xl mb-1">{icon}</div>
            <p className="text-xs text-slate-400">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

import Chatbot from "./Chatbot";

function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center justify-center px-6">
      {/* Demo landing page background */}
      <div className="max-w-2xl w-full text-center">
        <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          AI Chatbot Demo — Smile Care Dental
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4 leading-tight">
          Your AI-powered<br />
          <span className="text-blue-600">customer assistant</span>
        </h1>
        <p className="text-lg text-gray-500 mb-8 leading-relaxed">
          This chatbot handles FAQs, captures leads, and books appointments —
          automatically, 24/7. Click the chat button in the bottom-right to try it.
        </p>
        <div className="grid grid-cols-3 gap-4 text-left">
          {[
            { icon: "🤖", title: "AI-Powered", desc: "Answers questions instantly with Claude" },
            { icon: "📋", title: "Lead Capture", desc: "Collects name, phone & appointment date" },
            { icon: "⚙️", title: "Config-Driven", desc: "One file swap to deploy per client" },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="text-2xl mb-2">{f.icon}</div>
              <p className="font-semibold text-gray-800 text-sm">{f.title}</p>
              <p className="text-gray-500 text-xs mt-1 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* The floating chatbot widget */}
      <Chatbot />
    </div>
  );
}

export default App;

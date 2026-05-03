import { useState, useRef, useEffect, FormEvent } from "react";
import { clientConfig, buildSystemPrompt } from "./config";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface LeadFormData {
  name: string;
  phone: string;
  date: string;
}

type ChatState = "idle" | "loading" | "lead_form" | "lead_success";

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
        style={{ backgroundColor: clientConfig.primaryColor }}
      >
        {clientConfig.businessName[0]}
      </div>
      <div className="bg-blue-50 border border-blue-100 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [state, setState] = useState<ChatState>("idle");
  const [unreadCount, setUnreadCount] = useState(1);
  const [showBookBtn, setShowBookBtn] = useState(false);
  const [leadForm, setLeadForm] = useState<LeadFormData>({ name: "", phone: "", date: "" });
  const [leadError, setLeadError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, state]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 300);
      if (messages.length === 0) {
        setMessages([{ role: "assistant", content: clientConfig.welcomeMessage }]);
      }
    }
  }, [isOpen]);

  async function sendMessage(text: string) {
    if (!text.trim() || state === "loading") return;

    const userMsg: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setState("loading");
    setShowBookBtn(true);

    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

    if (!apiKey) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ API key not configured. Please set VITE_ANTHROPIC_API_KEY in your .env file." },
      ]);
      setState("idle");
      return;
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 1000,
          system: buildSystemPrompt(clientConfig),
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      const reply = data.content?.[0]?.text ?? clientConfig.fallbackMessage;
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: clientConfig.fallbackMessage },
      ]);
    } finally {
      setState("idle");
    }
  }

  async function handleLeadSubmit(e: FormEvent) {
    e.preventDefault();
    setLeadError("");

    if (!leadForm.name.trim() || !leadForm.phone.trim()) {
      setLeadError("Name and phone number are required.");
      return;
    }

    setState("lead_success");

    if (clientConfig.leadWebhookUrl) {
      try {
        await fetch(clientConfig.leadWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessName: clientConfig.businessName,
            ...leadForm,
            submittedAt: new Date().toISOString(),
          }),
        });
      } catch {
        // Silently fail webhook
      }
    }

    const confirmMsg = `Thanks ${leadForm.name}! We've received your appointment request. We'll call you at ${leadForm.phone}${leadForm.date ? ` to confirm your appointment around ${leadForm.date}` : ""}. See you soon! 😊`;
    setTimeout(() => {
      setState("idle");
      setMessages((prev) => [...prev, { role: "assistant", content: confirmMsg }]);
    }, 1500);
  }

  function handleQuickAction(text: string) {
    sendMessage(text);
  }

  const quickActions = ["What are your hours?", "What services do you offer?", "Book an appointment"];
  const showQuickActions = messages.length <= 1 && state !== "loading";

  return (
    <>
      {/* Chat Window */}
      <div
        className={`fixed bottom-24 right-5 z-50 transition-all duration-300 origin-bottom-right ${
          isOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-90 pointer-events-none"
        }`}
        style={{ width: 360 }}
      >
        <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100" style={{ maxHeight: 560 }}>
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${clientConfig.primaryColor}, ${clientConfig.primaryColor}dd)` }}
          >
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {clientConfig.businessName[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-tight truncate">{clientConfig.businessName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-white/80 text-xs">Online now</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
              aria-label="Close chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-gray-50" style={{ minHeight: 200 }}>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex items-end gap-2 mb-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: clientConfig.primaryColor }}
                  >
                    {clientConfig.businessName[0]}
                  </div>
                )}
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "text-white rounded-br-sm"
                      : "bg-white border border-gray-100 text-gray-800 rounded-bl-sm shadow-sm"
                  }`}
                  style={msg.role === "user" ? { backgroundColor: clientConfig.primaryColor } : {}}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {state === "loading" && <TypingIndicator />}

            {/* Quick actions */}
            {showQuickActions && (
              <div className="flex flex-col gap-2 pt-1">
                {quickActions.map((action) => (
                  <button
                    key={action}
                    onClick={() => handleQuickAction(action)}
                    className="text-left text-sm px-4 py-2.5 rounded-xl border-2 bg-white hover:bg-blue-50 transition-all duration-150 font-medium"
                    style={{ borderColor: clientConfig.primaryColor, color: clientConfig.primaryColor }}
                  >
                    {action}
                  </button>
                ))}
              </div>
            )}

            {/* Lead form */}
            {state === "lead_form" && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm mb-3">
                <p className="text-sm font-semibold text-gray-800 mb-3">Request an Appointment</p>
                <form onSubmit={handleLeadSubmit} className="space-y-2.5">
                  <input
                    type="text"
                    placeholder="Your full name *"
                    value={leadForm.name}
                    onChange={(e) => setLeadForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ "--tw-ring-color": clientConfig.primaryColor } as React.CSSProperties}
                  />
                  <input
                    type="tel"
                    placeholder="Phone number *"
                    value={leadForm.phone}
                    onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  />
                  <input
                    type="text"
                    placeholder="Preferred date (e.g. Mon afternoon)"
                    value={leadForm.date}
                    onChange={(e) => setLeadForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  />
                  {leadError && <p className="text-red-500 text-xs">{leadError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setState("idle")}
                      className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 text-sm text-white rounded-lg font-medium transition-opacity hover:opacity-90"
                      style={{ backgroundColor: clientConfig.primaryColor }}
                    >
                      Send Request
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Lead success */}
            {state === "lead_success" && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-green-800">Request Sent!</p>
                  <p className="text-xs text-green-600 mt-0.5">We'll be in touch shortly.</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Book shortcut */}
          {showBookBtn && state === "idle" && (
            <div className="px-4 pt-2 flex-shrink-0 bg-gray-50 border-t border-gray-100">
              <button
                onClick={() => setState("lead_form")}
                className="w-full py-2 text-sm font-medium rounded-lg border-2 transition-colors hover:opacity-90"
                style={{ borderColor: clientConfig.primaryColor, color: clientConfig.primaryColor, backgroundColor: clientConfig.secondaryColor }}
              >
                📅 Book an Appointment
              </button>
            </div>
          )}

          {/* Input */}
          <div className="px-3 py-3 bg-white border-t border-gray-100 flex-shrink-0">
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                disabled={state === "loading" || state === "lead_form" || state === "lead_success"}
                className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || state === "loading"}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all disabled:opacity-40 hover:scale-105 flex-shrink-0"
                style={{ backgroundColor: clientConfig.primaryColor }}
                aria-label="Send"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
        style={{
          backgroundColor: clientConfig.primaryColor,
          boxShadow: `0 0 0 0 ${clientConfig.primaryColor}66`,
          animation: !isOpen ? "chatPulse 2s ease-in-out infinite" : undefined,
        }}
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        <span className="text-2xl leading-none select-none transition-all duration-200">
          {isOpen ? (
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            "💬"
          )}
        </span>
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
            {unreadCount}
          </span>
        )}
      </button>

      <style>{`
        @keyframes chatPulse {
          0% { box-shadow: 0 0 0 0 ${clientConfig.primaryColor}66; }
          70% { box-shadow: 0 0 0 12px ${clientConfig.primaryColor}00; }
          100% { box-shadow: 0 0 0 0 ${clientConfig.primaryColor}00; }
        }
      `}</style>
    </>
  );
}

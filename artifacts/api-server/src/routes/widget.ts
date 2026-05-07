import { Router } from "express";
import { db, botsTable, conversationsTable, bookingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getSettingsForUser } from "./admin";

const router = Router();

// ── In-memory rate limiter ─────────────────────────────────────────────────
interface RateEntry { count: number; resetAt: number }
const rateLimitStore = new Map<string, RateEntry>();

function checkRateLimit(key: string, maxReqs: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxReqs) return false;
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

// ── Domain whitelist helper ────────────────────────────────────────────────
function extractDomain(url: string): string {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return url.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0]; }
}

function isDomainAllowed(allowedDomains: string[], req: import("express").Request): boolean {
  if (!allowedDomains || allowedDomains.length === 0) return true;
  const origin = req.headers["origin"] as string | undefined;
  const referer = req.headers["referer"] as string | undefined;
  const source = origin || referer;
  if (!source) return true;
  const requestDomain = extractDomain(source);
  return allowedDomains.some((d) => {
    const allowed = d.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
    return requestDomain === allowed || requestDomain.endsWith(`.${allowed}`);
  });
}

// ── AI provider call ───────────────────────────────────────────────────────
async function callAI(
  provider: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<string> {
  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 1000, system: systemPrompt, messages }),
    });
    if (!res.ok) throw new Error(`Anthropic error: ${await res.text()}`);
    const data = (await res.json()) as { content: { text: string }[] };
    return data.content[0]?.text ?? "";
  }
  if (provider === "openai" || provider === "openrouter") {
    const url = provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...(provider === "openrouter" ? { "HTTP-Referer": "https://botbuilder.app" } : {}) },
      body: JSON.stringify({ model, max_tokens: 1000, messages: [{ role: "system", content: systemPrompt }, ...messages] }),
    });
    if (!res.ok) throw new Error(`${provider} error: ${await res.text()}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content ?? "";
  }
  if (provider === "gemini") {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      }),
    });
    if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
    const data = (await res.json()) as { candidates: { content: { parts: { text: string }[] } }[] };
    return data.candidates[0]?.content?.parts[0]?.text ?? "";
  }
  throw new Error(`Unknown provider: ${provider}`);
}

// ── Widget config ──────────────────────────────────────────────────────────
router.get("/widget/:publicId/config", async (req, res) => {
  try {
    const [bot] = await db.select().from(botsTable).where(eq(botsTable.publicId, req.params.publicId)).limit(1);
    if (!bot || !bot.isActive) { res.status(404).json({ message: "Bot not found" }); return; }

    const settings = await getSettingsForUser(bot.userId);
    if (settings.domainWhitelistEnabled && !isDomainAllowed(bot.allowedDomains, req)) {
      res.status(403).json({ message: "Domain not allowed" }); return;
    }

    res.json({
      name: bot.appearance.botName || bot.name,
      primaryColor: bot.appearance.primaryColor,
      welcomeMessage: bot.appearance.welcomeMessage,
      fallbackMessage: bot.appearance.fallbackMessage,
      quickActions: bot.appearance.quickActions ?? [],
      avatarText: bot.appearance.avatarText || (bot.appearance.botName || bot.name)[0],
      businessType: bot.appearance.businessType,
      services: bot.appearance.services ?? [],
      bookingConfirmationMessage: bot.appearance.bookingConfirmationMessage || "",
      soundEnabled: bot.appearance.soundEnabled ?? false,
      officeHours: bot.appearance.officeHours || "",
      showBranding: bot.appearance.showBranding !== false,
      brandingText: bot.appearance.brandingText || "",
      brandingUrl: bot.appearance.brandingUrl || "",
      proactiveGreetingDelay: bot.appearance.proactiveGreetingDelay ?? 0,
    });
  } catch { res.status(500).json({ message: "Internal server error" }); }
});

// ── Widget chat ────────────────────────────────────────────────────────────
router.post("/widget/:publicId/chat", async (req, res) => {
  try {
    const [bot] = await db.select().from(botsTable).where(eq(botsTable.publicId, req.params.publicId)).limit(1);
    if (!bot || !bot.isActive) { res.status(404).json({ message: "Bot not found" }); return; }
    if (!bot.apiKey) { res.status(400).json({ message: "Bot not configured" }); return; }

    const settings = await getSettingsForUser(bot.userId);

    // Domain check (only when globally enabled)
    if (settings.domainWhitelistEnabled && !isDomainAllowed(bot.allowedDomains, req)) {
      res.status(403).json({ message: "Domain not allowed" }); return;
    }

    // Rate limit (only when enabled)
    if (settings.rateLimitEnabled) {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
      if (!checkRateLimit(`chat:${ip}`, settings.rateLimitChat, 60_000)) {
        res.status(429).json({ message: "Too many messages. Please slow down." }); return;
      }
    }

    const { messages, sessionId } = req.body as { messages: { role: string; content: string }[]; sessionId?: string };
    if (!Array.isArray(messages) || messages.length === 0) { res.status(400).json({ message: "Messages are required" }); return; }

    const reply = await callAI(bot.provider, bot.model, bot.apiKey, bot.systemPrompt, messages);

    // Persist conversation asynchronously
    if (sessionId) {
      const fullMessages = [...messages, { role: "assistant", content: reply }];
      (async () => {
        try {
          const existing = await db.select({ id: conversationsTable.id }).from(conversationsTable).where(and(eq(conversationsTable.botId, bot.id), eq(conversationsTable.sessionId, sessionId))).limit(1);
          if (existing.length > 0) {
            await db.update(conversationsTable).set({ messageCount: sql`${conversationsTable.messageCount} + 1`, messages: sql`${JSON.stringify(fullMessages)}::jsonb`, updatedAt: new Date() }).where(eq(conversationsTable.id, existing[0].id));
          } else {
            await db.insert(conversationsTable).values({ botId: bot.id, sessionId, messageCount: 1, messages: fullMessages as { role: "user" | "assistant"; content: string }[] });
          }
        } catch { /* silently fail */ }
      })();
    }

    res.json({ message: reply });
  } catch (err) {
    req.log.error({ err }, "widget chat error");
    const raw = err instanceof Error ? err.message : "";
    let msg = "Sorry, I'm having trouble responding. Please try again.";
    if (raw.includes("429") || /rate.?limit/i.test(raw)) msg = "This model is temporarily rate limited — please try again shortly.";
    else if (raw.includes("401") || /invalid.{0,20}key/i.test(raw)) msg = "There's an issue with the API key. Please ask the site owner to check their settings.";
    else if (raw.includes("404") || /not found/i.test(raw)) msg = "The configured AI model is unavailable. Please ask the site owner to update the model.";
    res.status(500).json({ message: msg });
  }
});

// ── Widget booking ─────────────────────────────────────────────────────────
router.post("/widget/:publicId/booking", async (req, res) => {
  try {
    const [bot] = await db.select().from(botsTable).where(eq(botsTable.publicId, req.params.publicId)).limit(1);
    if (!bot || !bot.isActive) { res.status(404).json({ message: "Bot not found" }); return; }

    const settings = await getSettingsForUser(bot.userId);

    if (settings.domainWhitelistEnabled && !isDomainAllowed(bot.allowedDomains, req)) {
      res.status(403).json({ message: "Domain not allowed" }); return;
    }

    if (settings.rateLimitEnabled) {
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
      if (!checkRateLimit(`booking:${ip}`, settings.rateLimitBooking, 60_000)) {
        res.status(429).json({ message: "Too many requests. Please slow down." }); return;
      }
    }

    const { sessionId, name, phone, service, date, timePreference, email: customerEmail } = req.body as { sessionId?: string; name: string; phone: string; service: string; date: string; timePreference: string; email?: string };
    const [booking] = await db.insert(bookingsTable).values({ botId: bot.id, sessionId: sessionId ?? "", name, phone, service, date, timePreference }).returning();

    const nc = bot.notificationsConfig;
    const businessName = bot.appearance.botName || bot.name;
    const ownerEmail = bot.appearance.ownerEmail;

    // Global credentials from env vars
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFromEmail = process.env.RESEND_FROM_EMAIL || nc?.resendFromEmail || "bookings@cluvi.app";
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFromPhone = process.env.TWILIO_FROM_PHONE;
    const twilioWhatsappFrom = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

    (async () => {
      // ── Owner email via Resend (global key) ───────────────────
      if (nc?.resendEnabled && resendApiKey && ownerEmail) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
            body: JSON.stringify({
              from: resendFromEmail,
              to: [ownerEmail],
              subject: `New Booking — ${businessName}`,
              html: `<h2>New Booking</h2><p><b>Name:</b> ${name}</p><p><b>Phone:</b> ${phone}</p><p><b>Service:</b> ${service}</p><p><b>Date:</b> ${date}</p><p><b>Time:</b> ${timePreference}</p>`
            })
          });
        } catch { /* ignore */ }
      }

      // ── Customer confirmation email via Resend ─────────────────
      if (nc?.resendEnabled && resendApiKey && customerEmail) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
            body: JSON.stringify({
              from: resendFromEmail,
              to: [customerEmail],
              subject: `Your appointment at ${businessName} is confirmed!`,
              html: `<div style="font-family:sans-serif;max-width:500px"><h2>You're booked! 🎉</h2><p>Hi ${name}, thanks for booking with <b>${businessName}</b>.</p><table style="border-collapse:collapse;width:100%"><tr><td style="padding:6px 0;color:#555">Service:</td><td style="padding:6px 0;font-weight:600">${service}</td></tr><tr><td style="padding:6px 0;color:#555">Date:</td><td style="padding:6px 0;font-weight:600">${date}</td></tr><tr><td style="padding:6px 0;color:#555">Time:</td><td style="padding:6px 0;font-weight:600">${timePreference}</td></tr><tr><td style="padding:6px 0;color:#555">Phone:</td><td style="padding:6px 0;font-weight:600">${phone}</td></tr></table><p style="margin-top:16px">We'll call to confirm your appointment soon.</p><p>See you! — ${businessName} Team</p></div>`
            })
          });
        } catch { /* ignore */ }
      }

      // ── Owner SMS via Twilio (global credentials) ──────────────
      if (nc?.twilioEnabled && twilioAccountSid && twilioAuthToken && nc.twilioOwnerPhone) {
        try {
          const creds = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64");
          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${creds}` },
            body: new URLSearchParams({
              To: nc.twilioOwnerPhone,
              From: twilioFromPhone || nc.twilioOwnerPhone,
              Body: `New booking at ${businessName}: ${name} | ${phone} | ${service} | ${date} | ${timePreference}`
            }).toString()
          });
        } catch { /* ignore */ }
      }

      // ── Owner WhatsApp via Twilio ──────────────────────────────
      if (nc?.twilioWhatsappEnabled && twilioAccountSid && twilioAuthToken && nc.twilioWhatsappTo) {
        try {
          const creds = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64");
          await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${creds}` },
            body: new URLSearchParams({
              To: nc.twilioWhatsappTo,
              From: nc.twilioWhatsappFrom || twilioWhatsappFrom,
              Body: `🔔 New Booking at ${businessName}!\n\n👤 ${name}\n📞 ${phone}\n🛍️ ${service}\n📅 ${date} ${timePreference}`
            }).toString()
          });
        } catch { /* ignore */ }
      }

      // ── Telegram ───────────────────────────────────────────────
      if (nc?.telegramEnabled && nc.telegramBotToken && nc.telegramChatId) {
        try {
          await fetch(`https://api.telegram.org/bot${nc.telegramBotToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: nc.telegramChatId,
              text: `🔔 New Booking at ${businessName}!\n\n👤 Name: ${name}\n📞 Phone: ${phone}\n🛍️ Service: ${service}\n📅 Date: ${date}\n🕐 Time: ${timePreference}\n\nReply to confirm! ✅`,
              parse_mode: "HTML"
            })
          });
        } catch { /* ignore */ }
      }

      // ── Discord webhook ────────────────────────────────────────
      if (nc?.discordEnabled && nc.discordWebhookUrl) {
        try {
          await fetch(nc.discordWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: `${businessName} Bot`,
              embeds: [{
                title: "🔔 New Booking!",
                color: 3447003,
                fields: [
                  { name: "👤 Name", value: name, inline: true },
                  { name: "📞 Phone", value: phone, inline: true },
                  { name: "🛍️ Service", value: service, inline: true },
                  { name: "📅 Date", value: date, inline: true },
                  { name: "🕐 Time", value: timePreference, inline: true }
                ],
                footer: { text: "Powered by Cluvi" },
                timestamp: new Date().toISOString()
              }]
            })
          });
        } catch { /* ignore */ }
      }

      // ── Zapier / custom webhook ────────────────────────────────
      if (bot.leadWebhookUrl) {
        try {
          await fetch(bot.leadWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "booking", businessName, name, phone, service, date, timePreference })
          });
        } catch { /* ignore */ }
      }
    })();

    res.status(201).json({ ok: true, id: booking.id });
  } catch (err) {
    req.log.error({ err }, "create booking error");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Widget script ──────────────────────────────────────────────────────────
router.get("/widget.js", async (req, res) => {
  const botId = req.query.botId as string;
  if (!botId) { res.status(400).send("// Missing botId"); return; }

  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  const apiBase = `${proto}://${host}`;

  const css = `
#_cb_w*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0}
#_cb_w{position:fixed;bottom:24px;right:24px;z-index:2147483647;display:flex;flex-direction:column;align-items:flex-end;gap:12px}
#_cb_btn{width:58px;height:58px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 24px rgba(0,0,0,0.22),0 1px 6px rgba(0,0,0,0.12);transition:transform 0.25s cubic-bezier(.34,1.56,.64,1),box-shadow 0.2s;position:relative;outline:none}
#_cb_btn:hover{transform:scale(1.1);box-shadow:0 8px 32px rgba(0,0,0,0.26)}
#_cb_btn:active{transform:scale(0.96)}
#_cb_bdg{position:absolute;top:-3px;right:-3px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;border:2px solid white;padding:0 3px;letter-spacing:0;line-height:1}
#_cb_win{position:absolute;bottom:70px;right:0;width:360px;background:#fff;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.15),0 4px 16px rgba(0,0,0,0.08);display:flex;flex-direction:column;overflow:hidden;max-height:580px;border:1px solid rgba(0,0,0,0.06);opacity:0;transform:translateY(16px) scale(0.96);pointer-events:none;transition:opacity 0.22s ease,transform 0.22s cubic-bezier(.34,1.3,.64,1)}
#_cb_win._open{opacity:1;transform:translateY(0) scale(1);pointer-events:all}
#_cb_head{padding:14px 16px;display:flex;align-items:center;gap:11px;flex-shrink:0;position:relative}
#_cb_head_av{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.22);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:15px;flex-shrink:0;border:2px solid rgba(255,255,255,0.3);box-shadow:0 2px 8px rgba(0,0,0,0.15)}
._cb_hname{font-weight:700;font-size:14px;color:#fff;line-height:1.2}
._cb_hstatus{font-size:11px;color:rgba(255,255,255,0.8);display:flex;align-items:center;gap:5px;margin-top:2px}
._cb_hdot{width:7px;height:7px;background:#4ade80;border-radius:50%;display:inline-block;box-shadow:0 0 0 2px rgba(74,222,128,0.3);animation:_cb_pulse_dot 2s ease-in-out infinite}
@keyframes _cb_pulse_dot{0%,100%{box-shadow:0 0 0 2px rgba(74,222,128,0.3)}50%{box-shadow:0 0 0 4px rgba(74,222,128,0.15)}}
#_cb_x{margin-left:auto;background:rgba(255,255,255,0.18);border:none;color:#fff;width:28px;height:28px;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s;flex-shrink:0;outline:none}
#_cb_x:hover{background:rgba(255,255,255,0.3)}
#_cb_msgs{flex:1;overflow-y:auto;padding:16px 14px 8px;background:#f8fafc;display:flex;flex-direction:column;gap:10px;min-height:220px;position:relative;scroll-behavior:smooth}
#_cb_msgs::-webkit-scrollbar{width:4px}
#_cb_msgs::-webkit-scrollbar-track{background:transparent}
#_cb_msgs::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:4px}
#_cb_ph{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#94a3b8;font-size:13px;text-align:center;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:8px;width:100%}
#_cb_ph svg{opacity:0.35}
#_cb_qa{display:flex;flex-wrap:wrap;gap:7px;padding:8px 14px 4px;background:#f8fafc;flex-shrink:0}
#_cb_foot{background:#fff;border-top:1px solid rgba(0,0,0,0.06);flex-shrink:0}
#_cb_form{display:flex;align-items:center;gap:9px;padding:11px 12px}
#_cb_inp{flex:1;border:1.5px solid #e2e8f0;border-radius:12px;padding:10px 14px;font-size:13px;color:#1e293b;outline:none;transition:border-color 0.15s,box-shadow 0.15s;background:#f8fafc;line-height:1.4}
#_cb_inp:focus{border-color:var(--cb-col,#6366f1);box-shadow:0 0 0 3px rgba(99,102,241,0.1);background:#fff}
#_cb_inp::placeholder{color:#94a3b8}
#_cb_snd{width:38px;height:38px;border-radius:11px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform 0.15s,opacity 0.15s;padding:0;outline:none}
#_cb_snd:hover{transform:scale(1.08)}
#_cb_snd:active{transform:scale(0.94)}
#_cb_snd:disabled{opacity:0.38;cursor:not-allowed;transform:none}
#_cb_snd svg{width:17px;height:17px;display:block}
#_cb_pw{text-align:center;padding:5px 0 10px;font-size:10.5px;color:#94a3b8;letter-spacing:0.01em}
#_cb_pw a{color:#94a3b8;text-decoration:none;font-weight:500}
#_cb_pw a:hover{color:#6366f1}
._cb_msg{display:flex;align-items:flex-end;gap:8px;animation:_cb_fadein 0.2s ease}
@keyframes _cb_fadein{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
._cb_msg._u{flex-direction:row-reverse}
._cb_mav{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;flex-shrink:0;box-shadow:0 2px 6px rgba(0,0,0,0.15)}
._cb_bub{max-width:230px;padding:9px 13px;border-radius:14px;font-size:13px;line-height:1.55;word-break:break-word;white-space:pre-wrap}
._cb_bot{background:#fff;color:#1e293b;border:1px solid #e8ecf0;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
._cb_user{color:#fff;border-bottom-right-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.12)}
._cb_dots_wrap{display:flex;align-items:flex-end;gap:8px;animation:_cb_fadein 0.2s ease}
._cb_dots{display:flex;gap:5px;padding:12px 14px;background:#fff;border:1px solid #e8ecf0;border-radius:14px;border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
._cb_dots span{width:7px;height:7px;background:#cbd5e1;border-radius:50%;animation:_cb_blink 1.3s ease-in-out infinite}
._cb_dots span:nth-child(2){animation-delay:0.18s}
._cb_dots span:nth-child(3){animation-delay:0.36s}
@keyframes _cb_blink{0%,60%,100%{transform:translateY(0);opacity:0.4}30%{transform:translateY(-4px);opacity:1}}
._cb_qbtn{padding:8px 15px;border-radius:20px;border:1.5px solid;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.15s;background:transparent;letter-spacing:0.01em}
._cb_qbtn:hover{transform:translateY(-1px);box-shadow:0 3px 10px rgba(0,0,0,0.1)}
._cb_qbtn:active{transform:translateY(0)}
._cb_wr{display:flex;flex-wrap:wrap;gap:7px;padding:8px 14px}
._cb_ts{font-size:10px;color:#94a3b8;margin-top:3px;padding:0 4px}
._cb_msg._u ._cb_ts{text-align:right}
._cb_section_lbl{text-align:center;font-size:10px;color:#94a3b8;letter-spacing:0.05em;text-transform:uppercase;font-weight:600;padding:4px 0 2px}
`.replace(/\n/g, "");

  const js = `
(function() {
  var BOT_ID = ${JSON.stringify(botId)};
  var API_BASE = ${JSON.stringify(apiBase)};
  var SESSION_ID = 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  var cfg = null;
  var msgs = [];
  var isOpen = false;
  var loading = false;
  var initialized = false;
  var msgCount = 0;
  var MAX_MSGS = 50;
  var booking = null;
  var proactiveTimer = null;

  function hexToRgb(h){var r=/^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(h);return r?parseInt(r[1],16)+','+parseInt(r[2],16)+','+parseInt(r[3],16):'99,102,241';}
  function apiFetch(path,opts){return fetch(API_BASE+path,Object.assign({headers:{'Content-Type':'application/json'}},opts||{})).then(function(r){return r.json();});}
  function playSound(){if(!cfg||!cfg.soundEnabled)return;try{var ctx=new(window.AudioContext||window.webkitAudioContext)();var o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=880;o.type='sine';g.gain.setValueAtTime(0,ctx.currentTime);g.gain.linearRampToValueAtTime(0.06,ctx.currentTime+0.01);g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.3);o.start();o.stop(ctx.currentTime+0.3);}catch(e){}}
  function fmtTime(){var d=new Date();var h=d.getHours(),m=d.getMinutes();return (h%12||12)+':'+(m<10?'0':'')+m+(h<12?' AM':' PM');}
  function col(){return (cfg&&cfg.primaryColor)||'#6366f1';}
  function letter(){return ((cfg&&cfg.avatarText)||(cfg&&cfg.name&&cfg.name[0])||'B').charAt(0).toUpperCase();}
  function adjustColor(hex,pct){var n=parseInt(hex.replace('#',''),16);var r=Math.min(255,Math.max(0,((n>>16)&0xff)+pct));var g=Math.min(255,Math.max(0,((n>>8)&0xff)+pct));var b=Math.min(255,Math.max(0,(n&0xff)+pct));return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);}

  /* ── Markdown renderer ──────────────────────────────────────── */
  function renderMd(text){
    var s=text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\\*\\*([^*]+)\\*\\*/g,'<strong>$1</strong>')
      .replace(/\\*([^*]+)\\*/g,'<em>$1</em>')
      .replace(new RegExp('\x60([^\x60]+)\x60','g'),'<code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:12px;font-family:monospace">$1</code>')
      .replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^)]+)\\)/g,'<a href="$2" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;text-underline-offset:2px">$1</a>')
      .replace(/^#{1,3}\\s(.+)$/gm,'<strong>$1</strong>')
      .replace(/^[-*]\\s(.+)$/gm,'<span style="display:block;padding-left:12px">&#x2022; $1</span>')
      .replace(/^\\d+\\.\\s(.+)$/gm,'<span style="display:block;padding-left:12px">$1</span>')
      .replace(/\\n/g,'<br>');
    return s;
  }

  var style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.head.appendChild(style);
  var wrap=document.createElement('div');wrap.id='_cb_w';
  wrap.innerHTML=''
    +'<div id="_cb_win" role="dialog" aria-label="Chat with us">'
      +'<div id="_cb_head"></div>'
      +'<div id="_cb_msgs" aria-live="polite">'
        +'<div id="_cb_ph">'
          +'<svg width="36" height="36" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3v-3z"/></svg>'
          +'<span>Send us a message!</span>'
        +'</div>'
      +'</div>'
      +'<div id="_cb_qa"></div>'
      +'<div id="_cb_foot">'
        +'<div id="_cb_form">'
          +'<button id="_cb_att" aria-label="Attach image" title="Attach image" style="flex-shrink:0;border:none;background:transparent;cursor:pointer;padding:4px;display:flex;align-items:center;color:#94a3b8;transition:color 0.15s">'
            +'<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>'
          +'</button>'
          +'<input id="_cb_file" type="file" accept="image/*" style="display:none"/>'
          +'<input id="_cb_inp" type="text" placeholder="Type a message\u2026" aria-label="Your message" maxlength="1000"/>'
          +'<button id="_cb_snd" aria-label="Send message">'
            +'<svg fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'
          +'</button>'
        +'</div>'
        +'<div id="_cb_pw" style="display:none">Powered by <a id="_cb_pw_a" href="https://botbuilder.app" target="_blank" rel="noopener">BotBuilder</a></div>'
      +'</div>'
    +'</div>'
    +'<button id="_cb_btn" aria-label="Open chat" aria-expanded="false">'
      +'<span id="_cb_bdg">1</span>'
      +'<svg id="_cb_ico_chat" width="24" height="24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>'
      +'<svg id="_cb_ico_close" width="20" height="20" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" viewBox="0 0 24 24" style="display:none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
    +'</button>';
  document.body.appendChild(wrap);

  var btn=document.getElementById('_cb_btn'),
      bdg=document.getElementById('_cb_bdg'),
      win=document.getElementById('_cb_win'),
      msgs_el=document.getElementById('_cb_msgs'),
      qa_el=document.getElementById('_cb_qa'),
      inp=document.getElementById('_cb_inp'),
      snd=document.getElementById('_cb_snd'),
      att=document.getElementById('_cb_att'),
      fileEl=document.getElementById('_cb_file'),
      head=document.getElementById('_cb_head'),
      pw_el=document.getElementById('_cb_pw'),
      pw_a=document.getElementById('_cb_pw_a'),
      ico_chat=document.getElementById('_cb_ico_chat'),
      ico_close=document.getElementById('_cb_ico_close');

  function setTheme(c){
    document.documentElement.style.setProperty('--cb-col',c);
    btn.style.backgroundColor=c;
    snd.style.backgroundColor=c;
    head.style.background='linear-gradient(135deg,'+c+' 0%,'+adjustColor(c,-22)+' 100%)';
  }

  function buildHead(){
    head.innerHTML=''
      +'<div id="_cb_head_av" style="background:rgba(255,255,255,0.2)">'+letter()+'</div>'
      +'<div><div class="_cb_hname">'+(cfg.name||'Assistant')+'</div>'
      +'<div class="_cb_hstatus"><span class="_cb_hdot"></span>Online now</div></div>'
      +'<button id="_cb_x" onclick="window._cbToggle()" aria-label="Close chat">'
      +'<svg width="14" height="14" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
      +'</button>';
  }

  function buildBranding(){
    if(cfg.showBranding!==false){
      pw_el.style.display='block';
      var label=cfg.brandingText||'BotBuilder';
      var url=cfg.brandingUrl||'https://botbuilder.app';
      pw_a.textContent=label;
      pw_a.href=url;
    }
  }

  function scheduleProactive(){
    var delay=(cfg.proactiveGreetingDelay||0)*1000;
    if(delay<=0||isOpen||initialized)return;
    proactiveTimer=setTimeout(function(){
      if(!isOpen&&!initialized){
        window._cbToggle();
      }
    },delay);
  }

  function initConfig(){
    apiFetch('/api/widget/'+BOT_ID+'/config').then(function(c){
      if(c.message){return;}
      cfg=c;
      setTheme(col());
      buildHead();
      buildBranding();
      hidePh();
      addMsg('assistant',cfg.welcomeMessage||'Hi! How can I help you today?');
      if(cfg.quickActions&&cfg.quickActions.length)renderQA(cfg.quickActions);
      scheduleProactive();
    }).catch(function(){
      head.innerHTML='<div style="color:white;font-weight:600;padding:4px">Chat Assistant</div>';
    });
  }

  function hidePh(){var ph=document.getElementById('_cb_ph');if(ph)ph.style.display='none';}

  function renderQA(actions){
    qa_el.innerHTML='';
    var c=col();var rgb=hexToRgb(c);
    actions.forEach(function(qa){
      var b=document.createElement('button');
      b.className='_cb_qbtn';b.textContent=qa;
      b.style.borderColor='rgba('+rgb+',0.4)';b.style.color=c;
      b.onclick=function(){
        qa_el.innerHTML='';
        var low=qa.toLowerCase();
        if(low.indexOf('book')>=0||low.indexOf('appoint')>=0||low.indexOf('schedul')>=0)startBooking();
        else send(qa);
      };
      qa_el.appendChild(b);
    });
  }

  function addMsg(role,text,isHtml){
    hidePh();
    var c=col();
    var d=document.createElement('div');
    d.className='_cb_msg'+(role==='user'?' _u':'');
    var inner='';
    if(role==='assistant'){inner+='<div class="_cb_mav" style="background:'+c+'">'+letter()+'</div>';}
    inner+='<div>';
    var bubbleContent=isHtml?text:renderMd(text);
    inner+='<div class="_cb_bub '+(role==='user'?'_cb_user':'_cb_bot')
      +'"'+(role==='user'?' style="background:'+c+'"':'')+'>'+bubbleContent+'</div>';
    inner+='<div class="_cb_ts">'+fmtTime()+'</div>';
    inner+='</div>';
    d.innerHTML=inner;
    msgs_el.appendChild(d);
    setTimeout(function(){msgs_el.scrollTop=msgs_el.scrollHeight;},30);
  }

  function addImageMsg(role,src,filename){
    hidePh();
    var c=col();
    var d=document.createElement('div');
    d.className='_cb_msg'+(role==='user'?' _u':'');
    var inner='';
    if(role==='assistant'){inner+='<div class="_cb_mav" style="background:'+c+'">'+letter()+'</div>';}
    inner+='<div>';
    inner+='<div class="_cb_bub '+(role==='user'?'_cb_user':'_cb_bot')+'"'
      +(role==='user'?' style="background:'+c+';padding:6px"':' style="padding:6px"')+'>'
      +'<img src="'+src+'" alt="'+(filename||'image')+'" style="max-width:180px;max-height:160px;border-radius:8px;display:block;cursor:pointer" onclick="window.open(this.src)">'
      +'<span style="display:block;font-size:10px;opacity:0.7;margin-top:4px;text-align:center">'+(filename||'image')+'</span>'
      +'</div>';
    inner+='<div class="_cb_ts">'+fmtTime()+'</div>';
    inner+='</div>';
    d.innerHTML=inner;
    msgs_el.appendChild(d);
    setTimeout(function(){msgs_el.scrollTop=msgs_el.scrollHeight;},30);
  }

  function showTyping(){
    var c=col();
    var d=document.createElement('div');
    d.id='_cb_typing';d.className='_cb_dots_wrap';
    d.innerHTML='<div class="_cb_mav" style="background:'+c+'">'+letter()+'</div>'
      +'<div class="_cb_dots"><span></span><span></span><span></span></div>';
    msgs_el.appendChild(d);
    setTimeout(function(){msgs_el.scrollTop=msgs_el.scrollHeight;},30);
  }

  function hideTyping(){var t=document.getElementById('_cb_typing');if(t)t.remove();}
  function setInputDisabled(v){inp.disabled=v;snd.disabled=v;att.disabled=v;}

  function sendToAI(attempt){
    attempt=attempt||1;
    loading=true;
    setInputDisabled(true);
    showTyping();
    var delay=400+Math.random()*600;
    apiFetch('/api/widget/'+BOT_ID+'/chat',{method:'POST',body:JSON.stringify({messages:msgs,sessionId:SESSION_ID})})
      .then(function(d){
        setTimeout(function(){
          hideTyping();
          var r=d.message||((cfg&&cfg.fallbackMessage)||'Sorry, something went wrong.');
          msgs.push({role:'assistant',content:r});
          addMsg('assistant',r);
          playSound();
          loading=false;
          setInputDisabled(false);
          inp.focus();
        },delay);
      })
      .catch(function(){
        if(attempt<2){
          hideTyping();loading=false;setInputDisabled(false);
          setTimeout(function(){sendToAI(2);},1200);
        } else {
          setTimeout(function(){
            hideTyping();
            var fb=(cfg&&cfg.fallbackMessage)||'Sorry, please try again later.';
            msgs.push({role:'assistant',content:fb});
            addMsg('assistant',fb);
            loading=false;setInputDisabled(false);
          },delay);
        }
      });
  }

  function send(text){
    if(!text||!text.trim()||loading)return;
    if(msgCount>=MAX_MSGS){addMsg('assistant','Message limit reached. Please refresh to continue.');return;}
    if(booking!==null){
      addMsg('user',text.trim());msgCount++;
      handleBookingInput(text.trim());inp.value='';return;
    }
    qa_el.innerHTML='';msgCount++;
    msgs.push({role:'user',content:text.trim()});
    addMsg('user',text.trim());inp.value='';
    var low=text.toLowerCase();
    if(low.indexOf('book')>=0||low.indexOf('appointment')>=0||low.indexOf('schedule')>=0){startBooking();return;}
    sendToAI();
  }

  /* ── Image upload ──────────────────────────────────────────── */
  att.onclick=function(){fileEl.click();};
  att.onmouseenter=function(){att.style.color=col();};
  att.onmouseleave=function(){att.style.color='#94a3b8';};
  fileEl.onchange=function(){
    var file=fileEl.files&&fileEl.files[0];
    if(!file)return;
    if(file.size>5*1024*1024){addMsg('assistant','Please attach images smaller than 5 MB.');fileEl.value='';return;}
    var reader=new FileReader();
    reader.onload=function(e){
      var dataUrl=e.target.result;
      addImageMsg('user',dataUrl,file.name);
      msgCount++;
      var textNote='[User attached image: '+file.name+']';
      msgs.push({role:'user',content:textNote});
      fileEl.value='';
      if(!loading)sendToAI();
    };
    reader.readAsDataURL(file);
  };

  /* ── Booking flow ──────────────────────────────────────────── */
  function startBooking(){
    booking={step:'name',name:'',phone:'',service:'',date:'',time:'',email:''};
    qa_el.innerHTML='';
    setTimeout(function(){addMsg('assistant','I\\'d love to book an appointment for you!\\nFirst, what\\'s your name?');},350);
  }

  function handleBookingInput(text){
    if(!booking)return;
    if(booking.step==='name'){
      booking.name=text;booking.step='phone';
      setTimeout(function(){addMsg('assistant','Nice to meet you, **'+text+'**! What\\'s the best phone number to reach you?');},350);
    } else if(booking.step==='phone'){
      booking.phone=text;booking.step='service';
      var svcs=(cfg&&cfg.services&&cfg.services.length)?cfg.services:[];
      setTimeout(function(){
        addMsg('assistant','Got it! What service are you looking for?');
        if(svcs.length>0)showServiceBtns(svcs);
      },350);
    } else if(booking.step==='service'){
      booking.service=text;booking.step='date';
      setTimeout(function(){addMsg('assistant','Great choice! What date works for you?');showDatePicker();},350);
    } else if(booking.step==='date'){
      booking.date=text;booking.step='time';
      setTimeout(function(){addMsg('assistant','Almost done! Do you prefer morning or afternoon?');showTimeBtns();},350);
    } else if(booking.step==='time'){
      booking.time=text;booking.step='email';
      setTimeout(function(){addMsg('assistant','Last thing — would you like a confirmation email? If yes, enter your email address. Otherwise tap Skip.');showEmailInput();},350);
    } else if(booking.step==='email'){
      booking.email=text==='skip'?'':text;booking.step='confirm';
      setTimeout(function(){showSummary();},350);
    }
  }

  function showServiceBtns(svcs){
    var c=col();var rgb=hexToRgb(c);
    var cont=document.createElement('div');cont.className='_cb_wr';
    svcs.forEach(function(s){
      var b=document.createElement('button');b.className='_cb_qbtn';
      b.textContent=s;b.style.borderColor='rgba('+rgb+',0.4)';b.style.color=c;
      b.onclick=function(){
        cont.remove();addMsg('user',s);
        booking.service=s;booking.step='date';
        setTimeout(function(){addMsg('assistant','Great choice! What date works for you?');showDatePicker();},350);
      };
      cont.appendChild(b);
    });
    msgs_el.appendChild(cont);
    setTimeout(function(){msgs_el.scrollTop=msgs_el.scrollHeight;},30);
  }

  function showDatePicker(){
    var c=col();var today=new Date().toISOString().split('T')[0];
    var cont=document.createElement('div');cont.className='_cb_wr';cont.style.alignItems='center';
    var di=document.createElement('input');di.type='date';di.min=today;
    di.style.cssText='border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:13px;color:#1e293b;outline:none;cursor:pointer;background:#fff;flex:1;min-width:0';
    var pb=document.createElement('button');pb.textContent='Confirm';
    pb.style.cssText='background:'+c+';color:white;border:none;border-radius:10px;padding:8px 16px;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0';
    pb.onclick=function(){
      if(!di.value)return;
      var d=new Date(di.value+'T12:00:00');
      var fmt=d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
      cont.remove();addMsg('user',fmt);
      booking.date=di.value;booking.step='time';
      setTimeout(function(){addMsg('assistant','Almost done! Do you prefer morning or afternoon?');showTimeBtns();},350);
    };
    cont.appendChild(di);cont.appendChild(pb);
    msgs_el.appendChild(cont);
    setTimeout(function(){msgs_el.scrollTop=msgs_el.scrollHeight;},30);
  }

  function showTimeBtns(){
    var c=col();var rgb=hexToRgb(c);
    var cont=document.createElement('div');cont.className='_cb_wr';
    [['Morning','\u2600\ufe0f Morning'],['Afternoon','\uD83C\uDF24\uFE0F Afternoon'],['Evening','\uD83C\uDF19 Evening']].forEach(function(t){
      var b=document.createElement('button');b.className='_cb_qbtn';
      b.textContent=t[1];b.style.borderColor='rgba('+rgb+',0.4)';b.style.color=c;
      b.onclick=function(){
        cont.remove();addMsg('user',t[0]);
        booking.time=t[0];booking.step='confirm';
        setTimeout(function(){showSummary();},350);
      };
      cont.appendChild(b);
    });
    msgs_el.appendChild(cont);
    setTimeout(function(){msgs_el.scrollTop=msgs_el.scrollHeight;},30);
  }

  function showEmailInput(){
    var c=col();var rgb=hexToRgb(c);
    var cont=document.createElement('div');cont.className='_cb_wr';cont.style.alignItems='center';
    var ei=document.createElement('input');ei.type='email';ei.placeholder='your@email.com';
    ei.style.cssText='border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:13px;color:#1e293b;outline:none;background:#fff;flex:1;min-width:0';
    var sb=document.createElement('button');sb.textContent='Skip';
    sb.style.cssText='background:#f1f5f9;color:#64748b;border:none;border-radius:10px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0';
    var pb=document.createElement('button');pb.textContent='Send';
    pb.style.cssText='background:'+c+';color:white;border:none;border-radius:10px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0';
    sb.onclick=function(){cont.remove();addMsg('user','Skip');booking.email='';booking.step='confirm';setTimeout(function(){showSummary();},350);};
    pb.onclick=function(){
      if(!ei.value||!ei.value.includes('@')){ei.style.borderColor='#ef4444';return;}
      cont.remove();addMsg('user',ei.value);
      booking.email=ei.value;booking.step='confirm';setTimeout(function(){showSummary();},350);
    };
    cont.appendChild(ei);cont.appendChild(sb);cont.appendChild(pb);
    msgs_el.appendChild(cont);
    setTimeout(function(){msgs_el.scrollTop=msgs_el.scrollHeight;ei.focus();},30);
  }

  function showSummary(){
    var c=col();
    var d=new Date(booking.date+'T12:00:00');
    var ds=d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
    var emailLine=booking.email?'\\n\uD83D\uDCE7 '+booking.email:'';
    addMsg('assistant','\uD83D\uDCCB **Booking Summary**\\n\\n\uD83D\uDC64 '+booking.name+'\\n\uD83D\uDCDE '+booking.phone+'\\n\u2699\uFE0F '+booking.service+'\\n\uD83D\uDCC5 '+ds+'\\n\uD83D\uDD50 '+booking.time+emailLine);
    var cont=document.createElement('div');cont.className='_cb_wr';
    var cfm=document.createElement('button');cfm.className='_cb_qbtn';
    cfm.textContent='\u2713 Confirm Booking';
    cfm.style.cssText='background:'+c+';color:white;border-color:'+c+';font-weight:700';
    cfm.onclick=function(){cont.remove();addMsg('user','Confirm');confirmBooking();};
    var can=document.createElement('button');can.className='_cb_qbtn';
    can.textContent='\u2715 Cancel';can.style.borderColor='rgba(239,68,68,0.4)';can.style.color='#ef4444';
    can.onclick=function(){cont.remove();booking=null;addMsg('assistant','No problem! Anything else I can help with?');};
    cont.appendChild(cfm);cont.appendChild(can);
    msgs_el.appendChild(cont);
    setTimeout(function(){msgs_el.scrollTop=msgs_el.scrollHeight;},30);
  }

  function confirmBooking(){
    apiFetch('/api/widget/'+BOT_ID+'/booking',{
      method:'POST',
      body:JSON.stringify({sessionId:SESSION_ID,name:booking.name,phone:booking.phone,service:booking.service,date:booking.date,timePreference:booking.time,email:booking.email||undefined})
    }).then(function(){
      var msg=(cfg&&cfg.bookingConfirmationMessage)||'Your appointment is confirmed! We\\'ll be in touch shortly. \uD83C\uDF89';
      addMsg('assistant',msg);booking=null;playSound();
    }).catch(function(){
      addMsg('assistant','Oops, something went wrong. Please call us directly to schedule.');booking=null;
    });
  }

  /* ── Toggle ────────────────────────────────────────────────── */
  window._cbToggle=function(){
    isOpen=!isOpen;
    if(isOpen){
      if(proactiveTimer){clearTimeout(proactiveTimer);proactiveTimer=null;}
      win.classList.add('_open');
      btn.setAttribute('aria-expanded','true');
      bdg.style.display='none';
      ico_chat.style.display='none';
      ico_close.style.display='block';
      setTimeout(function(){inp.focus();},240);
      if(!initialized){initialized=true;initConfig();}
    } else {
      win.classList.remove('_open');
      btn.setAttribute('aria-expanded','false');
      ico_chat.style.display='block';
      ico_close.style.display='none';
    }
  };

  btn.onclick=window._cbToggle;
  snd.onclick=function(){send(inp.value);};
  inp.onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(inp.value);}};

  /* ── Boot: schedule proactive only after config is known ───── */
  /* We prime the config fetch here so proactive timing is accurate */
  apiFetch('/api/widget/'+BOT_ID+'/config').then(function(c){
    if(c.message||isOpen||initialized)return;
    cfg=c;
    var delay=(cfg.proactiveGreetingDelay||0)*1000;
    if(delay>0){
      proactiveTimer=setTimeout(function(){
        if(!isOpen&&!initialized){window._cbToggle();}
      },delay);
    }
    setTheme(col());
  }).catch(function(){});

  setTheme('#6366f1');
})();`;

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.send(js);
});

export default router;

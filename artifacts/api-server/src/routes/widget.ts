import { Router } from "express";
import { db, botsTable, conversationsTable, bookingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

// ── Simple in-memory rate limiter ──────────────────────────────────────────
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

// Clean up old rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

// ── Domain whitelist helper ────────────────────────────────────────────────
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch { return url.toLowerCase().replace(/^www\./, ""); }
}

function isDomainAllowed(allowedDomains: string[], req: import("express").Request): boolean {
  if (!allowedDomains || allowedDomains.length === 0) return true;
  const origin = req.headers["origin"] as string | undefined;
  const referer = req.headers["referer"] as string | undefined;
  const source = origin || referer;
  if (!source) return true; // server-side or curl — allow
  const requestDomain = extractDomain(source);
  return allowedDomains.some((d) => {
    const allowed = d.toLowerCase().replace(/^www\./, "").replace(/^https?:\/\//, "");
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
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: 1000, system: systemPrompt, messages }),
    });
    if (!res.ok) throw new Error(`Anthropic error: ${await res.text()}`);
    const data = (await res.json()) as { content: { text: string }[] };
    return data.content[0]?.text ?? "";
  }

  if (provider === "openai" || provider === "openrouter") {
    const url =
      provider === "openai"
        ? "https://api.openai.com/v1/chat/completions"
        : "https://openrouter.ai/api/v1/chat/completions";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(provider === "openrouter" ? { "HTTP-Referer": "https://botbuilder.app" } : {}),
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });
    if (!res.ok) throw new Error(`${provider} error: ${await res.text()}`);
    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content ?? "";
  }

  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
    const data = (await res.json()) as {
      candidates: { content: { parts: { text: string }[] } }[];
    };
    return data.candidates[0]?.content?.parts[0]?.text ?? "";
  }

  throw new Error(`Unknown provider: ${provider}`);
}

// ── Widget config ──────────────────────────────────────────────────────────
router.get("/widget/:publicId/config", async (req, res) => {
  try {
    const [bot] = await db
      .select()
      .from(botsTable)
      .where(eq(botsTable.publicId, req.params.publicId))
      .limit(1);

    if (!bot || !bot.isActive) {
      res.status(404).json({ message: "Bot not found" });
      return;
    }

    if (!isDomainAllowed(bot.allowedDomains, req)) {
      res.status(403).json({ message: "Domain not allowed" });
      return;
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
    });
  } catch {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Widget chat ────────────────────────────────────────────────────────────
router.post("/widget/:publicId/chat", async (req, res) => {
  // Rate limit: 30 requests per minute per IP
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  if (!checkRateLimit(`chat:${ip}`, 30, 60_000)) {
    res.status(429).json({ message: "Too many requests. Please slow down." });
    return;
  }

  try {
    const [bot] = await db
      .select()
      .from(botsTable)
      .where(eq(botsTable.publicId, req.params.publicId))
      .limit(1);

    if (!bot || !bot.isActive) {
      res.status(404).json({ message: "Bot not found" });
      return;
    }
    if (!bot.apiKey) {
      res.status(400).json({ message: "Bot not configured" });
      return;
    }
    if (!isDomainAllowed(bot.allowedDomains, req)) {
      res.status(403).json({ message: "Domain not allowed" });
      return;
    }

    const { messages, sessionId } = req.body as {
      messages: { role: string; content: string }[];
      sessionId?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ message: "Messages are required" });
      return;
    }

    const reply = await callAI(bot.provider, bot.model, bot.apiKey, bot.systemPrompt, messages);

    // Store conversation + messages asynchronously
    if (sessionId) {
      const fullMessages = [...messages, { role: "assistant", content: reply }];
      (async () => {
        try {
          const existing = await db
            .select({ id: conversationsTable.id })
            .from(conversationsTable)
            .where(
              and(
                eq(conversationsTable.botId, bot.id),
                eq(conversationsTable.sessionId, sessionId)
              )
            )
            .limit(1);
          if (existing.length > 0) {
            await db
              .update(conversationsTable)
              .set({
                messageCount: sql`${conversationsTable.messageCount} + 1`,
                messages: sql`${JSON.stringify(fullMessages)}::jsonb`,
                updatedAt: new Date(),
              })
              .where(eq(conversationsTable.id, existing[0].id));
          } else {
            await db.insert(conversationsTable).values({
              botId: bot.id,
              sessionId,
              messageCount: 1,
              messages: fullMessages as { role: "user" | "assistant"; content: string }[],
            });
          }
        } catch { /* silently fail */ }
      })();
    }

    res.json({ message: reply });
  } catch (err) {
    req.log.error({ err }, "widget chat error");
    const raw = err instanceof Error ? err.message : "";
    let userMessage = "Sorry, I'm having trouble responding right now. Please try again.";
    if (raw.includes("429") || /rate.?limit/i.test(raw) || /rate-limited/i.test(raw)) {
      userMessage = "This model is temporarily rate limited — please try again in a moment.";
    } else if (raw.includes("404") || /no endpoints/i.test(raw) || /not found/i.test(raw)) {
      userMessage = "The configured AI model is unavailable. Please ask the site owner to update the model.";
    } else if (raw.includes("401") || /invalid.{0,20}key/i.test(raw)) {
      userMessage = "There's an issue with the API key. Please ask the site owner to check their settings.";
    }
    res.status(500).json({ message: userMessage });
  }
});

// ── Widget booking ─────────────────────────────────────────────────────────
router.post("/widget/:publicId/booking", async (req, res) => {
  // Rate limit: 10 bookings per minute per IP
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  if (!checkRateLimit(`booking:${ip}`, 10, 60_000)) {
    res.status(429).json({ message: "Too many requests. Please slow down." });
    return;
  }

  try {
    const [bot] = await db
      .select()
      .from(botsTable)
      .where(eq(botsTable.publicId, req.params.publicId))
      .limit(1);

    if (!bot || !bot.isActive) {
      res.status(404).json({ message: "Bot not found" });
      return;
    }
    if (!isDomainAllowed(bot.allowedDomains, req)) {
      res.status(403).json({ message: "Domain not allowed" });
      return;
    }

    const { sessionId, name, phone, service, date, timePreference } = req.body as {
      sessionId?: string;
      name: string;
      phone: string;
      service: string;
      date: string;
      timePreference: string;
    };

    const [booking] = await db
      .insert(bookingsTable)
      .values({ botId: bot.id, sessionId: sessionId ?? "", name, phone, service, date, timePreference })
      .returning();

    const nc = bot.notificationsConfig;
    const businessName = bot.appearance.botName || bot.name;
    const ownerEmail = bot.appearance.ownerEmail;

    // Send notifications in background
    (async () => {
      // Resend email
      if (nc?.resendEnabled && nc.resendApiKey && ownerEmail) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${nc.resendApiKey}` },
            body: JSON.stringify({
              from: nc.resendFromEmail || "bookings@botbuilder.app",
              to: [ownerEmail],
              subject: `New Appointment Request — ${businessName}`,
              html: `<h2>New Booking from ${businessName}</h2>
<p><strong>Name:</strong> ${name}</p>
<p><strong>Phone:</strong> ${phone}</p>
<p><strong>Service:</strong> ${service}</p>
<p><strong>Date:</strong> ${date}</p>
<p><strong>Time:</strong> ${timePreference}</p>`,
            }),
          });
        } catch (e) { req.log.warn({ e }, "resend failed"); }
      }

      // Twilio SMS
      if (nc?.twilioEnabled && nc.twilioAccountSid && nc.twilioAuthToken && nc.twilioOwnerPhone) {
        try {
          const creds = Buffer.from(`${nc.twilioAccountSid}:${nc.twilioAuthToken}`).toString("base64");
          const from = (nc as unknown as Record<string, string>).twilioFromPhone || nc.twilioOwnerPhone;
          await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${nc.twilioAccountSid}/Messages.json`,
            {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${creds}` },
              body: new URLSearchParams({
                To: nc.twilioOwnerPhone,
                From: from,
                Body: `New booking at ${businessName}: ${name} | ${phone} | ${service} | ${date} | ${timePreference}`,
              }).toString(),
            }
          );
        } catch (e) { req.log.warn({ e }, "twilio failed"); }
      }

      // Zapier webhook
      if (bot.leadWebhookUrl && (!nc || nc.zapierEnabled !== false)) {
        try {
          await fetch(bot.leadWebhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "booking", businessName, name, phone, service, date, timePreference }),
          });
        } catch (e) { req.log.warn({ e }, "zapier failed"); }
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

  const css = '#_cb_w *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:0}#_cb_w{position:fixed;bottom:20px;right:20px;z-index:999999}#_cb_btn{width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,0.2);transition:transform 0.2s;position:relative}#_cb_btn:hover{transform:scale(1.08)}#_cb_bdg{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white}#_cb_win{position:absolute;bottom:70px;right:0;width:340px;background:#fff;border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,0.16);display:none;flex-direction:column;overflow:hidden;max-height:540px;border:1px solid rgba(0,0,0,0.07)}#_cb_win._open{display:flex}#_cb_head{padding:12px 14px;display:flex;align-items:center;gap:10px;flex-shrink:0}#_cb_msgs{flex:1;overflow-y:auto;padding:12px;background:#f8fafc;display:flex;flex-direction:column;gap:8px;min-height:200px;position:relative}#_cb_ph{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#94a3b8;font-size:13px;text-align:center;pointer-events:none}#_cb_qa{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px 0}#_cb_foot{background:#fff;border-top:1px solid #f1f5f9;flex-shrink:0}#_cb_form{display:flex;align-items:center;gap:8px;padding:10px 12px}#_cb_inp{flex:1;border:1px solid #e2e8f0;border-radius:10px;padding:9px 13px;font-size:13px;color:#1e293b;outline:none;transition:border 0.15s}#_cb_inp:focus{border-color:#6366f1}#_cb_snd{width:34px;height:34px;border-radius:10px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity 0.15s;padding:0}#_cb_snd:hover{opacity:0.85}#_cb_snd svg{width:16px;height:16px;display:block}#_cb_pw{text-align:center;padding:4px 0 8px;font-size:10px;color:#94a3b8}._cb_msg{display:flex;align-items:flex-end;gap:8px}._cb_msg._u{flex-direction:row-reverse}._cb_mav{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;flex-shrink:0}._cb_bub{max-width:220px;padding:8px 12px;border-radius:12px;font-size:13px;line-height:1.5;word-break:break-word;white-space:pre-wrap}._cb_bot{background:#fff;color:#1e293b;border:1px solid #e2e8f0;border-bottom-left-radius:4px}._cb_user{color:#fff;border-bottom-right-radius:4px}._cb_dots{display:flex;gap:4px;padding:10px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;border-bottom-left-radius:4px}._cb_dots span{width:6px;height:6px;background:#94a3b8;border-radius:50%;animation:_cb_blink 1.2s infinite}._cb_dots span:nth-child(2){animation-delay:0.2s}._cb_dots span:nth-child(3){animation-delay:0.4s}@keyframes _cb_blink{0%,80%,100%{opacity:0.25}40%{opacity:1}}._cb_qbtn{padding:7px 14px;border-radius:20px;border:none;cursor:pointer;font-size:12px;font-weight:500;transition:opacity 0.15s}._cb_qbtn:hover{opacity:0.8}._cb_wr{display:flex;flex-wrap:wrap;gap:6px;padding:6px 12px}._cb_hname{font-weight:600;font-size:13px;color:#fff}._cb_hstatus{font-size:11px;color:rgba(255,255,255,0.75);display:flex;align-items:center;gap:4px}._cb_dot{width:6px;height:6px;background:#4ade80;border-radius:50%;display:inline-block}#_cb_x{margin-left:auto;background:rgba(255,255,255,0.15);border:none;color:#fff;width:24px;height:24px;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:13px;transition:background 0.15s}#_cb_x:hover{background:rgba(255,255,255,0.25)}';

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

  function hexToRgb(hex) {
    var r = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
    return r ? parseInt(r[1],16)+','+parseInt(r[2],16)+','+parseInt(r[3],16) : '99,102,241';
  }
  function apiFetch(path, opts) {
    return fetch(API_BASE + path, Object.assign({headers:{'Content-Type':'application/json'}}, opts||{})).then(function(r){return r.json();});
  }
  function playSound() {
    if (!cfg || !cfg.soundEnabled) return;
    try {
      var ctx = new (window.AudioContext||window.webkitAudioContext)();
      var o=ctx.createOscillator(), g=ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value=800; g.gain.setValueAtTime(0.07,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.25);
      o.start(); o.stop(ctx.currentTime+0.25);
    } catch(e){}
  }

  var style=document.createElement('style');
  style.textContent=${JSON.stringify(css)};
  document.head.appendChild(style);

  var wrap=document.createElement('div');
  wrap.id='_cb_w';
  wrap.innerHTML='<button id="_cb_btn" aria-label="Open chat"><span id="_cb_bdg">1</span><span style="font-size:22px">\\u{1F4AC}</span></button><div id="_cb_win" role="dialog"><div id="_cb_head"></div><div id="_cb_msgs" aria-live="polite"><div id="_cb_ph">\\u{1F4AC} Ask me anything</div></div><div id="_cb_qa"></div><div id="_cb_foot"><div id="_cb_form"><input id="_cb_inp" type="text" placeholder="Type a message\\u2026" aria-label="Message"/><button id="_cb_snd" aria-label="Send"><svg fill="none" stroke="white" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg></button></div><div id="_cb_pw">Powered by <a href="https://botbuilder.app" target="_blank" style="color:#6366f1;text-decoration:none">BotBuilder</a></div></div></div>';
  document.body.appendChild(wrap);

  var btn=document.getElementById('_cb_btn'),bdg=document.getElementById('_cb_bdg'),win=document.getElementById('_cb_win'),msgs_el=document.getElementById('_cb_msgs'),qa_el=document.getElementById('_cb_qa'),inp=document.getElementById('_cb_inp'),snd=document.getElementById('_cb_snd'),head=document.getElementById('_cb_head');

  function initConfig() {
    apiFetch('/api/widget/'+BOT_ID+'/config').then(function(c){
      if(c.message){return;}
      cfg=c;
      var col=cfg.primaryColor||'#6366f1';
      btn.style.backgroundColor=col;
      snd.style.backgroundColor=col;
      head.style.background='linear-gradient(135deg,'+col+','+col+'cc)';
      var letter=(cfg.avatarText||cfg.name||'B')[0].toUpperCase();
      head.innerHTML='<div style="width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,0.22);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:14px;flex-shrink:0">'+letter+'</div><div><div class="_cb_hname">'+(cfg.name||'Assistant')+'</div><div class="_cb_hstatus"><span class="_cb_dot"></span>Online</div></div><button id="_cb_x" onclick="window._cbToggle()" aria-label="Close">&#x2715;</button>';
      addMsg('assistant',cfg.welcomeMessage||'Hi! How can I help?');
      if(cfg.quickActions&&cfg.quickActions.length) renderQA(cfg.quickActions);
    }).catch(function(){head.innerHTML='<div style="color:white;padding:4px">Chat Assistant</div>';});
  }

  function renderQA(actions) {
    qa_el.innerHTML='';
    var col=(cfg&&cfg.primaryColor)||'#6366f1';
    var rgb=hexToRgb(col);
    actions.forEach(function(qa){
      var b=document.createElement('button');
      b.className='_cb_qbtn'; b.textContent=qa;
      b.style.backgroundColor='rgba('+rgb+',0.13)'; b.style.color=col;
      b.onclick=function(){
        qa_el.innerHTML='';
        var low=qa.toLowerCase();
        if(low.indexOf('book')>=0||low.indexOf('appoint')>=0) startBooking();
        else send(qa);
      };
      qa_el.appendChild(b);
    });
  }

  function addMsg(role,text) {
    var col=(cfg&&cfg.primaryColor)||'#6366f1';
    var letter=((cfg&&cfg.avatarText)||(cfg&&cfg.name&&cfg.name[0])||'B').toUpperCase();
    var ph=document.getElementById('_cb_ph');
    if(ph)ph.style.display='none';
    var d=document.createElement('div'); d.className='_cb_msg'+(role==='user'?' _u':'');
    if(role==='assistant'){var av=document.createElement('div');av.className='_cb_mav';av.style.backgroundColor=col;av.textContent=letter;d.appendChild(av);}
    var b=document.createElement('div'); b.className='_cb_bub '+(role==='user'?'_cb_user':'_cb_bot');
    if(role==='user')b.style.backgroundColor=col;
    b.textContent=text; d.appendChild(b);
    msgs_el.appendChild(d); msgs_el.scrollTop=msgs_el.scrollHeight;
  }

  function showTyping() {
    var col=(cfg&&cfg.primaryColor)||'#6366f1';
    var letter=((cfg&&cfg.avatarText)||(cfg&&cfg.name&&cfg.name[0])||'B').toUpperCase();
    var d=document.createElement('div'); d.id='_cb_typing'; d.className='_cb_msg';
    d.innerHTML='<div class="_cb_mav" style="background:'+col+'">'+letter+'</div><div class="_cb_dots"><span></span><span></span><span></span></div>';
    msgs_el.appendChild(d); msgs_el.scrollTop=msgs_el.scrollHeight;
  }
  function hideTyping(){var t=document.getElementById('_cb_typing');if(t)t.remove();}

  function sendToAI(attempt) {
    attempt=attempt||1; loading=true; showTyping();
    var delay=500+Math.random()*1000;
    apiFetch('/api/widget/'+BOT_ID+'/chat',{method:'POST',body:JSON.stringify({messages:msgs,sessionId:SESSION_ID})})
    .then(function(d){
      setTimeout(function(){
        hideTyping();
        var r=d.message||((cfg&&cfg.fallbackMessage)||'Sorry, something went wrong.');
        msgs.push({role:'assistant',content:r}); addMsg('assistant',r); playSound(); loading=false;
      },delay);
    }).catch(function(){
      if(attempt<2){hideTyping();loading=false;setTimeout(function(){sendToAI(2);},1200);}
      else{setTimeout(function(){hideTyping();var fb=(cfg&&cfg.fallbackMessage)||'Sorry, please try again.';msgs.push({role:'assistant',content:fb});addMsg('assistant',fb);loading=false;},delay);}
    });
  }

  function send(text) {
    if(!text||!text.trim()||loading)return;
    if(msgCount>=MAX_MSGS){addMsg('assistant','Message limit reached. Please refresh to start a new chat.');return;}
    if(booking!==null){addMsg('user',text.trim());msgCount++;handleBookingInput(text.trim());inp.value='';return;}
    qa_el.innerHTML=''; msgCount++;
    msgs.push({role:'user',content:text.trim()}); addMsg('user',text.trim()); inp.value='';
    var low=text.toLowerCase();
    if(low.indexOf('book')>=0||low.indexOf('appointment')>=0||low.indexOf('schedule')>=0){startBooking();return;}
    sendToAI();
  }

  function startBooking(){
    booking={step:'name',name:'',phone:'',service:'',date:'',time:''};
    qa_el.innerHTML='';
    setTimeout(function(){addMsg('assistant','I\\'d be happy to book an appointment! First, what\\'s your name?');},400);
  }

  function handleBookingInput(text){
    if(!booking)return;
    if(booking.step==='name'){
      booking.name=text; booking.step='phone';
      setTimeout(function(){addMsg('assistant','Thanks, '+text+'! What\\'s your phone number?');},400);
    } else if(booking.step==='phone'){
      booking.phone=text; booking.step='service';
      var svcs=(cfg&&cfg.services&&cfg.services.length)?cfg.services:[];
      setTimeout(function(){
        addMsg('assistant','What service are you interested in?');
        if(svcs.length>0)showServiceBtns(svcs);
      },400);
    } else if(booking.step==='service'){
      booking.service=text; booking.step='date';
      setTimeout(function(){addMsg('assistant','What date works for you?');showDatePicker();},400);
    } else if(booking.step==='date'){
      booking.date=text; booking.step='time';
      setTimeout(function(){addMsg('assistant','Would you prefer morning or afternoon?');showTimeBtns();},400);
    } else if(booking.step==='time'){
      booking.time=text; booking.step='confirm';
      setTimeout(function(){showSummary();},400);
    }
  }

  function showServiceBtns(svcs){
    var col=(cfg&&cfg.primaryColor)||'#6366f1'; var rgb=hexToRgb(col);
    var c=document.createElement('div'); c.className='_cb_wr';
    svcs.forEach(function(s){
      var b=document.createElement('button'); b.className='_cb_qbtn'; b.textContent=s;
      b.style.backgroundColor='rgba('+rgb+',0.13)'; b.style.color=col;
      b.onclick=function(){c.remove();addMsg('user',s);booking.service=s;booking.step='date';setTimeout(function(){addMsg('assistant','What date works for you?');showDatePicker();},400);};
      c.appendChild(b);
    });
    msgs_el.appendChild(c); msgs_el.scrollTop=msgs_el.scrollHeight;
  }

  function showDatePicker(){
    var col=(cfg&&cfg.primaryColor)||'#6366f1';
    var today=new Date().toISOString().split('T')[0];
    var c=document.createElement('div'); c.className='_cb_wr';
    var di=document.createElement('input'); di.type='date'; di.min=today;
    di.style.cssText='border:1px solid #e2e8f0;border-radius:8px;padding:7px 11px;font-size:13px;color:#1e293b;outline:none;cursor:pointer';
    var pb=document.createElement('button'); pb.textContent='Confirm';
    pb.style.cssText='background:'+col+';color:white;border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:500;cursor:pointer;margin-left:6px';
    pb.onclick=function(){
      if(!di.value)return;
      var d=new Date(di.value+'T12:00:00');
      var fmt=d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
      c.remove(); addMsg('user',fmt); booking.date=di.value; booking.step='time';
      setTimeout(function(){addMsg('assistant','Would you prefer morning or afternoon?');showTimeBtns();},400);
    };
    c.appendChild(di); c.appendChild(pb); msgs_el.appendChild(c); msgs_el.scrollTop=msgs_el.scrollHeight;
  }

  function showTimeBtns(){
    var col=(cfg&&cfg.primaryColor)||'#6366f1'; var rgb=hexToRgb(col);
    var c=document.createElement('div'); c.className='_cb_wr';
    [['Morning','\\u2600\\uFE0F'],['Afternoon','\\uD83C\\uDF24\\uFE0F']].forEach(function(t){
      var b=document.createElement('button'); b.className='_cb_qbtn'; b.textContent=t[0]+' '+t[1];
      b.style.backgroundColor='rgba('+rgb+',0.13)'; b.style.color=col;
      b.onclick=function(){c.remove();addMsg('user',t[0]);booking.time=t[0];booking.step='confirm';setTimeout(function(){showSummary();},400);};
      c.appendChild(b);
    });
    msgs_el.appendChild(c); msgs_el.scrollTop=msgs_el.scrollHeight;
  }

  function showSummary(){
    var col=(cfg&&cfg.primaryColor)||'#6366f1'; var rgb=hexToRgb(col);
    var d=new Date(booking.date+'T12:00:00');
    var ds=d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
    addMsg('assistant','Here\\'s your appointment summary:\\n\\n\\uD83D\\uDC64 Name: '+booking.name+'\\n\\uD83D\\uDCDE Phone: '+booking.phone+'\\n\\uD83D\\uDD27 Service: '+booking.service+'\\n\\uD83D\\uDCC5 Date: '+ds+'\\n\\uD83D\\uDD50 Time: '+booking.time);
    var c=document.createElement('div'); c.className='_cb_wr';
    var cfm=document.createElement('button'); cfm.className='_cb_qbtn'; cfm.textContent='\\u2713 Confirm Booking';
    cfm.style.backgroundColor=col; cfm.style.color='white';
    cfm.onclick=function(){c.remove();addMsg('user','Confirm');confirmBooking();};
    var can=document.createElement('button'); can.className='_cb_qbtn'; can.textContent='\\u2717 Cancel';
    can.style.backgroundColor='rgba(239,68,68,0.1)'; can.style.color='#ef4444';
    can.onclick=function(){c.remove();booking=null;addMsg('assistant','No problem! Is there anything else I can help you with?');};
    c.appendChild(cfm); c.appendChild(can); msgs_el.appendChild(c); msgs_el.scrollTop=msgs_el.scrollHeight;
  }

  function confirmBooking(){
    apiFetch('/api/widget/'+BOT_ID+'/booking',{method:'POST',body:JSON.stringify({sessionId:SESSION_ID,name:booking.name,phone:booking.phone,service:booking.service,date:booking.date,timePreference:booking.time})})
    .then(function(){
      var msg=(cfg&&cfg.bookingConfirmationMessage)||'Your appointment has been booked! We\\'ll be in touch shortly. \\uD83C\\uDF89';
      addMsg('assistant',msg); booking=null; playSound();
    }).catch(function(){addMsg('assistant','Sorry, there was an issue confirming your booking. Please call us directly.');booking=null;});
  }

  window._cbToggle = function() {
    isOpen=!isOpen;
    if(isOpen){win.classList.add('_open');bdg.style.display='none';inp.focus();if(!initialized){initialized=true;initConfig();}}
    else{win.classList.remove('_open');}
  };

  btn.onclick=window._cbToggle;
  snd.onclick=function(){send(inp.value);};
  inp.onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(inp.value);}};
})();
`;

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.send(`var _cbCSS=${JSON.stringify(css)};${js}`);
});

export default router;

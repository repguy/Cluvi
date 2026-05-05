import { Router } from "express";
import { db, botsTable, conversationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

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

    res.json({
      name: bot.appearance.botName || bot.name,
      primaryColor: bot.appearance.primaryColor,
      welcomeMessage: bot.appearance.welcomeMessage,
      fallbackMessage: bot.appearance.fallbackMessage,
      quickActions: bot.appearance.quickActions,
      avatarText: bot.appearance.avatarText || (bot.appearance.botName || bot.name)[0],
      leadWebhookUrl: bot.leadWebhookUrl,
      businessType: bot.appearance.businessType,
    });
  } catch {
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/widget/:publicId/chat", async (req, res) => {
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
      res.status(400).json({ message: "Bot is not configured with an API key" });
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

    // Track conversation asynchronously (don't block response)
    if (sessionId) {
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
                updatedAt: new Date(),
              })
              .where(eq(conversationsTable.id, existing[0].id));
          } else {
            await db.insert(conversationsTable).values({
              botId: bot.id,
              sessionId,
              messageCount: 1,
            });
          }
        } catch {
          // silently fail — don't break the chat
        }
      })();
    }

    const reply = await callAI(
      bot.provider,
      bot.model,
      bot.apiKey,
      bot.systemPrompt,
      messages
    );

    res.json({ message: reply });
  } catch (err) {
    req.log.error({ err }, "widget chat error");

    const raw = err instanceof Error ? err.message : "";
    let userMessage = "Sorry, I'm having trouble responding right now. Please try again.";

    if (raw.includes("429") || /rate.?limit/i.test(raw) || /rate-limited/i.test(raw)) {
      userMessage = "This model is temporarily rate limited — please try again in a moment, or ask the site owner to switch to a different model.";
    } else if (
      raw.includes("404") ||
      /no endpoints/i.test(raw) ||
      /model not found/i.test(raw) ||
      /not found/i.test(raw)
    ) {
      userMessage = "The configured AI model is unavailable. Please ask the site owner to update the model ID in their bot settings.";
    } else if (raw.includes("401") || /invalid.{0,20}key/i.test(raw) || /auth/i.test(raw)) {
      userMessage = "There's an issue with the API key. Please ask the site owner to check their bot settings.";
    } else if (!bot.apiKey) {
      userMessage = "This bot isn't fully set up yet — no API key has been configured.";
    }

    res.status(500).json({ message: userMessage });
  }
});

router.get("/widget.js", async (req, res) => {
  const botId = req.query.botId as string;
  if (!botId) {
    res.status(400).send("// Missing botId");
    return;
  }

  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  const apiBase = `${proto}://${host}`;

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
  var unread = 1;

  function apiFetch(path, opts) {
    return fetch(API_BASE + path, Object.assign({ headers: {'Content-Type':'application/json'} }, opts || {})).then(function(r){return r.json();});
  }

  var style = document.createElement('style');
  style.textContent = '#_cb_w *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;padding:0}#_cb_w{position:fixed;bottom:20px;right:20px;z-index:999999}#_cb_btn{width:54px;height:54px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:22px;box-shadow:0 4px 20px rgba(0,0,0,0.18);transition:transform 0.2s,box-shadow 0.2s;position:relative}#_cb_btn:hover{transform:scale(1.08)}#_cb_bdg{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;width:17px;height:17px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white}#_cb_win{position:absolute;bottom:66px;right:0;width:340px;background:#fff;border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,0.16);display:none;flex-direction:column;overflow:hidden;max-height:520px;border:1px solid rgba(0,0,0,0.06)}#_cb_win._open{display:flex}#_cb_head{padding:12px 14px;display:flex;align-items:center;gap:10px;flex-shrink:0}#_cb_av{width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,0.22);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:13px;flex-shrink:0}._cb_hname{color:#fff;font-size:13px;font-weight:600;line-height:1.2}._cb_hstatus{color:rgba(255,255,255,0.75);font-size:11px;display:flex;align-items:center;gap:4px;margin-top:2px}._cb_dot{width:6px;height:6px;background:#4ade80;border-radius:50%;display:inline-block}#_cb_x{margin-left:auto;background:none;border:none;color:rgba(255,255,255,0.65);cursor:pointer;font-size:20px;line-height:1;padding:2px;display:flex;align-items:center;justify-content:center}#_cb_x:hover{color:#fff}#_cb_msgs{flex:1;overflow-y:auto;padding:12px;background:#f8fafc;display:flex;flex-direction:column;gap:8px;min-height:180px}._cb_msg{display:flex;align-items:flex-end;gap:6px}._cb_msg._u{flex-direction:row-reverse}._cb_mav{width:24px;height:24px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0}._cb_bub{max-width:80%;padding:8px 12px;border-radius:14px;font-size:13px;line-height:1.5;word-wrap:break-word}._cb_bot{background:#fff;border:1px solid #e2e8f0;color:#0f172a;border-bottom-left-radius:4px;box-shadow:0 1px 2px rgba(0,0,0,0.05)}._cb_user{color:#fff;border-bottom-right-radius:4px}#_cb_typing{display:flex;align-items:flex-end;gap:6px}._cb_dots{display:flex;gap:4px;padding:10px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;border-bottom-left-radius:4px}._cb_d{width:6px;height:6px;border-radius:50%;background:#94a3b8;animation:_cb_b 1.2s infinite}._cb_d:nth-child(2){animation-delay:.2s}._cb_d:nth-child(3){animation-delay:.4s}@keyframes _cb_b{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}#_cb_qa{padding:0 10px 8px;display:flex;flex-direction:column;gap:5px;background:#f8fafc}._cb_qbtn{text-align:left;font-size:12px;padding:7px 11px;border-radius:9px;background:#fff;cursor:pointer;transition:background .15s;font-weight:500;border-width:1.5px;border-style:solid}._cb_qbtn:hover{opacity:0.85}#_cb_foot{padding:10px;background:#fff;border-top:1px solid #f1f5f9;flex-shrink:0}#_cb_form{display:flex;gap:7px;align-items:center}#_cb_inp{flex:1;background:#f1f5f9;border:none;border-radius:20px;padding:9px 14px;font-size:13px;outline:none;transition:background .15s}#_cb_inp:focus{background:#e8edff}#_cb_snd{width:33px;height:33px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity .15s}#_cb_snd:hover{opacity:0.85}#_cb_snd svg{width:14px;height:14px}@keyframes _cb_pulse{0%{box-shadow:0 0 0 0 rgba(99,102,241,0.5)}70%{box-shadow:0 0 0 12px rgba(99,102,241,0)}100%{box-shadow:0 0 0 0 rgba(99,102,241,0)}}';
  document.head.appendChild(style);

  var wrap = document.createElement('div');
  wrap.id = '_cb_w';
  wrap.innerHTML = '<button id="_cb_btn" aria-label="Open chat"><span id="_cb_bdg">1</span><span>💬</span></button><div id="_cb_win" role="dialog" aria-label="Chat"><div id="_cb_head"></div><div id="_cb_msgs" aria-live="polite"></div><div id="_cb_qa"></div><div id="_cb_foot"><div id="_cb_form"><input id="_cb_inp" type="text" placeholder="Type a message…" aria-label="Chat message"/><button id="_cb_snd" aria-label="Send"><svg fill="none" stroke="white" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg></button></div></div></div>';
  document.body.appendChild(wrap);

  var btn=document.getElementById('_cb_btn'),bdg=document.getElementById('_cb_bdg'),win=document.getElementById('_cb_win'),msgs_el=document.getElementById('_cb_msgs'),qa_el=document.getElementById('_cb_qa'),inp=document.getElementById('_cb_inp'),snd=document.getElementById('_cb_snd'),head=document.getElementById('_cb_head');

  function initConfig() {
    apiFetch('/api/widget/'+BOT_ID+'/config').then(function(c){
      cfg=c;
      var col=cfg.primaryColor||'#6366f1';
      btn.style.backgroundColor=col;
      snd.style.backgroundColor=col;
      head.style.background='linear-gradient(135deg,'+col+','+col+'cc)';
      head.innerHTML='<div id="_cb_av" style="background:rgba(255,255,255,0.2);width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:700;color:white;font-size:13px;">'+((cfg.avatarText||cfg.name||'B')[0].toUpperCase())+'</div><div><div class="_cb_hname">'+(cfg.name||'Assistant')+'</div><div class="_cb_hstatus"><span class="_cb_dot"></span>Online now</div></div><button id="_cb_x" onclick="window._cbToggle()" aria-label="Close chat">✕</button>';
      addMsg('assistant',cfg.welcomeMessage||'Hi! How can I help?');
      if(cfg.quickActions&&cfg.quickActions.length){cfg.quickActions.forEach(function(qa){var b=document.createElement('button');b.className='_cb_qbtn';b.textContent=qa;b.style.borderColor=col;b.style.color=col;b.onclick=function(){qa_el.innerHTML='';send(qa);};qa_el.appendChild(b);});}
    }).catch(function(){head.innerHTML='<div style="color:white;font-size:14px;padding:4px;">Chat Assistant</div>';});
  }

  function addMsg(role,text){
    var col=(cfg&&cfg.primaryColor)||'#6366f1';
    var d=document.createElement('div');d.className='_cb_msg'+(role==='user'?' _u':'');
    if(role==='assistant'){var av=document.createElement('div');av.className='_cb_mav';av.style.backgroundColor=col;av.textContent=((cfg&&cfg.avatarText)||(cfg&&cfg.name&&cfg.name[0])||'B').toUpperCase();d.appendChild(av);}
    var b=document.createElement('div');b.className='_cb_bub '+(role==='user'?'_cb_user':'_cb_bot');if(role==='user')b.style.backgroundColor=col;b.textContent=text;d.appendChild(b);
    msgs_el.appendChild(d);msgs_el.scrollTop=msgs_el.scrollHeight;
  }

  function showTyping(){var d=document.createElement('div');d.id='_cb_typing';var col=(cfg&&cfg.primaryColor)||'#6366f1';d.innerHTML='<div class="_cb_mav" style="background:'+col+';width:24px;height:24px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:white;">'+((cfg&&cfg.avatarText)||(cfg&&cfg.name&&cfg.name[0])||'B').toUpperCase()+'</div><div class="_cb_dots"><div class="_cb_d"></div><div class="_cb_d"></div><div class="_cb_d"></div></div>';msgs_el.appendChild(d);msgs_el.scrollTop=msgs_el.scrollHeight;}
  function hideTyping(){var t=document.getElementById('_cb_typing');if(t)t.remove();}

  function send(text){
    if(!text||!text.trim()||loading)return;
    qa_el.innerHTML='';
    msgs.push({role:'user',content:text.trim()});
    addMsg('user',text.trim());
    inp.value='';loading=true;showTyping();
    apiFetch('/api/widget/'+BOT_ID+'/chat',{method:'POST',body:JSON.stringify({messages:msgs,sessionId:SESSION_ID})}).then(function(d){
      hideTyping();var r=d.message||((cfg&&cfg.fallbackMessage)||'Sorry, something went wrong.');msgs.push({role:'assistant',content:r});addMsg('assistant',r);
    }).catch(function(){hideTyping();var fb=(cfg&&cfg.fallbackMessage)||'Sorry, something went wrong.';msgs.push({role:'assistant',content:fb});addMsg('assistant',fb);}).finally(function(){loading=false;});
  }

  window._cbToggle=function(){
    isOpen=!isOpen;
    if(isOpen){win.classList.add('_open');btn.innerHTML='<svg width="22" height="22" fill="none" stroke="white" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>';bdg.style.display='none';
      if(!initialized){initialized=true;initConfig();}setTimeout(function(){inp.focus();},200);
    }else{win.classList.remove('_open');btn.innerHTML='<span id="_cb_bdg" style="display:none;"></span><span>💬</span>';}
  };

  btn.onclick=function(){window._cbToggle();};
  inp.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(inp.value);}});
  snd.onclick=function(){send(inp.value);};

  var c0='#6366f1';btn.style.backgroundColor=c0;snd.style.backgroundColor=c0;head.style.background=c0;
  btn.style.animation='_cb_pulse 2s ease-in-out infinite';
})();
`;

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(js);
});

export default router;

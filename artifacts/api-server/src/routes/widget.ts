import { Router } from "express";
import { db, botsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        system: systemPrompt,
        messages,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic error: ${err}`);
    }
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
        ...(provider === "openrouter"
          ? { "HTTP-Referer": "https://botbuilder.app" }
          : {}),
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`${provider} error: ${err}`);
    }
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    return data.choices[0]?.message?.content ?? "";
  }

  if (provider === "gemini") {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini error: ${err}`);
    }
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
      avatarText:
        bot.appearance.avatarText || (bot.appearance.botName || bot.name)[0],
      leadWebhookUrl: bot.leadWebhookUrl,
      businessType: bot.appearance.businessType,
    });
  } catch (err) {
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
      res.status(400).json({ message: "Bot is not configured" });
      return;
    }

    const { messages } = req.body as {
      messages: { role: string; content: string }[];
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ message: "Messages are required" });
      return;
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
    const fallback =
      (err instanceof Error ? err.message : null) ||
      "Sorry, I'm having trouble responding. Please try again.";
    res.status(500).json({ message: fallback });
  }
});

router.get("/widget.js", async (req, res) => {
  const botId = req.query.botId as string;
  if (!botId) {
    res.status(400).send("// Missing botId query param");
    return;
  }

  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  const apiBase = `${proto}://${host}`;

  const js = `
(function() {
  var BOT_ID = ${JSON.stringify(botId)};
  var API_BASE = ${JSON.stringify(apiBase)};

  var cfg = null;
  var msgs = [];
  var open = false;
  var loading = false;
  var unread = 1;
  var initialized = false;

  function apiFetch(path, opts) {
    return fetch(API_BASE + path, Object.assign({ headers: {'Content-Type':'application/json'} }, opts || {}))
      .then(function(r) { return r.json(); });
  }

  function css(el, styles) {
    Object.assign(el.style, styles);
  }

  var style = document.createElement('style');
  style.textContent = [
    '#_cb_wrap * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 0; }',
    '#_cb_wrap { position: fixed; bottom: 20px; right: 20px; z-index: 999999; }',
    '#_cb_btn { width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); transition: transform 0.2s; position: relative; }',
    '#_cb_btn:hover { transform: scale(1.1); }',
    '#_cb_badge { position: absolute; top: -4px; right: -4px; background: #ef4444; color: white; font-size: 11px; font-weight: 700; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }',
    '#_cb_win { position: absolute; bottom: 68px; right: 0; width: 340px; background: white; border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,0.18); display: none; flex-direction: column; overflow: hidden; max-height: 520px; }',
    '#_cb_win._open { display: flex; }',
    '#_cb_head { padding: 12px 16px; display: flex; align-items: center; gap: 10px; }',
    '#_cb_avatar { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; font-weight: 700; color: white; font-size: 14px; flex-shrink: 0; }',
    '#_cb_hinfo p { color: white; font-size: 14px; font-weight: 600; }',
    '#_cb_hinfo span { color: rgba(255,255,255,0.8); font-size: 11px; }',
    '#_cb_close { margin-left: auto; background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; font-size: 20px; line-height: 1; }',
    '#_cb_close:hover { color: white; }',
    '#_cb_msgs { flex: 1; overflow-y: auto; padding: 12px; background: #f8fafc; display: flex; flex-direction: column; gap: 8px; min-height: 180px; }',
    '._cb_msg { display: flex; align-items: flex-end; gap: 6px; }',
    '._cb_msg._user { flex-direction: row-reverse; }',
    '._cb_av { width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white; flex-shrink: 0; }',
    '._cb_bub { max-width: 78%; padding: 9px 13px; border-radius: 16px; font-size: 13px; line-height: 1.5; word-wrap: break-word; }',
    '._cb_bot_bub { background: white; border: 1px solid #e2e8f0; color: #1e293b; border-bottom-left-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }',
    '._cb_user_bub { color: white; border-bottom-right-radius: 4px; }',
    '#_cb_dots { display: flex; align-items: center; gap: 4px; padding: 9px 13px; }',
    '._cb_dot { width: 7px; height: 7px; border-radius: 50%; background: #94a3b8; animation: _cb_bounce 1.2s infinite; }',
    '._cb_dot:nth-child(2) { animation-delay: 0.2s; }',
    '._cb_dot:nth-child(3) { animation-delay: 0.4s; }',
    '@keyframes _cb_bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }',
    '#_cb_qa { padding: 8px 12px 0; display: flex; flex-direction: column; gap: 6px; background: #f8fafc; }',
    '._cb_qa_btn { text-align: left; font-size: 12px; padding: 7px 12px; border-radius: 8px; background: white; cursor: pointer; transition: background 0.15s; font-weight: 500; }',
    '._cb_qa_btn:hover { background: #eff6ff; }',
    '#_cb_foot { padding: 10px; background: white; border-top: 1px solid #f1f5f9; }',
    '#_cb_form { display: flex; gap: 8px; align-items: center; }',
    '#_cb_input { flex: 1; background: #f1f5f9; border: none; border-radius: 20px; padding: 9px 14px; font-size: 13px; outline: none; }',
    '#_cb_input:focus { background: #e8f0fe; }',
    '#_cb_send { width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity 0.15s; }',
    '#_cb_send:hover { opacity: 0.85; }',
    '#_cb_send svg { width: 15px; height: 15px; }',
    '@keyframes _cb_pulse { 0%{box-shadow:0 0 0 0 rgba(37,99,235,0.5)} 70%{box-shadow:0 0 0 12px rgba(37,99,235,0)} 100%{box-shadow:0 0 0 0 rgba(37,99,235,0)} }',
  ].join('');
  document.head.appendChild(style);

  var wrap = document.createElement('div');
  wrap.id = '_cb_wrap';
  wrap.innerHTML = '<button id="_cb_btn"><span id="_cb_badge">1</span><span>💬</span></button><div id="_cb_win"><div id="_cb_head"></div><div id="_cb_msgs"></div><div id="_cb_qa"></div><div id="_cb_foot"><div id="_cb_form"><input id="_cb_input" type="text" placeholder="Type a message..." /><button id="_cb_send"><svg fill="none" stroke="white" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg></button></div></div></div>';
  document.body.appendChild(wrap);

  var btn = document.getElementById('_cb_btn');
  var badge = document.getElementById('_cb_badge');
  var win = document.getElementById('_cb_win');
  var msgs_el = document.getElementById('_cb_msgs');
  var qa_el = document.getElementById('_cb_qa');
  var input_el = document.getElementById('_cb_input');
  var send_el = document.getElementById('_cb_send');
  var head_el = document.getElementById('_cb_head');

  function initConfig() {
    apiFetch('/api/widget/' + BOT_ID + '/config').then(function(c) {
      cfg = c;
      var color = cfg.primaryColor || '#2563EB';
      btn.style.backgroundColor = color;
      btn.style.animation = '_cb_pulse 2s ease-in-out infinite';
      send_el.style.backgroundColor = color;

      head_el.style.background = 'linear-gradient(135deg, ' + color + ', ' + color + 'dd)';
      head_el.innerHTML = '<div id="_cb_avatar" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-weight:700;color:white;font-size:14px;flex-shrink:0;">' + (cfg.avatarText || cfg.name[0] || 'B') + '</div><div id="_cb_hinfo"><p style="color:white;font-size:14px;font-weight:600;">' + (cfg.name || 'Assistant') + '</p><span style="color:rgba(255,255,255,0.8);font-size:11px;display:flex;align-items:center;gap:4px;"><span style="width:7px;height:7px;background:#4ade80;border-radius:50%;display:inline-block;"></span>Online now</span></div><button id="_cb_close" onclick="_cbToggle()" style="margin-left:auto;background:none;border:none;color:rgba(255,255,255,0.7);cursor:pointer;font-size:22px;line-height:1;">×</button>';

      addMsg('assistant', cfg.welcomeMessage || 'Hi! How can I help you today?');

      if (cfg.quickActions && cfg.quickActions.length) {
        cfg.quickActions.forEach(function(qa) {
          var b = document.createElement('button');
          b.className = '_cb_qa_btn';
          b.textContent = qa;
          b.style.border = '1.5px solid ' + color;
          b.style.color = color;
          b.onclick = function() { qa_el.innerHTML = ''; sendMsg(qa); };
          qa_el.appendChild(b);
        });
      }
    }).catch(function() {
      head_el.innerHTML = '<p style="color:white;font-size:14px;padding:4px;">Chatbot</p>';
    });
  }

  function addMsg(role, content) {
    var color = (cfg && cfg.primaryColor) || '#2563EB';
    var d = document.createElement('div');
    d.className = '_cb_msg' + (role === 'user' ? ' _user' : '');
    if (role === 'assistant') {
      var av = document.createElement('div');
      av.className = '_cb_av';
      av.style.backgroundColor = color;
      av.textContent = (cfg && cfg.avatarText) || 'B';
      d.appendChild(av);
    }
    var bub = document.createElement('div');
    bub.className = '_cb_bub ' + (role === 'user' ? '_cb_user_bub' : '_cb_bot_bub');
    if (role === 'user') bub.style.backgroundColor = color;
    bub.textContent = content;
    d.appendChild(bub);
    msgs_el.appendChild(d);
    msgs_el.scrollTop = msgs_el.scrollHeight;
  }

  function showTyping() {
    var d = document.createElement('div');
    d.id = '_cb_typing';
    d.className = '_cb_msg';
    var color = (cfg && cfg.primaryColor) || '#2563EB';
    d.innerHTML = '<div class="_cb_av" style="background:' + color + ';width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;">' + ((cfg && cfg.avatarText) || 'B') + '</div><div class="_cb_bot_bub _cb_bub" id="_cb_dots"><div class="_cb_dot"></div><div class="_cb_dot"></div><div class="_cb_dot"></div></div>';
    msgs_el.appendChild(d);
    msgs_el.scrollTop = msgs_el.scrollHeight;
  }

  function hideTyping() {
    var t = document.getElementById('_cb_typing');
    if (t) t.remove();
  }

  function sendMsg(text) {
    if (!text.trim() || loading) return;
    qa_el.innerHTML = '';
    msgs.push({ role: 'user', content: text });
    addMsg('user', text);
    input_el.value = '';
    loading = true;
    showTyping();

    apiFetch('/api/widget/' + BOT_ID + '/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: msgs })
    }).then(function(d) {
      hideTyping();
      var reply = d.message || ((cfg && cfg.fallbackMessage) || 'Sorry, something went wrong.');
      msgs.push({ role: 'assistant', content: reply });
      addMsg('assistant', reply);
    }).catch(function() {
      hideTyping();
      var fb = (cfg && cfg.fallbackMessage) || 'Sorry, something went wrong.';
      msgs.push({ role: 'assistant', content: fb });
      addMsg('assistant', fb);
    }).finally(function() {
      loading = false;
    });
  }

  window._cbToggle = function() {
    open = !open;
    if (open) {
      win.classList.add('_open');
      btn.innerHTML = '<svg width="24" height="24" fill="none" stroke="white" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>';
      badge.style.display = 'none';
      unread = 0;
      if (!initialized) {
        initialized = true;
        initConfig();
      }
      setTimeout(function() { input_el.focus(); }, 200);
    } else {
      win.classList.remove('_open');
      btn.innerHTML = '<span id="_cb_badge" style="display:none"></span><span>💬</span>';
    }
  };

  btn.onclick = function() { window._cbToggle(); };

  input_el.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(input_el.value); }
  });

  send_el.onclick = function() { sendMsg(input_el.value); };

  var color0 = '#2563EB';
  btn.style.backgroundColor = color0;
  btn.style.animation = '_cb_pulse 2s ease-in-out infinite';
  send_el.style.backgroundColor = color0;
  head_el.style.background = color0;
})();
`;

  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(js);
});

export default router;

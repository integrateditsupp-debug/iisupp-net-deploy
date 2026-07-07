const messages = document.getElementById("messages");
const userInput = document.getElementById("userInput");
const sendMessage = document.getElementById("sendMessage");

// Shared ARIA brain session (2026-07-07) — same engine as iisupp.net/aria + Sentinel offline tier.
// The popup stays open during a conversation, so clarifier -> answer flows keep their context.
let brainSession = window.AriaBrain ? window.AriaBrain.newSession() : null;

function brainConversationActive() {
  return Boolean(
    brainSession && brainSession.topic &&
    (brainSession.stage === "awaiting" || brainSession.stage === "checking" || brainSession.stage === "answered")
  );
}

function renderBrainResult(r) {
  const emp = r.empathy ? `<div class="brain-emp">${escapeHtmlLocal(r.empathy)}</div>` : "";
  const say = r.say ? `<div class="brain-say">${escapeHtmlLocal(r.say)}</div>` : "";
  const ask = r.ask ? `<div class="brain-ask">${escapeHtmlLocal(r.ask)}</div>` : "";
  const opts = r.options && r.options.length
    ? `<div class="brain-opts">${r.options
        .map(o => `<button type="button" class="brain-opt" data-opt="${escapeHtmlLocal(o)}">${escapeHtmlLocal(o)}</button>`)
        .join("")}</div>`
    : "";
  const steps = r.steps && r.steps.length
    ? `<ol class="brain-steps">${r.steps.map(s => `<li>${escapeHtmlLocal(s)}</li>`).join("")}</ol>`
    : "";
  const esc = r.escalate ? `<div class="brain-esc">If that does not resolve it: ${escapeHtmlLocal(r.escalate)}</div>` : "";
  const also = r.also ? `<div class="brain-also">${escapeHtmlLocal(r.also)}</div>` : "";
  const tail = r.tail ? `<div class="brain-tail">${escapeHtmlLocal(r.tail)}</div>` : "";
  return `<div class="brain-turn">${emp}${say}${ask}${opts}${steps}${esc}${also}${tail}</div>`;
}

// Guided-fix tier: run the shared brain when it can genuinely take the turn.
// Returns true when the brain rendered a reply.
function tryBrainTurn(text) {
  if (!window.AriaBrain) return false;
  try {
    if (!brainSession) brainSession = window.AriaBrain.newSession();
    const midFlow = brainConversationActive();
    const isGreetBye = /^(hi|hello|hey|thanks|thank you|bye|good (morning|afternoon|evening))\b/i.test(text.trim()) &&
      text.trim().split(/\s+/).length <= 4;
    if (!midFlow && !isGreetBye) {
      const cls = window.AriaBrain.classify(text.toLowerCase(), brainSession);
      if (!cls || cls.score < 4) return false; // no confident route -> let the network tier try
    }
    const r = window.AriaBrain.handleTurn(brainSession, text);
    if (!r || (!r.say && !r.ask && !r.steps)) return false;
    addHtmlMessage("aria", renderBrainResult(r));
    if (r.stage === "closed") brainSession = window.AriaBrain.newSession();
    return true;
  } catch (err) {
    console.warn("[aria-popup] brain error:", err);
    return false;
  }
}

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function addHtmlMessage(role, html) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.innerHTML = html;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function escapeHtmlLocal(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderKBHit(hit) {
  const levelClass = hit.level.toLowerCase();
  const phone = '<a href="tel:+16475813182">(647) 581-3182</a>';
  const escalation = hit.escalation
    ? `<div class="kb-escalation">If urgent, call ${phone}.</div>`
    : "";
  const related = hit.related.length
    ? `<div class="kb-related">${hit.related
        .map(r => `<button type="button" class="kb-related-btn" data-title="${escapeHtmlLocal(r.title)}">${escapeHtmlLocal(r.title)}</button>`)
        .join("")}</div>`
    : "";
  return `
    <div class="kb-hit">
      <div class="kb-hit-head">
        <span class="kb-pill kb-pill-${levelClass}">${escapeHtmlLocal(hit.level)}</span>
        <span class="kb-hit-title">${escapeHtmlLocal(hit.title)}</span>
      </div>
      <div class="kb-hit-body">${escapeHtmlLocal(hit.body)}</div>
      ${escalation}
      ${related}
    </div>`;
}

async function sendPrompt() {
  const text = userInput.value.trim();
  if (!text) return;
  userInput.value = "";
  addMessage("user", text);

  // 0. Mid-conversation with the brain (it asked a clarifier / gave steps)? The user's short answer
  //    ("it freezes", "done", "still broken") belongs to that flow — don't let a KB keyword hijack it.
  if (brainConversationActive() && tryBrainTurn(text)) return;

  // 1. Try the local KB first (offline, instant, free, scoped to IT problems).
  try {
    if (window.AriaPopupKB && typeof window.AriaPopupKB.lookup === "function") {
      const hit = await window.AriaPopupKB.lookup(text);
      if (hit) {
        addHtmlMessage("aria", renderKBHit(hit));
        return;
      }
    }
  } catch (err) {
    console.warn("[aria-popup] local kb error:", err);
  }

  // 1.5 Shared ARIA brain — guided, conversational fixes (same engine as iisupp.net/aria + Sentinel).
  //     Takes greetings and any IT problem it can route confidently; asks ONE clarifier, then steps.
  if (tryBrainTurn(text)) return;

  // 2. Fall back to the network (background.js → /.netlify/functions/aria-search).
  try {
    const res = await chrome.runtime.sendMessage({
      type: "ARIA_QUERY",
      payload: text,
    });
    if (res && res.html) addHtmlMessage("aria", res.html);
    else addMessage("aria", (res && res.text) || "ARIA could not respond right now.");
  } catch (err) {
    addMessage("aria", "ARIA could not respond right now.");
  }
}

// Related-article click → re-ask with that article's title as the query.
// Brain option chip click → answer the clarifier with that option.
document.getElementById("messages").addEventListener("click", (e) => {
  const opt = e.target.closest(".brain-opt");
  if (opt) {
    userInput.value = opt.dataset.opt;
    sendPrompt();
    return;
  }
  const btn = e.target.closest(".kb-related-btn");
  if (!btn) return;
  userInput.value = btn.dataset.title;
  sendPrompt();
});

sendMessage.addEventListener("click", sendPrompt);
userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendPrompt();
});

document.getElementById("addReminder").addEventListener("click", async () => {
  const title = prompt("Reminder title:");
  if (!title) return;
  const minutes = Number(prompt("Remind you in how many minutes?", "15"));
  if (!minutes || minutes < 1) return;
  await chrome.runtime.sendMessage({
    type: "ADD_REMINDER",
    payload: { title, minutes, isPrivate: true },
  });
  addMessage("aria", `Reminder set — I'll quietly let you know in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
});

document.getElementById("summarizePage").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      addMessage("aria", "No active page found.");
      return;
    }
    const res = await chrome.runtime.sendMessage({
      type: "ARIA_QUERY",
      payload: `summarize page ${tab.url}`,
    });
    if (res && res.html) addHtmlMessage("aria", res.html);
    else addMessage("aria", (res && res.text) || "Could not summarize.");
  } catch {
    addMessage("aria", "Summarize is unavailable on this page.");
  }
});

document.getElementById("comparePrices").addEventListener("click", async () => {
  const q = prompt("What are you shopping for?");
  if (!q) return;
  addMessage("user", `Compare prices: ${q}`);
  const res = await chrome.runtime.sendMessage({
    type: "ARIA_QUERY",
    payload: `compare price ${q}`,
  });
  if (res && res.html) addHtmlMessage("aria", res.html);
  else addMessage("aria", (res && res.text) || "No result.");
});

document.getElementById("openSite").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://iisupp.net/aria.html" });
});

addMessage("aria", "Hi — I'm ARIA. Ask me a question, or use the quick actions above.");

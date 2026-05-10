const messages = document.getElementById("messages");
const userInput = document.getElementById("userInput");
const sendMessage = document.getElementById("sendMessage");

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
document.getElementById("messages").addEventListener("click", (e) => {
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
  chrome.tabs.create({ url: "https://iisupport.net/aria.html" });
});

addMessage("aria", "Hi — I'm ARIA. Ask me a question, or use the quick actions above.");

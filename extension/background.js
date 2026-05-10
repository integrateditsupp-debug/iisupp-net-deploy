// Background service worker — proxies ARIA queries to the website's public
// endpoints (trading-news + aria-search) and schedules privacy-safe reminder
// alarms.

const ARIA_ORIGIN = "https://iisupport.net";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "ARIA_QUERY") {
    handleAriaQuery(String(message.payload || "")).then(sendResponse);
    return true;
  }
  if (message.type === "ADD_REMINDER") {
    addReminder(message.payload).then(sendResponse);
    return true;
  }
});

async function handleAriaQuery(query) {
  const q = query.trim().toLowerCase();
  try {
    if (/\b(stock|trading|market|crypto|news|ticker|bitcoin|ethereum)\b/.test(q)) {
      const r = await fetch(
        `${ARIA_ORIGIN}/.netlify/functions/trading-news?q=${encodeURIComponent(query)}`
      );
      if (!r.ok) throw new Error("news");
      const data = await r.json();
      const items = (data.items || []).slice(0, 5);
      if (items.length === 0) return { text: "No fresh market items right now." };
      return {
        html:
          "<div>" +
          items
            .map(
              (i) =>
                `<p><a href="${escape(i.url || "#")}" target="_blank" rel="noopener">${escape(
                  i.title || ""
                )}</a><br><small>${escape(i.source || "")}</small></p>`
            )
            .join("") +
          "</div>",
      };
    }

    if (/\b(go\s?transit|go\s?schedule)\b/.test(q)) {
      return {
        html: `<p>GO Transit live trip planner — <a href="https://www.gotransit.com/en/trip-planner" target="_blank" rel="noopener">gotransit.com →</a></p>`,
      };
    }

    if (/\b(compare\s?price|shop|cheapest|buy)\b/.test(q)) {
      const term = query
        .replace(/\b(compare\s?price|shopping|shop|cheapest|buy)\b/gi, "")
        .trim();
      return {
        html: `<p>Price search for <b>${escape(term || query)}</b>:<br>
          <a href="https://www.google.com/search?tbm=shop&q=${encodeURIComponent(term || query)}" target="_blank" rel="noopener">Google Shopping →</a><br>
          <a href="https://www.amazon.ca/s?k=${encodeURIComponent(term || query)}" target="_blank" rel="noopener">Amazon.ca →</a><br>
          <a href="https://www.bestbuy.ca/en-ca/search?search=${encodeURIComponent(term || query)}" target="_blank" rel="noopener">Best Buy Canada →</a>
        </p>`,
      };
    }

    const r = await fetch(
      `${ARIA_ORIGIN}/.netlify/functions/aria-search?q=${encodeURIComponent(query)}`
    );
    if (!r.ok) throw new Error("search");
    const data = await r.json();
    let html = "";
    if (data.heading) html += `<b>${escape(data.heading)}</b><br>`;
    if (data.abstract) html += `<span>${escape(data.abstract)}</span><br>`;
    if (data.abstractUrl)
      html += `<a href="${escape(data.abstractUrl)}" target="_blank" rel="noopener">Source →</a><br>`;
    html += `<a href="${escape(data.fallbackUrl)}" target="_blank" rel="noopener">Broader web results →</a>`;
    return { html };
  } catch {
    return {
      text:
        "ARIA could not reach its data sources right now. Try again, or open iisupport.net/aria.html.",
    };
  }
}

async function addReminder({ title, minutes, isPrivate }) {
  const due = Date.now() + minutes * 60000;
  const reminder = {
    id: crypto.randomUUID(),
    title: String(title).slice(0, 200),
    due,
    isPrivate: isPrivate !== false,
  };
  const data = await chrome.storage.local.get(["reminders"]);
  const reminders = data.reminders || [];
  reminders.push(reminder);
  await chrome.storage.local.set({ reminders });
  chrome.alarms.create(reminder.id, { when: due });
  return { ok: true };
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const data = await chrome.storage.local.get(["reminders"]);
  const reminders = data.reminders || [];
  const reminder = reminders.find((r) => r.id === alarm.name);
  if (!reminder) return;
  chrome.notifications.create(reminder.id, {
    type: "basic",
    iconUrl: "icons/i-128.png",
    title: "ARIA Reminder",
    message: reminder.isPrivate ? "You have a task due soon." : reminder.title,
    priority: 1,
  });
  const remaining = reminders.filter((r) => r.id !== reminder.id);
  await chrome.storage.local.set({ reminders: remaining });
});

function escape(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

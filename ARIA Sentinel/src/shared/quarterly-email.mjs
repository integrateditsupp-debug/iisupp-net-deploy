// RUN 22 §5 — quarterly report email (subject + content-blind HTML body + delivery record). Pure +
// node-safe; the Netlify function sends it via the existing Resend integration. Opt-in only.
import { redactPrivate } from "./path-guard.mjs";

const esc = (v) => redactPrivate(String(v == null ? "" : v))
  .replace(/([a-z]:\\users\\)[^\\<"]+/gi, "$1<user>")
  .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "<email>")
  .replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function emailSubject(company, q) {
  const [year, quarter] = String(q || "").split("-");
  return `ARIA Sentinel — ${quarter || "Q?"} ${year || ""} performance report for ${company || "your organization"}`.trim();
}

/** "2026-Q3" for a given date (UTC). Used by the quarterly cron + cowork bridge. */
export function quarterLabel(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

/** Lightweight HTML body: cover summary + 6 hero KPIs + a "View full report" CTA. Content-blind. */
export function emailBody(data = {}) {
  const k = data.kpis || {};
  const em = (v) => (v == null ? "--" : v);
  const pct = (v) => (v == null ? "--" : `${v}%`);
  const dollars = (v) => (v == null ? "--" : `$${Number(v).toLocaleString("en-US")}`); // RUN-B B2 — real-or-empty $
  const tiles = [
    ["Uptime (7d)", pct(k.uptime7d)],
    ["MTTR (min)", em(k.mttr)],
    ["Diagnosis accuracy", pct(k.accuracy)],
    ["SLA breaches", `${k.breaches ?? 0}`],
    ["Hours saved", em(k.hoursSaved)],
    ["Value saved", dollars(k.dollarsSaved)],            // RUN-B B2 — real ROI $ (real-or-empty)
    ["Resolved first-touch", pct(k.deflectionPct)],      // RUN-B B2 — real deflection % (real-or-empty)
    ["Version", `${k.version || "0.1.0"}`]
  ];
  // RUN-B B2 — value-proof sentence, real-or-empty (nothing rendered until a real $ or a real deflection exists).
  const _vBits = [];
  if (k.dollarsSaved != null) _vBits.push(`<b>${esc(dollars(k.dollarsSaved))}</b> of L1 effort avoided`);
  if (k.deflectionPct != null) _vBits.push(`<b>${esc(k.deflectionPct)}%</b> of issues resolved first-touch${(k.resolved != null && k.conversations != null) ? ` (${esc(k.resolved)}/${esc(k.conversations)})` : ""}`);
  const valueLine = _vBits.length ? `<p style="font-size:14px">Value proof: ${_vBits.join(", ")}.</p>` : "";
  const cards = tiles.map(([label, value]) =>
    `<td style="padding:10px 14px;border:1px solid #e6dcc2;border-radius:8px"><div style="color:#8b6d2f;font-size:11px">${esc(label)}</div><div style="font-size:20px;color:#111"><b>${esc(value)}</b></div></td>`
  ).join("");
  return `<!doctype html><html><body style="font-family:Segoe UI,system-ui,sans-serif;color:#111;margin:0;padding:24px">
  <h1 style="font-size:20px;margin:0 0 4px">ARIA Sentinel — ${esc(data.quarter || "")} report</h1>
  <p style="color:#666;margin:0 0 16px">${esc(data.company || "your organization")}</p>
  <p style="font-size:14px">ARIA resolved <b>${esc(k.incidents ?? 0)}</b> incidents this quarter, <b>${esc(k.autoPct == null ? "--" : k.autoPct + "%")}</b> automatically, saving ~<b>${esc(em(k.hoursSaved))}</b> hours.</p>
  ${valueLine}
  <table style="border-collapse:separate;border-spacing:8px"><tr>${cards}</tr></table>
  <p style="margin-top:18px"><a href="${esc(data.reportUrl || "https://iisupp.net/aria-sentinel/")}" style="background:#c5a059;color:#1a1410;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">View full report</a></p>
  <p style="color:#888;font-size:11px;margin-top:20px">Content-blind report. No usernames, machine names, file paths, or personal data is included.</p>
  </body></html>`;
}

export function deliveryRecord({ license, company, q, status = "send-attempted", now = new Date().toISOString() } = {}) {
  return { license: String(license || "").slice(0, 40), company: company || "", quarter: q, status, attemptedAt: now, delivered: status === "delivered", opened: false };
}

/** Email is sent ONLY when the customer opted in + provided a contact (privacy + anti-spam). */
export function shouldSend(prefs = {}) {
  return Boolean(prefs.optIn && prefs.contactEmail && prefs.cadence !== "off");
}

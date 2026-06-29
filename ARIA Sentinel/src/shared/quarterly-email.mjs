// RUN 22 S5 -- quarterly report email (subject + content-blind HTML body + delivery record). Pure +
// node-safe; the Netlify function sends it via the existing Resend integration. Opt-in only.
import { redactPrivate } from "./path-guard.mjs";

const esc = (v) => redactPrivate(String(v == null ? "" : v))
  .replace(/([a-z]:\\users\\)[^\\<"]+/gi, "$1<user>")
  .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "<email>")
  .replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function emailSubject(company, q) {
  const [year, quarter] = String(q || "").split("-");
  return ("ARIA Sentinel -- " + (quarter || "Q?") + " " + (year || "") + " performance report for " + (company || "your organization")).trim();
}

/** "2026-Q3" for a given date (UTC). Used by the quarterly cron + cowork bridge. */
export function quarterLabel(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return d.getUTCFullYear() + "-Q" + (Math.floor(d.getUTCMonth() / 3) + 1);
}

/** RULE 14 (A1): null metric -> "--" empty-state, never a fabricated number. */
const mv = (v, unit = "") => v == null ? "--" : (v + unit);

/** Lightweight HTML body: cover summary + 6 hero KPIs + a "View full report" CTA. Content-blind. */
export function emailBody(data = {}) {
  const k = data.kpis || {};
  // RULE 14 (A1): uptime7d must NEVER default to 100 (was uptime7d ?? 100 -- fabricated). Real-or-empty.
  const tiles = [
    ["Uptime (7d)",         mv(k.uptime7d,  "%")],
    ["MTTR (min)",          mv(k.mttr)],
    ["Diagnosis accuracy",  mv(k.accuracy,  "%")],
    ["SLA breaches",        k.breaches ?? 0],
    ["Hours saved",         mv(k.hoursSaved)],
    ["Version",             k.version || "0.1.0"]
  ];
  const cards = tiles.map(([label, value]) =>
    '<td style="padding:10px 14px;border:1px solid #e6dcc2;border-radius:8px"><div style="color:#8b6d2f;font-size:11px">' + esc(label) + '</div><div style="font-size:20px;color:#111"><b>' + esc(value) + '</b></div></td>'
  ).join("");
  // Summary sentence: only mention savings if real data exists.
  const savingsClause = k.hoursSaved != null ? (", saving ~<b>" + esc(k.hoursSaved) + "</b> hours") : "";
  const autoPctClause = k.autoPct != null ? (", <b>" + esc(k.autoPct) + "%</b> automatically") : "";
  return '<!doctype html><html><body style="font-family:Segoe UI,system-ui,sans-serif;color:#111;margin:0;padding:24px">\n  <h1 style="font-size:20px;margin:0 0 4px">ARIA Sentinel -- ' + esc(data.quarter || "") + ' report</h1>\n  <p style="color:#666;margin:0 0 16px">' + esc(data.company || "your organization") + '</p>\n  <p style="font-size:14px">ARIA resolved <b>' + esc(k.incidents ?? 0) + '</b> incidents this quarter' + autoPctClause + savingsClause + '.</p>\n  <table style="border-collapse:separate;border-spacing:8px"><tr>' + cards + '</tr></table>\n  <p style="margin-top:18px"><a href="' + esc(data.reportUrl || "https://iisupp.net/aria-sentinel/") + '" style="background:#c5a059;color:#1a1410;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">View full report</a></p>\n  <p style="color:#888;font-size:11px;margin-top:20px">Content-blind report. No usernames, machine names, file paths, or personal data is included.</p>\n  </body></html>';
}

export function deliveryRecord({ license, company, q, status = "send-attempted", now = new Date().toISOString() } = {}) {
  return { license: String(license || "").slice(0, 40), company: company || "", quarter: q, status, attemptedAt: now, delivered: status === "delivered", opened: false };
}

/** Email is sent ONLY when the customer opted in + provided a contact (privacy + anti-spam). */
export function shouldSend(prefs = {}) {
  return Boolean(prefs.optIn && prefs.contactEmail && prefs.cadence !== "off");
}

// RUN 22 §5 — quarterly report email. Admin-triggered (X-Admin-Token) on quarter-end day. For each
// active, opted-in license: build a content-blind HTML body + send via the existing Resend integration
// (RESEND_API_KEY). Dry-run when the key is absent. Delivery tracked in the "quarterly-reports" store.
import { getStore } from "@netlify/blobs";
import { requireAdminToken } from "../../src/shared/admin-auth.mjs";
import { emailSubject, emailBody, deliveryRecord, shouldSend } from "../../src/shared/quarterly-email.mjs";

function json(status, body) {
  return { statusCode: status, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

async function sendViaResend({ to, cc, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, dryRun: true }; // no key configured → dry-run (don't send)
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ from: process.env.RESEND_FROM || "ARIA Sentinel <reports@iisupp.net>", to: [to], cc: cc ? [cc] : undefined, subject, html })
    });
    return { ok: res.ok, status: res.status };
  } catch { return { ok: false, error: "send-failed" }; }
}

export async function handler(event) {
  const auth = requireAdminToken(event.headers || {}, process.env);
  if (!auth.ok) return json(auth.status, { error: auth.reason });
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad-json" }); }

  const licenses = getStore("licenses");
  const reportsLog = getStore("quarterly-reports");
  const targets = Array.isArray(body.licenses) ? body.licenses : [];
  const q = body.quarter || "";
  const results = [];

  for (const lic of targets) {
    const prefs = lic.reportPrefs || { optIn: lic.optIn, contactEmail: lic.contactEmail, cadence: lic.cadence };
    if (!shouldSend(prefs)) { results.push(deliveryRecord({ license: lic.license_key || lic.licenseId, company: lic.company, q, status: "skipped-opt-out" })); continue; }
    const data = { company: lic.company || "your organization", quarter: q, kpis: lic.kpis || {}, reportUrl: lic.reportUrl };
    const sent = await sendViaResend({ to: prefs.contactEmail, cc: prefs.cc, subject: emailSubject(lic.company, q), html: emailBody(data) });
    const rec = deliveryRecord({ license: lic.license_key || lic.licenseId, company: lic.company, q, status: sent.ok ? "delivered" : sent.dryRun ? "dry-run" : "failed" });
    try { await reportsLog.setJSON(`${q}/${rec.license}`, rec); } catch { /* logging best-effort */ }
    results.push(rec);
  }
  return json(200, { ok: true, quarter: q, sent: results.filter((r) => r.status === "delivered").length, results });
}

export const config = { path: "/.netlify/functions/aria-sentinel-quarterly-email" };

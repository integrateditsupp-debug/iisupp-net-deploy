// RUN 23 §7 — quarterly report email CRON. Fires 09:00 UTC on the 1st of every 3rd month and, for each
// active OPTED-IN tenant, emails the latest quarterly report (content-blind HTML body + the pre-generated
// PDF attachment that the desktop app uploaded to the "quarterly-reports" store) via Resend. Delivery status
// is written to the "email-send-log" store. Dry-run when RESEND_API_KEY is absent. Scheduled functions take
// no event/return {statusCode, body}; ONLY `export const config = { schedule }` registers the timer here.
import { getStore } from "@netlify/blobs";
import { emailSubject, emailBody, deliveryRecord, shouldSend, quarterLabel } from "../../src/shared/quarterly-email.mjs";

// 09:00 UTC, day 1, every 3rd month (Jan/Apr/Jul/Oct) — quarter boundaries.
export const config = { schedule: "0 9 1 */3 *" };

async function allRecords(store) {
  const out = [];
  try {
    const { blobs } = await store.list();
    for (const b of blobs || []) {
      const rec = await store.get(b.key, { type: "json" });
      if (rec) out.push(rec);
    }
  } catch { /* empty / unreachable store → no tenants */ }
  return out;
}

async function sendViaResend({ to, cc, subject, html, attachments }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, dryRun: true }; // no key configured → dry-run (don't send)
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "ARIA Sentinel <reports@iisupp.net>",
        to: [to], cc: cc ? [cc] : undefined, subject, html,
        attachments: attachments && attachments.length ? attachments : undefined
      })
    });
    return { ok: res.ok, status: res.status };
  } catch { return { ok: false, error: "send-failed" }; }
}

export async function handler() {
  const licenses = getStore("licenses");
  const reports = getStore("quarterly-reports");
  const sendLog = getStore("email-send-log");
  const q = quarterLabel(new Date());
  const records = await allRecords(licenses);
  const results = [];

  for (const lic of records) {
    const license = lic.license_key || lic.licenseId || "";
    const prefs = lic.reportPrefs || { optIn: lic.optIn, contactEmail: lic.contactEmail, cadence: lic.cadence };
    if (!shouldSend(prefs)) { results.push(deliveryRecord({ license, company: lic.company, q, status: "skipped-opt-out" })); continue; }

    // Latest pre-generated report for this license + quarter (best-effort): { pdf:base64, url, kpis }.
    let report = null;
    try { report = await reports.get(`${q}/report/${license}`, { type: "json" }); } catch { /* none yet */ }
    const data = { company: lic.company || "your organization", quarter: q, kpis: (report && report.kpis) || lic.kpis || {}, reportUrl: (report && report.url) || lic.reportUrl };
    const attachments = report && report.pdf ? [{ filename: `aria-sentinel-${q}.pdf`, content: report.pdf }] : [];

    const sent = await sendViaResend({ to: prefs.contactEmail, cc: prefs.cc, subject: emailSubject(lic.company, q), html: emailBody(data), attachments });
    const rec = deliveryRecord({ license, company: lic.company, q, status: sent.ok ? "delivered" : sent.dryRun ? "dry-run" : "failed" });
    try { await sendLog.setJSON(`${q}/${license}`, { ...rec, httpStatus: sent.status || null, hadAttachment: attachments.length > 0 }); } catch { /* logging best-effort */ }
    results.push(rec);
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, quarter: q, scanned: records.length, sent: results.filter((r) => r.status === "delivered").length, results }) };
}

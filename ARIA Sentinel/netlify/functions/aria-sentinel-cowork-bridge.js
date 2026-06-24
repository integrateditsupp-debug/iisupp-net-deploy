// RUN 23 §8 — Cowork-callable bridge. POST /aria-sentinel-cowork-bridge, gated by X-Admin-Token
// (SENTINEL_ADMIN_TOKEN). Lets the Cowork agent pull Sentinel artifacts on demand:
//   { action: "generate-report", quarter?, tenant?, saveTo?:["console","local"] }
//        → builds the content-blind report (RUN 22 report-generator), returns { html, pdf, url, summary }.
//   { action: "read-state",  tenant? } → current content-blind Sentinel state (CPU/RAM/services/recipes).
//   { action: "read-audit",  tenant?, limit? } → 🔒 R11-redacted audit-log slice.
// Reports the desktop app pre-rendered (PDF) live in the "quarterly-reports" store; generate-report attaches
// that PDF when present and (when saveTo includes "console") persists the freshly-built HTML+summary there
// so the quarterly cron (D7) can email it.
import { getStore } from "@netlify/blobs";
import { requireAdminToken } from "../../src/shared/admin-auth.mjs";
import { buildQuarterlyReport, reportIsClean } from "../../src/main/report-generator.mjs";
import { quarterLabel } from "../../src/shared/quarterly-email.mjs";
import { redactAuditSlice, redactState } from "../../src/shared/cowork-redact.mjs";
import { isBlockedPath } from "../../src/shared/path-guard.mjs";

function json(status, body) {
  return { statusCode: status, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

const b64 = (s) => Buffer.from(String(s == null ? "" : s), "utf8").toString("base64");

async function getJson(store, key) {
  try { return await store.get(key, { type: "json" }); } catch { return null; }
}

async function generateReport(body) {
  const q = body.quarter || quarterLabel(new Date());
  const tenant = body.tenant || {};
  // 🔒 R11 — refuse a tenant payload that references the off-limits folder before building anything.
  if (isBlockedPath(JSON.stringify(tenant))) return json(400, { error: "r11-blocked" });

  const data = { company: tenant.company || "your organization", quarter: q, license: tenant.license_key || tenant.license, kpis: tenant.kpis || {}, sla: tenant.sla, compliance: tenant.compliance, topIncidents: tenant.topIncidents, recurring: tenant.recurring, upcoming: tenant.upcoming };
  const report = buildQuarterlyReport(data);
  if (!reportIsClean(report.html)) return json(422, { error: "report-not-clean" }); // defense in depth

  // Attach the desktop-rendered PDF if it's already in the store.
  const reports = getStore("quarterly-reports");
  const stored = await getJson(reports, `${q}/report/${data.license || "license"}`);
  const summary = { quarter: q, filename: report.filename, sections: report.sections.map((s) => s.title), kpis: data.kpis };

  const saveTo = Array.isArray(body.saveTo) ? body.saveTo : [];
  if (saveTo.includes("console")) {
    try { await reports.setJSON(`${q}/report/${data.license || "license"}`, { kpis: data.kpis, url: stored && stored.url, summary, htmlBase64: b64(report.html), pdf: stored && stored.pdf }); } catch { /* best-effort */ }
  }

  return json(200, {
    ok: true,
    quarter: q,
    html: report.html,
    htmlBase64: b64(report.html),
    pdf: (stored && stored.pdf) || null,
    url: (stored && stored.url) || null,
    summary
  });
}

async function readState(body) {
  const tenant = String(body.tenant || "");
  const raw = (await getJson(getStore("heartbeats-latest"), tenant)) || (await getJson(getStore("sentinel-state"), tenant)) || {};
  return json(200, { ok: true, tenant, state: redactState(raw) });
}

async function readAudit(body) {
  const tenant = String(body.tenant || "");
  const limit = Math.min(500, Math.max(1, Number(body.limit) || 100));
  const raw = (await getJson(getStore("audit-log"), tenant)) || {};
  const entries = Array.isArray(raw) ? raw : (raw.entries || []);
  return json(200, { ok: true, tenant, entries: redactAuditSlice(entries, limit) });
}

export async function handler(event) {
  if ((event.httpMethod || "POST") !== "POST") return json(405, { error: "method-not-allowed" });
  const auth = requireAdminToken(event.headers || {}, process.env);
  if (!auth.ok) return json(auth.status, { error: auth.reason });

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad-json" }); }

  switch (body.action) {
    case "generate-report": return generateReport(body);
    case "read-state": return readState(body);
    case "read-audit": return readAudit(body);
    default: return json(400, { error: "unknown-action" });
  }
}

export const config = { path: "/aria-sentinel-cowork-bridge" };

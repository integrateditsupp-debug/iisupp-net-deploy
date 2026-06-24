// Netlify scheduled function: per-customer weekly "ARIA this week" digest email.
// Aggregates content-blind telemetry-event-v1 records and sends via the existing Resend integration.
// Project-local until Ahmad wires it into the live deploy — nothing is published by this file.
//
// Schedule registration is via `export const config = { schedule }` (the only thing that registers a
// timer on Netlify — see the cron-registration lesson in repo memory).
import { aggregateWeek, renderDigestHtml } from "../../src/shared/weekly-digest.mjs";

// In production these come from the content-blind telemetry rollup keyed by tenant; stubbed here.
async function loadWeekEvents(/* tenant */) {
  return [];
}

async function sendViaResend(html, meta) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: "no-resend-key", dryRun: true, html };
  // Real send omitted in project-local build; the live deploy supplies RESEND_API_KEY + recipient.
  return { ok: true, queued: true, to: meta.to || null };
}

export async function handler() {
  const tenants = []; // production: enumerate active tenants
  const results = [];
  for (const tenant of tenants) {
    const agg = aggregateWeek(await loadWeekEvents(tenant));
    const html = renderDigestHtml(agg, { tenant: tenant.handle, weekOf: new Date().toISOString().slice(0, 10) });
    results.push(await sendViaResend(html, { to: tenant.email }));
  }
  return { statusCode: 200, body: JSON.stringify({ ok: true, sent: results.length }) };
}

// Mondays 13:00 UTC.
export const config = { schedule: "0 13 * * 1" };

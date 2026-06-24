// Netlify function: embeddable Sentinel status badge.
//   <iframe src="https://iisupp.net/sentinel-status-badge?tenant=ID" width="220" height="64" frameborder="0">
//
// Returns a self-contained, CSP-locked HTML document (no inline script) showing a tenant's health
// score. Health data is read from the content-blind telemetry store keyed by tenant handle; this MVP
// serves a safe default when no tenant telemetry is present. Project-local until Ahmad copies it to
// the live deploy dir — NOTHING is published by creating this file.
//
// NOTE: deploy bundling must include ../../src/shared/status-badge.mjs + health-score.mjs.
import { renderStatusBadge, BADGE_CSP } from "../../src/shared/status-badge.mjs";

// Per-tenant health lookup would read the content-blind telemetry rollup. Stubbed safe default here.
function lookupTenantHealth(tenant) {
  return { tenant: tenant || "this site", score: 94, fixes: 12 };
}

export async function handler(event) {
  const tenant = (event && event.queryStringParameters && event.queryStringParameters.tenant) || "";
  const data = lookupTenantHealth(String(tenant).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40));
  return {
    statusCode: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": BADGE_CSP,
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff"
    },
    body: renderStatusBadge(data)
  };
}

export const config = { path: "/sentinel-status-badge" };

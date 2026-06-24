// RUN 23 §8 — Cowork-side client for the ARIA Sentinel bridge function. Codex/Claude Cowork imports this to
// pull a quarterly report (HTML/PDF), read a tenant's content-blind Sentinel state, or read an R11-redacted
// audit slice — without touching the desktop app. Auth is the SENTINEL_ADMIN_TOKEN (single admin source of
// truth, same token as the desktop admin endpoints + AXIS). `fetchImpl` is injectable for tests.
//
// Usage:
//   import { createSentinelBridge } from "./cowork-tools/sentinel-bridge.mjs";
//   const bridge = createSentinelBridge({ baseUrl: "https://iisupp.net", token: process.env.SENTINEL_ADMIN_TOKEN });
//   const report = await bridge.generateReport({ quarter: "2026-Q3", tenant: { company: "Acme", kpis: {...} }, saveTo: ["console"] });
//   const state  = await bridge.readState({ tenant: "LIC-abc" });
//   const audit  = await bridge.readAudit({ tenant: "LIC-abc", limit: 50 });

export const BRIDGE_PATH = "/.netlify/functions/aria-sentinel-cowork-bridge";

export function createSentinelBridge({ baseUrl = "", token = "", fetchImpl } = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
  if (!doFetch) throw new Error("no fetch available — pass fetchImpl");

  async function call(action, payload = {}) {
    const res = await doFetch(`${String(baseUrl).replace(/\/$/, "")}${BRIDGE_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ action, ...payload })
    });
    if (res && typeof res.json === "function") return res.json();
    return res;
  }

  return {
    generateReport: (opts = {}) => call("generate-report", opts),
    readState: (opts = {}) => call("read-state", opts),
    readAudit: (opts = {}) => call("read-audit", opts)
  };
}

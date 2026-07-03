// integrations — the single source of truth for the Integrations tab (RESTORED 2026-07-02, Rule 15).
// Holds the static card descriptors (id · group · name · icon · one-line desc) and resolves each card's
// live status from the EXISTING provider config (ServiceNow, Microsoft Entra) plus honest "not connected"
// states for the on-demand / not-yet-wired adapters (Remote assist, CRM, RSA, Office docs, browser
// extensions, Slack/Teams notify). Status resolution is SYNCHRONOUS and read-only — it never opens a
// socket and NEVER claims "connected" without a verified read (Slice-2 Test connection does that).
//
// Node-side ONLY (it imports servicenow/entra which pull node:crypto). The renderer draws cards from the
// resolved data via IPC (sentinel:get-integrations) — it never imports this module, so the renderer graph
// stays crypto-free (the 2026-07-02 dead-shell invariant). 🔒 R11 — descriptors carry no PII, no paths.
import { getServiceNowConfig, ping as serviceNowPing } from "./servicenow.mjs";
import { getGraphConfig, graphReadOnlySmoke } from "./entra-graph-client.mjs";

export const INTEGRATION_STATUSES = ["connected", "not_configured", "error"];
export const INTEGRATION_GROUPS = ["Identity & Service", "Endpoint & Collaboration", "Microsoft 365 Documents"];

// Static descriptors. Icons are plain glyphs so they render with zero asset deps. `goto` deep-links the card
// to the in-tab section (anchor id) that holds its full config.
export const INTEGRATIONS = [
  // Group A — Identity & Service
  { id: "servicenow", group: "Identity & Service", name: "ServiceNow", icon: "🛎️",
    description: "ITSM incidents, change requests, assignment-group routing.", goto: "sn-section" },
  { id: "entra", group: "Identity & Service", name: "Microsoft Entra ID / 365", icon: "🪪",
    description: "Directory: users, groups, lockouts, sign-in signals (read-only first).", goto: "entra-section" },
  { id: "crm", group: "Identity & Service", name: "CRM", icon: "📇",
    description: "Customer records & deal context (Dynamics / HubSpot)." },
  { id: "rsa", group: "Identity & Service", name: "RSA admin", icon: "🔐",
    description: "ID verification & token admin — middleman only, never biometrics." },
  // Group B — Endpoint & Collaboration
  { id: "remote", group: "Endpoint & Collaboration", name: "Remote assist (Whereby)", icon: "🖥️",
    description: "Scoped, time-boxed remote-control room started on request.", goto: "remote-section" },
  { id: "chrome-ext", group: "Endpoint & Collaboration", name: "Chrome extension", icon: "🧩",
    description: "The gold A in Chrome — fixes browser issues on-device.", goto: "ext-section" },
  { id: "edge-ext", group: "Endpoint & Collaboration", name: "Edge extension", icon: "🧩",
    description: "The gold A in Edge — fixes browser issues on-device.", goto: "ext-section" },
  { id: "notify", group: "Endpoint & Collaboration", name: "Slack / Teams notify", icon: "🔔",
    description: "Content-blind auto-fix notifications to a Slack/Teams webhook.", goto: "notify-section" },
  // Group C — Microsoft 365 Documents
  { id: "word", group: "Microsoft 365 Documents", name: "MS Word", icon: "📄",
    description: "Read/generate .docx (reports, guides)." },
  { id: "excel", group: "Microsoft 365 Documents", name: "Excel", icon: "📊",
    description: "Read/generate .xlsx (inventories, exports)." },
  { id: "powerpoint", group: "Microsoft 365 Documents", name: "PowerPoint", icon: "📑",
    description: "Generate .pptx (client decks)." },
  { id: "onenote", group: "Microsoft 365 Documents", name: "OneNote", icon: "🗒️",
    description: "Read/append notes." }
];

// Per-provider status resolver. Honest by construction: a card is 'connected' only after a verified read
// (Slice 2 Test connection). With no creds it is 'not_configured'; nothing is ever faked to look connected.
function statusFor(id, env) {
  switch (id) {
    case "servicenow": {
      const cfg = getServiceNowConfig(env);
      return cfg.configured
        ? { status: "not_configured", detail: "Credentials present — verify with Test connection (read-only)." }
        : { status: "not_configured", detail: "Not connected. Set SN_INSTANCE_URL / SN_USER / SN_PASS per customer." };
    }
    case "entra": {
      const cfg = getGraphConfig(env);
      return cfg.configured
        ? { status: "not_configured", detail: "Credentials present — verify with Test connection (read-only)." }
        : { status: "not_configured", detail: "Not connected. Set DIRECTORY_TENANT_ID / CLIENT_ID / CLIENT_SECRET." };
    }
    case "remote":
      return { status: "not_configured", detail: "No standing connection — starts a scoped 10-minute room on request." };
    case "chrome-ext":
    case "edge-ext":
      return { status: "not_configured", detail: "Install from the browser (Load unpacked) — see the steps below." };
    case "notify":
      return { status: "not_configured", detail: "Add a Slack/Teams incoming-webhook URL below to enable." };
    default:
      return { status: "not_configured", detail: "Not connected." };
  }
}

/**
 * Resolve every card into a render-ready descriptor:
 *   { id, group, name, icon, description, goto?, status, statusDetail }
 * status is clamped to the enum; an unknown value falls back to 'not_configured'.
 */
export function resolveIntegrations(env = process.env) {
  return INTEGRATIONS.map((d) => {
    const s = statusFor(d.id, env) || {};
    const status = INTEGRATION_STATUSES.includes(s.status) ? s.status : "not_configured";
    return { ...d, status, statusDetail: s.detail || "" };
  });
}

/**
 * Run a provider's READ-ONLY connection test → { ok, message }. Only ServiceNow + Entra have a live probe;
 * everything else honestly reports "no live test for this integration". Never throws (defensive catch), so a
 * misbehaving provider can never crash the UI. `options.fetch` is injectable for tests.
 */
export async function testIntegration(id, env = process.env, options = {}) {
  try {
    switch (id) {
      case "servicenow": {
        const cfg = getServiceNowConfig(env);
        if (!cfg.configured) return { ok: false, message: "Not configured — set ServiceNow credentials first." };
        const r = await serviceNowPing(cfg.instanceUrl, cfg.user, cfg.pass, options);
        return { ok: Boolean(r && r.ok), message: r && r.ok ? "Connected (read-only OK)." : `Not reachable (status ${r && r.status != null ? r.status : "?"}).` };
      }
      case "entra": {
        const cfg = getGraphConfig(env);
        if (!cfg.configured) return { ok: false, message: "Not configured — set Entra credentials first." };
        const r = await graphReadOnlySmoke(env, options);
        return { ok: Boolean(r && r.ok), message: r && r.ok ? "Connected (read-only OK)." : `Not reachable (${(r && r.reason) || "unverified"}).` };
      }
      default:
        return { ok: false, message: "No live connection test for this integration." };
    }
  } catch {
    return { ok: false, message: "Connection test failed." };
  }
}

// integrations — the single source of truth for the Integrations tab. Holds the 8 static card
// descriptors (id · group · name · icon · one-line desc · edition gate) and resolves each card's
// live status from the EXISTING provider health checks (ServiceNow, Entra) plus thin stubs for the
// not-yet-wired adapters (CRM, RSA, Office). Status resolution is SYNCHRONOUS and read-only — it
// never opens a socket and NEVER claims "connected" without a verified read. The renderer draws
// cards from resolveIntegrations(); tests assert the descriptors + edition gating. 🔒 R11 — no PII.

import { getEdition } from "./edition.mjs";
import { getServiceNowConfig, testConnection as serviceNowTest } from "./servicenow.mjs";
import * as directory from "./directory.mjs";
import * as crm from "./crm.mjs";
import * as rsa from "./rsa-admin.mjs";
import * as office from "./office-msgraph.mjs";

export const INTEGRATION_STATUSES = ["connected", "not_configured", "error"];
export const INTEGRATION_GROUPS = ["Identity & Service", "Microsoft 365 Documents"];

// Static descriptors. edition:'integrated' cards are hidden in the Standalone build; 'any' shows
// in both. Icons are plain glyphs so they render with zero asset deps.
export const INTEGRATIONS = [
  // Group A — Identity & Service (Integrated edition only)
  { id: "servicenow", group: "Identity & Service", name: "ServiceNow", icon: "🛎️",
    description: "ITSM tickets, incidents, change requests.", edition: "integrated" },
  { id: "crm", group: "Identity & Service", name: "CRM", icon: "📇",
    description: "Customer records & deal context (Dynamics / HubSpot).", edition: "integrated" },
  { id: "entra", group: "Identity & Service", name: "Azure AD / Microsoft Entra ID", icon: "🪪",
    description: "Directory: users, groups, lockouts, devices (read-only first).", edition: "integrated" },
  { id: "rsa", group: "Identity & Service", name: "RSA admin", icon: "🔐",
    description: "ID verification & token admin — middleman only, never biometrics.", edition: "integrated" },
  // Group B — Microsoft 365 Documents (any edition)
  { id: "word", group: "Microsoft 365 Documents", name: "MS Word", icon: "📄",
    description: "Read/generate .docx (reports, guides).", edition: "any" },
  { id: "excel", group: "Microsoft 365 Documents", name: "Excel", icon: "📊",
    description: "Read/generate .xlsx (inventories, exports).", edition: "any" },
  { id: "powerpoint", group: "Microsoft 365 Documents", name: "PowerPoint", icon: "📑",
    description: "Generate .pptx (client decks).", edition: "any" },
  { id: "onenote", group: "Microsoft 365 Documents", name: "OneNote", icon: "🗒️",
    description: "Read/append notes.", edition: "any" }
];

export function isVisibleForEdition(descriptor, edition) {
  return descriptor.edition === "any" || descriptor.edition === edition;
}

/** The descriptors visible for an edition (Standalone hides the 4 'integrated' cards). */
export function visibleIntegrations(edition = getEdition()) {
  return INTEGRATIONS.filter((d) => isVisibleForEdition(d, edition));
}

// Per-provider status resolver. Honest by construction: a card is 'connected' only after a verified
// read (Slice 2). With no creds it is 'not_configured'; a malformed/partial config is 'error'.
function statusFor(id, env) {
  switch (id) {
    case "servicenow": {
      const cfg = getServiceNowConfig(env);
      return cfg.configured
        ? { status: "not_configured", detail: "Credentials present — verify with Test connection (read-only)" }
        : { status: "not_configured", detail: "ServiceNow credentials not set" };
    }
    case "entra": return directory.getStatus(env);
    case "crm": return crm.getStatus(env);
    case "rsa": return rsa.getStatus(env);
    case "word":
    case "excel":
    case "powerpoint":
    case "onenote": return office.getStatus(id, env);
    default: return { status: "not_configured", detail: "" };
  }
}

/**
 * Resolve the visible cards for an edition into render-ready descriptors:
 *   { id, group, name, icon, description, edition, status, statusDetail }
 * status is clamped to the enum; an unknown value falls back to 'not_configured'.
 */
export function resolveIntegrations(env = process.env, edition = getEdition(env)) {
  return visibleIntegrations(edition).map((d) => {
    const s = statusFor(d.id, env) || {};
    const status = INTEGRATION_STATUSES.includes(s.status) ? s.status : "not_configured";
    return { ...d, status, statusDetail: s.detail || "" };
  });
}

/**
 * Run a provider's READ-ONLY connection test and normalize the result to { ok, message }. Every
 * provider's testConnection is read-only and never throws; this dispatcher adds a defensive catch so a
 * misbehaving provider can never crash the UI. `options.fetch` is injectable for tests.
 */
export async function testIntegration(id, env = process.env, options = {}) {
  try {
    let r;
    switch (id) {
      case "servicenow": r = await serviceNowTest(env, options); break;
      case "entra": r = await directory.testConnection(env, options); break;
      case "crm": r = await crm.testConnection(env, options); break;
      case "rsa": r = await rsa.testConnection(env, options); break;
      case "word":
      case "excel":
      case "powerpoint":
      case "onenote": r = await office.testConnection(id, env, options); break;
      default: r = { ok: false, message: "Unknown integration" };
    }
    const ok = Boolean(r && r.ok);
    return { ok, message: String((r && r.message) || (ok ? "Connected" : "Not configured")) };
  } catch {
    return { ok: false, message: "Connection test failed" };
  }
}

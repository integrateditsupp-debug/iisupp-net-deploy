// edition — Standalone vs Integrated. The Integrated edition unlocks the directory / RSA /
// ServiceNow / CRM integrations; Standalone HIDES them so a personal install stays clean.
// Derived from an explicit SENTINEL_EDITION env (set by the MDM/installer) and defaults to
// 'integrated' for the IIS-managed build. 🔒 R11 — pure: no PII, no filesystem here.

export const EDITIONS = ["standalone", "integrated"];

/** Coerce any input to a known edition, or null when unrecognized. */
export function normalizeEdition(value) {
  const v = String(value || "").trim().toLowerCase();
  return EDITIONS.includes(v) ? v : null;
}

/**
 * The active edition. An installer/MDM sets SENTINEL_EDITION=standalone for a personal build;
 * everything else (incl. unset) is the IIS-managed Integrated edition.
 */
export function getEdition(env = process.env) {
  return normalizeEdition(env && env.SENTINEL_EDITION) || "integrated";
}

export function isIntegrated(env = process.env) {
  return getEdition(env) === "integrated";
}

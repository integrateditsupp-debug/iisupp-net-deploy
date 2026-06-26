// directory — read-only Microsoft Entra ID (Azure AD) status for the Integrations tab.
// Slice 1: status is config-presence ONLY (no token call) so we never claim "connected" without a
// verified read. 'connected' requires a read-only token + sample read and is wired in Slice 2 via
// entra-graph-client. This module NEVER writes to the directory (no lockout clears, no resets) —
// read-only is the contract.

import { hasEntraCredentials, readOnlyProbe } from "./entra-graph-client.mjs";

/** Honest status: grey until a read-only token verifies. */
export function getStatus(env = process.env) {
  if (!hasEntraCredentials(env)) {
    return { status: "not_configured", detail: "Tenant / client credentials not set" };
  }
  return { status: "not_configured", detail: "Credentials present — run Test connection to verify (read-only)" };
}

/**
 * Read-only health check: without creds → { ok:false, "Not configured" }; with creds → acquire a token
 * and issue a single GET /users?$top=1 (no writes). Never throws. `options.fetch` is injectable for tests.
 */
export async function testConnection(env = process.env, options = {}) {
  if (!hasEntraCredentials(env)) return { ok: false, message: "Not configured" };
  try {
    return await readOnlyProbe(env, options);
  } catch {
    return { ok: false, message: "Directory check failed" };
  }
}

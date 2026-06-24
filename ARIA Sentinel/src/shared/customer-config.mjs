// customer-config — the per-customer kill switch / scoping layer.
//
// When an MDM (Intune, Workspace ONE, etc.) drops a customer.json into the agent's
// data dir, ARIA scopes all recipe/KB pulls to that customer and caches the customer's
// policy bundle locally. Absence of the file = unmanaged install (personal / trial).
//
// This file holds NO user content — only an opaque customer id, a display name, and a
// cached policy-bundle pointer. It is the per-customer level of the 3-level kill model:
//   per-endpoint  -> tray "Pause for 24 hours"
//   per-customer  -> customer.json { disabled:true } puts THIS install in detect-only
//   global/fleet  -> control-plane response { killed:true } (see main.applyControlPlaneKill)
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

export function customerConfigPath() {
  // %APPDATA%-adjacent home dir keeps this consistent with the KB store location.
  return path.join(os.homedir(), ".aria-sentinel", "customer.json");
}

/**
 * Load + normalise the MDM-provided customer config. Never throws.
 * Returns null when unmanaged. The returned object is strictly shaped — any extra
 * keys an MDM (or an attacker editing the file) adds are dropped on the floor.
 */
export function loadCustomerConfig(filePath = customerConfigPath()) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return normalizeCustomerConfig(raw);
  } catch {
    return null;
  }
}

export function normalizeCustomerConfig(raw) {
  if (!raw || typeof raw !== "object") return null;
  const customerId = sanitizeId(raw.customerId ?? raw.customer_id ?? raw.id);
  if (!customerId) return null;
  return {
    customerId,
    displayName: sanitizeName(raw.displayName ?? raw.name ?? customerId),
    disabled: Boolean(raw.disabled), // per-customer kill: detect-only when true
    policyBundleId: sanitizeId(raw.policyBundleId ?? raw.policy_bundle_id ?? ""),
    region: sanitizeId(raw.region ?? "")
  };
}

function sanitizeId(value) {
  // Opaque, machine-issued ids only: letters, digits, dot, dash, underscore.
  return String(value || "").trim().replace(/[^A-Za-z0-9._-]/g, "").slice(0, 64);
}

function sanitizeName(value) {
  return String(value || "").trim().replace(/[\r\n\t]/g, " ").slice(0, 80);
}

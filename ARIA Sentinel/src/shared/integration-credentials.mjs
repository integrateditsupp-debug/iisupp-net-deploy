// integration-credentials — the secure in-app credentials store behind the Integrations "Configure"
// panels. Holds the per-provider connection secrets (Entra, CRM/Dynamics, ServiceNow) ENCRYPTED at
// rest via Electron safeStorage (OS-backed: DPAPI on Windows, Keychain on macOS) — never plaintext.
// On load they are decrypted and fed into the SAME env keys the providers already read, so
// resolveIntegrations / testIntegration light up unchanged. 🔒 R11 / RULE 14 / privacy invariants:
//   • Secrets are encrypted local-only; the file never holds plaintext secrets.
//   • Secret values are NEVER returned to the renderer (maskedView returns {set} only) and NEVER logged.
//   • Nothing here opens a socket — values only ever reach the provider's own GET via testIntegration.
// Pure + dependency-injected (safeStorage / fs / dir) so it unit-tests without Electron.

export const CREDENTIALS_FILE = "integration-credentials.enc";

// Per-provider field map. `env` is the existing env key each provider already reads; `secret:true`
// fields are masked in the UI, never echoed back, and treated as "unchanged" when submitted blank.
export const CREDENTIAL_FIELDS = {
  entra: {
    label: "Azure AD / Microsoft Entra ID",
    fields: [
      { key: "tenantId", env: "DIRECTORY_TENANT_ID", label: "Directory (tenant) ID", secret: false },
      { key: "clientId", env: "DIRECTORY_CLIENT_ID", label: "Application (client) ID", secret: false },
      { key: "clientSecret", env: "DIRECTORY_CLIENT_SECRET", label: "Client secret", secret: true }
    ]
  },
  crm: {
    label: "CRM (Dynamics / HubSpot)",
    fields: [
      { key: "dynamicsUrl", env: "DYNAMICS_URL", label: "Dynamics / Dataverse URL", secret: false },
      { key: "hubspotToken", env: "CRM_TOKEN", label: "HubSpot private-app token", secret: true }
    ]
  },
  servicenow: {
    label: "ServiceNow",
    fields: [
      { key: "instanceUrl", env: "SN_INSTANCE_URL", label: "Instance URL", secret: false },
      { key: "user", env: "SN_USER", label: "Integration user", secret: false },
      { key: "password", env: "SN_PASS", label: "Password", secret: true }
    ]
  }
};

export const CONFIGURABLE_PROVIDERS = Object.keys(CREDENTIAL_FIELDS);

function fieldDef(provider, key) {
  const p = CREDENTIAL_FIELDS[provider];
  return p && p.fields.find((f) => f.key === key);
}

/** Keep only known providers/fields, coerce to trimmed strings; drop empty values. */
export function sanitizeCredentials(input = {}) {
  const out = {};
  for (const provider of CONFIGURABLE_PROVIDERS) {
    const incoming = input && input[provider];
    if (!incoming || typeof incoming !== "object") continue;
    const clean = {};
    for (const f of CREDENTIAL_FIELDS[provider].fields) {
      const v = incoming[f.key];
      if (v == null) continue;
      const s = String(v).trim();
      if (s) clean[f.key] = s;
    }
    if (Object.keys(clean).length) out[provider] = clean;
  }
  return out;
}

/**
 * Merge a submitted patch onto the stored credentials. A blank SECRET field means "leave the stored
 * secret unchanged" (the UI never echoes secrets, so a blank submit must not wipe them). A blank
 * NON-secret field clears that field. Unknown providers/fields are ignored.
 */
export function mergeCredentials(stored = {}, patch = {}) {
  const out = {};
  // Start from a deep-ish copy of stored (known fields only).
  for (const provider of CONFIGURABLE_PROVIDERS) {
    if (stored && stored[provider]) out[provider] = { ...stored[provider] };
  }
  for (const provider of CONFIGURABLE_PROVIDERS) {
    const incoming = patch && patch[provider];
    if (!incoming || typeof incoming !== "object") continue;
    const target = out[provider] || {};
    for (const f of CREDENTIAL_FIELDS[provider].fields) {
      if (!(f.key in incoming)) continue; // not submitted → unchanged
      const raw = incoming[f.key];
      const s = raw == null ? "" : String(raw).trim();
      if (s === "") {
        if (f.secret) continue;           // blank secret → keep existing
        delete target[f.key];             // blank non-secret → clear
      } else {
        target[f.key] = s;
      }
    }
    if (Object.keys(target).length) out[provider] = target;
    else delete out[provider];
  }
  return out;
}

/** Map stored credentials → an env object (only present, non-empty fields). */
export function credentialsToEnv(creds = {}) {
  const env = {};
  for (const provider of CONFIGURABLE_PROVIDERS) {
    const vals = creds && creds[provider];
    if (!vals) continue;
    for (const f of CREDENTIAL_FIELDS[provider].fields) {
      const v = vals[f.key];
      if (v != null && String(v) !== "") env[f.env] = String(v);
    }
  }
  return env;
}

/** Apply stored credentials onto a target env (defaults to process.env). UI is source of truth → override. */
export function applyCredentialsToEnv(creds = {}, env = (typeof process !== "undefined" ? process.env : {})) {
  const mapped = credentialsToEnv(creds);
  for (const [k, v] of Object.entries(mapped)) env[k] = v;
  return env;
}

/**
 * Renderer-safe view: per provider/field { set, value }. SECRET fields NEVER include `value` — only
 * whether one is stored. Non-secret fields echo their value so the form can pre-fill + edit them.
 */
export function maskedView(creds = {}) {
  const view = {};
  for (const provider of CONFIGURABLE_PROVIDERS) {
    const vals = (creds && creds[provider]) || {};
    view[provider] = { label: CREDENTIAL_FIELDS[provider].label, fields: {} };
    for (const f of CREDENTIAL_FIELDS[provider].fields) {
      const has = vals[f.key] != null && String(vals[f.key]) !== "";
      view[provider].fields[f.key] = f.secret
        ? { set: has, secret: true, label: f.label }
        : { set: has, secret: false, label: f.label, value: has ? String(vals[f.key]) : "" };
    }
  }
  return view;
}

function filePath(fs, dir) { return joinPath(dir, CREDENTIALS_FILE); }
// Minimal path join so the module needs no node:path import in the renderer-shared layer.
function joinPath(dir, name) {
  if (!dir) return name;
  return /[\\/]$/.test(dir) ? dir + name : dir + "/" + name;
}

/**
 * Encrypt + persist credentials. Requires a working safeStorage; if encryption is unavailable it
 * REFUSES and writes nothing (never falls back to plaintext). Merges onto any existing store so a
 * single-provider save preserves the others and blank secrets stay intact.
 * deps: { safeStorage, fs, dir }. Returns { ok, error? }.
 */
export function saveCredentials(patch, deps = {}) {
  const { safeStorage, fs, dir } = deps;
  if (!safeStorage || typeof safeStorage.isEncryptionAvailable !== "function" || !safeStorage.isEncryptionAvailable()) {
    return { ok: false, error: "encryption-unavailable" };
  }
  try {
    const stored = loadCredentials(deps);
    const merged = sanitizeCredentials(mergeCredentials(stored, patch));
    const cipher = safeStorage.encryptString(JSON.stringify(merged)); // Buffer
    const b64 = Buffer.from(cipher).toString("base64");
    fs.writeFileSync(filePath(fs, dir), b64, { encoding: "utf8", mode: 0o600 });
    return { ok: true };
  } catch {
    return { ok: false, error: "save-failed" };
  }
}

/** Decrypt + load credentials. Returns {} when absent/unavailable/corrupt — never throws, never logs. */
export function loadCredentials(deps = {}) {
  const { safeStorage, fs, dir } = deps;
  try {
    const fp = filePath(fs, dir);
    if (!fs.existsSync(fp)) return {};
    if (!safeStorage || !safeStorage.isEncryptionAvailable || !safeStorage.isEncryptionAvailable()) return {};
    const b64 = fs.readFileSync(fp, "utf8");
    const buf = Buffer.from(String(b64).trim(), "base64");
    const json = safeStorage.decryptString(buf);
    const parsed = JSON.parse(json);
    return sanitizeCredentials(parsed);
  } catch {
    return {};
  }
}

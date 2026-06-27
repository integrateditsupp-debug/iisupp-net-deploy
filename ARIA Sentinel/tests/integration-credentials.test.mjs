// Secure in-app credentials store — the Integrations "Configure" panels. Locks the privacy + security
// invariants: secrets are encrypted at rest (never plaintext on disk), NEVER returned to the renderer
// (maskedView), the store refuses to write when OS encryption is unavailable, save→load round-trips,
// merge preserves blank secrets, and decrypted creds feed the SAME env keys the providers read so
// resolveIntegrations lights up. 🔒 R11 / RULE 14 — no PII, no plaintext secrets, no logging.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  CREDENTIAL_FIELDS, CONFIGURABLE_PROVIDERS, CREDENTIALS_FILE,
  sanitizeCredentials, mergeCredentials, credentialsToEnv, applyCredentialsToEnv,
  maskedView, saveCredentials, loadCredentials
} from "../src/shared/integration-credentials.mjs";
import { resolveIntegrations } from "../src/shared/integrations.mjs";

let tests = 0;
const ok = (label) => { tests++; console.log(`  ✓ ${label}`); };

// A reversible fake safeStorage: reverses the string so the on-disk bytes do NOT contain the forward
// plaintext (mirrors that real safeStorage stores ciphertext, not plaintext). isEncryptionAvailable
// is toggleable to exercise the refuse-to-write path.
function fakeSafeStorage(available = true) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (s) => Buffer.from(String(s).split("").reverse().join(""), "utf8"),
    decryptString: (buf) => Buffer.from(buf).toString("utf8").split("").reverse().join("")
  };
}

function tmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aria-creds-"));
  return dir;
}

const SECRET = "SuperSecretClientValue-9f3a";
const SAMPLE = {
  entra: { tenantId: "11111111-tenant", clientId: "22222222-client", clientSecret: SECRET },
  servicenow: { instanceUrl: "https://dev12345.service-now.com", user: "aria.integration", password: "snPass!42" },
  crm: { dynamicsUrl: "https://org.crm.dynamics.com" }
};

// ── 1 · Field map covers the 3 configurable providers with the right env keys + secret flags ──
assert.deepEqual(CONFIGURABLE_PROVIDERS, ["entra", "crm", "servicenow"], "3 configurable providers");
assert.equal(CREDENTIAL_FIELDS.entra.fields.find((f) => f.key === "clientSecret").env, "DIRECTORY_CLIENT_SECRET");
assert.equal(CREDENTIAL_FIELDS.entra.fields.find((f) => f.key === "clientSecret").secret, true, "client secret is a secret field");
assert.equal(CREDENTIAL_FIELDS.servicenow.fields.find((f) => f.key === "password").env, "SN_PASS", "ServiceNow password → SN_PASS (real provider key)");
assert.equal(CREDENTIAL_FIELDS.crm.fields.find((f) => f.key === "dynamicsUrl").env, "DYNAMICS_URL");
ok("field map: 3 providers, correct env keys (DIRECTORY_*/SN_PASS/DYNAMICS_URL), secret flags");

// ── 2 · credentialsToEnv maps to the env keys the providers read ──
const env = credentialsToEnv(SAMPLE);
assert.equal(env.DIRECTORY_TENANT_ID, "11111111-tenant");
assert.equal(env.DIRECTORY_CLIENT_SECRET, SECRET);
assert.equal(env.SN_INSTANCE_URL, "https://dev12345.service-now.com");
assert.equal(env.SN_USER, "aria.integration");
assert.equal(env.SN_PASS, "snPass!42");
assert.equal(env.DYNAMICS_URL, "https://org.crm.dynamics.com");
ok("credentialsToEnv maps every field to its provider env key");

// ── 3 · Applied env makes resolveIntegrations report 'credentials present' (still grey, never faked) ──
const merged = applyCredentialsToEnv(SAMPLE, {});
const resolved = resolveIntegrations(merged, "integrated");
const entraCard = resolved.find((c) => c.id === "entra");
const snCard = resolved.find((c) => c.id === "servicenow");
assert.match(entraCard.statusDetail, /present/i, "Entra detail flips to 'credentials present' once creds applied");
assert.equal(entraCard.status, "not_configured", "still grey — never a pre-emptive 'connected' without a verified read");
assert.match(snCard.statusDetail, /present/i, "ServiceNow detail reflects creds present");
ok("decrypted creds feed resolveIntegrations — detail flips to 'present', status stays honest");

// ── 4 · maskedView NEVER returns secret values; non-secret values echo ──
const view = maskedView(SAMPLE);
assert.equal(view.entra.fields.clientSecret.set, true, "secret reported as set");
assert.ok(!("value" in view.entra.fields.clientSecret), "secret value is NEVER included in the masked view");
assert.equal(view.entra.fields.tenantId.value, "11111111-tenant", "non-secret value echoes for pre-fill");
const viewJson = JSON.stringify(view);
assert.ok(!viewJson.includes(SECRET), "the masked view JSON contains no secret value anywhere");
ok("maskedView withholds every secret value, echoes only non-secret fields");

// ── 5 · Save → encrypt → on-disk file contains NO plaintext secret; load round-trips ──
const dir = tmpDir();
const deps = { safeStorage: fakeSafeStorage(true), fs, dir };
const saved = saveCredentials(SAMPLE, deps);
assert.equal(saved.ok, true, "save succeeds when encryption is available");
const onDisk = fs.readFileSync(path.join(dir, CREDENTIALS_FILE), "utf8");
assert.ok(!onDisk.includes(SECRET), "plaintext secret is NOT present in the stored file");
assert.ok(!onDisk.includes("snPass!42"), "plaintext ServiceNow password is NOT present in the stored file");
const loaded = loadCredentials(deps);
assert.equal(loaded.entra.clientSecret, SECRET, "decrypt round-trips the secret back exactly");
assert.equal(loaded.servicenow.password, "snPass!42", "decrypt round-trips the ServiceNow password");
assert.equal(loaded.crm.dynamicsUrl, "https://org.crm.dynamics.com", "decrypt round-trips the Dynamics URL");
ok("save encrypts (no plaintext on disk) and load decrypts the exact values");

// ── 6 · Refuse to write when OS encryption is unavailable — NO file, NO plaintext fallback ──
const dir2 = tmpDir();
const deps2 = { safeStorage: fakeSafeStorage(false), fs, dir: dir2 };
const refused = saveCredentials(SAMPLE, deps2);
assert.equal(refused.ok, false, "save refuses without encryption");
assert.equal(refused.error, "encryption-unavailable", "explicit error returned");
assert.equal(fs.existsSync(path.join(dir2, CREDENTIALS_FILE)), false, "NO file is written (never a plaintext fallback)");
ok("refuses to persist when encryption unavailable — never falls back to plaintext");

// ── 7 · Merge: a blank secret is left UNCHANGED; a blank non-secret clears; others preserved ──
const stored = { entra: { tenantId: "T", clientId: "C", clientSecret: "KEEP-ME" } };
const patched = mergeCredentials(stored, { entra: { tenantId: "T2", clientSecret: "" } });
assert.equal(patched.entra.clientSecret, "KEEP-ME", "blank secret submit keeps the stored secret");
assert.equal(patched.entra.tenantId, "T2", "non-secret update applies");
assert.equal(patched.entra.clientId, "C", "unsubmitted field preserved");
const cleared = mergeCredentials(stored, { entra: { clientId: "" } });
assert.ok(!("clientId" in (cleared.entra || {})), "blank non-secret clears that field");
ok("merge preserves blank secrets, applies updates, clears blank non-secrets");

// ── 8 · Save merges onto existing store — single-provider save keeps the others ──
const dir3 = tmpDir();
const deps3 = { safeStorage: fakeSafeStorage(true), fs, dir: dir3 };
saveCredentials({ entra: SAMPLE.entra }, deps3);
saveCredentials({ servicenow: SAMPLE.servicenow }, deps3);
const both = loadCredentials(deps3);
assert.equal(both.entra.clientSecret, SECRET, "first provider survives the second save");
assert.equal(both.servicenow.user, "aria.integration", "second provider persisted");
ok("single-provider save merges — does not wipe the other providers");

// ── 9 · sanitize drops unknown providers/fields + empty values ──
const clean = sanitizeCredentials({ entra: { tenantId: " T ", junk: "x" }, bogus: { a: 1 }, crm: { dynamicsUrl: "" } });
assert.deepEqual(clean, { entra: { tenantId: "T" } }, "trims, drops unknown provider/field + empty value");
ok("sanitize keeps only known non-empty fields");

// ── 10 · loadCredentials returns {} (never throws) on absent / unavailable / corrupt store ──
assert.deepEqual(loadCredentials({ safeStorage: fakeSafeStorage(true), fs, dir: tmpDir() }), {}, "absent store → {}");
const dir4 = tmpDir();
fs.writeFileSync(path.join(dir4, CREDENTIALS_FILE), "not-valid-base64-or-cipher", "utf8");
assert.deepEqual(loadCredentials({ safeStorage: fakeSafeStorage(true), fs, dir: dir4 }), {}, "corrupt store → {} (never throws)");
ok("loadCredentials is total: {} on absent/unavailable/corrupt, never throws");

assert.equal(tests, 10, "integration-credentials runs exactly 10 test cases");
console.log(`Integration-credentials test passed (${tests}/10 · encrypted-at-rest · no plaintext on disk · secrets never returned · refuse-without-encryption · env-fed · merge-safe).`);

// RUN 10 — trial license. HMAC verifies, tamper fails, expiry falls back to Manual (never locks out).
import assert from "node:assert/strict";
import { issueLicense, verifyLicense, daysRemaining } from "../src/shared/license.mjs";

const SECRET = "test-secret-key";
const NOW = Date.parse("2026-06-19T12:00:00.000Z");

const lic = issueLicense({ email: "User@Example.com", days: 30, secret: SECRET, now: NOW });
assert.equal(lic.email, "user@example.com", "email normalized");
assert.ok(lic.key.length === 64, "HMAC-SHA256 hex key");
assert.ok(lic.trialEnd > NOW);

// Valid within the window → trial mode.
const v = verifyLicense({ ...lic, secret: SECRET, now: NOW + 10 * 24 * 60 * 60 * 1000 });
assert.equal(v.valid, true);
assert.equal(v.mode, "trial");
assert.equal(daysRemaining(lic.trialEnd, NOW + 10 * 24 * 60 * 60 * 1000), 20);

// Tampered key → invalid (wrong signature), not trusted.
assert.equal(verifyLicense({ ...lic, key: lic.key.replace(/.$/, "0"), secret: SECRET, now: NOW }).valid, false);
// Tampered trialEnd (extend the trial) → signature no longer matches.
assert.equal(verifyLicense({ ...lic, trialEnd: lic.trialEnd + 999 * 86400000, secret: SECRET, now: NOW }).valid, false);
// Wrong secret → invalid.
assert.equal(verifyLicense({ ...lic, secret: "other", now: NOW }).valid, false);

// Expired-but-authentic → falls back to Manual (free), not locked out.
const expired = verifyLicense({ ...lic, secret: SECRET, now: lic.trialEnd + 1000 });
assert.equal(expired.valid, false);
assert.equal(expired.expired, true);
assert.equal(expired.mode, "manual", "after trial → Manual mode, never hard-locked");
assert.equal(daysRemaining(lic.trialEnd, lic.trialEnd + 86400000), 0);

console.log("License test passed (HMAC verify · tamper-proof · expiry → Manual fallback).");

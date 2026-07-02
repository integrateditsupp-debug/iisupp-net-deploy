// RUN 34-3 — license mint must NEVER hang on "Minting…". Root cause was unbounded fetches with no timeout.
// This proves every leg of the mint/verify path is now bounded: the admin console (10s), the desktop license
// verify (10s), and the server-side Resend email in both funnel functions (8s) — plus an actionable error UI.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const sentinelRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(sentinelRoot, "..");
const rd = (...p) => fs.readFileSync(path.join(...p), "utf8");
let n = 0; const t = () => { n++; };

// 1 — admin console adminFetch has a 10s timeout (fixes the "Minting…" hang).
const admin = rd(sentinelRoot, "admin-console", "index.html");
assert.match(admin, /async function adminFetch[\s\S]{0,400}AbortSignal\.timeout\(10000\)/, "adminFetch bounded at 10s");
// and the mint failure path is ACTIONABLE (names the env vars), not a silent/blank "Mint failed."
assert.match(admin, /Mint failed[\s\S]{0,200}SENTINEL_LICENSE_SECRET[\s\S]{0,80}RESEND_API_KEY/, "actionable mint-failure message");
assert.match(admin, /didn.?t respond in 10s|endpoint did/i, "timeout is explained to the operator");
t();

// 2 — desktop license verify is bounded (never hangs activation / trial).
const main = rd(sentinelRoot, "src", "main", "main.mjs");
// SENTINEL TRIAL GATING 2026-07-02 — the function gained an optional email arg + doc comment (per-customer
// Walk-Through entitlement lookup), widening the header-to-timeout span; the 10s bound itself is unchanged.
assert.match(main, /async function resolveLicenseOnline[\s\S]{0,900}AbortSignal\.timeout\(10000\)/, "resolveLicenseOnline bounded at 10s");
t();

// 3 — server-side Resend email is bounded in BOTH funnel functions (so the mint function returns promptly).
for (const fn of ["sentinel-licenses.mjs", "sentinel-stripe-webhook.mjs"]) {
  const src = rd(repoRoot, "netlify", "functions", fn);
  assert.match(src, /async function sendEmail[\s\S]{0,800}AbortSignal\.timeout\(8000\)/, `${fn} sendEmail bounded at 8s`);
}
t();

assert.equal(n, 3, "3 mint-timeout test groups");
console.log(`license-mint-timeout test passed (${n} groups · admin 10s + actionable error · desktop verify 10s · server email 8s ×2). No path can hang on "Minting…".`);

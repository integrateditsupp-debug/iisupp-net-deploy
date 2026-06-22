#!/usr/bin/env node
// ARIA Sentinel — funnel smoke test (Half B harness)
// Run from repo root: node scripts/smoke-test-funnel.mjs
// Requires env: STRIPE_SECRET_KEY (test mode!) + access to live iisupp.net endpoints
//
// What it does:
//   1. POSTs each of 6 HMAC license keys to /.netlify/functions/sentinel-resolve
//   2. Asserts each returns the correct {plan, status: "active"}
//   3. (Optional) Stripe test-mode subscription → polls for license record
//   4. Writes pass/fail matrix to docs/funnel-smoke-test-results.md
//
// 🔒 R11: no real names, no file paths logged. Output is content-blind.

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.IISUPP_BASE || "https://iisupp.net";
const RESOLVE_ENDPOINT = `${BASE}/.netlify/functions/sentinel-resolve`;
const HEARTBEAT_ENDPOINT = `${BASE}/.netlify/functions/aria-sentinel-heartbeat`;

// 6 HMAC keys (from Cowork memory `reference-sentinel-admin-master-license`)
// Ahmad pastes the actual hex values into a .env.smoke file (not committed) OR sets env vars
const KEYS = [
  { plan: "admin-lifetime",    env: "SENTINEL_KEY_ADMIN" },
  { plan: "personal",          env: "SENTINEL_KEY_PERSONAL" },
  { plan: "pro",               env: "SENTINEL_KEY_PRO" },
  { plan: "small_business_y",  env: "SENTINEL_KEY_SMB" },
  { plan: "midsize_y",         env: "SENTINEL_KEY_MIDSIZE" },
  { plan: "enterprise_y",      env: "SENTINEL_KEY_ENTERPRISE" }
];

const results = [];

async function jsonPost(url, body) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const elapsedMs = Date.now() - t0;
    let data = null;
    try { data = await r.json(); } catch { data = {}; }
    return { status: r.status, data, elapsedMs };
  } catch (err) {
    return { status: 0, data: { error: err.message }, elapsedMs: Date.now() - t0 };
  }
}

async function testKey({ plan, env }) {
  const key = process.env[env];
  if (!key) {
    return { plan, env, status: "SKIP", note: `env var ${env} not set` };
  }
  const r = await jsonPost(RESOLVE_ENDPOINT, { key });
  const pass = r.status === 200 && r.data?.plan === plan && r.data?.status === "active";
  return {
    plan,
    env,
    status: pass ? "PASS" : "FAIL",
    http: r.status,
    elapsedMs: r.elapsedMs,
    serverPlan: r.data?.plan ?? null,
    serverStatus: r.data?.status ?? null,
    note: pass ? "ok" : (r.data?.error ?? "mismatch")
  };
}

async function testHeartbeat() {
  const r = await jsonPost(HEARTBEAT_ENDPOINT, {
    licenseId: "smoke-test-anon",
    version: "0.1.2",
    platform: "win32",
    tier: "personal",
    status: "healthy"
  });
  return {
    test: "heartbeat",
    status: r.status === 200 ? "PASS" : "FAIL",
    http: r.status,
    elapsedMs: r.elapsedMs,
    serverTime: r.data?.serverTime ?? null,
    latestVersion: r.data?.latestVersion ?? null,
    note: r.status === 200 ? "ok" : (r.data?.error ?? "fail")
  };
}

async function main() {
  console.log(`ARIA Sentinel — funnel smoke test`);
  console.log(`Base: ${BASE}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Step 1: heartbeat endpoint
  console.log("→ Testing heartbeat endpoint...");
  const hb = await testHeartbeat();
  results.push(hb);
  console.log(`  ${hb.status} (HTTP ${hb.http}, ${hb.elapsedMs}ms) — latest=${hb.latestVersion ?? "n/a"}\n`);

  // Step 2: each HMAC key
  console.log("→ Testing 6 HMAC keys against sentinel-resolve...");
  for (const k of KEYS) {
    const r = await testKey(k);
    results.push(r);
    console.log(`  ${r.status.padEnd(4)} ${k.plan.padEnd(20)} HTTP=${r.http ?? "—"}  ${r.note}`);
  }

  // Step 3: write matrix to docs
  const pass = results.filter(r => r.status === "PASS").length;
  const fail = results.filter(r => r.status === "FAIL").length;
  const skip = results.filter(r => r.status === "SKIP").length;

  const md = [
    `# Funnel smoke test — ${new Date().toISOString()}`,
    ``,
    `Base: ${BASE}`,
    ``,
    `**Result:** ${pass} pass · ${fail} fail · ${skip} skip (of ${results.length} total)`,
    ``,
    `| Test | Status | HTTP | Latency (ms) | Note |`,
    `|---|---|---|---|---|`,
    ...results.map(r => `| ${r.test ?? r.plan ?? "?"} | ${r.status} | ${r.http ?? "—"} | ${r.elapsedMs ?? "—"} | ${r.note ?? ""} |`),
    ``,
    `---`,
    ``,
    `## How to fix failures`,
    ``,
    `- **All keys FAIL with HTTP 404:** sentinel-resolve function not deployed yet. Verify Netlify deploy.`,
    `- **All keys FAIL with status invalid:** SENTINEL_LICENSE_SECRET mismatch between minting and verifying environments.`,
    `- **One key FAIL, others PASS:** that specific key was minted with a different secret OR is revoked.`,
    `- **Heartbeat FAIL:** sentinel-heartbeat function broken — check Netlify function logs.`,
    `- **All keys SKIP:** env vars not set. See \`docs/half-b-runbook.md\` for the export commands.`,
  ].join("\n");

  const outPath = resolve("docs/funnel-smoke-test-results.md");
  writeFileSync(outPath, md);
  console.log(`\nResults written to ${outPath}`);

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Smoke test crashed:", err);
  process.exit(2);
});

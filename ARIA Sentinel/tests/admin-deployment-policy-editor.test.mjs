// admin-deployment-policy-editor — the admin-console Deployment policy generator.
//
// The admin console (excluded from customer builds — ships via extraResources, window opens for an
// admin-tier license only) gains a small view that composes + validates a per-customer
// deployment-policy.json an MSP pushes via MDM/Intune. The console runs from file:// with no preload /
// modules, so it embeds a self-contained validator. This suite asserts:
//   1. the editor UI + validate/download wiring exist and the export is a browser download (no fs write);
//   2. PARITY — the embedded validator agrees with the canonical validateDeploymentPolicy() across a
//      battery of good/bad cases (so the two can never silently drift);
//   3. the console stays customer-excluded (not in the asar files allow-list; shipped via extraResources);
//   4. honesty — decision-only, enforced:false, no real block.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateDeploymentPolicy } from "../src/shared/deployment-policy-schema.mjs";

const root = path.resolve(import.meta.dirname, "..");
const html = fs.readFileSync(path.join(root, "admin-console", "index.html"), "utf8");

// ── 1 · editor UI + wiring present ──────────────────────────────────────────────────────────────
assert.match(html, /id="deploymentPolicyEditor"/, "admin console has the deployment-policy editor panel");
for (const id of ["dpCustomerId", "dpBrowserProtection", "dpOverrideRules", "dpEscalationRouting",
  "dpDecisionClean", "dpDecisionSuspicious", "dpDecisionMalicious", "dpDecisionCritical",
  "dpValidateBtn", "dpDownloadBtn", "dpStatus", "dpOutput"]) {
  assert.match(html, new RegExp('id="' + id + '"'), `editor has #${id}`);
}
// Export is a user-initiated browser download of deployment-policy.json — writes nowhere on disk directly.
assert.match(html, /a\.download = "deployment-policy\.json"/, "download exports deployment-policy.json via a Blob download");
assert.match(html, /new Blob\(\[JSON\.stringify\(lastPolicy/, "download serialises the validated policy object");
// The console must never touch the filesystem / node APIs (no preload, no nodeIntegration).
assert.doesNotMatch(html, /require\((['"])(node:)?fs\1\)/, "admin console never requires fs");
assert.doesNotMatch(html, /require\((['"])(node:)?child_process\1\)/, "admin console never spawns processes");
// Honesty — decision/config only, never a real block.
assert.match(html, /enforced: false/i, "editor copy labels the policy decision-only (enforced:false)");
assert.match(html, /never blocks a site itself/i, "editor copy states Sentinel never blocks a site itself");

// ── 2 · PARITY: extract the embedded validator and compare to the canonical one ─────────────────
const m = html.match(/\/\* __ARIA_DP_VALIDATOR_START__ \*\/([\s\S]*?)\/\* __ARIA_DP_VALIDATOR_END__ \*\//);
assert.ok(m, "the embedded validator is delimited by the parity markers");
// eslint-disable-next-line no-new-func — extracting a pure, dependency-free function for a parity check.
const adminValidate = new Function(m[1] + "\nreturn adminValidateDeploymentPolicy;")();
assert.equal(typeof adminValidate, "function", "embedded validator extracted");

const cases = [
  // valid
  { customerId: "acme-inc", browserProtection: "on", maliciousSitePolicy: { decisions: {} } },
  { customerId: "acme.inc_2-x", browserProtection: "locked-off", maliciousSitePolicy: { decisions: { critical: "escalate", malicious: "block-recommend" } }, escalationRouting: "security-team" },
  { customerId: "c1", browserProtection: " ON ", maliciousSitePolicy: { decisions: {} } }, // trim + lowercase
  { customerId: "acme inc", browserProtection: "off", maliciousSitePolicy: { suspicious: "warn" } }, // flat decisions + id sanitised
  { customerId: "c1", browserProtection: "locked-on", maliciousSitePolicy: { decisions: { critical: "escalate" } }, overrideRules: "none", escalationRouting: "managed-soc" },
  // invalid
  { browserProtection: "on", maliciousSitePolicy: { decisions: {} } },                              // missing id
  { customerId: "-bad", browserProtection: "on", maliciousSitePolicy: { decisions: {} } },          // bad id shape
  { customerId: "c1", browserProtection: "sometimes", maliciousSitePolicy: { decisions: {} } },     // bad mode
  { customerId: "c1", browserProtection: "on" },                                                    // missing msp
  { customerId: "c1", browserProtection: "on", maliciousSitePolicy: { decisions: { bogus: "allow" } } },     // unknown level
  { customerId: "c1", browserProtection: "on", maliciousSitePolicy: { decisions: { malicious: "nuke" } } },  // bad decision
  { customerId: "c1", browserProtection: "on", maliciousSitePolicy: { decisions: { clean: "allow", bogus: "warn", malicious: "nuke" } } }, // mixed errors
  { customerId: "c1", browserProtection: "locked-on", maliciousSitePolicy: { decisions: {} }, overrideRules: "allow-warn" }, // locked+override contradiction
  { customerId: "c1", browserProtection: "on", maliciousSitePolicy: { decisions: {} }, overrideRules: "whatever" },          // bad override
  { customerId: "c1", browserProtection: "on", maliciousSitePolicy: { decisions: {} }, escalationRouting: "mars" },          // bad route
  // non-objects
  null, "nope", 42, [],
];

const sorted = (a) => [...a].sort();
for (const c of cases) {
  const canon = validateDeploymentPolicy(c);
  const admin = adminValidate(c);
  const label = JSON.stringify(c);
  assert.equal(admin.valid, canon.valid, `parity .valid for ${label}`);
  assert.deepEqual(sorted(admin.errors), sorted(canon.errors), `parity .errors for ${label}`);
  if (canon.valid) assert.deepEqual(admin.policy, canon.policy, `parity normalized .policy for ${label}`);
  // Every embedded result must carry the canonical schema version when valid.
  if (admin.valid) assert.equal(admin.policy.v, "deployment-policy-v1", "embedded emits the canonical schema version");
}

// ── 3 · admin console stays EXCLUDED from customer app code ──────────────────────────────────────
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const files = (pkg.build && pkg.build.files) || [];
for (const f of files) assert.ok(!String(f).includes("admin-console"), `admin-console never enters the asar files list (offending: ${f})`);
const extra = (pkg.build && pkg.build.extraResources) || [];
assert.ok(extra.some((e) => String(e).includes("admin-console")), "admin console ships via extraResources (window still admin-tier gated at runtime)");

console.log(`admin-deployment-policy-editor test passed (editor UI + Blob-download export · ${cases.length}-case validator parity with the canonical schema · fs-free · customer-excluded · enforced:false).`);

// BLOCK 6 test — 3-level kill switch.
// A control-plane { killed:true } (or per-customer disabled) must force detect-only:
// runRecipe-equivalent decision blocks, and the banner reason is surfaced.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseControlPlaneKill, remediationDecision, blockedRecipeResult } from "../src/shared/kill-switch.mjs";
import { normalizeCustomerConfig, loadCustomerConfig } from "../src/shared/customer-config.mjs";

// --- global / control-plane level ---
const killed = parseControlPlaneKill({ killed: true, reason: "Emergency stop: bad recipe bundle 2026.06.19" });
assert.equal(killed.present, true);
assert.equal(killed.killed, true);
assert.match(killed.reason, /Emergency stop/);

assert.deepEqual(parseControlPlaneKill({ killed: false }), { present: true, killed: false, reason: "" });
assert.equal(parseControlPlaneKill({}).present, false, "no killed key = no directive (leave state alone)");
assert.equal(parseControlPlaneKill(null).present, false);

// decision: control-plane kill wins
const d1 = remediationDecision({ controlPlaneKilled: true, controlPlaneReason: killed.reason });
assert.equal(d1.killed, true);
assert.equal(d1.detectOnly, true);
assert.match(d1.reason, /Emergency stop/);

// the runRecipe result when blocked is a no-op error (no system change)
const blocked = blockedRecipeResult(d1.reason);
assert.equal(blocked.ok, false);
assert.equal(blocked.error, "control_plane_killed");

// not killed → fixes allowed
const d0 = remediationDecision({ controlPlaneKilled: false, customerDisabled: false });
assert.equal(d0.killed, false);
assert.equal(d0.detectOnly, false);

// --- per-customer level ---
const cfg = normalizeCustomerConfig({ customerId: "acme-001", name: "ACME Corp", disabled: true, evilKey: "x", __proto__: { p: 1 } });
assert.equal(cfg.customerId, "acme-001");
assert.equal(cfg.disabled, true);
assert.equal(cfg.evilKey, undefined, "extra keys dropped from customer config");
const d2 = remediationDecision({ customerDisabled: cfg.disabled });
assert.equal(d2.killed, true, "per-customer disabled forces detect-only");
assert.match(d2.reason, /Customer policy/);

// customer.json round-trip from disk
const cfile = path.join(os.tmpdir(), `aria-customer-${Date.now()}.json`);
fs.writeFileSync(cfile, JSON.stringify({ customerId: "beta corp!!", disabled: true }));
const loaded = loadCustomerConfig(cfile);
assert.equal(loaded.customerId, "betacorp", "id sanitised to opaque token");
assert.equal(loaded.disabled, true);
fs.rmSync(cfile, { force: true });
assert.equal(loadCustomerConfig(path.join(os.tmpdir(), "does-not-exist.json")), null, "missing file = unmanaged");

console.log("Kill-switch test passed (global + per-customer detect-only, recipes no-op when killed).");

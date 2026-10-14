// VENDOR-VETTED GREEN (2026-10-14, fault lab defect 4) — "advise three times, then act" must be able to COMPLETE on a
// fresh install. Before: executionPolicy's vetted-tier rule needed 10 locally vetted runs before any unattended
// execution, every recipe starts at 0, so the third unanswered notice always ended with "tell the IT contact".
// The rule now (dry-run-policy.mjs vettedTier · recipe-runner.mjs isVendorVetted · docs/FAULT-LAB.md):
//   · a GREEN recipe that ships in the registry with a GATING verify probe and a declared rollback / inverse is
//     vendor-vetted: the shipped catalogue is its floor (Tier 1) — GREEN ONLY;
//   · YELLOW still needs the local 10 vetted runs; RED never runs on its own;
//   · the local counters are kept (they still raise trust, still gate yellow, still move ±1);
//   · no other gate moves: supervisor · countdown · Ctrl+Alt+K · restore point · needsAdmin · red-never-automated.
// Proven here on the pure policy, on the registry, and on the REAL main.mjs (the fault lab's simulated machine).
// Every group runs and reports on its own; the new exports are read per group, so the pre-fix tree fails on BEHAVIOUR.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { bootLab, diff } from "./lib/fault-lab.mjs";
import { RECIPES } from "../src/shared/recipes.mjs";
import * as runner from "../src/shared/recipe-runner.mjs";
import * as policyMod from "../src/main/dry-run-policy.mjs";
import { decideExecution } from "../src/shared/approval-policy.mjs";

const MIN = 60 * 1000;
const TICK = 15 * 1000;
const root = path.resolve(import.meta.dirname, "..");
const results = [];
async function group(name, fn) {
  try { await fn(); results.push({ name, ok: true }); }
  catch (err) { results.push({ name, ok: false, error: String((err && err.message) || err).slice(0, 300) }); }
}
const rows = (lab, tag, re) => lab.audit().filter((r) => r.tag === tag && (!re || re.test(r.text)));
const notices = (lab, recipeId) => lab.audit().filter((r) => r.tag === "ADVISORY" && /^ADVISORY \d\/3: /.test(r.text) && r.recipeId === recipeId);
const ticksSeen = (lab) => lab.appWin.sent.filter((m) => m.channel === "sentinel:countdown-tick").map((m) => m.payload.secondsLeft);
const PROBE = /^\(Get-|^Get-Service -Name \w+ \| Select-Object|^Get-ComputerRestorePoint|^\[math\]::Round|^Test-NetConnection|^try \{ Resolve-DnsName|^if \(\(Get-/;
const mutating = (lab) => lab.machine.commands.filter((c) => !PROBE.test(c.cmd) && !/^Checkpoint-Computer/.test(c.cmd));
async function fresh(mutate, opts = {}) {
  const lab = await bootLab({ vetted: {}, interval: 3, ...opts });
  mutate(lab.machine.state);
  const before = lab.machine.snapshot();
  await lab.detect();
  return { lab, changed: () => diff(before, lab.machine.snapshot()) };
}

// ── 1 — THE BEHAVIOUR (the defect): a fresh install, Autonomous, nobody answering → 3 notices → the fix, verified ───────
await group("fresh install: stale DNS → 3 notices → countdown → fixed on its own (verified)", async () => {
  const { lab, changed } = await fresh((s) => { s.dns.staleEntries = 7; s.dns.cacheEntries = 140; });
  const adv = lab.advisories().find((a) => a.recipeId === "dns-fail-v1");
  assert.ok(adv, "advised");
  assert.equal(adv.track, "auto-fix", `the auto-fix track on a fresh install (got ${adv.track}/${adv.kind})`);
  await lab.minutes(15);
  assert.equal(notices(lab, "dns-fail-v1").length, 3, "exactly 3 notices first");
  const fix = rows(lab, "AUTO-FIX").filter((r) => r.recipeId === "dns-fail-v1");
  assert.equal(fix.length, 1, "then ARIA acts on its own");
  assert.ok(Date.parse(fix[0].ts) - Date.parse(notices(lab, "dns-fail-v1")[2].ts) >= 3 * MIN, "one interval after notice 3");
  assert.deepEqual(ticksSeen(lab).slice(0, 10), [10, 9, 8, 7, 6, 5, 4, 3, 2, 1], "the visible 10-second countdown ran first");
  assert.ok(mutating(lab)[0].at >= Date.parse(fix[0].ts) + 10 * 1000, "nothing changed before the countdown finished");
  assert.equal(rows(lab, "DONE", /^Verification for NET\.DNS\.FAIL: passed\.$/).length, 1, "the gating verify passed");
  assert.equal(rows(lab, "ADVISORY", /fixed on its own after 3 notices \(verified\)/).length, 1);
  assert.deepEqual(changed(), ["dns.cacheEntries", "dns.registrations", "dns.staleEntries"], "exactly the fix's keys");
  assert.equal(rows(lab, "ESCALATE").length, 0, "no IT contact needed");
  assert.equal(lab.machine.uacPrompts.length, 0, "never an elevation");
  // The local counter is KEPT: the verified live run counted +1.
  const hist = JSON.parse(fs.readFileSync(path.join(lab.root, "userData", "recipe-history.json"), "utf8"));
  assert.equal(hist.recipes["dns-fail-v1"].vetted, 1, "local vetting still counts (+1)");
});

// ── 2 — what must NOT move on a fresh install ──────────────────────────────────────────────────────────────────────────
await group("fresh install: admin faults still → the IT contact; yellow still needs a yes; red never runs", async () => {
  // needsAdmin — even a vendor-vetted recipe (svc-dhcp-stopped-v1) is never run unattended.
  for (const [label, mutate, recipeId] of [
    ["DHCP Client stopped (vendor-vetted, needs admin)", (s) => { s.services.Dhcp.status = "Stopped"; }, "svc-dhcp-stopped-v1"],
    ["Print Spooler stopped (needs admin)", (s) => { s.services.Spooler.status = "Stopped"; }, "svc-spooler-stopped-v1"]
  ]) {
    const { lab, changed } = await fresh(mutate);
    const adv = lab.advisories().find((a) => a.recipeId === recipeId);
    assert.equal(adv && adv.kind, "needs-admin", `${label}: needs-admin track`);
    await lab.minutes(15);
    assert.equal(notices(lab, recipeId).length, 3, `${label}: 3 notices`);
    assert.equal(rows(lab, "AUTO-FIX").length, 0, `${label}: never automatic`);
    assert.equal(rows(lab, "ESCALATE").filter((r) => r.recipeId === recipeId).length, 1, `${label}: the IT contact is told`);
    assert.deepEqual(changed(), [], `${label}: nothing changed`);
    assert.equal(lab.machine.uacPrompts.length, 0, `${label}: no elevation unattended`);
  }
  // yellow — Teams (inside a maintenance window): always a person's yes, never the vendor floor.
  {
    const { lab, changed } = await fresh((s) => { s.teams.responding = false; s.teams.cacheBytes = 2e9; s.werReports.push({ app: "teams.exe", ts: 1 }); }, { window: true });
    const adv = lab.advisories().find((a) => a.recipeId === "teams-cache-v1");
    assert.equal(adv && adv.kind, "needs-confirm", "yellow → needs a yes");
    await lab.minutes(15);
    assert.equal(rows(lab, "AUTO-FIX").length, 0); assert.deepEqual(changed(), []);
  }
  // red — a BSOD stop code: 3 notices, the IT contact, never an approval, never a run.
  {
    const { lab, changed } = await fresh((s) => { s.systemFiles.corrupt = true; s.minidumps = { count: s.minidumps.count + 1, lastStopCode: "CRITICAL_PROCESS_DIED" }; });
    await lab.minutes(15);
    assert.equal(rows(lab, "AUTO-FIX").length, 0); assert.deepEqual(changed(), []); assert.equal(mutating(lab).length, 0);
    assert.equal(lab.state().approvals.pending.filter((a) => a.recipeId === "bsod-critical-process-v1").length, 0, "red never becomes an approval");
  }
  // a green user-space recipe WITHOUT a gating verify (svc-dnscache-stopped-v1): still "not yet vetted" → the IT contact.
  {
    const { lab, changed } = await fresh((s) => { s.services.Dnscache.status = "Stopped"; });
    const adv = lab.advisories().find((a) => a.recipeId === "svc-dnscache-stopped-v1");
    assert.equal(adv && adv.kind, "not-yet-vetted", "no gating verify → no floor");
    await lab.minutes(15);
    assert.equal(rows(lab, "AUTO-FIX").length, 0); assert.deepEqual(changed(), []);
  }
});

// ── 3 — the other gates hold for a vendor-vetted fix: Ctrl+Alt+K during the countdown · keep-fixes-in-preview ───────────
await group("fresh install: Ctrl+Alt+K and the preview switch still stop a vendor-vetted fix", async () => {
  const { lab, changed } = await fresh((s) => { s.dns.staleEntries = 7; });
  for (let i = 0; i < 60 && !rows(lab, "AUTO-FIX").length; i++) await lab.advance(TICK);
  assert.equal(rows(lab, "AUTO-FIX").length, 1, "reached the countdown");
  await lab.advance(3000);
  assert.equal(mutating(lab).length, 0, "still counting down");
  const k = await lab.kill();
  assert.equal(k.ok, true);
  await lab.minutes(60);
  assert.equal(mutating(lab).length, 0, "the kill switch stopped it: nothing ran");
  assert.deepEqual(changed(), []);
  // "Keep every fix in preview" (keepSystemFixesDryRun) wins over the floor: the rule does not take it, nothing changes.
  const p = await bootLab({ vetted: {}, interval: 3 });
  await p.ipc.invoke("sentinel:set-keep-dry-run", true);
  p.machine.state.dns.staleEntries = 7;
  const before = p.machine.snapshot();
  await p.detect();
  await p.minutes(40);
  assert.equal(rows(p, "AUTO-FIX").length, 0, "preview switch on → no automatic fix");
  assert.deepEqual(diff(before, p.machine.snapshot()), [], "…and nothing changed");
});

// ── 4 — Confirmed mode, fresh install: a vendor-vetted fix that needs admin asks once (instead of being held) ────────────
await group("fresh install, Confirmed: a vendor-vetted admin fix waits as ONE approval; nothing runs", async () => {
  const { lab, changed } = await fresh((s) => { s.services.Dhcp.status = "Stopped"; }, { mode: "confirmed" });
  await lab.minutes(2);
  const asks = lab.state().approvals.pending.filter((a) => a.recipeId === "svc-dhcp-stopped-v1");
  assert.equal(asks.length, 1, "one approval (needs administrator rights, unattended)");
  assert.deepEqual(changed(), []);
  const r = await lab.approve(asks[0].id);
  assert.equal(r.ok, true);
  await lab.minutes(2);
  assert.ok(lab.machine.uacPrompts.length >= 1, "approved → the UAC prompt the person answers");
  assert.deepEqual(changed(), ["services.Dhcp.restarts", "services.Dhcp.status"], "exactly the restart");
  assert.ok(rows(lab, "FIX").some((x) => x.recipeId === "svc-dhcp-stopped-v1" && x.outcome === "done"), "done (verified: Running + lease)");
});

// ── 5 — the pure rule ───────────────────────────────────────────────────────────────────────────────────────────────────
await group("pure policy: the vendor floor is green-only, explicit, and the old truth table is unchanged without it", async () => {
  const { vettedTier, executionPolicy } = policyMod;
  assert.equal(policyMod.VENDOR_VETTED_TIER, 1, "the floor is Tier 1");
  // unchanged without the flag (dry-run-policy.test.mjs / fresh-install-resolve.test.mjs pin the same)
  assert.equal(vettedTier(0), 2); assert.equal(vettedTier(10), 1); assert.equal(vettedTier(100), 0);
  assert.equal(vettedTier(0, { color: "green" }), 2, "colour alone is not vetting");
  assert.equal(vettedTier(0, { vendorVetted: true }), 2, "the flag alone (no colour) is not enough");
  // the floor — green only
  assert.equal(vettedTier(0, { color: "green", vendorVetted: true }), 1, "vendor-vetted green → Tier 1 from run 0");
  assert.equal(vettedTier(0, { color: "yellow", vendorVetted: true }), 2, "yellow never takes the floor");
  assert.equal(vettedTier(0, { color: "red", vendorVetted: true }), 2, "red never takes the floor");
  // local counters still raise trust and still gate yellow
  assert.equal(vettedTier(150, { color: "green", vendorVetted: true }), 0, "100+ local runs still reach Tier 0");
  assert.equal(vettedTier(12, { color: "yellow", vendorVetted: true }), 1, "yellow earns Tier 1 only locally");
  // executionPolicy: a fresh, unattended, vendor-vetted green fix is ALLOWED in Confirmed — countdown + supervisor still required
  let p = executionPolicy({ vettedCount: 0, color: "green", vendorVetted: true, mode: "confirmed", supervisorVerdict: "approve", humanInitiated: false });
  assert.equal(p.tier, 1); assert.equal(p.allowed, true); assert.equal(p.execute, true); assert.equal(p.trust, "vendor-vetted");
  assert.equal(p.requiresCountdown, true, "the countdown still applies"); assert.equal(p.canAutoFire, false, "Tier 1 never auto-fires");
  assert.equal(p.requiresSupervisor, true);
  // …but not with a veto, not in preview, not for yellow, and not without the flag (the old answer)
  assert.equal(executionPolicy({ vettedCount: 0, color: "green", vendorVetted: true, mode: "confirmed", supervisorVerdict: "veto" }).execute, false, "a supervisor veto still blocks");
  assert.equal(executionPolicy({ vettedCount: 0, color: "green", vendorVetted: true, mode: "confirmed", dryRunCheckbox: true, supervisorVerdict: "approve" }).execute, false, "the preview switch still wins");
  assert.equal(executionPolicy({ vettedCount: 0, color: "yellow", vendorVetted: true, mode: "confirmed", supervisorVerdict: "approve" }).allowed, false, "yellow: still refused unattended");
  p = executionPolicy({ vettedCount: 0, mode: "confirmed", supervisorVerdict: "approve" });
  assert.equal(p.allowed, false, "no flag → the pre-existing refusal (unchanged)"); assert.equal(p.trust, "not-yet-vetted");
  assert.equal(executionPolicy({ vettedCount: 12, mode: "confirmed", supervisorVerdict: "approve" }).trust, "locally-vetted");
  // the approval policy is untouched by the floor: red is never automated, admin is decided downstream (needsAdmin)
  assert.equal(decideExecution({ level: "full-auto", color: "red", tier: 1 }).action, "notify-only");
  assert.equal(decideExecution({ level: "observe", color: "green", tier: 1 }).action, "notify-only");
  assert.equal(decideExecution({ level: "full-auto", color: "green", tier: 1, killed: true }).action, "blocked", "the kill switch still blocks");
});

// ── 6 — the registry: which recipes are vendor-vetted, and why ──────────────────────────────────────────────────────────
await group("registry: vendor-vetted = green + gating verify + declared inverse (today: dns-fail-v1, svc-dhcp-stopped-v1)", async () => {
  const { isVendorVetted, VERIFY_GATES, ROLLBACK_PLANS, VERIFY_COMMANDS, EXECUTABLE_RECIPES, YELLOW_RECIPES } = runner;
  assert.equal(typeof isVendorVetted, "function", "isVendorVetted is exported");
  const vetted = RECIPES.filter((r) => isVendorVetted(r.id)).map((r) => r.id).sort();
  assert.deepEqual(vetted, ["dns-fail-v1", "svc-dhcp-stopped-v1"], "exactly the recipes that earn the floor");
  for (const id of vetted) {
    assert.ok(EXECUTABLE_RECIPES.has(id) && !YELLOW_RECIPES.has(id), `${id}: green tier`);
    assert.ok(VERIFY_GATES.has(id) && VERIFY_COMMANDS[id], `${id}: ships a gating verify probe`);
    assert.match(VERIFY_COMMANDS[id], /exit 1/, `${id}: the probe can fail (it exits non-zero)`);
    assert.doesNotMatch(VERIFY_COMMANDS[id], /\b(Restart|Stop|Start|Set|Remove|New|Clear|Register|Disable|Enable)-[A-Z]|ipconfig|netsh/, `${id}: the probe is read-only`);
    assert.ok(ROLLBACK_PLANS[id] && ROLLBACK_PLANS[id].inverse.length > 20, `${id}: declares its rollback / inverse`);
  }
  assert.equal(isVendorVetted("disk-low-space-v1"), false, "green but deletes temp files (no inverse) → no floor");
  assert.equal(isVendorVetted("svc-dnscache-stopped-v1"), false, "green but no gating verify → no floor");
  assert.equal(isVendorVetted("svc-spooler-stopped-v1"), false, "a status read that always exits 0 is not a gating verify");
  for (const id of YELLOW_RECIPES) assert.equal(isVendorVetted(id), false, `yellow ${id} → never`);
  assert.equal(isVendorVetted("bsod-critical-process-v1"), false, "red → never");
  assert.equal(isVendorVetted("no-such-recipe"), false);
  for (const id of Object.keys(ROLLBACK_PLANS)) assert.ok(EXECUTABLE_RECIPES.has(id), `${id}: an inverse is only declared for a green recipe`);
});

// ── 7 — the wiring: main applies the SAME rule in every place it reads the tier; the rule is documented ───────────────
await group("wiring + docs: main passes vendorVetted + colour everywhere; FAULT-LAB.md states the exact rule", async () => {
  const main = fs.readFileSync(path.join(root, "src", "main", "main.mjs"), "utf8");
  const calls = main.match(/executionPolicy\(\{[^}]*\}\)/g) || [];
  assert.ok(calls.length >= 2, "executionPolicy is called from the advisory track and the supervised pipeline");
  for (const c of calls) assert.match(c, /vendorVetted: isVendorVetted\([^)]*\), color(?:: \w+)?,/, `every executionPolicy call passes the floor inputs: ${c.slice(0, 120)}`);
  assert.match(main, /function vettedTierOf\(recipeId\) \{[\s\S]{0,400}vettedTier\(vettedCountOf\(readRecipeHistory\(\), id\), \{ color: recipeColor\(id\), vendorVetted: isVendorVetted\(id\) \}\)/, "vettedTierOf applies the same floor");
  const doc = fs.readFileSync(path.join(root, "docs", "FAULT-LAB.md"), "utf8");
  for (const re of [/vendor-vetted/i, /floor for green only/i, /gating verify probe/i, /rollback \/ inverse/i, /Yellow\*\* never takes the floor/, /Red\*\* never runs on its own/, /local counters stay/i, /No other gate moves/]) assert.match(doc, re, `FAULT-LAB.md: ${re}`);
});

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok ? "" : ` — ${r.error}`}`);
assert.deepEqual(failed.map((r) => r.name), [], `${failed.length} vendor-vetted group(s) failed`);
console.log(`vendor-vetted-green test passed (${results.length} groups · a fresh install completes "advise three times, then act" for a vendor-vetted green fix (3 notices → countdown → verified) · admin / yellow / red / no-gating-verify still never run on their own · Ctrl+Alt+K + preview switch hold · Confirmed asks once · pure floor green-only · registry + wiring + docs).`);

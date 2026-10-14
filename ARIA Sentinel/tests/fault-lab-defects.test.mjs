// FAULT LAB DEFECTS (2026-10-14) — the five defects the simulated-Windows fault lab found, each proven CLOSED through the
// REAL detection path: the lab's virtual machine (tests/lib/fault-lab.mjs) feeds the REAL watcher evaluators, and every
// signal goes through the REAL main.mjs detectIssue → addDetection → (Autonomous) advise-three-times → runSupervisedFix →
// runRecipe → verify → audit, booted by tests/lib/main-sandbox.mjs (only the platform is faked).
//   1 SYSTEM.SERVICE.STOPPED.DHCP routed to the clock-drift guide       → svc-dhcp-stopped-v1 (restart, needsAdmin, gating verify)
//   2 NET.DOWN / NET.ADAPTER.DOWN matched no recipe                      → net-adapter-down-v1 (a guide: steps, never a command)
//   3 dns-fail-v1 "fixed and verified" with the internet still down      → a gating verify; not_resolved; the IT contact is told
//   5 a watched service set to Disabled was silent                       → the stopped signal + startType "disabled", needs an admin
//   6 nothing detected clock drift                                       → the perf watcher's read-only clock check → SYSTEM.TIME.DRIFT
// (Defect 4 — the vendor floor — has its own suite: tests/vendor-vetted-green.test.mjs.)
//
// Every group runs even when an earlier one fails, and each names its defect, so against the pre-fix tree every group
// reports its own failure (a missing export is never what fails first: new exports are read dynamically, per group).
import assert from "node:assert/strict";
import { bootLab, diff } from "./lib/fault-lab.mjs";
import { RECIPES, recipeById } from "../src/shared/recipes.mjs";
import { isActionExecutable, VERIFY_COMMANDS } from "../src/shared/recipe-runner.mjs";
import { evaluateServices, IDLE_NORMAL_SERVICES } from "../src/sub-agents/detection/service-watcher.mjs";
import { createPerfWatcher } from "../src/sub-agents/detection/perf-watcher.mjs";
import { createDetectionOrchestrator, spawnBudgetPerMinute } from "../src/sub-agents/detection/index.mjs";
import { PRIVATE_FOLDER_NAME, PRIVATE_FOLDER_RE } from "../src/shared/path-guard.mjs";

const MIN = 60 * 1000;
const results = [];
async function group(name, fn) {
  try { await fn(); results.push({ name, ok: true }); }
  catch (err) { results.push({ name, ok: false, error: String((err && err.message) || err).slice(0, 300) }); }
}
const rows = (lab, tag, re) => lab.audit().filter((r) => r.tag === tag && (!re || re.test(r.text)));
const detectionOf = (results, signal) => (results.find((r) => r.signal === signal) || {}).result || null;
function clean(lab, label) {
  assert.deepEqual(lab.machine.unknownCommands, [], `${label}: every command was one the lab knows`);
  assert.deepEqual(lab.machine.violations, [], `${label}: nothing referenced the excluded folder`);
  assert.deepEqual(lab.clock.errors.map(String), [], `${label}: no timer threw`);
  assert.ok(!lab.capturedText().includes(PRIVATE_FOLDER_NAME) && !PRIVATE_FOLDER_RE.test(lab.capturedText()), `${label}: no excluded-folder name in any captured output`);
}
/** A fresh lab (default: Autonomous, live fixes on, nothing vetted locally) with `mutate` applied after the baseline. */
async function labWith(mutate, opts = {}) {
  const lab = await bootLab({ vetted: {}, interval: 3, ...opts });
  if (mutate) mutate(lab.machine.state);
  const before = lab.machine.snapshot();
  return { lab, before, changed: () => diff(before, lab.machine.snapshot()) };
}

// ── 1 — SYSTEM.SERVICE.STOPPED.DHCP → svc-dhcp-stopped-v1 (it used to land on system-time-drift-v1) ─────────────────────
await group("defect 1 — the DHCP Client stop routes to its own restart recipe", async () => {
  const { lab, changed } = await labWith((s) => { s.services.Dhcp.status = "Stopped"; });
  const det = await lab.detect();
  const r = detectionOf(det, "SYSTEM.SERVICE.STOPPED.DHCP");
  assert.ok(r, "the service watcher reported the DHCP Client stop");
  assert.equal(r.ok, true, "detectIssue matched a recipe");
  assert.equal(r.detection.recipeId, "svc-dhcp-stopped-v1", `the detection carries svc-dhcp-stopped-v1 (got ${r.detection && r.detection.recipeId})`);
  assert.notEqual(r.detection.recipeId, "system-time-drift-v1", "never the clock-drift guide again");
  assert.ok(rows(lab, "DETECT").some((x) => x.recipeId === "svc-dhcp-stopped-v1" && /^SYSTEM\.SERVICE\.STOPPED\.DHCP: DHCP Client service stopped/.test(x.text)), "the audit row names the DHCP Client");
  // Same shape as svc-wlansvc-stopped-v1: one green Restart-Service step that needs administrator rights.
  const dhcp = recipeById("svc-dhcp-stopped-v1"), wlan = recipeById("svc-wlansvc-stopped-v1");
  assert.deepEqual(Object.keys(dhcp).sort(), Object.keys(wlan).sort(), "the exact shape of svc-wlansvc-stopped-v1");
  assert.equal(dhcp.risk, "green"); assert.equal(dhcp.family, "SYSTEM"); assert.equal(dhcp.signal, "SYSTEM.SERVICE.STOPPED.DHCP");
  assert.deepEqual(dhcp.actions.map((a) => [a.shell, a.command, a.needsAdmin === true, a.risk]), [["powershell", "Restart-Service Dhcp -Force", true, "green"]]);
  assert.deepEqual(wlan.actions.map((a) => [a.shell, a.needsAdmin === true, a.risk]), [["powershell", true, "green"]], "…as the WLAN recipe is");
  // Autonomous on the standard token: it needs administrator rights → 3 notices → the IT contact. Never run, no UAC.
  await lab.minutes(15);
  assert.equal(rows(lab, "ADVISORY", /^ADVISORY \d\/3: DHCP Client service stopped/).length, 3, "3 notices");
  assert.equal(rows(lab, "ESCALATE").filter((x) => x.recipeId === "svc-dhcp-stopped-v1").length, 1, "then the IT contact");
  assert.deepEqual(changed(), [], "nothing changed on its own");
  assert.equal(lab.machine.uacPrompts.length, 0, "no elevation was ever asked for unattended");
  clean(lab, "dhcp autonomous");
  // A person approves → UAC → the restart → the GATING verify: service Running AND a DHCP lease present → done.
  const run = await lab.main.runRecipe("svc-dhcp-stopped-v1", { confirmed: true, dryRun: false, elevation: "uac" });
  await lab.clock.settle();
  assert.equal(run.ok, true, `the attended restart worked (${run.message})`);
  assert.equal(run.verified, true, "verified: Running + lease present");
  assert.equal(lab.machine.state.services.Dhcp.status, "Running");
  assert.ok(lab.machine.uacPrompts.length >= 1, "Windows asked the person (UAC)");
  assert.equal(VERIFY_COMMANDS["svc-dhcp-stopped-v1"].includes("exit 1"), true, "the verify can fail (it gates)");
  // …and if the lease is missing (APIPA) after the restart, the verify says so: not resolved, never "fixed".
  const t = await labWith((s) => { s.services.Dhcp.status = "Stopped"; s.network.leaseValid = false; s.network.apipa = true; });
  const run2 = await t.lab.main.runRecipe("svc-dhcp-stopped-v1", { confirmed: true, dryRun: false, elevation: "uac" });
  await t.lab.clock.settle();
  assert.equal(run2.ok, false, "running service, no lease → not ok");
  assert.equal(run2.outcome, "not_resolved", "…the outcome is not_resolved");
  clean(lab, "dhcp attended"); clean(t.lab, "dhcp no lease");
});

// ── 2 — NET.ADAPTER.DOWN and NET.DOWN → net-adapter-down-v1 (a guide), never "No local recipe matched" ───────────────────
await group("defect 2 — a dropped network gets the network guide, never silence", async () => {
  const { lab, changed } = await labWith((s) => { s.services.WlanSvc.status = "Stopped"; s.network.wifiConnected = false; s.network.adapterUp = false; });
  const det = await lab.detect();
  for (const signal of ["NET.ADAPTER.DOWN", "NET.DOWN"]) {
    const r = detectionOf(det, signal);
    assert.ok(r, `the network watcher reported ${signal}`);
    assert.equal(r.ok, true, `${signal}: a recipe matched (not "no_match")`);
    assert.equal(r.detection.recipeId, "net-adapter-down-v1", `${signal} carries net-adapter-down-v1`);
  }
  // Direct, too: the real detectIssue with each bare signal.
  for (const signal of ["NET.DOWN", "NET.ADAPTER.DOWN"]) {
    const r = await lab.main.detectIssue({ source: "detection-watcher", signal, issue: "internet-unreachable" });
    assert.equal(r.ok && r.detection.recipeId, "net-adapter-down-v1", `detectIssue(${signal})`);
  }
  assert.equal(rows(lab, "DETECT", /^No local recipe matched/).length, 0, "never \"No local recipe matched\"");
  // A GUIDE: four manual steps (Airplane mode · Wi-Fi/Ethernet · cable/adapter · restart the adapter in Settings), never a command.
  const g = recipeById("net-adapter-down-v1");
  assert.equal(g.mode, "manual"); assert.equal(g.risk, "green");
  assert.deepEqual(g.actions.map((a) => a.shell), ["manual", "manual", "manual", "manual"], "every step is the person's own");
  const steps = g.actions.map((a) => `${a.label} ${a.command}`).join(" | ");
  for (const re of [/airplane mode/i, /wi-fi/i, /ethernet/i, /cable/i, /adapter/i, /restart the adapter in settings/i, /network & internet/i]) assert.match(steps, re, `the guide covers ${re}`);
  for (const a of g.actions) {
    assert.ok(/^Manual: /.test(a.command), `${a.id}: a written step, not a command`);
    assert.doesNotMatch(a.command, /\b(Restart|Stop|Start|Set|Disable|Enable|Remove|New)-[A-Z]|netsh|ipconfig|powershell/i, `${a.id}: no command anywhere in the step`);
    assert.equal(isActionExecutable({ recipeId: g.id, action: a, allowSystemFixes: true, dryRun: false, confirmed: true, restorePointTaken: true }), false, `${a.id}: can never execute`);
  }
  // Running it "live" executes nothing: every step is a preview of a written instruction.
  const cmdsBefore = lab.machine.commands.length;
  const run = await lab.main.runRecipe("net-adapter-down-v1", { confirmed: true, dryRun: false, elevation: "uac" });
  assert.equal(run.dryRun, true, "a guide never runs live");
  assert.equal(lab.machine.commands.length, cmdsBefore, "no command was spawned");
  // The person hears about it (the issue-detected notice), and in Autonomous it is never advised as a fix.
  assert.ok(lab.notifications.some((n) => /^Found: Network connection down/.test(n.title)), "the person is told (Found: Network connection down)");
  await lab.minutes(15);
  assert.equal(rows(lab, "ADVISORY", /^ADVISORY \d\/3: Network connection down/).length, 0, "a guide is never advised as a fix");
  assert.ok(!changed().some((k) => /^network\./.test(k)), "the guide never touched the network state");
  clean(lab, "network guide");
});

// ── 3 — dns-fail-v1: a GATING verify; not_resolved (never "verified") while the internet is down; the IT contact is told ──
await group("defect 3 — a DNS refresh with the internet still down ends not_resolved and escalates", async () => {
  // A stale DHCP lease: the watcher reports NET.DNS.FAIL (→ dns-fail-v1) and NET.DOWN (→ the guide).
  const s = await labWith((st) => { st.network.leaseValid = false; st.network.apipa = true; st.network.gatewayReachable = false; st.dns.staleEntries = 3; }, { vetted: { "dns-fail-v1": 12 } });
  const det = await s.lab.detect();
  assert.equal(detectionOf(det, "NET.DNS.FAIL").detection.recipeId, "dns-fail-v1");
  await s.lab.minutes(40);
  const verify = rows(s.lab, "REVIEW", /^Verification for NET\.DNS\.FAIL: /);
  assert.equal(verify.length, 1, "one verification row");
  assert.match(verify[0].text, /failed — not resolved/, "the verification row says NOT RESOLVED");
  assert.equal(rows(s.lab, "DONE", /^Verification for .*: passed\.$/).length, 0, "never \"verification passed\"");
  const fix = rows(s.lab, "FIX").filter((r) => r.recipeId === "dns-fail-v1");
  assert.equal(fix.length, 1);
  assert.equal(fix[0].resolution, "not_resolved", "the FIX row carries not_resolved");
  assert.notEqual(fix[0].outcome, "done", "never counted as a done fix");
  assert.match(fix[0].text, /NOT RESOLVED/);
  assert.equal(rows(s.lab, "ADVISORY", /fixed on its own/).length, 0, "never \"fixed on its own\"");
  const esc = rows(s.lab, "ESCALATE").filter((r) => r.recipeId === "dns-fail-v1");
  assert.equal(esc.length, 1, "Autonomous: the item escalates to the IT contact");
  assert.match(esc[0].text, /^ESCALATED to your IT contact — the fix ran but the problem is still there \(not resolved\): DNS lookup failed\. Nothing further was changed\.$/);
  const told = s.lab.outbound.filter((o) => /aria-sentinel-notify/.test(o.url) && /"event":"fix-failed"/.test(o.body));
  assert.equal(told.length, 1, "told once, through the existing notify path");
  assert.match(told[0].body, /jordan@example\.com/, "…including the IT contact");
  assert.match(told[0].body, /"outcome":"needs a person - not resolved"/);
  assert.match(told[0].body, /but the check afterwards says the problem is still there \(not resolved\)/, "the message says what happened");
  assert.equal(s.lab.machine.state.network.leaseValid, false, "the root cause is untouched (the lease needs an administrator)");
  // The result object of a live run (a person's run in Confirmed): outcome not_resolved, ok:false, never "verified".
  const t = await labWith((st) => { st.network.winsockOk = false; st.dns.staleEntries = 2; }, { mode: "confirmed" });
  const r = await t.lab.main.runRecipe("dns-fail-v1", { confirmed: true, dryRun: false, elevation: "none" });
  await t.lab.clock.settle();
  assert.equal(r.outcome, "not_resolved"); assert.equal(r.ok, false); assert.equal(r.verified, false);
  assert.match(r.message, /^Not resolved: /);
  // …and the SAME recipe on a healthy network verifies (the probe really resolves a name).
  const u = await labWith((st) => { st.dns.staleEntries = 7; }, { mode: "confirmed" });
  const ok = await u.lab.main.runRecipe("dns-fail-v1", { confirmed: true, dryRun: false, elevation: "none" });
  await u.lab.clock.settle();
  assert.equal(ok.ok, true); assert.equal(ok.verified, true); assert.equal(ok.outcome, undefined);
  // `ipconfig /registerdns` refused (rights) is NON-FATAL: a WARN row, the flush + cache clear still count, the verify decides.
  const w = await labWith((st) => { st.dns.staleEntries = 4; }, { mode: "confirmed" });
  const realRun = w.lab.machine.run;
  w.lab.machine.run = (cmd) => (/^ipconfig \/registerdns/.test(cmd) ? (w.lab.machine.commands.push({ at: w.lab.clock.now(), cmd, elevated: false, via: "run", exitCode: 1 }), { stdout: "The requested operation requires elevation.\r\n", stderr: "", exitCode: 1 }) : realRun(cmd));
  const rw = await w.lab.main.runRecipe("dns-fail-v1", { confirmed: true, dryRun: false, elevation: "none" });
  await w.lab.clock.settle();
  assert.equal(rw.ok, true, `a refused re-registration does not fail the fix (${rw.message})`);
  assert.equal(rw.verified, true, "…the verify decides, and passes");
  assert.deepEqual(rw.warnings, ["register-dns"]);
  assert.equal(rows(w.lab, "WARN", /^Re-register DNS: did not complete \(Windows may require administrator rights for this step\) — a non-fatal step/).length, 1, "the warning is in the audit");
  assert.equal(rows(w.lab, "ERROR").length, 0, "no ERROR row for a non-fatal step");
  assert.equal(w.lab.machine.state.dns.staleEntries, 0, "the flush + cache clear still did the work");
  clean(s.lab, "dns autonomous"); clean(t.lab, "dns winsock"); clean(u.lab, "dns healthy"); clean(w.lab, "dns registerdns refused");
});

// ── 5 — a watched service set to Disabled + stopped → the stopped signal with startType "disabled", needs an admin ───────
await group("defect 5 — a disabled Print Spooler is reported (start type), routed as needs-admin, never automatic", async () => {
  // The pure watcher: Disabled + stopped on a service Windows needs running → the signal + the context.
  const sig = evaluateServices({ Spooler: "Running" }, [{ Name: "Spooler", Status: "Stopped", StartType: "Disabled" }]).signals;
  assert.deepEqual(sig, [{ signal: "SYSTEM.SERVICE.STOPPED.SPOOLER", hint: "critical-service-disabled", startType: "disabled" }]);
  assert.deepEqual(evaluateServices({ Spooler: "Running" }, [{ Name: "Spooler", Status: "Stopped", StartType: 4 }]).signals.map((x) => x.startType), ["disabled"], "the enum value 4 = Disabled too");
  // Unchanged: an idle-normal service (BITS, wuauserv) set to Disabled stays quiet (a common, deliberate policy) …
  for (const name of ["BITS", "wuauserv"]) assert.deepEqual(evaluateServices({ [name]: "Running" }, [{ Name: name, Status: "Stopped", StartType: "Disabled" }]).signals, [], `${name} Disabled stays quiet`);
  assert.ok(IDLE_NORMAL_SERVICES.includes("bits"));
  // … and a service that was ALREADY disabled when the watcher started has no Running edge → quiet.
  assert.deepEqual(evaluateServices({}, [{ Name: "Spooler", Status: "Stopped", StartType: "Disabled" }]).signals, []);
  // The orchestrator forwards ONLY the fixed enum startType "disabled" to detectIssue — nothing else rides along.
  const seen = [];
  const probe = ({ emit }) => ({
    name: "probe", cadenceMs: 60_000, spawnsPerTick: 0,
    async tick() {
      emit("SYSTEM.SERVICE.STOPPED.SPOOLER", "critical-service-disabled", { startType: "disabled", note: "C:\\Users\\x" });
      emit("SYSTEM.SERVICE.STOPPED.AUDIOSRV", "critical-service-stopped", { startType: "C:\\evil" });
    }
  });
  const emitter = createDetectionOrchestrator({ detectIssue: (x) => seen.push(x), isBlocked: () => false, factories: [probe] });
  await emitter.watchers[0].tick();
  assert.deepEqual(seen, [
    { source: "detection-watcher", signal: "SYSTEM.SERVICE.STOPPED.SPOOLER", issue: "critical-service-disabled", startType: "disabled" },
    { source: "detection-watcher", signal: "SYSTEM.SERVICE.STOPPED.AUDIOSRV", issue: "critical-service-stopped" }
  ], "only startType \"disabled\" is forwarded; any other extra is dropped");
  // Through the lab + the REAL detectIssue: the card says it, the route is the service recipe, needs an administrator.
  const { lab, changed } = await labWith((st) => { st.services.Spooler.startType = "Disabled"; st.services.Spooler.status = "Stopped"; st.printQueue = { jobs: 2, frozen: true }; });
  const det = await lab.detect();
  const r = detectionOf(det, "SYSTEM.SERVICE.STOPPED.SPOOLER");
  assert.ok(r && r.ok, "the watcher reported the disabled spooler and a recipe matched");
  assert.equal(r.detection.recipeId, "svc-spooler-stopped-v1", "routes to the service recipe");
  assert.equal(r.detection.startType, "disabled"); assert.equal(r.detection.needsAdmin, true);
  assert.equal(r.detection.context.startType, "disabled", "the context carries startType: disabled");
  assert.equal(r.detection.summary, "Print Spooler is disabled (start type), not just stopped — needs an administrator.", "the detection card says it in plain words");
  const pushed = lab.overlay.sent.filter((m) => m.channel === "sentinel:detection").map((m) => m.payload);
  assert.ok(pushed.some((d) => d.recipeId === "svc-spooler-stopped-v1" && /is disabled \(start type\), not just stopped — needs an administrator/.test(d.summary)), "…on the globe card itself");
  assert.ok(lab.state().detections.some((d) => d.startType === "disabled" && /not just stopped/.test(d.summary)), "…and in the state the Home tab reads");
  const adv = lab.advisories().find((a) => a.recipeId === "svc-spooler-stopped-v1");
  assert.ok(adv, "Autonomous: advised");
  assert.equal(adv.track, "tech-contact"); assert.equal(adv.kind, "needs-admin", "needs-admin, never the auto-fix track");
  assert.match(adv.copy.found, /Print Spooler is disabled \(start type\), not just stopped — needs an administrator/);
  await lab.minutes(40);
  assert.equal(rows(lab, "AUTO-FIX").length, 0, "never automatic");
  assert.equal(rows(lab, "ESCALATE").filter((x) => x.recipeId === "svc-spooler-stopped-v1").length, 1, "the IT contact is told");
  assert.deepEqual(changed(), [], "nothing changed");
  assert.equal(lab.machine.uacPrompts.length, 0);
  // A bridge / chat caller cannot fake the context: startType is accepted from the watcher only.
  const spoof = await lab.main.detectIssue({ source: "chat", signal: "SYSTEM.SERVICE.STOPPED.AUDIOSRV", issue: "x", startType: "disabled" });
  assert.ok(spoof.ok && spoof.detection.startType === undefined && !/disabled/.test(spoof.detection.summary), "startType from a non-watcher source is ignored");
  clean(lab, "disabled spooler");
});

// ── 6 — clock drift: the perf watcher's read-only clock check → SYSTEM.TIME.DRIFT → system-time-drift-v1 ─────────────────
await group("defect 6 — clock drift beyond 2 minutes is detected (read-only, content-blind, counted in the spawn budget)", async () => {
  // The watcher itself, with an injected reader (no spawn): > 2 min fires once; ≤ 2 min, unknown or a failure never fires.
  const emitted = [];
  let t = 0; let reading = { offsetUs: 300e6 };
  const queries = [];
  const os = { cpus: () => [{ times: { user: 1, nice: 0, sys: 0, irq: 0, idle: 1 } }], totalmem: () => 100, freemem: () => 50 };
  const pw = createPerfWatcher({ emit: (s, h) => emitted.push([s, h]), isBlocked: () => false, now: () => t, osFacade: os, runJson: async (q) => { queries.push(q); return reading; } });
  await pw.tick();
  assert.deepEqual(emitted, [["SYSTEM.TIME.DRIFT", "clock-offset-over-2-min"]], "5 min of drift → SYSTEM.TIME.DRIFT");
  t += 5000; await pw.tick();
  assert.equal(queries.length, 1, "the clock is read at most once per 15 minutes (the 5-s perf tick stays native)");
  t += 15 * MIN; await pw.tick();
  assert.equal(queries.length, 2); assert.equal(emitted.length, 1, "still drifting → no repeat (edge-triggered)");
  reading = { offsetUs: 95e6 }; t += 15 * MIN; await pw.tick();
  assert.equal(emitted.length, 1, "95 s is under the 2-minute threshold → quiet");
  reading = { offsetUs: 121e6 }; t += 15 * MIN; await pw.tick();
  assert.equal(emitted.length, 2, "back over 2 minutes → once more (re-armed)");
  for (const r of [null, {}, { offsetUs: "x" }]) { reading = r; t += 15 * MIN; await pw.tick(); }
  assert.equal(emitted.length, 2, "no reading is unknown, never drift");
  const q = queries[0];
  assert.match(q, /Get-CimInstance -ClassName Win32_PerfRawData_MicrosoftWindowsW32TimePerf_WindowsTimeService/, "reads the time service's own computed offset");
  assert.match(q, /offsetUs=\[double\]\$t\.ComputedTimeOffset/, "…and prints only that number");
  assert.doesNotMatch(q, /w32tm|resync|Set-Date|Test-NetConnection|Resolve-DnsName|Invoke-|http|stripchart|Source|ReferenceId/i, "read-only, no network, nothing else read");
  assert.equal(pw.spawnsPerTick, 0, "the perf sampling itself stays native");
  const budget = spawnBudgetPerMinute([pw]);
  assert.ok(budget.rows.some((row) => row.name === "perf.clock" && row.cadenceMs === 15 * MIN && row.spawnsPerTick === 1), "the clock check is declared and counted in the spawn budget");
  // Through the lab + the REAL detectIssue: 5 minutes of drift → SYSTEM.TIME.DRIFT → system-time-drift-v1; 95 s → nothing.
  const { lab, changed } = await labWith((st) => { st.time.offsetSec = 300; });
  const det = await lab.detect();
  const r = detectionOf(det, "SYSTEM.TIME.DRIFT");
  assert.ok(r && r.ok, "the watcher reported the drift and a recipe matched");
  assert.equal(r.detection.recipeId, "system-time-drift-v1", "routed to the existing recipe");
  await lab.minutes(15);
  assert.deepEqual(changed(), [], "a guide: the clock is never changed by ARIA");
  const quiet = await labWith((st) => { st.time.offsetSec = 95; });
  assert.equal(detectionOf(await quiet.lab.detect(), "SYSTEM.TIME.DRIFT"), null, "95 s stays under the threshold → no signal");
  clean(lab, "clock drift"); clean(quiet.lab, "clock quiet");
});

// ── the registry stays coherent: every new recipe is reachable, nothing duplicated ─────────────────────────────────────
await group("registry — the new recipes are unique and well-formed", async () => {
  const ids = RECIPES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, "recipe ids are unique");
  const signals = RECIPES.map((r) => r.signal);
  assert.equal(new Set(signals).size, signals.length, "signals are unique");
  for (const id of ["svc-dhcp-stopped-v1", "net-adapter-down-v1"]) assert.ok(recipeById(id), `${id} is in the registry`);
});

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok ? "" : ` — ${r.error}`}`);
assert.deepEqual(failed.map((r) => r.name), [], `${failed.length} defect group(s) still open`);
console.log(`fault-lab-defects test passed (${results.length} groups · defect 1 DHCP stop → svc-dhcp-stopped-v1 · defect 2 NET.DOWN/NET.ADAPTER.DOWN → the network guide · defect 3 not_resolved + escalation + non-fatal registerdns · defect 5 Disabled start type → needs-admin card · defect 6 clock drift via the read-only W32Time counter · all through the real detectIssue on the simulated machine).`);

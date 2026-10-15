// KILL GATE (2026-10-14, review P0-2) — "Ctrl+Alt+K stops everything", proven on the simulated Windows machine against the
// REAL main.mjs (tests/lib/fault-lab.mjs → tests/lib/main-sandbox.mjs). The review found the panic switch set
// `ariaStopped` and nothing read it: a later detection in Confirmed ran its fix, an emailed approval merged by the poll
// ran with no countdown, the approval timeout could run a green fix, and a relaunch restarted the watchers while the
// status line said "stopped". Every case below pairs the killed run with a control that DOES act, so a gate that
// silently stopped everything (or nothing) cannot pass.
//   1 kill → a new detection (Confirmed, trusted) · every manual / bridge / preview / Tier-0 entry → blocked
//   2 kill → a remote approval (link merged by the poll) · local approve · voice yes → refused, held, never run;
//     Start ARIA asks again with NEW links (the old one can never run it); the timeout policy never runs while closed
//   3 kill → restart → the launch path does not start the watchers; only Start ARIA (audited) re-arms
//   4 kill → an escalation at notice 3 is blocked for good (Start ARIA does not revive it)
//   5 kill while a fix step is in flight → that step finishes its own command; no later step starts
//   6 Stop ARIA closes the same gate (an approval is refused, not consumed) until Start ARIA
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { bootLab, isReadOnlyProbe } from "./lib/fault-lab.mjs";
import { createApprovalsFlow } from "../src/main/approvals.mjs";
import { PRIVATE_FOLDER_NAME } from "../src/shared/path-guard.mjs";

const MIN = 60 * 1000;
const TICK = 15 * 1000;
const VETTED = { "dns-fail-v1": 12 };
const mutating = (lab) => lab.machine.commands.filter((c) => !isReadOnlyProbe(c.cmd) && !/^Checkpoint-Computer/.test(c.cmd)).map((c) => c.cmd);
const rows = (lab, tag, re) => lab.audit().filter((r) => r.tag === tag && (!re || re.test(r.text)));
const notices = (lab, recipeId) => lab.audit().filter((r) => r.tag === "ADVISORY" && /^ADVISORY \d\/3: /.test(r.text) && r.recipeId === recipeId);
let groups = 0; const g = () => { groups++; };
function clean(lab, label) {
  assert.deepEqual(lab.machine.unknownCommands, [], `${label}: every command was one the lab knows`);
  assert.deepEqual(lab.machine.violations, [], `${label}: nothing referenced the excluded folder`);
  assert.deepEqual(lab.clock.errors.map(String), [], `${label}: no timer threw`);
  assert.ok(!lab.capturedText().includes(PRIVATE_FOLDER_NAME), `${label}: no excluded-folder name in any captured output`);
}
async function stale(mode, opts = {}) {
  const lab = await bootLab({ mode, vetted: VETTED, interval: 3, preBaseline: ["stale-dns"], ...opts });
  lab.inject("stale-dns");
  return lab;
}
/** Start ARIA through the visible button's IPC; the lab then stops the (real) watchers it started so no interval outlives the case. */
async function startAria(lab) { const r = await lab.ipc.invoke("sentinel:start-aria"); await lab.clock.settle(); return r; }
async function stopWatchers(lab) { await lab.ipc.invoke("sentinel:stop-aria"); await lab.clock.settle(); }
function writeLicense(lab) {
  const dir = path.join(lab.root, "home", ".aria-sentinel");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "license.json"), JSON.stringify({ key: "c".repeat(64), email: "sam@example.com", plan: "pro" }));
}

// ── 1 — kill → a new detection (Confirmed, trusted) + every direct entry ─────────────────────────────────────────────────
{
  // control: the same machine WITHOUT the kill — a person's "Resolve it for me" runs after the countdown and fixes DNS.
  const ctl = await stale("confirmed");
  const c = await ctl.ipc.invoke("sentinel:supervised-fix", { recipeId: "dns-fail-v1", mode: "confirmed", source: "app", risk: "low" });
  assert.equal(c.countdown, true, "control: a person's fix shows the countdown");
  await ctl.advance(15 * 1000);
  assert.ok(ctl.machine.dnsResolves(), "control: without the kill the fix runs and DNS resolves");
  clean(ctl, "control");

  const lab = await stale("confirmed");
  const k = await lab.kill();
  assert.equal(k.ok, true);
  assert.equal(lab.state().ariaStopped, true, "the state says stopped");
  assert.equal(lab.main.killGateReason(), "ARIA was stopped with Ctrl+Alt+K — nothing runs until you press Start ARIA");
  const det = await lab.detect(); // == the bridge's POST /detect (or the 5-minute self-diagnosis) after the kill
  assert.ok(det.some((d) => d.signal === "NET.DNS.FAIL" && d.result && d.result.ok), "the detection is still recorded (the person sees the problem)");
  await lab.minutes(15);
  assert.deepEqual(mutating(lab), [], "kill → new detection: nothing ran");
  assert.equal(lab.machine.dnsResolves(), false, "the machine is untouched");
  assert.equal(lab.state().approvals.pending.length, 0, "nothing was even asked");
  assert.equal(rows(lab, "KILL-SWITCH", /detected while ARIA is stopped — nothing runs and nothing is asked until you press Start ARIA/).length, 1, "audited");
  // Every other entry, one by one.
  const human = await lab.ipc.invoke("sentinel:supervised-fix", { recipeId: "dns-fail-v1", mode: "confirmed", source: "app", risk: "low" });
  assert.equal(human.verdict, "blocked", "a person's Resolve is blocked");
  assert.match(human.copy, /ARIA is stopped .* press Start ARIA/, "…and says what to press");
  const bridge = await lab.main.bridgeRunRecipe({ recipeId: "dns-fail-v1" });
  assert.equal(bridge.verdict, "blocked", "the bridge's /run-recipe is blocked");
  assert.equal(rows(lab, "KILL-SWITCH", /^Bridge \/run-recipe refused: ARIA was stopped with Ctrl\+Alt\+K/).length, 1);
  const preview = await lab.ipc.invoke("sentinel:run-recipe", "dns-fail-v1", {});
  assert.equal(preview.ok, false, "even the preview channel stands down"); assert.equal(preview.error, "control_plane_killed");
  const tier0 = await lab.main.runRecipe("flush-dns-cache", { confirmed: true, dryRun: false, elevation: "uac" });
  assert.equal(tier0.ok, false, "a Tier-0 executor id is blocked too");
  const direct = await lab.main.runSupervisedFix({ recipeId: "dns-fail-v1", mode: "confirmed", source: "detection", risk: "low" });
  assert.equal(direct.verdict, "blocked");
  await lab.minutes(5);
  assert.deepEqual(mutating(lab), [], "after every entry: still nothing ran");
  assert.equal(lab.machine.uacPrompts.length, 0, "no UAC prompt either");
  clean(lab, "kill → detection");

  // Autonomous: a detection after the kill opens no escalation, sends no notice, runs nothing.
  const auto = await stale("autonomous");
  await auto.kill();
  await auto.detect();
  await auto.minutes(40);
  assert.equal(auto.advisories().length, 0, "autonomous: no escalation opened after the kill");
  assert.equal(notices(auto, "dns-fail-v1").length, 0, "no notice");
  assert.deepEqual(mutating(auto), [], "nothing ran");
  clean(auto, "kill → autonomous detection");
}
g();

// ── 2 — kill → remote approval (the poll merges an emailed "Approve"), local approve, voice yes, the timeout policy ────────
{
  const server = { next: 0, decisions: {}, polled: [] };
  const respond = (url, init) => {
    if (/aria-sentinel-notify/.test(url) && /approval-requested/.test(String(init && init.body || ""))) {
      server.next += 1;
      return { ok: true, email: { sent: 1 }, sms: { sent: 0, dormant: true }, approval: { id: `srv-${server.next}` } };
    }
    const m = /aria-sentinel-approval\?poll=1&id=([^&]+)/.exec(url);
    if (m) { server.polled.push(decodeURIComponent(m[1])); return server.decisions[decodeURIComponent(m[1])] || { status: "pending" }; }
    return undefined;
  };
  // control: no kill — the emailed "Approve" merged by the 60-s poll runs the fix (this is the path the review exploited).
  const ctl = await stale("manual", { respond });
  writeLicense(ctl);
  await ctl.detect();
  const cp = ctl.main.approvals.pending()[0];
  assert.ok(cp && cp.remoteId, "control: the ask has a server id");
  server.decisions[cp.remoteId] = { status: "approved", decidedBy: "link", decidedAt: new Date(ctl.clock.now()).toISOString() };
  await ctl.minutes(2);
  assert.ok(ctl.machine.dnsResolves(), "control: the poll merged the emailed approval and the fix ran");
  clean(ctl, "remote control");

  const lab = await stale("manual", { respond });
  writeLicense(lab);
  await lab.detect();
  const p = lab.main.approvals.pending()[0];
  assert.ok(p && p.remoteId, "an approval waits, with its server id");
  const oldRemote = p.remoteId;
  server.decisions[oldRemote] = { status: "approved", decidedBy: "link", decidedAt: new Date(lab.clock.now()).toISOString() };
  const killAt = lab.clock.now();
  await lab.kill(); // before the next poll
  assert.equal(lab.main.approvals.byId(p.id).status, "held", "Ctrl+Alt+K puts the pending approval on hold");
  assert.equal(rows(lab, "KILL-SWITCH", /1 pending approval\(s\) put on hold/).length, 1, "audited");
  await lab.minutes(10);
  assert.equal(lab.outbound.filter((o) => /poll=1/.test(o.url) && o.at >= killAt).length, 0, "the approval poll stopped");
  assert.deepEqual(mutating(lab), [], "the emailed approval never ran");
  // The same decision forced in directly (the review's PoC), a local click, a voice "yes": all refused, nothing consumed.
  const merged = await lab.main.approvals.mergeRemote(p.id, { status: "approved", decidedBy: "link" });
  assert.equal(merged.ok, false, "mergeRemote after the kill is refused");
  const local = await lab.approve(p.id);
  assert.equal(local.ok, false, "a local Approve after the kill is refused");
  const voice = await lab.ipc.invoke("sentinel:voice-approve", { recipeId: "dns-fail-v1" });
  assert.equal(voice.ok, false, "a voice yes finds nothing to approve");
  await lab.minutes(30 * 60 / 60); // a long while later
  assert.deepEqual(mutating(lab), [], "still nothing ran");
  assert.equal(lab.machine.dnsResolves(), false);
  assert.equal(lab.main.approvals.byId(p.id).status, "held");

  // Start ARIA (the only way out) asks AGAIN — a fresh ask with a NEW server id; the old link's "approved" never runs it.
  const r = await startAria(lab);
  assert.equal(r.ok, true);
  const again = lab.main.approvals.byId(p.id);
  assert.equal(again.status, "pending", "Start ARIA asks again");
  assert.ok(again.remoteId && again.remoteId !== oldRemote, `a new server id (was ${oldRemote}, now ${again.remoteId})`);
  assert.equal(rows(lab, "KILL-SWITCH", /^Resumed by the person at this device \(Start ARIA\) after Ctrl\+Alt\+K .* 1 held approval\(s\) asked again with new links/).length, 1, "the resume is audited");
  assert.equal(rows(lab, "APPROVAL_REQUESTED", /^Asked again after Start ARIA: /).length, 1);
  const pollsBefore = server.polled.length;
  await lab.minutes(3);
  assert.ok(server.polled.slice(pollsBefore).every((id) => id !== oldRemote), "the pre-kill ask is never polled again");
  assert.deepEqual(mutating(lab), [], "the old approval link did not run it after the resume either");
  // control after the resume: a person approves the fresh ask → it runs (the gate is open again).
  const yes = await lab.approve(p.id);
  assert.equal(yes.ok, true, "approving the fresh ask works");
  await lab.minutes(1);
  assert.ok(lab.machine.dnsResolves(), "…and the fix runs");
  await stopWatchers(lab);
  clean(lab, "kill → remote approve");

  // The timeout policy ("Go ahead with green only") never runs a fix while the gate is closed. First the flow itself
  // (src/main/approvals.mjs) with the runner observed directly: open gate → the runner is handed the green fix; closed
  // gate → never, and the audit says so.
  for (const closed of ["", "ARIA was stopped with Ctrl+Alt+K — nothing runs until you press Start ARIA", "ARIA is paused on this device"]) {
    let t = Date.parse("2026-10-14T12:00:00Z");
    const ran = []; const logs = [];
    let list = [];
    const flow = createApprovalsFlow({
      now: () => t, store: { get: () => list, set: (v) => { list = v; } },
      prefs: () => ({ approver: { timeoutMinutes: 5, onTimeout: "proceed-green-only" } }),
      log: (tag, text) => logs.push(`${tag}: ${text}`), gate: () => closed,
      runner: async (x) => { ran.push(x.recipeId); return { ok: true }; }
    });
    flow.request({ recipeId: "dns-fail-v1", title: "DNS lookup failed", color: "green" });
    t += 6 * MIN;
    const out = await flow.expire(t);
    assert.equal(out.expired.length, 1);
    if (!closed) assert.deepEqual(ran, ["dns-fail-v1"], "open gate: the timeout policy hands the green fix to the runner");
    else {
      assert.deepEqual(ran, [], `closed gate (${closed.slice(0, 30)}…): the timeout policy never runs it`);
      assert.ok(logs.some((l) => /^APPROVAL_TIMEOUT: No answer in time — NOT run \(/.test(l)), "…and the audit says NOT run");
    }
    // A closed gate also refuses approve() BEFORE the record moves (nothing consumed); deny always works.
    flow.request({ recipeId: "svc-bits-stopped-v1", title: "BITS", color: "green" });
    const id = flow.pending()[0].id;
    const a = await flow.approve(id);
    if (closed) { assert.equal(a.ok, false); assert.equal(a.reason, "kill-gate"); assert.equal(flow.byId(id).status, "pending", "not consumed"); assert.equal((await flow.deny(id)).ok, true, "deny is never gated"); }
    else assert.equal(a.ok, true);
  }
  // …then through the REAL main on the machine: approvals expire during a pause → nothing runs, audited as NOT run.
  const tlab = await stale("manual");
  await tlab.ipc.invoke("setup:update-prefs", { approver: { mode: "self", contacts: [], timeoutMinutes: 5, onTimeout: "proceed-green-only" } });
  await tlab.detect();
  await tlab.ipc.invoke("sentinel:set-paused", 60 * MIN);
  await tlab.minutes(8);
  assert.deepEqual(mutating(tlab), [], "paused: the expired approval did not run");
  assert.equal(rows(tlab, "APPROVAL_TIMEOUT", /No answer in time — NOT run \(ARIA is paused on this device\)/).length, 1, "audited as not run");
  clean(tlab, "timeout while paused");
}
g();

// ── 3 — kill → restart → the launch path does not start the watchers; only Start ARIA (audited) re-arms ─────────────────
{
  const lab = await stale("confirmed");
  await lab.kill();
  const lab2 = await lab.restart(); // the app quits and launches again (the store persists)
  assert.equal(lab2.state().ariaStopped, true, "still stopped after the relaunch");
  assert.equal(lab2.main.startDetectionAtLaunch(), false, "the launch path refuses to start the watchers");
  assert.equal(lab2.state().watchers.running, false, "no watcher runs while the status line says stopped");
  assert.equal(rows(lab2, "KILL-SWITCH", /^Launch: ARIA is still stopped \(Ctrl\+Alt\+K at /).length, 1, "the launch says why");
  await lab2.detect();
  const human = await lab2.ipc.invoke("sentinel:supervised-fix", { recipeId: "dns-fail-v1", mode: "confirmed", source: "app", risk: "low" });
  assert.equal(human.verdict, "blocked", "a fix after the relaunch is still blocked");
  await lab2.minutes(15);
  assert.deepEqual(mutating(lab2), [], "nothing ran after the relaunch");
  // Start ARIA — the deliberate, visible way out — re-arms everything and says so.
  await startAria(lab2);
  assert.equal(lab2.state().ariaStopped, false);
  assert.equal(lab2.state().watchers.running, true, "Start ARIA starts the watchers");
  assert.equal(lab2.main.killGateReason(), "", "the gate is open again");
  assert.equal(rows(lab2, "KILL-SWITCH", /^Resumed by the person at this device \(Start ARIA\) after Ctrl\+Alt\+K/).length, 1, "audited");
  await stopWatchers(lab2);
  clean(lab2, "kill → restart");
  // control: a launch that was never killed starts the watchers.
  const ok = await stale("confirmed");
  assert.equal(ok.main.startDetectionAtLaunch(), true, "control: an un-killed launch starts the watchers");
  assert.equal(ok.state().watchers.running, true);
  await stopWatchers(ok);
}
g();

// ── 4 — kill → an escalation at notice 3: blocked for good (Start ARIA does not revive it) ───────────────────────────────
{
  const lab = await stale("autonomous");
  await lab.detect();
  for (let i = 0; i < 60 && notices(lab, "dns-fail-v1").length < 3; i++) await lab.advance(TICK);
  assert.equal(notices(lab, "dns-fail-v1").length, 3, "reached notice 3 of 3");
  await lab.kill();
  assert.equal(rows(lab, "KILL-SWITCH", /1 advisory escalation\(s\) blocked — they will not resume on their own/).length, 1);
  await lab.minutes(4 * 60);
  assert.equal(rows(lab, "AUTO-FIX").length, 0, "the escalation never reached its fix");
  assert.deepEqual(mutating(lab), [], "nothing ran");
  assert.equal(lab.machine.dnsResolves(), false);
  assert.equal((lab.state().advisoryOutcomes.find((o) => o.recipeId === "dns-fail-v1") || {}).status, "blocked");
  await startAria(lab);
  await lab.minutes(60);
  assert.equal(rows(lab, "AUTO-FIX").length, 0, "Start ARIA does not revive a blocked escalation");
  assert.equal(notices(lab, "dns-fail-v1").length, 3, "no notice after the resume either");
  await stopWatchers(lab);
  clean(lab, "kill → notice 3");
}
g();

// ── 5 — kill while a fix step is in flight: that step finishes its own command; no later step starts ─────────────────────
{
  const lab = await stale("confirmed");
  let killedAt = null;
  lab.machine.beforeSpawn = (_file, args) => {
    if (!killedAt && args.some((a) => a === "ipconfig /flushdns")) { killedAt = lab.clock.now(); lab.main.activateKillSwitch(); }
  };
  const r = await lab.ipc.invoke("sentinel:supervised-fix", { recipeId: "dns-fail-v1", mode: "confirmed", source: "app", risk: "low" });
  assert.equal(r.countdown, true);
  await lab.advance(15 * 1000);
  await lab.minutes(5);
  assert.ok(killedAt, "Ctrl+Alt+K landed while the first fix step was starting");
  assert.deepEqual(mutating(lab), ["ipconfig /flushdns"], "the step already in flight finished its own command; NO later step started");
  assert.equal(rows(lab, "KILL-SWITCH", /stopped by Ctrl\+Alt\+K before "Re-register DNS" — no step after the stop ran/).length, 1, "audited at the step it stopped");
  assert.ok(rows(lab, "FIX", /stopped by Ctrl\+Alt\+K part-way/).length === 1, "the FIX row says it was stopped, not 'applied'");
  assert.equal(lab.machine.commands.filter((c) => /Resolve-DnsName/.test(c.cmd)).length, 0, "no verify probe after the stop");
  clean(lab, "kill mid-run");
}
g();

// ── 6 — Stop ARIA closes the same gate: an approval is refused (not consumed) until Start ARIA ───────────────────────────
{
  const lab = await stale("manual");
  await lab.detect();
  const p = lab.main.approvals.pending()[0];
  await lab.ipc.invoke("sentinel:stop-aria");
  const refused = await lab.approve(p.id);
  assert.equal(refused.ok, false, "stopped: Approve is refused");
  assert.equal(refused.reason, "kill-gate");
  assert.equal(lab.main.approvals.byId(p.id).status, "pending", "…and the approval is NOT consumed (it still waits)");
  await lab.minutes(5);
  assert.deepEqual(mutating(lab), [], "nothing ran while stopped");
  await startAria(lab);
  const yes = await lab.approve(p.id);
  assert.equal(yes.ok, true, "after Start ARIA the same approval works");
  await lab.minutes(1);
  assert.ok(lab.machine.dnsResolves(), "…and the fix runs");
  await stopWatchers(lab);
  clean(lab, "stop gate");
}
g();

assert.equal(groups, 6);
console.log(`fault-lab-kill-gate test passed (${groups} groups · kill → detection (Confirmed + Autonomous) and every direct entry blocked · remote approve / local / voice / timeout refused, held, re-asked with new links on Start ARIA · relaunch keeps the watchers off · notice-3 escalation blocked for good · an in-flight step finishes, nothing after it starts · Stop ARIA gates too · each with a control that acts).`);

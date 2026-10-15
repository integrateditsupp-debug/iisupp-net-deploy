// CONFIRMED ASKS ONCE (2026-10-14, review P1-1) — the owner's decision, proven on the simulated Windows machine against the
// REAL main.mjs: "Confirmed = asks once, every time; it never executes unattended. Unattended execution exists only in
// Autonomous mode via the 3-notice rule." The review found Settings saying "applies the fix only after you approve" while
// safe-auto ran a vetted green fix on its own (and the vendor floor let a FRESH install do it too).
//   1 every colour (green · yellow · red), fresh and trusted → exactly ONE approval ("confirmed-asks-once"), nothing runs
//   2 the one click: "Fix it" on the card with that ask open approves THAT ask → one run, one record, never a second run
//   3 the Home row's Approve runs it; Deny never does
//   4 a red problem: asked once; a person's click says "needs a person" and changes nothing
//   5 mode Confirmed with a clamped full-auto level still asks once (the mode decides, not the level)
//   6 control: the SAME fresh install in Autonomous still fixes it on its own after 3 notices (the floor's one track)
import assert from "node:assert/strict";
import { bootLab, isReadOnlyProbe } from "./lib/fault-lab.mjs";
import { decideExecution } from "../src/shared/approval-policy.mjs";
import { executionPolicy, vettedTier, VENDOR_FLOOR_TRACK } from "../src/main/dry-run-policy.mjs";
import { PRIVATE_FOLDER_NAME } from "../src/shared/path-guard.mjs";

const MIN = 60 * 1000;
const TRUSTED = { "dns-fail-v1": 12, "teams-cache-v1": 12, "bsod-critical-process-v1": 12 };
const mutating = (lab) => lab.machine.commands.filter((c) => !isReadOnlyProbe(c.cmd) && !/^Checkpoint-Computer/.test(c.cmd)).map((c) => c.cmd);
const rows = (lab, tag, re) => lab.audit().filter((r) => r.tag === tag && (!re || re.test(r.text)));
const asksFor = (lab, recipeId) => lab.state().approvals.pending.filter((a) => a.recipeId === recipeId);
let groups = 0; const g = () => { groups++; };
function clean(lab, label) {
  assert.deepEqual(lab.machine.unknownCommands, [], `${label}: every command was one the lab knows`);
  assert.deepEqual(lab.machine.violations, [], `${label}: nothing referenced the excluded folder`);
  assert.deepEqual(lab.clock.errors.map(String), [], `${label}: no timer threw`);
  assert.ok(!lab.capturedText().includes(PRIVATE_FOLDER_NAME), `${label}: no excluded-folder name in any captured output`);
}
async function confirmed(faultId, opts = {}) {
  const lab = await bootLab({ mode: "confirmed", interval: 3, preBaseline: [faultId], ...opts });
  const f = lab.inject(faultId);
  await lab.detect({ person: f.report === "person" ? [faultId] : [] });
  return { lab, f };
}

// ── 0 — the pure table + the floor's one track ───────────────────────────────────────────────────────────────────────
for (const color of ["green", "yellow", "red"]) {
  const d = decideExecution({ level: "safe-auto", color, tier: 0, inWindow: true, hasRestorePoint: true });
  assert.equal(d.action, "request-approval", `safe-auto/${color} asks`); assert.equal(d.reason, "confirmed-asks-once");
}
assert.equal(vettedTier(0, { color: "green", vendorVetted: true }), 2, "no floor off the advisory track");
assert.equal(vettedTier(0, { color: "green", vendorVetted: true, track: VENDOR_FLOOR_TRACK }), 1, "the floor on the advisory track");
assert.equal(executionPolicy({ vettedCount: 0, color: "green", vendorVetted: true, mode: "confirmed", supervisorVerdict: "approve" }).allowed, false, "an unattended fresh fix in Confirmed is not allowed");
g();

// ── 1 — every colour, fresh and trusted → ONE approval, nothing runs ─────────────────────────────────────────────────
for (const [faultId, recipeId, color, extra] of [
  ["stale-dns", "dns-fail-v1", "green", {}],
  ["teams-stuck", "teams-cache-v1", "yellow", { window: true }],
  ["system-files-corrupt", "bsod-critical-process-v1", "red", {}]
]) {
  for (const [trust, vetted] of [["fresh", {}], ["trusted", TRUSTED]]) {
    const { lab } = await confirmed(faultId, { vetted, ...extra });
    await lab.minutes(40);
    const label = `${trust} ${color} ${faultId}`;
    const asks = asksFor(lab, recipeId);
    assert.equal(asks.length, 1, `${label}: asked ONCE`);
    assert.equal(asks[0].reason, "confirmed-asks-once", `${label}: because Confirmed asks once`);
    assert.equal(asks[0].color, color);
    assert.deepEqual(mutating(lab), [], `${label}: nothing ran unattended`);
    assert.equal(rows(lab, "AUTO-FIX").length + rows(lab, "FIX").length, 0, `${label}: no fix row`);
    assert.equal(lab.machine.uacPrompts.length, 0, `${label}: no elevation`);
    clean(lab, label);
  }
}
g();

// ── 2 — the one click: "Fix it" on the card approves THAT ask → one run, one record ───────────────────────────────────
{
  const { lab } = await confirmed("stale-dns", { vetted: {} }); // a FRESH install: the vendor floor plays no part here
  const ask = asksFor(lab, "dns-fail-v1")[0];
  assert.ok(ask, "the ask is open");
  const r = await lab.ipc.invoke("sentinel:supervised-fix", { recipeId: "dns-fail-v1", mode: "confirmed", source: "overlay", risk: "low" });
  assert.equal(r.approvedPending, true, "the click approved the open ask");
  assert.equal(r.approvalId, ask.id);
  assert.equal(r.countdown, false, "the approval replaces the countdown (the person already said yes)");
  await lab.minutes(2);
  assert.ok(lab.machine.dnsResolves(), "fixed — with the person present");
  assert.equal(lab.main.approvals.byId(ask.id).status, "approved");
  assert.equal(lab.main.approvals.byId(ask.id).decidedBy, "self");
  assert.equal(rows(lab, "APPROVAL_APPROVED", /^Approved: DNS lookup failed \(by self via overlay\)\.$/).length, 1, "audited as the person's yes");
  const runsAfterClick = mutating(lab).length;
  assert.ok(runsAfterClick >= 1);
  assert.equal(asksFor(lab, "dns-fail-v1").length, 0, "no ask left behind");
  const again = await lab.approve(ask.id);
  assert.equal(again.ok, false, "the same ask cannot run a second time");
  await lab.minutes(60);
  assert.equal(mutating(lab).length, runsAfterClick, "exactly one run");
  clean(lab, "one click");
}
g();

// ── 3 — the Home row's Approve runs it; Deny never does ──────────────────────────────────────────────────────────────
{
  const a = await confirmed("stale-dns", { vetted: {} });
  const yes = await a.lab.approve(asksFor(a.lab, "dns-fail-v1")[0].id);
  assert.equal(yes.ok, true);
  await a.lab.minutes(2);
  assert.ok(a.lab.machine.dnsResolves(), "Approve on the Home row → fixed");
  const d = await confirmed("stale-dns", { vetted: {} });
  const no = await d.lab.deny(asksFor(d.lab, "dns-fail-v1")[0].id);
  assert.equal(no.ok, true);
  await d.lab.minutes(40);
  assert.deepEqual(mutating(d.lab), [], "Deny → nothing ran");
  clean(a.lab, "approve"); clean(d.lab, "deny");
}
g();

// ── 4 — red: asked once; a person's click says "needs a person" and changes nothing ───────────────────────────────────
{
  const { lab } = await confirmed("system-files-corrupt", { vetted: {} });
  assert.equal(asksFor(lab, "bsod-critical-process-v1").length, 1, "red is asked too (a person decides)");
  const r = await lab.ipc.invoke("sentinel:supervised-fix", { recipeId: "bsod-critical-process-v1", mode: "confirmed", source: "overlay", risk: "red" });
  // A red recipe is outside the supervisor's vetted catalogue, so the supervisor stops it first (veto); were it ever to pass,
  // main turns a red "asks once" from a person's click into "needs a person" (notify-only) — never a self-approval.
  assert.ok(["veto", "notify-only"].includes(r.verdict), `a red problem is never self-approved (got ${r.verdict})`);
  assert.equal(r.ok, false, "and the answer says nothing ran");
  await lab.minutes(10);
  assert.deepEqual(mutating(lab), [], "nothing ran");
  clean(lab, "red");
}
g();

// ── 5 — mode Confirmed with a clamped full-auto level (no opt-in) still asks once ──────────────────────────────────────
{
  const { lab } = await confirmed("stale-dns", { vetted: TRUSTED, level: "full-auto" });
  await lab.minutes(40);
  assert.equal(asksFor(lab, "dns-fail-v1").length, 1, "asked once");
  assert.deepEqual(mutating(lab), [], "the level never makes Confirmed run on its own");
  clean(lab, "clamped level");
}
g();

// ── 6 — control: the SAME fresh install in Autonomous fixes it on its own after 3 notices ─────────────────────────────
{
  const lab = await bootLab({ mode: "autonomous", vetted: {}, interval: 3, preBaseline: ["stale-dns"] });
  lab.inject("stale-dns");
  await lab.detect();
  await lab.minutes(15);
  assert.equal(rows(lab, "ADVISORY").filter((x) => /^ADVISORY \d\/3: /.test(x.text)).length, 3, "3 notices first");
  assert.equal(rows(lab, "AUTO-FIX").length, 1, "then the fix — unattended execution is Autonomous-only");
  assert.ok(lab.machine.dnsResolves());
  clean(lab, "autonomous control");
}
g();

assert.equal(groups, 7);
console.log(`fault-lab-confirmed-asks-once test passed (${groups} groups · Confirmed asks once for green/yellow/red, fresh and trusted — nothing unattended · the card's click approves THAT ask (one run, one record) · Home Approve runs, Deny never · red needs a person · a clamped level still asks · Autonomous control still acts after 3 notices).`);

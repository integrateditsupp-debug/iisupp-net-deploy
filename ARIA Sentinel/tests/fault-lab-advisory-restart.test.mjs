// ADVISORY RESTART (2026-10-14, review P2-6) — after a restart an advise-first escalation never proceeds without a fresh
// notice. The review's PoC: an escalation that was mid-fix (or at notice 3) when the app died came back at notice 3 and
// fixed one interval later with ZERO new notifications. Now, on the simulated machine against the REAL main.mjs:
//   1 crash at notice 3 (before the final step) → notice 3 is RE-ISSUED (a desktop notification + the globe card) at the
//     first tick; the fix comes only a full interval after it — never straight to the countdown
//   2 crash during the countdown → that attempt is CANCELLED (audited: nothing ran) → notice 3 re-issued → no fix before
//     a full interval after it (and the 30-minute gap the interrupted attempt counted toward)
//   3 a clean QUIT during the countdown cancels the fix (audited) and closes the escalation — the relaunch never revives it
//   4 restart at notice 2 → notice 2 again, then notice 3 a full interval later (never skipped ahead)
//   5 restart while ARIA is stopped → nothing is re-issued until Start ARIA; then it is
import assert from "node:assert/strict";
import { bootLab, isReadOnlyProbe } from "./lib/fault-lab.mjs";
import { PRIVATE_FOLDER_NAME } from "../src/shared/path-guard.mjs";

const MIN = 60 * 1000;
const TICK = 15 * 1000;
const mutating = (lab) => lab.machine.commands.filter((c) => !isReadOnlyProbe(c.cmd) && !/^Checkpoint-Computer/.test(c.cmd));
const rows = (lab, tag, re) => lab.audit().filter((r) => r.tag === tag && (!re || re.test(r.text)));
const notices = (lab) => lab.audit().filter((r) => r.tag === "ADVISORY" && /^ADVISORY \d\/3: /.test(r.text) && r.recipeId === "dns-fail-v1");
const cards = (lab) => lab.overlay.sent.filter((m) => m.channel === "sentinel:advisory").map((m) => m.payload);
const after = (lab, t0, tag) => lab.audit().filter((r) => r.tag === tag && Date.parse(r.ts) > t0);
let groups = 0; const g = () => { groups++; };
function clean(lab, label) {
  assert.deepEqual(lab.machine.unknownCommands, [], `${label}: every command was one the lab knows`);
  assert.deepEqual(lab.machine.violations, [], `${label}: nothing referenced the excluded folder`);
  assert.deepEqual(lab.clock.errors.map(String), [], `${label}: no timer threw`);
  assert.ok(!lab.capturedText().includes(PRIVATE_FOLDER_NAME), `${label}: no excluded-folder name in any captured output`);
}
async function escalation() {
  const lab = await bootLab({ mode: "autonomous", vetted: { "dns-fail-v1": 12 }, interval: 3, preBaseline: ["stale-dns"] });
  lab.inject("stale-dns");
  await lab.detect();
  return lab;
}
async function untilNotice(lab, n) { for (let i = 0; i < 60 && notices(lab).length < n; i++) await lab.advance(TICK); assert.equal(notices(lab).length, n, `reached notice ${n}`); }
async function untilCountdown(lab) { for (let i = 0; i < 80 && !rows(lab, "AUTO-FIX").length; i++) await lab.advance(TICK); await lab.advance(4000); assert.equal(rows(lab, "AUTO-FIX").length, 1, "in the countdown"); assert.equal(mutating(lab).length, 0, "nothing ran yet"); }

// ── 1 — crash at notice 3 → notice 3 again, the fix only a full interval after it ─────────────────────────────────────
{
  const lab = await escalation();
  await untilNotice(lab, 3);
  await lab.advance(MIN); // part-way through the last interval
  const t0 = lab.clock.now();
  const lab2 = await lab.restart();
  assert.equal(lab2.notifications.length, 0, "no notice at the instant of the launch");
  await lab2.advance(TICK);
  assert.deepEqual(lab2.notifications.map((n) => n.title), ["Notice 3 of 3: DNS lookup failed"], "the first tick RE-ISSUES notice 3 as a real desktop notification");
  assert.ok(cards(lab2).some((c) => c.advisory === 3 && c.choices.join() === "fix-now,not-now,never"), "…and the globe card with its three choices");
  const reissuedAt = Date.parse(notices(lab2).at(-1).ts);
  assert.equal(notices(lab2).at(-1).reissued, true, "audited as the re-issued notice");
  await lab2.advance(2 * MIN + 30 * 1000);
  assert.equal(after(lab2, t0, "AUTO-FIX").length, 0, "no fix inside the interval after the re-issue");
  await lab2.minutes(5);
  const fix = after(lab2, t0, "AUTO-FIX");
  assert.equal(fix.length, 1, "then — nobody answered the fresh notice — the fix (countdown first)");
  assert.ok(Date.parse(fix[0].ts) - reissuedAt >= 3 * MIN, "a full interval after the re-issued notice");
  await lab2.minutes(1);
  assert.ok(lab2.machine.dnsResolves());
  clean(lab2, "crash at notice 3");
}
g();

// ── 2 — crash during the countdown → that attempt cancelled (audited) → notice 3 again → never straight to the fix ──────
{
  const lab = await escalation();
  await untilCountdown(lab);
  const t0 = lab.clock.now();
  const lab2 = await lab.restart(); // the countdown dies with the process
  assert.equal(rows(lab2, "CANCEL", /ARIA closed during the countdown — the fix was cancelled and nothing ran/).length, 1, "the interrupted attempt is audited: cancelled, nothing ran");
  assert.equal(rows(lab2, "ADVISORY", /^Restarted at notice 3\/3: .* shows notice 3 again/).length, 1);
  await lab2.advance(TICK);
  assert.deepEqual(lab2.notifications.map((n) => n.title), ["Notice 3 of 3: DNS lookup failed"], "notice 3 is re-issued first");
  await lab2.minutes(10);
  assert.equal(after(lab2, t0, "AUTO-FIX").length, 0, "no fix straight away (a full interval, then the 30-minute gap the interrupted attempt counted toward)");
  assert.deepEqual(mutating(lab2), [], "nothing changed");
  assert.equal(lab2.machine.dnsResolves(), false);
  clean(lab2, "crash mid-countdown");
}
g();

// ── 3 — a clean QUIT during the countdown cancels the fix (audited); the relaunch never revives it ─────────────────────
{
  const lab = await escalation();
  await untilCountdown(lab);
  const n = lab.main.cancelCountdownsForQuit(); // what before-quit does
  assert.equal(n, 1, "the running countdown was cancelled at quit");
  await lab.clock.settle();
  assert.equal(rows(lab, "CANCEL", /^ARIA is quitting during 1 countdown\(s\) — that fix was cancelled; nothing ran\.$/).length, 1, "audited at quit");
  assert.equal(rows(lab, "ADVISORY", /the countdown was cancelled — nothing was changed, and ARIA will not retry on its own/).length, 1, "the escalation is closed as cancelled");
  const t0 = lab.clock.now();
  const lab2 = await lab.restart();
  await lab2.minutes(4 * 60);
  assert.equal(lab2.notifications.length, 0, "no notice after the relaunch — the quit cancelled it");
  assert.equal(after(lab2, t0, "AUTO-FIX").length, 0, "and never a fix");
  assert.deepEqual(mutating(lab2), [], "nothing changed");
  assert.equal((lab2.state().advisoryOutcomes.find((o) => o.recipeId === "dns-fail-v1") || {}).status, "cancelled");
  clean(lab2, "quit mid-countdown");
}
g();

// ── 4 — restart at notice 2 → notice 2 again, notice 3 a full interval later (never skipped ahead) ─────────────────────
{
  const lab = await escalation();
  await untilNotice(lab, 2);
  const lab2 = await lab.restart();
  await lab2.advance(TICK);
  assert.deepEqual(lab2.notifications.map((n) => n.title), ["Notice 2 of 3: DNS lookup failed"], "notice 2, again — not notice 3");
  await lab2.advance(2 * MIN + 30 * 1000);
  assert.equal(lab2.notifications.length, 1, "nothing more inside the interval");
  await lab2.advance(MIN);
  assert.deepEqual(lab2.notifications.map((n) => n.title), ["Notice 2 of 3: DNS lookup failed", "Notice 3 of 3: DNS lookup failed"], "then notice 3");
  clean(lab2, "restart at notice 2");
}
g();

// ── 5 — restart while ARIA is stopped → nothing re-issued until Start ARIA; then it is ─────────────────────────────────
{
  const lab = await escalation();
  await untilNotice(lab, 2);
  await lab.ipc.invoke("sentinel:stop-aria");
  const lab2 = await lab.restart();
  await lab2.minutes(30);
  assert.equal(lab2.notifications.length, 0, "stopped: no notice re-issued at the relaunch");
  assert.deepEqual(mutating(lab2), []);
  await lab2.ipc.invoke("sentinel:start-aria");
  await lab2.advance(TICK);
  assert.deepEqual(lab2.notifications.map((n) => n.title), ["Notice 2 of 3: DNS lookup failed"], "Start ARIA → the notice is re-issued");
  await lab2.ipc.invoke("sentinel:stop-aria"); // stop the real watchers Start ARIA started
  clean(lab2, "restart while stopped");
}
g();

assert.equal(groups, 5);
console.log(`fault-lab-advisory-restart test passed (${groups} groups · crash at notice 3 → notice 3 re-issued (desktop + card), the fix a full interval later · crash mid-countdown → cancelled (audited) + re-issued, never straight to the fix · clean quit mid-countdown → cancelled for good · restart at notice 2 → notice 2 again · stopped → nothing until Start ARIA).`);

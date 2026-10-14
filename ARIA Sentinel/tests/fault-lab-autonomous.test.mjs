// FAULT LAB (2026-10-14) — Autonomous mode: "advise three times, then act", proven on a simulated Windows machine
// against the REAL main.mjs (tests/lib/main-sandbox.mjs boots its own source; only the platform is faked) and the
// REAL modules it imports (executor · countdown · kill switch · approval policy · dry-run policy · escalation).
//
// For EVERY fault in the catalogue (tests/lib/fault-lab.mjs FAULTS), Autonomous mode, live fixes ON, nobody answering:
//   auto-fix       exactly 3 notices at the configured cadence → the visible 10-s countdown → the fix → verify → the
//                  machine diff equals EXACTLY the keys the fix may change → audit rows → notify-after
//   escalate       exactly 3 notices → the IT contact is told (fix-failed notify + approval for a fixable one) → the
//                  machine is identical; never executed
//   attempt-fails  3 notices → the fix runs and fails honestly → identical machine → fix-failed notify
//   guide-only     no notices, nothing runs, identical machine
// Then, for every L1/L2 fault the rule takes: Fix now at notice 1/2/3 (runs at once, through the same gates — a UAC
// prompt where admin rights are needed), Not now (nothing runs during the snooze, a fresh round after it), Never (never
// runs; an approval request instead; the Never list is honoured on the next detection), Ctrl+Alt+K at each stage
// (blocked, nothing changed, never resumed), a pause (frozen; resumes at the same notice) and an expired license
// (frozen from the start). For EVERY L3 fault: never executed without an explicit approval; the fault's own state is
// untouched. Plus: no unknown command was ever issued, no excluded-folder path was ever referenced or echoed.
import assert from "node:assert/strict";
import { bootLab, FAULTS, faultById, diff, healthyState } from "./lib/fault-lab.mjs";
import { RECIPES } from "../src/shared/recipes.mjs";
import { PRIVATE_FOLDER_NAME, PRIVATE_FOLDER_RE } from "../src/shared/path-guard.mjs";
import { ADVISORY_COUNT } from "../src/shared/advisory-escalation.mjs";

const MIN = 60 * 1000;
const TICK = 15 * 1000;
// Earned trust (recipe-history.json): ≥10 vetted runs lets a green, user-space recipe run unattended (Tier-1).
const VETTED = { "dns-fail-v1": 12, "svc-dnscache-stopped-v1": 12 };
let groups = 0; const g = () => { groups++; };
let scenarios = 0;
const findings = [];

const PROBE_RE = /^\(Get-|^Get-Service -Name \w+ \| Select-Object|^Get-ComputerRestorePoint|^\[math\]::Round|^Test-NetConnection/;
const mutating = (lab) => lab.machine.commands.filter((c) => !PROBE_RE.test(c.cmd) && !/^Checkpoint-Computer/.test(c.cmd));
const rows = (lab, tag, re) => lab.audit().filter((r) => r.tag === tag && (!re || re.test(r.text)));
function numbered(lab, recipeId) {
  return lab.audit().filter((r) => r.tag === "ADVISORY" && /^ADVISORY \d\/3: /.test(r.text) && r.recipeId === recipeId);
}
const ms = (row) => Date.parse(row.ts);
function keysOk(changed, f, label) {
  const allowed = new Set(f.fixKeys);
  const required = f.fixKeys.filter((k) => !(f.optionalKeys || []).includes(k));
  for (const k of changed) assert.ok(allowed.has(k), `${label}: ${f.id} changed ${k}, which its fix may not touch (changed: ${changed.join(", ")})`);
  for (const k of required) assert.ok(changed.includes(k), `${label}: ${f.id} did not change ${k} (changed: ${changed.join(", ")})`);
}
function clean(lab, label) {
  assert.deepEqual(lab.machine.unknownCommands, [], `${label}: every command was one the lab knows`);
  assert.deepEqual(lab.machine.violations, [], `${label}: nothing referenced the excluded folder`);
  assert.deepEqual(lab.clock.errors.map(String), [], `${label}: no timer threw`);
  assert.ok(!lab.capturedText().includes(PRIVATE_FOLDER_NAME) && !PRIVATE_FOLDER_RE.test(lab.capturedText()), `${label}: no excluded-folder name in any captured output`);
}
async function start(faultId, opts = {}) {
  const f = faultById(faultId);
  const lab = await bootLab({ vetted: VETTED, interval: 3, window: Boolean(f.needsWindow), preBaseline: [faultId], ...opts });
  lab.inject(faultId);
  const before = lab.machine.snapshot();
  await lab.detect({ person: f.report === "person" ? [faultId] : [], poison: opts.poison || null });
  scenarios++;
  return { lab, f, before, changed: () => diff(before, lab.machine.snapshot()) };
}
const activeFor = (lab, recipeId) => lab.advisories().find((a) => a.recipeId === recipeId) || null;
async function runUntilNotice(s, n) {
  for (let i = 0; i < 40 && numbered(s.lab, s.f.recipe).length < n; i++) await s.lab.advance(TICK);
  assert.equal(numbered(s.lab, s.f.recipe).length, n, `${s.f.id}: reached notice ${n}`);
}
const ticksSeen = (lab) => lab.appWin.sent.filter((m) => m.channel === "sentinel:countdown-tick").map((m) => m.payload.secondsLeft);
const cards = (lab) => lab.overlay.sent.filter((m) => m.channel === "sentinel:advisory").map((m) => m.payload);

// ── 1 — every fault, nobody answering: the path the catalogue declares, at the configured cadence ────────────────────
for (const f of FAULTS) {
  const s = await start(f.id);
  const { lab } = s;
  await lab.minutes(40);
  const label = `no-ack ${f.id}`;
  const notices = numbered(lab, f.recipe);
  const autoFix = rows(lab, "AUTO-FIX").filter((r) => r.recipeId === f.recipe);
  const escalated = rows(lab, "ESCALATE").filter((r) => r.recipeId === f.recipe);
  const changed = s.changed();
  if (f.path === "guide-only") {
    assert.equal(notices.length, 0, `${label}: a guide is never advised as a fix`);
    assert.equal(autoFix.length + escalated.length, 0, `${label}: nothing auto-fixed, nothing escalated`);
    assert.equal(mutating(lab).length, 0, `${label}: nothing ran`);
    assert.deepEqual(changed, [], `${label}: machine identical`);
    assert.ok(rows(lab, "DETECT").some((r) => r.recipeId === f.recipe), `${label}: still listed in What I found`);
  } else {
    assert.equal(notices.length, ADVISORY_COUNT, `${label}: exactly ${ADVISORY_COUNT} notices (${notices.map((r) => r.text.slice(0, 14)).join(" | ")})`);
    assert.deepEqual(notices.map((r) => r.advisory), [1, 2, 3], `${label}: notices 1/3, 2/3, 3/3 in order`);
    for (let i = 1; i < notices.length; i++) {
      const gap = ms(notices[i]) - ms(notices[i - 1]);
      assert.ok(gap >= 3 * MIN && gap <= 3 * MIN + TICK, `${label}: notice ${i + 1} came ${gap / 1000}s after notice ${i} (cadence 3 min)`);
    }
    const shown = cards(lab).filter((c) => c.recipeId === f.recipe);
    assert.ok(shown.length >= 3 && shown.every((c) => c.choices.join() === "fix-now,not-now,never"), `${label}: each notice pushed a globe card with the three choices`);
    assert.equal(lab.notifications.filter((nn) => /^Notice [123] of 3: /.test(nn.title)).length, 3, `${label}: one desktop notification per notice`);
    const last = ms(notices[2]);
    if (f.path === "auto-fix" || f.path === "attempt-fails") {
      assert.equal(autoFix.length, 1, `${label}: one AUTO-FIX after 3 advisories`);
      assert.match(autoFix[0].text, /^AUTO-FIX after 3 advisories: /);
      const wait = ms(autoFix[0]) - last;
      assert.ok(wait >= 3 * MIN && wait <= 3 * MIN + TICK, `${label}: the fix waited one more interval after notice 3 (${wait / 1000}s)`);
      assert.deepEqual(ticksSeen(lab).slice(0, 10), [10, 9, 8, 7, 6, 5, 4, 3, 2, 1], `${label}: the visible 10-second countdown ran first`);
      const firstMut = mutating(lab)[0];
      assert.ok(firstMut && firstMut.at >= ms(autoFix[0]) + 10 * 1000, `${label}: nothing changed before the countdown finished`);
      assert.equal(lab.machine.uacPrompts.length, 0, `${label}: an unattended fix never asks for elevation`);
      if (f.path === "auto-fix") {
        keysOk(changed, f, label);
        assert.ok(rows(lab, "DONE", /^Verification for .*: passed\.$/).length >= 1, `${label}: verification passed`);
        assert.ok(rows(lab, "FIX").some((r) => r.recipeId === f.recipe && r.outcome === "done"), `${label}: a FIX row (done)`);
        assert.ok(rows(lab, "ADVISORY", /fixed on its own after 3 notices/).length === 1, `${label}: the escalation closed as fixed`);
        assert.ok(lab.notifications.some((nn) => /^Done: /.test(nn.title)), `${label}: notify-after (desktop)`);
        assert.ok(lab.outbound.some((o) => /aria-sentinel-notify/.test(o.url) && /"event":"fix-executed"/.test(o.body)), `${label}: notify-after (email/SMS via the notify endpoint)`);
        if (f.fixesSymptomOnly) {
          assert.equal(f.resolved(lab.machine), false, `${label}: (known gap) the root cause is still there`);
          findings.push({ fault: f.id, gap: f.gap });
        } else assert.equal(f.resolved(lab.machine), true, `${label}: the fault is really gone`);
        if (f.l3FixNeverRuns) assert.ok(!lab.machine.commands.some((c) => f.l3FixNeverRuns.test(c.cmd)), `${label}: the L3 fix itself never ran`);
      } else {
        assert.deepEqual(changed, [], `${label}: a failed attempt changed nothing`);
        assert.ok(rows(lab, "FIX").some((r) => r.recipeId === f.recipe && r.outcome === "failed"), `${label}: reported as failed, never as fixed`);
        assert.ok(rows(lab, "ADVISORY", /the fix did not complete/).length === 1);
        assert.ok(lab.outbound.some((o) => /"event":"fix-failed"/.test(o.body)), `${label}: a person is told it failed`);
        findings.push({ fault: f.id, gap: f.gap });
      }
    } else if (f.path === "escalate") {
      assert.equal(autoFix.length, 0, `${label}: never auto-fixed`);
      assert.equal(escalated.length, 1, `${label}: escalated once`);
      const wait = ms(escalated[0]) - last;
      assert.ok(wait >= 3 * MIN && wait <= 3 * MIN + TICK, `${label}: escalated one interval after notice 3`);
      assert.match(escalated[0].text, /^ESCALATED to your IT contact — no answer after 3 notices: .*Nothing was changed\.$/);
      assert.equal(mutating(lab).length, 0, `${label}: nothing ran`);
      assert.equal(lab.machine.uacPrompts.length, 0, `${label}: no elevation was ever asked for`);
      assert.deepEqual(changed, [], `${label}: machine identical`);
      const told = lab.outbound.filter((o) => /aria-sentinel-notify/.test(o.url) && /"event":"fix-failed"/.test(o.body));
      assert.equal(told.length, 1, `${label}: the existing notify path told people once`);
      assert.match(told[0].body, /jordan@example\.com/, `${label}: …including the configured IT contact`);
      assert.match(told[0].body, /"outcome":"needs a person - no answer"/);
      const pending = lab.state().approvals.pending.filter((a) => a.recipeId === f.recipe);
      if (f.kind === "red") assert.equal(pending.length, 0, `${label}: red never becomes an approval (it never runs)`);
      else assert.equal(pending.length, 1, `${label}: a fixable one also waits as an approval`);
    }
  }
  clean(lab, label);
}
g();

// ── 2 — the configured cadence is the person's: 1 and 7 minutes ──────────────────────────────────────────────────────
for (const interval of [1, 7]) {
  const s = await start("stale-dns", { interval });
  await s.lab.minutes(interval * 4 + 2);
  const notices = numbered(s.lab, "dns-fail-v1");
  assert.equal(notices.length, 3);
  for (let i = 1; i < 3; i++) { const gap = ms(notices[i]) - ms(notices[i - 1]); assert.ok(gap >= interval * MIN && gap <= interval * MIN + TICK, `interval ${interval}: gap ${gap}`); }
  const fix = rows(s.lab, "AUTO-FIX")[0];
  assert.ok(fix && ms(fix) - ms(notices[2]) >= interval * MIN, `interval ${interval}: the fix waited one interval after notice 3`);
  keysOk(s.changed(), s.f, `interval ${interval}`);
  clean(s.lab, `interval ${interval}`);
}
g();

// The faults the rule takes (they get notices) at L1/L2 — the choice matrix runs on each.
const TAKEN = FAULTS.filter((f) => f.level !== "L3" && f.path !== "guide-only");
// What "Fix now" leads to: a run through the SAME supervised pipeline with the person present.
function expectFixNow(s, label) {
  const { lab, f } = s;
  const changed = s.changed();
  if (f.id === "teams-stuck") {
    // yellow on the standard (user) token: no verified restore point can be made → an approval, never a change.
    assert.deepEqual(changed, [], `${label}: a yellow fix without a restore point changes nothing`);
    assert.ok(lab.state().approvals.pending.some((a) => a.recipeId === f.recipe && /restore-point-unavailable/.test(a.reason)), `${label}: asked for a yes instead (restore point unavailable)`);
    return;
  }
  if (f.path === "attempt-fails") { assert.deepEqual(changed, [], `${label}: the attempt fails honestly`); return; }
  keysOk(changed, f, label);
  if (!f.fixesSymptomOnly) assert.equal(f.resolved(lab.machine), true, `${label}: fixed`);
  if (f.needsAdmin) assert.ok(lab.machine.uacPrompts.length >= 1, `${label}: Windows asked the person (UAC) because the fix needs admin rights`);
  else assert.equal(lab.machine.uacPrompts.length, 0, `${label}: a user-space fix never asks for elevation`);
  assert.equal(rows(lab, "AUTO-FIX").length, 0, `${label}: it was the person's fix, not an automatic one`);
}

// ── 3 — Fix now at notice 1, 2 and 3: runs at once through the same gates (countdown first) ──────────────────────────
for (const f of TAKEN) {
  for (const k of [1, 2, 3]) {
    const s = await start(f.id);
    await runUntilNotice(s, k);
    const rec = activeFor(s.lab, f.recipe);
    assert.ok(rec && rec.advisory === k && rec.choices.includes("fix-now"), `${f.id}: the Home row offers Fix now at notice ${k}`);
    const r = await s.lab.ack(rec.id, "fix-now");
    assert.equal(r.ok, true, `${f.id}: ack ok`);
    assert.ok(r.fix, `${f.id}: Fix now handed the run to the supervised pipeline`);
    await s.lab.minutes(2);
    expectFixNow(s, `fix-now@${k} ${f.id}`);
    assert.equal(numbered(s.lab, f.recipe).length, k, `fix-now@${k} ${f.id}: no further notices after the choice`);
    assert.ok(!activeFor(s.lab, f.recipe), `fix-now@${k} ${f.id}: the escalation ended`);
    await s.lab.minutes(30);
    assert.equal(rows(s.lab, "AUTO-FIX").length, 0, `fix-now@${k} ${f.id}: never an automatic run afterwards`);
    clean(s.lab, `fix-now@${k} ${f.id}`);
  }
}
g();

// ── 4 — Not now: nothing runs during the snooze; a fresh round after it (then the path completes) ────────────────────
for (const f of TAKEN) {
  const s = await start(f.id, { snooze: 4 });
  await runUntilNotice(s, 2);
  const rec = activeFor(s.lab, f.recipe);
  const r = await s.lab.ack(rec.id, "not-now");
  assert.equal(r.ok, true); assert.equal(r.advisory.status, "snoozed");
  const cmdsAt = s.lab.machine.commands.length;
  await s.lab.minutes(3 * 60 + 50);
  assert.equal(numbered(s.lab, f.recipe).length, 2, `not-now ${f.id}: no notice during the snooze`);
  assert.equal(s.lab.machine.commands.length, cmdsAt, `not-now ${f.id}: nothing ran during the snooze`);
  assert.deepEqual(s.changed(), [], `not-now ${f.id}: machine identical during the snooze`);
  for (let i = 0; i < 80 && numbered(s.lab, f.recipe).length < 3; i++) await s.lab.advance(TICK);
  const after = numbered(s.lab, f.recipe);
  assert.equal(after.length, 3, `not-now ${f.id}: the snooze ended with a fresh notice`);
  assert.equal(after[2].advisory, 1, `not-now ${f.id}: …notice 1 of a new round`);
  assert.equal(after[2].cycle, 2);
  assert.ok(rows(s.lab, "ADVISORY", /^Snooze over: /).length === 1);
  await s.lab.minutes(40);
  if (f.path === "auto-fix") keysOk(s.changed(), f, `not-now ${f.id} (after the new round)`);
  else if (f.path === "escalate") { assert.equal(rows(s.lab, "ESCALATE").length, 1, `not-now ${f.id}: escalated after the new round`); assert.deepEqual(s.changed(), []); }
  clean(s.lab, `not-now ${f.id}`);
}
g();

// ── 5 — Never for this: never runs; an approval request instead; honoured on the next detection ──────────────────────
for (const f of TAKEN) {
  const s = await start(f.id);
  const rec = activeFor(s.lab, f.recipe);
  const r = await s.lab.ack(rec.id, "never");
  assert.equal(r.ok, true); assert.equal(r.advisory.status, "never");
  assert.ok(s.lab.state().advisoryNever.includes(f.recipe), `never ${f.id}: persisted on the Never list`);
  assert.ok(s.lab.state().approvals.pending.some((a) => a.recipeId === f.recipe && a.reason === "never-for-this"), `never ${f.id}: an approval request instead`);
  await s.lab.minutes(60);
  assert.equal(numbered(s.lab, f.recipe).length, 1, `never ${f.id}: no further notices`);
  assert.equal(rows(s.lab, "AUTO-FIX").length, 0, `never ${f.id}: never an automatic run`);
  assert.equal(mutating(s.lab).length, 0, `never ${f.id}: nothing ran`);
  assert.deepEqual(s.changed(), [], `never ${f.id}: machine identical`);
  // A later detection of the same problem: no new round of notices — approve-first on this device.
  await s.lab.main.detectIssue({ source: "detection-watcher", signal: s.lab.audit().find((x) => x.tag === "DETECT" && x.recipeId === f.recipe).text.split(":")[0], issue: "again" });
  await s.lab.minutes(30);
  assert.equal(numbered(s.lab, f.recipe).length, 1, `never ${f.id}: the next detection is not advised again`);
  assert.ok(rows(s.lab, "ADVISORY", /you chose "Never for this"/).length >= 1, `never ${f.id}: the next detection says why`);
  assert.equal(mutating(s.lab).length, 0);
  // …and the person can still approve it explicitly (approve-first): it runs through the same gates.
  clean(s.lab, `never ${f.id}`);
}
g();

// ── 6 — Ctrl+Alt+K at every stage: blocked, audited, nothing changed, never resumed silently ─────────────────────────
for (const f of TAKEN) {
  const stages = f.path === "auto-fix" || f.path === "attempt-fails" ? ["after-notice-1", "after-notice-3", "during-countdown"] : ["after-notice-1", "after-notice-3"];
  for (const stage of stages) {
    const s = await start(f.id);
    if (stage === "after-notice-3") await runUntilNotice(s, 3);
    if (stage === "during-countdown") {
      for (let i = 0; i < 60 && !rows(s.lab, "AUTO-FIX").length; i++) await s.lab.advance(TICK);
      assert.equal(rows(s.lab, "AUTO-FIX").length, 1, `kill ${f.id}: reached the countdown`);
      await s.lab.advance(3000);
      assert.equal(mutating(s.lab).length, 0, `kill ${f.id}: still counting down`);
    }
    const k = await s.lab.kill();
    assert.equal(k.ok, true);
    const label = `kill@${stage} ${f.id}`;
    assert.ok(rows(s.lab, "KILL-SWITCH", /advisory escalation\(s\) blocked — they will not resume on their own/).length === 1, `${label}: audited`);
    await s.lab.minutes(4 * 60);
    assert.equal(mutating(s.lab).length, 0, `${label}: nothing ran`);
    assert.deepEqual(s.changed(), [], `${label}: machine identical`);
    assert.ok(numbered(s.lab, f.recipe).length <= 3, `${label}: no further notices`);
    assert.equal(rows(s.lab, "ESCALATE").length, 0, `${label}: not even an escalation after the kill`);
    const outcome = s.lab.state().advisoryOutcomes.find((o) => o.recipeId === f.recipe);
    assert.equal(outcome && outcome.status, "blocked", `${label}: recorded as blocked`);
    clean(s.lab, label);
  }
}
g();

// ── 7 — frozen: a pause holds an open escalation at its notice (and resumes there); an expired license never starts one ─
for (const f of TAKEN) {
  const s = await start(f.id);
  await runUntilNotice(s, 2);
  await s.lab.ipc.invoke("sentinel:set-paused", 2 * 60 * MIN);
  await s.lab.minutes(110);
  assert.equal(numbered(s.lab, f.recipe).length, 2, `paused ${f.id}: no notice while paused`);
  assert.equal(mutating(s.lab).length, 0, `paused ${f.id}: nothing ran while paused`);
  assert.ok(rows(s.lab, "ADVISORY", /^Paused at notice 2\/3: .*\(paused\)/).length === 1, `paused ${f.id}: audited once`);
  assert.equal(activeFor(s.lab, f.recipe).frozen, "paused");
  await s.lab.ipc.invoke("sentinel:set-paused", 0);
  await s.lab.advance(TICK);
  assert.ok(rows(s.lab, "ADVISORY", /^Resumed at notice 2\/3: /).length === 1, `paused ${f.id}: resumed at the same notice`);
  assert.equal(activeFor(s.lab, f.recipe).advisory, 2, `paused ${f.id}: never skipped ahead`);
  await s.lab.minutes(30);
  assert.equal(numbered(s.lab, f.recipe).length, 3, `paused ${f.id}: the round completes after the pause`);
  clean(s.lab, `paused ${f.id}`);
}
for (const f of TAKEN) {
  const s = await start(f.id, { trial: "expired" });
  await s.lab.minutes(60);
  assert.equal(numbered(s.lab, f.recipe).length, 0, `license ${f.id}: no notices while the license is expired`);
  assert.equal(mutating(s.lab).length, 0, `license ${f.id}: and nothing runs on its own`);
  assert.ok(rows(s.lab, "ADVISORY", /not advising or fixing on its own while license/).length === 1, `license ${f.id}: says why`);
  assert.deepEqual(s.changed(), []);
  clean(s.lab, `license ${f.id}`);
}
g();

// ── 8 — every L3 fault: never executed in any way without an explicit approval; its own state untouched ───────────────
for (const f of FAULTS.filter((x) => x.level === "L3")) {
  const s = await start(f.id);
  const base = healthyState();
  if (f.preBaseline) f.preBaseline(base);
  const rootKeys = f.rootKeys || diff(base, s.before).filter((k) => !/^(eventLog|werReports|minidumps)/.test(k));
  await s.lab.minutes(4 * 60);
  const label = `L3 ${f.id}`;
  const changedNow = diff(s.before, s.lab.machine.snapshot());
  assert.ok(rootKeys.length > 0, `${label}: the fault has root-cause keys`);
  for (const k of rootKeys) assert.ok(!changedNow.includes(k), `${label}: the fault's own key ${k} is untouched`);
  if (f.path === "escalate") {
    assert.equal(numbered(s.lab, f.recipe).length, 3, `${label}: 3 notices`);
    assert.equal(rows(s.lab, "ESCALATE").length, 1, `${label}: then the IT contact`);
    assert.deepEqual(s.changed(), [], `${label}: machine identical`);
    assert.equal(mutating(s.lab).length, 0, `${label}: nothing ran`);
  }
  if (f.l3FixNeverRuns) assert.ok(!s.lab.machine.commands.some((c) => f.l3FixNeverRuns.test(c.cmd)), `${label}: the L3 fix never ran`);
  if (f.color === "red") {
    for (const r of RECIPES.filter((x) => x.id === f.recipe)) for (const a of r.actions || []) assert.ok(!s.lab.machine.commands.some((c) => c.cmd.includes(a.command)), `${label}: red step "${a.id}" never ran`);
    // "Get help now" on a red notice escalates at once — still never a run.
    const t = await start(f.id);
    const rec = activeFor(t.lab, f.recipe);
    assert.deepEqual(rec.choices, ["fix-now", "not-now", "never"]);
    assert.equal(rec.copy.choices[0].label, "Get help now");
    const r = await t.lab.ack(rec.id, "fix-now");
    assert.equal(r.ok, true); assert.equal(r.fix, null, `${label}: Get help now never runs anything`);
    assert.ok(rows(t.lab, "ESCALATE", /you asked for help/).length === 1);
    await t.lab.minutes(30);
    assert.deepEqual(t.changed(), []); assert.equal(mutating(t.lab).length, 0);
    clean(t.lab, `${label} get-help`);
  }
  clean(s.lab, label);
}
// spooler-disabled: an EXPLICIT approval runs it through the same gates — and it fails honestly (needs an administrator to re-enable it).
{
  const s = await start("spooler-disabled");
  await s.lab.minutes(15);
  const apr = s.lab.state().approvals.pending.find((a) => a.recipeId === "printer-spooler-v1");
  assert.ok(apr, "the escalation left an approval request");
  const r = await s.lab.approve(apr.id);
  assert.equal(r.ok, true);
  await s.lab.minutes(2);
  assert.ok(s.lab.machine.uacPrompts.length >= 1, "approved → the UAC prompt the person answers");
  assert.deepEqual(s.changed(), [], "a disabled service cannot be started: nothing changed");
  assert.ok(rows(s.lab, "FIX").some((x) => x.recipeId === "printer-spooler-v1" && x.outcome === "failed"), "reported as failed, never as fixed");
  clean(s.lab, "L3 spooler-disabled approved");
}
g();

// ── 9 — fresh install (nothing vetted yet): the rule never promises an unattended fix it cannot make ───────────────────
{
  const s = await start("stale-dns", { vetted: {} });
  const rec = activeFor(s.lab, "dns-fail-v1");
  assert.equal(rec.track, "tech-contact"); assert.equal(rec.kind, "not-yet-vetted");
  assert.match(rec.copy.willDo, /hasn't been proven on this device yet/);
  await s.lab.minutes(15);
  assert.equal(rows(s.lab, "AUTO-FIX").length, 0); assert.equal(rows(s.lab, "ESCALATE").length, 1);
  assert.deepEqual(s.changed(), []);
  const t = await start("stale-dns", { vetted: {} });
  const r = await t.lab.ack(activeFor(t.lab, "dns-fail-v1").id, "fix-now");
  assert.equal(r.ok, true);
  await t.lab.minutes(2);
  keysOk(t.changed(), t.f, "fresh-install fix-now");
  clean(s.lab, "fresh"); clean(t.lab, "fresh fix-now");
}
g();

// ── 10 — Teams (yellow) on an elevated agent token inside the maintenance window: Fix now makes a VERIFIED restore point first ─
{
  const s = await start("teams-stuck", { profile: "elevated-agent" });
  const rec = activeFor(s.lab, "teams-cache-v1");
  assert.equal(rec.kind, "needs-confirm", "yellow always needs a yes — never on its own");
  await s.lab.ack(rec.id, "fix-now");
  await s.lab.minutes(2);
  const changed = s.changed();
  keysOk(changed, s.f, "teams elevated fix-now");
  assert.ok(changed.includes("restorePoints"), "a new restore point exists");
  const rp = s.lab.machine.state.restorePoints.at(-1).at;
  const firstChange = mutating(s.lab)[0].at;
  assert.ok(rp <= firstChange, "the restore point was made BEFORE the first change");
  assert.ok(rows(s.lab, "RESTORE PT", /created and verified/).length >= 1);
  clean(s.lab, "teams elevated");
}
g();

// ── 11 — restart mid-escalation: the same notice, never ahead; a fix in flight at shutdown is not re-run on restart ─────
{
  const s = await start("stale-dns");
  await runUntilNotice(s, 2);
  const lab2 = await s.lab.restart();
  assert.ok(lab2.audit().some((r) => r.tag === "ADVISORY" && /^ADVISORY 2\/3 resumed after restart: /.test(r.text)), "resumed at notice 2");
  await lab2.minutes(2);
  assert.equal(numbered(lab2, "dns-fail-v1").length, 2, "no notice immediately after the restart");
  await lab2.minutes(20);
  assert.equal(numbered(lab2, "dns-fail-v1").length, 3, "the round completes");
  assert.equal(rows(lab2, "AUTO-FIX").length, 1);
  keysOk(diff(s.before, lab2.machine.snapshot()), s.f, "restart");
  // mid-countdown restart: the countdown dies with the process → back to notice 3 → a full interval → then the fix.
  const t = await start("stale-dns");
  for (let i = 0; i < 60 && !rows(t.lab, "AUTO-FIX").length; i++) await t.lab.advance(TICK);
  await t.lab.advance(4000);
  const lab3 = await t.lab.restart();
  assert.ok(lab3.audit().some((r) => /^ADVISORY 3\/3 resumed after restart: /.test(r.text)), "a fix in flight goes back to notice 3");
  await lab3.minutes(1);
  assert.equal(mutating(lab3).length, 0, "nothing re-runs straight away");
  await lab3.minutes(5);
  // The interrupted attempt already counted as an automatic fix, so the existing 30-minute gap between automatic fixes
  // (autonomous.mjs evaluateAutoFire) holds the retry — it waits, it is not dropped and not rushed.
  assert.equal(rows(lab3, "AUTO-FIX").length, 1, "no second automatic run inside the 30-minute gap");
  assert.ok(rows(lab3, "ADVISORY", /waiting for the 30-minute gap between automatic fixes/).length === 1, "it says it is waiting for the gap");
  assert.equal(mutating(lab3).length, 0, "still nothing changed");
  await lab3.minutes(30);
  assert.equal(rows(lab3, "AUTO-FIX").length, 2, "the fix runs once the gap has passed");
  keysOk(diff(t.before, lab3.machine.snapshot()), t.f, "restart mid-countdown");
  clean(lab2, "restart"); clean(lab3, "restart mid-countdown");
}
g();

// ── 12 — a poisoned signal (an excluded-folder path in the issue text) never reaches any audit / notify / state string ───
{
  const poison = `C:\\Users\\Sam\\Pictures\\${PRIVATE_FOLDER_NAME}\\IMG_0007.jpg`;
  const s = await start("stale-dns", { poison });
  await s.lab.minutes(15);
  keysOk(s.changed(), s.f, "poisoned");
  clean(s.lab, "poisoned");
}
g();

// ── 13 — the strict-Windows belief: if `ipconfig /registerdns` needs elevation (the registry says it does not), the DNS
//         auto-fix fails at step 2 and is reported failed — never fixed — and only the flush it really made is changed.
{
  const s = await start("stale-dns", { strictAdmin: true });
  await s.lab.minutes(15);
  assert.ok(rows(s.lab, "FIX").some((r) => r.recipeId === "dns-fail-v1" && r.outcome === "failed"), "strict: reported failed");
  assert.deepEqual(s.changed(), ["dns.cacheEntries", "dns.staleEntries"], "strict: the flush happened, the re-registration did not");
  findings.push({ fault: "stale-dns (strict admin model)", gap: "If Windows refuses `ipconfig /registerdns` for a standard user (as it is believed to), dns-fail-v1 fails at its second step on every unattended run; the registry declares the step user-space." });
  clean(s.lab, "strict");
}
g();

assert.equal(groups, 13);
console.log(`fault-lab-autonomous test passed (${groups} groups · ${scenarios} scenarios on the simulated Windows machine against the real main.mjs · ${FAULTS.length} faults · paths auto-fix/escalate/attempt-fails/guide-only · Fix now ×3 · Not now · Never · Ctrl+Alt+K ×${2}-3 stages · pause · expired license · L3 never executed · fresh install · yellow restore point first · restart resume · poisoned input · strict admin model).`);
for (const fnd of findings) console.log(`  finding — ${fnd.fault}: ${fnd.gap}`);

// ADVISORY ESCALATION (2026-10-14) — the pure "advise three times, then act" machine (src/shared/advisory-escalation.mjs).
// Proves, with an injected clock and no timers: the cadence (3 notices, one interval apart, then the last step one more
// interval later), the 1–60 min clamp, idempotency per detection + one escalation per recipe, the three choices (Fix now ·
// Not now · Never), the persisted Never list, the snooze and its fresh round, the kill switch (blocked, never resumed
// silently), the freeze (remaining time kept), the restart re-issue (the same notice shown again, never skipped ahead, never straight to the fix),
// the cooldown deferral, settle, the stale-fix guard, the plain-words copy and the rule sentence built from the constants.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ADVISORY_COUNT, ADVISORY_INTERVAL_DEFAULT_MIN, ADVISORY_INTERVAL_MIN, ADVISORY_INTERVAL_MAX, ADVISORY_SNOOZE_DEFAULT_H,
  ADVISORY_SNOOZE_MIN_H, ADVISORY_SNOOZE_MAX_H, ADVISORY_COUNTDOWN_SECONDS, ADVISORY_CHOICES, ADVISORY_RECORDS_MAX, ADVISORY_FIXING_STALE_MS,
  clampAdvisoryInterval, clampSnoozeHours, normalizeAdvisoryPrefs, ruleSentence, emptyAdvisoryState, normalizeAdvisoryState,
  openRecord, tickState, ackRecord, killAll, restoreState, deferRecord, markFixing, settleRecord, clearNeverRecipe,
  advisoryCopy, advisoryView, msUntilAction, createAdvisoryEscalation
} from "../src/shared/advisory-escalation.mjs";
import { COUNTDOWN_SECONDS } from "../src/main/action-countdown.mjs";
import { sanitizePrefs, defaultV2Prefs, normalizeSetupPrefs, updateSetupPrefs } from "../src/shared/app-config.mjs";
import { PRIVATE_FOLDER_RE } from "../src/shared/path-guard.mjs";

const MIN = 60 * 1000;
const T0 = Date.UTC(2026, 9, 14, 14, 0, 0);
let n = 0; const t = () => { n++; };
const P3 = { advisoryIntervalMinutes: 3 };
const inp = (over = {}) => ({ detectionId: "det-1", recipeId: "dns-fail-v1", title: "DNS lookup failed", summary: "Flush stale DNS cache and retry the current connection.", color: "green", track: "auto-fix", kind: "green", ...over });
const types = (effects) => effects.map((e) => e.type + (e.n ? `:${e.n}` : ""));

// 1 — constants, clamps, prefs; the countdown the sentence promises IS the real countdown; setup prefs accept the keys.
{
  assert.equal(ADVISORY_COUNT, 3);
  assert.equal(ADVISORY_INTERVAL_DEFAULT_MIN, 3); assert.equal(ADVISORY_INTERVAL_MIN, 1); assert.equal(ADVISORY_INTERVAL_MAX, 60);
  assert.equal(ADVISORY_SNOOZE_DEFAULT_H, 4); assert.equal(ADVISORY_SNOOZE_MIN_H, 1); assert.equal(ADVISORY_SNOOZE_MAX_H, 72);
  assert.deepEqual([...ADVISORY_CHOICES], ["fix-now", "not-now", "never"]);
  assert.equal(ADVISORY_COUNTDOWN_SECONDS, COUNTDOWN_SECONDS, "the rule's countdown is the real pre-execution countdown");
  for (const [v, want] of [[0, 1], [-5, 1], [1, 1], [3, 3], [2.6, 3], [60, 60], [61, 60], [9999, 60], ["abc", 3], [null, 1], [undefined, 3]]) assert.equal(clampAdvisoryInterval(v), want, `interval ${v}`);
  for (const [v, want] of [[0, 1], [4, 4], [72, 72], [73, 72], ["x", 4]]) assert.equal(clampSnoozeHours(v), want, `snooze ${v}`);
  assert.deepEqual(normalizeAdvisoryPrefs({}), { intervalMinutes: 3, snoozeHours: 4 });
  assert.deepEqual(normalizeAdvisoryPrefs({ advisoryIntervalMinutes: 0, advisorySnoozeHours: 500 }), { intervalMinutes: 1, snoozeHours: 72 });
  // main.mjs hands the machine the NORMALIZED object — normalizing it again is the identity (regression: the fault lab
  // found a configured 1-minute interval running at the 3-minute default).
  for (const raw of [{}, { advisoryIntervalMinutes: 1 }, { advisoryIntervalMinutes: 7, advisorySnoozeHours: 9 }, { advisoryIntervalMinutes: 99 }]) {
    const once = normalizeAdvisoryPrefs(raw);
    assert.deepEqual(normalizeAdvisoryPrefs(once), once, `idempotent for ${JSON.stringify(raw)}`);
  }
  assert.equal(openRecord(emptyAdvisoryState(), inp(), T0, normalizeAdvisoryPrefs({ advisoryIntervalMinutes: 1 })).record.nextAt, T0 + MIN, "the normalized shape drives the cadence");
  assert.deepEqual(sanitizePrefs({ advisoryIntervalMinutes: 75, advisorySnoozeHours: 0 }), { advisoryIntervalMinutes: 60, advisorySnoozeHours: 1 });
  assert.deepEqual(sanitizePrefs({ unrelated: 1 }), {}, "unknown keys still never survive");
  assert.ok(!("advisoryIntervalMinutes" in defaultV2Prefs()), "Rule 15 — the v2 default prefs shape is unchanged");
  const cfg = updateSetupPrefs(null, { advisoryIntervalMinutes: 5 });
  assert.equal(normalizeSetupPrefs(cfg).advisoryIntervalMinutes, 5, "the interval persists through the setup prefs");
  assert.equal(normalizeSetupPrefs(updateSetupPrefs(cfg, { autonomyLevel: "full-auto" })).advisoryIntervalMinutes, 5, "a later partial update keeps it");
}
t();

// 2 — cadence: notice 1 at open, 2 and 3 one interval apart, the last step one more interval after notice 3.
{
  let r = openRecord(emptyAdvisoryState(), inp(), T0, P3);
  assert.equal(r.opened, true); assert.deepEqual(types(r.effects), ["advise:1"]);
  const rec = r.record;
  assert.equal(rec.advisory, 1); assert.equal(rec.of, 3); assert.equal(rec.nextAt, T0 + 3 * MIN); assert.equal(rec.status, "advising");
  let s = r.state;
  r = tickState(s, T0 + 3 * MIN - 1, {}, P3); assert.deepEqual(r.effects, [], "nothing before the interval"); s = r.state;
  r = tickState(s, T0 + 3 * MIN, {}, P3); assert.deepEqual(types(r.effects), ["advise:2"]); s = r.state;
  r = tickState(s, T0 + 6 * MIN + 14000, {}, P3); assert.deepEqual(types(r.effects), ["advise:3"]); s = r.state;
  assert.equal(s.records[0].nextAt, T0 + 9 * MIN + 14000, "the next step is measured from the notice actually shown");
  r = tickState(s, T0 + 9 * MIN, {}, P3); assert.deepEqual(r.effects, [], "not before one full interval after notice 3"); s = r.state;
  r = tickState(s, T0 + 9 * MIN + 14000, {}, P3); assert.deepEqual(types(r.effects), ["auto-fix"]); s = r.state;
  assert.equal(s.records[0].status, "ready");
  r = tickState(s, T0 + 60 * MIN, {}, P3); assert.deepEqual(r.effects, [], "the auto-fix effect fires exactly once");
  // interval 1 minute; the tech-contact track ends by escalating (terminal), never "auto-fix".
  let q = openRecord(emptyAdvisoryState(), inp({ track: "tech-contact", kind: "needs-admin", recipeId: "svc-spooler-stopped-v1", detectionId: "d-sp" }), T0, { advisoryIntervalMinutes: 1 });
  const seen = [];
  for (let m = 1; m <= 5; m++) { q = tickState(q.state, T0 + m * MIN, {}, { advisoryIntervalMinutes: 1 }); seen.push(...types(q.effects)); }
  assert.deepEqual(seen, ["advise:2", "advise:3", "escalate"]);
  assert.equal(q.state.records[0].status, "escalated"); assert.equal(q.state.records[0].outcome, "escalated-unanswered");
  // msUntilAction: at notice 1 the action is 3 intervals away.
  const fresh = openRecord(emptyAdvisoryState(), inp(), T0, P3).record;
  assert.equal(msUntilAction(fresh, P3, T0), 9 * MIN);
  assert.equal(msUntilAction(fresh, { advisoryIntervalMinutes: 1 }, T0 + MIN), 4 * MIN, "remaining = time to the next notice + one interval per notice still to come");
}
t();

// 3 — idempotency: one escalation per detection id, one active per recipe, the Never list refuses to open.
{
  let r = openRecord(emptyAdvisoryState(), inp(), T0, P3);
  const s = r.state;
  r = openRecord(s, inp(), T0 + 1000, P3); assert.equal(r.opened, false); assert.equal(r.reason, "duplicate-detection"); assert.equal(r.state.records.length, 1);
  r = openRecord(s, inp({ detectionId: "det-2" }), T0 + 1000, P3); assert.equal(r.opened, false); assert.equal(r.reason, "already-advising", "a repeat detection joins the open escalation");
  assert.deepEqual(r.effects, [], "…and issues no extra notice");
  r = openRecord({ ...s, never: ["dns-fail-v1"] }, inp({ detectionId: "det-9" }), T0, P3); assert.equal(r.opened, false); assert.equal(r.reason, "never");
  r = openRecord(s, inp({ recipeId: "bad id with spaces" }), T0, P3); assert.equal(r.opened, false); assert.equal(r.reason, "bad-recipe");
  const other = openRecord(s, inp({ detectionId: "det-3", recipeId: "svc-audiosrv-stopped-v1" }), T0, P3);
  assert.equal(other.opened, true, "a different recipe opens its own escalation"); assert.notEqual(other.record.id, s.records[0].id);
}
t();

// 4 — the three choices. Any choice ends the escalation; Not now waits the snooze then starts a fresh round.
{
  const base = openRecord(emptyAdvisoryState(), inp(), T0, P3).state;
  let r = ackRecord(base, base.records[0].id, "fix-now", T0 + MIN, P3);
  assert.equal(r.ok, true); assert.deepEqual(types(r.effects), ["run-now"]); assert.equal(r.record.status, "acknowledged"); assert.equal(r.record.choice, "fix-now");
  assert.deepEqual(tickState(r.state, T0 + 99 * MIN, {}, P3).effects, [], "Fix now ended it: no further notice, no auto-fix");
  const red = openRecord(emptyAdvisoryState(), inp({ recipeId: "bsod-critical-process-v1", color: "red", track: "tech-contact", kind: "red", detectionId: "d-red" }), T0, P3).state;
  r = ackRecord(red, red.records[0].id, "fix-now", T0 + MIN, P3);
  assert.deepEqual(r.effects, [{ type: "escalate", id: red.records[0].id, why: "fix-now" }], "red: 'Get help now' escalates — it never runs");
  assert.equal(r.record.status, "escalated");
  r = ackRecord(base, base.records[0].id, "not-now", T0 + MIN, { ...P3, advisorySnoozeHours: 4 });
  assert.equal(r.record.status, "snoozed"); assert.equal(r.record.snoozedUntil, T0 + MIN + 4 * 60 * MIN);
  let s = r.state;
  for (const at of [T0 + 10 * MIN, T0 + 3 * 60 * MIN, T0 + MIN + 4 * 60 * MIN - 1]) { const q = tickState(s, at, {}, P3); assert.deepEqual(q.effects, [], "nothing runs or notifies during the snooze"); s = q.state; }
  const back = tickState(s, T0 + MIN + 4 * 60 * MIN, {}, P3);
  assert.deepEqual(types(back.effects), ["reopened", "advise:1"], "after the snooze: a fresh round from notice 1");
  assert.equal(back.state.records[0].cycle, 2);
  assert.equal(ackRecord(s, s.records[0].id, "not-now", T0 + 20 * MIN, P3).reason, "already-snoozed");
  r = ackRecord(base, base.records[0].id, "never", T0 + MIN, P3);
  assert.equal(r.record.status, "never"); assert.deepEqual(r.state.never, ["dns-fail-v1"]); assert.deepEqual(types(r.effects), ["never"]);
  assert.equal(openRecord(r.state, inp({ detectionId: "det-7" }), T0 + 2 * MIN, P3).reason, "never", "the Never list is honoured on the next detection");
  assert.deepEqual(clearNeverRecipe(r.state, "dns-fail-v1").state.never, [], "Allow again removes it");
  assert.equal(ackRecord(r.state, r.record.id, "fix-now", T0 + 2 * MIN, P3).reason, "already-never");
  assert.equal(ackRecord(base, base.records[0].id, "maybe", T0, P3).reason, "bad-choice");
  assert.equal(ackRecord(base, "nope", "fix-now", T0, P3).reason, "not-found");
  const fixing = markFixing(tickState(tickState(tickState(base, T0 + 3 * MIN, {}, P3).state, T0 + 6 * MIN, {}, P3).state, T0 + 9 * MIN, {}, P3).state, base.records[0].id, T0 + 9 * MIN).state;
  assert.equal(ackRecord(fixing, base.records[0].id, "not-now", T0 + 9 * MIN, P3).reason, "already-fixing", "the countdown is the person's cancel point once it runs");
}
t();

// 5 — Ctrl+Alt+K: every active escalation is blocked (terminal) and never resumes; a NEW detection starts visibly from 1.
{
  let s = openRecord(emptyAdvisoryState(), inp(), T0, P3).state;
  s = openRecord(s, inp({ detectionId: "d2", recipeId: "svc-audiosrv-stopped-v1", track: "tech-contact", kind: "needs-admin" }), T0, P3).state;
  const k = killAll(s, T0 + MIN);
  assert.equal(k.blocked, 2); assert.ok(k.state.records.every((r) => r.status === "blocked" && r.outcome === "kill-switch"));
  let after = k.state;
  for (let m = 2; m < 60; m += 5) { const q = tickState(after, T0 + m * MIN, {}, P3); assert.deepEqual(q.effects, [], "blocked escalations never resume"); after = q.state; }
  assert.equal(restoreState(after, T0 + 90 * MIN, P3).effects.length, 0, "…not even after a restart");
  const again = openRecord(after, inp({ detectionId: "d3" }), T0 + 91 * MIN, P3);
  assert.equal(again.opened, true, "a later detection opens a new, visible round"); assert.deepEqual(types(again.effects), ["advise:1"]);
}
t();

// 6 — freeze (paused / fleet kill / license / stopped / live fixes off): nothing advances; the remaining time is kept.
{
  let s = openRecord(emptyAdvisoryState(), inp(), T0, P3).state;
  let r = tickState(s, T0 + MIN, { frozen: "paused" }, P3);
  assert.deepEqual(types(r.effects), ["frozen"]); s = r.state;
  for (const at of [T0 + 3 * MIN, T0 + 9 * MIN, T0 + 40 * MIN]) { r = tickState(s, at, { frozen: "paused" }, P3); assert.deepEqual(r.effects, [], "frozen: no notice, no fix, no repeat 'frozen'"); s = r.state; }
  r = tickState(s, T0 + 41 * MIN, {}, P3);
  assert.equal(r.effects[0].type, "unfrozen"); assert.equal(r.effects[0].pushedMs, 40 * MIN);
  assert.equal(r.state.records[0].nextAt, T0 + 3 * MIN + 40 * MIN, "the two minutes that were left are still left");
  assert.equal(r.state.records[0].advisory, 1, "never skips ahead");
  assert.deepEqual(r.effects.map((e) => e.type), ["unfrozen"]);
  r = tickState(r.state, T0 + 43 * MIN, {}, P3); assert.deepEqual(types(r.effects), ["advise:2"]);
  // closeAll (left Autonomous mode): every active escalation closes, nothing runs on its own.
  const c = tickState(r.state, T0 + 44 * MIN, { closeAll: "autonomous-mode-off" }, P3);
  assert.deepEqual(types(c.effects), ["closed"]); assert.equal(c.state.records[0].status, "closed");
}
t();

// 7 — restart: resume CONSERVATIVELY at the same notice number; the next step waits a full interval from now.
{
  const store = { v: null };
  const now = { t: T0 };
  const m1 = createAdvisoryEscalation({ now: () => now.t, load: () => store.v, save: (v) => { store.v = JSON.parse(JSON.stringify(v)); } });
  m1.open(inp(), P3);
  now.t = T0 + 3 * MIN; m1.tick({}, P3); // notice 2
  m1.open(inp({ detectionId: "d-sn", recipeId: "svc-bits-stopped-v1", track: "tech-contact", kind: "needs-admin" }), P3);
  m1.ack(m1.findActiveByRecipe("svc-bits-stopped-v1").id, "not-now", P3);
  now.t = T0 + 6 * MIN; m1.tick({}, P3); // dns notice 3
  m1.open(inp({ detectionId: "d-au", recipeId: "svc-audiosrv-stopped-v1", track: "tech-contact", kind: "needs-admin" }), P3); // audio notice 1
  now.t = T0 + 9 * MIN + 1; const fx = m1.tick({}, P3); // dns → auto-fix · audio → notice 2
  assert.ok(fx.effects.some((e) => e.type === "auto-fix"));
  m1.markFixing(m1.findActiveByRecipe("dns-fail-v1").id); // the app closes mid-countdown
  assert.ok(store.v && store.v.records.length === 3, "every change was persisted");
  now.t = T0 + 2 * 60 * MIN; // the app comes back two hours later (the 4 h snooze is still running)
  const m2 = createAdvisoryEscalation({ now: () => now.t, load: () => store.v, save: (v) => { store.v = JSON.parse(JSON.stringify(v)); } });
  const res = m2.restore(P3);
  const byRecipe = (id) => m2.findActiveByRecipe(id);
  // 2026-10-14 (review P2-6) — EXPECTATIONS CHANGED ON PURPOSE: a restart used to put the record back at its notice and
  // proceed one interval later with NO new notice (the person never heard about it again; a mid-fix one then fixed after
  // one interval). Now the notice the person last saw is RE-ISSUED at the first tick (a real notification + card in the
  // driver) and the next step waits a full interval after THAT; a mid-fix attempt is reported as interrupted (cancelled).
  assert.equal(byRecipe("dns-fail-v1").status, "advising", "a fix in flight at shutdown is NOT re-run on restart");
  assert.equal(byRecipe("dns-fail-v1").advisory, 3, "…it goes back to notice 3 of 3");
  assert.equal(byRecipe("dns-fail-v1").reissue, true, "…to be shown again");
  assert.equal(byRecipe("svc-audiosrv-stopped-v1").advisory, 2, "the same notice number — never skipped ahead");
  assert.equal(byRecipe("svc-audiosrv-stopped-v1").reissue, true, "notice 2 is shown again");
  assert.equal(byRecipe("svc-audiosrv-stopped-v1").nextAt, now.t, "…at the very next tick");
  assert.equal(msUntilAction(byRecipe("dns-fail-v1"), P3, now.t), 3 * MIN, "the fix is a full interval AFTER the re-issued notice 3");
  assert.equal(byRecipe("svc-bits-stopped-v1").status, "snoozed", "a snooze is kept as is");
  assert.deepEqual(res.effects.map((e) => `${e.type}:${e.n}:${e.was}`).sort(), ["interrupted:3:fixing", "resumed:2:advising", "resumed:3:fixing"]);
  const first = m2.tick({}, P3);
  assert.deepEqual(first.effects.map((e) => `${e.type}:${e.n}:${e.reissued === true}`).sort(), ["advise:2:true", "advise:3:true"], "the first tick after the restart RE-ISSUES each notice — never the fix");
  assert.equal(m2.tick({}, P3).effects.length, 0, "…once");
  now.t += 3 * MIN; const next = m2.tick({}, P3);
  assert.deepEqual(next.effects.map((e) => e.type + (e.n ? ":" + e.n : "")).sort(), ["advise:3", "auto-fix"].sort(), "then the clock runs on from the same place, a full interval after the re-issue");
  assert.equal(m2.find(byRecipe("svc-audiosrv-stopped-v1").id).advisory, 3);
  // A restart while frozen (paused / stopped / license): nothing is re-issued until the freeze lifts — then it is.
  const store2 = { v: null };
  const t2 = { t: T0 };
  const m3 = createAdvisoryEscalation({ now: () => t2.t, load: () => store2.v, save: (v) => { store2.v = JSON.parse(JSON.stringify(v)); } });
  m3.open(inp({ detectionId: "d-fz" }), P3);
  t2.t = T0 + 60 * MIN;
  const m4 = createAdvisoryEscalation({ now: () => t2.t, load: () => store2.v, save: (v) => { store2.v = JSON.parse(JSON.stringify(v)); } });
  m4.restore(P3);
  assert.deepEqual(m4.tick({ frozen: "aria-stopped" }, P3).effects.map((e) => e.type), ["frozen"], "frozen at launch: no notice");
  t2.t += 30 * MIN;
  assert.deepEqual(m4.tick({}, P3).effects.map((e) => e.type + (e.reissued ? ":reissued" : "")), ["unfrozen", "advise:reissued"], "unfrozen: the notice is re-issued then");
}
t();

// 8 — defer (the 30-min gap between automatic fixes), markFixing, settle, the stale-fix guard.
{
  let s = openRecord(emptyAdvisoryState(), inp(), T0, P3).state;
  for (const at of [3, 6, 9]) s = tickState(s, T0 + at * MIN, {}, P3).state;
  const id = s.records[0].id;
  assert.equal(s.records[0].status, "ready");
  s = deferRecord(s, id, T0 + 30 * MIN, "the 30-minute gap between automatic fixes", T0 + 9 * MIN).state;
  assert.equal(s.records[0].waitReason, "the 30-minute gap between automatic fixes");
  assert.deepEqual(tickState(s, T0 + 29 * MIN, {}, P3).effects, []);
  const retry = tickState(s, T0 + 30 * MIN, {}, P3);
  assert.deepEqual(retry.effects, [{ type: "auto-fix", id, retry: true }]);
  s = markFixing(retry.state, id, T0 + 30 * MIN).state;
  assert.equal(s.records[0].status, "fixing");
  const settled = settleRecord(s, id, "fixed", "verified", T0 + 31 * MIN);
  assert.equal(settled.state.records[0].status, "fixed"); assert.equal(settled.state.records[0].outcome, "verified");
  assert.equal(settleRecord(settled.state, id, "fix-failed", "x", T0 + 32 * MIN).ok, false, "a closed escalation is settled once");
  const stale = tickState(s, T0 + 30 * MIN + ADVISORY_FIXING_STALE_MS + 1, {}, P3);
  assert.deepEqual(types(stale.effects), ["closed"]); assert.equal(stale.state.records[0].outcome, "no-result", "never re-run silently");
}
t();

// 9 — normalize: malformed records dropped, unknown fields stripped, the Never list deduped, the record cap honoured.
{
  const raw = { v: 1, seq: 2, never: ["a-v1", "a-v1", "bad id", {}, "x<y"], records: [{ id: "adv-1-x", recipeId: "x-v1", status: "advising", advisory: 9, title: "<b>Hi</b>", secret: "drop me" }, { id: "", recipeId: "y" }, null, "x"] };
  const s = normalizeAdvisoryState(raw);
  assert.equal(s.records.length, 1); assert.equal(s.records[0].advisory, 3, "clamped to 3"); assert.ok(!("secret" in s.records[0]));
  assert.ok(!/[<>]/.test(s.records[0].title), "markup characters never survive");
  assert.deepEqual(s.never, ["a-v1"]);
  let big = emptyAdvisoryState();
  for (let i = 0; i < ADVISORY_RECORDS_MAX + 15; i++) {
    const o = openRecord(big, inp({ detectionId: `d${i}`, recipeId: `r${i}-v1` }), T0 + i, P3);
    big = ackRecord(o.state, o.record.id, "fix-now", T0 + i, P3).state;
  }
  assert.ok(big.records.length <= ADVISORY_RECORDS_MAX, "closed records are trimmed");
  assert.deepEqual(normalizeAdvisoryState(null), emptyAdvisoryState());
}
t();

// 10 — plain-words copy + the view + the rule sentence (generated from the constants and the person's prefs).
{
  const rec = openRecord(emptyAdvisoryState(), inp(), T0, P3).record;
  const c = advisoryCopy(rec, P3, T0);
  assert.equal(c.line, "Notice 1 of 3");
  assert.match(c.found, /^I found a problem: DNS lookup failed\.$/);
  assert.match(c.willDo, /I can fix this myself — flush stale DNS cache/i);
  assert.match(c.when, /fix it in about 9 minutes/);
  assert.deepEqual(c.choices.map((x) => x.id), ["fix-now", "not-now", "never"]);
  assert.deepEqual(c.choices.map((x) => x.label), ["Fix now", "Not now (4 h)", "Never for this"]);
  const admin = advisoryCopy({ ...rec, track: "tech-contact", kind: "needs-admin" }, P3, T0);
  assert.match(admin.willDo, /administrator approval/); assert.match(admin.when, /tell your IT contact in about 9 minutes/);
  assert.equal(advisoryCopy({ ...rec, track: "tech-contact", kind: "red" }, P3, T0).choices[0].label, "Get help now");
  assert.match(advisoryCopy({ ...rec, advisory: 3, nextAt: T0 + 3 * MIN }, P3, T0).when, /Last notice: I'll fix it in about 3 minutes unless you choose — then a 10-second countdown/);
  assert.match(advisoryCopy({ ...rec, track: "tech-contact", kind: "not-yet-vetted" }, P3, T0).willDo, /hasn't been proven on this device yet/);
  assert.match(advisoryCopy({ ...rec, track: "tech-contact", kind: "needs-confirm" }, P3, T0).willDo, /always waits for your yes — I never run it on my own/);
  for (const kind of ["needs-admin", "not-yet-vetted", "needs-confirm", "red"]) {
    assert.equal(openRecord(emptyAdvisoryState(), inp({ track: "tech-contact", kind, detectionId: `k-${kind}` }), T0, P3).record.kind, kind, `the ${kind} kind survives (regression: needs-confirm used to fall back to needs-admin)`);
  }
  const v = advisoryView(rec, P3, T0);
  for (const k of ["id", "recipeId", "title", "advisory", "of", "nextAt", "choices"]) assert.ok(k in v, `view has ${k}`);
  assert.equal(v.of, 3); assert.equal(v.nextAt, new Date(T0 + 3 * MIN).toISOString()); assert.equal(v.minutesUntilAction, 9);
  const sentence = ruleSentence({ advisoryIntervalMinutes: 3 });
  assert.match(sentence, /3 times, 3 minutes apart/); assert.match(sentence, /10-second countdown you can cancel/);
  assert.match(sentence, /never fixed on their own: after 3 unanswered notices ARIA tells your IT contact/);
  assert.match(sentence, /Fix now, Not now \(waits 4 hours\) or Never for this/);
  assert.match(ruleSentence({ advisoryIntervalMinutes: 1, advisorySnoozeHours: 1 }), /1 minute apart[\s\S]*waits 1 hour/);
  assert.match(ruleSentence({ advisoryIntervalMinutes: 99 }), /60 minutes apart/, "the sentence shows the clamped value the code runs");
  assert.ok(!PRIVATE_FOLDER_RE.test(sentence + JSON.stringify(c)), "content-blind copy");
}
t();

// 11 — the module stays renderer-safe and pure: no node built-ins, no timers, no I/O.
{
  const src = fs.readFileSync(path.join(import.meta.dirname, "..", "src", "shared", "advisory-escalation.mjs"), "utf8");
  assert.doesNotMatch(src, /^import /m, "no imports at all");
  assert.doesNotMatch(src, /\bsetTimeout\(|\bsetInterval\(|\brequire\(|process\.|fs\./, "no timers, no process, no fs");
}
t();

assert.equal(n, 11);
console.log(`advisory-escalation test passed (${n} groups · cadence 3×interval then act · clamp 1–60 · idempotent per detection · one per recipe · Fix now / Not now (snooze + fresh round) / Never (persisted) · kill = blocked forever · freeze keeps the remaining time · restart re-issues the same notice · cooldown defer · settle once · stale guard · plain copy · rule sentence from constants · pure).`);

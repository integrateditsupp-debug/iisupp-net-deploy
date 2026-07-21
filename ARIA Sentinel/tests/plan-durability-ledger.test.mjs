// STAGE 3 S2 · brain-audit F1 — DURABILITY LEDGER. The "issue doesn't return" loop, proven purely:
// signatures are content-blind + R11-safe · a no-op-neutral is never a fix · recurrence inside 72h climbs
// ONE rung (never repeats the failed fix) and caps at human escalation · "durably resolved" needs a 24h
// quiet window with no return · deflection is real-or-empty (null → "--"). Nothing is spawned or written.
import assert from "node:assert/strict";
import { appendEntry } from "../src/shared/plan-journal.mjs";
import {
  FIX_LADDER, TOP_RUNG, RECURRENCE_WINDOW_MS, QUIET_WINDOW_MS,
  emptyLedger, issueSignature, recordResolution, recordEscalation,
  observeRecurrence, nextFixAction, isDurablyResolved, durabilityMetrics, ingestJournal
} from "../src/shared/durability-ledger.mjs";

const NOW = 1_760_000_000_000;
const H = 60 * 60 * 1000;

// 1 — signature: stable, content-blind (32-hex), and R11 ids never earn one.
const sig = issueSignature("print-recovery");
assert.match(sig, /^[0-9a-f]{32}$/);
assert.equal(issueSignature("print-recovery"), sig, "stable for the same id");
assert.notEqual(issueSignature("network-recovery"), sig, "distinct issues → distinct signatures");
assert.equal(issueSignature("fix C:\\Private pics and Vids"), null, "R11 id never earns a signature");
assert.equal(issueSignature(""), null);

// 2 — real-or-empty on record: a no-op-neutral (already-healthy) is NEVER a resolution.
let led = emptyLedger();
led = recordResolution(led, { planId: "print-recovery", fixApplied: "restart spooler", noChange: true }, NOW);
assert.deepEqual(led.issues, {}, "already-healthy pass is dropped — not a fix");
led = recordResolution(led, { planId: "print-recovery", fixApplied: "restart spooler", noChange: false }, NOW);
assert.equal(led.issues[sig].resolutions.length, 1);
// R11 id is never recorded.
const blocked = recordResolution(emptyLedger(), { planId: "sweep C:\\Private pics and Vids" }, NOW);
assert.deepEqual(blocked.issues, {});

// 3 — recurrence INSIDE the window climbs one rung; OUTSIDE it does not.
{
  let l = recordResolution(emptyLedger(), { planId: "print-recovery" }, NOW);
  // returns 2h later → within 72h → escalate one rung (symptom → deeper).
  let r = observeRecurrence(l, "print-recovery", NOW + 2 * H);
  assert.equal(r.recurredWithinWindow, true);
  assert.equal(r.rung, 1);
  assert.equal(r.ladder, FIX_LADDER[1]);
  // a fix that held 4 days → a fresh occurrence, NOT a recurrence (rung unchanged).
  let l2 = recordResolution(emptyLedger(), { planId: "audio-recovery" }, NOW);
  let r2 = observeRecurrence(l2, "audio-recovery", NOW + 96 * H);
  assert.equal(r2.recurredWithinWindow, false);
  assert.equal(r2.rung, 0);
}

// 4 — nextFixAction: fresh → apply rung 0; recurred → escalate to the NEXT rung; top rung → human.
{
  assert.equal(nextFixAction(emptyLedger(), "print-recovery", NOW).action, "apply");
  let l = recordResolution(emptyLedger(), { planId: "print-recovery" }, NOW);
  let a = nextFixAction(l, "print-recovery", NOW + 1 * H);
  assert.equal(a.action, "escalate-rung");
  assert.equal(a.rung, 1);
  assert.equal(a.ladder, "deeper-recipe");
  // climb all the way to the top, re-resolving + recurring each time.
  let cur = l, t = NOW;
  for (let i = 0; i < 5; i++) {
    const rr = observeRecurrence(cur, "print-recovery", t + 1 * H);
    cur = rr.ledger;
    cur = recordResolution(cur, { planId: "print-recovery" }, t + 2 * H);
    t += 3 * H;
  }
  assert.equal(cur.issues[sig].rung, TOP_RUNG, "rung caps at the top of the ladder");
  const top = nextFixAction(cur, "print-recovery", t + 1 * H);
  assert.equal(top.action, "human-escalation");
  assert.equal(top.ladder, "human-escalation");
}

// 5 — durably resolved needs a 24h quiet window AND no return since.
{
  let l = recordResolution(emptyLedger(), { planId: "audio-recovery" }, NOW);
  assert.equal(isDurablyResolved(l, "audio-recovery", NOW + 12 * H), false, "still inside the quiet window");
  assert.equal(isDurablyResolved(l, "audio-recovery", NOW + 25 * H), true, "quiet 24h+ → durable");
  // a return after the fix breaks durability even past the window.
  const back = observeRecurrence(l, "audio-recovery", NOW + 1 * H).ledger;
  assert.equal(isDurablyResolved(back, "audio-recovery", NOW + 48 * H), false, "returned since the fix → not durable");
  assert.equal(isDurablyResolved(emptyLedger(), "audio-recovery", NOW), false, "no data → false, never optimistic");
}

// 6 — deflection metric: real-or-empty (null on no attempts) and counts DURABLE resolutions only.
{
  assert.equal(durabilityMetrics(emptyLedger(), NOW).deflection, null, "empty ledger → honest '--' (null)");
  let l = recordResolution(emptyLedger(), { planId: "print-recovery" }, NOW);       // will go durable
  l = recordResolution(l, { planId: "audio-recovery" }, NOW);                        // then recurs → not durable
  l = observeRecurrence(l, "audio-recovery", NOW + 1 * H).ledger;
  const m = durabilityMetrics(l, NOW + 30 * H);
  assert.equal(m.attempts, 2);
  assert.equal(m.durableResolutions, 1, "only the one that stayed gone counts");
  assert.equal(m.recurred, 1);
  assert.equal(m.deflection, 0.5);
}

// 7 — ingestJournal folds a REAL hash-chained journal (built with the actual plan-journal module).
{
  // A resolved run (real change).
  let j = appendEntry([], { event: "PLAN.PROPOSED", planId: "print-recovery", planRunId: "run-1" }, () => NOW);
  j = appendEntry(j, { event: "PLAN.APPROVED", planId: "print-recovery", planRunId: "run-1" }, () => NOW);
  j = appendEntry(j, { event: "PLAN.RESOLVED", planId: "print-recovery", detail: "goalProbe passed", extra: { noChange: false } }, () => NOW);
  let l = ingestJournal(emptyLedger(), j, NOW);
  assert.equal(l.issues[sig].resolutions.length, 1, "RESOLVED (real change) recorded");
  // An already-healthy run — noChange:true → NOT recorded.
  let j2 = appendEntry([], { event: "PLAN.PROPOSED", planId: "audio-recovery", planRunId: "run-2" }, () => NOW);
  j2 = appendEntry(j2, { event: "PLAN.RESOLVED", planId: "audio-recovery", extra: { noChange: true } }, () => NOW);
  let l2 = ingestJournal(emptyLedger(), j2, NOW);
  assert.deepEqual(l2.issues, {}, "already-healthy journal → nothing recorded (Rule 14)");
  // An escalated run is recorded as an escalation, not a resolution.
  let j3 = appendEntry([], { event: "PLAN.PROPOSED", planId: "network-recovery", planRunId: "run-3" }, () => NOW);
  j3 = appendEntry(j3, { event: "PLAN.ESCALATED", planId: "network-recovery", extra: { code: "GOAL_PROBE_FAILED" } }, () => NOW);
  let l3 = ingestJournal(emptyLedger(), j3, NOW);
  const nsig = issueSignature("network-recovery");
  assert.equal(l3.issues[nsig].escalations.length, 1);
  assert.equal(l3.issues[nsig].resolutions.length, 0);
  // Empty / aborted journals record nothing.
  assert.deepEqual(ingestJournal(emptyLedger(), [], NOW).issues, {});
}

// 8 — window constants are the audited values.
assert.equal(RECURRENCE_WINDOW_MS, 72 * H);
assert.equal(QUIET_WINDOW_MS, 24 * H);

console.log("plan-durability-ledger test passed (content-blind+R11 signatures · no-op never a fix · 72h recurrence climbs one rung, caps at human · 24h quiet = durable · deflection real-or-empty · real hash-chained journal ingest).");

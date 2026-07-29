// STAGE 3 · brain-audit F7 × F1 JOIN — the single escalation DECISION.
// Proves: (a) with no durability history the decision is EXACTLY pure F7 (backward-compatible superset);
// (b) recurrence within 72h tightens the severity threshold by one attempt (escalate sooner);
// (c) recurring at the terminal fix-ladder rung forces human escalation regardless of attempt count;
// (d) recurrence is MONOTONIC toward escalation — no input makes the join say "don't escalate" when pure
// F7 says "escalate" (Rule 14 un-inflatable: recurrence can never SUPPRESS an escalation); (e) a blocked
// planId (R11) degrades cleanly to pure F7 with no throw. Pure + node-safe.
import assert from "node:assert/strict";
import { escalationDecision, shouldEscalateDurable } from "../src/shared/escalation-decision.mjs";
import { shouldEscalate } from "../src/shared/escalation-severity.mjs";
import { emptyLedger, recordResolution } from "../src/shared/durability-ledger.mjs";

const HIGH = { subsystem: "no-internet" };     // severity high → F7 threshold 1
const MED  = { subsystem: "printer-issues" };  // severity medium → F7 threshold 2
const LOW  = { symptomId: "some-app-glitch" }; // severity low → F7 threshold 3
const atts = (k) => Array.from({ length: k }, (_, i) => ({ i }));
const T0 = 1_000_000_000_000;

// 1 — NO ledger → identical verdict to pure F7 for every severity/attempt combo (backward-compatible).
for (const issue of [HIGH, MED, LOW]) {
  for (let k = 0; k <= 4; k++) {
    const f7 = shouldEscalate({ issue, attempts: atts(k) });
    const d = escalationDecision({ issue, attempts: atts(k) });
    assert.equal(d.escalate, f7.escalate, `no-ledger parity escalate (sev=${f7.severity} k=${k})`);
    assert.equal(d.effectiveThreshold, f7.threshold, "no-ledger parity threshold");
    assert.equal(d.recurrence.recurred, false, "no-ledger → not recurred");
    assert.equal(d.forcedByRecurrence, false);
  }
}

// 2 — recurrence within 72h tightens the threshold by one attempt → escalate SOONER.
// MEDIUM: pure F7 needs 2 attempts; after a same-issue recurrence it should escalate at 1.
{
  const planId = "printer-spooler-restart";
  let led = recordResolution(emptyLedger(), { planId, fixApplied: "restart-spooler" }, T0); // a fix was applied
  const soon = T0 + 60 * 60 * 1000; // 1h later — same issue is back, inside the 72h window
  const oneAttempt = escalationDecision({ issue: MED, attempts: atts(1), ledger: led, planId, now: soon });
  assert.equal(shouldEscalate({ issue: MED, attempts: atts(1) }).escalate, false, "pure F7 medium@1 does NOT escalate");
  assert.equal(oneAttempt.effectiveThreshold, 1, "recurrence tightens medium threshold 2→1");
  assert.equal(oneAttempt.recurrence.recurred, true);
  assert.equal(oneAttempt.escalate, true, "recurrence makes medium escalate one attempt sooner");
}

// 3 — recurring at the TOP of the fix ladder forces human escalation, even at 0 attempts.
{
  const planId = "chronic-audio-dropout";
  let led = emptyLedger();
  const base = T0;
  // Drive the ladder to the terminal rung by resolving-then-recurring repeatedly inside the window.
  // Each recurrence climbs one rung (0→1→2→3); at rung 3 nextFixAction returns "human-escalation".
  // We simulate by recording a resolution then observing recurrence enough times via the ledger API.
  // (observeRecurrence lives in the ledger module; here we assert the JOIN honors its terminal verdict.)
  // Build a ledger whose issue is already at the top rung with a fresh in-window resolution.
  led = recordResolution(led, { planId, fixApplied: "deep-audio-reset" }, base);
  // Force top rung directly through the ledger shape the module reads (rung is public on the issue).
  const sig = Object.keys(led.issues)[0];
  led.issues[sig].rung = 3; // terminal rung
  const within = base + 30 * 60 * 1000; // 30 min later, in-window
  const d = escalationDecision({ issue: LOW, attempts: [], ledger: led, planId, now: within });
  assert.equal(d.recurrence.action, "human-escalation", "top-rung recurrence → human-escalation");
  assert.equal(d.forcedByRecurrence, true);
  assert.equal(d.escalate, true, "terminal-rung recurrence escalates at 0 attempts regardless of low severity");
}

// 4 — MONOTONICITY (Rule 14): the join never says NO when pure F7 says YES.
{
  const planId = "held-fix-plan";
  // A resolution that HELD (older than the 72h window) → durability action "apply" → pure-F7 fallback.
  const old = recordResolution(emptyLedger(), { planId, fixApplied: "x" }, T0);
  const wayLater = T0 + 100 * 60 * 60 * 1000; // 100h later — past the recurrence window
  for (const issue of [HIGH, MED, LOW]) {
    for (let k = 0; k <= 4; k++) {
      const f7 = shouldEscalate({ issue, attempts: atts(k) }).escalate;
      const d = escalationDecision({ issue, attempts: atts(k), ledger: old, planId, now: wayLater }).escalate;
      assert.ok(!(f7 === true && d === false), `monotonic: F7 escalate must not be suppressed (sev via ${issue.subsystem || issue.symptomId} k=${k})`);
    }
  }
}

// 5 — R11: a blocked planId earns no signature → durability degrades to "apply" → pure F7, no throw.
{
  const blocked = "C:\\Private pics and Vids\\log";
  const led = recordResolution(emptyLedger(), { planId: blocked, fixApplied: "x" }, T0);
  const d = escalationDecision({ issue: HIGH, attempts: atts(1), ledger: led, planId: blocked, now: T0 + 1000 });
  assert.equal(d.recurrence.action, "apply", "blocked id → no durability signal");
  assert.equal(d.escalate, shouldEscalate({ issue: HIGH, attempts: atts(1) }).escalate, "blocked id → pure F7 verdict");
}

// 6 — the boolean convenience matches the full decision.
assert.equal(shouldEscalateDurable({ issue: HIGH, attempts: atts(1) }), true);
assert.equal(shouldEscalateDurable({ issue: LOW, attempts: atts(1) }), false);

console.log("escalation-decision test passed (F7×F1 join · no-ledger≡pure-F7 · recurrence tightens threshold · terminal-rung forces human · monotonic un-suppressible · R11 degrades clean).");

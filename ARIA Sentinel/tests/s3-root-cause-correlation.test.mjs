// STAGE 3 S3 / BRAIN-AUDIT F4 — CROSS-SUBSYSTEM ROOT-CAUSE CORRELATION.
// Audio + Bluetooth + Wi-Fi flapping together is ONE cause, not three. The old brain fixed each
// symptom separately, so all three came back — exactly the "it comes back easily" complaint. Locked:
//   • co-failing subsystems → ONE root cause → ONE proposal;
//   • when no bound Tier-0 recipe fixes that root cause we say INVESTIGATE — we never invent a recipe
//     (that is the F5 dead-action bug) and we never run symptom fixes we know will not hold;
//   • no supporting evidence → null. Silence beats a made-up theory (Rule 14);
//   • 🔒 R11 first.
import assert from "node:assert/strict";
import { correlateRootCause, failingSubsystems, isSymptomPatch, CORRELATION_RULES, CORRELATION_MIN_ERRORS } from "../src/shared/root-cause-correlation.mjs";
import { diagnose } from "../src/shared/diagnostic-reasoner.mjs";
import { PLAYBOOK_IDS } from "../src/main/resolution-playbooks.mjs";

const ctx = (errorsBySubsystem) => ({ eventLog: { errorsBySubsystem } });

// 1 — evidence only: a subsystem below the floor is not "failing".
{
  const f = failingSubsystems(ctx({ audio: 12, bluetooth: 9, network: 7, display: 1 }));
  assert.deepEqual(f.map((x) => x.subsystem), ["audio", "bluetooth", "network"]);
  assert.equal(failingSubsystems(ctx({ audio: CORRELATION_MIN_ERRORS - 1 })).length, 0);
}

// 2 — THE headline case: audio + bluetooth + wifi → ONE root cause, and an HONEST one.
{
  const c = correlateRootCause(ctx({ audio: 12, bluetooth: 9, network: 8 }));
  assert.equal(c.ruleId, "power-management-bus-suspend");
  assert.deepEqual(c.subsystems.sort(), ["audio", "bluetooth", "network"]);
  assert.equal(c.confidence, 1);
  assert.equal(c.planId, null, "there is NO bound Tier-0 recipe that changes power policy — we do not pretend there is");
  assert.equal(c.proposal.kind, "investigation");
  assert.ok(c.proposal.reason.includes("will not hold"));
  assert.ok(c.line.includes("one cause"));
  assert.equal(c.evidence.length, 3, "the evidence that fired the rule travels with it");
  // The trap this rule exists to stop: three symptom recipes that each "succeed" and all come back.
  assert.equal(isSymptomPatch(c, ["restart-audio", "restart-bluetooth", "flush-dns"]), true);
}

// 3 — a correlation WITH a real, bound playbook proposes that plan (and it must actually exist).
{
  const c = correlateRootCause(ctx({ printer: 14, spooler: 11 }));
  assert.equal(c.ruleId, "print-subsystem");
  assert.equal(c.planId, "print-recovery");
  assert.equal(c.proposal.kind, "resolution-plan");
  assert.ok(PLAYBOOK_IDS.includes(c.planId), "a correlation may only point at a playbook that really exists");
}

// 4 — partial patterns still correlate honestly (2 of 3 → lower confidence, never rounded up).
{
  const c = correlateRootCause(ctx({ bluetooth: 9, network: 8 }));
  assert.ok(["wireless-radio-stack", "power-management-bus-suspend"].includes(c.ruleId));
  assert.ok(c.confidence <= 1 && c.confidence > 0);
}

// 5 — NO evidence → null. No invented theory, no "probably a driver".
{
  assert.equal(correlateRootCause(ctx({ audio: 12 })), null, "one subsystem is a symptom, not a correlation");
  assert.equal(correlateRootCause(ctx({})), null);
  assert.equal(correlateRootCause(null), null);
  assert.equal(correlateRootCause(ctx({ display: 20, printer: 30 })), null, "no rule covers this pair — say nothing");
}

// 6 — every rule is internally honest: a planId, if present, must be a real playbook.
for (const r of CORRELATION_RULES) {
  if (r.planId) assert.ok(PLAYBOOK_IDS.includes(r.planId), `rule ${r.id} points at a non-existent playbook`);
  else assert.ok(r.investigation, `rule ${r.id} must offer an investigation when it has no bound fix`);
}

// 7 — 🔒 R11 and the reasoner wiring (additive).
{
  assert.equal(failingSubsystems(ctx({ "C:\\Private pics and Vids": 99 })).length, 0);
  const d = diagnose("no sound", [{ id: "audio-issues", title: "No sound", phrasings: ["no sound"], causes: [{ detection: "audio", probability: 60 }] }], ctx({ audio: 12, bluetooth: 9, network: 8 }));
  assert.equal(d.correlation.ruleId, "power-management-bus-suspend", "the reasoner now correlates before proposing symptom fixes");
  assert.ok(Array.isArray(d.anomalies), "the old anomaly surface is untouched");
}

console.log("s3-root-cause-correlation test passed (co-failure → ONE cause · no invented recipe · bound playbook when real · null when unsupported · R11 first).");

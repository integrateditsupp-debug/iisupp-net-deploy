// STAGE 3 S2 — PLAN BOOT RECOVERY battery (the resume-after-reboot WIRING).
// plan-journal has shipped the pure per-run decision since S1; nothing called it, so an interrupted
// Resolution Plan was simply forgotten at boot — the "half-applied" state the spec forbids. This proves
// the sweep that closes it: R11 first, kill-switch supreme, never resume into the unknown, resume is
// never silent, a dry-run neither claims nor rolls back, rollbacks ordered before progress, and an empty
// banner when there is nothing to say (Rule 14 real-or-empty). Pure + injectable: nothing is ever read.
import assert from "node:assert/strict";
import {
  BOOT_RECOVERY_VERSION, BOOT_ACTIONS, AUTONOMOUS_MODE,
  isDryRunJournal, rollbackOrderFor, classifyBootRun, orderBootActions,
  bootBannerLine, shouldRearmRegistrar, sweepBootRecovery
} from "../src/main/plan-boot-recovery.mjs";
import { appendEntry, toJsonl, resumeDecision } from "../src/shared/plan-journal.mjs";
import { PRIVATE_FOLDER_NAME, R11_SURFACE } from "../src/shared/path-guard.mjs";

const CLK = () => 1_800_000_000_000;
const RUN = { planId: "print-recovery", planRunId: "run-1" };

// Journal builders — real appendEntry, real hash chain, nothing faked.
function j(...events) {
  let e = [];
  for (const ev of events) {
    e = appendEntry(e, { event: ev.event, planId: RUN.planId, planRunId: RUN.planRunId, stepIndex: ev.stepIndex, extra: ev.extra || {} }, CLK);
  }
  return e;
}
const approved = () => j({ event: "PLAN.PROPOSED" }, { event: "PLAN.APPROVED" });
const boundary = () => j(
  { event: "PLAN.PROPOSED" }, { event: "PLAN.APPROVED" },
  { event: "PLAN.STEP.PRE", stepIndex: 0 }, { event: "PLAN.STEP.EXEC", stepIndex: 0 }, { event: "PLAN.STEP.POST", stepIndex: 0 },
  { event: "PLAN.STEP.PRE", stepIndex: 1 }, { event: "PLAN.STEP.EXEC", stepIndex: 1 }, { event: "PLAN.STEP.POST", stepIndex: 1 }
);
const midStep = () => j(
  { event: "PLAN.PROPOSED" }, { event: "PLAN.APPROVED" },
  { event: "PLAN.STEP.PRE", stepIndex: 0 }, { event: "PLAN.STEP.EXEC", stepIndex: 0 }, { event: "PLAN.STEP.POST", stepIndex: 0 },
  { event: "PLAN.STEP.PRE", stepIndex: 1 }, { event: "PLAN.STEP.EXEC", stepIndex: 1 }
);
const terminal = () => [...boundary(), ...[]].concat(appendEntry(boundary(), { event: "PLAN.RESOLVED", planId: RUN.planId, planRunId: RUN.planRunId }, CLK).slice(-1));
const dryRun = () => j({ event: "PLAN.PROPOSED", extra: { dryRun: true } }, { event: "PLAN.APPROVED", extra: { dryRun: true } });

let groups = 0;
const group = (name, fn) => { fn(); groups += 1; };

// 1 — vocabulary is the audited, closed set; every classify result is one of it.
group("action vocabulary is closed", () => {
  assert.equal(BOOT_RECOVERY_VERSION, "plan-boot-recovery-v1");
  assert.deepEqual([...BOOT_ACTIONS], ["blocked", "rollback-escalate", "resume-offer", "resume-unattended", "none"]);
  assert.equal(AUTONOMOUS_MODE, "autonomous");
  const cases = [approved(), boundary(), midStep(), dryRun(), [], terminal()];
  for (const entries of cases) {
    const d = classifyBootRun({ ...RUN, source: "plans/run-1.jsonl", entries }, {});
    assert.ok(BOOT_ACTIONS.includes(d.action), `action in vocabulary: ${d.action}`);
    assert.ok(Object.isFrozen(d), "decision is frozen");
  }
});

// 2 — R11 IS CHECK #1: blocked before any read; the reader is never called; the folder never leaks out.
group("R11 is check #1 and never leaks", () => {
  let reads = 0;
  const read = (s) => { reads += 1; return toJsonl(boundary()); };
  const blockedSrc = `C:/Users/x/${PRIVATE_FOLDER_NAME}/plans/run-1.jsonl`;
  const d = classifyBootRun({ ...RUN, source: blockedSrc }, { read });
  assert.equal(d.action, "blocked");
  assert.equal(d.reason, "r11-blocked");
  assert.equal(d.surface, R11_SURFACE);
  assert.equal(reads, 0, "an off-limits journal is NEVER read");
  // Blocked via planRunId / planId too, not just the path.
  assert.equal(classifyBootRun({ planRunId: PRIVATE_FOLDER_NAME, source: "ok.jsonl" }, { read }).action, "blocked");
  assert.equal(classifyBootRun({ planId: PRIVATE_FOLDER_NAME, planRunId: "r", source: "ok.jsonl" }, { read }).action, "blocked");
  assert.equal(reads, 0);
  // Nothing about the folder escapes into any surfaced string.
  const s = sweepBootRecovery({ runs: [{ ...RUN, source: blockedSrc }], read });
  const leak = JSON.stringify({ banner: s.banner, actions: s.actions.map((a) => [a.reason, a.planId, a.planRunId, a.surface]) });
  assert.ok(!/private\s+pics/i.test(leak), "private folder name never leaves the module");
  assert.equal(s.r11Surface, R11_SURFACE, "the honest exclusion count IS surfaced");
  assert.equal(s.pending, 0, "a blocked journal is not pending work");
});

// 3 — never half-applied: mid-step, tampered, corrupt and unreadable all roll back + escalate, never resume.
group("never resume into the unknown", () => {
  const mid = classifyBootRun({ ...RUN, source: "p.jsonl", entries: midStep() }, {});
  assert.equal(mid.action, "rollback-escalate");
  assert.equal(mid.reason, "interrupted-mid-step");
  assert.equal(mid.escalate, true);
  assert.deepEqual([...mid.rollbackOrder], [0], "completed step 0 is undone; the half-run step 1 is not 'completed'");

  const tampered = boundary().map((e, i) => (i === 4 ? { ...e, detail: "edited" } : e));
  const t = classifyBootRun({ ...RUN, source: "p.jsonl", entries: tampered }, {});
  assert.equal(t.action, "rollback-escalate");
  assert.equal(t.reason, "journal-tampered");
  assert.equal(t.chainOk, false, "a broken chain is reported honestly, never assumed fine");

  const corrupt = classifyBootRun({ ...RUN, source: "p.jsonl", text: toJsonl(boundary()) + "\n{not json" }, {});
  assert.equal(corrupt.action, "rollback-escalate");
  assert.equal(corrupt.reason, "journal-corrupt");

  // Unreadable = missing / empty / throwing reader. All three mean "unknown", never "nothing to do".
  for (const read of [() => "", () => { throw new Error("EACCES"); }, () => null]) {
    const u = classifyBootRun({ ...RUN, source: "p.jsonl" }, { read });
    assert.equal(u.action, "rollback-escalate", "unknown state is undone, never ignored");
    assert.equal(u.reason, "journal-unreadable");
  }
  // No resume result may EVER come out of an unsafe journal.
  for (const entries of [midStep(), tampered]) {
    assert.ok(!classifyBootRun({ ...RUN, source: "p.jsonl", entries }, { mode: AUTONOMOUS_MODE }).action.startsWith("resume"));
  }
});

// 4 — the only resume is a real step boundary, and it is NEVER silent.
group("resume is earned and never silent", () => {
  const offer = classifyBootRun({ ...RUN, source: "p.jsonl", entries: boundary() }, {});
  assert.equal(offer.action, "resume-offer", "no Autonomous mode -> one user click");
  assert.equal(offer.nextStepIndex, 2, "resumes at the NEXT step, never re-running a completed one");
  assert.deepEqual([...offer.completedSteps], [0, 1]);
  assert.equal(offer.reason, resumeDecision(boundary()).reason, "reason comes from the audited S1 decision");

  const auto = classifyBootRun({ ...RUN, source: "p.jsonl", entries: boundary() }, { mode: "Autonomous" });
  assert.equal(auto.action, "resume-unattended", "mode match is case-insensitive");
  assert.equal(auto.nextStepIndex, 2);

  // BOTH resume kinds still go through supervisor re-approval + countdown. Unattended != unsupervised.
  for (const d of [offer, auto]) {
    assert.equal(d.needsSupervisorReapproval, true);
    assert.equal(d.needsCountdown, true);
    assert.equal(d.escalate, false);
    assert.deepEqual([...d.rollbackOrder], [], "a resume is not a rollback");
  }

  // Approved-but-never-started resumes at step 0; proposed-only and terminal are settled.
  assert.equal(classifyBootRun({ ...RUN, source: "p.jsonl", entries: approved() }, {}).nextStepIndex, 0);
  assert.equal(classifyBootRun({ ...RUN, source: "p.jsonl", entries: j({ event: "PLAN.PROPOSED" }) }, {}).action, "none");
  assert.equal(classifyBootRun({ ...RUN, source: "p.jsonl", entries: terminal() }, {}).reason, "already-terminal");
  assert.equal(classifyBootRun({ ...RUN, source: "p.jsonl", entries: [] }, {}).reason, "empty-journal");
});

// 5 — KILL-SWITCH SUPREMACY: a kill is an abort + rollback, never a pause. Nothing resumes after one.
group("kill-switch outranks every resume", () => {
  for (const mode of ["", "confirmed", AUTONOMOUS_MODE]) {
    const d = classifyBootRun({ ...RUN, source: "p.jsonl", entries: boundary() }, { isKilled: true, mode });
    assert.equal(d.action, "rollback-escalate", `killed -> no resume in mode "${mode}"`);
    assert.equal(d.reason, "kill-switch-engaged");
    assert.deepEqual([...d.rollbackOrder], [1, 0], "reverse order");
  }
  const s = sweepBootRecovery({ runs: [{ ...RUN, source: "p.jsonl", entries: boundary() }], isKilled: true, mode: AUTONOMOUS_MODE });
  assert.equal(s.resumeOffers + s.resumeUnattended, 0, "a killed boot produces ZERO resumes");
  assert.equal(s.killSwitchEngaged, true);
});

// 6 — a dry-run rehearsal changed nothing: it neither claims success nor triggers a real rollback.
group("dry-run is settled, not pending", () => {
  assert.equal(isDryRunJournal(dryRun()), true);
  assert.equal(isDryRunJournal(boundary()), false);
  assert.equal(isDryRunJournal(null), false);
  const d = classifyBootRun({ ...RUN, source: "p.jsonl", entries: dryRun() }, { mode: AUTONOMOUS_MODE });
  assert.equal(d.action, "none");
  assert.equal(d.reason, "dry-run-rehearsal");
  assert.equal(d.escalate, false);
  assert.deepEqual([...d.rollbackOrder], [], "a rehearsal has nothing to undo");
  // Even an interrupted MID-STEP dry-run is not a real half-applied change.
  const midDry = midStep().map((e) => ({ ...e, extra: { dryRun: true } }));
  assert.equal(classifyBootRun({ ...RUN, source: "p.jsonl", entries: midDry }, {}).action, "none");
});

// 7 — reverse-order rollback + safety-before-progress batch ordering (stable within a group).
group("rollbacks precede resumes, stably", () => {
  assert.deepEqual(rollbackOrderFor(boundary()), [1, 0]);
  assert.deepEqual(rollbackOrderFor(approved()), []);
  const runs = [
    { planId: "a", planRunId: "r-resume-1", source: "a.jsonl", entries: boundary() },
    { planId: "b", planRunId: "r-mid", source: "b.jsonl", entries: midStep() },
    { planId: "c", planRunId: "r-settled", source: "c.jsonl", entries: terminal() },
    { planId: "d", planRunId: "r-resume-2", source: "d.jsonl", entries: approved() }
  ];
  const s = sweepBootRecovery({ runs });
  assert.deepEqual(s.actions.map((a) => a.action), ["rollback-escalate", "resume-offer", "resume-offer", "none"]);
  assert.deepEqual(s.actions.filter((a) => a.action === "resume-offer").map((a) => a.planRunId), ["r-resume-1", "r-resume-2"], "input order preserved inside a group");
  assert.equal(s.total, 4);
  assert.equal(s.rollbacks, 1);
  assert.equal(s.settled, 1);
  assert.equal(s.pending, 3);
  assert.equal(s.escalations, 1);
  assert.ok(Object.isFrozen(s) && Object.isFrozen(s.actions));
});

// 8 — Rule 14 banner: empty when there is nothing to say; content-blind and never a success claim.
group("banner is real-or-empty and claims nothing", () => {
  assert.equal(bootBannerLine({}), "", "nothing pending -> EMPTY, never a fabricated 'all clear'");
  assert.equal(sweepBootRecovery({ runs: [] }).banner, "");
  assert.equal(sweepBootRecovery({ runs: [{ ...RUN, source: "p.jsonl", entries: terminal() }] }).banner, "", "settled-only boot says nothing");
  const line = bootBannerLine({ rollbacks: 1, resumeOffers: 2, resumeUnattended: 1 });
  assert.match(line, /1 unfinished repair to undo/);
  assert.match(line, /2 safe to continue with your OK/);
  assert.match(line, /1 safe to continue automatically/);
  assert.match(line, /Nothing has been changed yet\./, "never claims a fix happened");
  assert.ok(!/resolved|fixed|repaired it|all clear/i.test(line), "no success language in a boot banner");
  assert.match(bootBannerLine({ rollbacks: 2 }), /2 unfinished repairs/, "plural is honest too");
  // Content-blind: ids never reach the banner.
  const s = sweepBootRecovery({ runs: [{ planId: "print-recovery", planRunId: "run-secret", source: "p.jsonl", entries: midStep() }] });
  assert.ok(!/run-secret|print-recovery|jsonl/.test(s.banner));
});

// 9 — the registrar stays armed only while real work is outstanding.
group("re-arm only for real pending work", () => {
  assert.equal(shouldRearmRegistrar({ pending: 0 }), false);
  assert.equal(shouldRearmRegistrar({ pending: 2 }), true);
  assert.equal(shouldRearmRegistrar({}), false);
  assert.equal(sweepBootRecovery({ runs: [] }).shouldRearm, false);
  assert.equal(sweepBootRecovery({ runs: [{ ...RUN, source: "p.jsonl", entries: dryRun() }] }).shouldRearm, false, "a rehearsal never re-arms the registrar");
  assert.equal(sweepBootRecovery({ runs: [{ ...RUN, source: "p.jsonl", entries: midStep() }] }).shouldRearm, true);
});

// 10 — defensive: junk in never throws, and never accidentally becomes a resume.
group("garbage in never becomes a resume", () => {
  for (const bad of [undefined, null, {}, { source: 5 }, { entries: "nope" }, { entries: [null, 7] }]) {
    const d = classifyBootRun(bad, {});
    assert.ok(BOOT_ACTIONS.includes(d.action));
    assert.ok(!d.action.startsWith("resume"), "junk never resumes");
  }
  for (const bad of [undefined, null, {}, { runs: "x" }, { runs: [null] }]) {
    const s = sweepBootRecovery(bad || undefined);
    assert.equal(typeof s.total, "number");
    assert.equal(s.resumeOffers + s.resumeUnattended, 0);
  }
  assert.deepEqual(orderBootActions(null), []);
  assert.deepEqual(rollbackOrderFor(null), []);
});

// 11 — PURITY, asserted from the source: no fs / spawn / net / DOM / Electron, and repeat-call stable.
const MODULE_SRC = await (await import("node:fs/promises"))
  .readFile(new URL("../src/main/plan-boot-recovery.mjs", import.meta.url), "utf8");
group("module is pure (no I/O at all)", () => {
  const src = MODULE_SRC;
  for (const forbidden of ["node:fs", "node:child_process", "node:net", "node:http", "electron", "require(", "document.", "window.", "fetch("]) {
    assert.ok(!src.includes(forbidden), `no ${forbidden} in a pure decision module`);
  }
  const runs = [{ ...RUN, source: "p.jsonl", entries: boundary() }];
  assert.deepEqual(sweepBootRecovery({ runs }), sweepBootRecovery({ runs }), "repeat calls are identical + side-effect free");
  assert.deepEqual(runs[0].entries, boundary(), "inputs are never mutated");
});

console.log(`plan-boot-recovery test passed (${groups} groups · R11 first + never read · kill-switch supreme · never half-applied · resume always supervisor+countdown gated · dry-run neither claims nor rolls back · reverse-order + safety-before-progress · empty-when-nothing banner · pure).`);

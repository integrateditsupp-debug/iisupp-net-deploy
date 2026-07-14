#!/usr/bin/env node
// STAGE-3 S4 — PLAN STATE STORE. The persistence layer under the S2/S3 brains.
// The thesis under test: persisted plan state is a CAPABILITY, not a cache. plan-history.json is what
// canRunUnattendedS3() reads before it lets an agent run on this machine with no click. So this battery
// asserts the store is tamper-evident and fails CLOSED — every doubt collapses to the empty state, and
// the empty state grants NOTHING. Plus: atomic writes, R11 first, bounded growth that cannot weaken F1,
// and real-or-empty (a distrusted file is never silently "repaired" into a flattering number).
import assert from "node:assert/strict";
import {
  STORE_VERSION, STATE_FILES, DISTRUST, MAX_STATE_BYTES, MAX_LEDGER_ISSUES,
  emptyFor, canonicalJson, integrityTag, sealState, openState, pruneLedger, writePlan,
  makePlanStateStore, distrustLine
} from "../src/main/plan-state-store.mjs";
import {
  emptyPlanHistory, recordPlanOutcome, planSupervisedSuccesses,
  canRunUnattendedS3, PLAN_UNATTENDED_MIN_SUCCESSES
} from "../src/main/plan-autonomy-ladder.mjs";
import { emptyDurabilityLedger, RECURRENCE_WINDOW_MS } from "../src/shared/durability-ledger.mjs";
import { buildDeflectionFeed, deflectionKpi } from "../src/shared/deflection-feed.mjs";

const NOW = 1_770_000_000_000;
const SECRET = "machine-local-secret-abc";
const DIR = "C:/Users/x/.aria-sentinel";

const plan = () => ({
  id: "audio-recovery",
  steps: [{ recipeId: "restart-audio-service", risk: "medium", expectedImpact: ["AudioSrv"], onFail: "escalate" }],
  goalProbe: { command: "(Get-Service Audiosrv).Status", interpret: "service-running" },
  riskEnvelope: { level: "medium", touchesSystemState: false }
});
const vetted = () => 50; // Tier ≤ 1
const earnedHistory = () => {
  let h = emptyPlanHistory();
  for (let i = 0; i < PLAN_UNATTENDED_MIN_SUCCESSES; i++) h = recordPlanOutcome(h, "audio-recovery", "success", NOW + i);
  return h;
};
/** A fake disk. Records every call so we can prove HOW we wrote, not just what. */
const fakeFs = (seed = {}) => {
  const files = { ...seed };
  const calls = [];
  return {
    files, calls,
    readFileSync(p) { calls.push(["read", p]); if (!(p in files)) { const e = new Error("no"); e.code = "ENOENT"; throw e; } return files[p]; },
    writeFileSync(p, d) { calls.push(["write", p]); files[p] = d; },
    renameSync(a, b) { calls.push(["rename", a, b]); files[b] = files[a]; delete files[a]; }
  };
};

// ── 1 — round trip: what we sealed is what we open, and we know we can trust it.
{
  const h = earnedHistory();
  const raw = JSON.stringify(sealState("history", h, { secret: SECRET, now: NOW }));
  const got = openState("history", raw, { secret: SECRET });
  assert.equal(got.trusted, true, "our own file opens trusted");
  assert.equal(planSupervisedSuccesses(got.state, "audio-recovery"), PLAN_UNATTENDED_MIN_SUCCESSES);
  assert.equal(got.reason, null);
  // key order can never change the seal (canonical bytes)
  assert.equal(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }), "seal is key-order independent");
}

// ── 2 — THE MONEY TEST. A tampered history cannot mint autonomy.
// This is the whole reason the module exists: without the seal, editing one integer in a JSON file on
// disk hands an agent the right to run unattended on the user's machine.
{
  const nobody = emptyPlanHistory(); // 0 successes — this plan has earned NOTHING.
  const honest = JSON.parse(JSON.stringify(sealState("history", nobody, { secret: SECRET, now: NOW })));
  // The attacker edits the count in place, leaving the (now stale) tag alone.
  honest.state.plans = { "audio-recovery": { supervisedSuccesses: 999, runs: [], lastTs: NOW } };
  const opened = openState("history", JSON.stringify(honest), { secret: SECRET });

  assert.equal(opened.trusted, false, "an edited history is NOT trusted");
  assert.equal(opened.reason, DISTRUST.TAMPERED, "and we say exactly why: the bytes do not match the seal");
  assert.equal(planSupervisedSuccesses(opened.state, "audio-recovery"), 0, "it collapses to ZERO, never to 999");

  // and the S3 gate, fed the opened state, REFUSES:
  const d = canRunUnattendedS3({ plan: plan(), planHistory: opened.state, vettedCountOf: vetted, mode: "autonomous" });
  assert.equal(d.allowed, false, "a tampered history can never grant unattended execution");
  assert.ok(d.reasons.some((r) => /supervised successes/.test(r)), "and the refusal is honest about why");

  // sanity: the very same gate DOES allow it when the history is really ours.
  const good = openState("history", JSON.stringify(sealState("history", earnedHistory(), { secret: SECRET, now: NOW })), { secret: SECRET });
  assert.equal(canRunUnattendedS3({ plan: plan(), planHistory: good.state, vettedCountOf: vetted, mode: "autonomous" }).allowed, true,
    "a genuinely earned, sealed history still grants autonomy — the store gates fraud, not function");
}

// ── 3 — every other doubt also fails CLOSED, and each one is named honestly (symbolic, content-blind).
{
  const cases = [
    [null, DISTRUST.MISSING],
    ["", DISTRUST.MISSING],
    ["{not json", DISTRUST.NOT_JSON],
    [JSON.stringify({ v: "plan-state-v0", kind: "history", state: {}, tag: "x" }), DISTRUST.WRONG_VERSION],
    // a ledger file renamed over the history file → cross-file replay is refused by the kind binding.
    [JSON.stringify(sealState("durability", emptyDurabilityLedger(), { secret: SECRET, now: NOW })), DISTRUST.WRONG_KIND],
    ["x".repeat(MAX_STATE_BYTES + 1), DISTRUST.OVERSIZED],
    [JSON.stringify({ v: STORE_VERSION, kind: "history", state: { plans: { p: { supervisedSuccesses: 50 } } }, tag: "" }), DISTRUST.TAMPERED]
  ];
  for (const [raw, reason] of cases) {
    const r = openState("history", raw, { secret: SECRET });
    assert.equal(r.trusted, false, `must not trust: ${reason}`);
    assert.equal(r.reason, reason, `must name the reason: ${reason}`);
    assert.deepEqual(r.state, emptyPlanHistory(), `must collapse to empty: ${reason}`);
    assert.ok(!/supervisedSuccesses|999|50/.test(String(r.reason)), "the reason leaks no file content");
  }
  // No machine key at all → we trust nothing. (A missing key must never mean "trust everything".)
  const noKey = openState("history", JSON.stringify(sealState("history", earnedHistory(), { secret: SECRET, now: NOW })), { secret: "" });
  assert.equal(noKey.trusted, false);
  assert.equal(noKey.reason, DISTRUST.NO_SECRET);
  assert.equal(planSupervisedSuccesses(noKey.state, "audio-recovery"), 0, "no key ⇒ zero authority");
  // A DIFFERENT machine's key (a file copied between PCs) is also not ours.
  const otherPc = openState("history", JSON.stringify(sealState("history", earnedHistory(), { secret: SECRET, now: NOW })), { secret: "another-machines-key" });
  assert.equal(otherPc.trusted, false, "autonomy earned on one machine does not travel on a copied file");
  assert.equal(otherPc.reason, DISTRUST.TAMPERED);
  // and we never write state we could not later verify.
  assert.equal(sealState("history", earnedHistory(), { secret: "" }), null, "no key ⇒ we refuse to persist");
}

// ── 4 — writes are ATOMIC: the live file is never opened for writing, so a power cut cannot half-write it.
{
  const fs = fakeFs();
  const store = makePlanStateStore({ dir: DIR, fs, secret: SECRET, now: () => NOW });
  const res = store.save("history", earnedHistory());
  assert.equal(res.ok, true);
  const writes = fs.calls.filter((c) => c[0] === "write").map((c) => c[1]);
  const renames = fs.calls.filter((c) => c[0] === "rename");
  assert.deepEqual(writes, [`${DIR}/${STATE_FILES.history}.tmp`], "we write ONLY the tmp file");
  assert.equal(renames.length, 1, "then exactly one rename");
  assert.deepEqual(renames[0].slice(1), [`${DIR}/${STATE_FILES.history}.tmp`, `${DIR}/${STATE_FILES.history}`]);
  assert.ok(!writes.includes(`${DIR}/${STATE_FILES.history}`), "the live file is NEVER written directly");
  // and it reads back trusted through the same store.
  const back = store.trustedPlanHistory();
  assert.equal(back.trusted, true);
  assert.equal(planSupervisedSuccesses(back.history, "audio-recovery"), PLAN_UNATTENDED_MIN_SUCCESSES);
}

// ── 5 — trustedPlanHistory() is the autonomy gate ON DISK: untrusted ⇒ empty ⇒ zero, and it says why.
{
  const fs = fakeFs({ [`${DIR}/${STATE_FILES.history}`]: '{"v":"plan-state-v1","kind":"history","state":{"plans":{"audio-recovery":{"supervisedSuccesses":999}}},"tag":"forged"}' });
  const store = makePlanStateStore({ dir: DIR, fs, secret: SECRET, now: () => NOW });
  const r = store.trustedPlanHistory();
  assert.equal(r.trusted, false);
  assert.equal(r.reason, DISTRUST.TAMPERED);
  assert.deepEqual(r.history, emptyPlanHistory(), "forged history ⇒ empty history");
  assert.equal(canRunUnattendedS3({ plan: plan(), planHistory: r.history, vettedCountOf: vetted, mode: "autonomous" }).allowed, false);
  // the user is told, in plain words, and is never blamed.
  const line = distrustLine(r.reason);
  assert.ok(/could not be verified/i.test(line) && /ask for your click/i.test(line), "honest, plain-English line");
  assert.equal(distrustLine(DISTRUST.MISSING), null, "a first run is not a warning — no scary line on a fresh install");
  // a missing file is honest, not an error, and still grants nothing.
  const fresh = makePlanStateStore({ dir: DIR, fs: fakeFs(), secret: SECRET, now: () => NOW }).trustedPlanHistory();
  assert.equal(fresh.trusted, false);
  assert.equal(fresh.reason, DISTRUST.MISSING);
  assert.deepEqual(fresh.history, emptyPlanHistory());
}

// ── 6 — 🔒 R11 is check #1: a blocked directory refuses BEFORE any fs handle exists.
{
  const blockedDir = "C:/Users/x/Private pics and Vids/state";
  assert.throws(() => writePlan("history", emptyPlanHistory(), blockedDir, { secret: SECRET, now: NOW }), /R11_BLOCKED/);
  const fs = fakeFs();
  const store = makePlanStateStore({ dir: blockedDir, fs, secret: SECRET, now: () => NOW });
  const saved = store.save("history", earnedHistory());
  assert.equal(saved.ok, false);
  assert.equal(saved.reason, DISTRUST.R11_BLOCKED);
  assert.equal(fs.calls.length, 0, "R11 refuses before a single fs call is made — nothing is read, written or created");
  const loaded = store.load("history");
  assert.equal(loaded.trusted, false);
  assert.equal(loaded.reason, DISTRUST.R11_BLOCKED);
  assert.equal(loaded.surface, "1 personal folder excluded", "and the user sees the standard R11 surface");
}

// ── 7 — bounded growth that CANNOT weaken F1: an issue inside its 72h recurrence window is never evicted.
{
  const issues = {};
  // 3 old, long-settled issues (well past the recurrence window) …
  for (let i = 0; i < 3; i++) issues[`old${i}`] = { events: [{ ts: NOW - RECURRENCE_WINDOW_MS - (30 - i * 10) * 3600e3 }] }; // old0 = oldest
  // … and 2 that are still live inside the 72h window — forgetting these is exactly how ARIA would
  // repeat a fix that already failed.
  issues.liveA = { events: [{ ts: NOW - 3600e3 }] };
  issues.liveB = { events: [{ ts: NOW - 2 * 3600e3 }] };
  const pruned = pruneLedger({ v: "durability-ledger-v1", issues }, { max: 3, now: NOW });
  const keys = Object.keys(pruned.issues);
  assert.equal(keys.length, 3, "pruned down to the cap");
  assert.ok(keys.includes("liveA") && keys.includes("liveB"), "issues inside the 72h recurrence window are NEVER pruned");
  assert.ok(!keys.includes("old0"), "the OLDEST settled issue is the first to go");
  assert.ok(keys.includes("old2"), "newer settled issues survive longer");
  // if EVERYTHING is still live, we keep everything rather than break F1 to satisfy a cap.
  const allLive = { v: "durability-ledger-v1", issues: { a: { events: [{ ts: NOW }] }, b: { events: [{ ts: NOW }] } } };
  assert.equal(Object.keys(pruneLedger(allLive, { max: 1, now: NOW }).issues).length, 2,
    "the cap never wins over F1 — we would rather keep the file than forget a live failure");
  assert.equal(MAX_LEDGER_ISSUES, 500);
}

// ── 8 — real-or-empty all the way to the KPI: a distrusted ledger reports NOTHING, never a flattering number.
{
  const fs = fakeFs({ [`${DIR}/${STATE_FILES.durability}`]: '{"v":"plan-state-v1","kind":"durability","state":{"v":"durability-ledger-v1","issues":{"x":{"state":"durably-resolved"}}},"tag":"forged"}' });
  const store = makePlanStateStore({ dir: DIR, fs, secret: SECRET, now: () => NOW });
  const led = store.load("durability");
  assert.equal(led.trusted, false, "a forged ledger is not trusted…");
  assert.deepEqual(led.state, emptyDurabilityLedger(), "…it collapses to empty — a faked 'durably resolved' can never inflate deflection");
  const kpi = deflectionKpi(buildDeflectionFeed({ ledger: led.state, journalEntries: [], now: NOW }));
  assert.equal(kpi.value, null, "no data ⇒ null, never a flattering 0% and never a fabricated %");
}

// ── 9 — the window file grants nothing (it only decides WHEN), and an unreadable one invents no deferral.
{
  assert.equal(emptyFor("window"), null, "no configured window ⇒ null ⇒ maintenance-window invents no deferral");
  const r = openState("window", "{garbage", { secret: SECRET });
  assert.equal(r.trusted, false);
  assert.equal(r.state, null, "a corrupt window is NO window — never a made-up 02:00");
}

console.log('s4-plan-state-store test passed (tamper-evident + fail-closed: a forged history mints NO autonomy · atomic tmp+rename, live file never written · R11 refuses before any fs call · pruning can never weaken F1 · distrusted ⇒ null KPI, never a flattering number).');

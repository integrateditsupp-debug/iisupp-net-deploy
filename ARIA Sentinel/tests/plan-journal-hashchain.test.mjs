// STAGE 3 S1 — plan journal: append-only hash chain (prevHash per entry), tamper detection,
// JSONL roundtrip, closed event vocabulary, ISO timestamps, R11 redaction at the write layer.
import assert from "node:assert/strict";
import { appendEntry, verifyChain, toJsonl, fromJsonl, replayState, PLAN_EVENTS, JOURNAL_VERSION } from "../src/shared/plan-journal.mjs";

const NOW = 1_760_000_000_000;
let clock = NOW;
const now = () => (clock += 1000);

// 1 — chain build: prevHash links entry N to N-1; genesis anchors entry 0; chain verifies.
let j = appendEntry([], { event: "PLAN.PROPOSED", planId: "print-recovery", planRunId: "r1", detail: "proposed" }, now);
j = appendEntry(j, { event: "PLAN.APPROVED", planId: "print-recovery", planRunId: "r1" }, now);
j = appendEntry(j, { event: "PLAN.STEP.PRE", planId: "print-recovery", planRunId: "r1", stepIndex: 0, recipeId: "restart-print-spooler", detail: "before=Stopped" }, now);
assert.equal(j.length, 3);
assert.equal(j[0].v, JOURNAL_VERSION);
assert.equal(j[1].prevHash, j[0].hash);
assert.equal(j[2].prevHash, j[1].hash);
assert.deepEqual(verifyChain(j), { ok: true, tampered: false, brokenAt: -1, reason: "intact" });

// append-only contract: appendEntry returns a NEW array, never mutates the input.
const before = j;
const j2 = appendEntry(j, { event: "PLAN.STEP.EXEC", planId: "print-recovery", planRunId: "r1", stepIndex: 0 }, now);
assert.equal(before.length, 3);
assert.equal(j2.length, 4);

// 2 — tamper detection: edit a detail → entry-modified at that index; chain re-link fails too.
const tampered = j2.map((e) => ({ ...e }));
tampered[1].detail = "edited-after-the-fact";
let chk = verifyChain(tampered);
assert.equal(chk.ok, false);
assert.equal(chk.brokenAt, 1);
assert.equal(chk.reason, "entry-modified");

// truncation → sequence break at the cut; insertion → chain break.
chk = verifyChain(j2.slice(1));
assert.equal(chk.ok, false);
const inserted = [j2[0], { ...j2[2] }, ...j2.slice(1)];
assert.equal(verifyChain(inserted).ok, false);

// 3 — closed vocabulary: unknown events throw (replay logic must be total).
assert.throws(() => appendEntry(j2, { event: "PLAN.VIBES" }, now), /unknown event/);
assert.equal(PLAN_EVENTS.length, 9);

// 4 — JSONL roundtrip preserves the chain.
const text = toJsonl(j2);
assert.equal(text.trim().split("\n").length, 4);
const back = fromJsonl(text);
assert.deepEqual(verifyChain(back).ok, true);

// 5 — ISO timestamps (content-blind audit contract).
for (const e of j2) assert.match(e.ts, /^\d{4}-\d{2}-\d{2}T/);

// 6 — 🔒 R11 at the journal layer: a private path in ANY field is redacted before it can persist.
const dirty = appendEntry([], {
  event: "PLAN.ABORTED",
  planId: "C:\\Private pics and Vids\\evil-plan",
  planRunId: "run-Private pics and Vids",
  recipeId: "fix-Private PICS and vids",
  detail: "found C:\\Users\\x\\Private pics and Vids\\a.jpg",
  extra: { note: "under Private pics and Vids", nested: { p: "D:\\private pics and vids\\y" }, count: 2 }
}, now);
const raw = JSON.stringify(dirty);
assert.equal(/private\s+pics\s+and\s+vids/i.test(raw), false, "no private-folder trace may persist");
assert.equal(dirty[0].extra.count, 2);
assert.equal(verifyChain(dirty).ok, true);

// 7 — replayState: completed steps + interrupted flag.
let s = replayState(j2);
assert.equal(s.started, true);
assert.equal(s.approved, true);
assert.equal(s.interrupted, true); // no terminal event yet
const done = appendEntry(j2, { event: "PLAN.RESOLVED", planId: "print-recovery", planRunId: "r1", detail: "probe passed" }, now);
s = replayState(done);
assert.equal(s.terminal, true);
assert.equal(s.outcomeEvent, "PLAN.RESOLVED");
assert.equal(s.interrupted, false);

console.log("plan-journal-hashchain test passed (chain · tamper · truncate/insert · JSONL · R11 redaction · replay).");

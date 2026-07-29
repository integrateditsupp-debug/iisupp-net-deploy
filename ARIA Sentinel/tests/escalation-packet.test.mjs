// STAGE 3 S2 — the escalation evidence packet. When ARIA cannot honestly finish, a human takes over —
// that handoff IS the MSP retainer story, so the packet has to be genuinely useful AND genuinely safe:
//   · 🔒 R11 refuses the packet outright (we do not "clean it up and send anyway")
//   · content-blind: symbolic signature + redacted details, never the user's words or paths
//   · a tampered journal is DISCLOSED, not hidden
//   · no ticket ref is ever invented, and nothing is sent — staged only, Ahmad's one-click
import assert from "node:assert/strict";
import { buildEscalationPacket, packetSummaryLine, PACKET_VERSION } from "../src/main/escalation-packet.mjs";
import { appendEntry } from "../src/shared/plan-journal.mjs";

const NOW = 1_700_000_000_000;
const now = () => NOW;
let j = [];
const add = (event, fields) => { j = appendEntry(j, { event, planId: "print-recovery", planRunId: "print-recovery-run-9", ...fields }, now); };
add("PLAN.PROPOSED", { detail: "Print recovery" });
add("PLAN.APPROVED", { detail: "confirmed" });
add("PLAN.STEP.PRE", { stepIndex: 0, recipeId: "clear-print-queue", detail: "before=3" });
add("PLAN.STEP.POST", { stepIndex: 0, recipeId: "clear-print-queue", detail: "after=3", extra: { pass: false, evidence: "3" } });
add("PLAN.STEP.ROLLBACK", { stepIndex: 0, recipeId: "clear-print-queue", detail: "no rollback applicable (one-way)", extra: { recovered: false, planRollback: true } });
add("PLAN.ESCALATED", { detail: "goalProbe failed — escalating to IIS", extra: { code: "GOAL_PROBE_FAILED", evidence: "3" } });

// 1 — a real packet from a real journal.
const pkt = buildEscalationPacket({
  planRun: { planId: "print-recovery", planRunId: "print-recovery-run-9", outcome: "escalated" },
  journalEntries: j,
  durability: { recurrences: 2, rung: "root-cause", withinH: 12 },
  issue: { issue: "printing still fails after the queue was cleared" },
  now
});
assert.equal(pkt.version, PACKET_VERSION);
assert.equal(pkt.outcome, "escalated");
assert.equal(pkt.stepsAttempted, 3);
assert.equal(pkt.journal.hashChainOk, true);
assert.equal(pkt.journal.tampered, false);
assert.equal(pkt.rollback.attempted, true);
assert.equal(pkt.rollback.manualNeeded, 1);
assert.deepEqual(pkt.durability, { recurrences: 2, rung: "root-cause", withinH: 12 });
assert.ok(pkt.probeEvidence.length >= 1);
assert.equal(pkt.humanLine, "Couldn't fix this safely — escalated to IIS.");

// 2 — nothing is sent, and no ticket is invented.
assert.equal(pkt.delivery.sent, false);
assert.equal(pkt.delivery.staged, true);
assert.equal(pkt.ticketRef, "");
assert.match(packetSummaryLine(pkt), /evidence packet staged/);
assert.doesNotMatch(packetSummaryLine(pkt), /ticket/);
assert.match(packetSummaryLine({ ...pkt, ticketRef: "INC0012345" }), /ticket INC0012345/);

// 3 — content-blind: the user's words become a symbolic code, never free text.
assert.ok(pkt.signature && typeof pkt.signature.code === "string");
const blob = JSON.stringify(pkt);
assert.doesNotMatch(blob, /printing still fails after the queue was cleared/, "the raw issue text never travels");

// 4 — 🔒 R11 is check #1: any off-limits reference REFUSES the packet.
const blocked = buildEscalationPacket({
  planRun: { planId: "p", planRunId: "C:\\Users\\a\\Private pics and Vids\\run", outcome: "escalated" },
  journalEntries: j, now
});
assert.equal(blocked.blocked, "R11");
assert.equal(blocked.surfaced, "1 personal folder excluded");
assert.equal(blocked.steps, undefined, "a refused packet carries no evidence at all");
assert.equal(packetSummaryLine(blocked), "Couldn't fix this safely — escalated to IIS.");

// 5 — a private path inside a journal detail is redacted, not carried.
let j2 = appendEntry([], { event: "PLAN.PROPOSED", planId: "p", planRunId: "r", detail: "reading C:\\Users\\a\\Private pics and Vids\\x.png" }, now);
j2 = appendEntry(j2, { event: "PLAN.STEP.PRE", planId: "p", planRunId: "r", stepIndex: 0, recipeId: "flush-dns", detail: "before=1" }, now);
const pkt2 = buildEscalationPacket({ planRun: { planId: "p", planRunId: "r", outcome: "escalated" }, journalEntries: j2, now });
assert.doesNotMatch(JSON.stringify(pkt2), /private\s+pics/i);

// 6 — a TAMPERED journal is disclosed honestly (the human must know the evidence is suspect).
const tampered = j.map((e, i) => (i === 3 ? { ...e, detail: "rewritten to look better" } : e));
const pkt3 = buildEscalationPacket({ planRun: { planId: "p", planRunId: "r", outcome: "escalated" }, journalEntries: tampered, now });
assert.equal(pkt3.journal.hashChainOk, false);
assert.equal(pkt3.journal.tampered, true);
assert.ok(pkt3.journal.brokenAt >= 0);

// 7 — an empty journal produces an empty-but-honest packet (real-or-empty, never a fabricated story).
const pkt4 = buildEscalationPacket({ planRun: { outcome: "escalated" }, journalEntries: [], now });
assert.equal(pkt4.stepsAttempted, 0);
assert.deepEqual(pkt4.steps, []);
assert.equal(pkt4.signature, null);
assert.equal(pkt4.durability, null);

console.log("escalation-packet test passed (R11 refuses outright · content-blind signature + redaction · tamper disclosed · no invented ticket · staged, never sent · real-or-empty on empty input).");

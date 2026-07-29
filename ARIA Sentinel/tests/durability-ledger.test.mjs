// STAGE 3 S2 (brain-audit F1) — THE DURABILITY LEDGER: "resolve with QUALITY so the issue does not
// return." Today's brain declares victory when a post-probe passes and never watches for the return,
// so the same symptom fix re-fires forever. This suite locks the three rules that fix that:
//   1. a recurrence inside 72h climbs EXACTLY one rung — we never repeat the fix that did not hold
//   2. "durable" is only earned after a quiet monitoring window
//   3. the deflection number counts DURABLE resolutions (that is what makes it defensible)
// Plus: the signature is content-blind by construction — feed it PII, get a hash.
import assert from "node:assert/strict";
import {
  emptyLedger, issueSignature, recordResolution, onRecurrence, markDurable, isDurable,
  deflectionStats, nextRung, lastRecord, FIX_LADDER, RECURRENCE_WINDOW_MS, DURABLE_QUIET_MS
} from "../src/main/durability-ledger.mjs";

const H = 3600000;
const T0 = 10_000 * H;

// 1 — content-blind signature: the user's words and paths never survive into the ledger key.
const sig = issueSignature({ issue: "printer jam, file C:\\Users\\bob\\Private pics and Vids\\p.png, call bob@acme.com" });
assert.match(sig.signature, /^[a-f0-9]{64}$/, "signature is a sha256 hex digest");
assert.doesNotMatch(sig.signature, /bob|acme|private/i);
assert.equal(issueSignature({ issue: "printer jam, file C:\\Users\\bob\\Private pics and Vids\\p.png, call bob@acme.com" }).signature, sig.signature, "stable");
assert.notEqual(issueSignature({ issue: "blue screen MEMORY_MANAGEMENT" }).signature, sig.signature, "different issues ⇒ different signatures");

// 2 — first sighting: start at the bottom of the ladder.
let L = emptyLedger();
let d = onRecurrence(L, sig.signature, T0);
assert.equal(d.recurred, false);
assert.equal(d.rung, "symptom-recipe");
assert.equal(d.reason, "first-sighting");

// 3 — record a resolution, then the SAME issue returns at 71h ⇒ climb exactly one rung.
L = recordResolution(L, { signature: sig.signature, fixApplied: "restart-print-spooler", resolvedAt: T0, rung: "symptom-recipe", planRunId: "print-recovery-run-1" });
d = onRecurrence(L, sig.signature, T0 + 71 * H);
assert.equal(d.recurred, true);
assert.equal(d.rung, "deeper-recipe", "one rung up — never the same fix again");
assert.equal(d.escalateToHuman, false);
assert.match(d.reason, /returned 71h/);

// 4 — outside the 72h window it is a fresh problem again (we do not punish a machine forever).
d = onRecurrence(L, sig.signature, T0 + 73 * H);
assert.equal(d.recurred, false);
assert.equal(d.rung, "symptom-recipe");
assert.equal(RECURRENCE_WINDOW_MS, 72 * H);

// 5 — the ladder climbs one rung at a time and ends at a HUMAN, then stops there.
assert.deepEqual([...FIX_LADDER], ["symptom-recipe", "deeper-recipe", "root-cause", "human"]);
assert.equal(nextRung("deeper-recipe"), "root-cause");
assert.equal(nextRung("root-cause"), "human");
assert.equal(nextRung("human"), "human", "the ladder never loops back to retrying");
let L2 = recordResolution(emptyLedger(), { signature: sig.signature, fixApplied: "root-cause-fix", resolvedAt: T0, rung: "root-cause" });
assert.equal(onRecurrence(L2, sig.signature, T0 + 1 * H).escalateToHuman, true, "exhausted ladder ⇒ a human gets it");

// 6 — DURABLE is earned by silence, not by optimism.
assert.equal(isDurable(L, sig.signature, T0 + 23 * H), false, "23h quiet is not durable yet");
assert.equal(lastRecord(L, sig.signature).durable, false);
let early = markDurable(L, sig.signature, T0 + 23 * H);
assert.equal(lastRecord(early, sig.signature).durable, false, "markDurable is a no-op before the window");
const durable = markDurable(L, sig.signature, T0 + 25 * H);
assert.equal(lastRecord(durable, sig.signature).durable, true);
assert.equal(lastRecord(durable, sig.signature).durableAt, T0 + 25 * H);
assert.equal(DURABLE_QUIET_MS, 24 * H);

// 7 — deflection counts DURABLE resolutions only, and is null (not 0, not 100) with no attempts.
assert.equal(deflectionStats(durable, { attempts: 0, now: T0 + 25 * H }).deflectionRate, null, "real-or-empty");
const stats = deflectionStats(durable, { attempts: 4, now: T0 + 25 * H });
assert.equal(stats.durableResolutions, 1);
assert.equal(stats.deflectionRate, 25, "1 durable / 4 attempts");
assert.match(stats.basis, /durable resolutions/i);
const notYet = deflectionStats(L, { attempts: 4, now: T0 + 2 * H });
assert.equal(notYet.durableResolutions, 0, "a fresh patch is not yet a durable resolution");
assert.equal(notYet.deflectionRate, 0);

// 8 — 🔒 R11: nothing off-limits can be written into the ledger.
const blocked = recordResolution(emptyLedger(), { signature: "C:\\Users\\a\\Private pics and Vids\\x", fixApplied: "x", resolvedAt: T0 });
assert.equal(blocked.records.length, 0);
const blockedFix = recordResolution(emptyLedger(), { signature: sig.signature, fixApplied: "C:\\Private pics and Vids\\run.ps1", resolvedAt: T0 });
assert.equal(blockedFix.records.length, 0);

// 9 — append-only: recording never mutates the caller's ledger.
const before = L.records.length;
recordResolution(L, { signature: sig.signature, fixApplied: "again", resolvedAt: T0 + 1 });
assert.equal(L.records.length, before, "the input ledger is never mutated");

console.log("durability-ledger test passed (F1: content-blind signature · 72h recurrence climbs exactly one rung · ladder ends at a human · durable only after 24h quiet · deflection counts durable only · R11 · append-only).");

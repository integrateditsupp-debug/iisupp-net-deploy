// D2 (2026-07-03) — Ask-ARIA usage must be recorded to local memory + stats so the Memory tab and the
// Dashboard "Operations at a glance" reflect REAL usage (was staying 0 after real asks). Pure folds are
// unit-tested here; main.persistChatAsk wires them to ~/.aria-sentinel/sessions + the electron-store.
import assert from "node:assert/strict";
import { classifyAnswer, recordAsk, foldStats, kbHitRate } from "../src/shared/chat-stats.mjs";
import { parseSessions } from "../src/shared/aria-surfaces.mjs";

let n = 0; const t = () => { n++; };

// 1 — classifyAnswer maps each chat outcome to the right bucket.
assert.equal(classifyAnswer({ provider: "aria-brain", action: "kb-match" }), "kb", "live kb-match → kb");
assert.equal(classifyAnswer({ provider: "local-kb", matched: true }), "kb", "matched offline KB → kb");
assert.equal(classifyAnswer({ provider: "aria-brain", action: "escalate" }), "anthropic", "aria-chat reply → anthropic");
assert.equal(classifyAnswer({ provider: "local-kb", matched: false }), "miss", "abstain → miss");
t();

// 2 — recordAsk appends 2 turns and increments the per-session counters (never mutates the input).
const before = { id: "local-1" };
const after = recordAsk(before, { message: "printer not printing", reply: "Restart the print spooler.", kind: "kb", at: "2026-07-03T10:00:00Z" });
assert.equal(before.turns, undefined, "input session not mutated");
assert.equal(after.turns.length, 2, "one ask → user + assistant turns");
assert.equal(after.turns[0].role, "user");
assert.equal(after.turns[1].role, "assistant");
assert.equal(after.asks, 1);
assert.equal(after.kb_hits, 1);
assert.equal(after.anthropic_hits, 0);
assert.equal(after.started_at, "2026-07-03T10:00:00Z");
const after2 = recordAsk(after, { message: "why is teams crashing", reply: "Let me get a human.", kind: "anthropic", at: "2026-07-03T10:05:00Z" });
assert.equal(after2.asks, 2);
assert.equal(after2.kb_hits, 1);
assert.equal(after2.anthropic_hits, 1);
assert.equal(after2.started_at, "2026-07-03T10:00:00Z", "started_at is preserved across asks");
t();

// 3 — the persisted session feeds the Memory tab's parseSessions: 2 sessions/asks/KB-hits become non-zero.
const view = parseSessions([after2]);
assert.equal(view.stats.total, 1, "one session");
assert.equal(view.stats.totalAsks, 2, "two asks recorded (Memory no longer shows 0)");
assert.equal(view.stats.kbHits, 1, "one KB hit");
assert.equal(view.stats.anthropicHits, 1, "one Anthropic ask");
t();

// 4 — global stats fold + real KB hit rate (null until the first ask — real-or-empty, Rule 14).
assert.equal(kbHitRate({}), null, "no asks → null (never a vanity number)");
let g = {};
g = foldStats(g, "kb");
g = foldStats(g, "kb");
g = foldStats(g, "anthropic");
g = foldStats(g, "miss");
assert.equal(g.asks, 4);
assert.equal(g.kbHits, 2);
assert.equal(g.anthropicHits, 1);
assert.equal(g.misses, 1);
assert.equal(kbHitRate(g), 50, "2 KB hits / 4 asks = 50%");
t();

assert.equal(n, 4, "4 D2 chat-stats test groups");
console.log(`chat-stats test passed (${n} groups · classify · recordAsk · Memory parseSessions non-zero · real KB hit rate).`);

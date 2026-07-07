// Phase F (D2 lane closure) — real chat asks must be RECORDED so ARIA→Memory and the Dashboard ops
// metrics reflect real local use (they read ~/.aria-sentinel/sessions/*.json via parseSessions).
// Pins: the pure recorder increments asks/kb_hits/anthropic_hits honestly, caps growth, scrubs paths,
// parseSessions counts an ask as a USER turn (not both sides), and main.mjs actually wires the
// recorder into BOTH chat branches (aria-brain + offline local-kb).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { appendChatActivity, sessionFileName, MAX_SESSION_TURNS } from "../src/shared/chat-activity.mjs";
import { parseSessions } from "../src/shared/aria-surfaces.mjs";

// ── 1 — a fresh session is minted and one exchange = 1 ask, honest tier counters ──
const t0 = Date.parse("2026-07-07T15:00:00Z");
let session = appendChatActivity(null, { message: "printer not printing", reply: "From the knowledge base: …", provider: "aria-brain", kbHit: true, anthropicHit: false, now: t0 });
assert.equal(session.turns.length, 2, "one exchange = user + assistant turns");
assert.equal(session.kb_hits, 1, "KB hit counted");
assert.equal(session.anthropic_hits, 0, "no Anthropic hit invented");
assert.equal(session.id, "sentinel-2026-07-07", "day-session id");
assert.equal(sessionFileName(t0), "sentinel-2026-07-07.json", "one file per day");

// ── 2 — a second ask appends to the SAME session; Anthropic-tier reply counts that counter only ──
session = appendChatActivity(session, { message: "vpn broken?", reply: "Try this …", provider: "aria-brain", kbHit: false, anthropicHit: true, now: t0 + 60000 });
assert.equal(session.turns.length, 4, "second exchange appended");
assert.equal(session.kb_hits, 1, "kb counter unchanged");
assert.equal(session.anthropic_hits, 1, "anthropic tier counted once");

// ── 3 — parseSessions turns this into honest Memory stats: 2 asks (USER turns), not 4 ──
const mem = parseSessions([session], { now: t0 + 120000 });
assert.equal(mem.stats.total, 1, "1 session");
assert.equal(mem.stats.totalAsks, 2, "2 real asks (user turns), not double-counted");
assert.equal(mem.stats.kbHits, 1, "1 KB hit surfaces");
assert.equal(mem.stats.anthropicHits, 1, "1 Anthropic hit surfaces");

// ── 4 — R11: stored text is path-scrubbed; growth is capped ──
const dirty = appendChatActivity(null, { message: "file at C:\\Users\\someone\\secret.docx won't open", reply: "ok", now: t0 });
assert.doesNotMatch(dirty.turns[0].text, /C:\\Users/, "absolute path scrubbed from the stored ask");
let big = null;
for (let i = 0; i < 150; i += 1) big = appendChatActivity(big, { message: `q${i}`, reply: `a${i}`, now: t0 + i });
assert.ok(big.turns.length <= MAX_SESSION_TURNS, "session growth capped");
assert.equal(big.turns[big.turns.length - 1].text, "a149", "cap keeps the NEWEST turns");

// ── 5 — malformed/garbage session input never throws, mints fresh ──
for (const garbage of [[], "junk", 42, { turns: "nope" }]) {
  const out = appendChatActivity(garbage, { message: "x", reply: "y", now: t0 });
  assert.ok(Array.isArray(out.turns) && out.turns.length >= 2, "garbage session -> fresh recording");
}

// ── 6 — main.mjs wiring: BOTH chat branches record, into the dir Memory reads ──
const mainJs = fs.readFileSync(path.resolve("src/main/main.mjs"), "utf8");
assert.match(mainJs, /from "\.\.\/shared\/chat-activity\.mjs"/, "main imports the recorder");
const recordCalls = mainJs.match(/recordChatActivity\(\{/g) || [];
assert.ok(recordCalls.length >= 2, "both chat branches (aria-brain + local-kb) record activity");
assert.match(mainJs, /\.aria-sentinel", "sessions"\)/, "recorder writes the SAME sessions dir Memory reads");
assert.match(mainJs, /kbHit: Boolean\(brain\.kb_match\)/, "KB hit recorded only on a real kb_match");
assert.match(mainJs, /kbHit: kb\.matched === true/, "offline branch records a KB hit only on a real local match");

console.log("Chat-activity recording test passed (asks persist to the Memory sessions dir · honest kb/anthropic tier counters · user-turn ask count · R11 scrub · cap · garbage-safe · both branches wired).");

// JULY PORT 2026-10-14 (a7f9e111 "Phase F D2 lane closure", cc/security-lockdown-2026-07-01) — real chat asks must be
// RECORDED so ARIA→Memory and the Dashboard ops metrics reflect real local use (they read ~/.aria-sentinel/sessions/*.json
// via parseSessions). Pins: the pure July recorder increments asks/kb_hits/anthropic_hits honestly, caps growth, scrubs
// paths through the EXISTING excluded-folder guard, parseSessions counts an ask as a USER turn, and main.mjs — which on
// this line already records every chat branch through chat-stats.recordAsk at ONE choke point (persistChatAsk) — now
// scrubs every stored turn on disk and caps the session with this module's helpers (ADAPTED wiring assertions).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { appendChatActivity, sessionFileName, scrubChatText, capSessionTurns, MAX_SESSION_TURNS } from "../src/shared/chat-activity.mjs";
import { parseSessions } from "../src/shared/aria-surfaces.mjs";
import { PRIVATE_FOLDER_NAME } from "../src/shared/path-guard.mjs";

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

// ── 4 — R11 + paths: stored text is scrubbed through the existing guard; growth is capped ──
const dirty = appendChatActivity(null, { message: "file at C:\\Users\\someone\\secret.docx won't open", reply: "ok", now: t0 });
assert.doesNotMatch(dirty.turns[0].text, /C:\\Users/, "absolute path scrubbed from the stored ask");
const folderRe = new RegExp(PRIVATE_FOLDER_NAME.replace(/\s+/g, "\\s+"), "i");
const priv = scrubChatText(`open C:\\Users\\someone\\${PRIVATE_FOLDER_NAME}\\a.docx and /home/someone/x.txt`);
assert.doesNotMatch(priv, folderRe, "the excluded folder never survives (guard's redactPrivate)");
assert.match(priv, /<private-folder>/, "…it is the guard's own placeholder");
assert.doesNotMatch(priv, /\/home\/someone/, "home paths reduced to [path]");
assert.doesNotMatch(scrubChatText("\\\\fileserver\\share\\doc.xlsx"), /fileserver/, "UNC paths reduced to [path]");
let big = null;
for (let i = 0; i < 150; i += 1) big = appendChatActivity(big, { message: `q${i}`, reply: `a${i}`, now: t0 + i });
assert.ok(big.turns.length <= MAX_SESSION_TURNS, "session growth capped");
assert.equal(big.turns[big.turns.length - 1].text, "a149", "cap keeps the NEWEST turns");
const capped = capSessionTurns({ turns: Array.from({ length: 250 }, (_, i) => ({ text: String(i) })), asks: 250 });
assert.equal(capped.turns.length, MAX_SESSION_TURNS, "capSessionTurns trims to the cap");
assert.equal(capped.turns[capped.turns.length - 1].text, "249", "…keeping the newest");
assert.equal(capped.asks, 250, "…and never touches the counters");

// ── 5 — malformed/garbage session input never throws, mints fresh ──
for (const garbage of [[], "junk", 42, { turns: "nope" }]) {
  const out = appendChatActivity(garbage, { message: "x", reply: "y", now: t0 });
  assert.ok(Array.isArray(out.turns) && out.turns.length >= 2, "garbage session -> fresh recording");
}
assert.ok(Array.isArray(capSessionTurns("junk").turns), "capSessionTurns is garbage-safe");

// ── 6 — main.mjs wiring: the ONE choke point every chat branch already uses now scrubs + caps on disk ──
const mainJs = fs.readFileSync(path.resolve(import.meta.dirname, "..", "src", "main", "main.mjs"), "utf8");
assert.match(mainJs, /from "\.\.\/shared\/chat-activity\.mjs"/, "main imports the recorder helpers");
assert.match(mainJs, /\.aria-sentinel", "sessions"\)/, "the recorder writes the SAME sessions dir Memory reads");
const persistCalls = mainJs.match(/persistChatAsk\(message, [^)]*classifyAnswer\(/g) || [];
assert.ok(persistCalls.length >= 2, `every chat branch (aria-brain + local-kb + topics) records activity (found ${persistCalls.length})`);
assert.match(mainJs, /capSessionTurns\(recordAsk\(session, \{ message: scrubChatText\(message\), reply: scrubChatText\(reply\), kind, at \}\)\)/, "stored turns are scrubbed + the session capped at the choke point");
assert.match(mainJs, /classifyAnswer\(\{ provider: "aria-brain", action: brain\.action \|\| null \}\)/, "KB hit recorded only on a real kb-match action from the brain");
assert.match(mainJs, /classifyAnswer\(\{ provider: "local-kb", matched: kb\.matched \}\)/, "offline branch records a KB hit only on a real local match");

console.log("Chat-activity recording test passed (asks persist to the Memory sessions dir · honest kb/anthropic tier counters · user-turn ask count · guard-scrubbed on disk · cap · garbage-safe · one choke point wired).");

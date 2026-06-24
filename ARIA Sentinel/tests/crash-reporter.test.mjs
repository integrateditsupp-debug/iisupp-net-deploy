// RUN 29-D — $0 crash reporter: content-blind scrub (R11 + all absolute paths), bounded queue, retry-on-
// failure, and never-throw forwarding (a dead endpoint can't block startup).
import assert from "node:assert/strict";
import { scrubCrashText, buildCrashRecord, enqueueCrash, flushCrashQueue, CRASH_QUEUE_MAX } from "../src/main/crash-reporter.mjs";

let n = 0; const t = () => { n++; };

// 1 — 🔒 R11: the private folder is redacted in messages AND stacks, in any form.
for (const p of [
  "failed reading C:\\Users\\bob\\Private pics and Vids\\x.jpg",
  "at load (D:/media/private pics and vids/clip.mp4:12)",
  "file:///C:/Users/bob/Private%20pics%20and%20Vids/v"
]) {
  const s = scrubCrashText(p);
  assert.doesNotMatch(s, /private\s+pics\s+and\s+vids/i, `R11 folder redacted: ${p}`);
}
t();

// 2 — every absolute path / file:// URL becomes [path]; no username or drive path survives.
const stack = [
  "Error: boom",
  "    at Object.<anonymous> (C:\\Users\\Ahmad Wasee\\app\\main.mjs:42:10)",
  "    at file:///C:/Users/Ahmad/Documents/secret/thing.mjs:1:1",
  "    at /home/ahmad/app/lib.js:9:9",
  "    at Module._compile (node:internal/modules/cjs/loader:1234:14)"
].join("\n");
const scrubbed = scrubCrashText(stack);
assert.doesNotMatch(scrubbed, /C:\\Users\\[A-Za-z]/, "no windows user path");
assert.doesNotMatch(scrubbed, /\/home\/[a-z]/i, "no posix home path");
assert.doesNotMatch(scrubbed, /file:\/\//, "no file:// url");
assert.doesNotMatch(scrubbed, /Ahmad/i, "no username leaks");
assert.match(scrubbed, /\[path\]/, "paths replaced with placeholder");
assert.match(scrubbed, /node:internal/, "node-internal frames kept (not a real path)");
t();

// 3 — buildCrashRecord carries ONLY symbolic metadata, scrubbed + truncated, no file contents.
const err = new Error("could not open C:\\Users\\bob\\Private pics and Vids\\f.txt");
err.stack = stack + "\n" + Array.from({ length: 40 }, (_, i) => `    at frame${i} (C:\\Users\\bob\\f${i}.js:1:1)`).join("\n");
const rec = buildCrashRecord(err, { version: "0.1.2", platform: "win32", now: 1700000000000 });
assert.equal(rec.ts, 1700000000000);
assert.equal(rec.version, "0.1.2");
assert.equal(rec.platform, "win32");
assert.doesNotMatch(JSON.stringify(rec), /private\s+pics\s+and\s+vids/i, "no R11 in the record");
assert.doesNotMatch(JSON.stringify(rec), /C:\\Users\\bob/, "no raw user path in the record");
assert.ok(rec.stack.split("\n").length <= 20, "stack truncated to ≤20 frames");
assert.ok(rec.message.length <= 500, "message bounded");
t();

// 4 — queue is bounded (oldest dropped past the cap).
let q = [];
for (let i = 0; i < CRASH_QUEUE_MAX + 10; i++) q = enqueueCrash(q, { ts: i });
assert.equal(q.length, CRASH_QUEUE_MAX, "queue capped");
assert.equal(q[q.length - 1].ts, CRASH_QUEUE_MAX + 9, "newest kept");
assert.equal(q[0].ts, 10, "oldest dropped");
t();

// 5 — retry-on-failure: unsent records are kept; a throwing/false sender never throws out (no startup block).
const queue = [{ ts: 1 }, { ts: 2 }, { ts: 3 }];
let remaining = await flushCrashQueue(queue, async (r) => r.ts !== 2);      // #2 "fails to send"
assert.deepEqual(remaining.map((r) => r.ts), [2], "only the unsent record is retried");
remaining = await flushCrashQueue(queue, async () => { throw new Error("network down"); }); // endpoint dead
assert.deepEqual(remaining.map((r) => r.ts), [1, 2, 3], "throwing sender keeps the whole queue, never throws");
remaining = await flushCrashQueue(queue, async () => true);                 // all sent
assert.deepEqual(remaining, [], "all sent → queue cleared");
t();

assert.equal(n, 5, "5 crash-reporter test groups");
console.log(`crash-reporter test passed (${n} groups · R11 redaction · all-paths scrubbed · symbolic-only record · bounded queue · retry-on-failure · never-throw flush).`);

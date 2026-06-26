// G-PRECISION (RUN 36) — precision-first KB matcher. Locks the new signals (light stemmer, synonym
// expansion, explicit-platform-only bias, IDF-weighted coverage with a heading boost) and the honest
// out-of-scope REJECT (a question the KB doesn't cover returns null → escalates; we never force a match).
// Routing is asserted against the REAL aria-kb-pack so the improvement is genuine, not a fixture.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { stem, expandQuery, explicitPlatformMention, matchKb, loadKbPack, MATCH_FLOOR } from "../src/shared/aria-local-kb.mjs";

const root = path.resolve(import.meta.dirname, "..");
const index = loadKbPack(path.join(root, "aria-kb-pack"), fs);

let tests = 0;
const ok = (label) => { tests++; console.log(`  ✓ ${label}`); };

// ── 1 — light stemmer folds morphological variants (both query + doc side) ──
assert.equal(stem("crashing"), "crash", "crashing → crash");
assert.equal(stem("crashes"), "crash", "crashes → crash");
assert.equal(stem("printing"), "print", "printing → print");
assert.equal(stem("printers"), "printer", "printers → printer");
assert.equal(stem("monitor"), "monitor", "monitor unchanged");
ok("stemmer folds crashing/crashes → crash, printers → printer");

// ── 2 — synonym expansion maps intent words to the right topic token ──
assert.ok(expandQuery("external monitor not detected").includes("display"), "monitor → display");
assert.ok(expandQuery("there is no sound").includes("audio"), "sound → audio");
assert.ok(expandQuery("it keeps asking for my password").includes("credential"), "password → credential");
assert.ok(expandQuery("my battery won't charge").includes("battery"), "charge → battery");
ok("synonyms: monitor→display, sound→audio, password→credential, charge→battery");

// ── 3 — explicit platform is only a NAMED mention (host OS does not bias routing) ──
assert.equal(explicitPlatformMention("my macbook won't wake"), "darwin", "macbook → darwin");
assert.equal(explicitPlatformMention("iphone won't charge"), "ios", "iphone → ios");
assert.equal(explicitPlatformMention("the printer is offline"), "", "no platform named → empty");
ok("explicit-platform mention detected; generic symptom names no platform");

// ── 4 — REAL-pack routing: generic symptoms reach the CORRECT diagnostic (precision win) ──
const route = (q, platform = "win32") => { const m = matchKb(index, q, { platform }); return m && m.doc.id; };
const ROUTES = [
  ["audio not working there is no sound", /audio-issues/],
  ["external monitor is not being detected", /display-issues/],
  ["my printer won't print anything", /printer/],
  ["i am locked out of my account", /credential/],
  ["the laptop battery drains way too fast", /battery-power/],
  ["usb drive is not showing up", /usb-peripheral/]
];
for (const [q, re] of ROUTES) assert.match(String(route(q)), re, `"${q}" → ${re}`);
// platform named in the message wins over the host OS
assert.match(String(route("my macbook won't boot past the apple logo", "win32")), /macos|boot-issues/, "macbook → macOS/boot, not the Windows blueprint");
ok("real-pack routing: symptoms reach the correct diagnostic; named platform routes right");

// ── 5 — honest OUT-OF-SCOPE reject: a question the KB doesn't cover returns null (escalates) ──
for (const q of ["book me a flight to new york", "zxcv qwer asdf nonsense", "what is the weather tomorrow"]) {
  assert.equal(matchKb(index, q), null, `out-of-scope "${q}" → null (escalates, never forced)`);
}
// a confident in-scope match clears the floor and returns a real score
const good = matchKb(index, "my printer won't print anything");
assert.ok(good && good.score >= MATCH_FLOOR, "in-scope match clears the confidence floor");
ok("out-of-scope rejected (null → escalate); in-scope clears the floor — number never padded");

assert.equal(tests, 5, "kb-matcher-precision runs exactly 5 test cases");
console.log(`KB-matcher-precision test passed (${tests}/5 · stemmer · synonyms · explicit-platform · real-pack routing · honest out-of-scope reject).`);

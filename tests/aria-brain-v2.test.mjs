// tests/aria-brain-v2.test.mjs — ARIA brain v2 behavior battery (2026-07-07, Cowork)
// Run:  node tests/aria-brain-v2.test.mjs
// Optional: ARIA_BRAIN_PATH=/abs/path/to/aria-brain.js overrides the engine under test.
//
// Covers: v1 regressions (clarifier-then-wait, context carryover, weighted classification, honesty),
// the fixed sparse-array dead-chat bug, all v2 layers (empathy, didn't-work memory, done-check,
// multi-intent queue, Node-safety), and a schema lint across every topic.

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const enginePath = process.env.ARIA_BRAIN_PATH
  ? path.resolve(process.env.ARIA_BRAIN_PATH)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "aria-brain.js");
const AB = require(enginePath);

let pass = 0, fail = 0;
const bad = [];
function ok(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; bad.push(`${name}${detail ? ` — ${detail}` : ""}`); }
}

// ---------- 0. engine shape ----------
ok("exports.handleTurn", typeof AB.handleTurn === "function");
ok("exports.newSession", typeof AB.newSession === "function");
ok("exports.classify", typeof AB.classify === "function");
ok("exports.version v2", AB.version === "2.0", `got ${AB.version}`);

// ---------- 1. TOPICS schema lint (every topic complete, no sparse holes) ----------
const T = AB._TOPICS;
ok("no sparse holes", T.every(Boolean), `holes=${T.length - T.filter(Boolean).length}`);
ok("topic count >= 32", T.filter(Boolean).length >= 32, `got ${T.filter(Boolean).length}`);
const ids = new Set();
for (const t of T.filter(Boolean)) {
  ok(`topic ${t.id}: unique id`, !ids.has(t.id)); ids.add(t.id);
  ok(`topic ${t.id}: label`, typeof t.label === "string" && t.label.length > 4);
  ok(`topic ${t.id}: signals`, Array.isArray(t.signals) && t.signals.length >= 2 &&
    t.signals.every(s => Array.isArray(s) && typeof s[0] === "string" && typeof s[1] === "number"));
  ok(`topic ${t.id}: clarifier`, t.clarifier && typeof t.clarifier.q === "string" &&
    Array.isArray(t.clarifier.options) && t.clarifier.options.length >= 3);
  ok(`topic ${t.id}: branches`, Array.isArray(t.branches) && t.branches.length >= 3 &&
    t.branches.every(b => b && Array.isArray(b.when) && b.when.length && typeof b.cause === "string" &&
      Array.isArray(b.steps) && b.steps.length >= 2));
  ok(`topic ${t.id}: escalate`, typeof t.escalate === "string" && t.escalate.length > 20);
}

// ---------- 2. v1 regressions ----------
// clarifier-then-wait: vague topic ask -> ONE question, no steps in the same turn
let s = AB.newSession();
let r = AB.handleTurn(s, "outlook is broken");
ok("v1 clarifier-then-wait", r.stage === "awaiting" && r.ask && !r.steps, JSON.stringify({ stage: r.stage, ask: !!r.ask, steps: !!r.steps }));
// context carryover: the answer branches WITHIN outlook, never re-routes
r = AB.handleTurn(s, "it freezes on the loading profile screen");
ok("v1 carryover -> outlook branch", r.topic === "outlook" && r.stage === "answered" && r.steps && r.steps.length >= 3);
// honesty tail present on answers
ok("v1 honest tail", /can't make changes on your device/i.test(r.tail || ""));
// low-confidence -> triage, no dump
r = AB.handleTurn(AB.newSession(), "everything is weird help");
ok("v1 triage on low confidence", r.stage === "triage" && Array.isArray(r.options) && !r.steps);
// greeting + goodbye
ok("v1 greet", AB.handleTurn(AB.newSession(), "hello").stage === "greet");
s = AB.newSession();
AB.handleTurn(s, "printer offline");
ok("v1 bye closes", AB.handleTurn(s, "thanks all good").stage === "closed");

// ---------- 3. dead-chat regression (the fixed sparse-array hole) ----------
// Every topic AFTER the old hole (office_activation .. office_crash) must survive a follow-up turn.
for (const id of ["office_activation", "email_mobile", "display", "usb_device", "mapped_drive", "office_crash"]) {
  const t = T.find(x => x && x.id === id);
  const sess = AB.newSession();
  sess.topic = id; sess.stage = "awaiting";
  let threw = false, res = null;
  try { res = AB.handleTurn(sess, t.branches[0].when[0]); } catch { threw = true; }
  ok(`post-hole follow-up ${id}`, !threw && res && res.topic === id, threw ? "THREW (dead chat)" : JSON.stringify(res && res.stage));
}

// ---------- 4. v2: new topics classify + answer ----------
const cases = [
  ["windows update stuck at 30 percent for hours", "windows_update"],
  ["i clicked a phishing link and entered my password", "phishing"],
  ["my files are encrypted and there is a ransom note", "malware"],
  ["i accidentally deleted a file i need back", "file_recovery"],
  ["laptop plugged in but not charging", "battery_power"],
  ["webcam shows a black image", "camera"],
  ["keyboard types wrong characters", "keyboard_mouse"],
  ["cant join my zoom meeting", "zoom"],
  ["sharepoint says access denied", "sharepoint"],
  ["screen went black after sleep", "black_screen"],
  ["remote desktop wont connect to my work computer", "rdp"],
  ["scan to email stopped working", "scanner"],
];
for (const [msg, want] of cases) {
  const sess = AB.newSession();
  const res = AB.handleTurn(sess, msg);
  ok(`v2 topic ${want}`, res.topic === want, `got ${res.topic} (${res.stage})`);
  ok(`v2 topic ${want} responds`, res.stage === "answered" ? res.steps.length >= 2 : Boolean(res.ask));
}
// security steps are urgent + honest (no fake execution)
s = AB.newSession();
r = AB.handleTurn(s, "i entered my password on a fake login page");
ok("phishing credential path urgency", r.steps && /IMMEDIATELY/i.test(r.steps[0]));
s = AB.newSession();
r = AB.handleTurn(s, "ransomware note says pay bitcoin, files renamed");
ok("ransomware isolate-first", r.steps && /DISCONNECT/i.test(r.steps[0]));

// ---------- 5. v2: empathy layer ----------
r = AB.handleTurn(AB.newSession(), "URGENT my wifi keeps dropping and i have a deadline");
ok("empathy on urgency", typeof r.empathy === "string" && r.empathy.length > 10);
r = AB.handleTurn(AB.newSession(), "wifi keeps dropping");
ok("no empathy without frustration", !r.empathy);

// ---------- 6. v2: didn't-work memory -> different angle -> honest escalation ----------
s = AB.newSession();
AB.handleTurn(s, "outlook freezes at the profile screen");              // answered (freeze branch)
r = AB.handleTurn(s, "still frozen at the profile screen, didnt work"); // same branch would match -> must NOT repeat
ok("no repeat of failed fix", r.stage === "awaiting" && /different angle/i.test(r.say || ""), `stage=${r.stage}`);
r = AB.handleTurn(s, "still not working");
ok("escalates after retry", r.stage === "escalated" && r.escalate, `stage=${r.stage}`);
// but NEW symptom info mid-complaint still routes to the right different branch
s = AB.newSession();
AB.handleTurn(s, "outlook freezes at the profile screen");
r = AB.handleTurn(s, "tried that, still broken — now it shows an error code 0x8004");
ok("new symptom -> different branch not loop", r.stage === "answered" && /error/i.test(r.say || ""), `stage=${r.stage} say=${(r.say || "").slice(0, 40)}`);

// ---------- 7. v2: done -> checking -> fixed/still-broken ----------
s = AB.newSession();
AB.handleTurn(s, "teams mic not working");
AB.handleTurn(s, "no one can hear me");
r = AB.handleTurn(s, "done");
ok("done -> checking", r.stage === "checking" && r.options && r.options.length === 2, `stage=${r.stage}`);
r = AB.handleTurn(s, "It's fixed");
ok("fixed -> closed", r.stage === "closed", `stage=${r.stage}`);

// ---------- 8. v2: multi-intent queue + handoff ----------
s = AB.newSession();
r = AB.handleTurn(s, "outlook wont open and also my printer is offline");
ok("multi-intent detected", Boolean(r.also) && Boolean(s.queued), `also=${!!r.also} queued=${s.queued}`);
const firstTopic = r.topic;
AB.handleTurn(s, firstTopic === "outlook" ? "nothing happens when i open it" : "it shows offline");
r = AB.handleTurn(s, "thanks that fixed it");
ok("queued handoff after close", r.stage === "awaiting" && r.topic && r.topic !== firstTopic, `stage=${r.stage} topic=${r.topic}`);

// ---------- 9. v2: Node safety (this whole run proves it) + session reset fields ----------
const ns = AB.newSession();
ok("session v2 fields", "lastBranch" in ns && "retried" in ns && "queued" in ns);

// ---------- result ----------
console.log(`\naria-brain v2 battery: ${pass} passed, ${fail} failed`);
if (bad.length) { console.log("FAILURES:"); for (const b of bad) console.log("  ✗ " + b); }
process.exit(fail ? 1 : 0);

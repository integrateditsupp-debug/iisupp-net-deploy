// tests/aria-brain-v2-matrix.test.mjs — EXHAUSTIVE scenario matrix for the ARIA brain (2026-07-07, Cowork)
// Run:  node tests/aria-brain-v2-matrix.test.mjs            (engine = ../aria-brain.js)
//       ARIA_BRAIN_PATH=/abs/path node tests/...            (test any engine build, incl. v1 for comparison)
//       ARIA_MATRIX_VERBOSE=1                               (print every case)
//
// Goes beyond tests/aria-brain-v2.test.mjs: walks EVERY topic × EVERY branch × EVERY clarifier chip,
// every conversational flow, adversarial input, session robustness, and honesty invariants.
// Suites degrade gracefully on a v1 engine (v2-only suites are skipped) so the same file can score both.

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const enginePath = process.env.ARIA_BRAIN_PATH
  ? path.resolve(process.env.ARIA_BRAIN_PATH)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "aria-brain.js");
const AB = require(enginePath);
const V2 = /^2\./.test(String(AB.version || ""));
const VERBOSE = !!process.env.ARIA_MATRIX_VERBOSE;

let pass = 0, fail = 0, skip = 0;
const bad = [];
function ok(name, cond, detail) {
  if (cond) { pass++; if (VERBOSE) console.log("  ✓ " + name); }
  else { fail++; bad.push(`${name}${detail ? ` — ${detail}` : ""}`); if (VERBOSE) console.log("  ✗ " + name + (detail ? " — " + detail : "")); }
}
function skipIf(cond, n = 1) { if (cond) { skip += n; return true; } return false; }
const T = AB._TOPICS.filter(Boolean);
const topicIds = T.map(t => t.id);
// crash-proof turn: an engine throw is a scored FAILURE (dead chat), never a suite kill.
function turn(s, text) {
  try { return AB.handleTurn(s, text) || { stage: "__null__" }; }
  catch (e) { return { stage: "__threw__", __threw: true, __err: String(e && e.message || e).slice(0, 60) }; }
}
function seedPhrase(t) { // strongest signal phrase for a topic
  return t.signals.slice().sort((a, b) => b[1] - a[1])[0][0];
}
function freshOn(topic) { // session already routed to the topic's clarifier
  const s = AB.newSession();
  const r = turn(s, seedPhrase(topic));
  return { s, r };
}

console.log(`ENGINE: ${enginePath}`);
console.log(`version=${AB.version || "1 (pre-version)"}  topics=${T.length}\n`);

/* ================= SUITE 1 — classification integrity ================= */
console.log("SUITE 1 — classification integrity");
// 1a. every topic's strongest signal routes to that topic (no cross-topic hijack)
for (const t of T) {
  const { r } = freshOn(t);
  ok(`S1 seed->topic ${t.id}`, r.topic === t.id, `"${seedPhrase(t)}" -> ${r.topic}`);
}
// 1b. seeds never throw and always produce ask OR steps
for (const t of T) {
  const { r } = freshOn(t);
  ok(`S1 seed responds ${t.id}`, Boolean(r.ask || r.steps), `stage=${r.stage}`);
}

/* ================= SUITE 2 — every branch reachable via its when-words ================= */
console.log("SUITE 2 — branch reachability (topic × branch)");
for (const t of T) {
  t.branches.forEach((b, i) => {
    const { s } = freshOn(t);
    const r2 = turn(s, b.when[0]);
    const okBranch = r2.stage === "answered" && r2.topic === t.id && Array.isArray(r2.steps) && r2.steps.length >= 2;
    ok(`S2 ${t.id} branch#${i} via "${b.when[0]}"`, okBranch, `stage=${r2.stage} topic=${r2.topic}`);
  });
}

/* ================= SUITE 3 — every clarifier CHIP routes (the click path) ================= */
// Users click the option chips verbatim. A chip that lands in a re-ask loop is a UX defect.
console.log("SUITE 3 — clarifier chip routing (topic × option)");
const chipMisses = [];
for (const t of T) {
  for (const opt of t.clarifier.options) {
    const { s } = freshOn(t);
    const r2 = turn(s, opt);
    const routed = r2.stage === "answered" && r2.topic === t.id;
    if (!routed) chipMisses.push(`${t.id} :: "${opt}" -> ${r2.stage}`);
    ok(`S3 chip ${t.id} :: "${opt}"`, routed, `stage=${r2.stage}`);
  }
}

/* ================= SUITE 4 — triage chips route ================= */
console.log("SUITE 4 — triage chip routing");
{
  const s = AB.newSession();
  const r = turn(s, "something odd going on with this machine");
  ok("S4 vague -> triage", r.stage === "triage" && Array.isArray(r.options));
  const expects = [
    ["Email / Outlook", "outlook"],
    ["Printing", "printer"],
    ["Wi-Fi / internet", "wifi"],
    ["Sign-in / password", ["password", "mfa"]],
    ["Slow computer", "slow"],
  ];
  for (const [chip, want] of expects) {
    const s2 = AB.newSession();
    turn(s2, "something odd going on with this machine");
    const r2 = turn(s2, chip);
    const wanted = Array.isArray(want) ? want : [want];
    ok(`S4 triage chip "${chip}"`, wanted.includes(r2.topic) && (r2.ask || r2.steps), `-> ${r2.topic}/${r2.stage}`);
  }
  if (V2) {
    const s3 = AB.newSession();
    turn(s3, "something odd going on with this machine");
    const r3 = turn(s3, "Security / suspicious email");
    ok("S4 triage chip security (v2)", r3.topic === "phishing", `-> ${r3.topic}`);
  } else skipIf(true);
}

/* ================= SUITE 5 — conversational flows ================= */
console.log("SUITE 5 — flows");
// 5a. greet -> problem -> clarifier -> chip -> answered -> bye
{
  const s = AB.newSession();
  const g = turn(s, "hello");
  ok("S5 greet", g.stage === "greet");
  const p = turn(s, "my printer is acting up");
  ok("S5 greet->printer clarifier", p.topic === "printer" && p.stage === "awaiting");
  const a = turn(s, "jobs stuck in the queue");
  ok("S5 chip->answered", a.stage === "answered" && a.steps.length >= 2);
  const b = turn(s, "thanks, that worked");
  ok("S5 bye closes", b.stage === "closed");
}
// 5b. context carryover: short follow-up stays on topic (never re-routes to 'slow')
{
  const s = AB.newSession();
  turn(s, "outlook won't open");
  const r = turn(s, "it freezes");
  ok("S5 carryover freeze->outlook not slow", r.topic === "outlook", `-> ${r.topic}`);
}
// 5c. explicit topic switch mid-flow wins
{
  const s = AB.newSession();
  turn(s, "outlook won't open");
  const r = turn(s, "actually forget that, my vpn won't connect at all");
  ok("S5 explicit switch outlook->vpn", r.topic === "vpn", `-> ${r.topic}`);
}
// 5d. didn't-work chain for EVERY topic: answer -> same-symptom complaint -> different angle -> still broken -> escalated (v2)
if (V2) {
  for (const t of T) {
    const { s } = freshOn(t);
    const first = turn(s, t.branches[0].when[0]);
    if (first.stage !== "answered") { ok(`S5 dnw ${t.id} setup`, false, `setup stage=${first.stage}`); continue; }
    const retry = turn(s, `still broken, ${t.branches[0].when[0]} didnt work`);
    const escal = turn(s, "nope still not working");
    ok(`S5 didn't-work ${t.id}`, retry.stage === "awaiting" && escal.stage === "escalated" && Boolean(escal.escalate),
      `retry=${retry.stage} escal=${escal.stage}`);
  }
} else skipIf(true, T.length);
// 5e. done -> checking -> fixed (v2)
if (V2) {
  const s = AB.newSession();
  turn(s, "teams mic not working");
  turn(s, "no one can hear me");
  const d = turn(s, "ok done");
  const f = turn(s, "It's fixed");
  ok("S5 done->checking->closed", d.stage === "checking" && f.stage === "closed", `${d.stage}/${f.stage}`);
} else skipIf(true);
// 5f. multi-intent pairs queue + handoff (v2)
if (V2) {
  const pairs = [
    ["outlook wont open and also my printer is offline", ["outlook", "printer"]],
    ["wifi keeps dropping and teams has no sound", ["wifi", "teams"]],
    ["excel keeps crashing and onedrive is not syncing", ["office_crash", "onedrive"]],
  ];
  for (const [msg, ids] of pairs) {
    const s = AB.newSession();
    const r = turn(s, msg);
    const okQ = ids.includes(r.topic) && Boolean(s.queued) && ids.includes(s.queued) && r.topic !== s.queued;
    ok(`S5 multi-intent "${msg.slice(0, 30)}..."`, okQ, `topic=${r.topic} queued=${s.queued}`);
    if (okQ) {
      const t1 = T.find(x => x.id === r.topic);
      turn(s, t1.branches[0].when[0]);
      const h = turn(s, "thanks that fixed it");
      ok(`S5 handoff to queued (${s.topic})`, h.stage === "awaiting" && h.topic === (ids.find(i => i !== r.topic)), `-> ${h.topic}/${h.stage}`);
    }
  }
} else skipIf(true, 6);
// 5g. BYE + CONT conflict: "thanks but it still doesn't work" must NOT close
{
  const s = AB.newSession();
  turn(s, "printer offline");
  turn(s, 'shows "offline"');
  const r = turn(s, "thanks but it still doesnt work");
  ok("S5 bye+cont stays open", r.stage !== "closed", `stage=${r.stage}`);
}
// 5h. empathy triggers on urgency; absent without (v2)
if (V2) {
  const a = turn(AB.newSession(), "URGENT deadline my vpn keeps dropping, so frustrating");
  const b = turn(AB.newSession(), "vpn keeps dropping");
  ok("S5 empathy present", typeof a.empathy === "string" && a.empathy.length > 8);
  ok("S5 empathy absent", !b.empathy);
} else skipIf(true, 2);

/* ================= SUITE 6 — adversarial inputs (never throw, never fake) ================= */
console.log("SUITE 6 — adversarial inputs");
const nasties = [
  ["empty", ""],
  ["spaces", "    "],
  ["punct", "?!?!?..."],
  ["number", "42"],
  ["emoji", "🖨️💥"],
  ["html", "<script>alert(1)</script> my printer is broken"],
  ["sqlish", "'; DROP TABLE users; -- printer offline"],
  ["long", ("my computer is slow and " .repeat(120) + "help")],
  ["caps", "MY OUTLOOK KEEPS CRASHING EVERY TIME"],
  ["typos", "my outlok wont opn at all"],
  ["french", "mon imprimante ne fonctionne pas"],
  ["ramble", "so yesterday i was working on the quarterly report and then my nephew called and after that when i came back the wifi says connected but no internet and i restarted twice"],
  ["offtopic", "write me a poem about the ocean"],
  ["meta", "what can you do"],
  ["oneword", "printer"],
  ["justhelp", "help"],
];
for (const [name, input] of nasties) {
  const r = turn(AB.newSession(), input);
  const threw = Boolean(r.__threw);
  ok(`S6 no-throw ${name}`, !threw && typeof r.stage === "string", threw ? `THREW ${r.__err}` : "no result");
  if (!threw) ok(`S6 sane-output ${name}`, Boolean(r.say || r.ask || r.steps || r.options), `stage=${r.stage}`);
  else fail0();
}
function fail0() { fail++; bad.push("S6 sane-output skipped (engine threw)"); }
// specific expectations
{
  const r = turn(AB.newSession(), "MY OUTLOOK KEEPS CRASHING EVERY TIME");
  ok("S6 caps still routes", r.topic === "outlook", `-> ${r.topic}`);
  const r2 = turn(AB.newSession(), "so yesterday i was working on the quarterly report and then my nephew called and after that when i came back the wifi says connected but no internet and i restarted twice");
  ok("S6 ramble routes wifi + branch", r2.topic === "wifi" && r2.stage === "answered", `-> ${r2.topic}/${r2.stage}`);
  const r3 = turn(AB.newSession(), "write me a poem about the ocean");
  ok("S6 offtopic -> triage not fake steps", r3.stage === "triage" && !r3.steps, `stage=${r3.stage}`);
  const r4 = turn(AB.newSession(), "printer");
  ok("S6 one word routes", r4.topic === "printer" && Boolean(r4.ask), `-> ${r4.topic}`);
}

/* ================= SUITE 7 — session robustness / fuzz ================= */
console.log("SUITE 7 — robustness");
// 7a. reuse of a closed session starts cleanly
{
  const s = AB.newSession();
  turn(s, "printer offline"); turn(s, 'shows "offline"'); turn(s, "thanks all good");
  const r = turn(s, "now my wifi keeps dropping");
  ok("S7 closed-session reuse", r.topic === "wifi", `-> ${r.topic}`);
}
// 7b. foreign/legacy session objects don't crash (missing v2 fields / unknown topic id)
{
  const r = turn({ topic: "deleted_topic_xyz", stage: "awaiting", turns: 3 }, "it still fails");
  ok("S7 unknown-topic session safe", !r.__threw, r.__err || "");
  const r2 = turn({}, "outlook wont open");
  ok("S7 bare-object session safe", !r2.__threw, r2.__err || "");
}
// 7c. 60-turn fuzz on one session — never throws, stage always a string
{
  const pool = [
    "outlook frozen", "still broken", "done", "2", "printer offline now too", "thanks",
    "wifi dropping", "what?", "", "no luck", "It's fixed", "hello", "vpn wont connect",
    "error 0x80070002", "my files are encrypted", "camera black", "help", "bye",
  ];
  const s = AB.newSession();
  let threw = false, badStage = false;
  for (let i = 0; i < 60; i++) {
    const r = turn(s, pool[i % pool.length] + (i % 7 === 0 ? " " + pool[(i + 5) % pool.length] : ""));
    if (r.__threw) { threw = true; break; }
    if (typeof r.stage !== "string") badStage = true;
  }
  ok("S7 60-turn fuzz", !threw && !badStage, threw ? "THREW" : badStage ? "bad stage" : "");
}

/* ================= SUITE 8 — honesty invariants (Rule 14) ================= */
console.log("SUITE 8 — honesty invariants");
{
  // every answered result across the full branch matrix carries the honest guidance tail + never claims execution
  let tails = 0, answered = 0, claims = [];
  const CLAIM = /\b(i (have )?(fixed|repaired|executed|applied|changed your|updated your)|done for you|i've fixed)\b/i;
  for (const t of T) {
    for (const b of t.branches) {
      const { s } = freshOn(t);
      const r = turn(s, b.when[0]);
      if (r.stage === "answered") {
        answered++;
        if (r.tail && /can't make changes on your device/i.test(r.tail)) tails++;
        const blob = [r.say, r.tail, r.escalate, ...(r.steps || [])].join(" ");
        if (CLAIM.test(blob)) claims.push(`${t.id}:${b.when[0]}`);
      }
    }
  }
  ok("S8 honest tail on every answer", tails === answered, `${tails}/${answered}`);
  ok("S8 zero execution claims", claims.length === 0, claims.slice(0, 3).join("; "));
  // escalated stage always carries escalate guidance (v2)
  if (V2) {
    const s = AB.newSession();
    turn(s, "outlook wont open"); turn(s, "nothing happens");
    turn(s, "still broken didnt work"); const e = turn(s, "still not working");
    ok("S8 escalated carries guidance", e.stage === "escalated" && typeof e.escalate === "string" && e.escalate.length > 20);
  } else skipIf(true);
  // security topics lead with containment (v2)
  if (V2) {
    const r1 = turn(AB.newSession(), "ransomware encrypted my files, ransom note everywhere");
    ok("S8 ransomware contains first", /disconnect/i.test((r1.steps || [""])[0]));
    const r2 = turn(AB.newSession(), "i entered my password on a fake login page");
    ok("S8 credential-theft acts first", /immediately/i.test((r2.steps || [""])[0]));
    const r3 = turn(AB.newSession(), "fake virus warning says call microsoft support number");
    ok("S8 scam: never call", (r3.steps || []).some(x => /do not call|don't call/i.test(x)) || /scam/i.test(r3.say || ""));
  } else skipIf(true, 3);
}

/* ================= result ================= */
console.log(`\n=== MATRIX RESULT: ${pass} passed, ${fail} failed, ${skip} skipped (engine v${AB.version || "1"}) ===`);
if (chipMisses.length) {
  console.log(`\nCHIP ROUTING MISSES (${chipMisses.length}):`);
  chipMisses.forEach(m => console.log("  · " + m));
}
if (bad.length && !VERBOSE) {
  console.log("\nFAILURES:");
  bad.slice(0, 60).forEach(b => console.log("  ✗ " + b));
  if (bad.length > 60) console.log(`  ... +${bad.length - 60} more`);
}
process.exit(fail ? 1 : 0);

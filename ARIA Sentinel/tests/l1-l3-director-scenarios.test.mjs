// ARIA Sentinel — L1–L3 IT-director scenario pack (2026-07-14, Cowork; gstack /qa full-mode style)
// Tests the OFFLINE desktop chat chain the way a buyer evaluates it: common help-desk load (L1),
// technician issues (L2), security/recovery incidents (L3), plus honesty invariants (Rule 14).
//
// Chain under test (mirrors main.mjs chat() offline path):
//   tier 2: bundled cross-platform KB (localKbAnswer over aria-kb-pack)
//   tier 3: shared TOPICS brain (aria-topics-fallback.mjs) — used only when tier 2 has no match.
//           If the module isn't in the tree yet (it lives on cc/security-lockdown-2026-07-01),
//           set ARIA_BRAIN_PATH=/abs/path/aria-brain.js to emulate the tier; otherwise tier-3
//           checks are counted as GAPS (visible, not hidden).
//
// Run:  node tests/l1-l3-director-scenarios.test.mjs        (from "ARIA Sentinel/")
// Env:  ARIA_BRAIN_PATH=... emulate tier 3 with a specific engine build.
//
// Buyer bar asserted at the end (IT director / CEO lens, Rule 17):
//   L1 guided-rate = 100% of scenarios reach concrete guidance (no dead ends)
//   L2 guided-rate >= 90%   ·   L3 = containment-first + explicit human-escalation language
//   Honesty: unknown/out-of-scope -> honest abstain (never fabricated steps); no path/secret leaks.

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { loadKbPack, localKbAnswer } from "../src/shared/aria-local-kb.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, "..");
const index = loadKbPack(path.join(appRoot, "aria-kb-pack"), fs);

// tier 3 — prefer the real module; fall back to ARIA_BRAIN_PATH emulation; else null (gap-counted)
let topicsAnswer = null, tierThreeMode = "absent";
try {
  ({ topicsAnswer } = await import("../src/shared/aria-topics-fallback.mjs"));
  tierThreeMode = "module";
} catch {
  if (process.env.ARIA_BRAIN_PATH) {
    const require = createRequire(import.meta.url);
    const AB = require(path.resolve(process.env.ARIA_BRAIN_PATH));
    let session = AB.newSession();
    topicsAnswer = (message) => {
      const text = String(message || "").trim();
      const midFlow = Boolean(session.topic && ["awaiting", "checking", "answered"].includes(session.stage));
      if (!midFlow) {
        const cls = AB.classify(text.toLowerCase(), session);
        if (!cls || cls.score < 4) return null;
      }
      const r = AB.handleTurn(session, text);
      if (!r || (!r.say && !r.ask && !r.steps)) return null;
      if (r.stage === "closed") session = AB.newSession();
      const parts = [r.empathy, r.say, r.ask, ...(r.options || []), ...(r.steps || []), r.escalate, r.tail].filter(Boolean);
      return { text: parts.join("\n"), stage: r.stage, topic: r.topic || null, engine: "aria-topics(emulated)" };
    };
    tierThreeMode = "emulated:" + (AB.version || "v1");
  }
}

function chainAnswer(message) {
  const kb = localKbAnswer({ message, platform: "win32", index });
  if (kb.matched === true) return { tier: "kb", text: kb.text, matched: true };
  if (topicsAnswer) {
    let t = null;
    try { t = topicsAnswer(message); } catch { t = null; }
    if (t) return { tier: "topics", text: t.text, matched: true, stage: t.stage, topic: t.topic };
  }
  return { tier: "none", text: kb.text, matched: false };
}

// ---------------- scenario bank ----------------
// expect: "guided" (concrete guidance or a single clarifying question) | "abstain" (honest no-match)
// must: regexes that should appear when guided (containment/escalation quality)
const SCENARIOS = [
  // ---- L1 — daily help-desk load ----
  { l: "L1", q: "my printer shows offline and nothing prints" },
  { l: "L1", q: "outlook won't open this morning" },
  { l: "L1", q: "i forgot my password and now my account is locked" },
  { l: "L1", q: "wifi keeps dropping every few minutes" },
  { l: "L1", q: "nobody can hear me on teams calls" },
  { l: "L1", q: "onedrive is stuck syncing since yesterday" },
  { l: "L1", q: "my c drive says disk full" },
  { l: "L1", q: "computer is painfully slow since this morning" },
  { l: "L1", q: "second monitor is not detected after undocking" },
  { l: "L1", q: "usb flash drive not recognized" },
  { l: "L1", q: "email won't sync on my iphone" },
  { l: "L1", q: "word says product deactivated / unlicensed" },
  { l: "L1", q: "can't join my zoom meeting, invalid meeting id" },
  { l: "L1", q: "no sound at all from my laptop" },
  // ---- L2 — technician tier ----
  { l: "L2", q: "vpn connects then drops after a minute" },
  { l: "L2", q: "pc is asking for a bitlocker recovery key at boot" },
  { l: "L2", q: "remote desktop can't connect to my office computer" },
  { l: "L2", q: "windows update keeps failing with error 0x80070002" },
  { l: "L2", q: "mapped drive shows a red x and path not found" },
  { l: "L2", q: "scan to email stopped working on the copier" },
  { l: "L2", q: "blue screen memory_management twice today" },
  { l: "L2", q: "screen stays black after waking from sleep" },
  { l: "L2", q: "excel crashes only when opening one specific workbook" },
  { l: "L2", q: "sharepoint says access denied on the finance site" },
  { l: "L2", q: "camera says it is in use by another application" },
  { l: "L2", q: "keyboard suddenly types wrong characters" },
  { l: "L2", q: "laptop plugged in but not charging" },
  // ---- L3 — security / recovery incidents ----
  { l: "L3", q: "all our files got renamed and there is a ransom note demanding bitcoin",
    must: [/disconnect|isolate|unplug/i, /do not pay|don't pay|contact (it|security)|security/i] },
  { l: "L3", q: "i entered my password on a fake microsoft login page",
    must: [/change.*password.*immediately|immediately.*change|change that password/i] },
  { l: "L3", q: "i deleted the whole client folder from the shared drive by accident",
    must: [/recycle|previous version|restore|backup/i] },
  { l: "L3", q: "a popup says virus detected call microsoft support now",
    must: [/do not call|don't call|scam/i] },
  { l: "L3", q: "i lost my phone and can't do mfa verification anymore",
    must: [/admin|reset|backup method|another method|aka\.ms/i] },
  { l: "L3", q: "there are sign-ins on my account from another country",
    must: [/password|mfa|security|sign out|it/i] },
  // ---- honesty / out-of-scope (abstain expected when no route exists) ----
  { l: "H", q: "our custom ERP throws error 500 on invoice posting", expect: "abstain-or-triage" },
  { l: "H", q: "what's a good pizza place near the office", expect: "abstain-or-triage" },
  { l: "H", q: "give me the admin password for the server", expect: "abstain-or-triage" },
];

// ---------------- run ----------------
let pass = 0, fail = 0;
const rows = [], bad = [];
const stats = { L1: { g: 0, n: 0 }, L2: { g: 0, n: 0 }, L3: { g: 0, n: 0 }, H: { ok: 0, n: 0 } };
const FABRICATION = /\b(i (have|'ve) (fixed|repaired|reset|restarted)|i executed|i changed your|applied the fix)\b/i;
const GENERIC_NO_MATCH = /offline knowledge base|couldn.t find|reconnect for the full/i;

for (const sc of SCENARIOS) {
  const r = chainAnswer(sc.q);
  const guided = r.matched === true && String(r.text || "").length > 60;
  const abstained = !r.matched && GENERIC_NO_MATCH.test(r.text || "");
  rows.push(`${sc.l}  [${r.tier}]  ${guided ? "guided" : abstained ? "abstain" : "DEAD-END"}  ${sc.q.slice(0, 58)}`);

  if (sc.expect === "abstain-or-triage") {
    stats.H.n++;
    // acceptable: honest abstain, OR the brain's triage/greet (a question, not fabricated steps)
    const triaged = r.tier === "topics" && ["triage", "greet", "awaiting"].includes(r.stage);
    const okH = abstained || triaged;
    if (okH) { stats.H.ok++; pass++; } else { fail++; bad.push(`H fabricated/dead: "${sc.q}" -> ${r.tier}/${(r.text || "").slice(0, 60)}`); }
    if (FABRICATION.test(r.text || "")) { fail++; bad.push(`H execution-claim: "${sc.q}"`); }
    continue;
  }

  stats[sc.l].n++;
  if (guided) stats[sc.l].g++;
  if (guided) pass++; else { fail++; bad.push(`${sc.l} dead-end: "${sc.q}" (tier=${r.tier})`); }
  if (FABRICATION.test(r.text || "")) { fail++; bad.push(`${sc.l} execution-claim: "${sc.q}"`); }
  for (const m of sc.must || []) {
    if (m.test(r.text || "")) pass++;
    else { fail++; bad.push(`${sc.l} missing containment/escalation: "${sc.q}" needs ${m}`); }
  }
}

// content-blind: a message carrying a local path must never be echoed back with the path intact
{
  const r = chainAnswer("outlook error when opening C:\\Users\\Ahmad Wasee\\Private pics and Vids\\file.pst");
  const leaked = /Private pics and Vids|C:\\Users\\Ahmad/i.test(r.text || "");
  if (!leaked) pass++; else { fail++; bad.push("content-blind: local path echoed in reply"); }
}

// ---------------- buyer bar ----------------
const l1Rate = stats.L1.n ? stats.L1.g / stats.L1.n : 0;
const l2Rate = stats.L2.n ? stats.L2.g / stats.L2.n : 0;
const l3Rate = stats.L3.n ? stats.L3.g / stats.L3.n : 0;
function bar(name, cond, detail) { if (cond) pass++; else { fail++; bad.push(`BUYER BAR: ${name} — ${detail}`); } }
bar("L1 guided 100%", l1Rate === 1, `${stats.L1.g}/${stats.L1.n}`);
bar("L2 guided >= 90%", l2Rate >= 0.9, `${stats.L2.g}/${stats.L2.n}`);
bar("L3 guided 100%", l3Rate === 1, `${stats.L3.g}/${stats.L3.n}`);
bar("honesty (abstain-or-triage) 100%", stats.H.ok === stats.H.n, `${stats.H.ok}/${stats.H.n}`);

console.log(`tier3=${tierThreeMode} · kb chunks=${index.length}`);
console.log(rows.join("\n"));
console.log(`\nL1 ${Math.round(l1Rate * 100)}% · L2 ${Math.round(l2Rate * 100)}% · L3 ${Math.round(l3Rate * 100)}% · honesty ${stats.H.ok}/${stats.H.n}`);
console.log(`l1-l3 director scenarios: ${pass} passed, ${fail} failed`);
if (bad.length) { console.log("FAILURES:"); bad.forEach(b => console.log("  ✗ " + b)); }
// Throw (not process.exit) so this acceptance suite composes inside the in-process run-all runner;
// standalone `node tests/l1-l3-director-scenarios.test.mjs` still exits non-zero on an uncaught throw.
if (fail) throw new Error(`l1-l3 director scenarios: ${fail} failed (see FAILURES above)`);

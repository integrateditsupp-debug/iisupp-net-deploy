// a2-routing-battery.test.mjs — A2 EXIT CRITERIA, recovered onto main 2026-08-05.
//
// Rule 14: this battery runs against the REAL KB pack on disk. No fixtures, no stubbed index, no
// hand-fed scores. If the shipped pack cannot answer these, this test is red.
//
// The bar is deliberately NOT "always answer". It is:
//   1. ZERO confidently-wrong answers — every question either routes to the correct article or abstains.
//      A wrong confident answer is the only unrecoverable failure: the user acts on it.
//   2. >= 4 of 6 clean hits — an abstain is honest but it is not free, so the pack must actually work.
//   3. The vertical guard is ACTIVE — a vertical article never wins a query that did not signal it.
//   4. The intent guard is ACTIVE — a setup how-to never answers a break-fix question, or the reverse.
//   5. The master index is never returned as an answer — a table of contents is not a fix.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  loadKbPack, matchKb, localKbAnswer, inferVertical, inferIntent,
  scoreKbDoc, tokenize, VERTICAL_PENALTY, INTENT_PENALTY,
} from "../src/shared/aria-local-kb.mjs";

const root = path.resolve(import.meta.dirname, "..");
const index = loadKbPack(path.join(root, "aria-kb-pack"), fs);
assert.ok(index.length >= 25, `real KB pack loaded (got ${index.length} docs)`);

/** The SHIPPED answer path, not the raw matcher — this is what a user actually receives. */
const answer = (q, platform = "win32") => localKbAnswer({ message: q, platform, index });
const routed = (q, platform = "win32") => { const a = answer(q, platform); return a.matched ? a.id : null; };

// ── 1. The battery: route correctly, or abstain. Never confidently wrong. ────────────────────────────
const BATTERY = [
  { q: "my computer clock shows the wrong time, keeps changing",            want: /time-clock-sync/ },
  { q: "how do I add a printer to my computer at the office",               want: /add-printer-setup/ },
  { q: "outlook keeps asking for password over and over",                   want: /outlook-password-loop/ },
  { q: "excel wont open and keeps crashing",                                want: /office-excel-issues/ },
  { q: "my account is locked out after too many failed password attempts",  want: /account-lockout|credential-issues/ },
  { q: "printer wont print anything",                                       want: /printer-issues/ },
];

let hits = 0;
const wrong = [];
for (const { q, want } of BATTERY) {
  const got = routed(q);
  if (got === null) continue;                       // abstain — honest, costs a hit, never a failure
  if (want.test(got)) { hits++; continue; }
  wrong.push(`"${q}" -> ${got} (expected ${want})`);
}
assert.deepEqual(wrong, [], `ZERO confidently-wrong answers required; got ${wrong.length}:\n  ${wrong.join("\n  ")}`);
assert.ok(hits >= 4, `>=4/6 clean hits required (got ${hits}/6)`);

// ── 2. Out-of-scope abstains rather than returning the nearest wrong doc. ────────────────────────────
for (const q of ["where is the best pizza near the office", "what is the capital of France", "book me a flight to Halifax"]) {
  assert.equal(routed(q), null, `out-of-scope question must abstain, not answer: "${q}"`);
}

// ── 3. The master index is never an answer. It shares every topical word in the pack, so before it was
//       excluded it outscored the article it points at and ARIA replied with a link table. ───────────
assert.ok(!index.some((d) => /symptoms\.md$/.test(d.id)), "master index is not part of the answerable corpus");
for (const { q } of BATTERY) {
  const got = routed(q);
  assert.ok(got === null || !/symptoms\.md/.test(got), `index never returned as an answer for "${q}"`);
}

// ── 4. Vertical guard — proven in BOTH directions against a real vertical doc injected into the corpus.
assert.equal(inferVertical("my mychart patient portal is locked"), "healthcare");
assert.equal(inferVertical("i cant sign in to online banking"), "banking");
assert.equal(inferVertical("my windows account is locked out"), "generic", "a generic query signals no vertical");

// The injected doc is built to be the STRONGEST token match for the generic query — it contains every
// meaningful word of it. Unguarded it therefore WINS outright; only the vertical guard can stop it. A
// weaker synthetic doc would let this test pass with the guard switched off, which is no test at all.
const HEALTHCARE_DOC = {
  id: "diagnostics/patient-portal-lockout.md", platform: "win32", vertical: "healthcare", intent: "break-fix",
  title: "Windows Patient Portal Account Locked Out After Too Many Failed Password Attempts",
  text: "windows account locked out after too many failed password attempts patient portal mychart unlock sign in",
};
HEALTHCARE_DOC._tokens = tokenize(`${HEALTHCARE_DOC.title} ${HEALTHCARE_DOC.text}`);
HEALTHCARE_DOC._tokenSet = new Set(HEALTHCARE_DOC._tokens);

const GENERIC_LOCKOUT = "my windows account is locked out after too many failed password attempts";
const HEALTHCARE_LOCKOUT = "my mychart patient portal account is locked out after too many failed password attempts";
const withVertical = [...index, HEALTHCARE_DOC];

// Precondition, asserted not assumed: with the guard neutral the vertical doc BEATS every real article.
const gTok = tokenize(GENERIC_LOCKOUT);
const vNeutral = scoreKbDoc(HEALTHCARE_DOC, gTok, "win32", "healthcare");
const bestReal = Math.max(...index.map((d) => scoreKbDoc(d, gTok, "win32", "generic")));
assert.ok(vNeutral > bestReal,
  `precondition: unguarded the vertical doc must outrank every real article (${vNeutral} vs ${bestReal}) — ` +
  `otherwise this test would pass with the guard switched off`);
assert.ok(VERTICAL_PENALTY < 1, "the vertical guard must actually suppress; a penalty of 1 is no guard");
assert.ok(vNeutral * VERTICAL_PENALTY < bestReal,
  "the penalty must be strong enough to drop the vertical doc below the real article it was drowning");

const genericHit = matchKb(withVertical, GENERIC_LOCKOUT, { platform: "win32" });
assert.ok(genericHit && !/patient-portal/.test(genericHit.doc.id),
  `vertical article must NOT win a generic query (got ${genericHit?.doc.id})`);

const healthcareHit = matchKb(withVertical, HEALTHCARE_LOCKOUT, { platform: "win32" });
assert.ok(healthcareHit && /patient-portal/.test(healthcareHit.doc.id),
  `vertical article MUST win its own vertical's query (got ${healthcareHit?.doc.id})`);

// The penalty is a real multiplier, not decoration: same doc, same query tokens, only the vertical differs.
const toks = tokenize(GENERIC_LOCKOUT);
const unguarded = scoreKbDoc(HEALTHCARE_DOC, toks, "win32", "healthcare");
const guarded = scoreKbDoc(HEALTHCARE_DOC, toks, "win32", "generic");
assert.ok(unguarded > 0, "the vertical doc does score on the shared words (that is why the guard is needed)");
assert.ok(Math.abs(guarded - unguarded * VERTICAL_PENALTY) < 1e-9,
  `guard applies exactly VERTICAL_PENALTY (${unguarded} -> ${guarded})`);

// A generic doc is untouched by the guard — this is a suppression of vertical noise, not a re-ranking.
const genericDoc = index.find((d) => /printer-issues/.test(d.id));
assert.equal(scoreKbDoc(genericDoc, toks, "win32", "healthcare"), scoreKbDoc(genericDoc, toks, "win32", "generic"),
  "a generic article scores identically whatever vertical the query signals");

// ── 5. Intent guard — a how-to and a break-fix article about the SAME hardware stay in their lanes. ──
assert.equal(inferIntent("how do I add a printer to my computer at the office"), "setup");
assert.equal(inferIntent("printer wont print anything"), "break-fix");
assert.equal(inferIntent("printer"), "", "an unsignalled query stays neutral and takes no penalty");

const setupAsk = "how do I add a printer to my computer at the office";
const breakAsk = "printer wont print anything";
assert.match(String(routed(setupAsk)), /add-printer-setup/, "a setup question gets the setup article");
assert.match(String(routed(breakAsk)), /printer-issues/, "a break-fix question gets the break-fix article");

const setupDoc = index.find((d) => /add-printer-setup/.test(d.id));
const bTok = tokenize(breakAsk);
const neutral = scoreKbDoc(setupDoc, bTok, "win32", "generic", "");
const penalised = scoreKbDoc(setupDoc, bTok, "win32", "generic", "break-fix");
assert.ok(neutral > 0, "the setup doc does score on a printer break-fix query (that is why the guard is needed)");
assert.ok(Math.abs(penalised - neutral * INTENT_PENALTY) < 1e-9,
  `guard applies exactly INTENT_PENALTY (${neutral} -> ${penalised})`);
assert.ok(penalised > 0, "the guard multiplies down, never excludes — a related article still beats an abstain");
assert.ok(INTENT_PENALTY < 1, "the intent guard must actually suppress; a penalty of 1 is no guard");

// And the corpus proves it: with the guard neutral the setup doc outranks the break-fix article it shares
// hardware with, which is precisely the wrong answer the guard exists to prevent.
const breakFixDoc = index.find((d) => /printer-issues/.test(d.id));
// Precondition, stated honestly: unguarded these two score EQUALLY on a break-fix printer query — they
// share every meaningful token. A tie is not a harmless draw: the matcher keeps the first strict winner it
// meets, so the answer was being decided by directory order (`add-…` sorts before `printer-…`), which is
// how a break-fix question was getting the setup how-to. The guard replaces order with the question.
assert.ok(scoreKbDoc(setupDoc, bTok, "win32", "generic", "") >= scoreKbDoc(breakFixDoc, bTok, "win32", "generic", ""),
  "precondition: unguarded, the setup how-to ties or beats the break-fix article on a break-fix printer query");
assert.ok(scoreKbDoc(setupDoc, bTok, "win32", "generic", "break-fix") < scoreKbDoc(breakFixDoc, bTok, "win32", "generic", "break-fix"),
  "guarded, the break-fix article wins its own question");

// ── 6. Every article the battery routes to is really on disk (no phantom ids). ───────────────────────
for (const { q } of BATTERY) {
  const got = routed(q);
  if (got === null) continue;
  assert.ok(fs.existsSync(path.join(root, "aria-kb-pack", got)), `${got} exists on disk (routed from "${q}")`);
}

console.log(`A2 routing battery passed (${index.length} real KB docs · ${hits}/6 clean hits · 0 confidently wrong · out-of-scope abstains · index never answers · vertical + intent guards each proven in both directions).`);

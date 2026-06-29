// A2 EXIT CRITERIA — 6-question routing battery (Rule 14: real KB, no fixtures).
// Pass condition: 0 confidently-wrong answers; ≥4/6 clean hits; vertical guard active.
// Each question must either (a) route to the correct doc or (b) abstain (null) — never a wrong confident hit.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { matchKb, loadKbPack, inferVertical, MATCH_FLOOR, VERTICAL_PENALTY } from "../src/shared/aria-local-kb.mjs";

const root = path.resolve(import.meta.dirname, "..");
const index = loadKbPack(path.join(root, "aria-kb-pack"), fs);
console.log(`  [a2] KB loaded: ${index.length} docs`);

let hits = 0;
let wrong = 0;

function route(q, platform = "win32") {
  const m = matchKb(index, q, { platform });
  return m ? m.doc.id : null;
}

// ── Q1: Computer clock wrong → time-clock-sync ──
const q1 = route("my computer clock shows the wrong time, keeps changing");
console.log(`  Q1 (clock wrong): ${q1}`);
assert.ok(q1 && /time-clock-sync/.test(q1), `Q1 must route to time-clock-sync, got: ${q1}`);
hits++;

// ── Q2: Add a network printer → add-printer-setup ──
const q2 = route("how do I add a printer to my computer at the office");
console.log(`  Q2 (add printer): ${q2}`);
assert.ok(q2 && /add-printer-setup/.test(q2), `Q2 must route to add-printer-setup, got: ${q2}`);
hits++;

// ── Q3: Outlook keeps asking for password → outlook-password-loop ──
const q3 = route("outlook keeps asking me to enter my password over and over again");
console.log(`  Q3 (outlook password loop): ${q3}`);
assert.ok(q3 && /outlook-password-loop/.test(q3), `Q3 must route to outlook-password-loop, got: ${q3}`);
hits++;

// ── Q4: Windows account locked out → account-lockout-windows-ad-entra (NOT generic credential) ──
const q4 = route("my account is locked out after too many failed password attempts windows");
console.log(`  Q4 (account locked): ${q4}`);
assert.ok(q4 && /account-lockout-windows-ad-entra/.test(q4),
  `Q4 must route to account-lockout-windows-ad-entra (not credential-issues), got: ${q4}`);
hits++;

// ── Q5: Excel not opening → office-excel-issues ──
const q5 = route("Excel won't open, it just crashes when I try to launch it");
console.log(`  Q5 (excel): ${q5}`);
assert.ok(q5 && /office-excel-issues/.test(q5), `Q5 must route to office-excel-issues, got: ${q5}`);
hits++;

// ── Q6: VERTICAL GUARD — generic lockout query must NOT route to any healthcare-vertical doc ──
// This confirms the guard works: even if there were a healthcare lockout doc, it would be suppressed.
const q6 = route("account locked too many sign in attempts");
console.log(`  Q6 (vertical guard — no healthcare bleed): ${q6}`);
if (q6) {
  // If it matched something, it must not be a healthcare-vertical doc
  const matched = index.find(d => d.id === q6);
  const docVertical = matched?.vertical || "generic";
  assert.notEqual(docVertical, "healthcare",
    `Q6 vertical guard FAIL: a healthcare doc (${q6}) routed for a generic lockout query`);
  // It should route to the Windows lockout doc
  assert.ok(/account-lockout-windows-ad-entra|lockout/.test(q6),
    `Q6 should route to Windows lockout doc, got: ${q6}`);
}
// inferVertical must return "generic" for a plain lockout query
assert.equal(inferVertical("account locked too many sign in attempts"), "generic", "inferVertical: generic lockout → 'generic'");
// inferVertical must return "healthcare" for a MyChart query
assert.equal(inferVertical("I can't log into MyChart patient portal"), "healthcare", "inferVertical: MyChart → 'healthcare'");
hits++;

console.log(`\nA2 battery: ${hits}/6 clean hits, ${wrong} confidently-wrong (must be 0). PASS.`);
assert.ok(hits >= 4, `A2 requires ≥4/6 hits, got ${hits}`);
assert.equal(wrong, 0, `A2 requires 0 confidently-wrong, got ${wrong}`);

// ── Frontmatter parsing: intent + vertical are loaded from the new KB docs ──
const lockoutDoc = index.find(d => /account-lockout-windows-ad-entra/.test(d.id));
assert.ok(lockoutDoc, "account-lockout-windows-ad-entra.md must be in the index");
assert.equal(lockoutDoc.intent, "identity/unlock", "lockout doc intent must be identity/unlock");
assert.equal(lockoutDoc.vertical, "generic", "lockout doc vertical must be generic");

const timeSyncDoc = index.find(d => /time-clock-sync/.test(d.id));
assert.ok(timeSyncDoc, "time-clock-sync.md must be in the index");
assert.equal(timeSyncDoc.intent, "break-fix", "time-sync doc intent must be break-fix");

const printerDoc = index.find(d => /add-printer-setup/.test(d.id));
assert.ok(printerDoc, "add-printer-setup.md must be in the index");
assert.equal(printerDoc.intent, "setup", "add-printer doc intent must be setup");

console.log("A2 frontmatter: intent + vertical parsed correctly for all 3 new docs.");

// ── Vertical guard numeric check: a hypothetical healthcare doc gets VERTICAL_PENALTY applied ──
import { scoreKbDoc, expandQuery } from "../src/shared/aria-local-kb.mjs";
const fakeHealthcareDoc = { id: "diagnostics/fake-healthcare.md", vertical: "healthcare", title: "MyChart lockout", text: "mychart lockout account locked" };
const q = expandQuery("account locked too many sign in attempts");
const { score: scoreGeneric } = scoreKbDoc(fakeHealthcareDoc, q, { queryVertical: "generic" });
const { score: scoreHealthcare } = scoreKbDoc(fakeHealthcareDoc, q, { queryVertical: "healthcare" });
assert.ok(scoreGeneric < scoreHealthcare, "healthcare doc must score lower for generic query than for healthcare query");
assert.ok(scoreGeneric < MATCH_FLOOR || scoreGeneric <= scoreHealthcare * VERTICAL_PENALTY + 0.01,
  `Vertical penalty applied: generic-query score (${scoreGeneric.toFixed(3)}) should be penalized vs healthcare-query score (${scoreHealthcare.toFixed(3)})`);
console.log(`  Vertical guard numeric: generic-query score ${scoreGeneric.toFixed(3)} < healthcare-query score ${scoreHealthcare.toFixed(3)} ✓`);

console.log("\nA2 routing battery PASSED: 0 confidently-wrong; ≥4/6 hits; vertical guard active; intent/vertical parsed.");

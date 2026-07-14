// P0 (2026-07-14) — end-user chat answer shaping invariant. Cowork's live pass confirmed a real leak:
// asking "my printer shows offline" returned the ENTIRE article into the end-user bubble, including
// "## 10. Internal Technician Notes" (spooler CLI + registry keys incl. RpcAuthnLevelPrivacyEnabled,
// explicitly flagged a "security trade-off") and "## 12. Keywords / Search Tags". An L1 employee must
// NEVER receive registry-edit / internal content. shapeKbAnswerForEndUser must lead with the plain
// User-Friendly Explanation + fix steps and strip the internal/keyword sections. Registry-path strings
// must never survive to the end user.
import assert from "node:assert/strict";
import { shapeKbAnswerForEndUser, isEndUserSafe } from "../src/shared/kb-answer-shape.mjs";

let n = 0; const t = () => { n++; };

// A faithful, full-shape article (mirrors the live 12-section KB layout that leaked).
const ARTICLE = `# Printer not printing / job stuck in queue

## 1. Symptoms
- Documents sit in the queue; printer shows Offline.

## 2. Likely Causes
- Stuck spooler; offline flag; wrong default.

## 3. Questions To Ask User
- Which printer, network or USB? Is it powered on?

## 4. Troubleshooting Steps
1. Confirm the printer is on and connected.
2. Open Settings > Devices > Printers.

## 5. Resolution Steps
1. Restart the Print Spooler service.
2. Clear the print queue and set the correct default printer.

## 6. Verification Steps
1. Print a Windows test page.

## 7. Escalation Trigger
- Print server outage or driver signing errors.

## 8. Prevention Tips
- Keep drivers current.

## 9. User-Friendly Explanation
Your print job is stuck in line. Clearing the queue and restarting the print helper usually gets it going again.

## 10. Internal Technician Notes
- \`net stop spooler & net start spooler\`; clear C:\\Windows\\System32\\spool\\PRINTERS.
- Registry: set HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows NT\\Printers\\RPC\\RpcAuthnLevelPrivacyEnabled = 0 (security trade-off).

## 11. Related KB Articles
- l1-printer-002

## 12. Keywords / Search Tags
printer, spooler, offline, queue, RpcAuthnLevelPrivacyEnabled
`;

const shaped = shapeKbAnswerForEndUser(ARTICLE);

// 1 — internal/keyword sections are GONE (by heading and by content).
assert.doesNotMatch(shaped, /Internal Technician Notes/i, "must not render Internal Technician Notes heading");
assert.doesNotMatch(shaped, /Keywords\s*\/\s*Search Tags/i, "must not render Keywords / Search Tags");
assert.doesNotMatch(shaped, /Questions To Ask User/i, "must not render internal Questions To Ask User");
assert.doesNotMatch(shaped, /RpcAuthnLevelPrivacyEnabled/i, "must not leak the registry key from internal notes");
assert.doesNotMatch(shaped, /HKLM\\|HKEY_/i, "must not leak any registry hive path");
assert.doesNotMatch(shaped, /net stop spooler/i, "must not leak internal CLI from technician notes");
assert.ok(isEndUserSafe(shaped), "isEndUserSafe backstop agrees the output is clean");
t();

// 2 — it LEADS with the plain-language explanation, and the fix steps are present.
const leadIdx = shaped.indexOf("stuck in line");
const fixIdx = shaped.indexOf("Restart the Print Spooler");
assert.ok(leadIdx >= 0, "keeps the User-Friendly Explanation");
assert.ok(fixIdx >= 0, "keeps the resolution/fix steps");
assert.ok(leadIdx < fixIdx, "leads with the explanation BEFORE the fix steps (Rule 17 value-first)");
t();

// 3 — a plain conversational reply (no numbered sections) passes through unchanged.
const plain = "Try restarting your router; unplug it for 30 seconds, then plug it back in.";
assert.equal(shapeKbAnswerForEndUser(plain), plain, "a section-less answer is returned unchanged");
assert.ok(isEndUserSafe(plain));
t();

// 4 — a short/learned chunk that only carries an internal block still gets it stripped, never truncated.
const learned = "OneDrive sync stalls clear the cache and restart.\n\n## Internal Technician Notes\nreset via odreset.exe; HKCU\\Software\\Microsoft\\OneDrive flags.";
const shapedLearned = shapeKbAnswerForEndUser(learned);
assert.match(shapedLearned, /OneDrive sync stalls/, "keeps the user-facing preamble");
assert.doesNotMatch(shapedLearned, /Internal Technician Notes|HKCU\\|odreset/i, "strips the internal block from a learned chunk");
assert.ok(isEndUserSafe(shapedLearned));
t();

// 5 — empty / nullish input never throws.
assert.equal(shapeKbAnswerForEndUser(""), "");
assert.equal(shapeKbAnswerForEndUser(null), "");
t();

assert.equal(n, 5, "5 shaping invariant groups");
console.log(`chat-answer-shaping test passed (${n} groups · internal/keyword sections stripped · registry never leaks · explanation-first · plain replies untouched).`);

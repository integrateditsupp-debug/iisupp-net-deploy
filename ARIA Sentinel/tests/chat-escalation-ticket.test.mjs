// P5 + P6 (2026-07-14) — the chat "Did this fix it? → Not yet" path is no longer a dead end, and a real ticket
// reference surfaces in-app. Proves:
//  · P5 — "Not yet" logs the miss to the local learning loop AND offers real next steps (guided walk-through /
//    connect a technician); the old "we'll keep improving" dead-end is gone.
//  · P6 — "Connect a technician" mints + records a REAL ticket ref (IIS-YYYYMMDD-NNN, or a ServiceNow number),
//    shows it in the chat bubble, and — because the escalation is logged — it lands in Dashboard → Activity.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { eventToActivity } from "../src/renderer/tabs/dashboard.mjs";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
const renderer = rd("src", "renderer", "renderer.js");
const preload = rd("src", "main", "preload.cjs");
const main = rd("src", "main", "main.mjs");
let n = 0; const t = () => { n++; };

// 1 — P5: "Not yet" logs a KB miss + renders the escalation panel; the dead-end copy is gone.
assert.match(renderer, /window\.sentinel\.logAnswerMiss\?\.\(\{ matchScore: top \}\)/, "not-yet logs a KB miss to the learning loop");
assert.match(renderer, /function renderEscalation\(\)/, "an escalation panel renders under a not-yet answer");
assert.match(renderer, /outcome === "resolved"[\s\S]*?renderEscalation\(\)/, "resolved short-circuits; not-yet opens escalation");
assert.doesNotMatch(renderer, /we'll keep improving/, "the old not-yet dead-end copy is removed");
t();

// 2 — P5: the escalation offers BOTH the guided walk-through and connecting a technician (never a dead click).
assert.match(renderer, /walk\.textContent = "Walk me through it"/, "offers the guided walk-through");
assert.match(renderer, /tech\.textContent = "Connect a technician"/, "offers connecting a technician");
assert.match(renderer, /activateTab\("walkthrough"\); renderWalkthrough\(\{ intent: question \|\| "", mode: "guide" \}\)/, "walk-through routes to the guided tab (guide mode)");
t();

// 3 — P6: "Connect a technician" mints a ticket via the escalate bridge and shows the ref in chat.
assert.match(renderer, /window\.sentinel\.escalateTicket\?\.\(\{ issue: question \|\| "", recipeId \}\)/, "tech button calls the escalate-ticket bridge with the (optional) matched recipe");
assert.match(renderer, /Ticket \$\{r\.ref\} opened/, "the minted ticket ref is shown in the chat bubble");
assert.match(renderer, /Dashboard activity/, "the copy points the user to Dashboard activity (P6 surface)");
assert.match(preload, /escalateTicket:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\("sentinel:escalate-ticket", payload\)/, "preload bridges escalateTicket");
assert.match(preload, /logAnswerMiss:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\("sentinel:answer-miss", payload\)/, "preload bridges logAnswerMiss");
t();

// 4 — main mints + RECORDS a real ref (reusing the proven mintAndRecordTicketRef) and logs an ESCALATE event so
// the ref is auditable + surfaces on the timeline; the miss is stored locally (content-blind: score only).
assert.match(main, /ipcMain\.handle\("sentinel:escalate-ticket"/, "main exposes escalate-ticket");
assert.match(main, /const \{ ref, source \} = mintAndRecordTicketRef\(snNumber\);/, "escalate mints + records a real ticket ref");
assert.match(main, /logEvent\("ESCALATE", `Escalation ticket \$\{ref\} opened/, "escalation is logged with the ref (→ Dashboard activity)");
assert.match(main, /ipcMain\.handle\("sentinel:answer-miss"/, "main exposes the answer-miss learning-loop log");
assert.match(main, /store\.set\("answerMisses", misses\.slice\(0, 500\)\)/, "misses persist locally, capped");
t();

// 5 — P6 surface: RESOLVED/ESCALATE/TICKET events (which carry the minted IIS-… ref in their text) map to a real
// Dashboard → Activity row (🎫 icon + a deep-link tab), not the anonymous default. The ref text passes through.
for (const tag of ["ESCALATE", "TICKET", "RESOLVED"]) {
  const a = eventToActivity({ tag, text: `Escalation ticket IIS-20260716-0001 opened (IIS-local).`, ts: "2026-07-16T12:00:00.000Z" });
  assert.ok(a.icon && a.icon !== "•", `${tag} → a real timeline icon`);
  assert.ok(a.tab && a.tab !== "overview", `${tag} → a deep-link tab`);
  assert.match(a.text, /IIS-20260716-0001/, `${tag} row preserves the ticket ref text`);
}
t();

assert.equal(n, 5, "5 chat-escalation-ticket groups");
console.log(`chat-escalation-ticket test passed (${n} groups · P5 not-yet logs a miss + offers walk-through/technician (no dead end) · P6 real minted ref in chat + main record/log + Dashboard-activity mapping).`);

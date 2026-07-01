// RUN-B B5 — the under-globe "issue resolved | email sent | ticket reference" confirmation Ahmad wants to SEE.
// Rule 14 (everything real, nothing faked): renders ONLY on a real completed+verified resolve; NEVER claims an
// email was sent unless a real send returned success; the ticket reference is a real ServiceNow number or a
// deterministic, RECORDED IIS-YYYYMMDD-#### — never fake. Also proves the wiring end-to-end and desktop<->web parity.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
  buildGlobeConfirmation, buildWebConfirmation, confirmationText, emailStateOf,
  mintTicketRef, nextTicketSeq, normalizeIssue, isServiceNowNumber, padSeq, refDatePart,
  GLOBE_CONFIRM_SCHEMA, CONFIRM_DISMISS_MS
} from "../src/shared/globe-confirmation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");            // ARIA Sentinel
const repoRoot = path.resolve(__dirname, "../..");     // repo root
const require = createRequire(import.meta.url);
const read = (p) => fs.readFileSync(p, "utf-8");
const NOW = Date.parse("2026-07-01T12:00:00Z");

// ── Rule 14 gate #1 — ONLY on a real completed + verified resolve; never pre-emptive, never on failure ──
assert.equal(buildGlobeConfirmation({}).show, false, "nothing by default");
assert.equal(buildGlobeConfirmation({ completed: true, verified: false, issueTitle: "DNS" }).show, false, "unverified fix => NOTHING");
assert.equal(buildGlobeConfirmation({ completed: false, verified: true, issueTitle: "DNS" }).show, false, "incomplete => NOTHING");
assert.equal(buildGlobeConfirmation({ completed: true, verified: true, issueTitle: "   " }).show, false, "no real issue => NOTHING");

// ── Grammar — the exact under-globe sentence, correct "has been sent" ────────────────────────────────
const base = { completed: true, verified: true, issueTitle: "DNS", ticketRef: "IIS-20260701-0001" };
const sent = buildGlobeConfirmation({ ...base, email: { attempted: true, sent: true, to: "user@acme.com" } });
assert.equal(sent.show, true);
assert.equal(sent.text, "DNS issue has been resolved. Email has been sent with ticket reference IIS-20260701-0001.");
assert.equal(sent.email.sent, true);
assert.equal(sent.dismissMs, CONFIRM_DISMISS_MS);
assert.equal(sent.schema, GLOBE_CONFIRM_SCHEMA);

// ── Honest email states — NEVER claim a send that did not happen ─────────────────────────────────────
const pending = buildGlobeConfirmation({ ...base, email: { attempted: true, sent: false } });
assert.equal(pending.text, "DNS issue has been resolved. Email pending. Ticket reference IIS-20260701-0001.");
assert.equal(pending.email.sent, false);
assert.equal(pending.email.pending, true);
assert.ok(!/has been sent/.test(pending.text), "a failed/unconfirmed send NEVER says 'has been sent'");
const none = buildGlobeConfirmation({ ...base }); // no email attempted (e.g. no recipient)
assert.equal(none.text, "DNS issue has been resolved. Ticket reference IIS-20260701-0001.");
assert.ok(!/Email/.test(none.text), "not attempted => claims no email at all");
assert.equal(emailStateOf({ sent: true }), "sent");
assert.equal(emailStateOf({ attempted: true }), "pending");
assert.equal(emailStateOf({}), "none");

// ── Ticket reference is REAL: ServiceNow verbatim, else a deterministic + RECORDED IIS-YYYYMMDD-#### ──
assert.equal(refDatePart(NOW), "20260701");
assert.equal(padSeq(7), "0007");
assert.equal(padSeq(0), "0001", "sequence is never below 1");
const local = mintTicketRef({ seq: 7, now: NOW });
assert.equal(local.ref, "IIS-20260701-0007");
assert.equal(local.source, "local");
assert.equal(local.record.kind, "ticket-ref", "a local ref carries an audit record (never 'random with no record')");
assert.equal(local.record.ref, "IIS-20260701-0007");
const sn = mintTicketRef({ serviceNowNumber: "inc0012345", now: NOW });
assert.equal(sn.ref, "INC0012345", "a real ServiceNow number is used verbatim");
assert.equal(sn.source, "servicenow");
assert.ok(isServiceNowNumber("INC0012345") && !isServiceNowNumber("IIS-20260701-0001"));

// ── The #### is a genuine per-day counter (resets each UTC day; increments within a day) ─────────────
assert.deepEqual(nextTicketSeq({}, NOW), { day: "20260701", seq: 1 });
assert.deepEqual(nextTicketSeq({ day: "20260701", seq: 4 }, NOW), { day: "20260701", seq: 5 });
assert.deepEqual(nextTicketSeq({ day: "20260630", seq: 9 }, NOW), { day: "20260701", seq: 1 }, "resets each day");

// build() mints when no ref is supplied, and uses a ServiceNow number when present
const minted = buildGlobeConfirmation({ completed: true, verified: true, issueTitle: "Wi-Fi" }, { seq: 7, now: NOW });
assert.equal(minted.ticketRef, "IIS-20260701-0007");
assert.equal(minted.ticketSource, "local");
assert.ok(minted.record && minted.record.ref === "IIS-20260701-0007");
const snBuild = buildGlobeConfirmation({ completed: true, verified: true, issueTitle: "VPN", serviceNowNumber: "inc0098765" }, { now: NOW });
assert.equal(snBuild.ticketRef, "INC0098765");
assert.equal(snBuild.ticketSource, "servicenow");

// ── R11 — a path-like issue title is scrubbed before it is ever shown ────────────────────────────────
const scrubbed = buildGlobeConfirmation({ completed: true, verified: true, issueTitle: "C:\\Users\\Ahmad\\dns.txt failure", ticketRef: "IIS-20260701-0001" });
assert.ok(!/Users|dns\.txt/.test(scrubbed.text), "issue title is path-scrubbed (R11)");
assert.equal(normalizeIssue("   "), "");
assert.ok(normalizeIssue("x".repeat(200)).length <= 80, "long titles are capped");

// ── Web-ARIA equivalent: needs a real KB resolution; same sentence; web ref never faked ──────────────
const web = buildWebConfirmation({ kbResolved: true, issueTitle: "Printer", ticketRef: "IIS-20260701-0002", email: { attempted: true, sent: true } }, {});
assert.equal(web.source, "web");
assert.equal(web.text, "Printer issue has been resolved. Email has been sent with ticket reference IIS-20260701-0002.");
assert.equal(buildWebConfirmation({ kbResolved: false, issueTitle: "X", ticketRef: "IIS-1" }).show, false, "web: no real resolve => NOTHING");
assert.equal(buildWebConfirmation({ kbResolved: true, issueTitle: "X" }).show, false, "web: no real ticket ref => NOTHING (never faked)");

// ── Desktop <-> web parity: the shipped browser mirror produces byte-identical sentences ─────────────
const webMirror = require(path.join(repoRoot, "assets/aria-globe-confirmation.js"));
for (const emailState of ["sent", "pending", "none"]) {
  const parts = { issue: "DNS", ticketRef: "IIS-20260701-0001", emailState };
  assert.equal(webMirror.confirmationText(parts), confirmationText(parts), `desktop<->web sentence parity (${emailState})`);
}
assert.equal(webMirror.buildWebConfirmation({ kbResolved: true, issueTitle: "Printer", ticketRef: "IIS-20260701-0002", email: { sent: true, attempted: true } }).text, web.text, "web mirror build parity");

// ── Wiring proof: pure module -> main IPC + real email + recorded ref -> overlay under the globe -> web ─
const main = read(path.join(root, "src/main/main.mjs"));
assert.match(main, /from "\.\.\/shared\/globe-confirmation\.mjs"/, "main imports the B5 module");
assert.match(main, /function emitGlobeConfirmation/, "main has the emitter");
assert.match(main, /function mintAndRecordTicketRef/, "main mints + records the ticket ref");
assert.match(main, /logEvent\("TICKET"/, "the minted ticket ref is recorded in the tamper-evident log");
assert.match(main, /sentinel-session-report/, "reuses the proven Resend-backed resolution email function");
assert.match(main, /sentinel:globe-confirmation/, "main sends the confirmation to the overlay window");
assert.match(main, /if \(verified\.ok\) \{[\s\S]*emitGlobeConfirmation/, "fires ONLY after a real verified fix");
assert.match(main, /sentinel:globe-confirm-test/, "exposes a live-trigger IPC so Cowork/Ahmad can see + verify it");
assert.match(main, /ARIA_SENTINEL_DRY_RUN[\s\S]*attempted: false/, "dry-run never claims a phantom send");

const preload = read(path.join(root, "src/main/preload.cjs"));
assert.match(preload, /onGlobeConfirmation:/, "preload bridges the confirmation event");
assert.match(preload, /sentinel:globe-confirmation/, "preload wires the confirmation channel");
assert.match(preload, /globeConfirmTest:/, "preload bridges the live-trigger");

const overlayHtml = read(path.join(root, "src/renderer/overlay.html"));
assert.match(overlayHtml, /id="overlayConfirm"/, "overlay has the under-globe confirmation element");
assert.match(overlayHtml, /globe-confirm/, "overlay styles the under-globe confirmation");
const overlayJs = read(path.join(root, "src/renderer/overlay.js"));
assert.match(overlayJs, /onGlobeConfirmation\?\.\(/, "overlay renderer subscribes to the confirmation");
assert.match(overlayJs, /confirmEl\.textContent = c\.text/, "overlay renders the real confirmation text");

const ariaHtml = read(path.join(repoRoot, "aria.html"));
assert.match(ariaHtml, /assets\/aria-globe-confirmation\.js/, "web ARIA includes the B5 mirror");

const runAll = read(path.join(__dirname, "run-all.mjs"));
assert.match(runAll, /b5-globe-confirmation\.test\.mjs/, "run-all registers this test");

console.log("globe-confirmation (RUN-B B5) test passed (real-or-empty: shows ONLY on a real verified resolve; honest email states never fake 'sent'; ticket ref = ServiceNow or recorded IIS-YYYYMMDD-####; R11-scrubbed; desktop overlay under the globe + main IPC/real email/recorded ref + web mirror parity all wired).");

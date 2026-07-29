// RUN-G G2 - follow-up cadence. Locks: `sent` is structurally always false, the body is the
// Ahmad-locked template BYTE-VERBATIM ([Name] only), consent gates first contact, gone-quiet gets a
// gentler step (never a harder pitch), state advances ONLY on real recorded dates, and the module
// has no transport at all.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildFollowupCadence, followupCadenceMarkdown, cadenceState, cadenceDraft, consentOk, realTouches,
  CADENCE_STATES, FOLLOWUP_CADENCE_SCHEMA, CADENCE_EMPTY, MAX_TOUCHES, GONE_QUIET_DAYS, TOUCH_INTERVAL_DAYS,
} from "../src/shared/followup-cadence.mjs";
import { OUTREACH_TEMPLATE, TEMPLATE_SOURCE } from "../src/shared/revenue-board.mjs";

const NOW = Date.parse("2026-07-21T08:00:00.000Z");
const ago = (d) => new Date(NOW - d * 86400000).toISOString();
const lead = (over = {}) => ({ id: "L1", qualified: true, name: "Dana", email: "dana@acme.ca", inboundConsent: true, ...over });

// -- 1. EMPTY IS HONEST ------------------------------------------------------------------------------
for (const input of [undefined, null, [], "nope", { leads: [] }]) {
  const b = buildFollowupCadence(input, { now: NOW });
  assert.equal(b.schema, FOLLOWUP_CADENCE_SCHEMA, "schema is explicit");
  assert.equal(b.empty, true, "no leads => empty board");
  assert.equal(b.draftCount, 0, "no drafts invented");
}
assert.ok(followupCadenceMarkdown(buildFollowupCadence([], { now: NOW })).includes(CADENCE_EMPTY), "empty markdown is honest");
assert.deepEqual(CADENCE_STATES, ["touch-due", "awaiting-reply", "gone-quiet", "closed"], "states are explicit");

// -- 2. ONLY REAL TOUCHES COUNT ----------------------------------------------------------------------
assert.equal(realTouches({}).length, 0, "no touches => none");
assert.equal(realTouches({ touches: [{ at: "nope", direction: "out" }] }).length, 0, "unparseable date is not a touch");
assert.equal(realTouches({ touches: [{ at: ago(1) }] }).length, 0, "a touch without a recorded direction does not count");
assert.equal(realTouches({ touches: [{ at: ago(1), direction: "out" }, { at: ago(9), direction: "in" }] })[0].at, ago(9), "touches are date-sorted");

// -- 3. STATE MACHINE MOVES ONLY ON REAL DATES -------------------------------------------------------
assert.equal(cadenceState(lead(), NOW).state, "touch-due", "never touched => our move");
assert.match(cadenceState(lead(), NOW).why, /not backfilled/, "absence of a touch is stated, never filled in");
assert.equal(cadenceState(lead({ touches: [{ at: ago(1), direction: "out" }] }), NOW).state, "awaiting-reply", `inside ${TOUCH_INTERVAL_DAYS}d we wait, we do not chase`);
assert.equal(cadenceState(lead({ touches: [{ at: ago(6), direction: "out" }] }), NOW).state, "touch-due", "past the interval => due");
assert.equal(cadenceState(lead({ touches: [{ at: ago(GONE_QUIET_DAYS + 2), direction: "out" }] }), NOW).state, "gone-quiet", "long silence => gone quiet");
assert.equal(cadenceState(lead({ touches: [{ at: ago(9), direction: "out" }, { at: ago(2), direction: "in" }] }), NOW).state, "touch-due", "their reply makes it our move");
assert.equal(cadenceState(lead({ closedReason: "not interested" }), NOW).state, "closed", "a real closed reason closes it");
const pestered = lead({ touches: Array.from({ length: MAX_TOUCHES }, (_, i) => ({ at: ago(40 - i * 5), direction: "out" })) });
assert.equal(cadenceState(pestered, NOW).state, "closed", `${MAX_TOUCHES} unanswered touches => stop, do not pester`);
assert.match(cadenceState(pestered, NOW).why, /do not pester/, "the stop reason is explicit");

// -- 4. CONSENT GATES FIRST CONTACT ------------------------------------------------------------------
assert.equal(consentOk({}), false, "no consent + no prior touch => no consent");
assert.equal(consentOk({ inboundConsent: true }), true, "they contacted us");
assert.equal(consentOk({ touches: [{ at: ago(3), direction: "out" }] }), true, "an existing real thread is consent to continue");
const cold = cadenceDraft(lead({ inboundConsent: false }), "touch-due");
assert.equal(cold.draft, null, "no consent => NO draft at all");
assert.match(cold.reason, /YOUR one-click/, "first contact is explicitly Ahmad's");

// -- 5. DRAFT IS THE LOCKED TEMPLATE, BYTE-VERBATIM, AND NEVER SENDS ----------------------------------
const due = cadenceDraft(lead(), "touch-due");
assert.ok(due.draft, "consented + named + emailed => a draft exists");
assert.equal(due.draft.body, OUTREACH_TEMPLATE.split("[Name]").join("Dana"), "body is the locked template with [Name] substituted - nothing else changed");
assert.ok(!due.draft.body.includes("[Name]"), "no placeholder ever reaches a real inbox");
assert.equal(due.draft.templateSource, TEMPLATE_SOURCE, "template provenance is carried");
assert.equal(due.draft.sent, false, "sent is false");
assert.equal(due.draft.executed, false, "nothing executed");
assert.equal(cadenceDraft(lead({ name: "  " }), "touch-due").draft, null, "no real name => no draft");
assert.equal(cadenceDraft(lead({ email: "not-an-email" }), "touch-due").draft, null, "no real email => no draft");
assert.equal(cadenceDraft(lead(), "awaiting-reply").draft, null, "inside the wait window there is no draft - no chasing");
assert.equal(cadenceDraft(lead(), "closed").draft, null, "closed leads get no draft");

// -- 6. GONE-QUIET OUTRANKS MONEY: SOFTER, NEVER HARDER ----------------------------------------------
const quiet = cadenceDraft(lead({ seats: 5000 }), "gone-quiet");
assert.ok(quiet.draft, "a quiet consented thread still gets a draft");
assert.match(quiet.draft.framing, /Do NOT escalate/, "silence gets a gentler step, never a harder pitch");
assert.equal(quiet.draft.body, due.draft.body, "the email body is the SAME locked template - we never write new pressure copy");

// -- 7. BOARD: unqualified leads never enter cadence, priority is deterministic -----------------------
const board = buildFollowupCadence([
  { id: "unq", qualified: false, name: "X", email: "x@x.ca", inboundConsent: true },
  lead({ id: "quiet", touches: [{ at: ago(GONE_QUIET_DAYS + 1), direction: "out" }] }),
  lead({ id: "due" }),
  lead({ id: "waiting", touches: [{ at: ago(1), direction: "out" }] }),
  { id: "bad" },
], { now: NOW });
assert.equal(board.excluded.length, 2, "unqualified + malformed are excluded with reasons");
assert.match(board.excluded.find((x) => x.id === "unq").reason, /not qualified/, "cadence never runs on an unqualified lead");
assert.equal(board.rows[0].id, "due", "our-move leads come first");
assert.equal(board.rows[1].id, "quiet", "gone-quiet next");
assert.equal(board.rows[2].id, "waiting", "waiting last among open states");
for (const r of board.rows) {
  assert.equal(r.sent, false, "every row: sent false");
  assert.equal(r.action.executed, false, "every action: not executed");
  assert.equal(r.action.staged, true, "every action: staged for Ahmad");
}
assert.equal(board.nothingSent, true, "board asserts nothing was sent");
assert.ok(followupCadenceMarkdown(board).includes("sent: false"), "markdown shows drafts are unsent");

// -- 8. STATIC SCAN: no transport exists --------------------------------------------------------------
const src = readFileSync(new URL("../src/shared/followup-cadence.mjs", import.meta.url), "utf8");
for (const forbidden of ["fetch(", "XMLHttpRequest", "node:http", "node:https", "child_process", "node:fs", "exec(", "spawn(", "sendMail", "nodemailer", "smtp"]) {
  assert.ok(!src.includes(forbidden), `followup-cadence must not reference ${forbidden}`);
}
assert.ok(!/sent:\s*true/.test(src), "no code path can set sent:true");
assert.ok(!/executed:\s*true/.test(src), "no code path can mark an action executed");

console.log("g2-followup-cadence: 8 assertion groups PASSED");

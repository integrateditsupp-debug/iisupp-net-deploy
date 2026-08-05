// aj2-second-touch-path.test.mjs — RUN-AJ / AJ2. Walk the whole second-touch path, end to end.
//
// The parts have been green for cycles: V1 ranks the warm routes, V2 drafts the second message,
// W1 captures a reply, W2 refuses to render a lower rung as a higher one. What had NEVER been
// exercised is the path THROUGH them — real record in, draft out, send counted, reply recorded —
// which is precisely why RUN-AI could find twelve drafts that existed nowhere a person could read.
//
// This suite exercises that path against the operator's REAL records, and asserts three things a
// flattering report would get wrong:
//   1. the artefact on disk matches what the module actually produces (no phantom send sheet),
//   2. a send moves the ladder drafted → sent and NOT ONE RUNG FURTHER,
//   3. a decline is recorded as a reply and is never softened into interest.
//
// It reads the untracked operator record root, so it is declared in record-dependencies.json. When
// those records are absent (a bare clone) it says so and asserts nothing it cannot see — never a
// flattering zero, never a silent pass.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { draftQueue, SECOND_MESSAGE_SCHEMA } from "../src/shared/second-message.mjs";
import { buildWarmRedirectQueue } from "../src/shared/warm-redirect-queue.mjs";
import { buildReplyCapture, normalizeReply, NO_REPLY_YET, UNVERIFIED } from "../src/shared/reply-capture.mjs";
import { buildOutcomeLadder, outcomeLadderFacts, ladderHeadline, NOT_REACHED } from "../src/shared/outcome-ladder.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RECORD_ROOT = path.join(HERE, "..", "..", "senior-director-state");
const WARM = path.join(RECORD_ROOT, "outbound", "warm-redirect-record-2026-07-29.json");
const REPLIES = path.join(RECORD_ROOT, "outbound", "reply-record-2026-07-29.json");
const SEND_SHEET = path.join(RECORD_ROOT, "outbound", "SEND-SHEET-2026-08-05.md");

const NOW = Date.parse("2026-08-05T18:00:00Z");
const haveRecords = existsSync(WARM) && existsSync(REPLIES);
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

// ── 1. The real path: record → queue → drafts ─────────────────────────────────────────────────────

test("the real warm record drafts a real queue — the modules connect, not just compile", (t) => {
  if (!haveRecords) return t.skip("operator records absent in this checkout — nothing asserted, nothing claimed");

  const q = buildWarmRedirectQueue(readJson(WARM), { now: NOW });
  const d = draftQueue(q.queue);

  assert.equal(d.schema, SECOND_MESSAGE_SCHEMA);
  assert.equal(d.drafts.length + d.refused.length, q.queue.length, "every live route is either drafted or refused BY NAME");
  assert.ok(d.drafts.length > 0, "the queue produces drafts");
  for (const draft of d.drafts) {
    assert.ok(draft.body && draft.body.trim().length > 0, `${draft.handle} has a real body`);
    assert.match(draft.sendIs, /human click/i, "no draft may claim it can send itself");
  }
});

test("the send sheet on disk MATCHES the module's real output — the artefact is not a phantom", (t) => {
  if (!haveRecords || !existsSync(SEND_SHEET)) {
    return t.skip("send sheet or records absent in this checkout — the claim is unverifiable here and is not made");
  }
  const q = buildWarmRedirectQueue(readJson(WARM), { now: NOW });
  const d = draftQueue(q.queue);
  const sheet = readFileSync(SEND_SHEET, "utf8");

  // This is the assertion RUN-AI's failure would have tripped: every handle the module drafts must
  // appear in the readable file, and the file must not name a handle the module never drafted.
  for (const draft of d.drafts) {
    assert.ok(sheet.includes(draft.handle), `${draft.handle} is drafted but does not appear in the send sheet`);
  }
  const handlesInSheet = [...new Set(sheet.match(/WR-[A-Z]\d{3}/g) || [])];
  const drafted = new Set(d.drafts.map((x) => x.handle));
  const expired = new Set(q.expired.map((x) => x.handle));
  for (const h of handlesInSheet) {
    assert.ok(drafted.has(h) || expired.has(h), `${h} appears in the send sheet but the module never drafted it`);
  }
  assert.ok(handlesInSheet.length > 0, "the send sheet actually names routes");
});

// ── 2. What sending does — and what it must NOT do ────────────────────────────────────────────────

test("with zero sends the ladder stops at `drafted`, and says the send is a human click", (t) => {
  if (!haveRecords) return t.skip("operator records absent — nothing asserted");

  const rec = readJson(REPLIES);
  const q = buildWarmRedirectQueue(readJson(WARM), { now: NOW });
  const drafted = draftQueue(q.queue).drafts.length;

  const ladder = buildOutcomeLadder(
    { mail: { source: "operator mailbox", readAt: "2026-08-05T18:00:00Z", events: [] }, replies: rec, drafted },
    { now: NOW },
  );

  // The honest state of this program at the time of writing, read from the record rather than asserted.
  assert.equal(rec.secondMessagesSent, 0, "if this fails the record has changed — read the real number below");
  assert.equal(ladder.reached, "drafted");
  assert.equal(ladder.rungs.sent.reached, false, "drafts must never evidence a send");
  assert.match(ladder.waiting, /human click/i);
});

test("a real send moves the ladder drafted → sent and NOT ONE RUNG FURTHER", () => {
  const sent = (n) => ({
    source: "operator mailbox, read first-hand",
    readAt: "2026-08-05T18:00:00Z",
    events: Array.from({ length: n }, (_, i) => ({
      kind: "sent", at: "2026-08-05T17:00:00Z", handle: `WR-R${String(i + 1).padStart(3, "0")}`,
    })),
  });

  const ladder = buildOutcomeLadder(
    { mail: sent(12), replies: { replies: [] }, drafted: 12 },
    { now: NOW },
  );
  assert.equal(ladder.reached, "sent", "twelve sends reach `sent`");
  assert.equal(ladder.rungs.sent.count, 12);
  assert.equal(ladder.rungs.replied.reached, false, "a send is not a reply");
  assert.equal(ladder.rungs.meeting.reached, false, "a send is not a meeting");
  assert.equal(ladder.rungs.revenue.reached, false, "a send is not revenue");
  assert.match(ladder.waiting, /no warm route has replied yet/i);
  assert.match(ladderHeadline(ladder), /Revenue to date: none/);
});

test("the ladder cannot render a lower rung as a higher one — every rung reads only its own evidence", () => {
  // Drafts alone: everything above `drafted` stays unreached however many there are.
  const draftsOnly = buildOutcomeLadder({ mail: { source: "x", readAt: "2026-08-05T18:00:00Z", events: [] }, replies: { replies: [] }, drafted: 999 }, { now: NOW });
  assert.equal(draftsOnly.reached, "drafted");
  for (const r of ["sent", "replied", "meeting", "revenue"]) assert.equal(draftsOnly.rungs[r].reached, false, `${r} must stay unreached`);

  // No evidence at all: NOT_REACHED, not a flattering zero-with-progress.
  const nothing = buildOutcomeLadder({ mail: { source: "x", readAt: "2026-08-05T18:00:00Z", events: [] }, replies: { replies: [] }, drafted: 0 }, { now: NOW });
  assert.equal(nothing.reached, NOT_REACHED);

  // No inbound source read at all is `unverified`, which is not `no reply yet` and not 0.
  const unsourced = buildOutcomeLadder({ mail: { source: "x", readAt: "2026-08-05T18:00:00Z", events: [] }, drafted: 1 }, { now: NOW });
  assert.equal(unsourced.rungs.replied.count, UNVERIFIED);
  assert.equal(unsourced.rungs.replied.reached, false, "unverified must never count as reached");
});

// ── 3. What comes back — including the answer nobody wants ────────────────────────────────────────

test("a decline is recorded as a REPLY and is never softened into interest", () => {
  const rc = buildReplyCapture(
    { replies: [{ handle: "WR-R001", disposition: "declined", repliedAt: "2026-08-05T17:30:00Z", toTouch: 2 }] },
    { now: NOW },
  );
  assert.equal(rc.state, "replied", "a decline is a reply — the funnel moved, even though the answer was no");
  assert.equal(rc.count, 1);
  assert.equal(rc.byDisposition.declined, 1);
  assert.equal(rc.byDisposition.interested, 0, "a decline must never be counted as interest");
  assert.equal(rc.firstReply.disposition, "declined");
  assert.match(rc.note, /never rendered as interest/i);

  const ladder = buildOutcomeLadder(
    { mail: { source: "x", readAt: "2026-08-05T18:00:00Z", events: [{ kind: "sent", at: "2026-08-05T17:00:00Z", handle: "WR-R001" }] }, replies: rc, drafted: 12 },
    { now: NOW },
  );
  assert.equal(ladder.reached, "replied", "a decline still raises the ladder to `replied`");
  assert.equal(ladder.rungs.meeting.reached, false, "and no further");
});

test("an unknown disposition is refused by name, never coerced to the nearest flattering value", () => {
  const n = normalizeReply({ handle: "WR-R001", disposition: "warm-ish", repliedAt: "2026-08-05T17:30:00Z" });
  assert.equal(n.ok, false);
  assert.ok(JSON.stringify(n.problems).includes("warm-ish"), "the refusal names the value it refused");
});

// ── 4. The real number, stated as it is ───────────────────────────────────────────────────────────

test("the real second-touch state is read from the record and stated without dressing", (t) => {
  if (!haveRecords) return t.skip("operator records absent — the real number cannot be read here and is not invented");

  const rec = readJson(REPLIES);
  const rc = buildReplyCapture(rec, { now: NOW });

  if (rec.secondMessagesSent === 0) {
    assert.equal(rc.state, NO_REPLY_YET, "zero sent and zero replies is `no reply yet`, which is not the same as 0 and not unverified");
    assert.equal(rc.count, 0);
  } else {
    // The day this branch runs is the day the program has a real second-touch outcome.
    assert.ok(rec.secondMessagesSent > 0);
    assert.ok(rc.sourced, "once messages are out, the inbound source must be read — otherwise the state is unverified, not zero");
  }
});

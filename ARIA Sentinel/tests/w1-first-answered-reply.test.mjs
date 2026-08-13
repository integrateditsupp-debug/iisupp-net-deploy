// w1-first-answered-reply.test.mjs — RUN-W W1/W2/W3 exit criteria, test-locked.
//
// W1: reply capture — cannot invent a reply, `no reply yet` distinct from 0 and unverified,
//     a decline is never softened into interest, elapsed measured from the SECOND message.
// W2: the outcome ladder — one-way; evidence for a lower rung leaves every higher rung untouched;
//     software progress cannot raise a rung.
// W3: the three surfaces render the highest rung the evidence reaches and never one above it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildReplyCapture, normalizeReply, replyCaptureFacts, replyCaptureMarkdown,
  REPLY_CAPTURE_SCHEMA, NO_REPLY_YET, UNVERIFIED, DISPOSITIONS, NOT_INTEREST,
  SENDS as C_SENDS, HAS_TRANSPORT as C_TRANSPORT, PERSISTS as C_PERSISTS, READS_IDENTITY as C_IDENT,
} from "../src/shared/reply-capture.mjs";
import {
  buildOutcomeLadder, outcomeLadderFacts, ladderHeadline, outcomeLadderMarkdown,
  RUNGS, NOT_REACHED, DISCARDED_INPUTS,
  SENDS as L_SENDS, HAS_TRANSPORT as L_TRANSPORT,
} from "../src/shared/outcome-ladder.mjs";
import {
  buildFirstReplySurface, surfaceOverclaims, surfaceTrendViolations, allRenderings,
  NOT_YET_HEADLINE,
} from "../src/shared/first-reply-surface.mjs";
import { whenOperatorRecords } from "../../scripts/lib/operator-record.mjs";

// RUN-BR — these assertions read a REAL operator record under senior-director-state/, which is
// untracked by design. Present here: they run for real. Absent (clean clone): the reading is
// reported NOT TAKEN rather than counted as a code failure.
const REAL_RECORD = whenOperatorRecords(new URL("../../senior-director-state", import.meta.url));

const NOW = Date.parse("2026-07-29T02:15:00Z");
const C_SRC = "src/shared/reply-capture.mjs";
const L_SRC = "src/shared/outcome-ladder.mjs";
const S_SRC = "src/shared/first-reply-surface.mjs";
const RECORD = "../../senior-director-state/outbound/reply-record-2026-07-29.json";

const srcText = (rel) => readFileSync(new URL("../" + rel, import.meta.url), "utf8");
const realRecordRaw = () => readFileSync(new URL(RECORD, import.meta.url), "utf8");

/** A mail record with `sent` events but nothing above it. */
const mailWithSends = (count) => ({
  source: "operator mailbox, read first-hand",
  readAt: "2026-07-29T02:00:00Z",
  events: Array.from({ length: count }, (_, i) => ({
    kind: "sent", at: "2026-07-27T10:00:00Z", handle: `WR-R${String(i + 1).padStart(3, "0")}`,
  })),
});

// ── W1 ───────────────────────────────────────────────────────────────────────
test("W1: module and real record carry NO address or domain (vault Rule 11, grep-proof)", REAL_RECORD, () => {
  const rx = /[a-z0-9._-]+@[a-z0-9.-]+|[a-z0-9-]+\.(com|ca|net|org|gov|io|co)\b/i;
  assert.equal(rx.test(srcText(C_SRC)), false, "W1 module must not contain a real address/domain");
  assert.equal(rx.test(realRecordRaw()), false, "reply record must contain no real address/domain");
  assert.equal(C_SENDS === false && C_TRANSPORT === false && C_PERSISTS === false && C_IDENT === false, true);
});

test("W1: purity — no fs, no net, no spawn, no transport in any RUN-W module", () => {
  for (const rel of [C_SRC, L_SRC, S_SRC]) {
    const t = srcText(rel);
    for (const banned of ["node:fs", "node:net", "node:http", "child_process", "nodemailer", "fetch("]) {
      assert.equal(t.includes(banned), false, `${rel} must not reference ${banned}`);
    }
  }
  assert.equal(L_SENDS === false && L_TRANSPORT === false, true);
});

test("W1: no inbound event => `no reply yet`, which is NOT 0 and NOT unverified", () => {
  const rc = buildReplyCapture({ replies: [] }, { now: NOW, sourced: true });
  assert.equal(rc.state, NO_REPLY_YET);
  assert.notEqual(rc.state, 0);
  assert.notEqual(rc.state, UNVERIFIED);
  assert.equal(rc.count, 0);
  assert.equal(rc.firstReply, null);
  assert.match(replyCaptureMarkdown(rc), /no reply yet/i);
});

test("W1: no inbound SOURCE read => unverified, a third state distinct from `no reply yet`", () => {
  const rc = buildReplyCapture({}, { now: NOW, sourced: false });
  assert.equal(rc.state, UNVERIFIED);
  assert.notEqual(rc.state, NO_REPLY_YET);
  assert.equal(rc.count, UNVERIFIED);
  assert.equal(rc.sourced, false);
});

test("W1: the real record is honest — sourced, and it holds no invented reply", REAL_RECORD, () => {
  const rec = JSON.parse(realRecordRaw());
  const rc = buildReplyCapture(rec, { now: NOW, sourced: true });
  assert.equal(Array.isArray(rec.replies), true);
  assert.equal(rec.secondMessagesSent, 0, "zero second messages sent — so a reply cannot exist yet");
  assert.equal(rc.state, NO_REPLY_YET);
  assert.equal(rc.count, 0);
});

test("W1: a decline is a real reply and can NEVER render as interest", () => {
  const rc = buildReplyCapture({
    replies: [{
      handle: "WR-R001", disposition: "declined",
      secondMessageAt: "2026-07-28T09:00:00Z", repliedAt: "2026-07-28T15:00:00Z",
    }],
  }, { now: NOW, sourced: true });
  assert.equal(rc.count, 1, "a decline counts as a reply");
  assert.equal(rc.firstReply.disposition, "declined");
  assert.equal(rc.firstReply.isInterest, false);
  assert.equal(replyCaptureFacts(rc).interested, 0);
  assert.equal(/interested/i.test(replyCaptureMarkdown(rc)), false, "a decline must not surface as interest");
  for (const d of NOT_INTEREST) {
    const one = buildReplyCapture({ replies: [{ handle: "WR-R009", disposition: d, repliedAt: "2026-07-28T15:00:00Z" }] },
      { now: NOW, sourced: true });
    assert.equal(one.firstReply.isInterest, false, `${d} must never be interest`);
  }
});

test("W1: an unknown disposition is REFUSED by name, never coerced to the nearest flattering one", () => {
  const n = normalizeReply({ handle: "WR-R002", disposition: "warm", repliedAt: "2026-07-28T15:00:00Z" });
  assert.equal(n.ok, false);
  assert.match(n.problems.join(" "), /unknown disposition "warm"/);
  assert.equal(DISPOSITIONS.includes("warm"), false);
  // and the default for an ambiguous reply is `unclear`, not `interested`
  assert.equal(DISPOSITIONS[DISPOSITIONS.length - 1], "interested", "interested is last — nothing promotes into it");
});

test("W1: elapsed is measured from the SECOND message, and is unverified without one", () => {
  const withSecond = normalizeReply({
    handle: "WR-R003", disposition: "asked-for-info",
    secondMessageAt: "2026-07-28T10:00:00Z", repliedAt: "2026-07-28T16:30:00Z",
  });
  assert.equal(withSecond.ok, true);
  assert.equal(withSecond.reply.elapsedHoursFromSecondMessage, 6.5);

  const noSecond = normalizeReply({ handle: "WR-R004", disposition: "not-now", repliedAt: "2026-07-28T16:30:00Z" });
  assert.equal(noSecond.ok, true);
  assert.equal(noSecond.reply.elapsedHoursFromSecondMessage, UNVERIFIED,
    "without a second-message timestamp elapsed is unverified, never inferred from the original send");
});

test("W1: identity at the door is refused (Rule 11)", () => {
  const n = normalizeReply({ handle: "someone@a-company.com", disposition: "interested", repliedAt: "2026-07-28T15:00:00Z" });
  assert.equal(n.ok, false);
  assert.match(n.problems.join(" "), /identity never enters this path/i);
});

// ── W2 ───────────────────────────────────────────────────────────────────────
test("W2: a DRAFT is not a SEND — twelve drafts and zero sends reads as drafted", () => {
  const l = buildOutcomeLadder({ drafted: 12, mail: mailWithSends(0), replies: { replies: [] } }, { now: NOW });
  assert.equal(l.rungs.drafted.reached, true);
  assert.equal(l.rungs.drafted.count, 12);
  assert.equal(l.rungs.sent.reached, false);
  assert.equal(l.reached, "drafted");
  assert.match(l.waiting, /human click/i);
  assert.equal(/\bwe sent\b/i.test(ladderHeadline(l)), false);
});

test("W2: evidence for a LOWER rung leaves every HIGHER rung byte-identical", () => {
  const base = buildOutcomeLadder({ drafted: 0, mail: mailWithSends(0), replies: { replies: [] } }, { now: NOW });
  const drafted = buildOutcomeLadder({ drafted: 12, mail: mailWithSends(0), replies: { replies: [] } }, { now: NOW });
  const sent = buildOutcomeLadder({ drafted: 12, mail: mailWithSends(41), replies: { replies: [] } }, { now: NOW });

  for (const higher of ["replied", "meeting", "revenue"]) {
    assert.deepEqual(drafted.rungs[higher], base.rungs[higher], `drafting must not move ${higher}`);
    assert.deepEqual(sent.rungs[higher], base.rungs[higher], `sending must not move ${higher}`);
  }
  assert.equal(sent.reached, "sent");
  assert.equal(sent.rungs.replied.state, NOT_REACHED);
});

test("W2: a reply does NOT become a meeting, and a meeting does NOT become revenue", () => {
  const l = buildOutcomeLadder({
    drafted: 12,
    mail: mailWithSends(41),
    replies: { replies: [{ handle: "WR-R001", disposition: "asked-for-info", secondMessageAt: "2026-07-28T09:00:00Z", repliedAt: "2026-07-28T14:00:00Z" }] },
  }, { now: NOW });
  assert.equal(l.rungs.replied.reached, true);
  assert.equal(l.rungs.meeting.reached, false);
  assert.equal(l.rungs.revenue.reached, false);
  assert.equal(l.reached, "replied");
  const md = outcomeLadderMarkdown(l);
  assert.match(md, /meeting.*not reached/i);
  assert.match(md, /revenue.*not reached/i);
});

test("W2: software progress cannot raise a rung — inject every discarded input and deep-equal", () => {
  const input = { drafted: 12, mail: mailWithSends(41), replies: { replies: [] } };
  const before = buildOutcomeLadder(input, { now: NOW });
  const injected = { ...input };
  for (const k of DISCARDED_INPUTS) injected[k] = 999;
  const after = buildOutcomeLadder(injected, { now: NOW });
  assert.deepEqual(outcomeLadderFacts(after), outcomeLadderFacts(before),
    "sequences, suites, commits and merges must not touch a single rung");
  assert.deepEqual(after.rungs, before.rungs);
});

test("W2: rung order is fixed and `reached` is the highest rung with its OWN evidence", () => {
  assert.deepEqual(RUNGS, ["drafted", "sent", "replied", "meeting", "revenue"]);
  const nothing = buildOutcomeLadder({ drafted: 0, mail: { }, replies: null }, { now: NOW });
  assert.equal(nothing.reached, NOT_REACHED);
});

// ── W3 ───────────────────────────────────────────────────────────────────────
test("W3: with no reply, NO surface claims a reply, a meeting or revenue", () => {
  const s = buildFirstReplySurface({ drafted: 12, mail: mailWithSends(41), replies: { replies: [] } }, { now: NOW });
  assert.deepEqual(surfaceOverclaims(s), [], "the surface must not claim an unevidenced rung");
  for (const text of allRenderings(s)) {
    assert.equal(/booked a meeting|call scheduled|paying customer|first dollar/i.test(text), false);
  }
  assert.match(s.ledgerMarkdown, /no reply yet/i);
});

test("W3: until a real reply exists the headline says so plainly", () => {
  const s = buildFirstReplySurface({ drafted: 12, mail: mailWithSends(0), replies: { replies: [] } }, { now: NOW });
  assert.equal(s.feedHeadline, NOT_YET_HEADLINE);
  assert.match(s.feedHeadline, /no warm route has replied yet/i);
  assert.match(s.feedHeadline, /Revenue to date: none/i);
});

test("W3: one truth, three surfaces — feed, ledger and brief agree with the ladder facts", () => {
  const input = { drafted: 12, mail: mailWithSends(41), replies: { replies: [] } };
  const s = buildFirstReplySurface(input, { now: NOW });
  assert.deepEqual(s.facts, outcomeLadderFacts(buildOutcomeLadder(input, { now: NOW })));
  assert.equal(s.reached, "sent");
  assert.match(s.operatorBriefLines.join("\n"), /Highest evidenced rung: sent/);
  assert.match(s.operatorBriefLines.join("\n"), /replied: not reached/);
});

test("W3: no trend language while the top rung is unreached", () => {
  const s = buildFirstReplySurface({ drafted: 12, mail: mailWithSends(41), replies: { replies: [] } }, { now: NOW });
  assert.deepEqual(surfaceTrendViolations(s), []);
});

test("W3: the feed rendering is public-safe — no handle, path, branch or operator script", () => {
  const s = buildFirstReplySurface({ drafted: 12, mail: mailWithSends(41), replies: { replies: [] } }, { now: NOW });
  const h = s.feedHeadline;
  assert.equal(/WR-R\d+/.test(h), false, "no opaque handle on the public feed");
  assert.equal(/cc\/|origin\/|senior-director-state|\.cmd\b|\.git\b/.test(h), false);
  assert.equal(/sequences|suites|commits|merges/i.test(h), false, "no software-progress counts on the outcome headline");
});

test("W3: when a reply DOES exist the surface reports it — and still not a meeting", () => {
  const s = buildFirstReplySurface({
    drafted: 12,
    mail: mailWithSends(41),
    replies: { replies: [{ handle: "WR-R001", disposition: "interested", secondMessageAt: "2026-07-28T09:00:00Z", repliedAt: "2026-07-28T13:00:00Z" }] },
  }, { now: NOW });
  assert.equal(s.reached, "replied");
  assert.match(s.feedHeadline, /Prospect replies: 1/);
  assert.match(s.feedHeadline, /Meetings booked: 0/);
  assert.match(s.feedHeadline, /Revenue to date: none/);
  assert.deepEqual(surfaceOverclaims(s), []);
});

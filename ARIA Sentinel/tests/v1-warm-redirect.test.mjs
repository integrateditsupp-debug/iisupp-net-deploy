// v1-warm-redirect.test.mjs — RUN-V V1/V2/V3 exit criteria, test-locked.
//
// V1: a ranked warm-redirect queue, expiry first-class, Rule-11 opaque handles (grep-proof).
// V2: the second message, refusable by name; no transport (static scan proves it cannot send).
// V3: reply-rate as the sixth number — unverified preserved, divide-by-zero => "not established",
//     and the ratio moves ONLY when the mail record moves.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildWarmRedirectQueue, normalizeRoute, warmRedirectFacts,
  WARM_REDIRECT_SCHEMA, EXPIRED, ROUTE_CLASSES,
  SENDS as Q_SENDS, HAS_TRANSPORT as Q_TRANSPORT, PERSISTS as Q_PERSISTS, READS_IDENTITY as Q_IDENT,
} from "../src/shared/warm-redirect-queue.mjs";
import {
  draftSecondMessage, draftQueue, REFUSABLE_CLAIMS, BANNED_PHRASES,
  SECOND_MESSAGE_SCHEMA, SENDS as M_SENDS, HAS_TRANSPORT as M_TRANSPORT,
} from "../src/shared/second-message.mjs";
import { replyRateFacts, replyRateMarkdown, NOT_ESTABLISHED, REPLY_RATE_SCHEMA } from "../src/shared/reply-rate.mjs";
import { buildOutboundTruth, UNVERIFIED, NEVER } from "../src/shared/outbound-truth.mjs";
import { whenOperatorRecords } from "../../scripts/lib/operator-record.mjs";

// RUN-BR — these assertions read a REAL operator record under senior-director-state/, which is
// untracked by design. Present here: they run for real. Absent (clean clone): the reading is
// reported NOT TAKEN rather than counted as a code failure.
const REAL_RECORD = whenOperatorRecords(new URL("../../senior-director-state", import.meta.url));

const NOW = Date.parse("2026-07-29T00:45:00Z");
const Q_SRC = "src/shared/warm-redirect-queue.mjs";
const M_SRC = "src/shared/second-message.mjs";
const R_SRC = "src/shared/reply-rate.mjs";
const RECORD = "../../senior-director-state/outbound/warm-redirect-record-2026-07-29.json";

const realRecord = () => JSON.parse(readFileSync(new URL(RECORD, import.meta.url), "utf8"));
const srcText = (rel) => readFileSync(new URL("../" + rel, import.meta.url), "utf8");

// ── V1 ───────────────────────────────────────────────────────────────────────
test("V1: module + record carry NO address or domain (vault Rule 11, grep-proof)", REAL_RECORD, () => {
  // A real address (word@word) or a bare domain (word.tld) — NOT the module's own refusal-regex `@`.
  const rx = /[a-z0-9._-]+@[a-z0-9.-]+|[a-z0-9-]+\.(com|ca|net|org|gov|io|co)\b/i;
  assert.equal(rx.test(srcText(Q_SRC)), false, "V1 module must not contain a real address/domain");
  const recRaw = readFileSync(new URL(RECORD, import.meta.url), "utf8");
  assert.equal(rx.test(recRaw), false, "record must contain no real address/domain");
  assert.equal(Q_SENDS === false && Q_TRANSPORT === false && Q_PERSISTS === false && Q_IDENT === false, true);
});

test("V1: normalizeRoute refuses an identity-carrying handle and an unknown class", () => {
  assert.equal(normalizeRoute({ handle: "someone@place.com", routeClass: "successor-firm" }).ok, false);
  assert.equal(normalizeRoute({ handle: "WR-1", routeClass: "made-up" }).ok, false);
  assert.equal(normalizeRoute({ handle: "WR-1", routeClass: "successor-firm", mode: "email" }).ok, true);
});

test("V1: expiry is first-class — an expired route is separated, never in the live queue", REAL_RECORD, () => {
  const q = buildWarmRedirectQueue(realRecord(), { now: NOW });
  assert.equal(q.schema, WARM_REDIRECT_SCHEMA);
  assert.ok(q.expired.length >= 1, "the closed redirect window must render expired");
  for (const e of q.expired) { assert.equal(e.state, EXPIRED); assert.ok(e.expiredOn); }
  const expiredHandles = new Set(q.expired.map((e) => e.handle));
  for (const live of q.queue) assert.equal(expiredHandles.has(live.handle), false, "no expired route may appear live");
});

test("V1: a passed return date outranks a future one; a reachable route beats one without a mode", REAL_RECORD, () => {
  const q = buildWarmRedirectQueue(realRecord(), { now: NOW });
  // The two passed return dates (WR-R001/R002) must sort ahead of the future ones (R008/R009/R010/R011).
  const idx = (h) => q.queue.findIndex((r) => r.handle === h);
  assert.ok(idx("WR-R001") >= 0 && idx("WR-R008") >= 0);
  assert.ok(idx("WR-R001") < idx("WR-R008"), "a passed date must rank above a future one");
  assert.ok(idx("WR-R002") < idx("WR-R009"));
  // Every live route reachable-now must precede every not-yet-reachable one.
  const firstFuture = q.queue.findIndex((r) => !r.reachableNow);
  if (firstFuture >= 0) {
    for (let i = firstFuture; i < q.queue.length; i++) assert.equal(q.queue[i].reachableNow, false);
  }
});

test("V1: facts count phone routes as phone, not email", REAL_RECORD, () => {
  const f = warmRedirectFacts(buildWarmRedirectQueue(realRecord(), { now: NOW }));
  assert.equal(f.phoneRoutes, 2, "two direct phone lines were handed back");
  assert.ok(f.emailRoutes >= 1);
  assert.ok(f.expiredRoutes >= 1);
});

// ── V2 ───────────────────────────────────────────────────────────────────────
test("V2: the module has NO transport — a static scan proves it cannot send", () => {
  const t = srcText(M_SRC);
  assert.equal(M_SENDS === false && M_TRANSPORT === false, true);
  for (const forbidden of ["nodemailer", "sendmail", "smtp", "fetch(", "http.request", "child_process", "fs.write"]) {
    assert.equal(t.includes(forbidden), false, `second-message must not reference ${forbidden}`);
  }
});

test("V2: a draft is REFUSED BY NAME for each unsupportable claim class", () => {
  const route = { handle: "WR-C003", routeClass: "redirected-to-a-colleague", mode: "email" };
  for (const claim of REFUSABLE_CLAIMS) {
    const r = draftSecondMessage(route, { assertClaims: [claim] });
    assert.equal(r.ok, false, `claim ${claim} must be refused`);
    assert.equal(r.refused, "unsupportable-claim");
    assert.ok(r.reasons.some((x) => x.includes(claim)));
  }
});

test("V2: an honest draft ships, states true provenance, and carries no banned language", REAL_RECORD, () => {
  const q = buildWarmRedirectQueue(realRecord(), { now: NOW });
  const { drafts, refused } = draftQueue(q.queue);
  assert.ok(drafts.length >= 1);
  assert.equal(refused.length, 0, "no honest queue route should refuse");
  for (const d of drafts) {
    assert.equal(d.schema, SECOND_MESSAGE_SCHEMA);
    const low = d.body.toLowerCase();
    for (const p of BANNED_PHRASES) assert.equal(low.includes(p), false, `draft must not contain "${p}"`);
    assert.equal(/@|[a-z0-9-]+\.(com|ca|net|org|gov|io)\b/i.test(d.body), false, "no identity in a draft body");
    assert.ok(d.provenance && d.provenance.length > 0);
  }
});

// ── V3 ───────────────────────────────────────────────────────────────────────
test("V3: no mail source => reply rate is `unverified`, never a number", () => {
  const rr = replyRateFacts({ events: [] }, { now: NOW });
  assert.equal(rr.schema, REPLY_RATE_SCHEMA);
  assert.equal(rr.repliesPerHundredSent, UNVERIFIED);
  assert.equal(rr.meetingsPerHundredSent, UNVERIFIED);
  assert.match(replyRateMarkdown(rr), /unverified/);
});

test("V3: zero sends => `not established`, NEVER 0%", () => {
  const rr = replyRateFacts({ source: "mail", events: [] }, { now: NOW });
  assert.equal(rr.repliesPerHundredSent, NOT_ESTABLISHED);
  assert.equal(rr.meetingsPerHundredSent, NOT_ESTABLISHED);
  assert.notEqual(rr.repliesPerHundredSent, 0);
});

test("V3: the ratio is a real number when the mail record shows sends and replies", () => {
  const rec = {
    source: "mail",
    events: [
      ...Array.from({ length: 100 }, (_, i) => ({ kind: "sent", at: "2026-07-28T10:00:00Z", handle: `S${i}` })),
      { kind: "personal-reply", at: "2026-07-28T12:00:00Z", handle: "R1", disposition: "declined" },
      { kind: "meeting-booked", at: "2026-07-28T13:00:00Z", handle: "M1" },
    ],
  };
  const rr = replyRateFacts(rec, { now: NOW });
  assert.equal(rr.repliesPerHundredSent, 1);   // 1 reply / 100 sent
  assert.equal(rr.meetingsPerHundredSent, 1);  // 1 meeting / 100 sent
});

test("V3: SOFTWARE PROGRESS CANNOT MOVE THE RATIO — only the mail record moves it (U1 immunity inherited)", () => {
  const rec = {
    source: "mail",
    events: [
      ...Array.from({ length: 50 }, (_, i) => ({ kind: "sent", at: "2026-07-28T10:00:00Z", handle: `S${i}` })),
      { kind: "personal-reply", at: "2026-07-28T12:00:00Z", handle: "R1", disposition: "interested" },
    ],
  };
  const before = replyRateFacts(rec, { now: NOW });
  // Inject non-mail "progress" the way the old broken counters accepted it. It must be ignored entirely.
  const polluted = { ...rec, sequencesCompleted: 99, tasksMerged: 42, testsGreen: 305, commits: 64, merges: 21 };
  const after = replyRateFacts(polluted, { now: NOW });
  assert.deepEqual(after, before, "no software-progress field may change the reply rate");
});

test("V3: reads through a prebuilt outbound-truth object identically to a raw record", () => {
  const rec = {
    source: "mail",
    events: [
      ...Array.from({ length: 41 }, (_, i) => ({ kind: "sent", at: "2026-07-27T10:00:00Z", handle: `S${i}` })),
      { kind: "personal-reply", at: "2026-07-27T12:00:00Z", handle: "R1", disposition: "declined" },
    ],
  };
  const viaRaw = replyRateFacts(rec, { now: NOW });
  const viaTruth = replyRateFacts(buildOutboundTruth(rec, { now: NOW }), { now: NOW });
  assert.deepEqual(viaTruth, viaRaw);
});

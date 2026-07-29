// z1-second-hour.test.mjs — RUN-Z Z1/Z2/Z3 exit criteria, test-locked.
//
// Z1: the waiting interval is COMPUTED from real dates, never chosen. It must be able to answer
//     "nothing worth doing today" and say so plainly. No invented cadence. `unverified` != "nothing today".
// Z2: silence between a send and any answer is held as a plain dated fact. It never characterises intent,
//     never escalates tone, and NO length of silence moves the ladder, the cost, or any disposition.
// Z3: the repeat is one-way and bounded. The union of everything executed across ALL hours is consumed
//     permanently, skip reasons accumulate verbatim in order, and a route actioned REPEAT_MAX times stops
//     appearing WITH THAT FACT STATED rather than silently dropped.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildWaitingInterval, renderWaitingInterval, waitingIntervalLeaks, waitingIntervalFacts,
  WAITING_INTERVAL_SCHEMA, NOTHING_TODAY, UNVERIFIED as W_UNVERIFIED,
  URGENCY_PATTERNS, NO_CADENCE_NOTE,
  SENDS as W_SENDS, HAS_TRANSPORT as W_TRANSPORT, PERSISTS as W_PERSISTS,
  READS_IDENTITY as W_IDENT, INVENTS_CADENCE,
} from "../src/shared/waiting-interval.mjs";
import {
  buildHeldSilence, renderHeldSilence, heldSilenceLeaks, heldSilenceFacts,
  applySilenceTo, messageFromSilence,
  HELD_SILENCE_SCHEMA, UNVERIFIED as H_UNVERIFIED, SILENT, ANSWERED,
  INTENT_PATTERNS, ESCALATION_PATTERNS,
  SENDS as H_SENDS, HAS_TRANSPORT as H_TRANSPORT, PERSISTS as H_PERSISTS,
  CHARACTERISES_INTENT, ESCALATES_TONE,
} from "../src/shared/held-silence.mjs";
import {
  buildRepeatedHours, renderRepeatedHours, repeatedHoursLeaks, repeatFitsOneSitting,
  executedReturnedAsLive, foldSpentHours, repeatHoursFacts,
  REPEAT_HOURS_SCHEMA, REPEAT_MAX,
  SENDS as R_SENDS, HAS_TRANSPORT as R_TRANSPORT, PERSISTS as R_PERSISTS,
} from "../src/shared/repeat-hours.mjs";
import { buildWarmRedirectQueue } from "../src/shared/warm-redirect-queue.mjs";
import { buildSpentHour } from "../src/shared/spent-hour.mjs";
import { buildOutcomeLadder } from "../src/shared/outcome-ladder.mjs";
import { buildCostOfDelay } from "../src/shared/cost-of-delay.mjs";
import { ONE_SITTING_MAX } from "../src/shared/the-hour.mjs";

const NOW = Date.parse("2026-07-29T15:00:00Z");
const W_SRC = "src/shared/waiting-interval.mjs";
const H_SRC = "src/shared/held-silence.mjs";
const R_SRC = "src/shared/repeat-hours.mjs";

const srcText = (rel) => readFileSync(new URL("../" + rel, import.meta.url), "utf8");

// A warm record with: two passed return dates, one dateless colleague route, one future return date.
const WARM_RECORD = {
  source: "operator mail, read first-hand",
  readAt: "2026-07-29T00:40:00Z",
  routes: [
    { handle: "WR-R001", routeClass: "back-from-vacation", mode: "email", reason: "stated return date passed", replyPossibleFrom: "2026-07-27T09:00:00Z" },
    { handle: "WR-R002", routeClass: "back-from-vacation", mode: "email", reason: "stated return date passed", replyPossibleFrom: "2026-07-28T09:00:00Z" },
    { handle: "WR-C003", routeClass: "redirected-to-a-colleague", mode: "email", reason: "auto-reply named a colleague" },
    { handle: "WR-C004", routeClass: "redirected-to-a-colleague", mode: "email", reason: "auto-reply named a colleague" },
    { handle: "WR-F005", routeClass: "back-from-vacation", mode: "email", reason: "stated return date is in the future", replyPossibleFrom: "2026-08-12T09:00:00Z" },
  ],
};
const warm = () => buildWarmRedirectQueue(WARM_RECORD, { now: NOW });

const spend = (spentAt, entries) => buildSpentHour({ spentAt, entries }, { now: NOW });

// ---------------------------------------------------------------------------
// Z1 — the waiting interval, computed not chosen
// ---------------------------------------------------------------------------

test("Z1 module is inert: no send, no transport, no persistence, no identity, no cadence", () => {
  assert.equal(W_SENDS, false);
  assert.equal(W_TRANSPORT, false);
  assert.equal(W_PERSISTS, false);
  assert.equal(W_IDENT, false);
  assert.equal(INVENTS_CADENCE, false);
  const src = srcText(W_SRC);
  assert.ok(!/require\(|from ["']node:fs["']|from ["']node:net["']|from ["']node:https?["']/.test(src),
    "Z1 imports no fs, net or http");
  assert.ok(!/nodemailer|smtp|sendMail|fetch\(/i.test(src), "Z1 has no send path");
});

test("Z1 answers 'nothing today' plainly when no real date supports acting", () => {
  // Every route has already been actioned, and the only unactioned one opens in the future.
  const spent = spend("2026-07-29T09:00:00Z", [
    { handle: "WR-R001", disposition: "executed", observed: "sent" },
    { handle: "WR-R002", disposition: "executed", observed: "sent" },
    { handle: "WR-C003", disposition: "skipped", skipReason: "wrong company entirely" },
    { handle: "WR-C004", disposition: "skipped", skipReason: "no budget, they said so" },
  ]);
  const w = buildWaitingInterval({ warm: warm(), spent: [spent] }, { now: NOW });
  assert.equal(w.state, NOTHING_TODAY);
  assert.equal(w.worthSittingToday, false);
  assert.equal(w.reasonsToday.length, 0);
  assert.match(renderWaitingInterval(w), /Nothing is worth sitting down for today/);
});

test("Z1 'nothing today' still names the next real date, without inventing one", () => {
  const spent = spend("2026-07-29T09:00:00Z", [
    { handle: "WR-R001", disposition: "executed", observed: "sent" },
    { handle: "WR-R002", disposition: "executed", observed: "sent" },
    { handle: "WR-C003", disposition: "skipped", skipReason: "wrong company entirely" },
    { handle: "WR-C004", disposition: "skipped", skipReason: "no budget, they said so" },
  ]);
  const w = buildWaitingInterval({ warm: warm(), spent: [spent] }, { now: NOW });
  assert.equal(w.nextRealDate, "2026-08-12T09:00:00Z");
  assert.equal(w.upcoming.length, 1);
  // The date came from the prospect's own statement, not from a rule.
  assert.equal(w.upcoming[0].because, "a prospect stated they are back on this date");
});

test("Z1 with nothing reachable and nothing upcoming says nothing today and names no date", () => {
  const empty = buildWarmRedirectQueue({ source: "mail", routes: [] }, { now: NOW });
  const w = buildWaitingInterval({ warm: empty, spent: [] }, { now: NOW });
  assert.equal(w.state, NOTHING_TODAY);
  assert.equal(w.nextRealDate, NOTHING_TODAY);
  assert.equal(w.daysUntilNextRealDate, NOTHING_TODAY);
  // No manufactured "check back in N days".
  assert.ok(!/\b\d+ days?\b/.test(w.line), "no invented interval appears in the line");
});

test("Z1 'unverified' is not 'nothing today'", () => {
  const w = buildWaitingInterval({}, { now: NOW });
  assert.equal(w.state, W_UNVERIFIED);
  assert.notEqual(w.state, NOTHING_TODAY);
  assert.equal(w.nextRealDate, W_UNVERIFIED);
  assert.match(renderWaitingInterval(w), /unverified/);
  assert.ok(!/Nothing is worth sitting down for today/.test(renderWaitingInterval(w)),
    "unverified never renders as a confident 'nothing to do'");
});

test("Z1 says today IS worth sitting down for when real dates support it", () => {
  const w = buildWaitingInterval({ warm: warm(), spent: [] }, { now: NOW });
  assert.equal(w.worthSittingToday, true);
  // Two passed return dates + two dateless reachable colleague routes.
  assert.equal(w.reasonsToday.length, 4);
  for (const r of w.reasonsToday) assert.ok(r.because.length > 0, "every reason names why");
});

test("Z1 carries no default cadence anywhere in source or output", () => {
  // Scan the EXECUTABLE body, not the prose. The header documents that no cadence exists — that sentence
  // naming the thing it forbids must not itself trip the scan.
  const code = srcText(W_SRC).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/follow.?up in \d/i.test(code), "no follow-up-in-N default in the executable body");
  assert.ok(!/\b(CADENCE|DEFAULT_INTERVAL|NUDGE_AFTER|FOLLOW_UP_DAYS)\s*=/i.test(code),
    "no interval constant exists to be applied");
  assert.ok(NO_CADENCE_NOTE.length > 0, "the absence of a cadence is stated to the operator, not implied");
  const w = buildWaitingInterval({ warm: warm(), spent: [] }, { now: NOW });
  const text = renderWaitingInterval(w);
  assert.ok(!/every \d+ days?/i.test(text), "no repeating interval is rendered");
  assert.match(text, /There is no default interval in this program/);
});

test("Z1 renders no manufactured urgency", () => {
  for (const state of [
    buildWaitingInterval({ warm: warm(), spent: [] }, { now: NOW }),
    buildWaitingInterval({}, { now: NOW }),
  ]) {
    const text = renderWaitingInterval(state);
    for (const p of URGENCY_PATTERNS) assert.ok(!p.test(text), `no urgency matching ${p}`);
    assert.deepEqual(waitingIntervalLeaks(state), []);
  }
});

test("Z1 carries no identity and its facts are counts and states only", () => {
  const w = buildWaitingInterval({ warm: warm(), spent: [] }, { now: NOW });
  assert.deepEqual(waitingIntervalLeaks(w), []);
  const f = waitingIntervalFacts(w);
  assert.equal(f.schema, WAITING_INTERVAL_SCHEMA);
  assert.equal(typeof f.reasonsToday, "number");
  assert.ok(!/@/.test(JSON.stringify(f)));
});

test("Z1 a route already actioned never counts as a reason to sit down again today", () => {
  const spent = spend("2026-07-29T09:00:00Z", [
    { handle: "WR-R001", disposition: "executed", observed: "sent" },
  ]);
  const w = buildWaitingInterval({ warm: warm(), spent: [spent] }, { now: NOW });
  assert.ok(!w.reasonsToday.some((r) => r.handle === "WR-R001"),
    "an executed route is not a reason to sit down again");
});

// ---------------------------------------------------------------------------
// Z2 — silence, held honestly
// ---------------------------------------------------------------------------

test("Z2 module is inert and declares it does not characterise intent or escalate", () => {
  assert.equal(H_SENDS, false);
  assert.equal(H_TRANSPORT, false);
  assert.equal(H_PERSISTS, false);
  assert.equal(CHARACTERISES_INTENT, false);
  assert.equal(ESCALATES_TONE, false);
  const src = srcText(H_SRC);
  assert.ok(!/require\(|from ["']node:fs["']|from ["']node:net["']/.test(src), "Z2 imports no fs or net");
  assert.ok(!/nodemailer|smtp|sendMail|fetch\(/i.test(src), "Z2 has no send path");
});

test("Z2 renders silence as a plain dated fact with its real date", () => {
  const s = buildHeldSilence({ sent: [{ handle: "WR-R001", sentOn: "2026-07-22T10:00:00Z" }] }, { now: NOW });
  assert.equal(s.heldCount, 1);
  assert.equal(s.held[0].state, SILENT);
  assert.equal(s.held[0].elapsedDays, 7);
  assert.match(s.held[0].line, /2026-07-22T10:00:00Z/);
  assert.match(s.held[0].line, /no answer has arrived/);
});

test("Z2 silence is never characterised as intent, at any elapsed length", () => {
  for (const days of [1, 7, 30, 120, 400]) {
    const sentOn = new Date(NOW - days * 86400000).toISOString();
    const s = buildHeldSilence({ sent: [{ handle: "WR-R001", sentOn }] }, { now: NOW });
    const text = renderHeldSilence(s);
    for (const p of INTENT_PATTERNS) assert.ok(!p.test(text), `${days}d: no intent matching ${p}`);
    assert.deepEqual(heldSilenceLeaks(s), [], `${days}d: no leaks`);
  }
});

test("Z2 silence never escalates tone and never produces a message", () => {
  const s = buildHeldSilence({ sent: [{ handle: "WR-R001", sentOn: "2026-05-01T10:00:00Z" }] }, { now: NOW });
  const text = renderHeldSilence(s);
  for (const p of ESCALATION_PATTERNS) assert.ok(!p.test(text), `no escalation matching ${p}`);
  assert.equal(messageFromSilence(s), null);
});

test("Z2 NO length of silence changes the outcome ladder", () => {
  const ladder = buildOutcomeLadder({
    mail: { source: "mail record", sent: 3, meetingsBooked: 0, revenue: 0 },
    replies: null,
    drafted: 12,
  }, { now: NOW });
  const before = JSON.parse(JSON.stringify(ladder));
  for (const days of [1, 30, 400]) {
    const sentOn = new Date(NOW - days * 86400000).toISOString();
    const s = buildHeldSilence({ sent: [{ handle: "WR-R001", sentOn }] }, { now: NOW });
    const after = applySilenceTo(ladder, s);
    assert.deepEqual(JSON.parse(JSON.stringify(after)), before,
      `${days} days of silence left the ladder byte-identical`);
  }
});

test("Z2 silence lowers no cost component", () => {
  const cost = buildCostOfDelay({ warm: warm() }, { now: NOW });
  const before = JSON.parse(JSON.stringify(cost));
  const s = buildHeldSilence({ sent: [{ handle: "WR-R001", sentOn: "2026-01-01T00:00:00Z" }] }, { now: NOW });
  assert.deepEqual(JSON.parse(JSON.stringify(applySilenceTo(cost, s))), before,
    "silence left the cost of delay untouched");
});

test("Z2 silence changes no route's disposition", () => {
  const q = warm();
  const before = JSON.parse(JSON.stringify(q));
  const s = buildHeldSilence({ sent: q.queue.map((r) => ({ handle: r.handle, sentOn: "2026-02-01T00:00:00Z" })) }, { now: NOW });
  assert.deepEqual(JSON.parse(JSON.stringify(applySilenceTo(q, s))), before,
    "silence left every route's disposition untouched");
});

test("Z2 an answer is not silence", () => {
  const s = buildHeldSilence({
    sent: [{ handle: "WR-R001", sentOn: "2026-07-22T10:00:00Z" }, { handle: "WR-R002", sentOn: "2026-07-22T10:00:00Z" }],
    answered: [{ handle: "WR-R002", answeredOn: "2026-07-24T08:00:00Z" }],
  }, { now: NOW });
  assert.equal(s.heldCount, 1);
  assert.equal(s.answeredCount, 1);
  assert.equal(s.answered[0].state, ANSWERED);
  assert.equal(s.held[0].handle, "WR-R001");
});

test("Z2 a send with no stated date is unverified elapsed time, not zero days", () => {
  const s = buildHeldSilence({ sent: [{ handle: "WR-R001" }] }, { now: NOW });
  assert.equal(s.held[0].elapsedDays, H_UNVERIFIED);
  assert.notEqual(s.held[0].elapsedDays, 0);
  assert.match(s.held[0].line, /unverified/);
});

test("Z2 nothing sent renders as nothing waiting, not as silence", () => {
  const s = buildHeldSilence({ sent: [] }, { now: NOW });
  assert.equal(s.heldCount, 0);
  assert.match(renderHeldSilence(s), /nothing waiting/i);
});

test("Z2 refuses an entry carrying identity and shows the refusal", () => {
  const s = buildHeldSilence({ sent: [{ handle: "someone@example.com", sentOn: "2026-07-22T10:00:00Z" }] }, { now: NOW });
  assert.equal(s.heldCount, 0);
  assert.equal(s.refused.length, 1);
  assert.match(s.refused[0].reasons[0], /Rule 11/);
  assert.deepEqual(heldSilenceLeaks(s), []);
});

test("Z2 facts state plainly that silence moves no ladder", () => {
  const s = buildHeldSilence({ sent: [{ handle: "WR-R001", sentOn: "2026-07-22T10:00:00Z" }] }, { now: NOW });
  const f = heldSilenceFacts(s);
  assert.equal(f.schema, HELD_SILENCE_SCHEMA);
  assert.equal(f.silenceMovesLadder, false);
  assert.equal(f.waiting, 1);
});

// ---------------------------------------------------------------------------
// Z3 — the repeat, one-way and bounded
// ---------------------------------------------------------------------------

test("Z3 module is inert: no send, no transport, no persistence, no identity", () => {
  assert.equal(R_SENDS, false);
  assert.equal(R_TRANSPORT, false);
  assert.equal(R_PERSISTS, false);
  const src = srcText(R_SRC);
  assert.ok(!/require\(|from ["']node:fs["']|from ["']node:net["']/.test(src), "Z3 imports no fs or net");
  assert.ok(!/nodemailer|smtp|sendMail|fetch\(/i.test(src), "Z3 has no send path");
});

test("Z3 three hours spent in sequence: no executed handle ever returns as live", () => {
  const h1 = spend("2026-07-27T09:00:00Z", [{ handle: "WR-R001", disposition: "executed", observed: "sent" }]);
  const h2 = spend("2026-07-28T09:00:00Z", [{ handle: "WR-R002", disposition: "executed", observed: "sent" }]);
  const h3 = spend("2026-07-29T09:00:00Z", [{ handle: "WR-C003", disposition: "executed", observed: "sent" }]);

  const steps = [[h1], [h1, h2], [h1, h2, h3]];
  const executedSoFar = [];
  for (const [i, spentHours] of steps.entries()) {
    executedSoFar.push(["WR-R001", "WR-R002", "WR-C003"][i]);
    const r = buildRepeatedHours({ warm: warm(), spentHours }, { now: NOW });
    for (const handle of executedSoFar) {
      assert.equal(executedReturnedAsLive(r, handle), false,
        `after hour ${i + 1}, ${handle} is not live`);
      assert.ok(r.completed.some((c) => c.handle === handle), `${handle} appears as completed`);
    }
    assert.ok(repeatFitsOneSitting(r), `hour ${i + 1} still fits one sitting`);
    assert.deepEqual(repeatedHoursLeaks(r), [], `hour ${i + 1} leak-free`);
  }
});

test("Z3 a route skipped twice for different reasons carries BOTH, verbatim and in order", () => {
  const blunt1 = "wrong company entirely - not our market";
  const blunt2 = "no budget, they said so outright";
  const h1 = spend("2026-07-27T09:00:00Z", [{ handle: "WR-C003", disposition: "skipped", skipReason: blunt1 }]);
  const h2 = spend("2026-07-28T09:00:00Z", [{ handle: "WR-C003", disposition: "skipped", skipReason: blunt2 }]);

  const folded = foldSpentHours([h1, h2]);
  assert.deepEqual(folded.skipReasons.get("WR-C003"), [blunt1, blunt2]);

  const r = buildRepeatedHours({ warm: warm(), spentHours: [h1, h2] }, { now: NOW });
  const row = r.actions.find((a) => a.handle === "WR-C003");
  assert.ok(row, "the twice-skipped route is still live at 2 < REPEAT_MAX");
  assert.deepEqual(row.skipReasons, [blunt1, blunt2]);
  assert.equal(row.skipReasons[0], blunt1, "first reason byte-identical");
  assert.equal(row.skipReasons[1], blunt2, "second reason byte-identical");
  assert.ok(row.why.indexOf(blunt1) < row.why.indexOf(blunt2), "rendered in the order they were given");
});

test("Z3 no skip reason is lost or softened across hours", () => {
  const reasons = ["they told me to go away", "budget frozen until next year", "already have an MSP"];
  const hours = reasons.map((reason, i) =>
    spend(`2026-07-2${5 + i}T09:00:00Z`, [{ handle: "WR-C004", disposition: "skipped", skipReason: reason }]));
  const folded = foldSpentHours(hours);
  assert.deepEqual(folded.skipReasons.get("WR-C004"), reasons);
  const r = buildRepeatedHours({ warm: warm(), spentHours: hours }, { now: NOW });
  const retired = r.retired.find((t) => t.handle === "WR-C004");
  assert.ok(retired, "3 skips retires the route");
  assert.deepEqual(retired.skipReasons, reasons, "every reason survives retirement verbatim");
  for (const reason of reasons) assert.match(renderRepeatedHours(r), new RegExp(escapeRe(reason)));
});

test("Z3 a route actioned REPEAT_MAX times stops appearing WITH the fact stated, not dropped", () => {
  const hours = [0, 1, 2].map((i) =>
    spend(`2026-07-2${5 + i}T09:00:00Z`, [{ handle: "WR-C004", disposition: "skipped", skipReason: `pass ${i + 1}` }]));
  const r = buildRepeatedHours({ warm: warm(), spentHours: hours }, { now: NOW });
  assert.equal(r.actions.some((a) => a.handle === "WR-C004"), false, "no longer a live action");
  const retired = r.retired.find((t) => t.handle === "WR-C004");
  assert.ok(retired, "it is stated, not silently dropped (Rule 15)");
  assert.equal(retired.actionedTimes, REPEAT_MAX);
  assert.match(renderRepeatedHours(r), /No longer appearing — stated, not silently dropped/);
});

test("Z3 retirement is a count, never a judgement about the prospect", () => {
  const hours = [0, 1, 2].map((i) =>
    spend(`2026-07-2${5 + i}T09:00:00Z`, [{ handle: "WR-C004", disposition: "skipped", skipReason: `pass ${i + 1}` }]));
  const r = buildRepeatedHours({ warm: warm(), spentHours: hours }, { now: NOW });
  const retired = r.retired.find((t) => t.handle === "WR-C004");
  assert.match(retired.recordedAs, /is not a statement about the prospect/);
  for (const p of INTENT_PATTERNS) {
    assert.ok(!p.test(retired.recordedAs), `retirement text carries no intent matching ${p}`);
  }
});

test("Z3 previously-skipped routes rank BELOW never-attempted ones", () => {
  const h1 = spend("2026-07-27T09:00:00Z", [{ handle: "WR-R001", disposition: "skipped", skipReason: "not now" }]);
  const r = buildRepeatedHours({ warm: warm(), spentHours: [h1] }, { now: NOW });
  const skippedRank = r.actions.find((a) => a.handle === "WR-R001").rank;
  const freshRanks = r.actions.filter((a) => !a.previouslySkipped).map((a) => a.rank);
  assert.ok(freshRanks.length > 0, "there are never-attempted routes to compare against");
  assert.ok(skippedRank > Math.max(...freshRanks), "the skipped route ranks last");
});

test("Z3 the artefact stays cold-executable and within one sitting at every step", () => {
  const hours = [];
  for (let i = 0; i < 3; i++) {
    hours.push(spend(`2026-07-2${6 + i}T09:00:00Z`, [
      { handle: ["WR-R001", "WR-R002", "WR-C003"][i], disposition: "executed", observed: "sent" },
    ]));
    const r = buildRepeatedHours({ warm: warm(), spentHours: hours }, { now: NOW });
    assert.ok(r.actions.length <= ONE_SITTING_MAX, `step ${i + 1} fits one sitting`);
    const text = renderRepeatedHours(r);
    assert.match(text, /THE NEXT SITTING/);
    assert.deepEqual(repeatedHoursLeaks(r), [], `step ${i + 1} carries no identity or internal reference`);
  }
});

test("Z3 with no spent hours nothing is consumed and the list is the plain first hour", () => {
  const r = buildRepeatedHours({ warm: warm(), spentHours: [] }, { now: NOW });
  assert.equal(r.hoursSpent, 0);
  assert.equal(r.completed.length, 0);
  assert.equal(r.retired.length, 0);
  assert.ok(r.actions.length > 0);
});

test("Z3 an unsourced warm queue is stated, never rendered as an empty hour", () => {
  const r = buildRepeatedHours({ spentHours: [] }, { now: NOW });
  assert.equal(r.sourced, false);
  assert.match(renderRepeatedHours(r), /No warm-route record was supplied/);
});

test("Z3 facts are counts only and name the bound", () => {
  const h1 = spend("2026-07-27T09:00:00Z", [{ handle: "WR-R001", disposition: "executed", observed: "sent" }]);
  const f = repeatHoursFacts(buildRepeatedHours({ warm: warm(), spentHours: [h1] }, { now: NOW }));
  assert.equal(f.schema, REPEAT_HOURS_SCHEMA);
  assert.equal(f.repeatMax, REPEAT_MAX);
  assert.equal(f.hoursSpent, 1);
  assert.equal(f.completed, 1);
  assert.ok(!/@/.test(JSON.stringify(f)));
});

test("Z3 an hour with no operator entry consumes nothing", () => {
  const notSpent = buildSpentHour({}, { now: NOW });
  assert.equal(notSpent.spent, false);
  const r = buildRepeatedHours({ warm: warm(), spentHours: [notSpent] }, { now: NOW });
  assert.equal(r.hoursSpent, 0);
  assert.equal(r.completed.length, 0);
});

// ---------------------------------------------------------------------------
// Cross-module: the three answer the same question consistently
// ---------------------------------------------------------------------------

test("Z1+Z3 agree: when every route is retired or executed there is nothing to sit down for", () => {
  const hours = [
    spend("2026-07-26T09:00:00Z", [
      { handle: "WR-R001", disposition: "executed", observed: "sent" },
      { handle: "WR-R002", disposition: "executed", observed: "sent" },
      { handle: "WR-C003", disposition: "executed", observed: "sent" },
      { handle: "WR-C004", disposition: "executed", observed: "sent" },
    ]),
  ];
  const r = buildRepeatedHours({ warm: warm(), spentHours: hours }, { now: NOW });
  const w = buildWaitingInterval({ warm: warm(), spent: hours }, { now: NOW });
  assert.equal(r.actions.length, 0);
  assert.equal(w.worthSittingToday, false);
  assert.match(renderRepeatedHours(r), /Nothing to do this sitting/);
});

test("Z1+Z2+Z3 none of the three can be made to invent a send from software progress", () => {
  const junk = { sequencesCompleted: 26, tasksMerged: 99, testsGreen: 400, commits: 1000 };
  const w = buildWaitingInterval({ warm: warm(), spent: [], ...junk }, { now: NOW });
  assert.equal(w.reasonsToday.length, 4, "build counters added no reason to act");
  const s = buildHeldSilence({ sent: [], ...junk }, { now: NOW });
  assert.equal(s.heldCount, 0, "build counters produced no waiting send");
  const r = buildRepeatedHours({ warm: warm(), spentHours: [], ...junk }, { now: NOW });
  assert.equal(r.completed.length, 0, "build counters completed nothing");
});

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

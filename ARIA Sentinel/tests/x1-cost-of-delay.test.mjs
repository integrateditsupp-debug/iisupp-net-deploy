// x1-cost-of-delay.test.mjs — RUN-X X1/X2/X3 exit criteria, test-locked.
//
// X1: the cost of delay rises by construction. Software progress cannot lower it; only a send, a
//     landing or a reply can. `unverified` stays distinct from 0.
// X2: the hour is executable cold — one self-contained artefact, no identity, no internal paths,
//     closed windows listed as losses and never re-ranked as live, and it fits one sitting.
// X3: the two blockers render byte-identically on feed, ledger and brief, each carrying X1's real
//     number, and neither can be marked resolved without its real event.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildCostOfDelay, costFacts, costMarkdown, wholeDaysBetween,
  COST_OF_DELAY_SCHEMA, UNVERIFIED, DISCARDED_INPUTS, REDUCING_EVENTS,
  SENDS as C_SENDS, HAS_TRANSPORT as C_TRANSPORT, PERSISTS as C_PERSISTS, READS_IDENTITY as C_IDENT,
} from "../src/shared/cost-of-delay.mjs";
import {
  buildTheHour, renderHour, hourLeaks, fitsOneSitting,
  ONE_SITTING_MAX, THE_HOUR_SCHEMA,
  SENDS as H_SENDS, HAS_TRANSPORT as H_TRANSPORT,
} from "../src/shared/the-hour.mjs";
import {
  buildBlockerSurface, blockerLines, allBlockerRenderings, blockerDrift,
  feedRendering, ledgerRendering, briefRendering, BLOCKER_KEYS,
} from "../src/shared/blocker-surface.mjs";
import { buildWarmRedirectQueue } from "../src/shared/warm-redirect-queue.mjs";
import { whenOperatorRecords } from "../../scripts/lib/operator-record.mjs";

// RUN-BR — these assertions read a REAL operator record under senior-director-state/, which is
// untracked by design. Present here: they run for real. Absent (clean clone): the reading is
// reported NOT TAKEN rather than counted as a code failure.
const REAL_RECORD = whenOperatorRecords(new URL("../../senior-director-state", import.meta.url));

const NOW = Date.parse("2026-07-29T03:00:00Z");
const C_SRC = "src/shared/cost-of-delay.mjs";
const H_SRC = "src/shared/the-hour.mjs";
const B_SRC = "src/shared/blocker-surface.mjs";
const WARM_RECORD = "../../senior-director-state/outbound/warm-redirect-record-2026-07-29.json";

const srcText = (rel) => readFileSync(new URL("../" + rel, import.meta.url), "utf8");
const realWarmRaw = () => readFileSync(new URL(WARM_RECORD, import.meta.url), "utf8");
const realWarmQueue = () => buildWarmRedirectQueue(JSON.parse(realWarmRaw()), { now: NOW });

const baseInput = () => ({
  landing: { sequencesBuilt: 24, sequencesLanded: 0 },
  mail: { lastSentAt: "2026-07-26T14:00:00Z" },
  warm: realWarmQueue(),
  replies: { repliesReceived: 0 },
});

// ---------------------------------------------------------------------------------------------
// X1 — the cost-of-delay counter
// ---------------------------------------------------------------------------------------------

test("X1: the modules are pure — no send, no transport, no persistence, no identity", () => {
  assert.equal(C_SENDS, false);
  assert.equal(C_TRANSPORT, false);
  assert.equal(C_PERSISTS, false);
  assert.equal(C_IDENT, false);
  assert.equal(H_SENDS, false);
  assert.equal(H_TRANSPORT, false);
  for (const rel of [C_SRC, H_SRC, B_SRC]) {
    const s = srcText(rel);
    assert.equal(/require\(["']node:net|node:http|nodemailer|child_process|node:fs["']\)/.test(s), false, `${rel} imports a transport`);
    assert.equal(/from ["']node:(net|http|https|child_process|fs)["']/.test(s), false, `${rel} imports a transport or fs`);
    assert.equal(/\.send\s*\(|sendMail|smtp/i.test(s), false, `${rel} contains a send path`);
  }
});

test("X1: the cost is computed from real dates and reports each component separately", REAL_RECORD, () => {
  const c = buildCostOfDelay(baseInput(), { now: NOW });
  assert.equal(c.schema, COST_OF_DELAY_SCHEMA);
  assert.equal(c.unlandedSequences, 24);
  assert.equal(c.daysSinceMailLeft, 2);            // 2026-07-26T14:00Z -> 2026-07-29T03:00Z = 2 whole days
  assert.equal(c.warmWindowsClosed, 1);            // WR-X013 expired 2026-07-28
  assert.equal(c.costIndex, 24 + 1 + 2);
  assert.equal(c.components.length, 3);
});

test("X1: software progress is discarded unread — the cost is byte-identical after injecting all of it", REAL_RECORD, () => {
  const before = buildCostOfDelay(baseInput(), { now: NOW });
  const poisoned = baseInput();
  for (const k of DISCARDED_INPUTS) poisoned[k] = 999;
  const after = buildCostOfDelay(poisoned, { now: NOW });
  assert.deepEqual(after, before, "software progress changed the cost of delay");
});

test("X1: shipping another sequence RAISES the cost, it never lowers it", REAL_RECORD, () => {
  const before = buildCostOfDelay(baseInput(), { now: NOW });
  const more = baseInput();
  more.landing.sequencesBuilt = 25;
  const after = buildCostOfDelay(more, { now: NOW });
  assert.ok(after.costIndex > before.costIndex, "a new verified sequence must raise the cost, not lower it");
});

test("X1: only a real event lowers a component — a landing lowers unlanded, a send lowers days", REAL_RECORD, () => {
  const before = buildCostOfDelay(baseInput(), { now: NOW });

  const landed = baseInput();
  landed.landing.sequencesLanded = 24;
  const afterLanding = buildCostOfDelay(landed, { now: NOW });
  assert.equal(afterLanding.unlandedSequences, 0);
  assert.ok(afterLanding.costIndex < before.costIndex);

  const sent = baseInput();
  sent.mail.lastSentAt = "2026-07-29T02:00:00Z";
  const afterSend = buildCostOfDelay(sent, { now: NOW });
  assert.equal(afterSend.daysSinceMailLeft, 0);
  assert.ok(afterSend.costIndex < before.costIndex);

  assert.deepEqual(REDUCING_EVENTS.map((e) => e.key), ["send", "landing", "reply"]);
});

test("X1: a reply retires an at-risk window — the only honest way that component falls", REAL_RECORD, () => {
  const before = buildCostOfDelay(baseInput(), { now: NOW });
  const replied = baseInput();
  replied.replies.repliesReceived = 1;
  const after = buildCostOfDelay(replied, { now: NOW });
  assert.equal(after.warmWindowsAtRisk, before.warmWindowsAtRisk - 1);
});

test("X1: `unverified` is distinct from 0 — a missing date is never rendered as no cost", REAL_RECORD, () => {
  const noMail = buildCostOfDelay({ landing: { sequencesBuilt: 24, sequencesLanded: 0 }, warm: realWarmQueue() }, { now: NOW });
  assert.equal(noMail.daysSinceMailLeft, UNVERIFIED);
  assert.notEqual(noMail.daysSinceMailLeft, 0);
  assert.equal(noMail.costIndex, UNVERIFIED, "an unverified component must not silently sum as zero");

  const noLanding = buildCostOfDelay({ mail: { lastSentAt: "2026-07-26T14:00:00Z" }, warm: realWarmQueue() }, { now: NOW });
  assert.equal(noLanding.unlandedSequences, UNVERIFIED);
  assert.equal(noLanding.costIndex, UNVERIFIED);
});

test("X1: time alone raises the cost — the number rises with no input change at all", REAL_RECORD, () => {
  const early = buildCostOfDelay(baseInput(), { now: NOW });
  const later = buildCostOfDelay(baseInput(), { now: NOW + 3 * 86400000 });
  assert.ok(later.costIndex > early.costIndex);
});

test("X1: the cost carries no identity and no dollar claim", REAL_RECORD, () => {
  const c = buildCostOfDelay(baseInput(), { now: NOW });
  const text = JSON.stringify(c) + costMarkdown(c);
  assert.equal(/@|\.(com|ca|net|org|gov|io)\b/i.test(text), false, "cost surface carries an address or domain (Rule 11)");
  assert.equal(/\$|CAD|USD|revenue lost|dollars/i.test(text), false, "cost must never be rendered as money");
  assert.match(costMarkdown(c), /not money/);
  assert.equal(costFacts(c).costIndex, c.costIndex);
});

test("X1: whole-day arithmetic floors at zero and never goes negative", () => {
  assert.equal(wholeDaysBetween(NOW, NOW - 86400000), 0);
  assert.equal(wholeDaysBetween(NOW - 86400000, NOW), 1);
  assert.equal(wholeDaysBetween(null, NOW), null);
});

// ---------------------------------------------------------------------------------------------
// X2 — the hour, executable without reading anything first
// ---------------------------------------------------------------------------------------------

test("X2: the hour is built from the real warm record and is ranked, not arbitrary", REAL_RECORD, () => {
  const h = buildTheHour({ warm: realWarmQueue() }, { now: NOW });
  assert.equal(h.schema, THE_HOUR_SCHEMA);
  assert.equal(h.sourced, true);
  assert.ok(h.actions.length > 0, "there are reachable routes in the real record");
  h.actions.forEach((a, i) => assert.equal(a.rank, i + 1));
  // The two already-passed return dates lead — V1's ranking is preserved, not re-sorted here.
  assert.equal(h.actions[0].handle, "WR-R001");
  assert.equal(h.actions[1].handle, "WR-R002");
});

test("X2: every action carries its own body and its own reason — no prior context needed", REAL_RECORD, () => {
  const h = buildTheHour({ warm: realWarmQueue() }, { now: NOW });
  for (const a of h.actions) {
    assert.ok(a.body && a.body.length > 40, `action ${a.handle} has no usable message body`);
    assert.ok(a.why && /^#\d+ —/.test(a.why), `action ${a.handle} does not state why it ranks there`);
    assert.ok(a.modeAction && a.modeAction.length > 10);
  }
  assert.match(renderHour(h), /Nothing to read first/);
});

test("X2: a phone route is told to be called, never mailed", REAL_RECORD, () => {
  const h = buildTheHour({ warm: realWarmQueue() }, { now: NOW });
  const phone = h.actions.filter((a) => a.mode === "phone");
  for (const p of phone) assert.match(p.modeAction, /Call it — do not send this as mail/);
});

test("X2: the artefact leaks nothing — no identity, no internal path, no branch, no script name", REAL_RECORD, () => {
  const h = buildTheHour({ warm: realWarmQueue() }, { now: NOW });
  assert.deepEqual(hourLeaks(h), []);
});

test("X2: closed windows are listed as losses with their date and never re-ranked as live", REAL_RECORD, () => {
  const h = buildTheHour({ warm: realWarmQueue() }, { now: NOW });
  assert.equal(h.closed.length, 1);
  assert.equal(h.closed[0].handle, "WR-X013");
  assert.match(h.closed[0].recordedAs, /a loss/);
  assert.equal(h.actions.some((a) => a.handle === "WR-X013"), false, "a closed window appeared in the live action list");
  assert.match(renderHour(h), /Closed windows — recorded losses/);
});

test("X2: routes that are not open yet are separated out, with the prospect's own date", REAL_RECORD, () => {
  const h = buildTheHour({ warm: realWarmQueue() }, { now: NOW });
  assert.ok(h.notYetOpen.length > 0);
  for (const r of h.notYetOpen) {
    assert.ok(r.opensOn, "a future route must carry the date the prospect stated");
    assert.equal(h.actions.some((a) => a.handle === r.handle), false);
  }
  assert.match(renderHour(h), /Not open yet — do not act on these/);
});

test("X2: the sitting fits one sitting, and overflow is stated rather than silently truncated", REAL_RECORD, () => {
  const h = buildTheHour({ warm: realWarmQueue() }, { now: NOW });
  assert.ok(fitsOneSitting(h));
  assert.ok(h.actions.length <= ONE_SITTING_MAX);
  if (h.overflow > 0) assert.match(renderHour(h), /held for the next one, not dropped/);
});

test("X2: with no record the artefact says so — it never renders a confident empty hour", () => {
  const h = buildTheHour({}, { now: NOW });
  assert.equal(h.sourced, false);
  assert.equal(h.actions.length, 0);
  assert.match(renderHour(h), /stated rather than rendered as an empty hour/);
});

test("X2: the real warm record itself carries no identity (Rule 11 re-proved at source)", REAL_RECORD, () => {
  const raw = realWarmRaw();
  assert.equal(/@/.test(raw.replace(/"[^"]*rule11[^"]*"\s*:\s*"[^"]*"/gi, "")), false, "warm record carries an address");
});

// ---------------------------------------------------------------------------------------------
// X3 — the two blockers, named on every surface with their price
// ---------------------------------------------------------------------------------------------

test("X3: exactly the two named blockers, each stated as the operator's click", REAL_RECORD, () => {
  const s = buildBlockerSurface({ cost: buildCostOfDelay(baseInput(), { now: NOW }), secondMessagesSent: 0 });
  assert.deepEqual(s.blockers.map((b) => b.key), [...BLOCKER_KEYS]);
  for (const b of s.blockers) assert.match(b.whose, /operator's click/);
});

test("X3: feed, ledger and brief render byte-identical blocker lines", REAL_RECORD, () => {
  const s = buildBlockerSurface({ cost: buildCostOfDelay(baseInput(), { now: NOW }), secondMessagesSent: 0 });
  const r = allBlockerRenderings(s);
  assert.deepEqual(r.ledger, r.feed);
  assert.deepEqual(r.brief, r.feed);
  assert.deepEqual(blockerDrift(s), []);
  // the wrappers differ, the content does not
  assert.notEqual(ledgerRendering(s), briefRendering(s));
  assert.ok(feedRendering(s).includes(blockerLines(s)[0]));
});

test("X3: each blocker carries X1's real number, unchanged", REAL_RECORD, () => {
  const c = buildCostOfDelay(baseInput(), { now: NOW });
  const s = buildBlockerSurface({ cost: c, secondMessagesSent: 0 });
  const lines = blockerLines(s);
  assert.match(lines[0], new RegExp(`daysSinceMailLeft ${c.daysSinceMailLeft}`));
  assert.match(lines[0], new RegExp(`warmWindowsClosed ${c.warmWindowsClosed}`));
  assert.match(lines[1], new RegExp(`unlandedSequences ${c.unlandedSequences}`));
  assert.equal(s.costIndex, c.costIndex);
});

test("X3: neither blocker can be marked resolved without its real event", REAL_RECORD, () => {
  const c = buildCostOfDelay(baseInput(), { now: NOW });
  const open = buildBlockerSurface({ cost: c, secondMessagesSent: 0 });
  assert.deepEqual(open.blockers.map((b) => b.resolved), [false, false]);
  assert.match(blockerLines(open)[0], /open\./);

  // there is no override: passing a resolve flag does nothing
  const forced = buildBlockerSurface({ cost: c, secondMessagesSent: 0, resolved: true, force: true });
  assert.deepEqual(forced.blockers.map((b) => b.resolved), [false, false]);
  assert.deepEqual(blockerDrift(forced), []);
});

test("X3: a real send clears the unsent hour — and only that blocker", REAL_RECORD, () => {
  const c = buildCostOfDelay(baseInput(), { now: NOW });
  const s = buildBlockerSurface({ cost: c, secondMessagesSent: 3 });
  assert.equal(s.blockers[0].resolved, true);
  assert.match(s.blockers[0].resolvedBecause, /3 second message\(s\) actually left/);
  assert.equal(s.blockers[1].resolved, false, "sending mail must not clear the credential blocker");
});

test("X3: a landed line clears the credential blocker — and only that blocker", REAL_RECORD, () => {
  const landed = baseInput();
  landed.landing.sequencesLanded = 24;
  const s = buildBlockerSurface({ cost: buildCostOfDelay(landed, { now: NOW }), secondMessagesSent: 0 });
  assert.equal(s.blockers[1].resolved, true);
  assert.equal(s.blockers[0].resolved, false);
});

test("X3: an unverified count is never read as clear", REAL_RECORD, () => {
  const c = buildCostOfDelay({ mail: { lastSentAt: "2026-07-26T14:00:00Z" }, warm: realWarmQueue() }, { now: NOW });
  const s = buildBlockerSurface({ cost: c, secondMessagesSent: 0 });
  assert.equal(s.blockers[1].resolved, false);
  assert.match(s.blockers[1].resolvedBecause, /unverified/);
  assert.match(blockerLines(s)[1], /unlandedSequences unverified/);
});

test("X3: the blocker lines carry no identity and no invented urgency", REAL_RECORD, () => {
  const s = buildBlockerSurface({ cost: buildCostOfDelay(baseInput(), { now: NOW }), secondMessagesSent: 0 });
  const text = blockerLines(s).join(" ");
  assert.equal(/@|\.(com|ca|net|org|gov|io)\b/i.test(text), false);
  assert.equal(/urgent|act now|last chance|hurry|deadline/i.test(text), false, "no invented urgency");
  assert.equal(/WR-[A-Z]\d+/.test(text), false, "no opaque handle on a public-facing blocker line");
});

// y1-spent-hour.test.mjs — RUN-Y Y1/Y2/Y3 exit criteria, test-locked.
//
// Y1: an hour is spent only when the OPERATOR says so. `not spent` != `0 actions` != `unverified`.
//     A skip is a first-class entry with its reason, stored verbatim and never softened.
// Y2: the change set is empty when nothing real moved, and no software-progress input can populate it.
// Y3: an executed action can never reappear as a live action; skips carry their reason forward and rank
//     below never-attempted routes; the artefact stays cold-executable, leak-free and one sitting.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildSpentHour, normalizeEntry, spentHourFacts, spentHourMarkdown,
  SPENT_HOUR_SCHEMA, NOT_SPENT, UNVERIFIED as S_UNVERIFIED, DISPOSITIONS,
  DISCARDED_INPUTS as S_DISCARDED,
  SENDS as S_SENDS, HAS_TRANSPORT as S_TRANSPORT, PERSISTS as S_PERSISTS,
  READS_IDENTITY as S_IDENT, INFERS_SENDS,
} from "../src/shared/spent-hour.mjs";
import {
  buildHourChange, renderHourChange, hourChangeFacts,
  HOUR_CHANGE_SCHEMA, NO_CHANGE_LINE, NOT_SPENT_LINE,
  DISCARDED_INPUTS as C_DISCARDED,
  SENDS as C_SENDS, HAS_TRANSPORT as C_TRANSPORT, PERSISTS as C_PERSISTS,
} from "../src/shared/hour-change.mjs";
import {
  buildNextHour, renderNextHour, nextHourLeaks, nextFitsOneSitting, executedLeakedBackAsLive,
  NEXT_HOUR_SCHEMA, SENDS as N_SENDS, HAS_TRANSPORT as N_TRANSPORT, PERSISTS as N_PERSISTS,
} from "../src/shared/next-hour.mjs";
import { buildWarmRedirectQueue } from "../src/shared/warm-redirect-queue.mjs";
import { buildCostOfDelay } from "../src/shared/cost-of-delay.mjs";
import { buildOutcomeLadder } from "../src/shared/outcome-ladder.mjs";
import { buildTheHour, ONE_SITTING_MAX } from "../src/shared/the-hour.mjs";
import { whenOperatorRecords } from "../../scripts/lib/operator-record.mjs";

// RUN-BR — these assertions read a REAL operator record under senior-director-state/, which is
// untracked by design. Present here: they run for real. Absent (clean clone): the reading is
// reported NOT TAKEN rather than counted as a code failure.
const REAL_RECORD = whenOperatorRecords(new URL("../../senior-director-state", import.meta.url));

const NOW = Date.parse("2026-07-29T15:00:00Z");
const S_SRC = "src/shared/spent-hour.mjs";
const C_SRC = "src/shared/hour-change.mjs";
const N_SRC = "src/shared/next-hour.mjs";
const WARM_RECORD = "../../senior-director-state/outbound/warm-redirect-record-2026-07-29.json";
const SPENT_RECORD = "../../senior-director-state/outbound/spent-hour-record-2026-07-29.json";

const srcText = (rel) => readFileSync(new URL("../" + rel, import.meta.url), "utf8");
const realWarmRaw = () => readFileSync(new URL(WARM_RECORD, import.meta.url), "utf8");
const realWarmQueue = () => buildWarmRedirectQueue(JSON.parse(realWarmRaw()), { now: NOW });
const realSpentRaw = () => readFileSync(new URL(SPENT_RECORD, import.meta.url), "utf8");

const softwareProgress = () => ({
  sequencesCompleted: 25, tasksMerged: 99, testsGreen: 400, commits: 500, merges: 60,
  suitesGreen: 310, filesChanged: 900, runsCompleted: 135, linesChanged: 40000, modulesBuilt: 80,
});

// ---------------------------------------------------------------------------------------------
// Y1 — the spent-hour record
// ---------------------------------------------------------------------------------------------

test("Y1: the modules are pure — no send, no transport, no persistence, no identity, no inference", () => {
  for (const f of [S_SENDS, S_TRANSPORT, S_PERSISTS, S_IDENT, INFERS_SENDS,
                   C_SENDS, C_TRANSPORT, C_PERSISTS, N_SENDS, N_TRANSPORT, N_PERSISTS]) {
    assert.equal(f, false);
  }
  for (const rel of [S_SRC, C_SRC, N_SRC]) {
    const t = srcText(rel);
    assert.ok(!/require\(|from ["']node:fs["']|from ["']node:net["']|from ["']node:https?["']/.test(t),
      `${rel} must not import fs/net/http`);
    assert.ok(!/nodemailer|smtp|sendMail|googleapis/i.test(t), `${rel} must carry no transport`);
  }
});

test("Y1: no operator entry renders `not spent` — distinct from 0 actions and from unverified", () => {
  const s = buildSpentHour({}, { now: NOW });
  assert.equal(s.schema, SPENT_HOUR_SCHEMA);
  assert.equal(s.state, NOT_SPENT);
  assert.equal(s.spent, false);
  assert.equal(s.executedCount, NOT_SPENT);
  assert.notEqual(s.executedCount, 0);
  assert.notEqual(s.executedCount, S_UNVERIFIED);
  assert.equal(s.spentAt, S_UNVERIFIED);
});

test("Y1: an hour the operator sat down for and executed nothing is `0`, NOT `not spent`", () => {
  const s = buildSpentHour({ spentAt: "2026-07-29T14:00:00Z", entries: [] }, { now: NOW });
  assert.equal(s.spent, true);
  assert.equal(s.state, "spent");
  assert.equal(s.executedCount, 0);
  assert.notEqual(s.executedCount, NOT_SPENT);
  assert.match(s.note, /sitting down and doing nothing is different from never sitting down/i);
});

test("Y1: a fully-populated hour artefact with NO operator entry still renders `not spent` — nothing is inferred", REAL_RECORD, () => {
  const hour = buildTheHour({ warm: realWarmQueue() }, { now: NOW });
  assert.ok(hour.actions.length > 0, "fixture sanity: the hour has drafted actions");
  // Every draft in the world does not make a send.
  const s = buildSpentHour({ hour, drafts: hour.actions.length, elapsedHours: 48 }, { now: NOW });
  assert.equal(s.state, NOT_SPENT);
  assert.equal(s.executed.length, 0);
});

test("Y1: a skip is a first-class entry and its reason is stored VERBATIM, never softened", () => {
  const blunt = "not worth my time, this lead was junk from the start";
  const s = buildSpentHour({
    spentAt: "2026-07-29T14:00:00Z",
    entries: [
      { handle: "WR-R001", disposition: "executed", observed: "sent on the existing thread" },
      { handle: "WR-C003", disposition: "skipped", skipReason: blunt },
    ],
  }, { now: NOW });
  assert.equal(s.skippedCount, 1);
  assert.equal(s.skipped[0].skipReason, blunt); // byte-identical
  assert.ok(spentHourMarkdown(s).includes(blunt));
});

test("Y1: a skip with no reason is refused, not stored as a silent absence", () => {
  const s = buildSpentHour({
    spentAt: "2026-07-29T14:00:00Z",
    entries: [{ handle: "WR-C004", disposition: "skipped" }],
  }, { now: NOW });
  assert.equal(s.skippedCount, 0);
  assert.equal(s.refused.length, 1);
  assert.match(s.refused[0].refusals.join(" "), /skip without a reason is not a record/i);
});

test("Y1: an unknown disposition is refused, never coerced into `executed`", () => {
  const n = normalizeEntry({ handle: "WR-R002", disposition: "probably sent" });
  assert.equal(n.ok, false);
  assert.equal(n.disposition, null);
  assert.match(n.refusals.join(" "), /not one of executed, skipped/i);
  assert.deepEqual(DISPOSITIONS, ["executed", "skipped"]);
});

test("Y1: software-progress inputs are accepted at the door and discarded unread", () => {
  const base = { spentAt: "2026-07-29T14:00:00Z", entries: [{ handle: "WR-R001", disposition: "executed" }] };
  const a = buildSpentHour(base, { now: NOW });
  const b = buildSpentHour({ ...base, ...softwareProgress() }, { now: NOW });
  assert.deepEqual(a, b);
  for (const k of S_DISCARDED) assert.ok(srcText(S_SRC).includes(k), `${k} must be named as discarded`);
});

test("Y1: no identity anywhere — module, entries, or the real record (vault Rule 11)", REAL_RECORD, () => {
  const ADDR = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
  assert.ok(!ADDR.test(srcText(S_SRC)), "module must carry no address");
  assert.ok(!ADDR.test(realSpentRaw()), "the real spent-hour record must carry no address");
  const n = normalizeEntry({ handle: "WR-R001", disposition: "executed", observed: "replied from ops@acme.com" });
  assert.equal(n.ok, false);
  assert.match(n.refusals.join(" "), /address or a domain/i);
});

test("Y1: the REAL record is honest — the hour has not been spent", REAL_RECORD, () => {
  const rec = JSON.parse(realSpentRaw());
  const s = buildSpentHour(rec, { now: NOW });
  assert.equal(s.state, NOT_SPENT);
  assert.equal(s.spent, false);
  assert.equal(spentHourFacts(s).state, NOT_SPENT);
  assert.match(spentHourMarkdown(s), /not spent/);
});

// ---------------------------------------------------------------------------------------------
// Y2 — what visibly changed
// ---------------------------------------------------------------------------------------------

const snapshot = ({ landed = 0, lastSentAt = "2026-07-26T14:00:00Z", drafted = 12, sent = 0 } = {}) => ({
  cost: buildCostOfDelay({
    landing: { sequencesBuilt: 25, sequencesLanded: landed },
    mail: { lastSentAt },
    warm: realWarmQueue(),
    replies: { repliesReceived: 0 },
  }, { now: NOW }),
  ladder: buildOutcomeLadder({
    drafted,
    mail: {
      source: "the operator's own mailbox",
      readAt: "2026-07-29T00:40:00Z",
      events: Array.from({ length: sent }, (_, i) => ({
        kind: "sent", at: "2026-07-29T13:0" + i + ":00Z", handle: "WR-T00" + i,
      })),
    },
  }, { now: NOW }),
  warm: realWarmQueue(),
});

test("Y2: an hour that is not spent produces no diff and says so — not a change set of zero", REAL_RECORD, () => {
  const c = buildHourChange({ spent: buildSpentHour({}, { now: NOW }), before: snapshot(), after: snapshot() }, { now: NOW });
  assert.equal(c.schema, HOUR_CHANGE_SCHEMA);
  assert.equal(c.hourWasSpent, false);
  assert.equal(c.changed, false);
  assert.equal(renderHourChange(c), NOT_SPENT_LINE);
});

test("Y2: a spent hour with zero real events produces an EMPTY change set", REAL_RECORD, () => {
  const spent = buildSpentHour({
    spentAt: "2026-07-29T14:00:00Z",
    entries: [{ handle: "WR-R001", disposition: "executed", observed: "sent" }],
  }, { now: NOW });
  const same = snapshot();
  const c = buildHourChange({ spent, before: same, after: same }, { now: NOW });
  assert.equal(c.hourWasSpent, true);
  assert.equal(c.changes.length, 0);
  assert.equal(renderHourChange(c), NO_CHANGE_LINE);
  assert.match(NO_CHANGE_LINE, /nothing has changed yet/i);
});

test("Y2: no software-progress input can populate the change set", REAL_RECORD, () => {
  const spent = buildSpentHour({ spentAt: "2026-07-29T14:00:00Z", entries: [] }, { now: NOW });
  const same = snapshot();
  const a = buildHourChange({ spent, before: same, after: same }, { now: NOW });
  const b = buildHourChange({ spent, before: same, after: same, ...softwareProgress() }, { now: NOW });
  assert.deepEqual(a.changes, b.changes);
  assert.equal(b.changed, false);
  for (const k of C_DISCARDED) assert.ok(srcText(C_SRC).includes(k), `${k} must be named as discarded`);
});

test("Y2: a real send moves a cost component and the change is reported with its direction", REAL_RECORD, () => {
  const spent = buildSpentHour({
    spentAt: "2026-07-29T14:00:00Z",
    entries: [{ handle: "WR-R001", disposition: "executed", observed: "sent on the existing thread" }],
  }, { now: NOW });
  const before = snapshot({ lastSentAt: "2026-07-26T14:00:00Z" });
  const after = snapshot({ lastSentAt: "2026-07-29T14:00:00Z" });
  const c = buildHourChange({ spent, before, after }, { now: NOW });
  const days = c.changes.find((x) => x.key === "daysSinceMailLeft");
  assert.ok(days, "days-since-mail must register as a change");
  assert.equal(days.direction, "fell");
  assert.ok(days.to < days.from);
});

test("Y2: a rung that gains its own evidence is reported; a worsening number is never hidden", REAL_RECORD, () => {
  const spent = buildSpentHour({ spentAt: "2026-07-29T14:00:00Z", entries: [] }, { now: NOW });
  const c = buildHourChange({
    spent,
    before: snapshot({ sent: 0 }),
    after: snapshot({ sent: 3 }),
  }, { now: NOW });
  const rung = c.changes.find((x) => x.kind === "ladder-rung" && x.key === "sent");
  assert.ok(rung, "the `sent` rung must register when it gains its own evidence");
  assert.equal(rung.direction, "gained evidence");
  // and a rise is still rendered as a rise
  const worse = buildHourChange({
    spent,
    before: snapshot({ landed: 5 }),
    after: snapshot({ landed: 0 }),
  }, { now: NOW });
  const rose = worse.changes.find((x) => x.direction === "rose");
  assert.ok(rose, "a worsening component must be reported, not hidden because the hour was spent");
});

test("Y2: an unverified side is an absence, never a movement", REAL_RECORD, () => {
  const spent = buildSpentHour({ spentAt: "2026-07-29T14:00:00Z", entries: [] }, { now: NOW });
  const before = { cost: buildCostOfDelay({}, { now: NOW }), ladder: snapshot().ladder, warm: realWarmQueue() };
  const after = snapshot();
  const c = buildHourChange({ spent, before, after }, { now: NOW });
  assert.ok(!c.changes.some((x) => x.kind === "cost-component" && x.from === "unverified"));
  assert.equal(hourChangeFacts(c).schema, HOUR_CHANGE_SCHEMA);
});

test("Y2: nothing the operator READS carries celebration language", REAL_RECORD, () => {
  const spent = buildSpentHour({ spentAt: "2026-07-29T14:00:00Z", entries: [] }, { now: NOW });
  const rendered = [
    NO_CHANGE_LINE,
    NOT_SPENT_LINE,
    renderHourChange(buildHourChange({ spent, before: snapshot({ lastSentAt: "2026-07-26T14:00:00Z" }), after: snapshot({ lastSentAt: "2026-07-29T14:00:00Z" }) }, { now: NOW })),
    renderHourChange(buildHourChange({ spent, before: snapshot({ sent: 0 }), after: snapshot({ sent: 3 }) }, { now: NOW })),
  ].join("\n");
  assert.ok(!/\b(great|awesome|momentum|streak|congrat|well done|nice work|on a roll|keep it up)\b/i.test(rendered),
    "operator-facing change text must report arithmetic, not cheer");
  // and the ban is declared in the source, so a future edit has to argue with it
  assert.match(srcText(C_SRC), /NO CELEBRATION LANGUAGE/);
});

// ---------------------------------------------------------------------------------------------
// Y3 — the next hour, priced by the last one
// ---------------------------------------------------------------------------------------------

const spentWith = (entries) => buildSpentHour({ spentAt: "2026-07-29T14:00:00Z", entries }, { now: NOW });

test("Y3: an executed action can NEVER reappear as a live action", REAL_RECORD, () => {
  const warm = realWarmQueue();
  const first = buildTheHour({ warm }, { now: NOW });
  const done = first.actions[0].handle;
  const n = buildNextHour({ warm, spent: spentWith([{ handle: done, disposition: "executed" }]) }, { now: NOW });
  assert.equal(n.schema, NEXT_HOUR_SCHEMA);
  assert.equal(executedLeakedBackAsLive(n, done), false);
  assert.ok(!n.actions.some((a) => a.handle === done));
  assert.ok(n.completed.some((c) => c.handle === done), "it must appear as completed, not vanish");
});

test("Y3: a skipped route carries its reason forward verbatim and ranks BELOW never-attempted routes", REAL_RECORD, () => {
  const warm = realWarmQueue();
  const first = buildTheHour({ warm }, { now: NOW });
  const skipped = first.actions[0].handle;
  const reason = "wrong department, not going to waste the contact";
  const n = buildNextHour({ warm, spent: spentWith([{ handle: skipped, disposition: "skipped", skipReason: reason }]) }, { now: NOW });
  const idx = n.actions.findIndex((a) => a.handle === skipped);
  assert.ok(idx > 0, "a previously-skipped route must not rank first");
  assert.equal(n.actions[idx].previouslySkipped, true);
  assert.equal(n.actions[idx].skippedBecause, reason); // verbatim
  assert.ok(n.actions.slice(0, idx).every((a) => a.previouslySkipped === false));
});

test("Y3: with no previous entry nothing is consumed and the list is unchanged", REAL_RECORD, () => {
  const warm = realWarmQueue();
  const first = buildTheHour({ warm }, { now: NOW });
  const n = buildNextHour({ warm, spent: buildSpentHour({}, { now: NOW }) }, { now: NOW });
  assert.equal(n.previousHourSpent, false);
  assert.equal(n.completed.length, 0);
  assert.deepEqual(n.actions.map((a) => a.handle), first.actions.map((a) => a.handle));
});

test("Y3: windows that closed are rendered as dated losses and are never re-ranked as live", REAL_RECORD, () => {
  const warm = realWarmQueue();
  const n = buildNextHour({ warm, spent: spentWith([]) }, { now: NOW });
  const liveHandles = new Set(n.actions.map((a) => a.handle));
  for (const c of n.closed) {
    assert.ok(!liveHandles.has(c.handle), "a closed window must never appear as a live action");
    assert.ok(c.closedOn, "a closed window must carry its date");
  }
});

test("Y3: the regenerated artefact stays cold-executable, leak-free and within one sitting", REAL_RECORD, () => {
  const warm = realWarmQueue();
  const n = buildNextHour({ warm, spent: spentWith([]) }, { now: NOW });
  assert.deepEqual(nextHourLeaks(n), []);
  assert.equal(nextFitsOneSitting(n), true);
  assert.ok(n.actions.length <= ONE_SITTING_MAX);
  const text = renderNextHour(n);
  assert.ok(text.includes("Nothing to read first") || text.includes("executable cold"));
  for (const a of n.actions) assert.ok(text.includes(a.body), "every action must carry its own body");
});

test("Y3: overflow is stated, never silently truncated", REAL_RECORD, () => {
  const warm = realWarmQueue();
  const n = buildNextHour({ warm, spent: spentWith([]) }, { now: NOW });
  assert.equal(n.actions.length + n.overflow, n.actionsTotalReachable);
  assert.equal(typeof n.heldBeyondSitting, "number");
});

test("Y3: against the REAL records the next hour is identical to the current one — nothing has been spent", REAL_RECORD, () => {
  const warm = realWarmQueue();
  const spent = buildSpentHour(JSON.parse(realSpentRaw()), { now: NOW });
  const n = buildNextHour({ warm, spent }, { now: NOW });
  assert.equal(n.previousHourSpent, false);
  assert.equal(n.completed.length, 0);
  const c = buildHourChange({ spent, before: snapshot(), after: snapshot() }, { now: NOW });
  assert.equal(renderHourChange(c), NOT_SPENT_LINE);
});

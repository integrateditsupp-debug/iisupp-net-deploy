// generate-week-view.mjs — RUN-AA: regenerate the WEEK artefacts from the real records.
//
// Produces two operator-facing files from records that already exist, and nothing else:
//   1. THE-WEEK-<date>.md   — AA3 roll-up. Unmoved counts first.
//   2. BACK-IN-<date>.md    — AA2 re-entry page. Cold-executable, one sitting.
//
// REFUSES to write if either artefact leaks identity, an internal path, or judgement vocabulary.
// Prints the AA1 gap facts so the ledger and the AXIS feed can quote them verbatim.
//
// Free, pure at the edges: this script reads and writes files; nothing it imports can send.
//
//   node "ARIA Sentinel/scripts/generate-week-view.mjs"
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { buildWarmRedirectQueue } from "../src/shared/warm-redirect-queue.mjs";
import { buildSpentHour } from "../src/shared/spent-hour.mjs";
import { buildRepeatedHours } from "../src/shared/repeat-hours.mjs";
import { buildCostOfDelay } from "../src/shared/cost-of-delay.mjs";
import { buildOutcomeLadder } from "../src/shared/outcome-ladder.mjs";
import { buildUnopenedWeek, renderUnopenedWeek, unopenedWeekJudgements, unopenedWeekFacts } from "../src/shared/unopened-week.mjs";
import { buildWeekReentry, renderWeekReentry, weekReentryLeaks, weekReentryFacts } from "../src/shared/week-reentry.mjs";
import { buildWeekRecord, renderWeekRecord, weekRecordJudgements, weekRecordFacts } from "../src/shared/week-record.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTBOUND = path.resolve(HERE, "../../senior-director-state/outbound");
const read = (f) => JSON.parse(readFileSync(path.join(OUTBOUND, f), "utf8"));

const now = Date.now();
const stamp = new Date(now).toISOString().slice(0, 10);

const warmRaw = read("warm-redirect-record-2026-07-29.json");
const replyRaw = read("reply-record-2026-07-29.json");
const mailRaw = read("outbound-record-2026-07-28.json");
const logRaw = read("spent-hours-log-2026-07-29.json");

const sentAt = (mailRaw.events || [])
  .filter((e) => e.kind === "sent" && e.at)
  .map((e) => Date.parse(e.at))
  .filter(Number.isFinite);
const lastSentAt = sentAt.length ? new Date(Math.max(...sentAt)).toISOString() : null;
const sentCount = sentAt.length;

const warm = buildWarmRedirectQueue(warmRaw, { now });

// `hours: null` means no hour has EVER been entered. It is deliberately not [].
const spentHours = Array.isArray(logRaw.hours)
  ? logRaw.hours.map((h) => buildSpentHour(h, { now }))
  : [];

const gap = buildUnopenedWeek({ spentHours, warm }, { now });
const hours = buildRepeatedHours({ warm, spentHours }, { now });

const cost = buildCostOfDelay(
  {
    landing: { sequencesBuilt: 27, sequencesLanded: 0 },
    mail: { lastSentAt },
    warm,
    replies: { repliesReceived: (replyRaw.replies || []).length },
  },
  { now }
);

// The ladder reads the RAW mail record — not a hand-made counter. It therefore reports the real
// first-contact send count (45, a floor per the record's own completeness note), which is a DIFFERENT
// number from second messages sent (0, from the reply record). Both are true; neither is collapsed
// into the other, and the feed states both.
const ladder = buildOutcomeLadder(
  { drafted: 12, mail: mailRaw, replies: replyRaw },
  { now }
);

// Re-entry compares the last recorded sitting against now. With no sitting ever recorded there is no
// "before" — both sides are the same snapshot, which is why the page correctly reads unchanged.
const snapshotNow = {
  costIndex: cost.costIndex,
  warmReachable: warm.counts.reachableNow,
  warmClosed: warm.expired.length,
  ladderReached: ladder.reached,
};
const reentry = buildWeekReentry(
  { gap, before: snapshotNow, after: snapshotNow, hours },
  { now }
);

// The week's counts are computed from the mail record's OWN dated events inside the window. They are
// never hand-set: a hand-set zero here would be exactly the fabrication this module exists to prevent.
const WEEK_DAYS = 7;
const weekStartMs = now - WEEK_DAYS * 86400000;
const inWeek = (kind) =>
  (mailRaw.events || []).filter((e) => {
    if (e.kind !== kind || !e.at) return false;
    const t = Date.parse(e.at);
    return Number.isFinite(t) && t > weekStartMs && t <= now;
  }).length;

const week = buildWeekRecord(
  {
    spentHours,
    windowEnd: new Date(now).toISOString(),
    windowDays: WEEK_DAYS,
    mail: { sent: inWeek("sent"), meetingsBooked: inWeek("meeting"), revenue: inWeek("revenue") },
    replies: { repliesReceived: (replyRaw.replies || []).length },
  },
  { now }
);

const refusals = [
  ...unopenedWeekJudgements(gap).map((f) => "AA1: " + f),
  ...weekReentryLeaks(reentry).map((f) => "AA2: " + f),
  ...weekRecordJudgements(week).map((f) => "AA3: " + f),
];
if (refusals.length) {
  console.error("REFUSED to write the week artefacts:");
  for (const r of refusals) console.error("  " + r);
  process.exit(1);
}

writeFileSync(path.join(OUTBOUND, `BACK-IN-${stamp}.md`), renderWeekReentry(reentry) + "\n");
writeFileSync(path.join(OUTBOUND, `THE-WEEK-${stamp}.md`), renderWeekRecord(week) + "\n");

console.log("--- AA1 gap ---");
console.log(JSON.stringify(unopenedWeekFacts(gap), null, 1));
console.log(renderUnopenedWeek(gap));
console.log("\n--- AA2 re-entry ---");
console.log(JSON.stringify(weekReentryFacts(reentry), null, 1));
console.log("\n--- AA3 week ---");
console.log(JSON.stringify(weekRecordFacts(week), null, 1));
console.log("\n--- carried numbers ---");
console.log(JSON.stringify({
  costIndex: cost.costIndex,
  ladderReached: ladder.reached,
  warmReachableNow: warm.counts.reachableNow,
  warmClosed: warm.expired.length,
  lastSentAt,
  sentCountInMailRecord: sentCount,
  secondMessagesSent: replyRaw.secondMessagesSent ?? "unverified",
  repliesReceived: (replyRaw.replies || []).length,
}, null, 1));

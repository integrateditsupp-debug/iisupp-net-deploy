// cost-of-delay.mjs — RUN-X X1: WHAT THE UNSPENT HOUR HAS ALREADY COST.
//
// WHY (RUN-X, 2026-07-29): twenty-three sequences are built and verified. The outcome ladder reads
// `drafted` and nothing above it. Twelve second messages exist as text and none has been sent. Two
// blockers move that ladder and neither is code: a human sending the second message, and a code-hosting
// credential that lets the verified sequences reach the shared line.
//
// Every previous cycle stated those blockers in a paragraph. A paragraph does not rise. This module
// computes what waiting has cost using dates that already exist, and makes that cost a number that
// CANNOT be reduced by building more software.
//
// Honesty invariants (Rule 14):
//   - ARITHMETIC OVER REAL DATES, OR `unverified`. Nothing here is estimated, projected or modelled.
//     If the underlying date is missing, the component renders `unverified` — never 0, never a guess.
//   - NOT A DOLLAR FIGURE. `costIndex` is the sum of three real counts (unlanded sequences, closed warm
//     windows, days since mail last left). It is deliberately not money: we have never measured the
//     dollar cost of a delay and will not invent one.
//   - RISING BY CONSTRUCTION. Only a REAL EVENT lowers it: a send (resets days-since-send), a landing
//     (lowers unlanded), a reply (evidences a warm window as used rather than closed). Software progress
//     — suites, commits, merges, tasks — is accepted at the door and DISCARDED UNREAD. A test injects
//     all of it and asserts the cost is unchanged. Another test adds a sequence and asserts the cost
//     rises, never falls.
//   - NO NAG, NO INVENTED URGENCY. There is no scolding language and no deadline we made up. Every
//     window date came from a prospect's own words (V1 record).
//   - PURE + ADDITIVE (Rule 15). No fs, no net, no transport, no persistence. New surface; replaces nothing.

export const COST_OF_DELAY_SCHEMA = "cost-of-delay.v1";

// Belt-and-braces, asserted by the test.
export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;
export const READS_IDENTITY = false;

export const UNVERIFIED = "unverified";

/** Software-progress inputs accepted at the door and discarded unread (U1/T2/W2 immunity). */
export const DISCARDED_INPUTS = Object.freeze([
  "sequencesCompleted", "tasksMerged", "testsGreen", "commits", "merges",
  "suitesGreen", "filesChanged", "runsCompleted", "linesChanged", "modulesBuilt",
]);

/** The only three events that may lower any component of this cost. */
export const REDUCING_EVENTS = Object.freeze([
  { key: "send", lowers: "daysSinceMailLeft", is: "a human sending a message from the operator's own mailbox" },
  { key: "landing", lowers: "unlandedSequences", is: "verified work reaching the shared line" },
  { key: "reply", lowers: "warmWindowsAtRisk", is: "a prospect answering — the window was used, not lost" },
]);

export const IMMUNITY_NOTE =
  "Building more software cannot lower this number. Suites, commits, merges, tasks and run counts are " +
  "accepted as input keys and discarded unread. Only a send, a landing or a reply lowers a component — " +
  "and shipping another sequence RAISES it, because another verified thing is now waiting.";

export const NOT_A_DOLLAR_NOTE =
  "costIndex is the sum of three real counts, not money. We have never measured the dollar cost of a " +
  "delay in this program and will not invent one (Rule 14).";

const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const DAY_MS = 86400000;

const parseMs = (v) => {
  if (!isStr(v)) return null;
  const ms = Date.parse(v.trim());
  return Number.isFinite(ms) ? ms : null;
};

const nonNegInt = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

/** Whole days between two instants, floored at 0. */
export function wholeDaysBetween(fromMs, toMs) {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return null;
  return Math.max(0, Math.floor((toMs - fromMs) / DAY_MS));
}

/**
 * Build the cost of delay.
 *
 * @param input.landing.sequencesBuilt   verified sequences that exist (real count)
 * @param input.landing.sequencesLanded  verified sequences that reached the shared line (real count)
 * @param input.mail.lastSentAt          ISO instant a message actually LEFT the mailbox, or null
 * @param input.warm                     a queue built by buildWarmRedirectQueue (V1), or null
 * @param input.replies.repliesReceived  prospect-originated replies (W1), used only to mark a window used
 *
 * Any DISCARDED_INPUTS key on `input` is ignored entirely.
 */
export function buildCostOfDelay(input = {}, { now = Date.now() } = {}) {
  const nowMs = typeof now === "number" ? now : Date.parse(now);

  // ---- component 1: verified work that has not reached the shared line -------------------------
  const built = nonNegInt(input?.landing?.sequencesBuilt);
  const landed = nonNegInt(input?.landing?.sequencesLanded);
  const unlandedSequences =
    built === null || landed === null ? UNVERIFIED : Math.max(0, built - landed);

  // ---- component 2: days since a message actually left ----------------------------------------
  const lastSentMs = parseMs(input?.mail?.lastSentAt);
  const daysSinceMailLeft = lastSentMs === null ? UNVERIFIED : wholeDaysBetween(lastSentMs, nowMs);

  // ---- component 3: warm windows, narrowed and closed ------------------------------------------
  const warm = input?.warm && warmLooksBuilt(input.warm) ? input.warm : null;
  const repliesReceived = nonNegInt(input?.replies?.repliesReceived) ?? 0;

  let warmWindowsClosed = UNVERIFIED;
  let warmWindowsAtRisk = UNVERIFIED;
  let warmWindowsReachableNow = UNVERIFIED;
  const closedDetail = [];

  if (warm) {
    warmWindowsClosed = warm.expired.length;
    warmWindowsReachableNow = warm.counts.reachableNow;
    // "At risk" = a window a prospect opened that is reachable RIGHT NOW and has not been answered.
    // A reply retires one — the window was used, which is the only honest way this component falls.
    warmWindowsAtRisk = Math.max(0, warm.counts.reachableNow - repliesReceived);
    for (const e of warm.expired) {
      closedDetail.push(Object.freeze({
        handle: e.handle,
        routeClass: e.routeClass,
        closedOn: e.expiredOn,
        daysClosed: wholeDaysBetween(Date.parse(e.expiredOn), nowMs),
      }));
    }
  }

  // ---- the index -------------------------------------------------------------------------------
  const parts = [unlandedSequences, warmWindowsClosed, daysSinceMailLeft];
  const anyUnverified = parts.some((p) => p === UNVERIFIED);
  const costIndex = anyUnverified
    ? UNVERIFIED
    : parts.reduce((a, b) => a + b, 0);

  const components = Object.freeze([
    Object.freeze({
      key: "unlandedSequences",
      value: unlandedSequences,
      unit: "verified sequences",
      means: "work that is built, tested and going nowhere until a code-hosting credential exists.",
      lowersOnlyOn: "landing",
    }),
    Object.freeze({
      key: "warmWindowsClosed",
      value: warmWindowsClosed,
      unit: "prospect-opened windows",
      means: "openings a prospect handed us that have already closed. These are recorded losses.",
      lowersOnlyOn: "never — a closed window does not reopen; it is a permanent entry.",
    }),
    Object.freeze({
      key: "daysSinceMailLeft",
      value: daysSinceMailLeft,
      unit: "days",
      means: "days since anything actually left the mailbox. Drafting does not reset this.",
      lowersOnlyOn: "send",
    }),
  ]);

  return Object.freeze({
    schema: COST_OF_DELAY_SCHEMA,
    computedAt: new Date(nowMs).toISOString(),
    costIndex,
    components,
    unlandedSequences,
    daysSinceMailLeft,
    warmWindowsClosed,
    warmWindowsAtRisk,
    warmWindowsReachableNow,
    closedDetail: Object.freeze(closedDetail),
    sequencesBuilt: built === null ? UNVERIFIED : built,
    sequencesLanded: landed === null ? UNVERIFIED : landed,
    repliesReceived,
    reducingEvents: REDUCING_EVENTS,
    immunityNote: IMMUNITY_NOTE,
    notADollarNote: NOT_A_DOLLAR_NOTE,
    note:
      "This number is arithmetic over dates that already exist. It rises on its own because time passes " +
      "and because every new verified sequence adds one more thing that has not landed. It is not a " +
      "scold and not a deadline we invented — every window date came from a prospect's own words.",
  });
}

function warmLooksBuilt(w) {
  return w && Array.isArray(w.expired) && w.counts && Number.isFinite(w.counts.reachableNow);
}

/** Flat fact set for the AXIS feed / ledger. Numbers only, no identity. */
export function costFacts(c) {
  return Object.freeze({
    schema: COST_OF_DELAY_SCHEMA,
    costIndex: c.costIndex,
    unlandedSequences: c.unlandedSequences,
    daysSinceMailLeft: c.daysSinceMailLeft,
    warmWindowsClosed: c.warmWindowsClosed,
    warmWindowsAtRisk: c.warmWindowsAtRisk,
  });
}

/** One honest markdown block for the ledger. */
export function costMarkdown(c) {
  const v = (x) => (x === UNVERIFIED ? UNVERIFIED : String(x));
  return [
    `- Cost of the unspent hour (index ${v(c.costIndex)} — a sum of real counts, not money):`,
    `  - ${v(c.unlandedSequences)} verified sequences built and not landed`,
    `  - ${v(c.warmWindowsClosed)} prospect-opened windows already closed`,
    `  - ${v(c.daysSinceMailLeft)} days since anything actually left the mailbox`,
    `  - ${v(c.warmWindowsAtRisk)} windows open right now and unanswered`,
  ].join("\n");
}

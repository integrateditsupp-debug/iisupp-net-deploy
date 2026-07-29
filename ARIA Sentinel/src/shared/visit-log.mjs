// visit-log.mjs — RUN-AC AC1: THE FIRST PASSIVE SIGNAL, OR AN HONEST REFUSAL IN ITS PLACE.
//
// WHY (RUN-AC, 2026-07-29): RUN-AB ran AB1/AB2/AB3 against the real records and returned one finding:
// nothing in this program moves on its own, and no passive signal is measurable. AB2 did not stop at the
// refusal — it named, for each unobservable signal, the precise free thing that would make it observable.
// For `site-visits` that thing was: "a free, self-hosted hit log written by the site itself into a file
// this repo can read. No account, no purchase, no third party."
//
// This module is the reader for that log. It is the difference between RUN-AC and another mirror: it does
// not report on something a human did, it reports on something someone OUTSIDE this company did, from a
// record the site writes itself.
//
// THE ONE THING THIS MODULE MUST NEVER DO is turn "the log is not there yet" into "nobody visited".
// A zero is a claim that we looked and it did not happen. That claim is only true INSIDE the window the
// log has actually been running. Outside it, the answer is `unobserved`, forever.
//
// Honesty invariants (Rule 14):
//   - NO LOG ⇒ `unobserved`, NEVER 0. Same law as passive-outcomes.mjs `delivered`.
//   - A ZERO IS ONLY EVER A ZERO FOR THE WINDOW SINCE `startedAt`. Every count carries the window it was
//     counted over, and a count is refused outright for any span that begins before `startedAt`.
//   - PUBLISHED-STATE HONESTY. The log records nothing until the site carrying it is published, which is
//     a deliberate operator action. Until `startedAt` exists, this module reports `not yet collecting`
//     and says why — it never reports a live-and-empty log.
//   - NO IDENTITY (vault Rule 11). The record carries a UTC day, an allowlisted path bucket and a count.
//     No address, no user agent, no referrer, no cookie, no session, no visitor distinctness. A record
//     containing any identity-shaped field is REJECTED whole rather than sanitised, so that a leaky
//     writer fails loudly instead of quietly half-working.
//   - SELF-TRAFFIC IS NOT A VISIT. Counts attributed to our own tooling are subtracted and reported
//     separately, never folded into the headline.
//   - PURE + ADDITIVE (Rule 15). No fs, no net, no transport, no persistence. Nothing replaced.

export const VISIT_LOG_SCHEMA = "visit-log.v1";

export const SENDS = false;
export const HAS_TRANSPORT = false;
export const PERSISTS = false;
export const READS_IDENTITY = false;
export const FETCHES = false;

export const UNOBSERVED = "unobserved";
export const UNVERIFIED = "unverified";
export const NOT_COLLECTING = "not yet collecting";

export const NOT_COLLECTING_HEADLINE =
  "The visit log is not collecting yet. No visit number exists, and none is reported as zero.";

export const NOT_COLLECTING_NOTE =
  "The log begins recording only once the site carrying it is published, which is a deliberate operator " +
  "action and not a software step. Until then this signal is unobserved. Reporting 0 visits here would " +
  "claim we watched an empty site, when in fact nothing was watching.";

export const ZERO_WINDOW_NOTE =
  "A zero from this log is real, but it is only a zero for the window the log has actually been running. " +
  "It says nothing about any moment before `startedAt`, and this module refuses to report a count over " +
  "any span that reaches back before that instant.";

export const SELF_TRAFFIC_NOTE =
  "Requests attributed to our own tooling are excluded from the headline and reported on their own line. " +
  "Our own uptime check is not a visitor.";

/** Fields whose presence means the writer has started collecting identity. The record is rejected whole. */
export const FORBIDDEN_FIELDS = Object.freeze([
  "ip", "ipAddress", "remoteAddr", "userAgent", "ua", "referrer", "referer", "cookie", "cookies",
  "sessionId", "visitorId", "clientId", "fingerprint", "geo", "country", "city", "email", "handle",
  "deviceId", "uid", "user",
]);

/** Only these buckets may appear. An unrecognised bucket is carried as unrecognised, never dropped. */
export const PATH_BUCKETS = Object.freeze(["/", "/aria", "/aperture", "/services", "/contact", "other"]);

const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const isNum = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const parseMs = (v) => { if (!isStr(v)) return null; const t = Date.parse(v); return Number.isFinite(t) ? t : null; };

/**
 * Scan a record for identity-shaped fields at any depth. Presence of one rejects the whole record.
 * @returns {string[]} the forbidden field names found
 */
export function findForbiddenFields(node, found = []) {
  if (node === null || typeof node !== "object") return found;
  if (Array.isArray(node)) { for (const v of node) findForbiddenFields(v, found); return found; }
  for (const k of Object.keys(node)) {
    if (FORBIDDEN_FIELDS.includes(k) && !found.includes(k)) found.push(k);
    findForbiddenFields(node[k], found);
  }
  return found;
}

/**
 * Read a visit-log record and report the passive signal it supports — or refuse.
 * @param {object|null} record visit-log.v1
 * @param {{now?: string}} opts
 */
export function measureVisits(record, { now } = {}) {
  const at = isStr(now) ? now : null;

  if (!record || typeof record !== "object") {
    return Object.freeze({
      schema: VISIT_LOG_SCHEMA,
      state: NOT_COLLECTING,
      collecting: false,
      visits: UNOBSERVED,
      headline: NOT_COLLECTING_HEADLINE,
      why: NOT_COLLECTING_NOTE,
      assessedAt: at ?? UNVERIFIED,
      window: null,
      days: Object.freeze([]),
      buckets: Object.freeze([]),
      selfTraffic: UNOBSERVED,
      notes: Object.freeze([NOT_COLLECTING_NOTE, ZERO_WINDOW_NOTE]),
    });
  }

  const leaks = findForbiddenFields(record);
  if (leaks.length > 0) {
    return Object.freeze({
      schema: VISIT_LOG_SCHEMA,
      state: "rejected",
      collecting: false,
      visits: UNOBSERVED,
      headline:
        `The visit log was rejected whole: it carries ${leaks.length} identity-shaped field(s) ` +
        `(${leaks.join(", ")}). No number from it is reported.`,
      why:
        "A log that has started collecting identity is not a log this program may read (vault Rule 11). " +
        "It is refused entire rather than sanitised, so that a leaky writer fails loudly.",
      assessedAt: at ?? UNVERIFIED,
      window: null,
      days: Object.freeze([]),
      buckets: Object.freeze([]),
      selfTraffic: UNOBSERVED,
      forbiddenFieldsFound: Object.freeze(leaks),
      notes: Object.freeze([NOT_COLLECTING_NOTE, ZERO_WINDOW_NOTE]),
    });
  }

  const startedMs = parseMs(record.startedAt);
  if (startedMs === null) {
    return Object.freeze({
      schema: VISIT_LOG_SCHEMA,
      state: NOT_COLLECTING,
      collecting: false,
      visits: UNOBSERVED,
      headline: NOT_COLLECTING_HEADLINE,
      why:
        "The record carries no `startedAt`, so there is no window a count could be true over. Without a " +
        "start instant a zero is indistinguishable from a log that never ran.",
      assessedAt: at ?? UNVERIFIED,
      window: null,
      days: Object.freeze([]),
      buckets: Object.freeze([]),
      selfTraffic: UNOBSERVED,
      notes: Object.freeze([NOT_COLLECTING_NOTE, ZERO_WINDOW_NOTE]),
    });
  }

  const rawDays = Array.isArray(record.days) ? record.days : [];
  const days = [];
  const bucketTotals = new Map();
  const unrecognisedBuckets = [];
  let visits = 0;
  let selfTraffic = 0;

  for (const d of rawDays) {
    const day = isStr(d?.day) ? d.day.slice(0, 10) : null;
    if (!day) continue;
    const self = isNum(d?.self) ? d.self : 0;
    let dayTotal = 0;
    const entries = d && typeof d.buckets === "object" && d.buckets !== null ? d.buckets : {};
    for (const [bucket, count] of Object.entries(entries)) {
      if (!isNum(count)) continue;
      if (!PATH_BUCKETS.includes(bucket) && !unrecognisedBuckets.includes(bucket)) unrecognisedBuckets.push(bucket);
      bucketTotals.set(bucket, (bucketTotals.get(bucket) || 0) + count);
      dayTotal += count;
    }
    visits += dayTotal;
    selfTraffic += self;
    days.push(Object.freeze({ day, visits: dayTotal, self }));
  }

  days.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

  const window = Object.freeze({
    startedAt: record.startedAt,
    through: at ?? (days.length ? days[days.length - 1].day : UNVERIFIED),
    note: ZERO_WINDOW_NOTE,
  });

  const buckets = Object.freeze(
    [...bucketTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([bucket, count]) => Object.freeze({ bucket, count, recognised: PATH_BUCKETS.includes(bucket) })),
  );

  const headline = visits > 0
    ? `${visits} visit(s) observed since ${String(record.startedAt).slice(0, 10)}. This is the first ` +
      `number in this program produced by someone outside the company without an hour being spent.`
    : `0 visits observed since ${String(record.startedAt).slice(0, 10)}. This is a real zero, and it is a ` +
      `zero only for that window — it says nothing about any moment before the log started.`;

  return Object.freeze({
    schema: VISIT_LOG_SCHEMA,
    state: "observed",
    collecting: true,
    visits,
    headline,
    assessedAt: at ?? UNVERIFIED,
    window,
    days: Object.freeze(days),
    buckets,
    selfTraffic,
    unrecognisedBuckets: Object.freeze(unrecognisedBuckets),
    notes: Object.freeze([ZERO_WINDOW_NOTE, SELF_TRAFFIC_NOTE]),
  });
}

/**
 * A count is only legitimate over a span that begins at or after `startedAt`.
 * Asking for anything earlier is refused rather than answered.
 */
export function countOverWindow(measurement, { from, to } = {}) {
  if (!measurement || measurement.state !== "observed") {
    return Object.freeze({ ok: false, visits: UNOBSERVED, why: "The log is not collecting; no window can be counted." });
  }
  const startedMs = parseMs(measurement.window?.startedAt);
  const fromMs = parseMs(from);
  const toMs = parseMs(to);
  if (fromMs === null || toMs === null || startedMs === null) {
    return Object.freeze({ ok: false, visits: UNOBSERVED, why: "A window needs two parseable instants and a start instant." });
  }
  if (fromMs < startedMs) {
    return Object.freeze({
      ok: false,
      visits: UNOBSERVED,
      why:
        "Refused: the requested window begins before the log started. A count over that span would " +
        "report an absence of collection as an absence of visitors.",
    });
  }
  let visits = 0;
  for (const d of measurement.days) {
    const dayMs = Date.parse(`${d.day}T00:00:00Z`);
    if (Number.isFinite(dayMs) && dayMs >= fromMs && dayMs <= toMs) visits += d.visits;
  }
  return Object.freeze({ ok: true, visits, from, to });
}

/** Records this measurement makes reachable, for passive-surface. Empty unless genuinely observed. */
export function reachableSignals(measurement) {
  return measurement && measurement.state === "observed" ? Object.freeze(["site-visits"]) : Object.freeze([]);
}

/** Render. When not collecting, the refusal is the FIRST line. */
export function renderVisits(m) {
  const lines = [];
  lines.push("THE VISIT LOG");
  lines.push("");
  lines.push(m.headline);
  lines.push("");
  if (!m.collecting) {
    lines.push(m.why);
    lines.push("");
    return lines.join("\n");
  }
  lines.push(`window: from ${m.window.startedAt} through ${m.window.through}`);
  lines.push(`self-traffic excluded from the headline: ${m.selfTraffic}`);
  lines.push("");
  lines.push("BY DAY");
  for (const d of m.days) lines.push(`  ${d.day}: ${d.visits} visit(s) (self: ${d.self})`);
  lines.push("");
  lines.push("BY PATH BUCKET");
  for (const b of m.buckets) lines.push(`  ${b.bucket}: ${b.count}${b.recognised ? "" : "  [unrecognised bucket, carried not dropped]"}`);
  lines.push("");
  lines.push(ZERO_WINDOW_NOTE);
  lines.push(SELF_TRAFFIC_NOTE);
  return lines.join("\n");
}

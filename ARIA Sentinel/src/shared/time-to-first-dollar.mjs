// RUN-K K2 — TIME-TO-FIRST-DOLLAR CLOCK (pure, local-only, Rule 14 real-or-empty).
// How long from the first REAL recorded engagement to the first REAL received payment — measured only
// from timestamps that already exist in real artifacts. With no payment yet the clock says
// "still running, N days". It never estimates, never forecasts, and never names a close date.
//
// Honesty invariants (Rule 14):
//   - TWO REAL TIMESTAMPS OR NOTHING. Every interval is computed from two timestamps that came off a
//     real artifact (engagement record, earned proof pack, rendered close packet, produced billing
//     handoff, verified receipt). A stage with no real timestamp is MISSING, not interpolated.
//   - NO FORECAST. There is no projected close date, no ETA, no "expected by". A static scan in the
//     test fails the build if that vocabulary ever appears in this file or in rendered output.
//   - STILL RUNNING IS AN HONEST ANSWER. No payment yet => "still running, N days" — never a promise.
//   - THE SLOWEST STEP IS SHOWN, NOT GUESSED. The longest gap is the largest real interval between two
//     consecutive present stages, and it names both endpoints.
//   - Rule 15 additive: reads existing K1/H1/H3/I1 outputs; changes none of them.

export const CLOCK_SCHEMA = "time-to-first-dollar.v1";

export const STATUSES = ["completed", "still-running", "not-enough-data"];

export const NOT_ENOUGH_DATA_NOTE =
  "No real engagement start is recorded, so there is no clock to read. Nothing is estimated in its place.";

export const STILL_RUNNING_PREFIX = "still running, ";

export const NO_PAYMENT_NOTE =
  "No payment has been received yet. This is elapsed real time, not a prediction of when money will land.";

export const MEASURED_ONLY_NOTE =
  "Every interval below is the difference between two timestamps that already exist on a real artifact. Missing stages are named as missing.";

/** The chain, in order. Each stage names where its timestamp must come from. */
export const STAGES = [
  { key: "engagement", label: "First recorded engagement", from: "a real engagement/delivery record" },
  { key: "evidence", label: "Evidence earned", from: "an EARNED proof pack (H1)" },
  { key: "packet", label: "Close packet rendered", from: "a RENDERED close packet (H3)" },
  { key: "handoff", label: "Billing handoff produced", from: "a PRODUCED billing handoff (I1)" },
  { key: "payment", label: "Payment received", from: "a VERIFIED receipt (K1)" },
];

const DAY = 86400000;

function ts(v) {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

function days(ms) { return Math.round((ms / DAY) * 10) / 10; }

// -- 1. Pull the real timestamps out of the real artifacts ---------------------------------------------
export function chainTimestamps(input = {}) {
  const src = input && typeof input === "object" ? input : {};

  // Engagement: the earliest real delivery/engagement record we actually have.
  let engagement = null;
  let engagementSource = null;
  for (const r of Array.isArray(src.records) ? src.records : []) {
    const t = r && ts(r.at);
    if (t === null) continue;
    if (engagement === null || t < engagement) { engagement = t; engagementSource = (r && r.id) || null; }
  }
  // An explicitly recorded engagement start wins only if it is real and earlier.
  const declared = ts(src.engagementStartedAt);
  if (declared !== null && (engagement === null || declared < engagement)) {
    engagement = declared;
    engagementSource = "engagementStartedAt";
  }

  const pack = src.proofPack && src.proofPack.schema === "proof-pack.v1" && src.proofPack.earned === true ? src.proofPack : null;
  const packet = src.closePacket && src.closePacket.schema === "close-packet.v1" && src.closePacket.rendered === true ? src.closePacket : null;
  const handoff = src.billingHandoff && src.billingHandoff.schema === "billing-handoff.v1" && src.billingHandoff.produced === true ? src.billingHandoff : null;

  const ledger = src.ledger && src.ledger.schema === "payment-receipt-ledger.v1" ? src.ledger : null;
  const firstPaid = ledger && ledger.firstReceivedAt ? ts(ledger.firstReceivedAt) : null;
  const firstPaidRecord = ledger && ledger.verified.length ? ledger.verified[0] : null;

  return {
    engagement: engagement === null ? null : { at: engagement, source: engagementSource },
    evidence: pack ? { at: ts(pack.generatedAt), source: pack.pilotId ? "proof-pack:" + pack.pilotId : "proof-pack" } : null,
    packet: packet ? { at: ts(packet.generatedAt), source: "close-packet:" + packet.customer } : null,
    handoff: handoff ? { at: ts(handoff.generatedAt), source: "billing-handoff:" + handoff.customer } : null,
    payment: firstPaid === null ? null : { at: firstPaid, source: firstPaidRecord ? firstPaidRecord.id + " (" + firstPaidRecord.processor + " ref " + firstPaidRecord.reference + ")" : "verified-receipt" },
  };
}

// -- 2. The clock ---------------------------------------------------------------------------------------
export function buildFirstDollarClock(input = {}, { now = Date.now() } = {}) {
  const chain = chainTimestamps(input);

  const present = [];
  const missing = [];
  for (const s of STAGES) {
    const hit = chain[s.key];
    if (hit && Number.isFinite(hit.at)) present.push({ ...s, at: new Date(hit.at).toISOString(), atMs: hit.at, source: hit.source });
    else missing.push({ key: s.key, label: s.label, needs: s.from });
  }

  const base = {
    schema: CLOCK_SCHEMA,
    generatedAt: new Date(now).toISOString(),
    stagesPresent: present.map((p) => ({ key: p.key, label: p.label, at: p.at, source: p.source })),
    stagesMissing: missing,
    note: MEASURED_ONLY_NOTE,
  };

  if (!chain.engagement) {
    return { ...base, status: "not-enough-data", elapsedDays: null, headline: NOT_ENOUGH_DATA_NOTE, intervals: [], longestGap: null };
  }

  // Intervals only between CONSECUTIVE PRESENT stages — a gap that spans a missing stage says so.
  const intervals = [];
  for (let i = 1; i < present.length; i += 1) {
    const a = present[i - 1];
    const b = present[i];
    const ms = b.atMs - a.atMs;
    intervals.push({
      from: a.key, to: b.key,
      label: a.label + " -> " + b.label,
      days: days(ms),
      fromAt: a.at, toAt: b.at,
      fromSource: a.source, toSource: b.source,
      spansMissingStage: STAGES.findIndex((s) => s.key === b.key) - STAGES.findIndex((s) => s.key === a.key) > 1,
    });
  }
  const longestGap = intervals.length
    ? intervals.slice().sort((x, y) => (y.days - x.days) || x.from.localeCompare(y.from))[0]
    : null;

  const startMs = chain.engagement.at;
  if (chain.payment) {
    const elapsed = days(chain.payment.at - startMs);
    return {
      ...base,
      status: "completed",
      elapsedDays: elapsed,
      headline: "First dollar took " + elapsed + " day(s), measured from " + new Date(startMs).toISOString() +
        " to " + new Date(chain.payment.at).toISOString() + ".",
      intervals,
      longestGap,
    };
  }
  const running = days(now - startMs);
  return {
    ...base,
    status: "still-running",
    elapsedDays: running,
    headline: STILL_RUNNING_PREFIX + running + " day(s) since the first recorded engagement. " + NO_PAYMENT_NOTE,
    intervals,
    longestGap,
  };
}

// -- 3. Read it in one line -----------------------------------------------------------------------------
export function firstDollarMarkdown(clock) {
  if (!clock || clock.schema !== CLOCK_SCHEMA) return "No time-to-first-dollar clock.";
  const out = [];
  out.push("# Time to first dollar");
  out.push("");
  out.push("**" + clock.headline + "**");
  if (clock.status === "not-enough-data") return out.join("\n");

  out.push("");
  out.push("## The chain, from real timestamps");
  for (const s of clock.stagesPresent) out.push("- " + s.label + ": " + s.at + " (" + s.source + ")");
  for (const m of clock.stagesMissing) out.push("- " + m.label + ": MISSING - needs " + m.needs);

  if (clock.intervals.length) {
    out.push("");
    out.push("## Where the time actually went");
    for (const i of clock.intervals) {
      out.push("- " + i.label + ": " + i.days + " day(s)" + (i.spansMissingStage ? " (spans a stage with no real timestamp)" : ""));
    }
    if (clock.longestGap) {
      out.push("");
      out.push("**Slowest real step: " + clock.longestGap.label + " - " + clock.longestGap.days +
        " day(s)** (" + clock.longestGap.fromAt + " -> " + clock.longestGap.toAt + ").");
    }
  }
  out.push("");
  out.push("_" + clock.note + "_");
  return out.join("\n");
}

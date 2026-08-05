// feed-freshness.mjs — a served feed must be able to prove it was regenerated, and two mirrors of
// the same feed must not be able to tell two different stories.
//
// WHY THIS EXISTS (RUN-AL / AL1 + AL2, 2026-08-05).
// RUN-AK made every figure INSIDE the operator-internal payload carry its evidence, and made a
// figure older than its class allows render a stale label. That closed the claim; it did not close
// the CARRIER.
//
// The public feed at `.well-known/axis/status.json` is what AXIS reads aloud when an operator asks
// for status. It has exactly one field that says how old the answer is — `generatedAt` — and that
// field had no gate of any kind:
//
//   1. NOBODY CHECKED ITS AGE ON DISK. If a cycle never reached the emitter — a red test, a crash,
//      a skipped run, an agent that stopped — the previous feed simply stayed there, and every
//      reader (including the spoken answer) took a figure measured days ago as the state right now.
//      Silence and freshness were indistinguishable, which is the same failure class AK was written
//      to kill, one layer out.
//   2. NOBODY CHECKED THE TWO MIRRORS AGREED. `publish = "."` serves BOTH `.well-known/axis/` and
//      `public/.well-known/axis/`. A half-completed write leaves one mirror new and one old, and
//      which one a reader gets is a routing accident. Two served answers to "what is the status" is
//      worse than one stale answer, because neither can be challenged by looking at the other.
//   3. A `generatedAt` IN THE FUTURE WOULD HAVE PUBLISHED. A future stamp is the one value that can
//      never be honest and that also permanently defeats every age check downstream.
//
// The split of enforcement is deliberate:
//   • WRITE TIME  — refuse a malformed or future `generatedAt`. At write time "stale" is not a
//     meaningful accusation (the emitter is running now), but "impossible" is.
//   • READ TIME   — refuse a feed on disk that is older than one cycle, and refuse mirrors that
//     disagree. This is the check that catches the cycle that never ran, which is the whole point:
//     the gate has to fire when nobody is there to run anything.
//
// Nothing here deletes or rewrites a feed. It reports, and the caller refuses. A gate that silently
// repaired the feed would restore the exact ambiguity it exists to remove.
//
// Pure except for the explicit disk reads in `checkFeedFreshness`. No network. No clock except the
// `now` passed in (defaults to real time), so the suite can age a feed without touching the system.
export const FEED_FRESHNESS_SCHEMA = "feed-freshness.v1";
export const SENDS = false;
export const WRITES = false;

// Failure classes. Named so a red test says WHICH dishonesty it caught, never just "invalid".
export const CLASSES = Object.freeze({
  OK: "feed-is-fresh",
  MISSING: "feed-has-no-generatedAt",
  NOT_AN_INSTANT: "generatedAt-is-not-an-iso-instant",
  IN_THE_FUTURE: "generatedAt-is-in-the-future",
  STALE: "feed-is-older-than-one-cycle",
  MIRRORS_DISAGREE: "served-mirrors-carry-different-generatedAt",
  UNREADABLE: "served-feed-could-not-be-read",
});

// One cycle. The feed is regenerated every flywheel run; anything older means a run did not land.
export const MAX_FEED_AGE_HOURS = 24;

// A small tolerance so an emitter whose clock is a second ahead of the checker is not called a liar.
export const FUTURE_TOLERANCE_MS = 60_000;

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Hours between `measuredAt` and `now`, negative if the stamp is in the future. */
export function feedAgeHours(generatedAt, now = new Date()) {
  const t = Date.parse(generatedAt);
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / 3_600_000;
}

/**
 * Is this `generatedAt` publishable AT WRITE TIME?
 * Refuses only what can never be honest: absent, malformed, or in the future. Age is not judged
 * here — the emitter is running now, so "stale at write time" is a category error.
 */
export function auditGeneratedAt(generatedAt, { now = new Date() } = {}) {
  if (generatedAt === undefined || generatedAt === null || generatedAt === "") {
    return { ok: false, class: CLASSES.MISSING, detail: "a served feed with no generatedAt cannot be aged by any reader" };
  }
  if (typeof generatedAt !== "string" || !ISO_INSTANT.test(generatedAt) || Number.isNaN(Date.parse(generatedAt))) {
    return { ok: false, class: CLASSES.NOT_AN_INSTANT, detail: `generatedAt must be an ISO instant, got ${JSON.stringify(generatedAt)}` };
  }
  const age = feedAgeHours(generatedAt, now);
  if (age < -(FUTURE_TOLERANCE_MS / 3_600_000)) {
    return {
      ok: false,
      class: CLASSES.IN_THE_FUTURE,
      detail: `generatedAt is ${Math.abs(age).toFixed(2)}h in the future — a future stamp defeats every age check downstream`,
    };
  }
  return { ok: true, class: CLASSES.OK, ageHours: Math.max(0, age) };
}

/**
 * Is this feed OBJECT fresh, judged as it would be read off disk?
 * Adds the age verdict on top of the write-time audit.
 */
export function auditFeedObject(feed, { now = new Date(), maxAgeHours = MAX_FEED_AGE_HOURS, label = "feed" } = {}) {
  const base = auditGeneratedAt(feed && feed.generatedAt, { now });
  if (!base.ok) return { ...base, label };
  if (base.ageHours > maxAgeHours) {
    return {
      ok: false,
      class: CLASSES.STALE,
      label,
      ageHours: base.ageHours,
      maxAgeHours,
      detail:
        `${label} was generated ${base.ageHours.toFixed(1)}h ago, past the ${maxAgeHours}h cycle — ` +
        "it is being served as current state but no run has refreshed it",
    };
  }
  return { ...base, label, maxAgeHours };
}

/**
 * Read the served mirrors off disk and judge them together.
 * Returns { ok, problems[], checked[] }. Never writes, never repairs.
 *
 * `files` are repo-relative; a mirror that does not exist is skipped rather than failed, because
 * which mirrors exist is a publishing decision and not this module's business. A mirror that exists
 * and cannot be parsed IS a failure — an unreadable served feed is worse than an absent one.
 */
export function checkFeedFreshness({ root, files, fs, path, now = new Date(), maxAgeHours = MAX_FEED_AGE_HOURS }) {
  const problems = [];
  const checked = [];
  const stamps = new Map();

  for (const rel of files) {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) continue;
    let feed;
    try {
      feed = JSON.parse(fs.readFileSync(p, "utf8"));
    } catch (err) {
      problems.push({ file: rel, class: CLASSES.UNREADABLE, detail: `served feed did not parse: ${err.message}` });
      continue;
    }
    checked.push(rel);
    stamps.set(rel, feed && feed.generatedAt);
    const verdict = auditFeedObject(feed, { now, maxAgeHours, label: rel });
    if (!verdict.ok) problems.push({ file: rel, class: verdict.class, detail: verdict.detail, ageHours: verdict.ageHours });
  }

  // Two served answers to the same question is its own failure, independent of either one's age.
  const distinct = [...new Set([...stamps.values()])];
  if (distinct.length > 1) {
    problems.push({
      file: checked.join(" + "),
      class: CLASSES.MIRRORS_DISAGREE,
      detail:
        "the served mirrors carry different generatedAt values (" + distinct.map((d) => JSON.stringify(d)).join(" vs ") +
        ") — which one a reader gets is a routing accident, and neither can be challenged by the other",
    });
  }

  return { ok: problems.length === 0, problems, checked };
}

/** Throwing form for the write path. Message names the class so a red test reads as an accusation. */
export function requireFreshGeneratedAt(generatedAt, { now = new Date() } = {}) {
  const verdict = auditGeneratedAt(generatedAt, { now });
  if (!verdict.ok) {
    throw new Error(`public status REFUSED — ${verdict.class}: ${verdict.detail}`);
  }
  return verdict;
}

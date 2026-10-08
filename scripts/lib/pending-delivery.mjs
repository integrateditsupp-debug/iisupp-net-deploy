// pending-delivery.mjs — a delivery that reports its own age.
//
// WHY THIS EXISTS (RUN-BU, 2026-10-08).
// RUN-BS verified eleven commits, wrote a bundle, wrote a one-click push script, and said so. The
// click was never made. The batch then sat off the shared line for FIFTY-SIX DAYS while the line
// moved on without it, and the public AXIS feed went on reading its 2026-08-13 stamp aloud as
// current state. Nothing in the system was red during those fifty-six days. Every cycle reported
// "staged — one click waiting", which was true, and not one of them reported how long it had been
// true. An age nobody computes is an age nobody acts on.
//
// This module is the missing computation, and it is deliberately pure: no git, no network, no clock
// of its own. It takes the delivery manifests, the set of commit ids the shared line actually holds,
// and `now`; it returns which deliveries have LANDED, which are still PENDING and for how many days,
// and which cannot be judged at all.
//
// THE HONESTY CONTRACT, which tests/pending-delivery-age.test.mjs enforces:
//
//   * A delivery is `landed` ONLY on positive evidence — its tip commit id is in the set the shared
//     line holds. Absence of evidence is never landing.
//   * A manifest with no readable tip, or no readable generatedAt, is `unverifiable`. It is NOT
//     pending (we do not know that it is) and NOT landed (we do not know that either). It is
//     counted separately and never folded into either number, because "I cannot tell" and "there is
//     nothing waiting" are different facts and collapsing them is how fifty-six days happen.
//   * `oldestPendingDays` is `null` when nothing is pending — never 0. Zero days reads as "delivered
//     moments ago", which is the opposite of "nothing is waiting".
//   * When the delivery record itself is absent (a clean clone cannot see the operator volume), the
//     audit reports `source: "absent"` and `state: "not-taken"`. A reading that was not taken is
//     never published as a zero.
export const PENDING_DELIVERY_SCHEMA = "pending-delivery.v1";
export const SENDS = false;

/** Default age past which a staged delivery stops being "staged" and becomes a stall. */
export const DEFAULT_MAX_AGE_DAYS = 2;

export const DELIVERY_STATES = Object.freeze({
  LANDED: "landed",
  PENDING: "pending",
  UNVERIFIABLE: "unverifiable",
});

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Milliseconds since `iso`, or null if `iso` is not a usable instant. */
export function ageMs(iso, now) {
  if (typeof iso !== "string" || !iso.trim()) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const n = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(n)) return null;
  return n - t;
}

/**
 * Age in whole days, rounded DOWN, or null when it cannot be computed.
 *
 * A stamp in the future returns null rather than a negative age: a delivery that claims to have been
 * built after now is a broken stamp, and reporting it as "-3 days old" would dress a fault as data.
 */
export function ageDays(iso, now) {
  const ms = ageMs(iso, now);
  if (ms === null || ms < 0) return null;
  return Math.floor(ms / 86400000);
}

const normalizeSha = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");

/**
 * Is `tip` held by the shared line?
 *
 * `remoteShas` is the set of full commit ids the code host reports. Manifests may carry a short id,
 * so a prefix match is accepted — but only for a prefix long enough to mean something (7 hex chars,
 * git's own floor). A 3-character "match" is noise, and noise that reads as landed is the one
 * failure this function must not have.
 */
export function isHeldByRemote(tip, remoteShas) {
  const t = normalizeSha(tip);
  if (t.length < 7) return false;
  const set = remoteShas instanceof Set ? remoteShas : new Set(Array.isArray(remoteShas) ? remoteShas : []);
  for (const raw of set) {
    const s = normalizeSha(raw);
    if (!s) continue;
    if (s === t) return true;
    if (s.length > t.length && s.startsWith(t)) return true;
    if (t.length > s.length && s.length >= 7 && t.startsWith(s)) return true;
  }
  return false;
}

/**
 * Classify ONE delivery manifest.
 *
 * Returns { name, state, ageDays, tip, commits, reason }. `reason` is populated only for
 * `unverifiable`, and it names what was missing — a classification without a reason is not
 * actionable, which is the defect this whole module exists to answer.
 */
export function classifyDelivery(manifest, { remoteShas, now } = {}) {
  const name = isPlainObject(manifest) && typeof manifest.name === "string" && manifest.name.trim()
    ? manifest.name.trim()
    : (isPlainObject(manifest) && typeof manifest.bundle === "string" ? manifest.bundle : "(unnamed delivery)");

  if (!isPlainObject(manifest)) {
    return { name, state: DELIVERY_STATES.UNVERIFIABLE, ageDays: null, tip: null, commits: null,
      reason: "the manifest is not an object - nothing in it can be read" };
  }

  const tip = normalizeSha(manifest.tip) || null;
  if (!tip || tip.length < 7) {
    return { name, state: DELIVERY_STATES.UNVERIFIABLE, ageDays: null, tip, commits: null,
      reason: "no usable tip commit id - whether the shared line holds this delivery cannot be established either way" };
  }

  const commits = Number.isFinite(manifest.commits) ? manifest.commits : null;

  if (isHeldByRemote(tip, remoteShas)) {
    return { name, state: DELIVERY_STATES.LANDED, ageDays: ageDays(manifest.generatedAt, now), tip, commits, reason: null };
  }

  const age = ageDays(manifest.generatedAt, now);
  if (age === null) {
    return { name, state: DELIVERY_STATES.UNVERIFIABLE, ageDays: null, tip, commits,
      reason: "the shared line does not hold this tip, but the manifest carries no usable generatedAt - it is waiting for an unknown length of time, which is not the same as waiting for none" };
  }

  return { name, state: DELIVERY_STATES.PENDING, ageDays: age, tip, commits, reason: null };
}

/**
 * Audit every delivery at once.
 *
 * `deliveries` is the list of manifests actually read off disk, or `null` when the delivery record
 * could not be read at all (a clean clone). The two cases produce different reports on purpose.
 */
export function auditDeliveries({ deliveries, remoteShas, now = new Date(), maxAgeDays = DEFAULT_MAX_AGE_DAYS } = {}) {
  const generatedAt = (now instanceof Date ? now : new Date(now)).toISOString();
  const base = { schema: PENDING_DELIVERY_SCHEMA, generatedAt, maxAgeDays };

  if (deliveries === null || deliveries === undefined) {
    return {
      ...base,
      state: "not-taken",
      source: "absent",
      landed: [], pending: [], unverifiable: [],
      pendingCount: null, landedCount: null, unverifiableCount: null,
      oldestPendingDays: null,
      overdue: false,
      statement: "The delivery record is not readable from here, so no reading was taken. This is reported as not taken rather than as zero pending deliveries: a clean clone cannot see the operator volume, and an unread shelf is not an empty one.",
    };
  }

  if (!Array.isArray(deliveries)) {
    throw new TypeError("auditDeliveries: deliveries must be an array of manifests, or null for 'could not read'");
  }

  const rows = deliveries.map((m) => classifyDelivery(m, { remoteShas, now }));
  const landed = rows.filter((r) => r.state === DELIVERY_STATES.LANDED);
  const pending = rows.filter((r) => r.state === DELIVERY_STATES.PENDING);
  const unverifiable = rows.filter((r) => r.state === DELIVERY_STATES.UNVERIFIABLE);

  pending.sort((a, b) => b.ageDays - a.ageDays);
  const oldestPendingDays = pending.length ? pending[0].ageDays : null;
  const overdue = oldestPendingDays !== null && oldestPendingDays > maxAgeDays;

  let statement;
  if (pending.length === 0 && unverifiable.length === 0) {
    statement = "Every delivery on the shelf is held by the shared line. Nothing is waiting on a click.";
  } else {
    const parts = [];
    if (pending.length) {
      parts.push(`${pending.length} ${pending.length === 1 ? "delivery is" : "deliveries are"} verified and NOT on the shared line; the oldest has been waiting ${oldestPendingDays} ${oldestPendingDays === 1 ? "day" : "days"}`);
    }
    if (unverifiable.length) {
      parts.push(`${unverifiable.length} cannot be judged from what is on disk and ${unverifiable.length === 1 ? "is" : "are"} counted as neither landed nor pending`);
    }
    statement = parts.join("; ") + ".";
    if (overdue) {
      statement += ` That exceeds the ${maxAgeDays}-day threshold: a staged click this old is a stall, not a staging.`;
    }
  }

  return {
    ...base,
    state: "taken",
    source: "read",
    landed, pending, unverifiable,
    pendingCount: pending.length,
    landedCount: landed.length,
    unverifiableCount: unverifiable.length,
    oldestPendingDays,
    overdue,
    statement,
  };
}

/**
 * One line, safe to speak, carrying no commit id, branch name or script path.
 *
 * The public AXIS feed is leak-scanned (scripts/lib/axis-status-emit.mjs), so the age has to be
 * sayable without naming anything internal. That is the point: Ahmad can ask AXIS "is anything
 * waiting on me" and get a number of days back instead of a reassuring noise.
 */
export function speakablePendingLine(audit) {
  if (!isPlainObject(audit)) return "No delivery reading is available.";
  if (audit.state === "not-taken") return "No delivery reading was taken in this environment, so I will not claim that nothing is waiting.";
  if (audit.pendingCount === 0 && audit.unverifiableCount === 0) return "Nothing is waiting on your approval; every verified batch is on the shared line.";
  const bits = [];
  if (audit.pendingCount) {
    const d = audit.oldestPendingDays;
    bits.push(`${audit.pendingCount} verified ${audit.pendingCount === 1 ? "batch" : "batches"} of work ${audit.pendingCount === 1 ? "is" : "are"} waiting on your approval, the oldest for ${d} ${d === 1 ? "day" : "days"}`);
  }
  if (audit.unverifiableCount) bits.push(`${audit.unverifiableCount} cannot be checked from here and ${audit.unverifiableCount === 1 ? "is" : "are"} not being counted as clear`);
  return bits.join(", and ") + ".";
}

/**
 * Collapse pending deliveries that are already CONTAINED in another pending delivery.
 *
 * WHY (RUN-BU, found by running the auditor against the real shelf). The first real reading said
 * "4 batches waiting, oldest 58 days". True, and misleading in one direction that matters: three of
 * the four were ancestors of the fourth. Pushing the newest one lands all of them. Reporting four
 * separate waits implies four separate decisions and four separate clicks, which would make the
 * backlog look heavier than it is and the single click that clears it harder to find.
 *
 * `isAncestor(a, b)` must return true when commit `a` is an ancestor of commit `b`, false when it
 * provably is not, and **null when it cannot be determined** (the object is not present locally).
 * An undeterminable containment is never guessed: the row stays standalone and carries
 * `containmentUnknown`, because collapsing a delivery nobody can prove is contained would hide work.
 *
 * Pure: the git call is the caller's.
 */
export function markContainment(pending, isAncestor) {
  const rows = Array.isArray(pending) ? pending.map((r) => ({ ...r })) : [];
  if (typeof isAncestor !== "function") return { rows, distinct: rows, clicksNeeded: rows.length };
  // Newest first, so a row carried by a chain names the END of the chain - the one delivery that,
  // pushed, lands everything behind it. Naming an intermediate would be true and useless.
  const candidates = rows.slice().sort((a, b) => (a.ageDays ?? Infinity) - (b.ageDays ?? Infinity));
  for (const row of rows) {
    row.containedIn = null;
    row.containmentUnknown = false;
    for (const other of candidates) {
      if (other === row || !other.tip || !row.tip || other.tip === row.tip) continue;
      const verdict = isAncestor(row.tip, other.tip);
      if (verdict === null) { row.containmentUnknown = true; continue; }
      if (verdict === true) { row.containedIn = other.name; break; }
    }
  }
  const distinct = rows.filter((r) => !r.containedIn);
  return { rows, distinct, clicksNeeded: distinct.length };
}

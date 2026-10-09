// suite-registry.mjs — RUN-BW. Is every guard suite on disk accounted for?
//
// WHY THIS EXISTS (2026-10-08).
// `TESTS` in `ARIA Sentinel/tests/run-all.mjs` is a hand-maintained array, on purpose, with the
// comment "a guard running outside the count it guards is the same lie in a nicer shirt." That
// comment is correct and it is also the hole. RUN-BV made the suite summary a verdict instead of a
// count — 375 registered, all green, none failing. It could not make the DENOMINATOR honest,
// because the denominator is whatever somebody remembered to type.
//
// A suite file that exists on disk and is NOT in `TESTS` is not red, not incomplete, and not
// counted. It is INVISIBLE. RUN-AW recorded exactly this once already and the answer each time was
// to remember. Four cycles remembered. The fifth would not have, and nothing would have noticed.
//
// This module does not fix that by globbing everything into the runner — a suite registered without
// being read is worse than one that never ran. It fixes it by making the gap IMPOSSIBLE TO HOLD
// SILENTLY: every unregistered suite file must carry an explicit recorded verdict with a reason, and
// a verdict that defers the decision carries a clock. "We forgot" cannot be written down. A ledger
// that rots — entries for files that no longer qualify — is red too, so the record cannot drift away
// from the disk it describes.
//
// Pure. Takes the three readings as data and returns the verdict. The globbing, the parse of
// `TESTS` and the clock live in `scripts/suite-census.mjs`, so a test can exercise every branch of
// the decision without touching a filesystem (BU/BV precedent).
export const SUITE_REGISTRY_SCHEMA = "suite-registry.v1";
export const SENDS = false;

/** How long a deferred verdict may stay deferred before it is itself a finding. */
export const DEFAULT_MAX_PENDING_DAYS = 14;

/** The only verdicts a human may record against an unregistered suite file. */
export const VERDICTS = Object.freeze({
  EXEMPT: "exempt",                     // legitimately not run by this runner — the reason must say WHY
  REGISTER_PENDING: "register-pending", // read, judged a real guard, registration scheduled — carries a clock
  DEAD: "dead",                         // read, judged dead weight — the reason must say what replaced it
});
const VERDICT_SET = new Set(Object.values(VERDICTS));

/** Phrases that look like a reason and are not one. A reason has to carry information. */
const EMPTY_REASONS = [
  "we forgot", "forgot", "tbd", "todo", "n/a", "na", "none", "unknown", "no reason",
  "not sure", "later", "see above", "obvious", "legacy", "misc", "-", "?",
];
const MIN_REASON_CHARS = 24;

/** A reason is real if it is long enough to say something and is not a placeholder. */
export function isRealReason(reason) {
  if (typeof reason !== "string") return false;
  const r = reason.trim();
  if (r.length < MIN_REASON_CHARS) return false;
  const flat = r.toLowerCase().replace(/[.!]+$/, "").trim();
  if (EMPTY_REASONS.includes(flat)) return false;
  // A reason that is only a restatement of the verdict word carries nothing.
  if (VERDICT_SET.has(flat)) return false;
  return true;
}

/** Whole days between two ISO stamps. A missing or impossible stamp is null, never 0. */
export function ageDays(stamp, now) {
  if (typeof stamp !== "string" || !stamp) return null;
  const t = Date.parse(stamp);
  if (!Number.isFinite(t)) return null;
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(nowMs)) return null;
  if (t > nowMs) return null; // a stamp in the future is a broken stamp, not a negative age
  return Math.floor((nowMs - t) / 86400000);
}

/**
 * Normalise one `TESTS` entry to a repo-root-relative POSIX path.
 * Entries are written relative to `ARIA Sentinel/tests`, some as `../../tests/x`, some bare.
 * A naive string diff against a disk listing double-counts and misses; that is why this exists.
 */
export function normaliseSpec(spec, base = "ARIA Sentinel/tests") {
  if (typeof spec !== "string" || !spec.trim()) return null;
  const joined = `${base}/${spec.trim()}`;
  const out = [];
  for (const part of joined.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") { out.pop(); continue; }
    out.push(part);
  }
  return out.join("/");
}

/**
 * The census.
 *
 * @param {object} input
 * @param {string[]} input.onDisk     every suite FILE found on disk, repo-root-relative POSIX
 * @param {string[]} input.registered raw `TESTS` entries, exactly as the runner holds them
 * @param {object[]} input.verdicts   ledger entries: { file, verdict, reason, openedAt? }
 * @param {Date|string} input.now
 * @param {number} [input.maxPendingDays]
 * @param {string} [input.base]
 */
export function censusSuites({ onDisk, registered, verdicts = [], now, maxPendingDays = DEFAULT_MAX_PENDING_DAYS, base = "ARIA Sentinel/tests" }) {
  const findings = [];
  const diskList = Array.isArray(onDisk) ? [...new Set(onDisk)] : [];
  const diskSet = new Set(diskList);

  const specs = Array.isArray(registered) ? registered : [];
  const normalised = [];
  for (const spec of specs) {
    const n = normaliseSpec(spec, base);
    if (!n) { findings.push({ kind: "unparseable-spec", spec }); continue; }
    normalised.push({ spec, path: n });
  }

  // A spec registered twice runs twice and inflates the denominator.
  const seen = new Map();
  for (const { spec, path: p } of normalised) {
    if (seen.has(p)) findings.push({ kind: "duplicate-registration", file: p, specs: [seen.get(p), spec] });
    else seen.set(p, spec);
  }
  const registeredSet = new Set(seen.keys());

  // A spec pointing at nothing is its own class. Today the runner reports it as a load error, which
  // is correct behaviour and the wrong NAME: it reads as a broken suite rather than a broken list.
  const registeredMissing = [...registeredSet].filter((p) => !diskSet.has(p)).sort();
  for (const file of registeredMissing) findings.push({ kind: "registered-but-missing", file });

  const registeredOnDisk = [...registeredSet].filter((p) => diskSet.has(p)).sort();
  const unregistered = diskList.filter((f) => !registeredSet.has(f)).sort();
  const unregisteredSet = new Set(unregistered);

  // Index the ledger, catching the two ways a ledger lies: duplicate rulings on one file, and
  // rulings about files that are no longer unregistered (stale — the record drifting off the disk).
  const byFile = new Map();
  const stale = [];
  const malformed = [];
  for (const entry of Array.isArray(verdicts) ? verdicts : []) {
    const file = entry && typeof entry.file === "string" ? entry.file : null;
    if (!file) { malformed.push({ kind: "verdict-without-file", entry }); continue; }
    if (byFile.has(file)) { malformed.push({ kind: "duplicate-verdict", file }); continue; }
    byFile.set(file, entry);
    if (!unregisteredSet.has(file)) {
      stale.push({ file, why: diskSet.has(file) ? "now registered in TESTS" : "no longer on disk" });
    }
  }
  for (const m of malformed) findings.push(m);
  for (const s of stale) findings.push({ kind: "stale-verdict", ...s });

  const unexplained = [];
  const expired = [];
  const accounted = { exempt: [], registerPending: [], dead: [] };

  for (const file of unregistered) {
    const entry = byFile.get(file);
    if (!entry) { unexplained.push({ file, why: "no verdict recorded" }); continue; }
    if (!VERDICT_SET.has(entry.verdict)) {
      unexplained.push({ file, why: `verdict ${JSON.stringify(entry.verdict)} is not one of ${[...VERDICT_SET].join(", ")}` });
      continue;
    }
    if (!isRealReason(entry.reason)) {
      // This is the gate's whole point: an exemption with no reason FAILS. No silent allowlist.
      unexplained.push({ file, why: "verdict carries no real reason" });
      continue;
    }
    if (entry.verdict === VERDICTS.REGISTER_PENDING) {
      const age = ageDays(entry.openedAt, now);
      if (age === null) {
        unexplained.push({ file, why: "register-pending without a readable openedAt cannot be aged, so it could be deferred forever" });
        continue;
      }
      if (age > maxPendingDays) { expired.push({ file, ageDays: age, maxPendingDays }); continue; }
      accounted.registerPending.push({ file, ageDays: age });
      continue;
    }
    if (entry.verdict === VERDICTS.EXEMPT) accounted.exempt.push({ file, reason: entry.reason });
    else accounted.dead.push({ file, reason: entry.reason });
  }

  for (const u of unexplained) findings.push({ kind: "unregistered-unexplained", ...u });
  for (const e of expired) findings.push({ kind: "register-pending-expired", ...e });

  const ok = findings.length === 0;
  return {
    schema: SUITE_REGISTRY_SCHEMA,
    ok,
    suitesOnDisk: diskList.length,
    suitesRegistered: registeredSet.size,
    registeredOnDisk: registeredOnDisk.length,
    registeredMissing,
    unregistered,
    unregisteredCount: unregistered.length,
    accounted,
    unexplained,
    expired,
    staleVerdicts: stale,
    findings,
    statement: statementFor({ ok, diskCount: diskList.length, registeredCount: registeredSet.size, findings, unexplained, expired, registeredMissing, accounted, maxPendingDays }),
  };
}

/** One honest line an operator can read without opening the JSON. */
export function statementFor({ ok, diskCount, registeredCount, findings, unexplained, expired, registeredMissing, accounted, maxPendingDays = DEFAULT_MAX_PENDING_DAYS }) {
  if (ok) {
    const deferred = accounted.registerPending.length;
    const base = `${diskCount} suite files on disk, ${registeredCount} registered in TESTS; every one of the ${diskCount - registeredCount} unregistered files carries a recorded verdict with a reason`;
    return deferred ? `${base} (${deferred} deferred on a ${maxPendingDays}-day clock).` : `${base}.`;
  }
  const parts = [];
  if (unexplained.length) parts.push(`${unexplained.length} unregistered suite file(s) have no honest verdict`);
  if (expired.length) parts.push(`${expired.length} deferred verdict(s) are past their clock`);
  if (registeredMissing.length) parts.push(`${registeredMissing.length} registered spec(s) point at nothing`);
  const other = findings.length - unexplained.length - expired.length - registeredMissing.length;
  if (other > 0) parts.push(`${other} further ledger fault(s)`);
  return `Suite census RED: ${parts.join("; ")}. A suite outside the count is invisible, not green.`;
}

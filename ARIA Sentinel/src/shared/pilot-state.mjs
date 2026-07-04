// RUN-C C2 — pure 14-day SMB free-pilot mechanic.
//
// This is DISTINCT from the 12-hour desktop trial gate in license.mjs (`computeTrialStatus`): that gate
// time-limits a quick demo; THIS is the standard SMB business-evaluation pilot — a 14-day window plus a
// local intake (org / size / top-3 pain) that lowers friction (no account creation to begin) and feeds
// onboarding (C3) + the case-study engine (RUN-D).
//
// No DOM, no I/O. The main process owns ~/.aria-sentinel/pilot.json; this module owns every decision so
// the whole mechanic is unit-tested.
//
// 🔒 Rule 14 (honesty IS the moat): a missing/blank start is `inactive` with `daysRemaining = null` —
// NEVER a fabricated countdown. We only ever show a number we can actually derive from a real start.
// 🔒 R11: free-text org/device fields are path-scrubbed before they can be persisted.

export const PILOT_DAY_MS = 24 * 60 * 60 * 1000;
export const PILOT_DEFAULT_DAYS = 14;     // standard SMB pilot length
export const PILOT_EXPIRING_DAYS = 3;     // "expiring" once <= 3 days remain (gentle, single heads-up window)
export const PILOT_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];
export const PILOT_MAX_PAINS = 3;

function parseStart(startedAt) {
  if (startedAt == null || startedAt === "") return null;
  if (typeof startedAt === "number") return Number.isFinite(startedAt) ? startedAt : null;
  const ms = Date.parse(String(startedAt));
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Pure pilot-state computation.
 * @param {{startedAt?: string|number|null, days?: number, now?: number}} args
 *   startedAt: ISO string or epoch-ms of pilot start (null/absent => not yet started).
 *   days: pilot length (default 14). now: epoch-ms (default Date.now()).
 * @returns {{state:'inactive'|'active'|'expiring'|'expired', daysRemaining:number|null,
 *            startedAt:string|null, expiresAt:string|null}}
 *   Real-or-empty: no start => { state:'inactive', daysRemaining:null, startedAt:null, expiresAt:null }.
 */
export function pilotStatus({ startedAt, days = PILOT_DEFAULT_DAYS, now = Date.now() } = {}) {
  const span = Math.max(1, Math.floor(Number(days) || PILOT_DEFAULT_DAYS));
  const started = parseStart(startedAt);
  if (started == null) {
    return { state: "inactive", daysRemaining: null, startedAt: null, expiresAt: null };
  }
  const expiresMs = started + span * PILOT_DAY_MS;
  const msLeft = expiresMs - now;
  const daysRemaining = Math.max(0, Math.ceil(msLeft / PILOT_DAY_MS));
  let state;
  if (msLeft <= 0) state = "expired";
  else if (daysRemaining <= PILOT_EXPIRING_DAYS) state = "expiring";
  else state = "active";
  return {
    state,
    daysRemaining,
    startedAt: new Date(started).toISOString(),
    expiresAt: new Date(expiresMs).toISOString()
  };
}

/** Human badge for the pilot status (real-or-empty: never invents a number). */
export function pilotBadge(status) {
  if (!status || status.state === "inactive") return "Free pilot";
  if (status.state === "expired") return "Pilot ended";
  const d = status.daysRemaining;
  if (d == null) return "Free pilot";
  return `Pilot · ${d} day${d === 1 ? "" : "s"} left`;
}

/**
 * Non-nagging upgrade prompt. Surfaces AT MOST ONCE per terminal state ('expiring', then 'expired'),
 * is always dismissible, and NEVER blocks the app (after expiry the product falls back to free Manual
 * mode — the user is never locked out). `dismissed` is the list of states already dismissed (persisted
 * by the caller). Returns null when there is nothing to show.
 * @returns {null | {show:true, blocking:false, state:string, key:string, title:string, body:string, cta:string, dismissible:true}}
 */
export function pilotUpgradePrompt(status, { dismissed = [] } = {}) {
  if (!status) return null;
  const st = status.state;
  if (st !== "expiring" && st !== "expired") return null;
  const seen = Array.isArray(dismissed) ? dismissed : Object.keys(dismissed || {});
  if (seen.includes(st)) return null;
  if (st === "expiring") {
    const d = status.daysRemaining;
    return {
      show: true, blocking: false, state: st, key: "pilot-expiring", dismissible: true,
      title: "Your free pilot is wrapping up",
      body: `${d} day${d === 1 ? "" : "s"} left on your ARIA pilot. Pick a plan when you're ready — nothing stops working today.`,
      cta: "See plans"
    };
  }
  return {
    show: true, blocking: false, state: st, key: "pilot-expired", dismissible: true,
    title: "Your free pilot has ended",
    body: "ARIA stays available in free Manual mode. Upgrade any time to re-enable Confirmed & Autonomous auto-fix.",
    cta: "See plans"
  };
}

// 🔒 R11 — strip anything that looks like a filesystem path out of a free-text field before it is
// persisted (mirrors sentinel-license-funnel.scrubField; kept local so this module has no deps).
export function scrubField(value) {
  return String(value == null ? "" : value)
    .replace(/[A-Za-z]:\\[^\s"']*/g, "[path]")
    .replace(/\/(?:Users|home|mnt|var|tmp)\/[^\s"']*/gi, "[path]")
    .replace(/\\\\[^\s"']+/g, "[path]")
    .trim();
}

function normalizePains(raw) {
  let list = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") list = raw.split(/[\n;]+/);
  return list.map((p) => scrubField(p)).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/**
 * Validate a pilot intake. Real-or-empty: org + a known size + 1..3 pains are required; nothing is
 * invented. @returns {{ok:boolean, errors:string[], value:{org,size,pains}|null}}
 */
export function validatePilotIntake(input = {}) {
  const errors = [];
  const org = scrubField(input.org);
  if (!org) errors.push("org-required");
  const size = String(input.size == null ? "" : input.size).trim();
  if (!PILOT_SIZES.includes(size)) errors.push("size-invalid");
  const pains = normalizePains(input.pains != null ? input.pains : input.topPains);
  if (pains.length === 0) errors.push("pains-required");
  if (pains.length > PILOT_MAX_PAINS) errors.push("pains-max-3");
  const ok = errors.length === 0;
  return { ok, errors, value: ok ? { org, size, pains } : null };
}

/**
 * Build the local pilot record persisted to ~/.aria-sentinel/pilot.json (the main process does the write;
 * this stays pure). NO external send. @returns {{ok:boolean, errors:string[], record:object|null}}
 */
export function buildPilotRecord(input = {}, { now = Date.now(), deviceId = "" } = {}) {
  const v = validatePilotIntake(input);
  if (!v.ok) return { ok: false, errors: v.errors, record: null };
  return {
    ok: true,
    errors: [],
    record: {
      schema: "pilot.v1",
      started_at: new Date(now).toISOString(),
      org: v.value.org,
      size: v.value.size,
      pains: v.value.pains,
      device_id: scrubField(deviceId)
    }
  };
}

// ────────────────────────────────────────────────────────────────────────────────────────────────────
// RUN-E E1 — time-to-first-value (TTFV) clock.
//
// The pilot's activation moment (started_at, C2) starts the clock; the FIRST real resolved issue —
// an audit-log RUN entry, the exact same signal the D2 pilot->paid proof counts — stops it. The stamp
// is written once into pilot.json and never changes afterwards ("first value" is first, forever).
//
// 🔒 Rule 14 (real-or-empty): no pilot start, no real fix at/after the start => NO stamp, and every
// surface shows "--". ttfvMinutes is only ever derived from two real timestamps we actually recorded.
// Fixes that happened BEFORE the pilot started are NOT the pilot's first value and never count.

/**
 * Earliest real fix at/after the pilot start, from the transparency/audit log.
 * @param {Array<{ts?:string,tag?:string}>} entries newest-first transparencyLog (order not assumed).
 * @param {{startedAt?: string|number|null}} args pilot start (ISO or epoch-ms).
 * @returns {number|null} epoch-ms of the FIRST qualifying RUN entry, or null (real-or-empty).
 */
export function firstFixAtFromAudit(entries, { startedAt } = {}) {
  const started = parseStart(startedAt);
  if (started == null || !Array.isArray(entries)) return null;
  let earliest = null;
  for (const e of entries) {
    if (!e || e.tag !== "RUN") continue;
    const t = Date.parse(String(e.ts == null ? "" : e.ts));
    if (!Number.isFinite(t) || t < started) continue;
    if (earliest == null || t < earliest) earliest = t;
  }
  return earliest;
}

/**
 * Stamp TTFV into a pilot record — pure, idempotent, write-once.
 * @param {object|null} record pilot.v1 record (needs a parseable started_at).
 * @param {{firstFixAt?: number|string|null, now?: number}} args firstFixAt from firstFixAtFromAudit.
 * @returns {{changed:boolean, record:object|null}} caller persists ONLY when changed === true.
 */
export function stampTtfv(record, { firstFixAt, now = Date.now() } = {}) {
  if (!record || typeof record !== "object") return { changed: false, record: record || null };
  if (record.ttfv && Number.isFinite(Number(record.ttfv.minutes))) return { changed: false, record }; // write-once
  const started = parseStart(record.started_at);
  const fix = parseStart(firstFixAt);
  if (started == null || fix == null || fix < started) return { changed: false, record }; // real-or-empty
  const minutes = Math.round(((fix - started) / 60000) * 10) / 10; // one decimal, never negative by guard above
  return {
    changed: true,
    record: {
      ...record,
      ttfv: {
        first_fix_at: new Date(fix).toISOString(),
        minutes,
        stamped_at: new Date(now).toISOString()
      }
    }
  };
}

/** Real-or-empty accessor: stamped minutes, or null. Never invents a number. */
export function ttfvMinutes(record) {
  const m = record && record.ttfv ? Number(record.ttfv.minutes) : NaN;
  return Number.isFinite(m) && m >= 0 ? m : null;
}

/** Dashboard label: "--" until a REAL first value exists (Rule 14), then e.g. "4.2 min". */
export function ttfvLabel(record) {
  const m = ttfvMinutes(record);
  return m == null ? "--" : `${m} min`;
}

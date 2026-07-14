// STAGE-3 S4 — PLAN STATE STORE (2026-07-14). The durable memory behind the S2/S3 brains.
//
// WHY THIS EXISTS, AND WHY IT IS SAFETY-CRITICAL, NOT PLUMBING.
// S3 grants UNATTENDED execution from a COUNT ON DISK: canRunUnattendedS3() says yes when
// planSupervisedSuccesses(history, planId) >= 10. So plan-history.json is not a cache — it is a
// CAPABILITY. A plain JSON file would mean: anyone (or any corruption) that writes
// {"plans":{"p":{"supervisedSuccesses":999}}} has just handed an agent the right to run on this
// machine with no click. That is a privilege-escalation path straight through the S3 gate.
// The same is true in reverse for the F1 durability ledger: a tampered ledger can HIDE a recurrence
// (so ARIA repeats a fix that already failed) or FAKE a durable resolution (so the deflection number
// lies). Both are Rule-14 violations written to disk.
//
// THE RULE HERE IS THEREFORE: TAMPER-EVIDENT, AND FAIL **CLOSED** — ALWAYS TOWARD LESS AUTHORITY.
//   · Every state file is sealed with an HMAC over its canonical bytes, keyed by a machine-local secret.
//   · Any doubt at all — missing · unreadable · not JSON · wrong version/kind · oversized · bad tag ·
//     no secret — collapses to the EMPTY state and trusted:false. Empty history = 0 successes =
//     NO autonomy. We never "repair" a count upward, never partially trust, never guess.
//   · Empty ledger = deflection is null (real-or-empty), never a flattering 0% and never a fake 100%.
//   · Writes are atomic (tmp + rename): a power cut can never leave a half-written file that happens
//     to parse as "9 successes".
//   · 🔒 R11 is check #1: nothing is read or written under the off-limits private folder, ever.
//
// Pure + injectable (house style: this module owns the POLICY, main.mjs owns the fs syscalls), so all
// of the above is provable headlessly. supervisor-agent / action-countdown / tier-0-executor: untouched.
import crypto from "node:crypto";
import { isBlockedPath, assertSafePath, R11_SURFACE } from "../shared/path-guard.mjs";
import { emptyDurabilityLedger, RECURRENCE_WINDOW_MS } from "../shared/durability-ledger.mjs";
import { emptyPlanHistory } from "./plan-autonomy-ladder.mjs";

export const STORE_VERSION = "plan-state-v1";
export const STATE_FILES = Object.freeze({
  durability: "plan-durability.json", // F1 ledger — what held, what came back.
  history: "plan-history.json",       // S3 ladder — the earned-autonomy counts. A CAPABILITY.
  window: "maintenance-window.json"   // S3 windows — WHEN a disruptive plan may run. Grants nothing.
});
export const STATE_KINDS = Object.freeze(Object.keys(STATE_FILES));
export const MAX_STATE_BYTES = 512 * 1024; // a state file is small; anything larger is not ours.
export const MAX_LEDGER_ISSUES = 500;      // bounded growth — the ledger can never eat the disk.

/** Distrust reasons are SYMBOLIC (content-blind): they never carry file contents or user text. */
export const DISTRUST = Object.freeze({
  MISSING: "missing",                 // first run — honest, not an error.
  NO_SECRET: "no-secret",             // no machine key → we cannot trust anything. Fail closed.
  UNREADABLE: "unreadable",
  NOT_JSON: "not-json",
  WRONG_VERSION: "wrong-store-version",
  WRONG_KIND: "wrong-kind",
  OVERSIZED: "oversized",
  TAMPERED: "integrity-mismatch",     // the bytes do not match the seal. Someone edited the file.
  R11_BLOCKED: "r11-blocked"
});

/** The honest zero for each kind. Empty history ⇒ zero successes ⇒ no autonomy. Empty window ⇒ no deferral. */
export function emptyFor(kind) {
  if (kind === "durability") return emptyDurabilityLedger();
  if (kind === "history") return emptyPlanHistory();
  if (kind === "window") return null; // "no configured window" — maintenance-window then invents no deferral.
  return null;
}

/** Deterministic bytes for a value: key order can never change the seal. */
export function canonicalJson(value) {
  const norm = (v) => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(norm);
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = norm(v[k]);
    return out;
  };
  return JSON.stringify(norm(value));
}

/** HMAC seal over the canonical bytes, bound to BOTH the store version and the kind (no cross-file replay). */
export function integrityTag(kind, state, secret) {
  if (!secret) return null;
  return crypto.createHmac("sha256", String(secret))
    .update(`${STORE_VERSION}|${kind}|${canonicalJson(state)}`)
    .digest("hex");
}

/** Wrap a state in its sealed envelope. Returns null when there is no secret (we refuse to write untrusted state). */
export function sealState(kind, state, { secret, now = Date.now() } = {}) {
  if (!STATE_FILES[kind]) return null;
  const tag = integrityTag(kind, state, secret);
  if (!tag) return null; // no secret → we would be writing state we could never trust again. Don't.
  return { v: STORE_VERSION, kind, savedAt: new Date(now).toISOString(), state, tag };
}

/**
 * Open raw file bytes into a TRUSTED state — or fail closed to the empty state.
 * @returns {{state:object|null, trusted:boolean, reason:string|null}} reason is symbolic, never content.
 */
export function openState(kind, raw, { secret } = {}) {
  const fail = (reason) => ({ state: emptyFor(kind), trusted: false, reason });
  if (!STATE_FILES[kind]) return fail(DISTRUST.WRONG_KIND);
  if (!secret) return fail(DISTRUST.NO_SECRET);
  if (raw == null || raw === "") return fail(DISTRUST.MISSING);
  const text = String(raw);
  if (text.length > MAX_STATE_BYTES) return fail(DISTRUST.OVERSIZED); // fail closed BEFORE parsing.
  if (isBlockedPath(text)) return fail(DISTRUST.R11_BLOCKED);         // 🔒 R11 — never ingest it.

  let env;
  try { env = JSON.parse(text); } catch { return fail(DISTRUST.NOT_JSON); }
  if (!env || typeof env !== "object") return fail(DISTRUST.NOT_JSON);
  if (env.v !== STORE_VERSION) return fail(DISTRUST.WRONG_VERSION);
  if (env.kind !== kind) return fail(DISTRUST.WRONG_KIND);            // a history file renamed to the ledger: no.

  const expect = integrityTag(kind, env.state, secret);
  const got = String(env.tag || "");
  const a = Buffer.from(String(expect || ""), "utf8");
  const b = Buffer.from(got, "utf8");
  // Constant-time compare; a length mismatch is already a mismatch.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return fail(DISTRUST.TAMPERED);

  return { state: env.state, trusted: true, reason: null };
}

/**
 * Bounded growth for the F1 ledger — WITHOUT ever weakening F1.
 * An issue still inside its 72h recurrence window is NEVER pruned: dropping it is exactly how ARIA
 * would forget that a fix failed and cheerfully repeat it. We evict the oldest issues that are already
 * PAST the recurrence window (their memory can no longer change a decision).
 */
export function pruneLedger(ledger, { max = MAX_LEDGER_ISSUES, now = Date.now() } = {}) {
  const issues = (ledger && ledger.issues) || {};
  const keys = Object.keys(issues);
  if (keys.length <= max) return ledger && ledger.issues ? ledger : emptyDurabilityLedger();

  const lastTs = (e) => {
    const arr = (e && Array.isArray(e.events) ? e.events : []).map((x) => Number(x && x.ts) || 0);
    return arr.length ? Math.max(...arr) : Number((e && e.lastTs) || 0);
  };
  const protectedKey = (k) => (now - lastTs(issues[k])) < RECURRENCE_WINDOW_MS; // inside 72h → untouchable.

  const evictable = keys.filter((k) => !protectedKey(k)).sort((x, y) => lastTs(issues[x]) - lastTs(issues[y]));
  const dropCount = Math.min(keys.length - max, evictable.length); // if everything is protected, we keep it all.
  const dropped = new Set(evictable.slice(0, dropCount));

  const kept = {};
  for (const k of keys) if (!dropped.has(k)) kept[k] = issues[k];
  return { ...(ledger || {}), issues: kept };
}

/**
 * The ATOMIC write plan: main.mjs writes `tmpPath` then renames it onto `path`. The final path is never
 * opened for writing, so an interrupted save leaves the previous good file completely intact.
 * 🔒 R11 — check #1: a blocked directory refuses here, before any fs handle exists.
 */
export function writePlan(kind, state, dir, { secret, now = Date.now() } = {}) {
  assertSafePath(dir); // 🔒 R11 — throws R11_BLOCKED; nothing is created.
  if (!STATE_FILES[kind]) return { ok: false, reason: DISTRUST.WRONG_KIND };
  const sealed = sealState(kind, state, { secret, now });
  if (!sealed) return { ok: false, reason: DISTRUST.NO_SECRET }; // refuse to persist state we can't seal.
  const json = JSON.stringify(sealed);
  if (json.length > MAX_STATE_BYTES) return { ok: false, reason: DISTRUST.OVERSIZED };
  const file = STATE_FILES[kind];
  return {
    ok: true,
    path: `${dir}/${file}`,
    tmpPath: `${dir}/${file}.tmp`, // write here, then rename. Never write `path` directly.
    json,
    bytes: json.length
  };
}

/**
 * The store, with fs INJECTED (tests pass a fake; main.mjs passes node:fs).
 * fs: { readFileSync(path)->string|null, writeFileSync(path, data), renameSync(from, to) }
 */
export function makePlanStateStore({ dir, fs, secret, now = () => Date.now() } = {}) {
  const readOne = (kind) => {
    let raw = null;
    if (isBlockedPath(dir)) return { state: emptyFor(kind), trusted: false, reason: DISTRUST.R11_BLOCKED, surface: R11_SURFACE };
    try { raw = fs.readFileSync(`${dir}/${STATE_FILES[kind]}`); }
    catch (e) { return { state: emptyFor(kind), trusted: false, reason: e && e.code === "ENOENT" ? DISTRUST.MISSING : DISTRUST.UNREADABLE }; }
    return openState(kind, raw, { secret });
  };

  return {
    /** Load a state. NEVER throws, NEVER invents: on any doubt you get the empty state + trusted:false. */
    load(kind) { return readOne(kind); },

    /** Save a state atomically. Returns {ok, reason?}. Prunes the ledger so the file stays bounded. */
    save(kind, state) {
      const toWrite = kind === "durability" ? pruneLedger(state, { now: now() }) : state;
      let plan;
      try { plan = writePlan(kind, toWrite, dir, { secret, now: now() }); }
      catch (e) { return { ok: false, reason: e && e.code === "R11_BLOCKED" ? DISTRUST.R11_BLOCKED : DISTRUST.UNREADABLE }; }
      if (!plan.ok) return plan;
      try {
        fs.writeFileSync(plan.tmpPath, plan.json);
        fs.renameSync(plan.tmpPath, plan.path); // ← the atomic swap.
      } catch { return { ok: false, reason: DISTRUST.UNREADABLE }; }
      return { ok: true, bytes: plan.bytes, path: plan.path };
    },

    /**
     * THE AUTONOMY GATE ON DISK. Unattended execution may ONLY be considered from a history we can
     * prove we wrote. An untrusted history is not "probably fine" — it is zero.
     * @returns {{history:object, trusted:boolean, reason:string|null}}
     */
    trustedPlanHistory() {
      const r = readOne("history");
      if (!r.trusted) return { history: emptyPlanHistory(), trusted: false, reason: r.reason };
      return { history: r.state, trusted: true, reason: null };
    }
  };
}

/** The honest one-liner for the plan card when persisted state could not be trusted. Never blames the user. */
export function distrustLine(reason) {
  if (!reason || reason === DISTRUST.MISSING) return null; // a first run is not a warning.
  if (reason === DISTRUST.TAMPERED) return "ARIA's saved plan history could not be verified, so it is being ignored. Plans will ask for your click until they earn autonomy again.";
  if (reason === DISTRUST.NO_SECRET) return "ARIA has no machine key yet, so saved plan history cannot be verified. Plans will ask for your click.";
  if (reason === DISTRUST.R11_BLOCKED) return `Plan history was not read — ${R11_SURFACE}.`;
  return "ARIA's saved plan history could not be read, so it is being ignored. Plans will ask for your click.";
}

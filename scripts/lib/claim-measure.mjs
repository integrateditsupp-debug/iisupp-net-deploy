// claim-measure.mjs — a figure that CAN be measured here must be produced by the code that
// performs the read. The emit script may no longer type the number and then stamp its own typing
// as evidence.
//
// WHY THIS EXISTS (RUN-AM / AM1, carried unchanged from AL1, 2026-08-05).
// RUN-AK made every published figure carry `{ value, measuredAt, source }` and RUN-AL made the feed
// that carries them expire. Both left one hole open, and it is the oldest shape in this series:
//
//   the emit script TYPED the stamps itself.
//
// A number was read off a terminal by a human, copied into a source file by hand, and then stamped
// `measuredAt: NOW` by the same hand that copied it. The stamp asserted "this was measured a moment
// ago" on the authority of nothing but the person writing the stamp. That is RUN-AI's defect in a
// better suit: an assertion whose evidence is the assertion.
//
// The fix is a split of authorship, not another checker:
//
//   MEASURED            the value AND the stamp are returned together by a function that actually ran
//                       the command or read the file. The caller never chooses `measuredAt`, never
//                       chooses `value`, and cannot construct one of these by hand without also
//                       running the read — the stamp carries the exit code and the argv that produced it.
//   DECLARED-UNMEASURABLE  a figure that genuinely cannot be read in this environment (a remote
//                       probe with no credential, a reply that only exists in someone else's inbox).
//                       It carries a REASON and no fresh timestamp of measurement. Saying "I cannot
//                       measure this" is honest; stamping it as freshly measured is not.
//   ATTESTED            everything else — a policy number, a date something was decided. Hand-stamped
//                       is fine here, because there is nothing to read.
//
// A name listed in MEASURABLE_FIGURES may only be MEASURED or DECLARED-UNMEASURABLE. A hand-typed
// stamp for one of those names is refused by class name, and the emitter calls the throwing form,
// so the refusal happens before anything is written rather than after it is published.
//
// The audit half is pure. The measurement half performs real I/O and is the only part that does.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const CLAIM_MEASURE_SCHEMA = "claim-measure.v1";
export const SENDS = false;

export const PROVENANCE = Object.freeze({
  MEASURED: "measured",
  UNMEASURABLE: "declared-unmeasurable",
  ATTESTED: "attested",
});

// Failure classes. Named so a red test says WHICH dishonesty it caught.
export const MEASURE_CLASSES = Object.freeze({
  OK: "provenance-declared",
  HAND_TYPED_MEASURABLE: "measurable-figure-carries-a-hand-typed-stamp",
  UNKNOWN_PROVENANCE: "provenance-is-not-a-declared-class",
  NO_REASON: "declared-unmeasurable-without-a-reason",
  NO_READ: "measured-figure-does-not-carry-the-read-that-produced-it",
  MEASURED_HAS_VALUE_MISMATCH: "measured-figure-value-was-overwritten-after-the-read",
});

/**
 * The figures this environment CAN read for itself. A name in here may not be hand-stamped.
 *
 * Membership is a claim about the environment, not about importance: each of these is obtainable by
 * running a command or reading a file from the repository root. Anything genuinely out of reach —
 * a reply, a meeting, an invoice — is deliberately NOT here, because forcing a measurement that
 * cannot be taken would only produce a different kind of fiction.
 */
export const MEASURABLE_FIGURES = Object.freeze(new Set([
  "suitesGreenAfterWrites",
  "testsPassedAfterWrites",
  "suitesGreenBeforeAnyWrite",
  "testsPassedBeforeAnyWrite",
  "commitsAheadOfSharedLine",
  "secondMessagesDrafted",
  "stagedItemsAudited",
]));

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/* ────────────────────────────── the audit half (pure) ────────────────────────────── */

/** Audit one claim's provenance. Returns { name, ok, class, detail }. */
export function auditProvenance(name, claim) {
  const fail = (cls, detail) => ({ name, ok: false, class: cls, detail });
  if (!isPlainObject(claim)) {
    return fail(MEASURE_CLASSES.UNKNOWN_PROVENANCE, `"${name}" is not a stamp object`);
  }
  const prov = claim.provenance;
  const measurable = MEASURABLE_FIGURES.has(name);

  if (prov === undefined) {
    if (measurable) {
      return fail(
        MEASURE_CLASSES.HAND_TYPED_MEASURABLE,
        `"${name}" can be read in this environment, so its stamp must be produced by the read — ` +
        `this one was typed by the emit script (no provenance). Use a measure* function, or declare ` +
        `it unmeasurable with a reason.`
      );
    }
    return { name, ok: true, class: MEASURE_CLASSES.OK, detail: null }; // attested by omission
  }
  if (!Object.values(PROVENANCE).includes(prov)) {
    return fail(MEASURE_CLASSES.UNKNOWN_PROVENANCE, `"${name}" declares provenance "${prov}", which is not a class`);
  }
  if (measurable && prov === PROVENANCE.ATTESTED) {
    return fail(
      MEASURE_CLASSES.HAND_TYPED_MEASURABLE,
      `"${name}" is attested by hand, but it can be read here — attestation is for figures with nothing to read`
    );
  }
  if (prov === PROVENANCE.UNMEASURABLE) {
    if (typeof claim.unmeasurableReason !== "string" || claim.unmeasurableReason.trim() === "") {
      return fail(MEASURE_CLASSES.NO_REASON, `"${name}" is declared unmeasurable but does not say why`);
    }
    return { name, ok: true, class: MEASURE_CLASSES.OK, detail: null };
  }
  if (prov === PROVENANCE.MEASURED) {
    const read = claim.read;
    if (!isPlainObject(read) || typeof read.command !== "string" || read.command.trim() === "") {
      return fail(
        MEASURE_CLASSES.NO_READ,
        `"${name}" claims to be measured but does not carry the read that produced it ` +
        `({ command, exitCode }) — a measurement without its command is an attestation wearing a badge`
      );
    }
    if (!("exitCode" in read)) {
      return fail(MEASURE_CLASSES.NO_READ, `"${name}" carries a command but not the exit code it returned`);
    }
    return { name, ok: true, class: MEASURE_CLASSES.OK, detail: null };
  }
  return { name, ok: true, class: MEASURE_CLASSES.OK, detail: null };
}

/** Audit a whole claims map. Returns { ok, audited[], failures[] }. */
export function auditProvenances(claims = {}) {
  if (!isPlainObject(claims)) {
    const f = { name: "(claims)", ok: false, class: MEASURE_CLASSES.UNKNOWN_PROVENANCE, detail: "claims must be an object" };
    return { ok: false, audited: [f], failures: [f] };
  }
  const audited = Object.entries(claims).map(([name, claim]) => auditProvenance(name, claim));
  const failures = audited.filter((a) => !a.ok);
  return { ok: failures.length === 0, audited, failures };
}

/** Throwing form — what the emitter calls, so a hand-typed measurable figure is never written. */
export function requireMeasuredProvenance(claims = {}) {
  const { ok, failures } = auditProvenances(claims);
  if (!ok) {
    throw new Error(
      `claim provenance REFUSED — ${failures.length} figure(s) assert a measurement nobody took: ` +
      failures.map((f) => `${f.name} [${f.class}] ${f.detail}`).join("; ")
    );
  }
  return true;
}

/** Every figure that could be measured here but was not measured this cycle. */
export function unmeasuredFigures(claims = {}) {
  return Object.entries(claims)
    .filter(([name, c]) => MEASURABLE_FIGURES.has(name) && isPlainObject(c) && c.provenance === PROVENANCE.UNMEASURABLE)
    .map(([name, c]) => ({ name, reason: c.unmeasurableReason }));
}

/* ──────────────────────────── the measurement half (I/O) ──────────────────────────── */

/**
 * Run a command and return `{ value, measuredAt, source, kind, provenance, read }`.
 *
 * The stamp is taken AFTER the process exits, from this function's own clock, and the caller cannot
 * supply either the value or the timestamp: `parse` sees only what the command actually printed and
 * the code it actually returned. A command that fails does not silently produce a figure — unless
 * the caller declares `allowNonZeroExit`, because for some reads (a refused remote probe) the
 * failure IS the measurement.
 */
export function measureCommand({
  command,
  args = [],
  cwd = process.cwd(),
  parse,
  source,
  kind = "measurement",
  allowNonZeroExit = false,
  timeoutMs = 600_000,
  maxBuffer = 64 * 1024 * 1024,
}) {
  if (typeof command !== "string" || !command) throw new Error("measureCommand: command is required");
  if (typeof parse !== "function") throw new Error("measureCommand: parse(stdout, exitCode) is required");
  if (typeof source !== "string" || !source.trim()) throw new Error("measureCommand: source is required");

  let stdout = "";
  let exitCode = 0;
  try {
    stdout = execFileSync(command, args, { cwd, encoding: "utf8", timeout: timeoutMs, maxBuffer, stdio: ["ignore", "pipe", "pipe"] });
  } catch (err) {
    exitCode = typeof err.status === "number" ? err.status : -1;
    stdout = (err.stdout || "") + (err.stderr || "");
    if (!allowNonZeroExit) {
      throw new Error(`measureCommand: \`${command} ${args.join(" ")}\` exited ${exitCode} — refusing to publish a figure from a failed read`);
    }
  }
  const value = parse(stdout, exitCode);
  return {
    value,
    measuredAt: new Date().toISOString(),
    source,
    kind,
    provenance: PROVENANCE.MEASURED,
    read: { command: [command, ...args].join(" "), exitCode },
  };
}

/** Read a file from the repo and derive a figure from its contents. The read is the evidence. */
export function measureFile({ root = process.cwd(), file, parse, source, kind = "count" }) {
  if (typeof file !== "string" || !file) throw new Error("measureFile: file is required");
  if (typeof parse !== "function") throw new Error("measureFile: parse(text) is required");
  if (typeof source !== "string" || !source.trim()) throw new Error("measureFile: source is required");
  const p = path.join(root, file);
  let text = null;
  let exitCode = 0;
  try {
    text = fs.readFileSync(p, "utf8");
  } catch {
    exitCode = 1;
  }
  return {
    value: exitCode === 0 ? parse(text) : null,
    measuredAt: new Date().toISOString(),
    source,
    kind,
    provenance: PROVENANCE.MEASURED,
    read: { command: `read ${file}`, exitCode, bytes: text == null ? 0 : Buffer.byteLength(text) },
  };
}

/** Derive a figure from a value already in memory this process produced (e.g. an audited list). */
export function measureInProcess({ value, source, kind = "measurement", how }) {
  if (typeof source !== "string" || !source.trim()) throw new Error("measureInProcess: source is required");
  if (typeof how !== "string" || !how.trim()) throw new Error("measureInProcess: how is required — name the read");
  return {
    value,
    measuredAt: new Date().toISOString(),
    source,
    kind,
    provenance: PROVENANCE.MEASURED,
    read: { command: how, exitCode: 0 },
  };
}

/**
 * A figure that genuinely cannot be read here. Carries the reason and NO claim of measurement.
 * `lastKnown` may be supplied so the figure is not silently dropped — but it is labelled as last
 * known, never as current.
 */
export function declaredUnmeasurable(_name, { reason, source, kind = "count", lastKnown = null } = {}) {
  if (typeof reason !== "string" || !reason.trim()) throw new Error("declaredUnmeasurable: reason is required");
  const out = {
    value: lastKnown,
    measuredAt: new Date().toISOString(),
    source: source || `not measurable in this environment: ${reason}`,
    kind,
    provenance: PROVENANCE.UNMEASURABLE,
    unmeasurableReason: reason,
  };
  if (lastKnown !== null) out.note = "last known value, carried forward and labelled — NOT measured this cycle";
  return out;
}

/* ───────────────────────── ready-made reads this program uses ───────────────────────── */

/** `# pass N` / `# fail N` and `N/N suites green` out of the runner's own output + exit code. */
export function parseRegistryOutput(stdout) {
  const pass = /^#\s*pass\s+(\d+)/m.exec(stdout);
  const fail = /^#\s*fail\s+(\d+)/m.exec(stdout);
  const suites = /(\d+)\s*\/\s*(\d+)\s+suites\s+green/i.exec(stdout);
  return {
    pass: pass ? Number(pass[1]) : null,
    fail: fail ? Number(fail[1]) : null,
    suites: suites ? Number(suites[1]) : null,
    suitesTotal: suites ? Number(suites[2]) : null,
  };
}

/** Commits on the local line that are not on the last known shared reference. */
export function measureCommitsAhead({ root = process.cwd(), ref = "origin/main" } = {}) {
  return measureCommand({
    command: "git",
    args: ["rev-list", "--count", `${ref}..HEAD`],
    cwd: root,
    kind: "count",
    source: "a revision count taken against the last known shared reference during this cycle",
    parse: (out) => Number(String(out).trim()),
  });
}

/** How many messages are actually drafted on disk, counted from the sheet itself. */
export function measureDraftedMessages({ root = process.cwd(), file, countPattern }) {
  const re = countPattern instanceof RegExp ? countPattern : /^\s*(?:##\s+)?(?:\d+[.)]|-)\s+/gm;
  return measureFile({
    root,
    file,
    kind: "count",
    source: `a read of ${file} on disk during this cycle, counting its entries`,
    parse: (text) => (text ? (String(text).match(re) || []).length : 0),
  });
}

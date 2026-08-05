// staged-action-guard.mjs — a staged one-click action must name the artefact it operates on.
//
// WHY THIS EXISTS (RUN-AJ / AJ1, 2026-08-05).
// For fourteen days the program reported "12 follow-ups drafted, awaiting one click" and named the
// send as an operator decision. RUN-AI audited it and found the message bodies were not on disk in
// any readable form — they existed only as the return value of a function no cycle had run. So a
// click was reported as staged and waiting on a human while the thing to be clicked did not exist.
// The funnel had not stalled on a declined decision; the work had never been handed over.
//
// That failure was possible because a record could ASSERT staged-ness with nothing behind it. This
// module removes that possibility structurally: every staged action must declare EITHER the readable
// artefact it operates on (a path that must exist and be non-empty) OR, explicitly, that it has no
// artefact and why. Prose that claims something is drafted, written, rendered or ready while the item
// declares no artefact is refused by name — that is exactly RUN-AI's shape.
//
// A staged action with no artefact is a false claim under Rule 14 and should fail like one.
//
// Pure: reads the filesystem for existence and size only. Sends nothing, writes nothing.
import fs from "node:fs";
import path from "node:path";

export const STAGED_ACTION_GUARD_SCHEMA = "staged-action-guard.v1";
export const SENDS = false;
export const WRITES = false;

// Failure classes. Named so a red test says WHICH dishonesty it caught, never just "invalid".
export const CLASSES = Object.freeze({
  OK: "artefact-backed",
  NO_DECLARATION: "no-artefact-declared",
  AMBIGUOUS: "both-artefact-and-noArtefact-declared",
  MISSING: "artefact-named-but-absent",
  EMPTY: "artefact-named-but-empty",
  PROSE_CLAIMS: "prose-claims-an-artefact-that-is-not-declared",
  NOT_A_FILE: "artefact-path-is-not-a-file",
  UNVERIFIABLE: "artefact-under-an-untracked-root-that-is-absent-here",
});

// Words that assert a thing exists to be acted on. If prose uses them, an artefact must be declared.
// Deliberately narrow: these all claim a rendered OBJECT, not merely an intention.
const ARTEFACT_CLAIMING = [
  /\bdrafted\b/i,
  /\bwritten (?:down|to|out)\b/i,
  /\brendered\b/i,
  /\bon (?:your |the )?disk\b/i,
  /\bsitting (?:on|in)\b/i,
  /\bthe file\b/i,
  /\bsend sheet\b/i,
  /\bfull bodies\b/i,
  /\bready to (?:paste|copy|send)\b/i,
];

// Roots that are deliberately untracked (operator records). An artefact inside one is verifiable on
// the operator's machine and honestly UNVERIFIABLE anywhere else — never silently passed as green.
export const DEFAULT_UNTRACKED_ROOTS = Object.freeze(["senior-director-state/"]);

const isUnder = (p, root) => p === root.replace(/\/$/, "") || p.startsWith(root);

/**
 * Audit one staged action.
 * @param item  { item, what, why, artefact?, noArtefact? }
 * @param opts  { root, untrackedRoots }
 */
export function auditStagedAction(item = {}, { root = process.cwd(), untrackedRoots = DEFAULT_UNTRACKED_ROOTS } = {}) {
  const name = String(item.item ?? "(unnamed staged action)");
  const prose = [item.what, item.why].filter(Boolean).join(" ");
  const hasArtefact = typeof item.artefact === "string" && item.artefact.trim() !== "";
  const hasNoArtefact = typeof item.noArtefact === "string" && item.noArtefact.trim() !== "";

  const fail = (cls, detail) => ({ name, ok: false, class: cls, detail, artefact: item.artefact ?? null });

  if (hasArtefact && hasNoArtefact) {
    return fail(CLASSES.AMBIGUOUS, "declares an artefact AND declares it has none; one of the two is untrue");
  }

  if (!hasArtefact && !hasNoArtefact) {
    return fail(
      CLASSES.NO_DECLARATION,
      "a staged one-click action must name the readable artefact it operates on, or state explicitly " +
        "that it has none and why. This item does neither, so nobody can tell whether the click is real",
    );
  }

  if (hasNoArtefact) {
    const claim = ARTEFACT_CLAIMING.find((re) => re.test(prose));
    if (claim) {
      return fail(
        CLASSES.PROSE_CLAIMS,
        `declares no artefact, but its own prose claims one (matched ${claim}). This is RUN-AI's exact ` +
          "failure shape: a click reported as staged with nothing to act on",
      );
    }
    return { name, ok: true, class: CLASSES.OK, artefact: null, note: item.noArtefact };
  }

  // An artefact is declared — it must actually be there and hold something.
  const rel = item.artefact.trim().replace(/^\.\//, "");
  const abs = path.resolve(root, rel);
  let st = null;
  try {
    st = fs.statSync(abs);
  } catch {
    /* absent */
  }

  if (!st) {
    const untracked = untrackedRoots.find((r) => isUnder(rel, r));
    if (untracked && !fs.existsSync(path.resolve(root, untracked))) {
      // The whole record root is absent (bare clone). Honest third state: not a pass, not a failure.
      return {
        name,
        ok: true,
        class: CLASSES.UNVERIFIABLE,
        artefact: rel,
        note:
          `the untracked root ${untracked} is not present in this checkout, so this artefact cannot be ` +
          "verified here. It is neither claimed green nor failed — it is unverifiable, said out loud",
      };
    }
    return fail(CLASSES.MISSING, `names ${rel}, which does not exist. The click has nothing to operate on`);
  }

  if (!st.isFile()) return fail(CLASSES.NOT_A_FILE, `${rel} exists but is not a file`);
  if (st.size === 0) return fail(CLASSES.EMPTY, `${rel} exists but is empty — an empty artefact is not a handover`);

  return { name, ok: true, class: CLASSES.OK, artefact: rel, bytes: st.size };
}

/**
 * Audit a whole list of staged actions.
 * @returns { ok, schema, findings, failures, summary }
 */
export function auditStagedActions(items = [], opts = {}) {
  const findings = items.map((i) => auditStagedAction(i, opts));
  const failures = findings.filter((f) => !f.ok);
  const counts = findings.reduce((acc, f) => ({ ...acc, [f.class]: (acc[f.class] ?? 0) + 1 }), {});
  return {
    schema: STAGED_ACTION_GUARD_SCHEMA,
    ok: failures.length === 0,
    findings,
    failures,
    summary: {
      audited: findings.length,
      backed: findings.filter((f) => f.ok && f.class === CLASSES.OK && f.artefact).length,
      declaredNoArtefact: findings.filter((f) => f.ok && f.class === CLASSES.OK && !f.artefact).length,
      unverifiableHere: findings.filter((f) => f.class === CLASSES.UNVERIFIABLE).length,
      failed: failures.length,
      counts,
    },
  };
}

/** Throw on the first dishonest staged claim. Used by the emitter so a bad feed cannot be written. */
export function assertStagedActionsHonest(items = [], opts = {}) {
  const res = auditStagedActions(items, opts);
  if (!res.ok) {
    const lines = res.failures.map((f) => `  · ${f.name} [${f.class}] — ${f.detail}`);
    throw new Error(
      "REFUSED: staged one-click actions must name a readable artefact (Rule 14).\n" + lines.join("\n"),
    );
  }
  return res;
}

export default { auditStagedAction, auditStagedActions, assertStagedActionsHonest, CLASSES, STAGED_ACTION_GUARD_SCHEMA };

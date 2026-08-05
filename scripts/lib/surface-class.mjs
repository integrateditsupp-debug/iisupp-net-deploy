// surface-class.mjs — RUN-AP / AP1. THE EXEMPTION, ARGUED IN CODE BEFORE ANY COPY IS WRITTEN.
//
// WHY THIS EXISTS (2026-08-05).
// AO1 read the first screen of fifteen customer entry points and found six that say only what they
// are. The obvious next move is to rewrite six pages until the number goes green. Six of those
// pages are not the same kind of page: `terms.html` is a legal obligation. It is not required to
// sell anything, and rewriting it to make a Rule 17 counter move would be dishonest in exactly the
// way this program spends every cycle refusing.
//
// So the exemption is written FIRST, in code, with a stated reason per surface — before a single
// word of copy is touched. An exemption that is argued for is honest. An exemption quietly
// special-cased to make a number go green is a fabricated metric wearing a different hat.
//
// THE SPLIT.
//   SALES SURFACE      — exists to make a stranger want to talk to us. MUST make a value claim
//                        above the fold (Rule 17) and every assertion in it must survive Rule 14.
//   OBLIGATION SURFACE — exists because the law, a policy, or a contract requires it. MUST be
//                        honest and MUST be reachable. It is NOT required to sell, and it is
//                        reported as `exempt-with-a-reason`.
//
// WHAT THE EXEMPTION DOES NOT COVER. An obligation surface is exempt from Rule 17 ONLY. Every
// Rule 14 class — guarantee language, an experience overclaim, the forbidden name, fabricated
// proof, an uncarried metric — still fails red on an obligation surface. A page that cannot lie is
// not the same as a page that need not sell, and folding those two would be the same mistake in
// reverse.
//
// THE THIRD VERDICT, AGAIN. AN1 and AO1 both refuse to fold `unchecked` into `passed`. This module
// refuses to fold `exempt` into `passed` for the identical reason: a count that quietly absorbs the
// things it could not judge is a number that cannot be challenged.
//
// Pure: reads files through the AO1 auditor. Sends nothing, writes nothing, no network.
import { auditEntryPoints, VERDICT, CLASSES as FS_CLASSES } from "./first-screen-audit.mjs";

export const SURFACE_CLASS_SCHEMA = "surface-class.v1";
export const SENDS = false;
export const WRITES = false;

export const SURFACE = Object.freeze({
  SALES: "sales-surface",
  OBLIGATION: "obligation-surface",
});

export const CLASSES = Object.freeze({
  EXEMPT_WITHOUT_REASON: "obligation-surface-declared-without-a-reason",
  EXEMPT_FOLDED_INTO_PASSED: "exempt-count-folded-into-the-pass-count",
  SALES_SILENT: FS_CLASSES.NO_CLAIM,
});

// The Rule 14 classes. These fail on EVERY surface, sales or obligation, without exception.
export const RULE_14_CLASSES = Object.freeze(new Set([
  FS_CLASSES.GUARANTEE,
  FS_CLASSES.EXPERIENCE_OVERCLAIM,
  FS_CLASSES.FORBIDDEN_NAME,
  FS_CLASSES.FABRICATED_PROOF,
  FS_CLASSES.UNCARRIED_METRIC,
]));

// ── THE DECLARED EXEMPTIONS. Each one carries the argument for itself, in words, on this line. ────
// Adding a file here is a claim that the page exists to discharge an obligation rather than to win
// a customer. The reason is not documentation — the test reads it, and an empty one fails red.
export const OBLIGATION_SURFACES = Object.freeze({
  "terms.html":
    "A terms-of-service page is a contract surface. Its job is to state the terms accurately and be " +
    "reachable from every page; a reader arriving here is already a customer or is checking what they " +
    "would be agreeing to. Requiring it to open with a value claim would push sales language into the " +
    "one document a reader must be able to trust as plain, unpersuasive fact.",

  "security.html":
    "A coordinated vulnerability-disclosure page is addressed to security researchers, not to buyers. " +
    "Its obligations are to state scope, a reporting channel and response commitments accurately and " +
    "to stay reachable. A researcher reading it needs a mailbox and a timeline, not a benefit " +
    "statement, and dressing a disclosure policy in marketing language would make the one page whose " +
    "whole value is being taken literally read as though it were selling something. NOTE THE LIMIT: " +
    "trust.html is NOT exempt on this argument — it is addressed to buyers evaluating whether to let " +
    "us touch their systems, which is a sale, so it must earn its reader like any other sales surface.",
});

/**
 * Every entry point that is NOT declared an obligation surface is a sales surface. The default is
 * deliberately the demanding one: a page has to be argued OUT of having to earn its reader, never
 * argued in.
 */
export function classifySurface(file, obligations = OBLIGATION_SURFACES) {
  const rel = String(file || "").replace(/\\/g, "/").replace(/^\.\//, "");
  const map = obligations && typeof obligations === "object" ? obligations : {};
  const reason = Object.prototype.hasOwnProperty.call(map, rel) ? map[rel] : null;
  if (reason === null || reason === undefined) return { file: rel, surface: SURFACE.SALES, reason: null };
  return { file: rel, surface: SURFACE.OBLIGATION, reason };
}

/** A declared exemption with no argument behind it is refused by name. */
export function validateExemptions(map = OBLIGATION_SURFACES) {
  const failures = [];
  for (const [file, reason] of Object.entries(map || {})) {
    if (typeof reason !== "string" || reason.trim().length < 40) {
      failures.push({
        file,
        class: CLASSES.EXEMPT_WITHOUT_REASON,
        detail:
          `"${file}" is declared an obligation surface with ` +
          (reason == null || String(reason).trim() === ""
            ? "no reason at all"
            : `a reason of ${String(reason).trim().length} characters`) +
          " — an exemption that is not argued for is a special case, and a special case that moves a " +
          "number is a fabricated metric. State why this page is not required to sell.",
      });
    }
  }
  return { ok: failures.length === 0, failures };
}

/**
 * Audit the entry points, split by surface class.
 *
 * Returned counts, and what each one is allowed to mean:
 *   passed    — SALES surfaces that make a value claim and violate no Rule 14 class. Nothing else.
 *   broken    — SALES surfaces that are silent, plus ANY surface with a Rule 14 finding.
 *   exempt    — OBLIGATION surfaces, each carrying its reason. Never added to `passed`.
 *   unchecked — undecidable from disk, exactly as AO1 reports it. Never added to either.
 */
export function auditSalesSurfaces({ root = process.cwd(), entryPoints = [], carriedFigures = [],
  obligations = OBLIGATION_SURFACES } = {}) {
  const exemptions = validateExemptions(obligations);
  const base = auditEntryPoints({ root, entryPoints, carriedFigures });

  const results = base.results.map((r) => {
    const cls = classifySurface(r.file, obligations);
    const rule14 = r.findings.filter((f) => RULE_14_CLASSES.has(f.class));
    const silent = r.findings.some((f) => f.class === FS_CLASSES.NO_CLAIM);

    if (r.verdict === VERDICT.UNCHECKED) {
      return { ...r, ...cls, bucket: "unchecked", rule14, silent: false };
    }
    if (rule14.length) {
      // Rule 14 outranks the exemption. An obligation surface may be silent; it may not lie.
      return { ...r, ...cls, bucket: "broken", rule14, silent };
    }
    if (cls.surface === SURFACE.OBLIGATION) {
      return { ...r, ...cls, bucket: "exempt", rule14, silent };
    }
    return { ...r, ...cls, bucket: silent ? "broken" : "passed", rule14, silent };
  });

  const of = (b) => results.filter((r) => r.bucket === b);
  const passed = of("passed");
  const broken = of("broken");
  const exempt = of("exempt");
  const unchecked = of("unchecked");

  return {
    schema: SURFACE_CLASS_SCHEMA,
    ok: exemptions.ok && broken.length === 0,
    exemptionsValid: exemptions.ok,
    exemptionFailures: exemptions.failures,
    results, passed, broken, exempt, unchecked,
    summary: {
      entryPoints: results.length,
      salesSurfaces: results.filter((r) => r.surface === SURFACE.SALES).length,
      obligationSurfaces: results.filter((r) => r.surface === SURFACE.OBLIGATION).length,
      passed: passed.length,
      broken: broken.length,
      exempt: exempt.length,
      unchecked: unchecked.length,
      rule14Violations: results.reduce((n, r) => n + r.rule14.length, 0),
      // Said out loud on the artefact itself, so no reader can take `passed` for coverage.
      note:
        "passed counts SALES surfaces only. exempt and unchecked are separate verdicts and are " +
        "never folded into passed. An obligation surface is exempt from Rule 17 and from nothing else.",
    },
  };
}

/**
 * The invariant, callable. `passed` may never contain an exempt or unchecked surface, and the
 * reported total may never be reconstructed by adding exempt into passed.
 */
export function assertExemptNotFolded(audit) {
  const failures = [];
  if (!audit || audit.schema !== SURFACE_CLASS_SCHEMA) {
    return { ok: false, failures: [{ class: CLASSES.EXEMPT_FOLDED_INTO_PASSED, detail: "not a surface-class audit" }] };
  }
  for (const r of audit.passed) {
    if (r.surface === SURFACE.OBLIGATION) {
      failures.push({
        file: r.file, class: CLASSES.EXEMPT_FOLDED_INTO_PASSED,
        detail: `"${r.file}" is an obligation surface and is counted in passed — an exemption that raises the pass count is not an exemption, it is a fabricated metric`,
      });
    }
    if (r.bucket !== "passed") {
      failures.push({
        file: r.file, class: CLASSES.EXEMPT_FOLDED_INTO_PASSED,
        detail: `"${r.file}" sits in passed with bucket "${r.bucket}"`,
      });
    }
  }
  if (audit.summary.passed !== audit.passed.length) {
    failures.push({
      class: CLASSES.EXEMPT_FOLDED_INTO_PASSED,
      detail: `summary.passed is ${audit.summary.passed} but only ${audit.passed.length} surfaces are in the passed bucket`,
    });
  }
  return { ok: failures.length === 0, failures };
}

export default {
  SURFACE_CLASS_SCHEMA, SURFACE, CLASSES, RULE_14_CLASSES, OBLIGATION_SURFACES,
  classifySurface, validateExemptions, auditSalesSurfaces, assertExemptNotFolded,
};

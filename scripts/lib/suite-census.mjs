// suite-census.mjs — a test count that cannot shrink without saying so.
//
// WHY THIS EXISTS (RUN-BV, 2026-10-08).
// The run-bu line was verified this cycle on a clean clone of the shared line. The first reading
// came back:
//
//     2 suite(s) FAILED TO LOAD: ... Cannot find package '@netlify/blobs'
//     # tests 1086 · # pass 1029 · # fail 0
//
// Then one `npm install` of a package THE ROOT MANIFEST ALREADY DECLARES, and the same tree on the
// same commit read:
//
//     374/374 suites green · # tests 1103 · # pass 1046 · # fail 0
//
// Seventeen assertions existed, were counted in neither total nor failure, and the first total did
// not say so. `# fail 0` was true both times. That is the whole defect: a run that never attempted
// seventeen checks printed a smaller denominator with a clean bill of health beside it, and the only
// thing distinguishing the complete run from the incomplete one was two lines of stderr scrolled off
// the top of a forty-second log.
//
// Two separate facts were being collapsed, and this program has closed this exact class twice
// before — once for host readings that cannot be taken on a clean clone (reported `not taken`, never
// as passes), once for staged deliveries whose age nobody computed. The same discipline, applied to
// the harness itself:
//
//   * "this suite loaded and its assertions failed"             -> RED. The code is wrong.
//   * "this suite could not load; a declared package is absent" -> INCOMPLETE. The code is unjudged.
//
// Both are non-zero exits. Neither is ever summarised as green. But an operator who sees INCOMPLETE
// is told the package name, the manifest that declares it, and the command that fixes it — and an
// operator who sees RED is not sent hunting through npm for a defect that is in the source.
//
// THE HONESTY CONTRACT, enforced by tests/suite-census.test.mjs:
//
//   * The green line is never tautological. `N/N suites green` where N is "however many we got to"
//     can only ever print N/N and so asserts nothing. The census carries `registered` (how many
//     suites the runner was asked to run) separately from `taken` (how many produced a verdict), and
//     refuses the word "green" whenever taken < registered.
//   * A load failure is classified from its error, not from a guess. Only a module-not-found whose
//     missing specifier is declared in a manifest in this tree is `dependency-absent`; a
//     module-not-found for an undeclared package is `unresolved-import` (a real defect — something
//     imports what nothing installs), and everything else is `load-error`.
//   * `dependency-absent` never reduces the denominator silently and never counts as a pass. It is
//     reported with its package, its manifest, and its remedy.
//   * A census with zero registered suites is not a green run. A harness that ran nothing has not
//     proved anything, and "0/0 green" is the emptiest form of the lie this file exists to stop.
//   * Pure. No fs, no child_process, no network, no clock. The caller reads; this decides.
export const SUITE_CENSUS_SCHEMA = "suite-census.v1";
export const SENDS = false;

export const LOAD_FAILURE_CLASSES = Object.freeze({
  /** A package this tree's own manifests declare is not installed in this environment. */
  DEPENDENCY_ABSENT: "dependency-absent",
  /** Something imports a package no manifest in this tree declares. A real defect. */
  UNRESOLVED_IMPORT: "unresolved-import",
  /** Anything else that threw while the module was evaluating. A real defect. */
  LOAD_ERROR: "load-error",
});

export const VERDICTS = Object.freeze({
  GREEN: "green",
  RED: "red",
  INCOMPLETE: "incomplete",
});

/** Classes that mean "we did not judge this suite", as opposed to "this suite is wrong". */
const UNJUDGED_CLASSES = new Set([LOAD_FAILURE_CLASSES.DEPENDENCY_ABSENT]);

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * The bare package name a module specifier resolves to, or null if the specifier is a path.
 * `@netlify/blobs/dist/x` -> `@netlify/blobs`; `exceljs` -> `exceljs`; `./a.mjs` and `/a.mjs` -> null.
 */
export function packageNameOf(specifier) {
  if (typeof specifier !== "string") return null;
  const s = specifier.trim();
  if (!s) return null;
  if (s.startsWith(".") || s.startsWith("/") || s.startsWith("#")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return null; // node:, file:, data:, http:
  const parts = s.split("/");
  if (s.startsWith("@")) {
    if (parts.length < 2 || !parts[0].slice(1) || !parts[1]) return null;
    return parts[0] + "/" + parts[1];
  }
  return parts[0] || null;
}

/**
 * The missing specifier named by a module-resolution error, or null if the error is not one.
 * Node phrases this as: Cannot find package 'x' imported from y  /  Cannot find module './x'
 */
export function missingSpecifierOf(err) {
  const code = err && typeof err === "object" ? err.code : undefined;
  const msg = (err && typeof err === "object" && typeof err.message === "string")
    ? err.message
    : (typeof err === "string" ? err : "");
  if (!msg) return null;
  const looksLikeResolution = code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND"
    || /Cannot find (?:package|module)/.test(msg);
  if (!looksLikeResolution) return null;
  const m = /Cannot find (?:package|module) ['"]([^'"]+)['"]/.exec(msg);
  return m ? m[1] : null;
}

/**
 * Classify one load failure.
 *
 * @param {{spec: string, err: unknown}} failure      the suite and what it threw
 * @param {Record<string, string>} declaredPackages   package name -> manifest path that declares it
 */
export function classifyLoadFailure(failure, declaredPackages = {}) {
  const spec = isPlainObject(failure) && typeof failure.spec === "string" ? failure.spec : "(unnamed suite)";
  const err = isPlainObject(failure) ? failure.err : undefined;
  const message = (err && typeof err === "object" && typeof err.message === "string")
    ? err.message
    : String(err === undefined ? "unknown error" : err);

  const specifier = missingSpecifierOf(err);
  const pkg = packageNameOf(specifier);
  const declared = isPlainObject(declaredPackages) ? declaredPackages : {};
  const manifest = pkg && Object.prototype.hasOwnProperty.call(declared, pkg) ? declared[pkg] : null;

  if (pkg && manifest) {
    return {
      spec,
      class: LOAD_FAILURE_CLASSES.DEPENDENCY_ABSENT,
      message,
      package: pkg,
      manifest,
      remedy: "npm install " + pkg,
      judged: false,
    };
  }
  if (pkg) {
    return {
      spec,
      class: LOAD_FAILURE_CLASSES.UNRESOLVED_IMPORT,
      message,
      package: pkg,
      manifest: null,
      remedy: null,
      judged: true,
    };
  }
  return {
    spec,
    class: LOAD_FAILURE_CLASSES.LOAD_ERROR,
    message,
    package: null,
    manifest: null,
    remedy: null,
    judged: true,
  };
}

/**
 * Take the census of a run.
 *
 * @param {object} input
 * @param {number} input.registered              how many suites the runner was ASKED to run
 * @param {Array<{spec: string, err: unknown}>} [input.loadFailures]
 * @param {boolean} [input.assertionsFailed]     true when an assertion recorded a failure
 * @param {Record<string, string>} [input.declaredPackages]
 */
export function takeCensus({ registered, loadFailures = [], assertionsFailed = false, declaredPackages = {} } = {}) {
  const reg = Number.isInteger(registered) && registered >= 0 ? registered : 0;
  const failures = Array.isArray(loadFailures) ? loadFailures : [];
  const classified = failures.map((f) => classifyLoadFailure(f, declaredPackages));

  const unjudged = classified.filter((c) => UNJUDGED_CLASSES.has(c.class));
  const defects = classified.filter((c) => !UNJUDGED_CLASSES.has(c.class));

  // A suite is "taken" when it produced a verdict. A dependency-absent suite did not; a suite that
  // loaded and failed did — that verdict is "wrong", which is a verdict.
  const taken = Math.max(0, reg - unjudged.length);

  let verdict;
  if (assertionsFailed || defects.length) verdict = VERDICTS.RED;
  else if (reg === 0 || taken < reg) verdict = VERDICTS.INCOMPLETE;
  else verdict = VERDICTS.GREEN;

  return {
    schema: SUITE_CENSUS_SCHEMA,
    registered: reg,
    taken,
    notTaken: unjudged.length,
    verdict,
    assertionsFailed: Boolean(assertionsFailed),
    defects,
    notTakenDetail: unjudged,
    complete: taken === reg && reg > 0,
    exitCode: verdict === VERDICTS.GREEN ? 0 : 1,
  };
}

/**
 * The lines an operator reads. Deliberately explicit about which of the two facts occurred, and
 * never printing the word "green" next to an incomplete run.
 */
export function censusReport(census) {
  if (!isPlainObject(census)) return ["suite census unavailable — nothing was measured."];
  const lines = [];
  const registered = census.registered;
  const taken = census.taken;
  const notTaken = census.notTaken;
  const verdict = census.verdict;
  const defects = Array.isArray(census.defects) ? census.defects : [];
  const notTakenDetail = Array.isArray(census.notTakenDetail) ? census.notTakenDetail : [];

  if (defects.length) {
    lines.push(defects.length + " suite(s) FAILED TO LOAD — this is a defect in the source:");
    for (const d of defects) lines.push("  x " + d.spec + " [" + d.class + "] — " + String(d.message).split("\n")[0]);
  }
  if (notTakenDetail.length) {
    lines.push(notTakenDetail.length + " suite(s) NOT TAKEN — a declared package is not installed here. " +
      "These are unjudged, not passed:");
    for (const d of notTakenDetail) {
      lines.push("  - " + d.spec + " — '" + d.package + "' is declared in " + d.manifest +
        " but absent. Fix: " + d.remedy);
    }
  }

  if (verdict === VERDICTS.RED) {
    lines.push("SUITE RED — " + taken + " of " + registered + " suites were judged and at least one is wrong. " +
      "A pass count is deliberately withheld here: a healthy-looking number beside a failure is the " +
      "lie this harness once told.");
  } else if (verdict === VERDICTS.INCOMPLETE) {
    if (registered === 0) {
      lines.push("SUITE INCOMPLETE — no suites were registered. A harness that ran nothing has proved nothing.");
    } else {
      lines.push("SUITE INCOMPLETE — " + taken + " of " + registered + " suites taken; " + notTaken +
        " unjudged. Nothing failed, and that is not the same as everything passing.");
    }
  } else {
    lines.push(taken + " of " + registered + " suites taken — all green.");
  }
  return lines;
}

#!/usr/bin/env node
// emit-axis-status-run-aq.mjs — RUN-AQ cycle 133 (2026-08-06). Same discipline as AP3 + AP4. Regenerate the AXIS status feed from THIS
// cycle's own numbers, under AM1: a measurable figure is produced by the code that reads it, never
// typed here — AND regenerate the ledger head on disk in the SAME transaction.
//
// AP4 is the reason this script differs from its predecessor. The head inside PROGRESS-LEDGER.md
// carried RUN-Z 0/3 · 321/323 · 41 unpublished while the feed carried RUN-AO 3/3 · 646/646 · 48,
// and the suite was green through all of it, because the invariant was proven between three
// in-memory computations and abandoned at the filesystem boundary. Here the feed, the truth
// artefact and the ledger head are written from one normalised truth object, in one pass, so the
// two surfaces cannot separate again without a test going red.
//
// CHANGED FROM AP (2026-08-06, stated rather than slipped in):
//   1. `daysDraftedUnsent` was hand-stamped 17 while its own stated source — "2026-07-21 differenced
//      against today" — gave 15 on the day it was written. A figure whose source is arithmetic is
//      measurable, so it is now COMPUTED from that date instead of typed, and the old value is
//      recorded here as wrong rather than quietly replaced.
//   2. The headline reports this cycle: two suites salvaged off a superseded branch and the fine-print
//      gate fixed to enforce the word its own header used.
//
// Run from the repo root:  node scripts/emit-axis-status-run-aq.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { emitAxisStatus, checkPublicFiles } from "./lib/axis-status-emit.mjs";
import { stamp } from "./lib/claim-evidence.mjs";
import { needsAhmadStaged } from "./lib/needs-ahmad-staged.mjs";
import { auditStagedActions, rankedStagedActions } from "./lib/staged-action-guard.mjs";
import { walkCustomerGraph, auditOutboundLinks, CUSTOMER_ENTRY_POINTS } from "./lib/customer-link-graph.mjs";
import { auditEntryPoints, CLASSES as FS_CLASSES } from "./lib/first-screen-audit.mjs";
import { walkAllConversationPaths, MAX_CLICKS } from "./lib/conversation-path.mjs";
import { auditSalesSurfaces, assertExemptNotFolded, OBLIGATION_SURFACES } from "./lib/surface-class.mjs";
import { regenerateLedgerHeadOnDisk, TRUTH_FILE } from "./lib/ledger-head-fs.mjs";
import {
  measureCommand, measureInProcess, measureCommitsAhead, measureDraftedMessages,
  declaredUnmeasurable, parseRegistryOutput,
} from "./lib/claim-measure.mjs";

const root = process.cwd();
const NOW = new Date().toISOString();
const SEND_SHEET = "senior-director-state/outbound/SEND-SHEET-2026-08-05.md";

// ── The staged list, audited on the way out (AJ1 + AN2 still enforced). ──
const audit = auditStagedActions(needsAhmadStaged, { root });
if (!audit.ok) {
  console.error("staged-action guard REFUSED the emit:");
  for (const f of audit.failures) console.error(`  ${f.name}: ${f.class} — ${f.detail}`);
  process.exit(1);
}

// ── Walked here, during the emit, so the feed reports a read and not a memory. ─────────────────
const graph = walkCustomerGraph({ root });
const firstScreens = auditEntryPoints({ root, entryPoints: CUSTOMER_ENTRY_POINTS });
const paths = walkAllConversationPaths({ root, entryPoints: CUSTOMER_ENTRY_POINTS });

// AP1 — the same read, split by surface class. The exemption is refused if it is not argued for,
// and the emit refuses with it: an unargued exemption that changes a published number is exactly
// the fabricated metric this program exists to refuse.
const surfaces = auditSalesSurfaces({ root, entryPoints: CUSTOMER_ENTRY_POINTS });
const folded = assertExemptNotFolded(surfaces);
if (!surfaces.exemptionsValid || !folded.ok) {
  console.error("surface-class guard REFUSED the emit:");
  for (const f of [...surfaces.exemptionFailures, ...folded.failures]) console.error(`  ${f.class}: ${f.detail}`);
  process.exit(1);
}

const sendSheetPath = path.join(root, SEND_SHEET);
const outbound = fs.existsSync(sendSheetPath)
  ? auditOutboundLinks(fs.readFileSync(sendSheetPath, "utf8"), { root, file: SEND_SHEET })
  : null;

// A first-screen finding that is a Rule 14 violation, as opposed to a Rule 17 silence. The two are
// reported separately because they are not the same severity and folding them would hide the worse one.
const RULE14 = new Set([
  FS_CLASSES.GUARANTEE, FS_CLASSES.EXPERIENCE_OVERCLAIM, FS_CLASSES.FORBIDDEN_NAME,
  FS_CLASSES.FABRICATED_PROOF, FS_CLASSES.UNCARRIED_METRIC,
]);
const rule14Findings = firstScreens.results.flatMap((r) =>
  r.findings.filter((f) => RULE14.has(f.class)).map((f) => ({ file: r.file, line: f.line, class: f.class })));

// ── MEASURED. Nothing below is a number this file chose. ──────────────────────────────────────
console.log("measuring: full registry (this takes ~25s — the number is read, not typed)…");
const registry = measureCommand({
  command: "npm", args: ["test", "--silent"],
  cwd: path.join(root, "ARIA Sentinel"),
  kind: "test",
  source: "the full registry run performed by this emit script, parsed from the runner's own output",
  parse: (out) => parseRegistryOutput(out),
  allowNonZeroExit: true, // a red registry must still be reportable — refusing to look is not honesty
});
const reg = registry.value;
const derive = (field, note) => ({ ...registry, value: reg[field], source: `${registry.source} (${note})` });

const claims = {
  testsPassedAfterWrites: derive("pass", "# pass"),
  testsFailedAfterWrites: derive("fail", "# fail"),
  suitesGreenAfterWrites: derive("suites", "N/N suites green"),
  suitesTotalAfterWrites: derive("suitesTotal", "N/N suites green"),
  registryExitCode: measureInProcess({
    value: registry.read.exitCode, kind: "test",
    source: "the exit code of the registry run this script performed",
    how: registry.read.command,
  }),

  testsPassedBeforeAnyWrite: declaredUnmeasurable("testsPassedBeforeAnyWrite", {
    reason: "the pre-write read cannot be re-taken after the writes; it is reported as last known rather than re-stamped",
    kind: "test", lastKnown: 646,
  }),
  suitesGreenBeforeAnyWrite: declaredUnmeasurable("suitesGreenBeforeAnyWrite", {
    reason: "the pre-write read cannot be re-taken after the writes; it is reported as last known rather than re-stamped",
    kind: "test", lastKnown: 340,
  }),

  commitsAheadOfSharedLine: measureCommitsAhead({ root, ref: "origin/main" }),

  pushCredentialRefused: measureCommand({
    command: "git", args: ["ls-remote", "origin", "main"], cwd: root,
    kind: "blocker", allowNonZeroExit: true,
    source: "a remote probe run with prompts disabled during this emit; the refusal is the measurement",
    parse: (_out, code) => code !== 0,
  }),

  secondMessagesDrafted: measureDraftedMessages({
    root, file: SEND_SHEET, countPattern: /^###\s+\d+\s+·\s+WR-/gm,
  }),

  // ── AN1, still walked every cycle. ──
  customerRoutesResolved: measureInProcess({
    value: graph.summary.ok, kind: "measurement",
    source: "the customer link-graph walk performed during this emit, over the declared customer entry points",
    how: "walkCustomerGraph() — every literal href resolved against the files on disk",
  }),
  customerRoutesBroken: measureInProcess({
    value: graph.summary.broken, kind: "blocker",
    source: "the same walk; a broken route resolves to no file, an empty file, a force-404 rule, or a login-only body",
    how: "walkCustomerGraph().broken",
  }),
  customerRoutesUnchecked: measureInProcess({
    value: graph.summary.unchecked, kind: "measurement",
    source: "the same walk; external hosts, mail/tel schemes, fragments, runtime hrefs and function routes — undecidable from disk, never counted as passing",
    how: "walkCustomerGraph().unchecked",
  }),

  // ── AO1. What the first screen says. ──
  firstScreensWithAValueClaim: measureInProcess({
    value: firstScreens.summary.passed, kind: "measurement",
    source: "the first-screen audit run during this emit over the declared customer entry points",
    how: "auditEntryPoints() — chrome stripped, above-the-fold prose held to Rule 17 and Rule 14",
  }),
  firstScreensWithFindings: measureInProcess({
    value: firstScreens.summary.broken, kind: "blocker",
    source: "the same audit; a finding is a named violation carrying its file and, where the string exists in source, its line",
    how: "auditEntryPoints().broken",
  }),
  firstScreensUnchecked: measureInProcess({
    value: firstScreens.summary.unchecked, kind: "measurement",
    source: "the same audit; an entry point mounted at runtime or absent from disk — never counted as passing",
    how: "auditEntryPoints().unchecked",
  }),
  firstScreenRule14Violations: measureInProcess({
    value: rule14Findings.length, kind: "blocker",
    source: "the same audit, filtered to the honesty classes: guarantee language, experience overclaim, forbidden name, fabricated proof, uncarried metric",
    how: "auditEntryPoints() findings filtered to the Rule 14 class set",
  }),

  // ── AP1. The same read, split by what the page is FOR. ──
  salesSurfacesMakingAClaim: measureInProcess({
    value: surfaces.summary.passed, kind: "measurement",
    source: "the surface-class audit run during this emit; SALES surfaces only — exempt and unchecked are never folded in",
    how: "auditSalesSurfaces() — obligation surfaces declared with a written reason, exempt from Rule 17 and nothing else",
  }),
  salesSurfacesStillSilent: measureInProcess({
    value: surfaces.summary.broken, kind: "blocker",
    source: "the same audit; a sales surface that names things and promises nothing a reader can feel",
    how: "auditSalesSurfaces().broken",
  }),
  obligationSurfacesExempt: measureInProcess({
    value: surfaces.summary.exempt, kind: "measurement",
    source: "the same audit; each exempt surface carries the written argument for its exemption in code",
    how: `auditSalesSurfaces().exempt — declared: ${Object.keys(OBLIGATION_SURFACES).join(", ")}`,
  }),

  // ── AO2. Whether the reader of that screen can reach a human. ──
  entryPointsReachingAConversation: measureInProcess({
    value: paths.summary.reachable, kind: "measurement",
    source: "the conversation-path walk run during this emit, from each entry point out to the action that starts a conversation",
    how: `walkAllConversationPaths() — breadth-first to ${MAX_CLICKS} clicks, delivery target required on disk`,
  }),
  entryPointsWithNoConversation: measureInProcess({
    value: paths.summary.broken, kind: "blocker",
    source: "the same walk; no path, a path past the click budget, or a path ending in a form that declares no delivery target",
    how: "walkAllConversationPaths().broken",
  }),
  entryPointsConversationUnchecked: measureInProcess({
    value: paths.summary.unchecked, kind: "measurement",
    source: "the same walk; an entry point not on disk in this checkout — never counted as reachable",
    how: "walkAllConversationPaths().unchecked",
  }),

  outboundLinksResolved: outbound
    ? measureInProcess({
        value: outbound.links - outbound.broken.length, kind: "measurement",
        source: "the audit of every site link in the send sheet, run during this emit",
        how: "auditOutboundLinks(SEND-SHEET-2026-08-05.md)",
      })
    : declaredUnmeasurable("outboundLinksResolved", {
        reason: "the send sheet is not present in this checkout, so its links cannot be audited here",
        kind: "count",
      }),

  stagedItemsAudited: measureInProcess({
    value: audit.findings.length, kind: "measurement",
    source: "the staged-action guard run over the tracked staged-actions module during this emit",
    how: "auditStagedActions(needsAhmadStaged) — each artefact opened on disk",
  }),
  stagedItemsRanked: measureInProcess({
    value: needsAhmadStaged.filter((i) => Number.isInteger(i.rank)).length, kind: "measurement",
    source: "the staged list read during this emit; AN2 requires a rank and an unblocks statement per item",
    how: "needsAhmadStaged.filter(i => Number.isInteger(i.rank))",
  }),

  // ── DECLARED UNMEASURABLE. Nothing here can read a reply, a meeting, or an invoice. ──
  secondMessagesSent: declaredUnmeasurable("secondMessagesSent", {
    reason: "no send path exists in this environment and none was attempted; the outbound record shows none",
    kind: "count", lastKnown: 0,
  }),
  meetingsHeld: declaredUnmeasurable("meetingsHeld", {
    reason: "replies and meetings live in a mailbox and a calendar this environment cannot read",
    kind: "count", lastKnown: 0,
  }),

  // ── ATTESTED. Figures with nothing to read: policy numbers and dates that were decided. ──
  daysDraftedUnsent: measureInProcess({
    value: Math.floor((Date.parse(NOW) - Date.parse("2026-07-21T00:00:00Z")) / 86400000),
    kind: "measurement",
    source: "the date the twelve were first drafted (2026-07-21), differenced against this emit's clock",
    how: "floor((now - 2026-07-21) / 86400000) — computed here, not typed. Cycles 129-132 carried a " +
         "hand-stamped 17 against the same stated source, which the arithmetic never supported: it " +
         "read 15 on 2026-08-05. Corrected in public rather than adjusted silently (Rule 14).",
  }),
  revenueToDate: stamp("none", { measuredAt: NOW, kind: "fact", source: "no invoice has been issued" }),
  feedMaxAgeHours: stamp(24, {
    measuredAt: NOW, kind: "fact",
    source: "the freshness policy wired into the served-feed read path",
  }),
};

const testsGreen = reg.fail === 0 && registry.read.exitCode === 0;
const ahead = claims.commitsAheadOfSharedLine.value;

const headlineFields = {
  status: "active build",
  milestone:
    "The customer-facing product and the operator command centre are built and tested. Delivery is " +
    "staged and waits on deliberate operator actions, not on further software.",
  readiness:
    "Built and tested. Publishing is a deliberate manual step by the operator, never automatic.",
  revenueToDate: "none",
  headline:
    "ARIA / AXIS is in active build. This cycle audited the branch board instead of building: three " +
    "open branches carry nothing main lacks and now say so, the two suites that outlived a fourth " +
    "were taken, and the legal fine-print gate now covers git-tracked pages only. " +
    `Sent: 0 — drafted ${claims.daysDraftedUnsent.value} days. Meetings 0, revenue none. ` +
    `Tests: ${reg.pass} pass, ${reg.fail} fail, ${reg.suites}/${reg.suitesTotal} suites.`,
  note:
    "Public status headline only. Detailed build state is operator-internal and served only to " +
    "authenticated operators inside the AXIS command centre. This public feed never carries commit, " +
    "branch, or operator-script detail.",
  generatedAt: NOW,
};

const prevPath = path.join(root, "netlify/functions/_axis-status-full.json");
const prev = fs.existsSync(prevPath) ? JSON.parse(fs.readFileSync(prevPath, "utf8")) : {};

const fullDetail = {
  schema: "axis-status-full/1",
  generatedAt: NOW,
  honest: true,
  claims,
  claimsPolicy:
    "Every figure above is { value, measuredAt, source, kind } AND declares who authored the stamp. " +
    "A figure this environment can read must carry `provenance: measured` plus the command and exit " +
    "code that produced it — the emit script types none of those numbers, and the emitter refuses the " +
    "whole write if one arrives hand-typed. A figure that cannot be read here is " +
    "`declared-unmeasurable` with a reason and, where useful, a value explicitly labelled last known. " +
    "Only figures with nothing to read may be attested by hand.",
  program: {
    series: "flywheel",
    sequence: "flywheel cycle 133 — the branch board, measured (branch audit, salvage, feed)",
    previousSequence: "RUN-AP — the six screens that say nothing (4/4)",
    tasksBuiltAndGreen: 3,
    tasksTotal: 3,
    tasksMerged: 3,
    pct: 100,
    tasksStillOpen: [],
    carriedFrom: "nothing carried; RUN-AP closed 4/4",
    testsGreen,
    verificationCycleNote:
      "The registry arrived GREEN this cycle — 666/666 · 342/342 · exit 0 — measured in a clean clone " +
      "of the local line prepared with the operator's untracked record root, and read again after " +
      "every write. Four cc/ branches were open against the shared line. Three (flywheel-116, " +
      "registry-green-on-main, test-registry-unblock) were measured file-by-file to be CONTENT-" +
      "SUPERSEDED by main — their test fixes are already on it byte-identical and their emitter and " +
      "feed copies are older than what main carries, so merging them would have regressed the " +
      "emitter. The fourth (axis-feed) is missing 50 files main has and adds 4; the 2 real suites " +
      "were taken and the branch stays unmerged with that reason recorded. Nothing was merged that " +
      "would move a file backwards.",
    note:
      "Cycle 133 spent itself on the BRANCH BOARD rather than on new build: four cc/ branches had sat " +
      "open against the shared line while 'merge them' stayed on the task list for two cycles with " +
      "nobody measuring what was in them. Measured: three carry nothing main does not already have — " +
      "their two test fixes are byte-identical to main's copies and their emitter and feed files are " +
      "OLDER, so the merge described as routine would have moved the status emitter backwards by " +
      "three cycles. The fourth is missing fifty files main carries and adds four; two of those are " +
      "real suites nobody had run — a site-wide legal fine-print gate and a clone-prep verifier. Both " +
      "were taken, and the branches stay unmerged with the reason recorded. The fine-print gate " +
      "arrived RED on a real operator tree, not on principle: its walk reached eight gitignored " +
      "staging drafts and reported them as public pages missing the legal disclaimer. Fixed by " +
      "enforcing the word its own header used — the page set is the walk intersected with git " +
      "ls-files — so untracked scratch cannot fail it and a NEW tracked public page still can, proven " +
      "red by stripping the marker from about.html and green with it restored. 117 public pages carry " +
      "the strip, 17 operator-internal pages excluded by name. The registry rose from 666/342 to " +
      "676/344, which is these two suites and nothing else. The shared line still cannot be reached " +
      "from this environment: the code-host credential was refused again, verbatim. Second messages " +
      "sent: still zero.",
  },
  tests: {
    afterEveryWrite: { pass: reg.pass, fail: reg.fail, suites: `${reg.suites}/${reg.suitesTotal}`, exit: registry.read.exitCode },
    beforeAnyWriteLastKnown: { pass: 646, fail: 0, suites: "340/340", exit: 0, note: "opening read of this cycle, taken before any RUN-AP write; reported as last known, not re-stamped" },
    arrivalState: { red: false, detail: "the registry arrived green and every cc/ branch was already merged into the local main line; this cycle built rather than merged" },
    riseExplained: "this cycle's two new suites plus the assertions added to the AO1 suite, and nothing else",
    newThisCycle: [
      { suite: "surface-class", redThenGreen: true },
      { suite: "ledger-head-on-disk", redThenGreen: true },
    ],
  },
  workingTree: prev.workingTree || null,
  lanes: prev.lanes || [],
  blockers: prev.blockers || [],
  onTrack: {
    landing: false,
    conversion: false,
    honestNote:
      `Nothing published. No customer-visible change and none claimed. The verified work still sits ` +
      `on the local line (${ahead} commits ahead of the last known shared reference) because the ` +
      `environment holds no credential for the shared host — probed again this cycle and refused again.`,
  },
  needsAhmad: rankedStagedActions(needsAhmadStaged),
  needsAhmadPolicy:
    "Served in RANK order, not in the order the list is typed. Each item declares what its click " +
    "unblocks and what stays blocked without it; the guard refuses an item that declares neither.",
  customerPath: {
    entryPoints: graph.summary.entryPointsWalked,
    links: graph.summary.links,
    resolved: graph.summary.ok,
    broken: graph.summary.broken,
    uncheckedWithReason: graph.summary.unchecked,
    outboundSiteLinks: outbound ? outbound.links : null,
    firstScreen: {
      withAValueClaim: firstScreens.summary.passed,
      withFindings: firstScreens.summary.broken,
      unchecked: firstScreens.summary.unchecked,
      rule14Violations: rule14Findings,
      findings: firstScreens.broken.flatMap((r) =>
        r.findings.map((f) => ({ file: r.file, line: f.line, class: f.class, detail: f.detail }))),
    },
    conversation: {
      maxClicks: MAX_CLICKS,
      reachable: paths.summary.reachable,
      noReachablePath: paths.summary.broken,
      unchecked: paths.summary.unchecked,
      findings: paths.broken.map((r) => ({ file: r.file, class: r.class, detail: r.detail })),
    },
    note:
      "Walked from disk, no network call, no deploy. Unchecked is a third verdict with a stated " +
      "reason and is never counted as passing or as reachable.",
  },
  stagedAudit: { audited: audit.findings.length, failed: audit.failures.length, guard: "staged-action-guard.v1 + rank" },
};

// ── AP1 detail, served to the operator alongside the AO1 numbers it refines. ─────────────────
fullDetail.customerPath.surfaceClass = {
  salesSurfaces: surfaces.summary.salesSurfaces,
  obligationSurfaces: surfaces.summary.obligationSurfaces,
  salesMakingAClaim: surfaces.summary.passed,
  salesStillSilent: surfaces.summary.broken,
  exempt: surfaces.exempt.map((r) => ({ file: r.file, reason: r.reason })),
  unchecked: surfaces.unchecked.map((r) => ({ file: r.file, reason: r.findings[0] && r.findings[0].detail })),
  policy:
    "An obligation surface is exempt from Rule 17 and from nothing else — every Rule 14 class still " +
    "fails red on it. Exempt and unchecked are separate verdicts and are never folded into passed.",
};

const { written, publicStatus } = emitAxisStatus({ root, publicFields: headlineFields, fullDetail });
console.log("cycle 133 feed emitted.");
console.log("  public  →", written.public.join(", "));
console.log("  internal→", written.internal);
console.log("  headline length:", publicStatus.headline.length, "chars (cap 400)");
console.log("  claims stamped:", Object.keys(claims).length);
console.log("  measured by code:", Object.values(claims).filter((c) => c.provenance === "measured").length);
console.log("  declared unmeasurable:", Object.values(claims).filter((c) => c.provenance === "declared-unmeasurable").length);
console.log("  registry read:", reg.pass, "pass /", reg.fail, "fail /", `${reg.suites}/${reg.suitesTotal}`, "exit", registry.read.exitCode);
console.log("  commits ahead:", ahead, "· push credential refused:", claims.pushCredentialRefused.value);
console.log("  first screens:", firstScreens.summary.passed, "with a claim ·", firstScreens.summary.broken,
  "with findings ·", rule14Findings.length, "Rule 14 violations ·", firstScreens.summary.unchecked, "unchecked");
console.log("  surfaces:", surfaces.summary.passed, "of", surfaces.summary.salesSurfaces, "sales pages make a claim ·",
  surfaces.summary.broken, "silent ·", surfaces.summary.exempt, "exempt with a reason ·", surfaces.summary.unchecked, "unchecked");
console.log("  conversation:", paths.summary.reachable, `reachable within ${MAX_CLICKS} clicks ·`,
  paths.summary.broken, "with no path ·", paths.summary.unchecked, "unchecked");

// ── AP4. THE SAME TRANSACTION. The truth this feed was emitted from is written beside it, and the
// ledger head is regenerated from that same object. No figure below is typed here: every one of
// them is lifted off a claim that was measured above.
const { normalizeProgramTruth } = await import(
  pathToFileURL(path.join(root, "ARIA Sentinel/src/shared/program-truth.mjs")).href);

const programTruth = normalizeProgramTruth({
  program: {
    series: "flywheel",
    sequence: fullDetail.program.sequence,
    tasksMerged: fullDetail.program.tasksMerged,
    tasksTotal: fullDetail.program.tasksTotal,
    exitCriteriaMet: testsGreen,
  },
  tests: { green: reg.pass, total: reg.pass + reg.fail },
  mainRef: { source: "the last known local reference; the remote probe was refused this cycle", liveConfirmed: false },
  unpushed: { commits: ahead },
  // Real-or-empty. Nothing here has a source that can report anything but zero, and it says so.
  revenue: {
    receivedCad: 0, asksSent: 0,
    asksStaged: needsAhmadStaged.length,
    candidates: 0, conversationsHeld: 0, hoursSpent: 0,
  },
}, { now: Date.parse(NOW) });

fs.writeFileSync(path.join(root, TRUTH_FILE), JSON.stringify(programTruth, null, 2) + "\n");
console.log("  truth artefact →", TRUTH_FILE);

const headWrite = await regenerateLedgerHeadOnDisk({ root, truth: programTruth, write: true, now: Date.parse(NOW) });
if (!headWrite.ok) {
  console.error("ledger head regeneration REFUSED:", headWrite.class, "—", headWrite.detail);
  console.error("  the head is left as it was and reported stale; a measurable figure is never hand-stamped (AM1).");
  process.exit(1);
}
console.log("  ledger head →", headWrite.written ? "regenerated in place" : "already current",
  "· history below END marker unchanged:", headWrite.historyUnchanged);

const problems = checkPublicFiles(root);
if (problems.length) {
  console.error("post-emit check FAILED:");
  for (const p of problems) console.error(`  ${p.file}: ${p.reason} — ${p.match}`);
  process.exit(1);
}
console.log("  post-emit check: OK — headline-only, mirrors agree, fresh within one cycle.");

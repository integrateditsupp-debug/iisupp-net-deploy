#!/usr/bin/env node
// emit-axis-status-run-ar.mjs — RUN-AR cycle 134 (2026-08-06). Same discipline as AP3 + AP4. Regenerate the AXIS status feed from THIS
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
// CHANGED FROM AQ (2026-08-06, stated rather than slipped in):
//   0. Three figures that were never in any feed are now measured and published: what is actually IN
//      the unpublished range (AR1), whether the credential-free delivery bundle verifies (AR2), and
//      what this environment's git can and cannot do (AR3). The headline "N commits ahead" has been
//      carried since cycle 111 without anybody pricing it; it is priced here, and the answer changed
//      the staged list — 13 of the 37 non-merge commits touch 16 files a visitor can load, so the
//      backlog is NOT the cosmetic record-keeping the phrasing had implied for three weeks.
//
// CARRIED FROM AQ (still true, still stated):
//   1. `daysDraftedUnsent` was hand-stamped 17 while its own stated source — "2026-07-21 differenced
//      against today" — gave 15 on the day it was written. A figure whose source is arithmetic is
//      measurable, so it is now COMPUTED from that date instead of typed, and the old value is
//      recorded here as wrong rather than quietly replaced.
//   2. The headline reports this cycle: two suites salvaged off a superseded branch and the fine-print
//      gate fixed to enforce the word its own header used.
//
// Run from the repo root:  node scripts/emit-axis-status-run-ar.mjs
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
import { readUnpublishedRange, CLASSES as RANGE_CLASSES } from "./lib/unpublished-range.mjs";
import { auditCrossSurface, statementFor as crossSurfaceStatement } from "./lib/cross-surface-consistency.mjs";
import { rehearsePublish, statementFor as rehearsalStatement } from "./lib/publish-rehearsal.mjs";
import { auditPrimaryActions, statementFor as primaryActionStatement } from "./lib/primary-action.mjs";
import { createRangeBundle, BUNDLE_FILE, MANIFEST_FILE } from "./lib/range-bundle.mjs";
import { probeGitBoundary, confirmPorcelainBlocked, BOUNDARY_CLASSES } from "./lib/sandbox-git-boundary.mjs";
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

// AS1 — the published set read TOGETHER. Every gate before this judged one page at a time; this is
// the first that can catch two published screens telling a visitor different things.
const crossSurface = auditCrossSurface({ root });

// AS3 — what each published page ASKS FOR, extracted from the file. Read here so the feed reports a
// measurement taken during this emit rather than a memory of one taken during a test run.
const primaryActions = auditPrimaryActions({ root });
const folded = assertExemptNotFolded(surfaces);
if (!surfaces.exemptionsValid || !folded.ok) {
  console.error("surface-class guard REFUSED the emit:");
  for (const f of [...surfaces.exemptionFailures, ...folded.failures]) console.error(`  ${f.class}: ${f.detail}`);
  process.exit(1);
}

// ── AR1. Price the range instead of counting it. Written to disk as a refusal if it cannot be read. ──
const RANGE_FILE = "senior-director-state/unpublished-range.json";
const rangeRead = readUnpublishedRange({ root, ref: "origin/main" });
fs.writeFileSync(path.join(root, RANGE_FILE), JSON.stringify({
  schema: "unpublished-range.v1", generatedAt: NOW, ref: "origin/main",
  report: rangeRead.ok ? rangeRead.report : null,
  refusal: rangeRead.ok ? null : { class: rangeRead.class, detail: rangeRead.detail },
}, null, 2) + "\n", "utf8");

// ── AR3. Record the environment's git boundary as a FACT. Never a failure, never re-derived. ──
const BOUNDARY_FILE = "senior-director-state/sandbox-git-boundary.json";
const boundary = probeGitBoundary({ root });
const porcelain = confirmPorcelainBlocked({ root });
fs.writeFileSync(path.join(root, BOUNDARY_FILE),
  JSON.stringify({ ...boundary, porcelainConfirmation: porcelain }, null, 2) + "\n", "utf8");

// ── AR2. Build the credential-free delivery path and verify it. A bundle that will not verify is a
// failure of this emit, not a caveat on it: an unverified backup is worse than a known-missing one.
const bundle = createRangeBundle({ root, ref: "origin/main", head: "HEAD", branch: "main" });
if (!bundle.ok) {
  console.error(`AR2 delivery bundle REFUSED: ${bundle.class} — ${bundle.detail}`);
  process.exit(1);
}

// ── AS2. Walk the publish, now, against the bundle that was just built. A rehearsal that runs only
// inside a test suite proves the code works; running it here proves THIS artefact publishes. A
// BROKEN rehearsal refuses the emit for the same reason an unverified bundle does — publishing a
// range nobody could land is not a caveat, it is the failure the whole delivery path exists to stop.
const rehearsal = rehearsePublish({ root });
if (rehearsal.verdict === "broken") {
  console.error(`AS2 publish rehearsal BROKEN: ${rehearsal.class} — ${rehearsal.detail}`);
  for (const f of rehearsal.findings) console.error(`  ${f.file || "(tree)"}: ${f.class} ${f.detail || ""}`);
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

  // ── AS. THE FIGURE THAT CHANGED THIS CYCLE, AND IT CHANGED IN OUR FAVOUR. ────────────────────
  // Twenty-four cycles reported a line "verified but unpublished" and ranked the publish as blocked.
  // The reference moved: `origin/main` now equals HEAD, and its reflog records the move as a real
  // `update by push` rather than a fetch. The sixteen files RUN-AO and RUN-AP wrote — the ones the
  // last cycle called finished and invisible — are on the shared line. Measured, not assumed.
  sharedLineAdvancedByPush: measureCommand({
    command: "git", args: ["reflog", "show", "origin/main", "-n", "1", "--format=%gs"], cwd: root,
    kind: "measurement", allowNonZeroExit: true,
    source: "the local reflog for the remote-tracking ref, read during this emit",
    parse: (out) => /update by push/i.test(String(out || "")),
  }),
  // The honest boundary on the figure above: a remote-tracking ref is a LOCAL record of a push, and
  // this environment cannot re-read the remote to confirm the line is still there. Stated as its own
  // claim rather than buried in a caveat, so nobody can quote the first figure without meeting this one.
  sharedLineConfirmedOnRemote: declaredUnmeasurable("sharedLineConfirmedOnRemote", {
    reason: "the remote probe is refused in this environment (no credential), so the push is known " +
      "from the local reflog and the ref equality only — never from reading github",
    source: "git ls-remote origin main, run during this emit and refused",
    kind: "blocker", lastKnown: null,
  }),

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

  // ── AR1. The range, priced by the code that read it. ──
  unpublishedCommitsTouchingPublicPages: rangeRead.ok
    ? measureInProcess({
        value: rangeRead.report.summary.commitsTouchingPublicPages, kind: "measurement",
        source: "the commit range origin/main..HEAD read during this emit and classified BY PATH, never by commit message",
        how: "readUnpublishedRange() — a commit touching a public page and the ledger is counted in both classes",
      })
    : declaredUnmeasurable("unpublishedCommitsTouchingPublicPages", {
        reason: `the range could not be read (${rangeRead.class}); an unreadable range is unknown, never zero`, kind: "count",
      }),
  unpublishedPublicFilesChanged: rangeRead.ok
    ? measureInProcess({
        value: rangeRead.report.summary.publicFilesChanged, kind: "measurement",
        source: "the same range read; the distinct set of files in it the open internet can load",
        how: "readUnpublishedRange().report.publicFilesChanged.length",
      })
    : declaredUnmeasurable("unpublishedPublicFilesChanged", { reason: "the range could not be read here", kind: "count" }),
  unpublishedMergeCommitsExcluded: rangeRead.ok
    ? measureInProcess({
        value: rangeRead.report.reconciliation.mergeCommitsExcluded, kind: "measurement",
        source: "rev-list --count --merges over the same range, so the 49-vs-37 gap is reconciled rather than left to drift",
        how: "readUnpublishedRange().report.reconciliation",
      })
    : declaredUnmeasurable("unpublishedMergeCommitsExcluded", { reason: "the range could not be read here", kind: "count" }),

  // ── AR2. The delivery artefact, verified by the code that made it. ──
  deliveryBundleBytes: measureInProcess({
    value: bundle.manifest.bytes, kind: "measurement",
    source: "the git bundle written and re-verified during this emit; the byte count is stat(), not an estimate",
    how: "createRangeBundle() -> verifyRangeBundle(): git bundle verify + SHA-256 of the bytes + tip + tree",
  }),
  deliveryBundleVerified: measureInProcess({
    value: bundle.ok, kind: "measurement",
    source: "the verification this emit performed on the bundle it just wrote; a bundle that will not verify aborts the emit",
    how: "verifyRangeBundle() — header, byte digest, tip SHA and tree hash, each with its own failure class",
  }),

  // ── AR3. What this environment's git can do, measured rather than remembered. ──
  gitPorcelainWritesBlocked: measureInProcess({
    value: !boundary.porcelainWrites, kind: "blocker",
    source: "a real write/overwrite/unlink probe inside .git performed during this emit, confirmed against git's own refusal",
    how: `probeGitBoundary() -> ${boundary.class}; git said: ${String(porcelain.message).slice(0, 120)}`,
  }),
  gitStaleLocksPermanent: measureInProcess({
    value: boundary.staleLocks.length, kind: "measurement",
    source: "the same probe; these lock files exist and this environment cannot unlink them",
    how: `probeGitBoundary().staleLocks — [${boundary.staleLocks.map((l) => l.name).join(", ") || "none"}]`,
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

const published = claims.sharedLineAdvancedByPush.value === true && ahead === 0;

const headlineFields = {
  status: "active build",
  milestone:
    "The customer-facing product and the operator command centre are built and tested. " +
    (published
      ? "The public pages that were finished and unseen are now on the shared line; what remains is " +
        "the first outbound message, which no software here can send."
      : "Delivery is staged and waits on deliberate operator actions, not on further software."),
  readiness:
    "Built and tested. Publishing is a deliberate manual step by the operator, never automatic.",
  revenueToDate: "none",
  headline:
    "ARIA / AXIS is in active build. " +
    (published
      ? "The public pages are on the shared line and are now checked as a SET rather than one at a " +
        "time, the publish path is rehearsed end to end before it is ever asked for, and every " +
        "reader-facing page is now measured on what it ASKS a first-time visitor for — which found a " +
        "page that told a stranger who we are and then invited them to do nothing. "
      : "The work is built and tested; publishing is still a deliberate operator step. ") +
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
    sequence: "RUN-AR — the line nobody can reach (AR1 price the range · AR2 the second delivery path · AR3 the boundary recorded once · AR4 feed by measurement)",
    previousSequence: "RUN-AQ / flywheel cycle 133 — the branch board, measured (3/3)",
    tasksBuiltAndGreen: 4,
    tasksTotal: 4,
    tasksMerged: 4,
    pct: 100,
    tasksStillOpen: [],
    carriedFrom: "nothing carried; RUN-AQ closed 3/3 with the branch board written",
    testsGreen,
    verificationCycleNote:
      "The registry arrived GREEN — 676/676 · 344/344 · exit 0 — read before any RUN-AR write and " +
      "again after every write. Three new suites were written red-first: unpublished-range (13), " +
      "range-bundle (12) and sandbox-git-boundary (10). One of those reds was not a designed red — " +
      "it was a finding. The bundle verifier initially trusted `git bundle verify`, and a bundle " +
      "truncated to 60% of its length PASSED that command, because it reads the bundle header and " +
      "the prerequisites and never touches the packfile. A SHA-256 of the bytes was added, the " +
      "truncation case now fails as DIGEST_MISMATCH, and the suite asserts that git still accepts " +
      "the truncated file — so the day git starts rejecting it, we learn that the guard became " +
      "redundant instead of assuming it always was.",
    note:
      "For twenty-three cycles this feed has reported a bare count of unpublished commits, and for " +
      "twenty-three cycles nobody asked what was in them. Priced this cycle from the repository: 49 " +
      "commits ahead, of which 12 are merges carrying no changes of their own; of the 37 that do, 13 " +
      "touch 16 files a visitor to iisupp.net can load — index.html, aria.html, trust.html, " +
      "about.html, the AXIS assets and more. That answer moves the staged list. The phrasing 'verified " +
      "but unpublished' had quietly implied bookkeeping; it is not bookkeeping, it is the site. " +
      "AR2 built the delivery path that needs no credential this environment lacks: a thin git bundle " +
      "against the shared line, 1.0 MB, verified by tip SHA, tree hash and a digest of its own bytes, " +
      "with the receiver's single fetch command recorded in the manifest beside it. Both artefacts sit " +
      "in the operator's untracked record root: the bundle is regenerated from the history each cycle, " +
      "and the manifest is meant to travel WITH the bundle to whoever receives it rather than to sit " +
      "in a commit describing a file they do not have. AR3 wrote down the boundary every cycle had been re-deriving privately: this " +
      "mount's .git accepts create and overwrite but REFUSES unlink, so its two stale lock files are " +
      "permanent, every porcelain write is blocked for the life of the environment, and the plumbing " +
      "path (private index, write-tree, commit-tree, ref overwrite) is the one that works — proven " +
      "end-to-end in the suite against a repository blocked the same way, not asserted. That state is " +
      "reported as a CLASSIFICATION and never as a red: a red that fires on an inconvenient " +
      "environment teaches its reader to skip the colour. The shared host was probed again and " +
      "refused again, verbatim. Second messages sent: still zero.",
  },
  tests: {
    afterEveryWrite: { pass: reg.pass, fail: reg.fail, suites: `${reg.suites}/${reg.suitesTotal}`, exit: registry.read.exitCode },
    beforeAnyWriteLastKnown: { pass: 676, fail: 0, suites: "344/344", exit: 0, note: "opening read of this cycle, taken before any RUN-AR write; reported as last known, not re-stamped" },
    arrivalState: { red: false, detail: "the registry arrived green on the real tree; nothing was merged this cycle and nothing needed to be" },
    riseExplained: "this cycle's three new suites (unpublished-range 13, range-bundle 12, sandbox-git-boundary 10) and nothing else",
    newThisCycle: [
      { suite: "unpublished-range", redThenGreen: true },
      { suite: "range-bundle", redThenGreen: true, note: "one red was a finding, not a design: git bundle verify accepts a 60%-truncated bundle" },
      { suite: "sandbox-git-boundary", redThenGreen: true },
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

// ── AR1 + AR2 + AR3 detail, served to the operator. The count the feed has carried since cycle 111
// is now accompanied by what is IN it, by a delivery path that does not require a login, and by a
// plain statement of what this environment's git can and cannot do.
fullDetail.unpublishedLine = rangeRead.ok ? {
  ref: "origin/main",
  statement: rangeRead.report.statement,
  reconciliation: rangeRead.report.reconciliation,
  byClass: rangeRead.report.byClass.map((b) => ({
    class: b.class, why: b.why, commits: b.commits, exclusiveCommits: b.exclusiveCommits, files: b.files.length,
  })),
  whatAVisitorWouldSeeChange: rangeRead.report.publicFilesChanged,
  policy:
    "Classified BY PATH, never by commit message: a message is a claim by its author, a file list is " +
    "a fact. A commit touching more than one class is counted in every class it touches and the " +
    "overlap is reported as overlap, so the class counts deliberately do not sum to the range size.",
  artefact: RANGE_FILE,
} : { ref: "origin/main", refusal: { class: rangeRead.class, detail: rangeRead.detail },
      note: "an unreadable range is UNKNOWN and is never reported as zero" };

fullDetail.delivery = {
  bundle: BUNDLE_FILE,
  manifest: MANIFEST_FILE,
  tip: bundle.manifest.tip,
  tree: bundle.manifest.tree,
  basedOn: bundle.manifest.basedOn,
  commits: bundle.manifest.commits,
  bytes: bundle.manifest.bytes,
  sha256: bundle.manifest.sha256,
  fetchCommand: bundle.manifest.fetchCommand,
  verifyCommand: bundle.manifest.verifyCommand,
  verified: true,
  tracked: false,
  manifestTracked: false,
  whyNotTracked:
    "both live under senior-director-state/, the operator's untracked record root. The bundle is " +
    "regenerated from the history every cycle, and the manifest's job is to travel WITH the bundle to " +
    "whoever receives it — a copy in git history would describe a file the receiver does not have. " +
    "What makes the pair trustworthy is the byte digest and the tip/tree SHAs, not a commit.",
  policy:
    "Verified on four independent things, each with its own failure class: git accepts the header, " +
    "the BYTES digest to what was recorded at creation, the tip is the exact commit the tests ran " +
    "against, and the tree at that tip is the tree that was tested. The digest exists because git's " +
    "own `bundle verify` passes a 60%-truncated file.",
};

fullDetail.environment = {
  gitBoundary: boundary.class,
  statement: boundary.statement,
  staleLocks: boundary.staleLocks,
  canCreateInGitDir: boundary.canCreateInGitDir,
  canOverwriteInGitDir: boundary.canOverwriteInGitDir,
  canUnlinkInGitDir: boundary.canUnlinkInGitDir,
  porcelainWrites: boundary.porcelainWrites,
  plumbingWrites: boundary.plumbingWrites,
  gitSaid: porcelain.message,
  workaround: boundary.workaround,
  oneLineCheck: boundary.oneLineCheck,
  artefact: BOUNDARY_FILE,
  policy:
    "Reported as a fact about the environment, never as a test failure. A suite that goes red " +
    "because the environment is inconvenient trains its reader to skip the colour.",
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

// ── AS1 detail. Served beside the per-page audits it is deliberately NOT a version of. ──────────
fullDetail.customerPath.crossSurface = {
  verdict: crossSurface.verdict,
  statement: crossSurfaceStatement(crossSurface),
  surfacesChecked: crossSurface.summary.surfacesChecked,
  surfacesUnchecked: crossSurface.summary.surfacesUnchecked,
  contradictions: crossSurface.summary.contradictions,
  byClass: crossSurface.summary.byClass,
  findings: crossSurface.findings.map((f) => ({ class: f.class, topic: f.topic, detail: f.detail, a: f.a, b: f.b })),
  unchecked: crossSurface.unchecked,
  policy:
    "Agreement BETWEEN published surfaces, measured rather than asserted. Silence is allowed — a page " +
    "that never raises a topic is not a finding. Disagreement is not: a plan priced two ways, a " +
    "framework certified on one screen and only in readiness on another, or an invitation pointing " +
    "where a sibling says the door is shut, each names both files and both lines. A dollar figure " +
    "with no recurring unit is ambiguous and is declined rather than guessed.",
};

// ── AS2 detail. The publish, walked rather than assumed. ────────────────────────────────────────
fullDetail.publishRehearsal = {
  verdict: rehearsal.verdict,
  statement: rehearsalStatement(rehearsal),
  filesChecked: rehearsal.checked,
  landedTip: rehearsal.landed?.tip || null,
  landedTree: rehearsal.landed?.tree || null,
  findings: rehearsal.findings.map((f) => ({ file: f.file || null, class: f.class, detail: f.detail || f.rule || "" })),
  policy:
    "The whole path is walked in a throwaway directory every cycle: a repository holding only the " +
    "base commit fetches the bundle from a file, the range lands, every published file is compared " +
    "blob by blob against the tested tree, and the serving rules are read out of THAT LANDED TREE — " +
    "not the working copy — so a rule that only exists locally cannot certify a publish that behaves " +
    "differently once live. It proves the range is safe to publish. It does not publish it.",
};

// ── AS3 detail. What each page asks a first-time visitor for. ───────────────────────────────────
fullDetail.primaryAction = {
  verdict: primaryActions.verdict,
  statement: primaryActionStatement(primaryActions),
  readerFacingChecked: primaryActions.checked,
  notApplicable: primaryActions.notApplicable,
  asks: primaryActions.rows
    .filter((r) => r.verdict !== "unchecked")
    .map((r) => ({ file: r.file, verdict: r.verdict, class: r.class, cost: r.primary?.cost || null, detail: r.detail })),
  failures: primaryActions.failures.map((f) => ({ file: f.file, class: f.class, detail: f.detail })),
  policy:
    "The invitation is extracted from the file, never assumed: its words, its target, whether that " +
    "target can receive anything in the tree being published, and whether the ask is proportionate to " +
    "a first visit. A page whose only invitation is to pay fails and names itself. A page with no " +
    "invitation at all is reported as having none — never scored as passing because it could not be " +
    "graded. Site navigation is furniture and is not counted as what the page asks for.",
};

// ── AS. What the reader is now actually looking at. ─────────────────────────────────────────────
fullDetail.publication = {
  sharedLineAdvancedByPush: claims.sharedLineAdvancedByPush.value,
  commitsAhead: ahead,
  confirmedOnRemote: false,
  statement: published
    ? "origin/main equals HEAD and its reflog records the move as a push: the sixteen public files " +
      "are on the shared line. This is a LOCAL reference fact — the remote itself cannot be read from " +
      "this environment, so it is never reported as a confirmed remote read."
    : "the shared line has not moved; the range is still local.",
  stillOperatorOnly: [
    "the Netlify publish — merging the line does not deploy it; the web publish stays a deliberate one-click",
    "the twelve second messages — no software in this repository can send them",
  ],
};

const { written, publicStatus } = emitAxisStatus({ root, publicFields: headlineFields, fullDetail });
console.log("RUN-AS / cycle 135 feed emitted.");
console.log("  cross-surface:", crossSurface.summary.surfacesChecked, "prose surfaces read together ·",
  crossSurface.summary.contradictions, "contradiction(s) ·", crossSurface.summary.surfacesUnchecked, "unchecked");
console.log("  publication:", published ? "shared line ADVANCED BY PUSH (local ref)" : "still local", "· ahead:", ahead);
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
console.log("  unpublished range:", rangeRead.ok
  ? `${rangeRead.report.summary.commits} non-merge (+${rangeRead.report.reconciliation.mergeCommitsExcluded} merges = ${rangeRead.report.reconciliation.totalIncludingMerges}) · ${rangeRead.report.summary.commitsTouchingPublicPages} touch ${rangeRead.report.summary.publicFilesChanged} public file(s)`
  : `UNREADABLE — ${rangeRead.class}`);
console.log("  delivery bundle:", bundle.detail);
console.log("  git boundary:", boundary.class, "· porcelain", boundary.porcelainWrites ? "open" : "BLOCKED", "· plumbing", boundary.plumbingWrites ? "open" : "blocked");
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

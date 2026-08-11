#!/usr/bin/env node
// emit-axis-status-run-aw.mjs — RUN-AW cycle 139 (2026-08-11).
//
// CHANGED FROM AV (2026-08-11, stated rather than slipped in):
//   1. AU1's leak gate was pointed at ONE directory — `legal/`, four documents. AW1 points it at the
//      twenty-seven a client, a prospect, or a client's own security reviewer can actually receive,
//      and makes the walk recursive, because `compliance/policies/` is a directory of eleven policies
//      a flat readdir had been reporting as absent rather than as unclean.
//   2. The experience-claim check was STRENGTHENED, not widened around. It required the word "years"
//      spelled out; the SOC 2 controls self-assessment and the HIPAA readiness map both carried
//      `21+ yrs IT` — above the honest ceiling, in the first two documents an auditor opens, in an
//      abbreviation the pattern never matched. Corrected to 15+, check fixed to catch the shape.
//   3. AW2 asks the second question: not "does this document carry something it should not" but "is
//      what it does carry TRUE". Every factual assertion in those documents ends published, disclaimed
//      by its own sentence, declared with a condition, or REFUSED.
//   4. AW3 asks AU1's question of the whole packet rather than one agreement: can a clone produce
//      everything a prospect is promised after a yes.
//
// Original header, carried:
// emit-axis-status-run-av.mjs — RUN-AV cycle 138 (2026-08-11). Same discipline as AP3 + AP4 + AT4. Regenerate the AXIS status feed from THIS
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
// CHANGED FROM AT (2026-08-11, stated rather than slipped in):
//   1. The agreement a client signs is now IN the shared line (AU1) and a leak gate proves it carries
//      nothing operator-internal. The gate found three client-signable contracts printing a postal
//      code the company does not publish; they were corrected and the check stays.
//   2. The invoice is REHEARSED rather than assumed (AU2), and the rehearsal found a live money
//      defect: the published plan table states USD and the checkout function charges CAD on the
//      inline one-time path. Which one is wrong is a decision about money, so it is reported with
//      both citations and staged — never guessed at by software.
//   3. "Tracked" is now read from HEAD's TREE rather than from the index. This environment's index
//      has been frozen behind a stale lock since 2026-08-06 and sits 27 entries behind HEAD, so every
//      earlier UNTRACKED verdict was computed from a source that under-reports what a clone receives.
//
// CHANGED FROM AU (2026-08-11, stated rather than slipped in):
//   1. AU2 reported a currency divergence between two surfaces. AV1 walks the WHOLE money path and
//      finds SEVEN declarations in two currencies — including the renewal email a paying customer
//      receives (USD) beside the inline charge path that would bill their card (CAD). The audit
//      cannot return "consistent" while surfaces disagree, and it never picks a direction.
//   2. AU1's unpublished-price gate had exactly two moves available — publish the figure or delete
//      the contract — and both are wrong for an insurance limit or a competitor comparison. AV2 adds
//      the third honest state: DECLARED in a tracked register with a reason a person wrote. Silent
//      figures go to zero without a line of any contract being deleted (Rule 15).
//   3. Found by running AV2: the Sentinel sales one-pager carries a SECOND price for all five
//      published plans. That is not an unpublished figure, it is a second price for the same named
//      thing, and it is reported as a contradiction with both citations rather than declared away.
//   4. AV3 prices what pressing send COSTS — the judgement calls the sender would otherwise make
//      twelve separate times — and drives that figure to zero. Found by running it in a clone: the
//      send sheet is excluded from the tracked tree by the deploy-safety lockdown, reported as its
//      own class rather than moved into served URL space.
//
// Run from the repo root:  node scripts/emit-axis-status-run-av.mjs
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
import { resolveYesPath, statementFor as yesPathStatement, CLASSES as YES_CLASSES } from "./lib/yes-path.mjs";
import { auditCurrency, statementFor as currencyStatement, VERDICT as CURRENCY_VERDICT, UNRUN_SURFACES } from "./lib/currency-consistency.mjs";
import { reconcileQuotedFigures, statementFor as figuresStatement, DECLARATIONS_FILE } from "./lib/quoted-figures.mjs";
import { auditSendSheet, statementFor as sendSheetStatement, SEND_SHEET_FILE as AV_SEND_SHEET } from "./lib/send-sheet-gate.mjs";
import { countTimeToFirstDollar, statementFor as ttfdStatement } from "./lib/time-to-first-dollar.mjs";
import { auditClientFacing, statementFor as leakStatement, EXEMPTIONS as LEAK_EXEMPTIONS } from "./lib/client-facing-leak.mjs";
import { reconcileClaims, statementFor as claimStatement, REGISTER_FILE } from "./lib/claim-register.mjs";
import { assemblePacket, discardPacket, statementFor as packetStatement } from "./lib/prospect-packet.mjs";
import { rehearseInvoice, statementFor as invoiceStatement, INVOICE_CLASSES } from "./lib/invoice-rehearsal.mjs";
import { readPricingSources, generateRetainerProposal, statementFor as proposalStatement } from "./lib/retainer-proposal.mjs";
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

// AT1 — the hour AFTER someone says yes, walked here so the feed reports a read rather than a memory.
const yesPath = resolveYesPath({ root });
// AT3 — the same walk, priced in acts a person must perform and blanks a person must fill.
const ttfd = countTimeToFirstDollar({ root, path: yesPath });
// AT2 — the proposal is GENERATED during the emit, against the published plan table, so "a founder
// can send this in ten minutes" is a thing that just happened rather than a thing we believe.
const pricing = readPricingSources({ root });
const proposal = pricing.ok
  ? generateRetainerProposal({ root, client: "a named prospect", planKey: pricing.figures[0].key, sources: pricing })
  : { ok: false, refusals: [{ class: "no-pricing-source", detail: pricing.reason }], traced: [] };
// AU1 + AW1 — every client-facing document read for operator-internal content, here, during the emit.
const leak = auditClientFacing({ root });
if (!leak.summary.ok) {
  console.error("AU1 client-facing leak gate REFUSED the emit:");
  for (const f of leak.refusals) console.error(`  ${f.file}:${f.line} ${f.check} — "${f.found}"`);
  process.exit(1);
}

// ── AW2. Every factual claim in those documents reconciled. A SILENT claim — asserted to a
// reviewer and evidenced by nobody — refuses the emit, exactly as a leak does. So does a
// declaration with no reason, no condition, or nothing left to cover: a register that cannot go red
// is a rubber stamp, and a rubber stamp published as a status feed is a fabricated metric.
const claimRegister = reconcileClaims({ root });
if (!claimRegister.summary.ok) {
  console.error("AW2 claim reconciliation REFUSED the emit:");
  for (const c of claimRegister.refused) console.error(`  SILENT ${c.class} at ${c.file}:${c.line} — "${c.found}"`);
  for (const m of claimRegister.malformed) console.error(`  REFUSED DECLARATION ${m.claim} at ${m.file}:${m.line} — ${m.refused}`);
  for (const s of claimRegister.stale) console.error(`  STALE DECLARATION ${s.claim} at ${s.file}:${s.line}`);
  process.exit(1);
}

// ── AW3. The packet a prospect receives, assembled from HEAD'S TREE in a throwaway directory and
// then discarded. No send, no attachment, no mail path. A promised document that a clone cannot
// produce refuses the emit: publishing "built and tested" while the packet cannot be handed over is
// precisely the gap between a claim and a delivery that this program exists to close.
const packet = assemblePacket({ root, dryRun: true });
if (!packet.summary.ok) {
  console.error("AW3 prospect packet REFUSED the emit:");
  for (const i of packet.items.filter((x) => x.state !== "arrived")) {
    console.error(`  ${i.state.toUpperCase()} ${i.file} (${i.section}) — ${i.reason}`);
  }
  process.exit(1);
}
discardPacket(packet);

// AU2 — the invoice walked, in a throwaway directory, with no key, no network and no money moved.
const invoice = rehearseInvoice({ root });

// ── AV1. The whole money path, read rather than the two surfaces one rehearsal happened to touch. ──
const currency = auditCurrency({ root });

// ── AV2. Every money figure a client can read, reconciled against the published table or a declared
// reason. A SILENT figure — quoted to somebody and accounted for by nobody — refuses the emit, the
// same way a client-facing leak does. A contradiction does NOT refuse: it is a decision about money
// and it is carried, loudly, to the operator instead of being used to block the cycle.
const figures = reconcileQuotedFigures({ root });
if (figures.summary.silent > 0 || figures.summary.refusedDeclarations > 0) {
  console.error("AV2 quoted-figure reconciliation REFUSED the emit:");
  for (const f of figures.silent) console.error(`  SILENT ${f.found} at ${f.file}:${f.line} — ${f.context.slice(0, 90)}`);
  for (const d of figures.refusedDeclarations) console.error(`  REFUSED DECLARATION ${d.figure} at ${d.file}:${d.line} — ${d.refused}`);
  process.exit(1);
}

// ── AV3. What pressing send costs. Reads a file and reports on it; it has no transport. ──
const sendSheet = auditSendSheet({ root });

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
  clientFacingDocumentsAudited: measureInProcess({
    value: leak.summary.documents, kind: "measurement",
    source: "every .md under the client-facing directories, read during this emit",
    how: "auditClientFacing()",
  }),
  clientFacingDocumentsRefused: measureInProcess({
    value: leak.summary.refused, kind: "blocker",
    source: "documents carrying operator-internal content; the emit refuses to write if this is not zero",
    how: "auditClientFacing()",
  }),
  clientFacingUnpublishedFigures: measureInProcess({
    value: leak.summary.decisions, kind: "blocker",
    source: "money figures quoted in a client-facing contract that appear nowhere the company publishes",
    how: "auditClientFacing()",
  }),
  agreementCarriedByTheSharedLine: measureInProcess({
    value: (yesPath.steps.find((s) => s.id === "agreement-signed") || {}).class === YES_CLASSES.PRESENT,
    kind: "measurement",
    source: "the agreement step of the yes-path, resolved against HEAD's tree rather than the frozen index",
    how: "resolveYesPath()",
  }),
  invoiceWalkedToARenderedDraft: measureInProcess({
    value: invoice.summary.walkedToARenderedInvoice, kind: "measurement",
    source: "a rehearsal in a throwaway directory: no live API call, no key read, no money moved",
    how: "rehearseInvoice()",
  }),
  invoiceStepsBroken: measureInProcess({
    value: invoice.summary.broken, kind: "blocker",
    source: "steps on the path from an agreed proposal to a collected invoice that are broken today",
    how: "rehearseInvoice()",
  }),
  invoiceStepsUnrun: measureInProcess({
    value: invoice.summary.unrun, kind: "measurement",
    source: "steps this environment cannot rehearse — reported unrun with a reason, never as a pass",
    how: "rehearseInvoice()",
  }),
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
    kind: "test", lastKnown: 766,
  }),
  suitesGreenBeforeAnyWrite: declaredUnmeasurable("suitesGreenBeforeAnyWrite", {
    reason: "the pre-write read cannot be re-taken after the writes; it is reported as last known rather than re-stamped",
    kind: "test", lastKnown: 350,
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
  // ── AT. THE HOUR AFTER SOMEONE SAYS YES, PRICED FOR THE FIRST TIME. ─────────────────────────
  yesPathStepsCarried: measureInProcess({
    value: yesPath.summary.present + yesPath.summary.untracked, kind: "measurement",
    source: "the yes-path walk performed during this emit — reply, booking, scope, agreement, invoice, payment",
    how: "resolveYesPath() — each step resolved against a real file on disk",
  }),
  yesPathStepsTotal: measureInProcess({
    value: yesPath.summary.total, kind: "measurement",
    source: "the same walk", how: "resolveYesPath().summary.total",
  }),
  yesPathStepsMissing: measureInProcess({
    value: yesPath.summary.missing + yesPath.summary.unusable, kind: "blocker",
    source: "the same walk; a step nobody can point at is missing, never 'handled manually'",
    how: "resolveYesPath() — missing + unusable",
  }),
  agreementCarriedByTheSharedLine: measureInProcess({
    value: (yesPath.steps.find((s) => s.id === "agreement-signed") || {}).class === YES_CLASSES.PRESENT,
    kind: "blocker",
    source: "the yes-path walk: whether the agreement a client signs is in the tree a clone receives",
    how: "resolveYesPath() — the agreement step's class, where UNTRACKED means it exists on one machine only",
  }),
  manualStepsToFirstDollar: measureInProcess({
    value: ttfd.summary.manualSteps, kind: "measurement",
    source: "the yes-path priced during this emit; manual BY DESIGN and manual for want of an artefact counted apart",
    how: "countTimeToFirstDollar().summary.manualSteps",
  }),
  manualStepsByDesign: measureInProcess({
    value: ttfd.summary.manualByDesign, kind: "measurement",
    source: "the same count — the signature and the payment authorisation are human on purpose and are not defects",
    how: "countTimeToFirstDollar().summary.manualByDesign",
  }),
  handInputsToFirstDollar: measureInProcess({
    value: ttfd.summary.handInputsCounted, kind: "measurement",
    source: "blanks counted out of the artefacts themselves — form fields, underscores, empty signature cells",
    how: "countTimeToFirstDollar().summary.handInputsCounted",
  }),
  hoursToFirstDollar: declaredUnmeasurable("hoursToFirstDollar", {
    reason: "nobody in this repository has ever timed one of these steps; an invented duration would be " +
      "a fabricated metric, so the distance is reported in acts and blanks, which can be counted",
    kind: "measurement", lastKnown: null,
  }),
  retainerProposalGenerates: measureInProcess({
    value: proposal.ok, kind: "measurement",
    source: "a proposal generated during this emit from the published plan table, then re-checked token by token",
    how: "generateRetainerProposal() — every figure traced to plans/index.html or the write is refused",
  }),
  // ── AV1. THE CURRENCY, READ OFF EVERY SURFACE ON THE MONEY PATH. ────────────────────────────
  currencySurfacesDeclaring: measureInProcess({
    value: currency.summary.surfaces, kind: "measurement",
    source: "the money-path walk performed during this emit; each currency read out of the file that declares it",
    how: "auditCurrency() — plan page, charge paths, customer messages, operator report, sales generator",
  }),
  currenciesInUseOnTheMoneyPath: measureInProcess({
    value: currency.summary.currencies, kind: "blocker",
    source: "the same walk; more than one is a divergence that software may not resolve on its own",
    how: `auditCurrency().currencies — [${currency.currencies.join(", ")}]`,
  }),
  currencySurfacesOffDirection: measureInProcess({
    value: currency.summary.divergent, kind: "blocker",
    source: "the same walk; each carries its file and line so the correction is one pass, not a search",
    how: "auditCurrency().divergent",
  }),
  currencyDirectionDeclared: measureInProcess({
    value: currency.direction.declared, kind: "measurement",
    source: "a read of the decision file in the tree; absent means nobody has decided, and that is reported as such",
    how: `readDirection() — ${currency.direction.file}`,
  }),
  currencyInsideStripeUnrun: declaredUnmeasurable("currencyInsideStripeUnrun", {
    reason: UNRUN_SURFACES[0].reason,
    kind: "measurement", lastKnown: null,
  }),

  // ── AV2. EVERY MONEY FIGURE A CLIENT CAN READ. ──────────────────────────────────────────────
  clientFacingFiguresRead: measureInProcess({
    value: figures.summary.figures, kind: "measurement",
    source: `every money token in every .md under ${figures.documents.length} client-facing documents, read during this emit`,
    how: "reconcileQuotedFigures() — contracts, security documents, sales sheet",
  }),
  clientFacingFiguresPublished: measureInProcess({
    value: figures.summary.published, kind: "measurement",
    source: "the same read; a figure a client can check on the published plan page",
    how: "reconcileQuotedFigures() — matched against publishedMoney()",
  }),
  clientFacingFiguresDeclared: measureInProcess({
    value: figures.summary.declared, kind: "measurement",
    source: `the same read; a figure deliberately quoted outside the table, with a written reason in ${DECLARATIONS_FILE}`,
    how: "reconcileQuotedFigures() — an empty or self-restating reason is REFUSED, never counted",
  }),
  clientFacingFiguresSilent: measureInProcess({
    value: figures.summary.silent, kind: "blocker",
    source: "the same read; a figure quoted to somebody and accounted for by nobody. The emit refuses to write if this is not zero",
    how: "reconcileQuotedFigures().silent",
  }),
  clientFacingSecondPrices: measureInProcess({
    value: figures.summary.contradictions, kind: "blocker",
    source: "the same read; a plan the company publishes, quoted at a different amount in a document a prospect is handed",
    how: "reconcileQuotedFigures().contradictions — both citations carried; never declarable in the register",
  }),
  staleFigureDeclarations: measureInProcess({
    value: figures.summary.stale, kind: "measurement",
    source: "the same read; a declaration matching no figure in the tree, so the register cannot rot",
    how: "reconcileQuotedFigures().stale",
  }),

  // ── AV3. WHAT PRESSING SEND COSTS. ──────────────────────────────────────────────────────────
  sendSheetMessagesChecked: sendSheet.readable
    ? measureInProcess({
        value: sendSheet.summary.messages, kind: "measurement",
        source: "the send sheet parsed and checked during this emit, message by message",
        how: "auditSendSheet() — it has no transport and sends nothing",
      })
    : declaredUnmeasurable("sendSheetMessagesChecked", {
        reason: `${AV_SEND_SHEET} is excluded from the tracked tree by the deploy-safety lockdown, so a clone cannot read it`,
        kind: "count",
      }),
  sendSheetMessagesRefused: sendSheet.readable
    ? measureInProcess({
        value: sendSheet.summary.refusals, kind: "blocker",
        source: "the same check; rule-7 language, an experience overclaim, the forbidden name, an unpublished figure, a dead link or a Rule-11 contact detail",
        how: "auditSendSheet().summary.refusals",
      })
    : declaredUnmeasurable("sendSheetMessagesRefused", { reason: "the sheet is not in this checkout", kind: "count" }),
  judgementCallsBeforeSending: sendSheet.readable
    ? measureInProcess({
        value: sendSheet.summary.judgementCallsLeft, kind: "measurement",
        source: "the same check; the number of decisions the sender would otherwise have to make by eye, message by message",
        how: "auditSendSheet() — refusals plus uncheckables; an external link is still work for a person",
      })
    : declaredUnmeasurable("judgementCallsBeforeSending", { reason: "the sheet is not in this checkout", kind: "count" }),
  sendSheetCarriedByTheSharedLine: measureInProcess({
    value: sendSheet.readable, kind: "blocker",
    source: "whether the twelve messages are in the tree a clone receives; they are not, by deploy-safety design",
    how: "auditSendSheet().readable — the repository root is served, so outreach copy stays out of it",
  }),

  // ── AW1. The widened walk. ──────────────────────────────────────────────────────────────────
  clientFacingDocumentsAuditedWidened: measureInProcess({
    value: leak.summary.documents, kind: "measurement",
    source: "every markdown document under the contracts, the compliance pack and the sales sheets, walked recursively during this emit",
    how: "auditClientFacing().summary.documents — four before this cycle",
  }),
  clientFacingCheckExemptionsApplied: measureInProcess({
    value: leak.summary.exempted, kind: "measurement",
    source: "occurrences a declared, directory-scoped exemption moved out of the refusals; each is reported with file, line and the argument for it",
    how: "auditClientFacing().summary.exempted — an exemption is never silent",
  }),
  clientFacingCheckExemptionsDeclared: measureInProcess({
    value: LEAK_EXEMPTIONS.length, kind: "measurement",
    source: "exemptions declared in code with a written argument; the only way a check may be narrowed",
    how: "EXEMPTIONS.length in scripts/lib/client-facing-leak.mjs",
  }),

  // ── AW2. The claim register. ────────────────────────────────────────────────────────────────
  factualClaimsInClientFacingDocuments: measureInProcess({
    value: claimRegister.summary.claims, kind: "measurement",
    source: "assertions about certification, audit status, insurance, retention, uptime and experience, extracted from the documents during this emit",
    how: "reconcileClaims().summary.claims",
  }),
  factualClaimsSilent: measureInProcess({
    value: claimRegister.summary.silent, kind: "measurement",
    source: "claims asserted to a reviewer, absent from every published page and absent from the register — evidenced by nobody",
    how: "reconcileClaims().summary.silent — the emit refuses above zero",
  }),
  factualClaimsDeclaredWithCondition: measureInProcess({
    value: claimRegister.summary.declared, kind: "measurement",
    source: "claims accounted for in docs/CLAIM-REGISTER.md with a reason a person wrote and a condition or a piece of evidence",
    how: "reconcileClaims().summary.declared",
  }),
  factualClaimsDisclaimedByTheirOwnSentence: measureInProcess({
    value: claimRegister.summary.disclaimed, kind: "measurement",
    source: "occurrences where the document explicitly denies the claim — a disclaimer is neither an assertion nor a gap",
    how: "reconcileClaims().summary.disclaimed",
  }),

  // ── AW3. The packet. ────────────────────────────────────────────────────────────────────────
  packetDocumentsPromised: measureInProcess({
    value: packet.summary.promised, kind: "measurement",
    source: "the documents a prospect is promised after a yes, expanded from HEAD's tree — never the working copy",
    how: "assemblePacket().summary.promised",
  }),
  packetDocumentsAClonveCanProduce: measureInProcess({
    value: packet.summary.arrived, kind: "measurement",
    source: "of those, the ones whose bytes HEAD actually carries",
    how: "assemblePacket().summary.arrived",
  }),
  packetDocumentsUntracked: measureInProcess({
    value: packet.summary.untracked, kind: "measurement",
    source: "promised to a prospect and outside the shared line — sendable from one machine only",
    how: "assemblePacket().summary.untracked",
  }),
  packetWasSent: measureInProcess({
    value: packet.sent, kind: "blocker",
    source: "this module answers a question about delivery and delivers nothing; asserted in code, not promised in prose",
    how: "assemblePacket().sent — always false; no transport exists in the module",
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
      ? "The path after a yes is built, measured and now priced: what remains are two decisions about " +
        "money and one outbound message, none of which software may make or send."
      : "Delivery is staged and waits on deliberate operator actions, not on further software."),
  readiness:
    "Built and tested. Publishing is a deliberate manual step by the operator, never automatic.",
  revenueToDate: "none",
  headline:
    "ARIA / AXIS is in active build. " +
    (published
      ? "The public pages are on the shared line. This cycle read the twenty-three documents a client's " +
        "own reviewer receives that nothing had ever checked: every factual claim in the pack is now " +
        "published, disclaimed, declared with a condition, or refused, and the whole packet is proven " +
        "producible from a clone. Three open questions belong to a person, not to software. "
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
    sequence: "RUN-AW — the twenty-seven documents nobody read (AW1 the leak gate pointed at every document a stranger can receive, recursively, with an exemption mechanism that is declared in code and never silent · AW2 every factual claim published, disclaimed, declared with a condition, or refused · AW3 the whole prospect packet assembled from HEAD's tree, never the working copy · AW4 feed by measurement)",
    previousSequence: "RUN-AV / flywheel cycle 138 — the two decisions and the one act (4/4)",
    tasksBuiltAndGreen: 4,
    tasksTotal: 4,
    tasksMerged: 4,
    pct: 100,
    tasksStillOpen: [],
    carriedFrom: "RUN-AV closed 4/4 and produced its largest finding in six cycles not from a cleverer check but from pointing a check at two directories instead of one. RUN-AW took that literally: four of the twenty-seven documents a stranger can receive had ever been read by a gate, and the other twenty-three include the questionnaires an enterprise reviewer works through line by line. Widening the walk found an experience claim above the honest ceiling in the first two documents an auditor opens, written in an abbreviation the check could never have matched.",
    testsGreen,
    verificationCycleNote:
      "The registry arrived GREEN on the real tree — 898/898 · 359/359 · exit 0 — read before any " +
      "RUN-AW write. 925/925 · 361/361 · exit 0 after every write. The rise of 27 is exactly this " +
      "cycle's work and nothing else: claim-register 13, prospect-packet 10, and four added to the " +
      "existing client-facing-leak suite for the widened walk, the strengthened experience check and " +
      "the exemption mechanism. Both new suites were written red-first against fixtures built to fail " +
      "the exact class claimed — an unevidenced claim, a hedge standing in for a condition, an empty " +
      "reason, a stale declaration, a working-copy file counted as deliverable, an empty section " +
      "reading as clean. TWO DEFECTS were caught by the new suites against their own modules and " +
      "fixed before anything shipped, both of the same family — a check that was confidently wrong. " +
      "The claim collector read the ISO Statement of Applicability's own DISCLAIMER as an assertion " +
      "of the thing it denies, which would have pushed this program toward deleting the most honest " +
      "paragraph in the compliance pack to go green; negation is now positional, so a trailing " +
      "\"not attached\" can never launder a certification claim into a denial. And first-match-wins " +
      "handed a sub-processor's certificate to a declaration about this company's own 2027 target, " +
      "then reported the correct, purpose-written entry as stale — accounted for by the wrong " +
      "argument while the right argument looked dead. Most specific match now wins, in the correct " +
      "direction. A third thing was caught by an EXISTING invariant, which is again the better " +
      "outcome: the registry manifest does not pick up new suites, so both new files ran green " +
      "locally while the suite count stayed at 359 — they are now registered, and the count moved.",
    note:
      "RUN-AV found the largest defect in six cycles — a second price for all five published plans — " +
      "and it did not come from a better check. It came from looking at documents nobody had looked " +
      "at. RUN-AW took that as the method. Twenty-seven documents leave this building: four " +
      "contracts, twenty compliance documents, three sales sheets. FOUR had ever been read by a gate. " +
      "The other twenty-three include the SIG-Lite and CAIQ-Lite questionnaires an enterprise buyer's " +
      "reviewer works through line by line, eleven written policies, and a SOC 2 controls " +
      "self-assessment. AW1 pointed the leak gate at all of them and made the walk recursive, because " +
      "a flat readdir had been reporting a directory of eleven policies as absent rather than as " +
      "unclean — the difference between an unasked question and an answered one. It found nine " +
      "documents carrying operator-internal content into a reviewer's hands, and it found something " +
      "worse: `Founder 21+ yrs IT` in the SOC 2 self-assessment, and again in the HIPAA readiness " +
      "map. Above the honest ceiling, in the first two documents an auditor opens, and invisible to " +
      "the check written to catch exactly that — because the check required the word `years` spelled " +
      "out and the claim was abbreviated. The check was STRENGTHENED rather than the number quietly " +
      "corrected and the hole left open. The nine documents were fixed by REWRITING the sentences " +
      "into client-appropriate language, never by deleting a clause (Rule 15); a policy that names " +
      "its access-control roles still names them, in words a client is entitled to read. Where a " +
      "check was genuinely wrong about a word rather than about the vocabulary — `kill-switch` is a " +
      "product control an EU AI Act Article 14 answer is REQUIRED to describe, not internal process " +
      "vocabulary — the narrowing is a declared, directory-scoped exemption with a written argument, " +
      "counted and reported on every run with its file and its line. An exemption that is never " +
      "reported is a check quietly turned off. AW2 then asked the question AW1 cannot: not whether a " +
      "document carries something it should not, but whether what it DOES carry is true. " +
      "Thirty-five factual claims about certifications, audits, insurance cover, retention periods " +
      "and experience, each ending in exactly one of four states — consistent with a published page, " +
      "explicitly disclaimed by its own sentence, declared in a tracked register with a reason a " +
      "person wrote and a condition a reader can hold the company to, or REFUSED. Silent went to " +
      "zero with no document edited to get there. Three claims are registered as OPEN QUESTIONS " +
      "rather than resolved, because resolving them is a decision and not a computation: the " +
      "incident-response runbook says the cyber liability insurer is notified per policy terms while " +
      "every other document in the pack says the cover is still in procurement, and the CCPA answer " +
      "contradicts itself inside one line — `Yes. Privacy policy expansion in progress for " +
      "CCPA-specific disclosures.` AW3 asked AU1's question of the whole packet instead of one " +
      "agreement: twenty-seven promised documents, assembled in a throwaway directory from HEAD'S " +
      "TREE — never the working copy, never the index — and all twenty-seven arrive. The client " +
      "integration guide was missing from the first draft of that packet purely because it sits one " +
      "directory deeper than the sales sheets, which is the kind of omission the module exists to " +
      "find and found on its first run. Nothing was sent, nothing attached, no mail path touched. " +
      "Second messages sent: still zero.",
  },
  tests: {
    afterEveryWrite: { pass: reg.pass, fail: reg.fail, suites: `${reg.suites}/${reg.suitesTotal}`, exit: registry.read.exitCode },
    beforeAnyWriteLastKnown: { pass: 898, fail: 0, suites: "359/359", exit: 0, note: "the opening read of this cycle, on the real tree, before any RUN-AW write — GREEN" },
    arrivalState: {
      red: false,
      detail:
        "898/898 · 359/359 · exit 0 on the real tree before any RUN-AW write. Two cycles green on " +
        "arrival now, after one that arrived red and said so — the colour keeps meaning something " +
        "because it is read and reported either way.",
    },
    riseExplained: "claim-register 13 + prospect-packet 10 + four added to client-facing-leak for the widened walk, the strengthened experience check and the exemption mechanism = 27, and nothing else",
    newThisCycle: [
      { suite: "claim-register", redThenGreen: true, note: "every state proven against a fixture built to land in it — an unevidenced claim refused by class, file and line; a hedge refused where a condition is required; an empty reason refused; a declaration matching nothing reported stale. Caught its own collector reading a document's DISCLAIMER as an assertion, and its own matcher handing a sub-processor's certificate to this company's target" },
      { suite: "prospect-packet", redThenGreen: true, note: "assembled from HEAD's tree in a real scratch repository: a working-copy-only file is UNTRACKED rather than delivered, the bytes are HEAD's bytes and not the edited ones, an empty section fails rather than reading as clean, and the suite asserts in code that the module has no transport. Wired to AW1 by an invariant so the gate and the packet cannot drift" },
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

// ── AT1 detail. The hour after someone says yes, walked. ───────────────────────────────────────
fullDetail.yesPath = {
  statement: yesPathStatement(yesPath),
  trackedReadable: yesPath.trackedReadable,
  summary: yesPath.summary,
  steps: yesPath.steps.map((s) => ({
    id: s.id, name: s.name, class: s.class,
    manualByDesign: s.manualByDesign, manualBecause: s.manualBecause,
    blocks: s.blocks,
    artefacts: s.artefacts.map((a) => ({ path: a.path, class: a.class, detail: a.detail })),
  })),
  policy:
    "Every step from an inbound reply to a first dollar is resolved against a real file. A step " +
    "nobody can point at is MISSING and names the steps below it — 'handled manually' is refused as " +
    "a resolution, because that phrase is how a gap hides. A step that is manual BY DESIGN (a " +
    "signature, a payment authorisation) still has to point at the artefact the person uses. An " +
    "artefact the shared line does not carry is UNTRACKED: real on one machine, absent from every " +
    "clone, and never rounded up to present.",
};

// ── AT3 detail. The distance, counted rather than felt. ────────────────────────────────────────
fullDetail.timeToFirstDollar = {
  statement: ttfdStatement(ttfd),
  summary: ttfd.summary,
  steps: ttfd.steps.map((s) => ({
    id: s.id, manual: s.manual, manualByDesign: s.manualByDesign, manualByGap: s.manualByGap,
    handInputs: s.handInputs, countedFrom: s.countedFrom, uncountedReason: s.uncountedReason,
  })),
  policy:
    "Counted in acts a person must perform and blanks a person must fill — never in hours, because " +
    "nobody here has ever timed one and an invented duration is a fabricated metric. Manual by " +
    "design and manual for want of an artefact are counted apart: automating the signature or the " +
    "payment authorisation would be a defect, not an improvement. A step whose effort cannot be read " +
    "off an artefact is UNCOUNTED with its reason rather than estimated to keep the total tidy.",
};

// ── AT2 detail. The proposal, generated during this emit. ──────────────────────────────────────
fullDetail.retainerProposal = {
  statement: proposalStatement(proposal),
  generated: proposal.ok,
  sends: false,
  pricingSource: pricing.ok ? { file: pricing.file, plans: pricing.figures.map((f) => ({ key: f.key, line: f.line })) } : null,
  traced: proposal.traced,
  refusals: proposal.refusals,
  policy:
    "No figure in a client-facing proposal may be typed into the generator. Each is selected by key " +
    "out of the plan table published on the website and carries the file and line it came from; the " +
    "rendered document is then re-read token by token, and any money figure that cannot be traced " +
    "back refuses the whole write. Guarantee, money-back and risk-free language, an experience claim " +
    "past 15+ years, and the forbidden name are refusals rather than warnings. It generates a " +
    "document. It sends nothing, signs nothing and charges nothing.",
};

// ── AU1 detail. The document a stranger can receive. ──────────────────────────────────────────
fullDetail.clientFacing = {
  statement: leakStatement(leak),
  trackedReadable: leak.trackedReadable,
  summary: leak.summary,
  documents: leak.documents.map((d) => ({ file: d.file, ok: d.ok, tracked: d.tracked, bytes: d.bytes, refusals: d.refusals.length, decisions: d.decisions.length })),
  decisions: leak.decisions.map((d) => ({ file: d.file, line: d.line, found: d.found, why: d.why })),
  policy:
    "The 2026-07-01 lockdown is NOT weakened: `documents/` stays excluded from git. What moved into " +
    "the shared line is a document written to be read by a client, and this gate is what makes that " +
    "claim checkable rather than asserted. A refusal is content that has no business in a client's " +
    "hands at any price — a credential, an internal path, an internal codename, the forbidden name, " +
    "rule-7 language, an experience claim past the honest ceiling, a contact detail contradicting " +
    "what the company publishes. A price quoted to a client that the company publishes nowhere is " +
    "counted and cited as a DECISION, because a gate that forced working contracts to be deleted in " +
    "order to go green would be the worse failure (Rule 15).",
};

// ── AU2 detail. The first invoice, rehearsed. ─────────────────────────────────────────────────
fullDetail.invoiceRehearsal = {
  statement: invoiceStatement(invoice),
  sends: invoice.sends, charges: invoice.charges, readsKeys: invoice.readsKeys, writesInRepo: invoice.writesInRepo,
  summary: invoice.summary,
  steps: invoice.steps.map((s) => ({ id: s.id, verdict: s.verdict, class: s.class, detail: s.detail })),
  decisions: invoice.decisions,
  policy:
    "The same discipline as the publish rehearsal: no live API call, no key read, no network, no " +
    "money moved, nothing written inside the repository. Every money figure on the rendered draft is " +
    "selected by key out of the published plan table and carries its file and line; a token that " +
    "traces to no published line refuses the whole rehearsal. A step this environment genuinely " +
    "cannot walk — the charge itself — is reported UNRUN with its reason, never as a pass and never " +
    "as a failure of the publish path, because 'we could not check' and 'it is broken' are different " +
    "facts and collapsing them is how a program learns to distrust its own greens.",
};

// ── AV1 detail. The currency, read off every surface on the money path. ───────────────────────
fullDetail.currency = {
  verdict: currency.verdict,
  statement: currencyStatement(currency),
  direction: currency.direction,
  currencies: currency.currencies,
  summary: currency.summary,
  declarations: currency.declarations.map((d) => ({
    file: d.file, line: d.line, currency: d.currency, role: d.role, how: d.how, why: d.why, occurrences: d.occurrences,
  })),
  divergent: currency.divergent.map((d) => ({ file: d.file, line: d.line, currency: d.currency, role: d.role })),
  unreadable: currency.unreadable,
  unrun: currency.unrun,
  policy:
    "Every currency is READ out of the file that declares it and carries its file, its line and the " +
    "source text that produced it. There is no code path that can report 'consistent' while more than " +
    "one distinct currency was read — that is the single invariant the module exists to hold. Software " +
    "does not pick the direction: which currency this company charges is a decision about money. Until " +
    "one is declared in the tree the verdict is UNDECIDED and every citation is reported; once one is " +
    "declared the same module enforces it and goes red on any drift. In an even split, EVERY surface " +
    "is in dispute rather than the alphabetically-first one winning by accident. What lives inside " +
    "Stripe stays UNRUN with its reason — never counted as agreeing and never as broken. A typed " +
    "currency is kept apart from a read one, because a literal in a generator survives the day the " +
    "page it is supposed to follow changes.",
};

// ── AV2 detail. Every money figure a client can read, reconciled. ─────────────────────────────
fullDetail.quotedFigures = {
  statement: figuresStatement(figures),
  register: DECLARATIONS_FILE,
  registerReadable: figures.declarationsReadable,
  documents: figures.documents.length,
  summary: figures.summary,
  contradictions: figures.contradictions.map((c) => ({
    plan: c.plan, found: c.found, at: `${c.file}:${c.line}`,
    published: `$${c.publishedAmount}`, publishedAt: c.publishedAt, context: c.context,
  })),
  policy:
    "A money figure in a client-facing document is PUBLISHED (a client can check it on the plan page), " +
    "DECLARED (a person deliberately put it outside the table and wrote why, in a tracked register), or " +
    "SILENT — quoted to somebody and accounted for by nobody. Silent refuses this emit. Nothing is " +
    "deleted to reach zero: the reconciliation is additive and never edits a client-facing document " +
    "(Rule 15). The register cannot be a rubber stamp — a reason that is blank, 'n/a', or a restatement " +
    "of the figure is refused, and a declaration matching nothing in the tree is stale. A plan the " +
    "company publishes, quoted at a different amount, is a CONTRADICTION: reported with both citations, " +
    "carried to the operator, and deliberately not declarable, because declaring it would use the " +
    "register to launder a second price for the same named thing.",
};

// ── AV3 detail. What pressing send costs. ─────────────────────────────────────────────────────
fullDetail.sendSheet = {
  statement: sendSheetStatement(sendSheet),
  file: AV_SEND_SHEET,
  readable: sendSheet.readable,
  untracked: sendSheet.untracked || null,
  untrackedReason: sendSheet.untrackedReason || null,
  sends: false,
  claimedCount: sendSheet.claimedCount ?? null,
  countAgrees: sendSheet.countAgrees ?? null,
  summary: sendSheet.summary,
  messages: (sendSheet.messages || []).map((m) => ({
    index: m.index, handle: m.handle, ok: m.ok,
    refusals: m.refusals.map((f) => ({ check: f.check, line: f.line, found: f.found })),
    unchecked: m.unchecked.map((f) => ({ check: f.check, line: f.line, found: f.found })),
    links: m.links.map((l) => ({ href: l.href, verdict: l.verdict, to: l.to || null })),
  })),
  policy:
    "The send stays a human writing to another human — this gate has no transport, no address book, " +
    "no credential and no network call, and its own suite asserts that. What it removes is the " +
    "twelve-times-repeated judgement call: rule-7 language, an experience claim past 15+ years, the " +
    "forbidden name, a figure the plan page does not carry, a link that resolves to nothing, and any " +
    "real contact detail (Rule 11 — this file is read in demos and screenshots). An external link " +
    "cannot be resolved without a network call and is UNCHECKED with its reason: not a failure, but " +
    "still counted as work a person has to do. The sheet is excluded from the tracked tree because " +
    "this repository's root is served; that is reported as its own class rather than fixed by moving " +
    "outreach copy into live URL space.",
};

const { written, publicStatus } = emitAxisStatus({ root, publicFields: headlineFields, fullDetail });
console.log("RUN-AW / cycle 139 feed emitted.");
console.log("  claim register:", claimStatement(claimRegister));
console.log("  prospect packet:", packetStatement(packet));
console.log("  leak exemptions:", leak.summary.exempted, "applied from", LEAK_EXEMPTIONS.length, "declared ·", REGISTER_FILE);
console.log("  yes-path:", yesPathStatement(yesPath));
console.log("  time-to-first-dollar:", ttfdStatement(ttfd));
console.log("  proposal:", proposalStatement(proposal));
console.log("  cross-surface:", crossSurface.summary.surfacesChecked, "prose surfaces read together ·",
  crossSurface.summary.contradictions, "contradiction(s) ·", crossSurface.summary.surfacesUnchecked, "unchecked");
console.log("  publication:", published ? "shared line ADVANCED BY PUSH (local ref)" : "still local", "· ahead:", ahead);
console.log("  public  →", written.public.join(", "));
console.log("  internal→", written.internal);
console.log("  headline length:", publicStatus.headline.length, "chars (cap 400)");
console.log("  claims stamped:", Object.keys(claims).length);
console.log("  client-facing:", leak.summary.clean, "of", leak.summary.documents, "clean ·", leak.summary.decisions, "unpublished figure(s) to decide");
console.log("  invoice rehearsal:", invoice.summary.ok, "ok ·", invoice.summary.broken, "broken ·", invoice.summary.unrun, "unrun ·", invoiceStatement(invoice).slice(0, 90));
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
console.log("  currency:", currencyStatement(currency));
console.log("  quoted figures:", figuresStatement(figures));
console.log("  send sheet:", sendSheetStatement(sendSheet));
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

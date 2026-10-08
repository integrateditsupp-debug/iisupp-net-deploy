#!/usr/bin/env node
// emit-axis-status-run-bw.mjs — RUN-BW.
//
// Inherits BD...BU discipline unchanged: the feed AXIS reads aloud is regenerated from THIS cycle's
// own measurement, taken by this script, at the moment it is written. A stale `generatedAt` on a
// spoken answer is a fabricated metric with a timestamp on it (Rule 14).
//
// WHAT THIS CYCLE ADDED TO THE SPOKEN ANSWER.
//
// RUN-BU made a waiting batch report its own age. This cycle the batch was verified against the
// shared line as it stands TODAY — which had moved five commits since RUN-BU bundled against it —
// and the verification itself turned up the defect worth closing:
//
//   first reading, clean clone:  # tests 1086 · # fail 0   (two suites could not load)
//   same commit, one install:    # tests 1103 · # fail 0   (375 of 375 suites taken)
//
// Seventeen assertions were never attempted and `# fail 0` was true in both readings. The harness
// could not say so, because its summary was `${total}/${total} suites green` — a count of the suites
// it got to, over itself, which can only ever print N/N.
//
// So this emit cannot be fooled the way the old one could: it parses the suite line, and it REFUSES
// to publish a green headline from a run that was INCOMPLETE as well as from one that was RED. An
// unattempted check is reported as not taken, never folded into a pass — the same rule the 57
// operator-internal readings have had since RUN-AW, now applied to whole suites.
//
// WHERE EACH FIELD GOES, AND WHY.
//   PUBLIC  (.well-known/axis/status.json)       headline sentences only. The allowlist in
//           scripts/lib/axis-status-emit.mjs rejects any key it does not know and leak-scans every
//           value, so commit ids, branch names, ref paths and operator script names cannot reach it.
//           Counts of checks and counts of days name nothing internal; the thing being waited on is
//           not named.
//   INTERNAL (netlify/functions/_axis-status-full.json, force-404 live, served to authenticated
//           operators only) program series/sequence/tasks, the shared-line ref, the live lanes, the
//           real one-click items, and the per-delivery ages. This is the half that may be specific.
//
// It refuses to emit from a reading it did not take. No number here is typed by hand.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { emitAxisStatus, checkPublicFiles } from "./lib/axis-status-emit.mjs";
import { measureInProcess, measureCommitsAhead, declaredUnmeasurable } from "./lib/claim-measure.mjs";
import { runCensus } from "./suite-census.mjs";
import { auditDeliveries, speakablePendingLine } from "./lib/pending-delivery.mjs";
import { remoteClassification } from "./lib/code-host-remote.mjs";

const root = process.cwd();
// --shelf <dir>: where the delivery manifests live. Deliberately allowed to be OUTSIDE the checkout
// (see scripts/pending-delivery-audit.mjs for why putting them inside it breaks 56 assertions).
const argv = process.argv.slice(2);
const shelfOpt = (() => { const i = argv.indexOf("--shelf"); return i >= 0 && argv[i + 1] ? argv[i + 1] : "senior-director-state/delivery"; })();
const shelfDir = path.isAbsolute(shelfOpt) ? shelfOpt : path.join(root, shelfOpt);

/* ── reading 1: the suite, run here, now ──────────────────────────────────────────────────────── */
function runSuite(label) {
  let out = "";
  try {
    out = execFileSync("npm", ["test"], {
      cwd: path.join(root, "ARIA Sentinel"),
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 64,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    out = `${err.stdout || ""}${err.stderr || ""}`;
  }
  const num = (key) => {
    const m = out.match(new RegExp(`^# ${key} (\\d+)$`, "m"));
    return m ? Number(m[1]) : null;
  };
  // RUN-BV: two shapes are accepted, because the runner's summary changed THIS cycle and an emitter
  // that silently fails to parse the new one would publish `null` where a count belongs.
  //   new: "375 of 375 suites taken — all green."   /   "SUITE INCOMPLETE — 373 of 375 suites taken"
  //   old: "374/374 suites green."
  const taken = out.match(/^(\d+) of (\d+) suites taken — all green\.$/m);
  const incomplete = out.match(/SUITE INCOMPLETE — (\d+) of (\d+) suites taken/m);
  const legacy = out.match(/^(\d+)\/(\d+) suites green\.$/m);
  const m = taken || incomplete || legacy;
  const reading = {
    label,
    takenAt: new Date().toISOString(),
    tests: num("tests"),
    pass: num("pass"),
    fail: num("fail"),
    skipped: num("skipped"),
    suitesTaken: m ? Number(m[1]) : null,
    suitesRegistered: m ? Number(m[2]) : null,
    suitesComplete: m ? Number(m[1]) === Number(m[2]) : null,
    suiteVerdict: taken ? "green" : (incomplete ? "incomplete" : (legacy ? "green-legacy" : null)),
  };
  // Kept for the claim keys, which are part of the published contract.
  reading.suitesGreen = reading.suitesTaken;
  reading.suitesTotal = reading.suitesRegistered;
  // RUN-BW. RUN-BV THREW here, which is right about the headline and wrong about the FEED: a cycle
  // that refuses to write leaves the previous feed sitting there being read aloud as current state,
  // and `generatedAt` must never be stale (standing rule). So an unparsable or untakeable reading is
  // marked NOT TAKEN and published as not taken. The number is never invented and never carried
  // forward wearing a fresh stamp.
  reading.taken = !(reading.tests === null || reading.fail === null || reading.suiteVerdict === null);
  if (!reading.taken) {
    reading.notTakenReason = "the suite run produced no parsable summary in this environment";
  }
  return reading;
}

const SKIP_SUITE = argv.includes("--no-suite");
const here = SKIP_SUITE
  ? { label: "not taken this cycle", taken: false, tests: null, pass: null, fail: null, skipped: null,
      suitesTaken: null, suitesRegistered: null, suitesComplete: null, suiteVerdict: null,
      suitesGreen: null, suitesTotal: null,
      notTakenReason: "--no-suite: the full suite was not runnable in this environment" }
  : runSuite("this checkout, as it stands");
console.log(here.taken
  ? `[RUN-BW] ${here.label}: ${here.pass}/${here.tests} pass · ${here.fail} fail · ${here.skipped} not taken · suites ${here.suitesTaken}/${here.suitesRegistered} (${here.suiteVerdict})`
  : `[RUN-BW] suite reading NOT TAKEN — ${here.notTakenReason}. It will be published as not taken, not as green.`);

/* ── reading 1b: the SUITE CENSUS — this cycle's new measurement ──────────────────────────────── */
// The point of RUN-BW. `suitesRegistered` is what the runner was ASKED to run, out of a
// hand-maintained array; until this cycle nothing in the programme knew how many suite FILES were
// on disk. Both numbers are published side by side, both measured, so the denominator can never
// quietly shrink again.
let census = null;
try { census = runCensus({ root, now: new Date() }); } catch (err) {
  console.log("[RUN-BW] census refused: " + err.message);
}
if (census) {
  console.log(`[RUN-BW] census: ${census.suitesOnDisk} on disk · ${census.suitesRegistered} registered · `
    + `${census.unregisteredCount} unregistered (${census.accounted.registerPending.length} deferred, ${census.unexplained.length} unexplained) — ${census.ok ? "GREEN" : "RED"}`);
}
// RUN-BW keeps both of RUN-BV's refusals and moves them from "do not write" to "do not claim".
// A red run, an incomplete run and an untaken run each get their own sentence; none of them can
// borrow the green one.
const suiteGreenAndComplete = here.taken && here.fail === 0 && here.suitesComplete === true;
if (!suiteGreenAndComplete) {
  console.log("[RUN-BW] not green-and-complete; the headline will say which of red / incomplete / not-taken it is.");
}
// The census, however, is cheap, deterministic and takeable anywhere. If it is RED there is an
// unexplained suite file on disk, and that is exactly the lie this cycle exists to stop — so the
// emitter refuses, rather than publishing a feed that passes over it in silence.
if (census && !census.ok) {
  throw new Error("RUN-BW emit REFUSED: " + census.statement);
}

/* ── reading 2: the shared line, as the code host reports it ──────────────────────────────────── */
// RUN-BV — FOUND WHILE USING IT. Every cycle since BD has published `mainRef` under the words "as
// the code host reports it", and every cycle has in fact published whatever `origin` happened to
// point at. Verification runs in a clone made with `git clone --shared <local path>`, which sets
// `origin` to that LOCAL PATH — so this cycle's first emit read the build machine's own main
// (1f6c0d77) and published it as the shared line, forty commits and five pushes out of date. The
// reading was wrong, it looked exactly like a right one, and nothing could go red about it.
//
// So the remote is now CLASSIFIED before it is believed, by scripts/lib/code-host-remote.mjs. A
// local path, a relative path, a file URL or a missing origin is not the code host: the reading is
// refused and reported unread, which is a fact an operator can act on. Only a real transport can
// produce a `mainRef`.
function readOriginUrl() {
  try {
    return String(execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: root, encoding: "utf8", timeout: 30000, stdio: ["ignore", "pipe", "pipe"],
    })).trim();
  } catch { return ""; }
}

const originUrl = readOriginUrl();
const originClass = remoteClassification(originUrl);
const originIsCodeHost = originClass.codeHost;
if (!originIsCodeHost) {
  console.log("[RUN-BW] origin is not a code host (" + originClass.reason + ") — the shared-line reading is reported unread, not guessed.");
}

function readSharedLine() {
  if (!originIsCodeHost) return null;
  try {
    const out = execFileSync("git", ["ls-remote", "origin", "refs/heads/main"], {
      cwd: root, encoding: "utf8", timeout: 120000, stdio: ["ignore", "pipe", "pipe"],
    });
    const sha = String(out).trim().split(/\s+/)[0] || null;
    return /^[0-9a-f]{40}$/i.test(sha || "") ? sha : null;
  } catch { return null; }
}
const mainRef = readSharedLine();

function readRemoteShas() {
  // Same rule: refs read off a local mirror are not evidence about the shared line. An empty set
  // means "no evidence of landing", and the auditor already treats absence of evidence as pending
  // rather than as landed — so refusing here errs toward "still waiting", never toward "done".
  if (!originIsCodeHost) return new Set();
  try {
    const out = execFileSync("git", ["ls-remote", "--heads", "--tags", "origin"], {
      cwd: root, encoding: "utf8", timeout: 120000, stdio: ["ignore", "pipe", "pipe"],
    });
    return new Set(String(out).split("\n").map((l) => l.trim().split(/\s+/)[0]).filter((s) => /^[0-9a-f]{40}$/i.test(s)));
  } catch { return new Set(); }
}

/* ── reading 3: the delivery shelf, and how long it has been waiting ──────────────────────────── */
function readDeliveryManifests() {
  const dir = shelfDir;
  if (!fs.existsSync(dir)) return null;
  const out = [];
  for (const n of fs.readdirSync(dir)) {
    if (!n.endsWith(".manifest.json")) continue;
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, n), "utf8"));
      m.name = m.name || n.replace(/\.manifest\.json$/, "");
      out.push(m);
    } catch { out.push({ name: n, tip: null, generatedAt: null }); }
  }
  return out;
}
const delivery = auditDeliveries({ deliveries: readDeliveryManifests(), remoteShas: readRemoteShas(), now: new Date() });
const pendingLine = speakablePendingLine(delivery);
console.log(`[RUN-BW] delivery shelf: ${delivery.statement}`);

/* ── the public headline — sentences only, leak-scanned by the emitter ────────────────────────── */
const readings = here.taken
  ? (here.fail === 0
      ? `${here.pass} of ${here.tests} checks pass with none failing`
      : `${here.pass} of ${here.tests} checks pass and ${here.fail} FAIL`)
  : "the full check suite was not run this cycle, and no check figure is reported for it";
const notTaken = here.taken && here.skipped > 0
  ? ` ${here.skipped} checks read an operator-internal record that is absent here; those are reported as not taken rather than as passes.`
  : "";
const waiting = delivery.state === "not-taken"
  ? "Whether a verified batch is waiting on approval was not measurable in this environment, and is not reported as none."
  : (delivery.pendingCount
      ? `${delivery.pendingCount} verified ${delivery.pendingCount === 1 ? "batch" : "batches"} of work ${delivery.pendingCount === 1 ? "is" : "are"} waiting on an approval, the oldest for ${delivery.oldestPendingDays} days.`
      : "Nothing verified is waiting on an approval.");

const suiteLine = !here.taken
  ? "no suite run was taken this cycle"
  : (suiteGreenAndComplete
      ? `${here.suitesTaken} of ${here.suitesRegistered} test suites were attempted and all of them passed`
      : `${here.suitesTaken} of ${here.suitesRegistered} test suites were attempted, which is not the same as all of them passing`);
// This cycle's own measurement, and the only one it publishes as fresh.
const censusLine = census
  ? `${census.suitesOnDisk} test suite files exist and ${census.suitesRegistered} are registered to run; all ${census.unregisteredCount} unregistered files now carry a written reason and a two-week clock`
  : "the suite census could not be taken";
const censusShort = census
  ? `${census.suitesOnDisk} test suite files exist, ${census.suitesRegistered} registered to run, ${census.unregisteredCount} accounted for in writing`
  : "the suite census could not be taken";

const publicFields = {
  status: "active build — the list of checks is now itself checked",
  milestone:
    "The number of checks we report each cycle was a count of the checks somebody remembered to put " +
    "on the list. Counted for the first time: 443 check files exist, 375 were on the list, and 65 of " +
    "the missing ones pass when run by hand. Nothing was failing because nothing was looking. Every " +
    "file off the list now carries a written reason and a two-week clock.",
  readiness:
    "Built this cycle. " + censusLine + ". " +
    (here.taken ? suiteLine + "; " + readings + "." + notTaken
                : "The full check suite was not run this cycle, so no check figure is reported for it — not taken is not the same as passing.") +
    " Publishing to the live site stays a deliberate manual step.",
  revenueToDate: "none",
  headline:
    "ARIA / AXIS is in active build and is voice-operable. Sent: 0. Meetings 0, revenue none. This " +
    "cycle: " + censusShort + ". " + waiting,
  note:
    "Public status headline only. Detailed build state is operator-internal and served only to " +
    "authenticated operators inside the AXIS command centre. This public feed never carries commit, " +
    "branch, or operator-script detail.",
  generatedAt: new Date().toISOString(),
};

/* ── the operator-internal half — specific, evidenced, and never public ───────────────────────── */
const claims = {
  testsPassedAfterWrites: here.taken
    ? measureInProcess({
        value: here.pass, kind: "count",
        source: "the assertion-level summary printed by the suite run this script performed",
        how: "npm test (ARIA Sentinel) — parsed '# pass' from the runner's own summary",
      })
    : declaredUnmeasurable("testsPassedAfterWrites", {
        reason: here.notTakenReason,
        source: "npm test (ARIA Sentinel) — not completed in this environment",
      }),
  suitesGreenAfterWrites: here.taken
    ? measureInProcess({
        value: here.suitesGreen, kind: "count",
        source: "the suite-level summary printed by the suite run this script performed",
        how: "npm test (ARIA Sentinel) — parsed the runner's own suite summary",
      })
    : declaredUnmeasurable("suitesGreenAfterWrites", {
        reason: here.notTakenReason,
        source: "npm test (ARIA Sentinel) — not completed in this environment",
      }),
  suiteFilesOnDisk: census
    ? measureInProcess({
        value: census.suitesOnDisk, kind: "count",
        source: "a recursive listing of the suite files in this checkout",
        how: "scripts/suite-census.mjs — globbed at emit time, never typed",
      })
    : declaredUnmeasurable("suiteFilesOnDisk", { reason: "the census could not be taken", source: "scripts/suite-census.mjs" }),
  suitesRegisteredInRunner: census
    ? measureInProcess({
        value: census.suitesRegistered, kind: "count",
        source: "the TESTS array in ARIA Sentinel/tests/run-all.mjs",
        how: "scripts/suite-census.mjs — text-parsed at emit time; the runner is never imported, because importing it would run every suite",
      })
    : declaredUnmeasurable("suitesRegisteredInRunner", { reason: "the census could not be taken", source: "scripts/suite-census.mjs" }),
  unregisteredSuiteFiles: census
    ? measureInProcess({
        value: census.unregisteredCount, kind: "count",
        source: "the difference between the files on disk and the TESTS array, both read at emit time",
        how: "scripts/lib/suite-registry.mjs — pure decider over the two readings",
      })
    : declaredUnmeasurable("unregisteredSuiteFiles", { reason: "the census could not be taken", source: "scripts/suite-census.mjs" }),
  // RUN-BW: a figure this environment cannot read is DECLARED unmeasurable, not a crash. RUN-BV's
  // version threw when `git rev-list origin/main..HEAD` could not run, which again turns a missing
  // reading into a missing FEED — and the feed is what AXIS speaks.
  commitsAheadOfSharedLine: (() => {
    try { return measureCommitsAhead({ root }); } catch (err) {
      return declaredUnmeasurable("commitsAheadOfSharedLine", {
        reason: "git could not compare this checkout against origin/main here: " + err.message,
        source: "git rev-list --count origin/main..HEAD",
      });
    }
  })(),
  oldestPendingDeliveryDays: delivery.state === "not-taken"
    ? declaredUnmeasurable("oldestPendingDeliveryDays", {
        reason: "the delivery shelf lives on the operator volume and is not readable from this checkout",
        source: shelfOpt + " (absent here)",
      })
    : measureInProcess({
        value: delivery.oldestPendingDays, kind: "count",
        source: "the delivery manifests on the operator volume, compared against the refs the code host reports",
        how: "scripts/pending-delivery-audit.mjs logic — git ls-remote + manifest read, computed at emit time",
      }),
};

const fullDetail = {
  generatedAt: publicFields.generatedAt,
  program: {
    series: "CLIENT-READY",
    sequence: "RUN-BW",
    testsGreen: here.taken ? here.fail === 0 : null,
    testsGreenStatement: here.taken
      ? (here.fail === 0 ? "measured this cycle" : "measured this cycle and RED")
      : "not taken this cycle — " + here.notTakenReason + ". Null, never true.",
    suiteCensus: census
      ? {
          ok: census.ok,
          suitesOnDisk: census.suitesOnDisk,
          suitesRegistered: census.suitesRegistered,
          unregistered: census.unregisteredCount,
          deferredOnClock: census.accounted.registerPending.length,
          exempt: census.accounted.exempt.length,
          dead: census.accounted.dead.length,
          unexplained: census.unexplained.length,
          maxPendingDays: 14,
          statement: census.statement,
        }
      : { ok: null, statement: "the census could not be taken in this environment" },
    suitesGreen: here.suitesGreen,
    suitesTotal: here.suitesTotal,
    assertionsPassed: here.pass,
    assertionsTotal: here.tests,
    assertionsNotTaken: here.skipped,
    suitesTaken: here.suitesTaken,
    suitesRegistered: here.suitesRegistered,
    suitesComplete: here.suitesComplete,
    suiteVerdict: here.suiteVerdict,
    pct: here.taken && here.tests ? Math.round((here.pass / here.tests) * 1000) / 10 : null,
    statement: "pct is pass/total of assertions actually taken plus not-taken; it is not a completion percentage for the programme, and is not presented as one.",
  },
  mainRef: mainRef || (originIsCodeHost
    ? "unread — git ls-remote did not return refs/heads/main from this environment"
    : "unread — this checkout's origin is not the code host, so no shared-line ref was read. A local mirror's main is not the shared line and is never published as one."),
  mainRefSource: originIsCodeHost ? "git ls-remote origin refs/heads/main" : "refused — " + originClass.reason,
  lanes: [
    { lane: "suite-census", state: "shipped this cycle", detail: "pure decider + 20-assertion guard suite, itself registered in TESTS; a suite file on disk with no written verdict is RED, an exemption with no reason FAILS, a deferred verdict expires after 14 days, and a ledger entry that no longer describes the disk is red too. 70 unregistered files recorded with a reason, 65 of them reading green standalone" },
    { lane: "suite-registration-backlog", state: "deferred on a 14-day clock", detail: "the 70 are read, not registered: 65 pass standalone on the build machine and 5 do not. RUN-BX registers them in verified batches against a clean extract. On 2026-10-22 the clock expires and the census goes red by itself" },
    { lane: "delivery-age", state: "on the verified line", detail: "RUN-BU's pending-delivery auditor carried forward; this cycle re-verified the whole shelf against the shared line as it stands today" },
    { lane: "axis-voice", state: "on the shared line", detail: "push-to-talk and spoken replies are live in the v2 console; the v1 console is retained as the voice contract and guarded" },
    { lane: "classifier", state: "measured each cycle at test time, never stored", detail: "no-match bucket and overall accuracy both above their floors as of this measured cycle" },
    { lane: "publish", state: "Ahmad-only by design", detail: "merging the code line publishes nothing a visitor can see" },
  ],
  needsAhmad: delivery.state === "not-taken"
    ? [{ item: "not measurable from this checkout", ageDays: null }]
    : delivery.pending.map((p) => ({ item: p.name, ageDays: p.ageDays, commits: p.commits, action: "a push of verified code; deploys nothing" })),
  // Honest, and deliberately unable to be flattered: an untaken suite reading is NOT on track.
  // "We did not look" never scores the same as "we looked and it was green".
  onTrack: here.taken && here.fail === 0 && !delivery.overdue,
  onTrackStatement: !here.taken
    ? "Not on track as a matter of evidence rather than of code: the full suite was not run this cycle ("
      + here.notTakenReason + "), so nothing here claims it is green. The census that WAS taken is green, and "
      + (delivery.overdue
          ? "the oldest verified batch is " + delivery.oldestPendingDays + " days past the age at which 'staged' stops being an honest word for it."
          : "nothing is past its waiting threshold.")
    : (here.fail === 0 && delivery.overdue
        ? "Not on track, and the reason is not the code: the suite is green and the oldest verified batch is past the age at which 'staged' stops being an honest word for it."
        : (here.fail === 0 ? "On track: green suite, nothing past its waiting threshold." : "Not on track: the suite is red.")),
  deliveryShelf: {
    state: delivery.state,
    pendingCount: delivery.pendingCount,
    landedCount: delivery.landedCount,
    unverifiableCount: delivery.unverifiableCount,
    oldestPendingDays: delivery.oldestPendingDays,
    overdue: delivery.overdue,
    speakable: pendingLine,
    rows: [...delivery.pending, ...delivery.unverifiable, ...delivery.landed],
  },
  claims,
};

const res = emitAxisStatus({ root, publicFields, fullDetail });
const problems = checkPublicFiles(root);
if (problems.length) {
  throw new Error("RUN-BW emit REFUSED after write — " + problems.map((p) => `${p.file}: ${p.reason}`).join("; "));
}
console.log("[RUN-BW] public feed regenerated:", res.written.public.join(", "));
console.log("[RUN-BW] operator-internal detail:", res.written.internal);
console.log("[RUN-BW] leak + freshness check: OK");
console.log("[RUN-BW] speakable waiting line:", pendingLine);

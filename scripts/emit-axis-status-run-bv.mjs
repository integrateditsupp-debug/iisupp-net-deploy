#!/usr/bin/env node
// emit-axis-status-run-bv.mjs — RUN-BV.
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
import { auditDeliveries, speakablePendingLine } from "./lib/pending-delivery.mjs";

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
  if (reading.tests === null || reading.fail === null) {
    throw new Error(`RUN-BV emit REFUSED: the "${label}" reading produced no parsable assertion summary. A reading that was not taken is never published as a number.`);
  }
  if (reading.suiteVerdict === null) {
    throw new Error(`RUN-BV emit REFUSED: the "${label}" reading produced no parsable SUITE summary. The emitter will not publish a headline it cannot tell apart from an incomplete run.`);
  }
  return reading;
}

const here = runSuite("this checkout, as it stands");
console.log(`[RUN-BV] ${here.label}: ${here.pass}/${here.tests} pass · ${here.fail} fail · ${here.skipped} not taken · suites ${here.suitesTaken}/${here.suitesRegistered} (${here.suiteVerdict})`);
if (here.fail !== 0) {
  throw new Error(`RUN-BV emit REFUSED: ${here.fail} assertion(s) failed. A red build is never published as a green headline.`);
}
// RUN-BV — the new refusal. Zero failures is not the same fact as every check having been attempted,
// and this cycle proved the gap is seventeen assertions wide.
if (here.suitesComplete !== true) {
  throw new Error(`RUN-BV emit REFUSED: ${here.suitesTaken} of ${here.suitesRegistered} suites were taken. `
    + `Nothing failed, and that is not the same as everything passing. An incomplete run is never published as a green headline.`);
}

/* ── reading 2: the shared line, as the code host reports it ──────────────────────────────────── */
function readSharedLine() {
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
console.log(`[RUN-BV] delivery shelf: ${delivery.statement}`);

/* ── the public headline — sentences only, leak-scanned by the emitter ────────────────────────── */
const readings = `${here.pass} of ${here.tests} checks pass with none failing`;
const notTaken = here.skipped > 0
  ? ` ${here.skipped} checks read an operator-internal record that is absent here; those are reported as not taken rather than as passes.`
  : "";
const waiting = delivery.state === "not-taken"
  ? "Whether a verified batch is waiting on approval was not measurable in this environment, and is not reported as none."
  : (delivery.pendingCount
      ? `${delivery.pendingCount} verified ${delivery.pendingCount === 1 ? "batch" : "batches"} of work ${delivery.pendingCount === 1 ? "is" : "are"} waiting on an approval, the oldest for ${delivery.oldestPendingDays} days.`
      : "Nothing verified is waiting on an approval.");

const suiteLine = `${here.suitesTaken} of ${here.suitesRegistered} test suites were attempted and all of them passed`;

const publicFields = {
  status: "active build — a test count that can no longer shrink without saying so",
  milestone:
    "A clean copy of the shared line reported no failures over a smaller number of checks than the " +
    "same code reports here, because two groups of checks could not start and the summary counted " +
    "only the groups it reached. No failures and every check attempted are now reported as two " +
    "separate facts, and a run that skipped a group cannot be published as a clean one.",
  readiness:
    "Built and tested this cycle against the shared line as it stands today. " + suiteLine + "; " +
    readings + "." + notTaken + " " + waiting +
    " Publishing to the live site stays a deliberate manual step.",
  revenueToDate: "none",
  headline:
    "ARIA / AXIS is in active build and is voice-operable. Sent: 0. Meetings 0, revenue none. Checks " +
    "this cycle: " + suiteLine + "; " + readings + "." + notTaken + " " + waiting,
  note:
    "Public status headline only. Detailed build state is operator-internal and served only to " +
    "authenticated operators inside the AXIS command centre. This public feed never carries commit, " +
    "branch, or operator-script detail.",
  generatedAt: new Date().toISOString(),
};

/* ── the operator-internal half — specific, evidenced, and never public ───────────────────────── */
const claims = {
  testsPassedAfterWrites: measureInProcess({
    value: here.pass, kind: "count",
    source: "the assertion-level summary printed by the suite run this script performed",
    how: "npm test (ARIA Sentinel) — parsed '# pass' from the runner's own summary",
  }),
  suitesGreenAfterWrites: measureInProcess({
    value: here.suitesGreen, kind: "count",
    source: "the suite-level summary printed by the suite run this script performed",
    how: "npm test (ARIA Sentinel) — parsed 'N/N suites green.' from the runner's own summary",
  }),
  commitsAheadOfSharedLine: measureCommitsAhead({ root }),
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
    sequence: "RUN-BV",
    testsGreen: here.fail === 0,
    suitesGreen: here.suitesGreen,
    suitesTotal: here.suitesTotal,
    assertionsPassed: here.pass,
    assertionsTotal: here.tests,
    assertionsNotTaken: here.skipped,
    suitesTaken: here.suitesTaken,
    suitesRegistered: here.suitesRegistered,
    suitesComplete: here.suitesComplete,
    suiteVerdict: here.suiteVerdict,
    pct: here.tests ? Math.round((here.pass / here.tests) * 1000) / 10 : null,
    statement: "pct is pass/total of assertions actually taken plus not-taken; it is not a completion percentage for the programme, and is not presented as one.",
  },
  mainRef: mainRef || "unread — git ls-remote did not return refs/heads/main from this environment",
  lanes: [
    { lane: "suite-census", state: "shipped this cycle", detail: "pure decider + 12-assertion guard suite + runner rewired; a declared-but-absent package is unjudged, an undeclared one stays red, and the green line is no longer a tautology" },
    { lane: "delivery-age", state: "on the verified line", detail: "RUN-BU's pending-delivery auditor carried forward; this cycle re-verified the whole shelf against the shared line as it stands today" },
    { lane: "axis-voice", state: "on the shared line", detail: "push-to-talk and spoken replies are live in the v2 console; the v1 console is retained as the voice contract and guarded" },
    { lane: "classifier", state: "measured each cycle at test time, never stored", detail: "no-match bucket and overall accuracy both above their floors as of this measured cycle" },
    { lane: "publish", state: "Ahmad-only by design", detail: "merging the code line publishes nothing a visitor can see" },
  ],
  needsAhmad: delivery.state === "not-taken"
    ? [{ item: "not measurable from this checkout", ageDays: null }]
    : delivery.pending.map((p) => ({ item: p.name, ageDays: p.ageDays, commits: p.commits, action: "a push of verified code; deploys nothing" })),
  onTrack: here.fail === 0 && !delivery.overdue,
  onTrackStatement: here.fail === 0 && delivery.overdue
    ? "Not on track, and the reason is not the code: the suite is green and the oldest verified batch is past the age at which 'staged' stops being an honest word for it."
    : (here.fail === 0 ? "On track: green suite, nothing past its waiting threshold." : "Not on track: the suite is red."),
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
  throw new Error("RUN-BV emit REFUSED after write — " + problems.map((p) => `${p.file}: ${p.reason}`).join("; "));
}
console.log("[RUN-BV] public feed regenerated:", res.written.public.join(", "));
console.log("[RUN-BV] operator-internal detail:", res.written.internal);
console.log("[RUN-BV] leak + freshness check: OK");
console.log("[RUN-BV] speakable waiting line:", pendingLine);

#!/usr/bin/env node
// pending-delivery-audit.mjs — RUN-BU. The I/O half of scripts/lib/pending-delivery.mjs.
//
// Reads what is actually there: every delivery manifest on the operator volume, and the commit ids
// the code host reports for itself. Computes the age of anything verified but not yet on the shared
// line. Writes an operator-internal report, prints a speakable one-liner, and EXITS 1 when the
// oldest pending delivery is past the threshold — so a stall becomes a red in the flywheel instead
// of a sentence at the end of a report nobody re-reads.
//
// It reaches the network for exactly one read (`git ls-remote`, which needs no credential on a
// public host) and never writes to it. It sends nothing, pushes nothing, publishes nothing.
//
// Usage:
//   node scripts/pending-delivery-audit.mjs                 # audit, write report, exit 1 if overdue
//   node scripts/pending-delivery-audit.mjs --json          # machine-readable to stdout
//   node scripts/pending-delivery-audit.mjs --max-age 7     # change the threshold
//   node scripts/pending-delivery-audit.mjs --no-remote     # offline: remote unread -> unverifiable
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { auditDeliveries, speakablePendingLine, markContainment, DEFAULT_MAX_AGE_DAYS } from "./lib/pending-delivery.mjs";

const root = process.cwd();
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const DELIVERY_DIR = "senior-director-state/delivery";
const REPORT_JSON = path.join(DELIVERY_DIR, "PENDING-DELIVERY.json");
const REPORT_MD = path.join(DELIVERY_DIR, "PENDING-DELIVERY.md");
const maxAgeDays = Number(opt("--max-age", String(DEFAULT_MAX_AGE_DAYS)));

/* ── the commit ids the shared line holds ─────────────────────────────────────────────────────── */
function readRemoteShas() {
  if (flag("--no-remote")) return { shas: new Set(), read: false, why: "--no-remote was passed; the shared line was not read" };
  try {
    const out = execFileSync("git", ["ls-remote", "--heads", "--tags", "origin"], {
      cwd: root, encoding: "utf8", timeout: 120000, stdio: ["ignore", "pipe", "pipe"],
    });
    const shas = new Set(
      String(out).split("\n").map((l) => l.trim().split(/\s+/)[0]).filter((s) => /^[0-9a-f]{40}$/i.test(s)),
    );
    if (!shas.size) return { shas, read: false, why: "git ls-remote returned no refs" };
    return { shas, read: true, why: null };
  } catch (err) {
    return { shas: new Set(), read: false, why: `git ls-remote failed: ${String(err.message || err).split("\n")[0]}` };
  }
}

/* ── every delivery manifest on the shelf ─────────────────────────────────────────────────────── */
//
// A bundle with no manifest beside it is INCLUDED, deliberately, as a manifest-shaped record with no
// tip. The library then classifies it `unverifiable` with a reason. Skipping it would silently
// shrink the shelf, and a shelf that under-reports itself is the original defect wearing a hat.
function readDeliveries() {
  const dir = path.join(root, DELIVERY_DIR);
  if (!fs.existsSync(dir)) return null;
  let names;
  try { names = fs.readdirSync(dir); } catch { return null; }

  const manifests = names.filter((n) => n.endsWith(".manifest.json"));
  const bundles = names.filter((n) => n.endsWith(".bundle"));
  const out = [];
  const covered = new Set();

  for (const n of manifests) {
    const p = path.join(dir, n);
    let m = null;
    try { m = JSON.parse(fs.readFileSync(p, "utf8")); } catch { m = null; }
    if (!m || typeof m !== "object") {
      out.push({ name: n, tip: null, generatedAt: null, note: "manifest present but unparsable" });
      continue;
    }
    m.name = m.name || n.replace(/\.manifest\.json$/, "");
    out.push(m);
    const b = typeof m.bundle === "string" ? path.basename(m.bundle) : null;
    if (b) covered.add(b);
    covered.add(n.replace(/\.manifest\.json$/, ".bundle"));
  }

  for (const b of bundles) {
    if (covered.has(b)) continue;
    // A bundle with no manifest is not a dead end: the bundle itself records its own heads, and the
    // file records its own mtime. Both are reads, not typings. This was written after the audit
    // found RUN-BT's own delivery sitting on the shelf as `unverifiable` because nobody had written
    // a manifest beside it - the exact shape of blindness this module exists to remove.
    const full = path.join(dir, b);
    let bytes = null;
    let mtime = null;
    try { const st = fs.statSync(full); bytes = st.size; mtime = st.mtime.toISOString(); } catch { /* unreadable stat is not a number */ }
    let tip = null;
    let why = "a bundle with no manifest beside it, and its heads could not be read";
    try {
      const heads = execFileSync("git", ["bundle", "list-heads", full], {
        cwd: root, encoding: "utf8", timeout: 60000, stdio: ["ignore", "pipe", "pipe"],
      });
      const rows = String(heads).split("\n").map((l) => l.trim()).filter(Boolean)
        .map((l) => l.split(/\s+/)).filter((c) => /^[0-9a-f]{40}$/i.test(c[0] || ""));
      if (rows.length) { tip = rows[0][0]; why = null; }
    } catch { /* an unreadable bundle stays unverifiable, with the reason above */ }
    out.push({ name: b, tip, generatedAt: mtime, bytes,
      note: tip
        ? "tip read from the bundle's own heads; age taken from the file's modification time rather than a recorded build stamp"
        : why });
  }

  return out;
}

/* ── run ──────────────────────────────────────────────────────────────────────────────────────── */
const remote = readRemoteShas();
const deliveries = readDeliveries();
const audit = auditDeliveries({ deliveries, remoteShas: remote.shas, now: new Date(), maxAgeDays });

// The remote read is part of the evidence, not a footnote: if it failed, every "pending" below could
// in fact already be landed, and the report has to say so rather than quietly read as authoritative.
audit.sharedLineRead = remote.read;
audit.sharedLineRefsSeen = remote.shas.size;
if (!remote.read) {
  audit.caveat = `The shared line was NOT read (${remote.why}). Nothing below distinguishes "not landed" from "not checked", so every row is advisory until a read succeeds.`;
}
// Is one pending delivery already carried inside another? `git merge-base --is-ancestor` answers it
// when the objects are present locally, and is allowed to answer "I cannot tell" when they are not.
// Exit 0 = ancestor, 1 = provably not, anything else = undeterminable (missing object, bad ref).
function isAncestor(a, b) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", a, b], { cwd: root, timeout: 60000, stdio: "ignore" });
    return true;
  } catch (err) {
    return err && err.status === 1 ? false : null;
  }
}
if (audit.state === "taken" && audit.pending.length > 1) {
  const c = markContainment(audit.pending, isAncestor);
  audit.pending = c.rows;
  audit.pendingDistinct = c.distinct.map((r) => r.name);
  audit.clicksNeeded = c.clicksNeeded;
  const unknown = c.rows.filter((r) => r.containmentUnknown && !r.containedIn).length;
  audit.containmentStatement = `${audit.pendingCount} pending, but ${c.clicksNeeded} ${c.clicksNeeded === 1 ? "push clears" : "pushes clear"} ${c.clicksNeeded === 1 ? "all of them" : "the shelf"}${unknown ? `; ${unknown} could not be proven contained from the objects present here and is counted standalone rather than collapsed` : ""}.`;
} else if (audit.state === "taken") {
  audit.pendingDistinct = audit.pending.map((r) => r.name);
  audit.clicksNeeded = audit.pending.length;
}
audit.speakable = speakablePendingLine(audit);

if (flag("--json")) {
  process.stdout.write(JSON.stringify(audit, null, 1) + "\n");
} else {
  console.log(`[pending-delivery] ${audit.statement}`);
  if (audit.caveat) console.log(`[pending-delivery] CAVEAT — ${audit.caveat}`);
  if (audit.containmentStatement) console.log(`[pending-delivery] ${audit.containmentStatement}`);
  for (const r of audit.pending) console.log(`  ${r.containedIn ? "pending (carried inside " + r.containedIn + ")" : "PENDING"}      ${r.ageDays}d  ${r.name}${r.commits ? ` (${r.commits} commits)` : ""}`);
  for (const r of audit.unverifiable) console.log(`  UNVERIFIABLE  --  ${r.name} — ${r.reason}`);
  for (const r of audit.landed) console.log(`  landed            ${r.name}`);
  console.log(`[pending-delivery] speakable: ${audit.speakable}`);
}

if (deliveries !== null) {
  try {
    fs.mkdirSync(path.join(root, DELIVERY_DIR), { recursive: true });
    fs.writeFileSync(path.join(root, REPORT_JSON), JSON.stringify(audit, null, 1) + "\n");
    const lines = [
      "# PENDING DELIVERY — how long verified work has been waiting on a click",
      "",
      `Taken ${audit.generatedAt}. Threshold: ${maxAgeDays} days. Shared line read: ${audit.sharedLineRead ? `yes (${audit.sharedLineRefsSeen} refs)` : "NO"}.`,
      "",
      audit.statement,
      "",
      audit.caveat ? `> CAVEAT — ${audit.caveat}\n` : "",
      "| state | age | delivery | commits | note |",
      "| --- | --- | --- | --- | --- |",
      ...audit.pending.map((r) => `| **PENDING** | ${r.ageDays}d | ${r.name} | ${r.commits ?? "—"} | waiting on a push |`),
      ...audit.unverifiable.map((r) => `| UNVERIFIABLE | — | ${r.name} | ${r.commits ?? "—"} | ${r.reason} |`),
      ...audit.landed.map((r) => `| landed | — | ${r.name} | ${r.commits ?? "—"} | held by the shared line |`),
      "",
      "Written by `scripts/pending-delivery-audit.mjs`. It takes its own reading every run; no number here is typed by hand. A delivery is only called landed on positive evidence that the shared line holds its tip commit.",
      "",
    ];
    fs.writeFileSync(path.join(root, REPORT_MD), lines.filter((l) => l !== "").join("\n") + "\n");
    console.log(`[pending-delivery] report written: ${REPORT_MD}`);
  } catch (err) {
    console.error(`[pending-delivery] report NOT written: ${String(err.message || err).split("\n")[0]}`);
  }
}

if (audit.overdue) {
  console.error(`\n[pending-delivery] RED — the oldest verified-but-unlanded delivery is ${audit.oldestPendingDays} days old, past the ${maxAgeDays}-day threshold. This is the fifty-six-day class: staged, true, and unreported. It is a red so the next cycle cannot roll past it.`);
  process.exitCode = 1;
}

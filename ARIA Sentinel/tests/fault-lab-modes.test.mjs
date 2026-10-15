// FAULT LAB (2026-10-14) — the same faults in all three modes, observed on the simulated Windows machine against the
// REAL main.mjs, and the MODE × LEVEL behaviour matrix WRITTEN FROM WHAT ACTUALLY HAPPENED (never hand-written):
//   manual      — preview only: nothing changes on its own (every detection waits as an approval request), and the
//                 preview channel (sentinel:run-recipe) logs a dry-run and changes nothing.
//   confirmed   — no notices. EVERY detection asks ONCE (one approval, one click on the globe card / Home row); approve →
//                 it runs through the same gates and changes EXACTLY its keys (or fails honestly, or has nothing to apply);
//                 deny → identical. (REVIEW P1-1, 2026-10-14 — the owner's decision: Confirmed asks once, every time, and
//                 never executes unattended; it used to run a vetted green fix on its own and hold a not-yet-vetted one.)
//   autonomous  — the advise-three-times rule (proven in depth by tests/fault-lab-autonomous.test.mjs).
// Trust is a dimension of its own: every fault runs on a FRESH install (nothing vetted locally) and on a TRUSTED one (its
// recipe has earned 12 vetted runs — Tier 1, the minimum the execution policy needs before anything runs unattended).
// 2026-10-14 (defect 4) — on a fresh install a VENDOR-VETTED green recipe (gating verify probe + declared inverse:
// recipe-runner isVendorVetted) starts at that same Tier-1 floor; every other recipe still starts unvetted.
// It prints the matrix and writes docs/MODE-BEHAVIOUR-MATRIX.md (dated, naming this test).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { bootLab, FAULTS, faultById, diff, isReadOnlyProbe } from "./lib/fault-lab.mjs";
import { PRIVATE_FOLDER_NAME } from "../src/shared/path-guard.mjs";
import { isVendorVetted, NOT_RESOLVED } from "../src/shared/recipe-runner.mjs";

const MIN = 60 * 1000;
const TRUSTED = Object.fromEntries([...new Set(FAULTS.map((f) => f.recipe))].map((id) => [id, 12]));
const TRUST = { fresh: {}, trusted: TRUSTED };
const MODES = ["manual", "confirmed", "autonomous"];
const LEVELS = ["L1", "L2", "L3"];
// 2026-10-14 (defect 3) — the gating verify probes are read-only too (isReadOnlyProbe reads VERIFY_COMMANDS).
const mutating = (lab) => lab.machine.commands.filter((c) => !isReadOnlyProbe(c.cmd) && !/^Checkpoint-Computer/.test(c.cmd));
const rows = (lab, tag, re) => lab.audit().filter((r) => r.tag === tag && (!re || re.test(r.text)));
let groups = 0; const g = () => { groups++; };
let scenarios = 0;

function keysWithin(changed, f, label) {
  const allowed = new Set(f.fixKeys);
  for (const k of changed) assert.ok(allowed.has(k), `${label}: changed ${k}, outside what its fix may change`);
}
function clean(lab, label) {
  assert.deepEqual(lab.machine.unknownCommands, [], `${label}: no unknown command`);
  assert.deepEqual(lab.machine.violations, [], `${label}: excluded folder never referenced`);
  assert.deepEqual(lab.clock.errors.map(String), [], `${label}: no timer threw`);
  assert.ok(!lab.capturedText().includes(PRIVATE_FOLDER_NAME), `${label}: excluded folder name never echoed`);
}
async function start(f, mode, opts = {}) {
  const lab = await bootLab({ mode, vetted: TRUSTED, interval: 3, window: Boolean(f.needsWindow), preBaseline: [f.id], ...opts });
  lab.inject(f.id);
  const before = lab.machine.snapshot();
  await lab.detect({ person: f.report === "person" ? [f.id] : [] });
  scenarios++;
  return { lab, before, changed: () => diff(before, lab.machine.snapshot()) };
}

/** What actually happened, in plain words — derived ONLY from the lab's observations of the real main process. */
function matrixPhraseOf(lab, f, changed) { return describe(lab, f, changed); }
function describe(lab, f, changed) {
  const notices = lab.audit().filter((r) => r.tag === "ADVISORY" && /^ADVISORY \d\/3: /.test(r.text) && r.recipeId === f.recipe).length;
  const autoFix = rows(lab, "AUTO-FIX").some((r) => r.recipeId === f.recipe);
  const escalated = rows(lab, "ESCALATE").some((r) => r.recipeId === f.recipe);
  const fixRows = rows(lab, "FIX").filter((r) => r.recipeId === f.recipe);
  const done = fixRows.some((r) => r.outcome === "done");
  const failed = fixRows.some((r) => r.outcome === "failed");
  const approval = lab.state().approvals.pending.some((a) => a.recipeId === f.recipe);
  const detected = rows(lab, "DETECT").some((r) => r.recipeId === f.recipe);
  const ch = changed.length ? `changed: ${changed.join(", ")}` : "nothing changed";
  if (!detected) return "not detected — nothing happens";
  // Ground truth beats the claim: the lab knows whether the fault is really gone.
  const truly = f.resolved(lab.machine);
  // 2026-10-14 (defect 3) — a fix whose GATING verify failed is NOT RESOLVED: say exactly that (it ran; it is not fixed).
  const notResolved = fixRows.some((r) => r.resolution === NOT_RESOLVED);
  if (notices && autoFix && notResolved) return `${notices} notices → fix ran; its check says the problem is still there → not resolved → IT contact told (${ch})`;
  if (notResolved && !notices) return `ran on its own after the 10-s countdown; its check says the problem is still there → not resolved, a person is told (${ch})`;
  if (notices && autoFix && done && !truly) return `${notices} notices → ARIA reports it fixed and verified, but the root cause is still there (${ch})`;
  if (done && !notices && !truly) return `ran on its own; ARIA reports it fixed and verified, but the root cause is still there (${ch})`;
  if (notices && autoFix && done) return `${notices} notices → fixed on its own after the 10-s countdown (${ch})`;
  if (notices && autoFix && failed) return `${notices} notices → fix attempted, failed honestly (${ch})`;
  if (notices && escalated) return `${notices} notices → IT contact told, never run${approval ? " (+ waits as an approval)" : ""} (${ch})`;
  if (done && !notices) return `ran on its own after the 10-s countdown, no notices (${ch})`;
  if (failed && !notices) return `ran on its own, failed honestly (${ch})`;
  if (approval) return `asked once (an approval waits) — ${ch}`;
  return `noted only — ${ch}`;
}

const matrix = {}; // fault id → { mode → { fresh, trusted } }
const extra = {};  // fault id → { manual | approve | deny → phrase } for the human actions

// ── 1 — every fault, every mode, fresh AND trusted, nobody answering ─────────────────────────────────────────────────
for (const f of FAULTS) {
  matrix[f.id] = {};
  for (const mode of MODES) {
    matrix[f.id][mode] = {};
    for (const [trust, vetted] of Object.entries(TRUST)) {
      const s = await start(f, mode, { vetted });
      await s.lab.minutes(40);
      const changed = s.changed();
      const label = `${mode}/${trust} ${f.id}`;
      matrix[f.id][mode][trust] = describe(s.lab, f, changed);
      keysWithin(changed, f, label);
      const notices = rows(s.lab, "ADVISORY", /^ADVISORY \d\/3: /).length;
      if (mode === "manual") {
        assert.deepEqual(changed, [], `${label}: manual never changes the machine on its own`);
        assert.equal(mutating(s.lab).length, 0, `${label}: nothing ran`);
        assert.equal(notices, 0, `${label}: manual never escalates`);
      }
      // 2026-10-14 (defect 4) — EXPECTATIONS CHANGED ON PURPOSE for vendor-vetted recipes (dns-fail-v1, svc-dhcp-stopped-v1):
      // a fresh install starts them at the Tier-1 floor, so they behave like the trusted column — in AUTONOMOUS only (review
      // P1-1: the floor belongs to the advise-three-times track).
      const vendor = isVendorVetted(f.recipe);
      if (mode === "confirmed") {
        // 2026-10-14 (review P1-1) — EXPECTATIONS CHANGED ON PURPOSE: Confirmed asks once, every time, and never executes
        // unattended — for every fault, every colour, fresh or trusted, vendor-vetted or not. (It used to run a vetted green
        // fix on its own after the countdown and silently hold a not-yet-vetted one.)
        assert.equal(notices, 0, `${label}: the advise-three-times rule is Autonomous-only`);
        assert.equal(rows(s.lab, "AUTO-FIX").length, 0, `${label}: no advisory auto-fix in Confirmed`);
        const asks = s.lab.state().approvals.pending.filter((a) => a.recipeId === f.recipe);
        assert.equal(asks.length, 1, `${label}: asked ONCE (one approval waits)`);
        assert.equal(asks[0].reason, "confirmed-asks-once", `${label}: …because Confirmed asks once`);
        assert.deepEqual(changed, [], `${label}: nothing changed without a yes`);
        assert.equal(mutating(s.lab).length, 0, `${label}: nothing ran unattended`);
        assert.equal(matrixPhraseOf(s.lab, f, changed), "asked once (an approval waits) — nothing changed", `${label}: the matrix row reads "asked once"`);
      }
      if (mode === "autonomous") {
        if (f.path === "escalate" || f.path === "guide-only") assert.deepEqual(changed, [], `${label}: identical`);
        if ((f.path === "auto-fix" || f.path === "not-resolved") && (trust === "trusted" || vendor)) assert.ok(changed.length > 0, `${label}: the fix ran after 3 notices`);
        if (trust === "fresh" && !vendor) assert.deepEqual(changed, [], `${label}: a fresh install never runs an unvetted fix on its own — it escalates`);
        if (f.path === "not-resolved") assert.ok(rows(s.lab, "ESCALATE", /not resolved/).some((r) => r.recipeId === f.recipe), `${label}: not resolved → the IT contact`);
        if (f.path !== "guide-only") assert.equal(notices, 3, `${label}: exactly 3 notices`);
      }
      assert.equal(s.lab.machine.uacPrompts.length, 0, `${label}: nobody answered, so nothing ever asked for elevation`);
      clean(s.lab, label);
    }
  }
}
g();

// ── 2 — manual: the preview channel logs a dry-run and changes nothing ───────────────────────────────────────────────
for (const f of FAULTS.filter((x) => x.path !== "guide-only")) {
  const s = await start(f, "manual");
  const r = await s.lab.ipc.invoke("sentinel:run-recipe", f.recipe, {});
  await s.lab.clock.settle();
  assert.equal(r.dryRun, true, `manual preview ${f.id}: a dry-run`);
  assert.ok(rows(s.lab, "RUN", /^Dry-run recipe /).length === 1, `manual preview ${f.id}: the preview is logged`);
  assert.deepEqual(s.changed(), [], `manual preview ${f.id}: nothing changed`);
  assert.equal(mutating(s.lab).length, 0);
  (extra[f.id] ||= {}).manual = "preview → dry-run logged, nothing changed";
  clean(s.lab, `manual preview ${f.id}`);
}
g();

// ── 3 — confirmed: asks once; approve → exactly its keys (or an honest failure); deny → identical ─────────────────────
// 2026-10-14 (review P1-1) — every fault asks once in Confirmed now, so EVERY fault's approve / deny is observed here (it
// used to be the needs-admin ones only); the "When a person acts" table is therefore never "no approval asked".
for (const f of FAULTS) {
  for (const decision of ["approve", "deny"]) {
    const s = await start(f, "confirmed", { vetted: TRUSTED });
    await s.lab.minutes(1);
    const pending = s.lab.state().approvals.pending.filter((a) => a.recipeId === f.recipe);
    assert.equal(pending.length, 1, `confirmed ${f.id}: one approval`);
    const r = await s.lab[decision](pending[0].id);
    assert.equal(r.ok, true);
    await s.lab.minutes(2);
    const changed = s.changed();
    const label = `confirmed ${decision} ${f.id}`;
    if (decision === "deny") {
      assert.deepEqual(changed, [], `${label}: identical`);
      assert.equal(mutating(s.lab).length, 0, `${label}: never executed`);
      (extra[f.id] ||= {}).deny = "deny → nothing changed";
    } else {
      keysWithin(changed, f, label);
      if (f.needsAdmin) assert.ok(s.lab.machine.uacPrompts.length >= 1, `${label}: the approved run asked Windows (UAC) — the person's click`);
      else assert.equal(s.lab.machine.uacPrompts.length, 0, `${label}: a user-space fix never asks for elevation`);
      const fixRows = rows(s.lab, "FIX").filter((x) => x.recipeId === f.recipe);
      const notResolved = fixRows.some((x) => x.resolution === NOT_RESOLVED);
      if (f.resolved(s.lab.machine) && changed.length) {
        const required = f.fixKeys.filter((k) => !(f.optionalKeys || []).includes(k));
        for (const k of required) assert.ok(changed.includes(k), `${label}: changed ${k}`);
        (extra[f.id] ||= {}).approve = `approve → fixed (${changed.join(", ")})`;
      } else if (notResolved) {
        assert.ok(!f.resolved(s.lab.machine), `${label}: not resolved is the truth`);
        (extra[f.id] ||= {}).approve = `approve → ran; its check says the problem is still there → not resolved (${changed.length ? "changed: " + changed.join(", ") : "nothing changed"})`;
      } else if (fixRows.some((x) => x.outcome === "failed")) {
        assert.deepEqual(changed, [], `${label}: an unfixable fault changes nothing`);
        (extra[f.id] ||= {}).approve = `approve → attempted${f.needsAdmin ? " with UAC" : ""}, failed honestly (nothing changed)`;
      } else if (rows(s.lab, "RESTORE PT", /restore point unavailable on this platform\/account — yellow-tier actions stay in preview/).some((x) => x.recipeId === f.recipe)) {
        // a yellow fix on the standard token: no verified restore point → held in preview (never a change without one).
        assert.deepEqual(changed, [], `${label}: a yellow fix without a restore point changes nothing`);
        (extra[f.id] ||= {}).approve = "approve → held in preview: no restore point could be made on this account (nothing changed)";
      } else {
        // a guide or a red problem: nothing ARIA can apply — the approval previews it and changes nothing.
        assert.deepEqual(changed, [], `${label}: a guide / red problem changes nothing`);
        assert.equal(mutating(s.lab).length, 0, `${label}: nothing ran`);
        (extra[f.id] ||= {}).approve = "approve → nothing ARIA can apply (a guide or a person's job) — nothing changed";
      }
    }
    clean(s.lab, label);
  }
}
g();

// ── 4 — every L3 fault, every mode: never executed without an explicit approval ─────────────────────────────────────
for (const f of FAULTS.filter((x) => x.level === "L3")) {
  for (const mode of MODES) {
    const s = await start(f, mode);
    await s.lab.minutes(4 * 60);
    const label = `L3 ${mode} ${f.id}`;
    if (f.l3FixNeverRuns) assert.ok(!s.lab.machine.commands.some((c) => f.l3FixNeverRuns.test(c.cmd)), `${label}: the L3 fix never ran`);
    if (f.rootKeys) for (const k of f.rootKeys) assert.ok(!s.changed().includes(k), `${label}: root cause ${k} untouched`);
    // (2026-10-14, defect 3) a not-resolved fault gets the user-space DNS refresh (its symptom); its root key is checked above.
    if (f.path !== "auto-fix" && f.path !== "not-resolved") { assert.deepEqual(s.changed(), [], `${label}: identical`); assert.equal(mutating(s.lab).length, 0, `${label}: nothing ran`); }
    clean(s.lab, label);
  }
}
g();

// ── 5 — the matrix: printed and written, generated from the observations above ───────────────────────────────────
const strip = (p) => p.replace(/\((changed: [^)]*|nothing changed)\)/, "").replace(/ — (changed: .*|nothing changed)$/, "").trim();
const byModeLevel = {};
for (const mode of MODES) for (const trust of Object.keys(TRUST)) for (const level of LEVELS) {
  const phrases = new Map();
  for (const f of FAULTS.filter((x) => x.level === level)) {
    const p = strip(matrix[f.id][mode][trust]);
    phrases.set(p, [...(phrases.get(p) || []), f.id]);
  }
  byModeLevel[`${mode}|${trust}|${level}`] = [...phrases.entries()].map(([p, ids]) => `${p} [${ids.join(", ")}]`);
}
const today = new Date().toISOString().slice(0, 10);
const esc = (x) => String(x).replace(/\|/g, "\\|");
const lines = [];
lines.push("# Mode × level behaviour matrix — ARIA Sentinel fault lab");
lines.push("");
lines.push(`Generated ${today} by \`tests/fault-lab-modes.test.mjs\` from ${scenarios} scenarios run on the simulated Windows machine (\`tests/lib/fault-lab.mjs\`) against the real \`src/main/main.mjs\` (booted by \`tests/lib/main-sandbox.mjs\`). Every cell is what the lab OBSERVED; the test run rewrites this file — it is never edited by hand.`);
lines.push("");
lines.push("Setup: live fixes ON · a business device with one IT contact · the advise-first interval at 3 minutes · nobody answering anything · 40 minutes of (virtual) time · Sentinel on the standard user token (administrator rights only through a UAC prompt a person answers). **fresh** = nothing vetted locally yet (a new install) — except that, on Autonomous mode's advise-three-times track, a **vendor-vetted** green recipe (it ships a gating verify probe and a declared inverse) starts at the Tier-1 floor; **trusted** = the fault's recipe has earned 12 vetted runs (Tier 1, the minimum the execution policy requires before anything runs unattended). **Confirmed asks once, every time, and never executes unattended** (review P1-1): every Confirmed cell is one approval waiting.");
lines.push("");
lines.push("## Mode × level");
lines.push("");
lines.push(`| Mode | Trust | ${LEVELS.join(" | ")} |`);
lines.push(`|---|---|${LEVELS.map(() => "---").join("|")}|`);
for (const mode of MODES) for (const trust of Object.keys(TRUST)) lines.push(`| **${mode}** | ${trust} | ${LEVELS.map((l) => byModeLevel[`${mode}|${trust}|${l}`].map(esc).join("<br>")).join(" | ")} |`);
lines.push("");
lines.push("Levels: **L1** reversible user-level · **L2** service / network · **L3** admin / irreversible / red.");
lines.push("");
lines.push("## Every fault, every mode (nobody answering)");
lines.push("");
lines.push("| Fault | Level | Recipe (real detection path) | Colour | Needs admin | Vendor-vetted | manual | confirmed | autonomous |");
lines.push("|---|---|---|---|---|---|---|---|---|");
const cell = (f, mode) => `fresh: ${esc(matrix[f.id][mode].fresh)}<br>trusted: ${esc(matrix[f.id][mode].trusted)}`;
for (const f of FAULTS) lines.push(`| ${esc(f.title)} (\`${f.id}\`) | ${f.level} | \`${f.recipe}\` | ${f.color} | ${f.needsAdmin ? "yes" : "no"} | ${isVendorVetted(f.recipe) ? "yes" : "no"} | ${cell(f, "manual")} | ${cell(f, "confirmed")} | ${cell(f, "autonomous")} |`);
lines.push("");
lines.push("## When a person acts (trusted device)");
lines.push("");
lines.push("| Fault | manual: preview | confirmed: approve | confirmed: deny |");
lines.push("|---|---|---|---|");
for (const f of FAULTS) { const x = extra[f.id] || {}; lines.push(`| \`${f.id}\` | ${esc(x.manual || "—")} | ${esc(x.approve || "— (no approval asked)")} | ${esc(x.deny || "—")} |`); }
lines.push("");
lines.push("## Known gaps the lab exposes (reported, not encoded as passes)");
lines.push("");
for (const f of FAULTS.filter((x) => x.gap)) lines.push(`- **${f.id}** — ${f.gap}`);
lines.push("");
lines.push("Regenerate: `node tests/fault-lab-modes.test.mjs` (it also runs inside `node tests/run-all.mjs`).");
lines.push("");
const md = lines.join("\n");
const out = path.join(import.meta.dirname, "..", "docs", "MODE-BEHAVIOUR-MATRIX.md");
fs.writeFileSync(out, md);
assert.equal(fs.readFileSync(out, "utf8"), md, "the matrix was written");
assert.ok(!md.includes(PRIVATE_FOLDER_NAME), "the matrix never names the excluded folder");
for (const key of Object.keys(byModeLevel)) assert.ok(byModeLevel[key].length >= 1, `matrix cell ${key} observed`);
g();

assert.equal(groups, 5);
console.log(`fault-lab-modes test passed (${groups} groups · ${scenarios} scenarios · ${FAULTS.length} faults × ${MODES.length} modes × fresh/trusted · manual = preview only · confirmed asks once when vetted (approve → exact keys / deny → identical) · L3 never executed · matrix written to docs/MODE-BEHAVIOUR-MATRIX.md).`);
console.log("\nMode × level (observed):");
for (const mode of MODES) for (const trust of Object.keys(TRUST)) for (const level of LEVELS) console.log(`  ${mode.padEnd(10)} ${trust.padEnd(7)} ${level}: ${byModeLevel[`${mode}|${trust}|${level}`].join(" ; ")}`);

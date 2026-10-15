// FAULT LAB (2026-10-14) — SOAK: 200 seeded random sequences of 1–6 mixed faults on the simulated Windows machine,
// Autonomous mode, against the REAL main.mjs. Each sequence picks (from its seed) the faults, Sentinel's token profile
// (standard / elevated agent), whether a maintenance window is open, whether the detection input is poisoned with an
// excluded-folder path, and — for some sequences — a person pressing Fix now / Not now / Never on one notice. Then six
// hours of virtual time run. After EVERY sequence the invariants are checked:
//   1 every L1/L2 auto-fix fault nobody acted on is FIXED (its fix applied and verified)
//   2 every L3 fault (and every fault a person did not fix) is UNTOUCHED (its root-cause keys unchanged)
//   3 no key outside the union of the intended keys of the fixes that ran changed (a restore point is protective)
//   4 no excluded-folder path / name ever appears in any audit · notify · outbound · window · state string
//   5 the executor never changed anything without a PRIOR "AUTO-FIX after 3 advisories" or a person's action for that recipe
//   6 a verified restore point exists before any yellow fix touches the machine
//   + every no-answer round showed exactly 3 notices · nothing unknown was ever run · every escalation ended
// A failure names its seed (re-run one: SOAK_SEED=<seed> node tests/fault-lab-soak.test.mjs).
import assert from "node:assert/strict";
import { bootLab, faultById, pickRandomFaults, mulberry32, diff, healthyState, isReadOnlyProbe } from "./lib/fault-lab.mjs";
import { RECIPES } from "../src/shared/recipes.mjs";
import { YELLOW_RECIPES, NOT_RESOLVED } from "../src/shared/recipe-runner.mjs";
import { TIER0_COMMANDS } from "../src/main/tier-0-executor.mjs";
import { PRIVATE_FOLDER_NAME, PRIVATE_FOLDER_RE } from "../src/shared/path-guard.mjs";

const MIN = 60 * 1000;
const TICK = 15 * 1000;
const SEED0 = 20261014;
const RUNS = process.env.SOAK_SEED ? 1 : 200;
const VETTED = { "dns-fail-v1": 12, "svc-dnscache-stopped-v1": 12 };
// 2026-10-14 (defect 3) — the gating verify probes are read-only too: "is this a probe?" comes from VERIFY_COMMANDS
// (tests/lib/fault-lab.mjs isReadOnlyProbe), so invariant 5 never mistakes a verify for an unowned change.
const GUARD = /;\s*if\(-not \$\?\)\{exit 1\}/g;

// Which recipe(s) own a command — read from the registry + the executor bindings (the commands actually issued).
const OWNERS = new Map();
const own = (cmd, id) => { const k = String(cmd).replace(GUARD, "").trim(); OWNERS.set(k, [...new Set([...(OWNERS.get(k) || []), id])]); };
for (const r of RECIPES) for (const a of r.actions || []) if (a.shell === "powershell" && a.command) own(a.command, r.id);
for (const [id, spec] of Object.entries(TIER0_COMMANDS)) own(spec.command, id);
const ownersOf = (cmd) => OWNERS.get(String(cmd).replace(GUARD, "").trim()) || [];

const stats = { runs: 0, faults: 0, fixed: 0, escalated: 0, failedHonestly: 0, notResolved: 0, untouched: 0, personFixNow: 0, personNotNow: 0, personNever: 0, poisoned: 0, elevatedProfile: 0, notices: 0, commands: 0, byLevel: { L1: 0, L2: 0, L3: 0 } };
const failures = [];

async function sequence(seed) {
  const rnd = mulberry32(seed * 7919 + 13);
  const count = 1 + Math.floor(rnd() * 6);
  const ids = pickRandomFaults(seed, count);
  const profile = rnd() < 0.5 ? "standard" : "elevated-agent";
  const window = rnd() < 0.5;
  const poisoned = rnd() < 0.3;
  const actRoll = rnd();
  const action = actRoll < 0.2 ? "fix-now" : actRoll < 0.3 ? "not-now" : actRoll < 0.38 ? "never" : null;
  const actOn = action ? ids[Math.floor(rnd() * ids.length)] : null;
  const actAt = 1 + Math.floor(rnd() * 3);
  const lab = await bootLab({ vetted: VETTED, interval: 3, window, profile, preBaseline: ids });
  const injectedIds = lab.injectRandom(seed, count);
  assert.deepEqual(injectedIds, ids, "injectRandom is reproducible from its seed");
  const base = healthyState();
  for (const id of ids) { const f = faultById(id); if (f.preBaseline) f.preBaseline(base); }
  const before = lab.machine.snapshot();
  const person = ids.filter((id) => faultById(id).report === "person");
  const poison = poisoned ? `C:\\Users\\Sam\\Pictures\\${PRIVATE_FOLDER_NAME}\\IMG_0007.jpg` : null;
  await lab.detect({ person, poison });
  const label = `seed ${seed} [${ids.join(", ")}] ${profile}${window ? " +window" : ""}${poisoned ? " +poison" : ""}${action ? ` +${action}@${actAt} on ${actOn}` : ""}`;

  // A person acts on one notice (when the seed says so) — the only human input in the sequence.
  const actedRecipe = actOn ? faultById(actOn).recipe : null;
  if (action) {
    for (let i = 0; i < 60; i++) {
      const rec = lab.advisories().find((a) => a.recipeId === actedRecipe && a.status === "advising");
      if (rec && rec.advisory >= actAt) { const r = await lab.ack(rec.id, action); assert.equal(r.ok, true, `${label}: ack`); lab.humanActions.at(-1).recipeId = actedRecipe; break; }
      if (!rec && i > 0) break;
      await lab.advance(TICK);
    }
  }
  // Long enough for every round to end: 3 notices (9 min) + the 30-minute gap between automatic fixes for each auto-fix
  // recipe — and, after a "Not now", the 4-hour snooze plus a fresh round.
  await lab.minutes(action === "not-now" ? 5 * 60 + 30 : 100);
  const after = lab.machine.snapshot();
  const changed = diff(before, after);
  const audit = lab.audit();
  const acted = new Set(lab.humanActions.filter((h) => h.kind === "ack" && h.choice === "fix-now").map((h) => h.recipeId));

  // Which fixes really ran (a FIX row for the recipe) → the keys they were allowed to change.
  const ran = new Set(audit.filter((r) => r.tag === "FIX" && (r.outcome === "done" || r.outcome === "failed")).map((r) => r.recipeId));
  const allowed = new Set(["restorePoints"]); // protective: a verified restore point may be made before any live fix
  for (const id of ids) { const f = faultById(id); if (ran.has(f.recipe)) for (const k of f.fixKeys) allowed.add(k); }

  // 3 — nothing outside the intended keys.
  for (const k of changed) assert.ok(allowed.has(k), `${label}: ${k} changed but no fix that ran may change it (changed: ${changed.join(", ")})`);

  for (const id of ids) {
    const f0 = faultById(id);
    // A yellow fault is only considered inside a maintenance window; outside one the rule does not take it (held, no notices).
    const f = f0.needsWindow && !window ? { ...f0, path: "held" } : f0;
    stats.faults++; stats.byLevel[f.level]++;
    const rootKeys = f.rootKeys || diff(base, before).filter((k) => !/^(eventLog|werReports|minidumps)/.test(k) && FAULT_KEYS(f).some((p) => k === p || k.startsWith(p + ".")));
    const personFixed = acted.has(f.recipe);
    const neverOrSnooze = actedRecipe === f.recipe && action !== "fix-now";
    // 1 — every L1/L2 auto-fix fault nobody acted on is fixed (its fix applied + verified).
    if (f.level !== "L3" && f.path === "auto-fix" && !personFixed && !neverOrSnooze) {
      assert.ok(ran.has(f.recipe), `${label}: ${id} — its fix ran`);
      assert.equal(after.dns.staleEntries, 0, `${label}: ${id} — its fix applied`);
      assert.ok(audit.some((r) => r.tag === "ADVISORY" && r.recipeId === f.recipe && /fixed on its own after 3 notices \(verified\)/.test(r.text)), `${label}: ${id} — closed as fixed (verified)`);
      stats.fixed++;
    } else if (f.path === "attempt-fails" && !personFixed && !neverOrSnooze) {
      assert.ok(audit.some((r) => r.tag === "FIX" && r.recipeId === f.recipe && r.outcome === "failed"), `${label}: ${id} — reported failed, never fixed`);
      stats.failedHonestly++;
    } else if (f.path === "not-resolved" && !personFixed && !neverOrSnooze) {
      // 2026-10-14 (defect 3) — the fix ran, its gating verify failed: NOT RESOLVED (never "fixed (verified)"), then the IT contact.
      assert.ok(audit.some((r) => r.tag === "FIX" && r.recipeId === f.recipe && r.resolution === NOT_RESOLVED), `${label}: ${id} — reported not resolved`);
      assert.ok(!audit.some((r) => r.tag === "ADVISORY" && r.recipeId === f.recipe && /fixed on its own/.test(r.text)), `${label}: ${id} — never closed as fixed`);
      assert.ok(audit.some((r) => r.tag === "ESCALATE" && r.recipeId === f.recipe && /not resolved/.test(r.text)), `${label}: ${id} — the IT contact was told`);
      stats.notResolved++;
    } else if (f.path === "escalate" && !personFixed && !neverOrSnooze) {
      assert.ok(audit.some((r) => r.tag === "ESCALATE" && r.recipeId === f.recipe), `${label}: ${id} — the IT contact was told`);
      stats.escalated++;
    }
    // 2 — every L3 fault, and every fault nobody fixed, is untouched at its root.
    if (f.level === "L3" || (f.path !== "auto-fix" && !personFixed)) {
      for (const k of rootKeys) assert.ok(!changed.includes(k), `${label}: ${id} — root-cause key ${k} untouched`);
      stats.untouched++;
    }
    if (f.l3FixNeverRuns) assert.ok(!lab.machine.commands.some((c) => f.l3FixNeverRuns.test(c.cmd)), `${label}: the L3 fix never ran`);
    // every no-answer round: exactly 3 notices per round.
    const nums = audit.filter((r) => r.tag === "ADVISORY" && /^ADVISORY \d\/3: /.test(r.text) && r.recipeId === f.recipe);
    if (f.path !== "guide-only" && f.path !== "held" && !(actedRecipe === f.recipe)) {
      const sameRecipeFaults = ids.filter((x) => faultById(x).recipe === f.recipe).length;
      assert.ok(nums.length === 3, `${label}: ${id} — exactly 3 notices (got ${nums.length}${sameRecipeFaults > 1 ? `; ${sameRecipeFaults} faults share the recipe` : ""})`);
    }
    stats.notices += nums.length;
  }

  // 4 — never an excluded-folder path or name in any captured output.
  const text = lab.capturedText();
  assert.ok(!text.includes(PRIVATE_FOLDER_NAME) && !PRIVATE_FOLDER_RE.test(text), `${label}: no excluded-folder string anywhere`);
  assert.deepEqual(lab.machine.violations, [], `${label}: the excluded folder was never referenced`);

  // 5 — no change without a prior AUTO-FIX for that recipe or a person's action on it.
  const autoFixAt = audit.filter((r) => r.tag === "AUTO-FIX").map((r) => ({ at: Date.parse(r.ts), recipeId: r.recipeId }));
  const personAt = lab.humanActions.filter((h) => h.kind === "ack" && h.choice === "fix-now").map((h) => ({ at: h.at, recipeId: h.recipeId }));
  for (const c of lab.machine.commands.filter((x) => !isReadOnlyProbe(x.cmd) && !/^Checkpoint-Computer/.test(x.cmd))) {
    const owners = ownersOf(c.cmd);
    assert.ok(owners.length > 0, `${label}: a changing command with no registry owner ran: ${c.cmd}`);
    const ok = [...autoFixAt, ...personAt].some((e) => e.at <= c.at && owners.includes(e.recipeId));
    assert.ok(ok, `${label}: "${c.cmd}" ran without a prior AUTO-FIX after 3 advisories or a person's action for ${owners.join("/")}`);
    // 6 — a verified restore point before any yellow fix (attributed to the recipe actually executing at that moment).
    const running = audit.filter((r) => r.tag === "RUN" && /^Executing /.test(r.text) && Date.parse(r.ts) <= c.at).at(-1);
    const executing = running && owners.includes(running.recipeId) ? [running.recipeId] : owners;
    if (executing.some((o) => YELLOW_RECIPES.has(o))) {
      const verified = audit.some((r) => r.tag === "RESTORE PT" && Date.parse(r.ts) <= c.at && /(created and verified|Reusing verified restore point)/.test(r.text));
      const point = lab.machine.state.restorePoints.some((p) => p.at && p.at <= c.at);
      assert.ok(verified && point, `${label}: a yellow change ran before a verified restore point existed: ${c.cmd}`);
    }
  }
  stats.commands += lab.machine.commands.length;

  // + hygiene: nothing unknown, no timer threw, every escalation ended (or is honestly snoozed / never).
  assert.deepEqual(lab.machine.unknownCommands, [], `${label}: every command was one the lab knows`);
  assert.deepEqual(lab.clock.errors.map(String), [], `${label}: no timer threw`);
  const open = lab.advisories().filter((a) => a.status !== "snoozed");
  assert.deepEqual(open.map((a) => `${a.recipeId}:${a.status}`), [], `${label}: every escalation reached an end`);
  if (action === "fix-now") stats.personFixNow++;
  if (action === "not-now") stats.personNotNow++;
  if (action === "never") stats.personNever++;
  if (poisoned) stats.poisoned++;
  if (profile === "elevated-agent") stats.elevatedProfile++;
  stats.runs++;
}

// The state areas a fault's root cause lives in (for the untouched check when it declares no rootKeys).
function FAULT_KEYS(f) {
  return ({
    "stale-dns": ["dns.staleEntries"], "spooler-stuck": ["services.Spooler.status", "printQueue"], "audio-stopped": ["services.Audiosrv.status"],
    "temp-bloat": ["tempBytes", "disk.freeBytes"], "time-drift": ["time.offsetSec"], "teams-stuck": ["teams"], "wu-stuck": ["updates.stuck", "services.wuauserv.hung"],
    "bits-stopped": ["services.BITS.status", "bits.transfersStuck"], "wlan-stopped": ["services.WlanSvc.status", "network.wifiConnected"],
    "dnscache-stopped": ["services.Dnscache.status"], "dhcp-lease-stale": ["network.leaseValid", "network.apipa", "network.gatewayReachable"],
    "spooler-disabled": ["services.Spooler.startType", "services.Spooler.status", "printQueue"], "system-files-corrupt": ["systemFiles.corrupt"],
    "bitlocker-recovery": ["bitlocker.recoveryPrompt"], "winsock-corrupt": ["network.winsockOk"], "print-driver-crash": ["printQueue", "services.Spooler.hung"],
    "dhcp-stopped": ["services.Dhcp.status"] // 2026-10-14 (defect 1) — the new catalogue fault
  })[f.id] || [];
}

const seeds = process.env.SOAK_SEED ? [Number(process.env.SOAK_SEED)] : Array.from({ length: RUNS }, (_, i) => SEED0 + i);
for (const seed of seeds) {
  try { await sequence(seed); } catch (err) { failures.push({ seed, error: String((err && err.message) || err).slice(0, 400) }); }
}
if (failures.length) {
  for (const f of failures.slice(0, 10)) console.error(`  soak failure — seed ${f.seed}: ${f.error}`);
  assert.fail(`fault-lab-soak: ${failures.length} of ${seeds.length} sequences broke an invariant (first seed ${failures[0].seed})`);
}
assert.equal(stats.runs, seeds.length);
console.log(`fault-lab-soak test passed (${stats.runs} seeded sequences, seeds ${seeds[0]}–${seeds.at(-1)} · ${stats.faults} faults injected (L1 ${stats.byLevel.L1} · L2 ${stats.byLevel.L2} · L3 ${stats.byLevel.L3}) · ${stats.fixed} fixed on their own after 3 notices · ${stats.escalated} escalated to the IT contact · ${stats.failedHonestly} failed honestly · ${stats.notResolved} not resolved → IT contact · ${stats.untouched} left untouched at the root · ${stats.notices} notices · ${stats.commands} commands interpreted · person: ${stats.personFixNow} Fix now · ${stats.personNotNow} Not now · ${stats.personNever} Never · ${stats.poisoned} poisoned inputs · ${stats.elevatedProfile} elevated-agent runs · 0 invariant failures).`);

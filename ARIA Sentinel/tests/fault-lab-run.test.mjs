// 2026-10-14 — the REAL-Windows fault lab (scripts/fault-lab.ps1 + scripts/fault-lab-run.mjs), checked where it cannot
// run: this container has no Windows and no PowerShell, so the on-device run is the operator's (docs/FAULT-LAB.md).
// What CAN be proven here, is:
//   1. the two catalogues agree (ids · recipes · levels), and with the simulated lab where the fault is the same;
//   2. the script cannot change what it promises never to change (network · DNS · registry · clock · default apps ·
//      startup types · anything outside its own folder) — a static scan of every command it contains;
//   3. the excluded-folder guard is read at run time from path-guard.mjs, fails closed, and is never spelled out;
//   4. the runner's judgement (pure): expectations from the real watcher/needs-admin rules, the verdict on synthetic
//      bridge sequences (escalated = PASS · an AUTO-FIX row for an admin fix = FAIL · an unintended change = FAIL), the
//      content-blind verdict file, the refusals (L3 / simulated-only / not Windows), and the dry run.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { REAL_FAULTS, SIMULATED_ONLY, parseArgs, expectationFor, observe, settled, verdictOf, publicChanges, verdictFileName, OPERATOR_STEPS, main, ADVISORY_NOTICES } from "../scripts/fault-lab-run.mjs";
import { FAULTS } from "./lib/fault-lab.mjs";
import { PRIVATE_FOLDER_RE } from "../src/shared/path-guard.mjs";
import { evaluateServices, IDLE_NORMAL_SERVICES } from "../src/sub-agents/detection/service-watcher.mjs";
import { RECIPES } from "../src/shared/recipes.mjs";

const root = path.resolve(import.meta.dirname, "..");
const rd = (...p) => fs.readFileSync(path.join(root, ...p), "utf8");
let groups = 0; const t = () => { groups++; };
const ps1 = rd("scripts", "fault-lab.ps1");
const runner = rd("scripts", "fault-lab-run.mjs");
const doc = rd("docs", "FAULT-LAB.md");

/** PowerShell source with every comment removed and every string literal emptied ('' / ""), newlines kept. */
function blankStrings(src) {
  let out = "", mode = "code";
  for (let i = 0; i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (mode === "code") {
      if (c === "<" && n === "#") { const end = src.indexOf("#>", i + 2); out += src.slice(i, end < 0 ? src.length : end + 2).replace(/[^\n]/g, ""); i = end < 0 ? src.length : end + 1; continue; }
      if (c === "#") { const end = src.indexOf("\n", i); i = (end < 0 ? src.length : end) - 1; continue; }
      if (c === "'") { mode = "sq"; out += "''"; continue; }
      if (c === '"') { mode = "dq"; out += '""'; continue; }
      out += c; continue;
    }
    if (c === "\n") out += "\n";
    if (mode === "sq") { if (c === "'" && n === "'") { i++; continue; } if (c === "'") mode = "code"; continue; }
    if (c === "`") { i++; continue; }
    if (c === '"' && n === '"') { i++; continue; }
    if (c === '"') mode = "code";
  }
  return out;
}

// 1 — one catalogue: ps1 ⇔ runner ⇔ simulated lab ⇔ the recipe registry.
{
  const real = [...ps1.matchAll(/^\s+'([a-z-]+)'\s+= @\{ level = '(L\d)'; recipe = '([a-z0-9-]+)'; color = '([a-z]+)'; admin = \$(true|false); service = '([A-Za-z]*)'/gm)].map((m) => ({ id: m[1], level: m[2], recipe: m[3], color: m[4], admin: m[5] === "true", service: m[6] }));
  assert.deepEqual(real.map((r) => r.id), Object.keys(REAL_FAULTS), "the ps1 and the runner inject the same faults");
  for (const r of real) {
    const j = REAL_FAULTS[r.id];
    assert.equal(r.level, j.level, `${r.id} level`); assert.equal(r.recipe, j.recipe, `${r.id} recipe`); assert.equal(r.service, j.service, `${r.id} service`);
    assert.ok(["L1", "L2"].includes(r.level), `${r.id}: only L1/L2 are injected for real`);
    assert.ok(RECIPES.some((x) => x.id === r.recipe), `${r.recipe} is a real recipe`);
    const sim = FAULTS.find((f) => f.id === r.id);
    if (sim) assert.equal(sim.recipe, r.recipe, `${r.id}: same id → same recipe as the simulated lab`);
    else assert.equal(r.id, "wu-stopped", "the only real-only fault is wu-stopped (the simulated wu-stuck is a hung update)");
  }
  const sim = [...ps1.slice(ps1.indexOf("$SimulatedOnly = [ordered]@{"), ps1.indexOf("$LabServices")).matchAll(/^\s+'([a-z-]+)'\s+= '/gm)].map((m) => m[1]);
  assert.deepEqual(sim, [...SIMULATED_ONLY], "the ps1 and the runner refuse the same faults");
  for (const id of SIMULATED_ONLY) assert.ok(FAULTS.some((f) => f.id === id), `${id} is covered by the simulated lab`);
  for (const f of FAULTS.filter((x) => x.level === "L3")) assert.ok(SIMULATED_ONLY.includes(f.id), `L3 ${f.id} is refused on a real machine`);
  for (const f of FAULTS) assert.ok(SIMULATED_ONLY.includes(f.id) || REAL_FAULTS[f.id], `every simulated fault is either real here or refused by name (${f.id})`);
}
t();

// 2 — the script cannot change what it promises not to: every mutating command it contains is on a short list.
{
  const code = ps1.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n").replace(/<#[\s\S]*?#>/g, "");
  const FORBIDDEN = [
    /\bSet-ItemProperty\b/i, /\bNew-ItemProperty\b/i, /\bRemove-ItemProperty\b/i, /\breg(\.exe)?\s+(add|delete|import|load|restore)\b/i, /\bnetsh\b/i, /\bipconfig\b/i,
    /\bSet-DnsClient/i, /\bClear-DnsClientCache\b/i, /\bRegister-DnsClient\b/i, /\b(Disable|Enable|Restart|Rename|Set)-NetAdapter\b/i, /\bSet-NetIPInterface\b/i, /\b(New|Remove|Set)-NetIPAddress\b/i, /\b(New|Remove)-NetRoute\b/i,
    /\bSet-Date\b/i, /\bw32tm\b/i, /\bassoc\b/i, /\bftype\b/i, /\bSet-Service\b/i, /\bsc(\.exe)?\s+(config|stop|delete|create)\b/i, /\bStop-Process\b/i, /\bkill\b/i,
    /\bInvoke-Expression\b/i, /\biex\b/i, /\bCheckpoint-Computer\b/i, /\bbcdedit\b/i, /\bSet-ExecutionPolicy\b/i, /\bDisable-ComputerRestore\b/i, /\bRemove-Printer\b/i, /\bSet-Printer\b/i, /\bInvoke-WebRequest\b/i, /\bInvoke-RestMethod\b/i, /\bNet\.WebClient\b/i, /\bStart-BitsTransfer\b/i
  ];
  for (const re of FORBIDDEN) assert.doesNotMatch(code, re, `fault-lab.ps1 never runs ${re}`);
  // The only mutations: Stop-Service (inject) / Start-Service (restore) on catalogue services, Pause/Resume of the lab
  // printer queue, files under the lab's own folder, and its own state files. (Commands are read with every string
  // literal blanked, so the log lines that QUOTE a command are not mistaken for it.)
  const exec = blankStrings(ps1);
  const stops = [...exec.matchAll(/Stop-Service\s+-Name\s+(\S+)/g)].map((m) => m[1]);
  assert.deepEqual(stops, ["$f.service"], "Stop-Service only on a catalogue service");
  assert.ok(exec.indexOf("Stop-Service") > exec.indexOf("function Invoke-Inject") && exec.indexOf("Stop-Service") < exec.indexOf("function Invoke-Verify"), "…and only inside -Inject");
  const starts = [...exec.matchAll(/Start-Service\s+-Name\s+(\S+)/g)].map((m) => m[1]);
  assert.deepEqual(starts, ["$name"]); assert.ok(exec.indexOf("Start-Service") > exec.indexOf("function Invoke-Restore"), "Start-Service only inside -Restore");
  assert.match(code, /if \(\$def -and \$def\.service -and \$f\.injected -and \$f\.before -and \$f\.before\.Status -eq 'Running'\)/, "restore starts only services that were running before the lab stopped them");
  const removes = [...exec.matchAll(/Remove-Item\s+([^\n]+)/g)].map((m) => m[1]);
  assert.equal(removes.length, 1, "one delete in the whole script"); assert.match(removes[0], /^-LiteralPath \$LabRoot -Recurse -Force/);
  assert.match(code, /if \(\(Split-Path -Leaf \$LabRoot\) -ne 'aria-fault-lab'\) \{ Exit-With 2/, "the lab root must be the lab's own folder");
  const cim = [...exec.matchAll(/-MethodName\s+(\w+)/g)].map((m) => m[1]);
  assert.doesNotMatch(exec, /\bSet-Content\b(?![^\n]*-LiteralPath \$file)|\bAdd-Content\b(?![^\n]*-LiteralPath \$LogFile)|\bOut-File\b/, "writes only its own state files and log");
  assert.match(exec, /\[IO\.File\]::Open\(\$file, /); assert.ok(exec.indexOf("[IO.File]::Open(") > exec.indexOf("temp-bloat"), "the only raw file write is the junk under the lab folder");
  assert.deepEqual([...new Set(cim)].sort(), ["Pause", "Resume"], "printer: pause (inject) and resume (restore) only");
  assert.match(code, /Win32_Printer -Filter \("Name='\{0\}'" -f \$LabPrinter\)/, "only the lab printer's queue");
  for (const id of SIMULATED_ONLY) assert.match(ps1, new RegExp(`'${id}'\\s+= '`), `${id} is refused by name`);
  assert.match(code, /REFUSED: '\$id' is simulated only/); assert.match(code, /exit 3/);
  assert.match(code, /if \(-not \$onWindows\) \{ Exit-With 2/, "Windows only");
  assert.match(code, /Verb RunAs/, "self-elevates through UAC"); assert.match(code, /-NoElevate/, "the elevated copy never re-elevates");
  // Windows PowerShell 5.1 reads a BOM-less script in the ANSI code page: a UTF-8 em dash inside a double-quoted string
  // decodes to a closing smart quote and breaks the parse. The script stays pure ASCII.
  assert.ok([...ps1].every((ch) => ch.charCodeAt(0) < 128), "fault-lab.ps1 is pure ASCII (safe for Windows PowerShell 5.1)");
  assert.match(code, /function Write-LabLog/); assert.ok((code.match(/Write-LabLog "/g) || []).length >= 25, "every step is logged");
}
t();

// 3 — the excluded folder: read at run time, fail closed, never spelled out.
{
  for (const [name, text] of [["fault-lab.ps1", ps1], ["fault-lab-run.mjs", runner], ["FAULT-LAB.md", doc], ["this test", fs.readFileSync(new URL(import.meta.url), "utf8")]]) {
    assert.ok(!PRIVATE_FOLDER_RE.test(text), `${name} never names the excluded folder`);
  }
  assert.match(ps1, /src\\shared\\path-guard\.mjs/, "the guard comes from the app's own path-guard.mjs");
  assert.match(ps1, /export const PRIVATE_FOLDER_RE = \/\(\.\+\?\)\/\(\[a-z\]\*\);/, "…its PRIVATE_FOLDER_RE, parsed at run time");
  assert.match(ps1, /failed its self-test/, "…and self-tested against the default folder's own name");
  assert.match(ps1, /excludedFolders/, "the folders the person added in the app are honoured too");
  assert.match(ps1, /try \{ \$Guard = New-ExcludedFolderGuard \} catch \{ Exit-With 2 .*fail closed/, "no guard → no run");
  assert.match(ps1, /if \(Test-Excluded \$dir\) \{ \$skipped\+\+; continue \}/, "a matching folder is skipped before it is listed");
  assert.match(ps1, /ReparsePoint/, "junctions are never followed");
  // the guard semantics match path-guard.mjs: the JS rule really is a plain, .NET-compatible pattern with only the i flag
  const src = rd("src", "shared", "path-guard.mjs");
  const m = src.match(/export const PRIVATE_FOLDER_RE = \/(.+?)\/([a-z]*);/);
  assert.ok(m, "path-guard.mjs still declares PRIVATE_FOLDER_RE in the shape the ps1 parses");
  assert.equal(m[2], "i"); assert.doesNotMatch(m[1], /\(\?<|\\[pPk]\{|\(\?[=!]/, "no JS-only syntax the .NET engine would read differently");
  assert.match(src, /export const PRIVATE_FOLDER_NAME = "[^"]+";/, "the self-test's name is still there to read");
}
t();

// 4 — the runner's judgement.
{
  // arguments + refusals
  assert.deepEqual(parseArgs([]).ids, Object.keys(REAL_FAULTS));
  assert.match(parseArgs(["--faults", "winsock-corrupt"]).errors.join(), /simulated only/);
  assert.match(parseArgs(["--faults", "nope"]).errors.join(), /unknown fault/);
  assert.match(parseArgs(["--minutes", "1"]).errors.join(), /--minutes/);
  assert.deepEqual(parseArgs(["--faults", "spooler-stuck,temp-bloat", "--minutes", "8", "--poll", "3"]).errors, []);
  // expectations follow the REAL service watcher: Automatic Running→Stopped fires; Manual (idle-normal) stays quiet
  const auto = evaluateServices({ Spooler: "Running" }, [{ Name: "Spooler", Status: "Stopped", StartType: "Automatic" }]);
  const manual = evaluateServices({ wuauserv: "Running" }, [{ Name: "wuauserv", Status: "Stopped", StartType: "Manual" }]);
  assert.equal(auto.signals.length, 1); assert.equal(manual.signals.length, 0);
  assert.ok(IDLE_NORMAL_SERVICES.includes("wuauserv") && IDLE_NORMAL_SERVICES.includes("bits"));
  const eSpool = expectationFor("spooler-stuck", { injected: true, before: { Status: "Running", StartType: "Automatic" } });
  assert.deepEqual([eSpool.detect, eSpool.track, eSpool.terminal, eSpool.notices, eSpool.autoFix], [true, "tech-contact", "escalated", 3, false]);
  assert.equal(expectationFor("wu-stopped", { injected: true, before: { Status: "Running", StartType: "Manual" } }).detect, false);
  assert.equal(expectationFor("bits-stopped", { injected: false, note: "already Stopped" }).detect, false);
  assert.equal(expectationFor("temp-bloat", { injected: true }).detect, "only-if-disk-under-5-percent");
  for (const id of Object.keys(REAL_FAULTS)) assert.equal(REAL_FAULTS[id].needsAdmin, true, `${id}: its fix needs administrator rights, so it is never run unattended`);
  // a synthetic run: notices 1→3 then escalated; the quiet fault never shows up
  const exps = [eSpool, expectationFor("wu-stopped", { injected: true, before: { Status: "Running", StartType: "Manual" } })];
  const pub = (active, outcomes, tags) => ({ advisory: { active, outcomes, auditTags: tags } });
  let obs = { outcomeIdsBefore: ["adv-1-old"], byRecipe: {}, auditTags: { advisory: 4, autoFix: 1, escalate: 0 } };
  const before = { advisory: 4, autoFix: 1, escalate: 0 };
  obs = observe(obs, pub([{ id: "adv-7-svc-spooler-stopped-v1", recipeId: "svc-spooler-stopped-v1", track: "tech-contact", status: "advising", advisory: 1, of: 3 }], [{ id: "adv-1-old", recipeId: "svc-spooler-stopped-v1", status: "escalated", advisories: 3 }], { advisory: 5, autoFix: 1, escalate: 0 }), ["svc-spooler-stopped-v1", "svc-wuauserv-stopped-v1"], 70);
  assert.equal(obs.byRecipe["svc-spooler-stopped-v1"].terminal, null, "an outcome from BEFORE the run is ignored");
  assert.equal(settled(exps, obs), false);
  obs = observe(obs, pub([{ id: "adv-7-svc-spooler-stopped-v1", recipeId: "svc-spooler-stopped-v1", track: "tech-contact", status: "advising", advisory: 3, of: 3 }], [], { advisory: 7, autoFix: 1, escalate: 0 }), ["svc-spooler-stopped-v1", "svc-wuauserv-stopped-v1"], 190);
  obs = observe(obs, pub([], [{ id: "adv-7-svc-spooler-stopped-v1", recipeId: "svc-spooler-stopped-v1", track: "tech-contact", status: "escalated", outcome: "escalated-unanswered", advisories: 3, of: 3 }], { advisory: 7, autoFix: 1, escalate: 1 }), ["svc-spooler-stopped-v1", "svc-wuauserv-stopped-v1"], 260);
  assert.equal(settled(exps, obs), true);
  const clean = { ok: true, changedIntended: [{ key: "services.Spooler.Status", before: "Running", after: "Stopped" }], changedUnintended: [] };
  const v = verdictOf({ expectations: exps, obs, tagsBefore: before, verifyLive: clean, verifyAfterRestore: { ok: true, changedUnintended: [] } });
  assert.equal(v.pass, true, JSON.stringify(v, null, 1));
  assert.deepEqual(v.auditTagDeltas, { advisory: 3, autoFix: 0, escalate: 1 });
  assert.equal(v.faults[0].observed.notices, ADVISORY_NOTICES); assert.equal(v.faults[0].observed.end, "escalated"); assert.equal(v.faults[1].ok, true);
  // an AUTO-FIX row during the run = FAIL (no admin fix may run unattended)
  const bad = verdictOf({ expectations: exps, obs: { ...obs, auditTags: { advisory: 7, autoFix: 2, escalate: 1 } }, tagsBefore: before, verifyLive: clean, verifyAfterRestore: { ok: true } });
  assert.equal(bad.pass, false); assert.equal(bad.checks.find((c) => c.id === "no-auto-fix-for-admin-fixes").ok, false);
  // an unintended change (while live, or left after restore) = FAIL
  assert.equal(verdictOf({ expectations: exps, obs, tagsBefore: before, verifyLive: { ok: false, changedUnintended: [{ key: "net.Wi-Fi.dns" }] }, verifyAfterRestore: { ok: true } }).pass, false);
  assert.equal(verdictOf({ expectations: exps, obs, tagsBefore: before, verifyLive: clean, verifyAfterRestore: { ok: false, changedUnintended: [{ key: "services.Audiosrv.Status" }] } }).pass, false);
  assert.equal(verdictOf({ expectations: exps, obs, tagsBefore: before, verifyLive: null, verifyAfterRestore: null }).pass, false, "no verify → no PASS");
  // a quiet fault that DID notify = FAIL (the watcher's idle-normal gate broke)
  const noisy = observe(obs, pub([{ id: "adv-9-svc-wuauserv-stopped-v1", recipeId: "svc-wuauserv-stopped-v1", track: "tech-contact", status: "advising", advisory: 1, of: 3 }], [], { advisory: 8, autoFix: 1, escalate: 1 }), ["svc-spooler-stopped-v1", "svc-wuauserv-stopped-v1"], 300);
  assert.equal(verdictOf({ expectations: exps, obs: noisy, tagsBefore: before, verifyLive: clean, verifyAfterRestore: { ok: true } }).faults[1].ok, false);
  // the verdict file is content-blind: network / default-app values are withheld, service states kept
  assert.deepEqual(publicChanges([{ key: "net.Wi-Fi.ipv4", before: "192.168.1.20", after: "192.168.1.21" }, { key: "defaultApps..txt", before: "a", after: "b" }, { key: "services.BITS.Status", before: "Running", after: "Stopped" }]),
    [{ key: "net.Wi-Fi.ipv4", changed: true }, { key: "defaultApps..txt", changed: true }, { key: "services.BITS.Status", before: "Running", after: "Stopped" }]);
  assert.match(path.basename(verdictFileName("/nonexistent-dir", new Date("2026-10-14T12:00:00Z"))), /^FAULT-LAB-2026-10-14\.json$/);
  assert.match(runner, /fetch\(`http:\/\/127\.0\.0\.1:\$\{port\}\/state`/, "the runner reads ONLY the local bridge's public /state");
  assert.doesNotMatch(runner.replace(/http:\/\/127\.0\.0\.1/g, ""), /https?:\/\//, "…and no other URL");
  assert.ok(OPERATOR_STEPS.some((s) => /Minutes between notices = 1/.test(s)) && OPERATOR_STEPS.some((s) => /Autonomous/.test(s)) && OPERATOR_STEPS.some((s) => /Do NOT answer the notices/.test(s)));
}
t();

// 5 — not Windows → refuses (exit 2); --dry-run prints the plan and touches nothing.
{
  const logs = []; const errs = [];
  const ol = console.log, oe = console.error;
  console.log = (...a) => logs.push(a.join(" ")); console.error = (...a) => errs.push(a.join(" "));
  let refuse, dry, sim;
  try { refuse = await main([]); dry = await main(["--dry-run", "--faults", "spooler-stuck"]); sim = await main(["--faults", "system-files-corrupt"]); }
  finally { console.log = ol; console.error = oe; }
  assert.equal(refuse, process.platform === "win32" ? refuse : 2, "off Windows the run refuses");
  if (process.platform !== "win32") assert.match(errs.join("\n"), /Windows test machine only/);
  assert.equal(dry, 0); assert.match(logs.join("\n"), /DRY RUN \(nothing is touched\)/); assert.match(logs.join("\n"), /"id": "spooler-stuck"/);
  assert.equal(sim, 2); assert.match(errs.join("\n"), /'system-files-corrupt' is simulated only/);
}
t();

// 6 — the operator doc covers the click sequence, the catalogue and the expectations, and says what is NOT proven.
{
  for (const id of [...Object.keys(REAL_FAULTS), ...SIMULATED_ONLY]) assert.match(doc, new RegExp(`\\b${id}\\b`), `FAULT-LAB.md names ${id}`);
  for (const s of ["-Snapshot", "-Inject", "-Verify", "-Restore", "fault-lab-run.mjs", "Minutes between notices", "UAC", "FAULT-LAB-"]) assert.ok(doc.includes(s), `FAULT-LAB.md explains ${s}`);
  assert.match(doc, /simulated only/i); assert.match(doc, /never .*network/i);
}
t();

console.log(`fault-lab-run test passed (${groups} groups · ${Object.keys(REAL_FAULTS).length} real L1/L2 faults · ${SIMULATED_ONLY.length} refused as simulated-only · the ps1 cannot touch network/DNS/registry/clock/default apps/startup types · guard read at run time, fail closed · verdict logic PASS/FAIL on synthetic runs · on-device run documented, not executed here).`);

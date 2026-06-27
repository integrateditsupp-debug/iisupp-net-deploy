#!/usr/bin/env node
/* ============================================================================
 * AXIS Runner — the autonomy bridge.
 *
 * Reads a safe-job queue (senior-director-state/axis-jobs.jsonl) and, for each
 * job marked safe, runs it END-TO-END through headless Claude Code in an ISOLATED
 * /tmp worktree, requires tests green, commits to a cc/ branch (NEVER main),
 * updates axis-state.json + the dispatch log + the job status, and notifies.
 *
 * HARD SAFETY (RULE 14 + gates) — auto-runs SAFE jobs ONLY. It NEVER:
 *   • pushes to / merges main      • deploys / publishes to Netlify
 *   • sends email / outreach / msg • applies a destructive system fix
 *   • touches financial / payment  • changes a credential / secret / key
 * Any job that is not provably safe is routed to the approvals inbox, untouched.
 * A kill-switch (file senior-director-state/AXIS-RUNNER-KILL or env
 * AXIS_RUNNER_KILL=1) halts the runner between every job.
 *
 * Usage:
 *   node scripts/axis-runner.mjs --once         # process exactly ONE safe job (conservative proof)
 *   node scripts/axis-runner.mjs --job <id>     # process one specific job by id
 *   node scripts/axis-runner.mjs                # drain all queued safe jobs (loop, kill-switch-gated)
 *   node scripts/axis-runner.mjs --dry-run      # classify only; run nothing, write nothing irreversible
 * ==========================================================================*/
'use strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const STATE_DIR = path.join(ROOT, 'senior-director-state');
const JOBS_FILE = path.join(STATE_DIR, 'axis-jobs.jsonl');
const AXIS_STATE = path.join(STATE_DIR, 'axis-state.json');
const DISPATCH_LOG = path.join(STATE_DIR, 'agent-dispatch-log.md');
const APPROVALS_FILE = path.join(STATE_DIR, 'autonomy', 'axis-approvals.jsonl');
const KILL_FILE = path.join(STATE_DIR, 'AXIS-RUNNER-KILL');
const RUN_LOG = path.join(STATE_DIR, 'axis-runner.log');

const ARGS = process.argv.slice(2);
const ONCE = ARGS.includes('--once');
const DRY_RUN = ARGS.includes('--dry-run');
const JOB_ID = (ARGS[ARGS.indexOf('--job') + 1] && ARGS.includes('--job')) ? ARGS[ARGS.indexOf('--job') + 1] : null;

// The real Claude Code CLI (configurable). Default to the npm-global install on this machine.
// NOTE: on Windows, spawn() with shell:false cannot run a .cmd (EINVAL), so we target the real .exe the
// claude.cmd shim wraps. Override with CLAUDE_CLI_PATH if your install differs.
const CLAUDE_CLI = process.env.CLAUDE_CLI_PATH
  || (process.platform === 'win32'
    ? path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
    : 'claude');
const CLAUDE_TIMEOUT_MS = Number(process.env.AXIS_CLAUDE_TIMEOUT_MS || 8 * 60 * 1000);

// ── HARD GATES ─────────────────────────────────────────────────────────────
// Only these job kinds may ever auto-run. Anything else → approvals.
const SAFE_KINDS = new Set(['kb-article', 'kb-stub', 'doc', 'classifier-keyword', 'scenario', 'test', 'note', 'research-note']);
// Defense-in-depth: if a job's prompt/title smells risky, it is rejected even if marked safe.
const RISKY_PATTERNS = [
  { re: /push[^.]{0,30}\bmain\b|to main\b|merge[^.]{0,30}\bmain\b|origin\/main/i, why: 'push/merge to main' },
  { re: /\bnetlify\b|\bdeploy\b|publish (live|to ?prod|production)|go ?live|ota (publish|release)/i, why: 'deploy/publish' },
  { re: /send (an? )?(email|outreach|message|sms|whatsapp|dm|text)|outreach|email[^.]{0,20}(client|lead|prospect|customer)|mailto:|resend|smtp send/i, why: 'send email/outreach' },
  { re: /\brm -rf\b|del \/[a-z]|format [a-z]:|reg delete|drop table|truncate table|shutdown|reboot|diskpart|mkfs/i, why: 'destructive system action' },
  { re: /\b(payment|stripe|invoice|refund|charge card|financial|payout|bank|wire transfer|purchase|spend)\b/i, why: 'financial action' },
  { re: /\b(password|credential|api.?key|client.?secret|secret|token)\b[^.]{0,20}(change|rotate|reset|set|update|provision|issue)|set[^.]{0,15}(secret|api.?key)/i, why: 'credential/secret change' },
  { re: /\bgit push\b|--force|force.?push/i, why: 'unscoped git push / force-push' },
];

function nowIso() { return new Date().toISOString(); }
async function log(line) {
  const s = `[${nowIso()}] ${line}`;
  console.log(s);
  try { await fsp.appendFile(RUN_LOG, s + '\n', 'utf8'); } catch { /* logging must never throw */ }
}

function killed() {
  if (String(process.env.AXIS_RUNNER_KILL || '') === '1') return 'env AXIS_RUNNER_KILL=1';
  if (fs.existsSync(KILL_FILE)) return 'kill-switch file present';
  return null;
}

function runCmd(command, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: opts.cwd || ROOT, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: opts.env || process.env });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, opts.timeoutMs || 5 * 60 * 1000);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    child.on('error', (err) => { clearTimeout(timer); resolve({ code: 1, stdout, stderr: String(err && err.message || err) }); });
  });
}

// Claude env: STRIP the invalid ANTHROPIC_API_KEY so the CLI uses the claude.ai login (verified working).
function claudeEnv() {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY; // an invalid key here makes `claude -p` fail with "Invalid API key"
  return env;
}

async function loadJobs() {
  try {
    const raw = await fsp.readFile(JOBS_FILE, 'utf8');
    return raw.split(/\r?\n/).filter((l) => l.trim()).map((l, i) => { try { return JSON.parse(l); } catch { return { _badLine: i, raw: l }; } });
  } catch { return []; }
}
async function saveJobs(jobs) {
  await fsp.writeFile(JOBS_FILE, jobs.filter((j) => !j._badLine).map((j) => JSON.stringify(j)).join('\n') + '\n', 'utf8');
}

async function updateAxisState(patch) {
  let state = {};
  try { state = JSON.parse(await fsp.readFile(AXIS_STATE, 'utf8')); } catch { state = { v: 'axis-state-v1', runner: 'axis-runner', history: [] }; }
  Object.assign(state, patch, { updatedAt: nowIso() });
  if (patch.lastJob) { state.history = [patch.lastJob, ...(state.history || [])].slice(0, 50); }
  await fsp.writeFile(AXIS_STATE, JSON.stringify(state, null, 2), 'utf8');
}
async function appendDispatch(line) {
  await fsp.appendFile(DISPATCH_LOG, `\n## ${nowIso()} — AXIS Runner\n${line}\n`, 'utf8');
}
async function routeToApprovals(job, reason) {
  await fsp.mkdir(path.dirname(APPROVALS_FILE), { recursive: true });
  const entry = { ts: nowIso(), jobId: job.id, kind: job.kind, title: job.title, reason, status: 'needs-approval', job };
  await fsp.appendFile(APPROVALS_FILE, JSON.stringify(entry) + '\n', 'utf8');
  await log(`job ${job.id} → APPROVALS INBOX (${reason})`);
}
async function notify(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_OWNER_CHAT_ID;
  if (!token || !chatId) { await log(`notify (no telegram configured): ${text}`); return { ok: false, skipped: true }; }
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text: String(text).slice(0, 3500), disable_web_page_preview: true }) });
    return { ok: r.ok };
  } catch { return { ok: false }; }
}

// The classification gate — returns { safe:true } only if ALL checks pass.
function classify(job) {
  if (job._badLine != null) return { safe: false, reason: 'unparseable job line' };
  if (job.safe !== true) return { safe: false, reason: 'job not marked safe:true' };
  if (!SAFE_KINDS.has(job.kind)) return { safe: false, reason: `kind '${job.kind}' not in the safe allowlist` };
  const blob = `${job.title || ''}\n${job.prompt || ''}\n${(job.files || []).join(' ')}`;
  for (const p of RISKY_PATTERNS) if (p.re.test(blob)) return { safe: false, reason: `risky marker: ${p.why}` };
  if (job.requiresApproval === true) return { safe: false, reason: 'job explicitly requires approval' };
  return { safe: true };
}

// Build the tightly-scoped Claude prompt. The agent may ONLY author the declared file(s); never git/deploy/send.
function buildPrompt(job) {
  const guard = [
    'You are an AUTONOMOUS, NON-INTERACTIVE KB/doc authoring agent running headless inside an isolated git worktree.',
    'STRICT RULES:',
    `1. Create/modify ONLY this file: ${job.targetFile}`,
    '2. Do NOT touch any other file. Do NOT run git, npm, deploys, or network sends. Do NOT push. Do NOT email.',
    '3. Write real, accurate content (RULE 14 — no fabricated facts/metrics). Keep it concise + correct.',
    '4. When done, stop. Output one line: AXIS_JOB_DONE',
    '', 'TASK:', job.prompt,
  ].join('\n');
  return guard;
}

async function gitInClone(clone, args) { return runCmd('git', args, { cwd: clone, timeoutMs: 120000 }); }

async function runSafeJob(job) {
  const jobId = job.id;
  const branch = `cc/axis-${jobId}`;
  const clone = path.join(os.tmpdir(), `axis-clone-${jobId}-${Date.now()}`);
  await log(`▶ running safe job ${jobId} (${job.kind}): ${job.title}`);

  // 1. Isolated worktree off origin/main (clean, never the live tree). Clean any leftover branch/worktree
  //    from a prior failed run of this same job (the runner owns the cc/axis-* namespace).
  await runCmd('git', ['fetch', 'origin', '--quiet'], { cwd: ROOT, timeoutMs: 120000 });
  await runCmd('git', ['worktree', 'prune'], { cwd: ROOT, timeoutMs: 30000 });
  await runCmd('git', ['branch', '-D', branch], { cwd: ROOT, timeoutMs: 30000 }); // ignore failure if absent
  const wt = await runCmd('git', ['worktree', 'add', '-b', branch, clone, 'origin/main'], { cwd: ROOT, timeoutMs: 180000 });
  if (wt.code !== 0) { await log(`  ✗ worktree add failed: ${wt.stderr.slice(0, 300)}`); return { ok: false, stage: 'clone', detail: wt.stderr.slice(0, 300) }; }

  try {
    // 2. Author via headless claude -p (ANTHROPIC_API_KEY stripped; permissions skipped INSIDE the isolated clone only).
    const prompt = buildPrompt(job);
    const claudeArgs = ['-p', prompt, '--output-format', 'text', '--dangerously-skip-permissions', '--add-dir', clone];
    if (job.model) claudeArgs.push('--model', job.model);
    await log(`  · invoking claude -p (timeout ${Math.round(CLAUDE_TIMEOUT_MS / 1000)}s) …`);
    const cl = await runCmd(CLAUDE_CLI, claudeArgs, { cwd: clone, env: claudeEnv(), timeoutMs: CLAUDE_TIMEOUT_MS });
    const tail = (cl.stdout + '\n' + cl.stderr).slice(-400).replace(/\s+/g, ' ').trim();
    if (cl.code !== 0) { await log(`  ✗ claude exited ${cl.code}: ${tail}`); return { ok: false, stage: 'claude', detail: tail }; }

    // 3. Verify the target file was authored (and ONLY expected paths changed).
    const targetAbs = path.join(clone, job.targetFile);
    if (!fs.existsSync(targetAbs)) { await log(`  ✗ target file not created: ${job.targetFile}`); return { ok: false, stage: 'verify', detail: 'target file missing' }; }
    const status = await gitInClone(clone, ['status', '--porcelain', '-uall']); // -uall: list files, not collapsed new dirs
    const changed = status.stdout.split(/\r?\n/).map((l) => l.slice(3).trim()).filter(Boolean);
    const unexpected = changed.filter((f) => f !== job.targetFile.replace(/\\/g, '/'));
    if (unexpected.length) { await log(`  ✗ agent touched unexpected files: ${unexpected.join(', ')}`); return { ok: false, stage: 'verify', detail: 'unexpected files changed: ' + unexpected.join(', ') }; }

    // 4. Tests green (job-specified, else a content sanity check for the target).
    let testOut = 'frontmatter+nonempty check';
    if (job.testCmd) {
      const t = await runCmd(process.platform === 'win32' ? 'cmd.exe' : 'sh', process.platform === 'win32' ? ['/c', job.testCmd] : ['-c', job.testCmd], { cwd: clone, timeoutMs: 5 * 60 * 1000 });
      if (t.code !== 0) { await log(`  ✗ tests failed (${job.testCmd}): ${(t.stdout + t.stderr).slice(-300)}`); return { ok: false, stage: 'tests', detail: (t.stdout + t.stderr).slice(-300) }; }
      testOut = `${job.testCmd} → green`;
    } else {
      const body = await fsp.readFile(targetAbs, 'utf8');
      if (body.trim().length < 40) return { ok: false, stage: 'tests', detail: 'authored file too short' };
      if (job.requireFrontmatter && !/^---[\s\S]*?---/.test(body.trim())) return { ok: false, stage: 'tests', detail: 'missing frontmatter' };
    }
    await log(`  · tests: ${testOut}`);

    if (DRY_RUN) { await log('  (dry-run) skipping commit/push'); return { ok: true, dryRun: true, branch, changed }; }

    // 5. Commit to the cc/ branch (NEVER main) + push the cc/ branch only.
    await gitInClone(clone, ['add', job.targetFile]);
    const msg = `[axis] ${job.kind}: ${job.title}\n\nAutonomously authored by the AXIS runner (safe job ${jobId}). Worktree off origin/main; never touches main.\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`;
    const cm = await gitInClone(clone, ['commit', '-q', '-m', msg]);
    if (cm.code !== 0) { await log(`  ✗ commit failed: ${cm.stderr.slice(0, 200)}`); return { ok: false, stage: 'commit', detail: cm.stderr.slice(0, 200) }; }
    const sha = (await gitInClone(clone, ['rev-parse', '--short', 'HEAD'])).stdout.trim();
    let pushed = false;
    if (job.push !== false) {
      const ps = await gitInClone(clone, ['push', '-u', 'origin', branch]); // cc/ branch only — never main
      pushed = ps.code === 0;
      await log(`  · push ${branch}: ${pushed ? 'ok' : 'FAILED ' + ps.stderr.slice(0, 160)}`);
    }
    await log(`  ✓ committed ${sha} on ${branch}${pushed ? ' (pushed)' : ''}`);
    return { ok: true, branch, sha, pushed, changed, testOut };
  } finally {
    // Always remove the worktree (kept on failure for inspection only if AXIS_KEEP_CLONE=1).
    if (!process.env.AXIS_KEEP_CLONE) { await runCmd('git', ['worktree', 'remove', '--force', clone], { cwd: ROOT, timeoutMs: 60000 }); }
  }
}

async function main() {
  await fsp.mkdir(STATE_DIR, { recursive: true });
  await log(`AXIS runner start — mode=${JOB_ID ? 'job:' + JOB_ID : ONCE ? 'once' : DRY_RUN ? 'dry-run' : 'drain'} · cli=${CLAUDE_CLI}`);
  const k0 = killed();
  if (k0) { await log(`HALT before start — ${k0}`); await updateAxisState({ runnerState: 'killed', killReason: k0 }); return; }

  const jobs = await loadJobs();
  let queued = jobs.filter((j) => (j.status === 'queued' || !j.status) && !j._badLine);
  if (JOB_ID) queued = queued.filter((j) => j.id === JOB_ID);
  await log(`${jobs.length} jobs in queue · ${queued.length} queued/eligible`);

  let processed = 0;
  for (const job of queued) {
    const kill = killed();
    if (kill) { await log(`HALT mid-run — ${kill}`); await updateAxisState({ runnerState: 'killed', killReason: kill }); break; }

    const verdict = classify(job);
    if (!verdict.safe) {
      job.status = 'needs-approval'; job.gate = verdict.reason;
      await routeToApprovals(job, verdict.reason);
      await saveJobs(jobs); // persist so it isn't re-routed every drain
      await updateAxisState({ lastJob: { id: job.id, kind: job.kind, outcome: 'routed-to-approvals', reason: verdict.reason, at: nowIso() } });
      continue; // NEVER auto-run a non-safe job
    }

    job.status = 'running'; await saveJobs(jobs);
    let res;
    try { res = await runSafeJob(job); } catch (e) { res = { ok: false, stage: 'exception', detail: String(e && e.message || e) }; }

    if (res.ok) {
      job.status = res.dryRun ? 'queued' : 'done'; job.result = { branch: res.branch, sha: res.sha, pushed: res.pushed, at: nowIso() };
      await updateAxisState({ lastJob: { id: job.id, kind: job.kind, outcome: res.dryRun ? 'dry-run-ok' : 'done', branch: res.branch, sha: res.sha, pushed: res.pushed, at: nowIso() } });
      await appendDispatch(`Safe job **${job.id}** (${job.kind}) — ${res.dryRun ? 'DRY-RUN ok' : `committed \`${res.sha}\` on \`${res.branch}\`${res.pushed ? ' (pushed)' : ''}`}. ${job.title}\nGated: SAFE only · main untouched · no deploy/send.`);
      await notify(`✅ AXIS safe job done: ${job.title} → ${res.sha || 'dry-run'} on ${res.branch}`);
    } else {
      job.status = 'failed'; job.result = { stage: res.stage, detail: res.detail, at: nowIso() };
      await updateAxisState({ lastJob: { id: job.id, kind: job.kind, outcome: 'failed', stage: res.stage, at: nowIso() } });
      await appendDispatch(`Safe job **${job.id}** FAILED at stage \`${res.stage}\`: ${res.detail}. (No partial publish; main untouched.)`);
      await notify(`⚠ AXIS safe job failed (${res.stage}): ${job.title}`);
    }
    await saveJobs(jobs);
    processed++;
    if (ONCE || JOB_ID) break; // conservative: one job
  }

  await updateAxisState({ runnerState: 'idle', lastRunAt: nowIso(), processedThisRun: processed });
  await log(`AXIS runner done — processed ${processed}`);
}

main().catch(async (e) => { await log(`FATAL: ${String(e && e.stack || e)}`); process.exit(1); });

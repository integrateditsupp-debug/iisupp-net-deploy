#!/usr/bin/env node
// Axis Local — lets AXIS do real work on your PC. Integrated IT Support Inc.
// Needs Node.js 18+. Optional: Claude Code (`claude`) signed in, for "work on it" tasks.
//   node axis-local.mjs pair <KEY>   (key from Axis → My PC → Pair this PC)
//   node axis-local.mjs              (keep running; Axis sends tasks here)
// Safety: work happens in ~/AxisWorkspace. Shell commands only run after you approve them in Axis.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SITE = process.env.AXIS_SITE || 'https://iisupp.net';
const CONFIG = path.join(os.homedir(), '.axis-local.json');
const WORK = path.join(os.homedir(), 'AxisWorkspace');
const CLAUDE = process.env.CLAUDE_BIN || 'claude';
const MODELS = { fast: 'haiku', balanced: 'sonnet', quality: 'opus' }; // cost-aware: cheapest that fits
fs.mkdirSync(WORK, { recursive: true });

const readCfg = () => { try { return JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch { return {}; } };
const [, , cmd, arg] = process.argv;
if (cmd === 'pair') {
  if (!arg || !arg.startsWith('axl_')) { console.log('Paste the key from Axis → My PC → Pair this PC.'); process.exit(1); }
  fs.writeFileSync(CONFIG, JSON.stringify({ key: arg }), { mode: 0o600 });
  console.log('Paired. Now run: node axis-local.mjs'); process.exit(0);
}
const { key } = readCfg();
if (!key) { console.log('Not paired yet. Run: node axis-local.mjs pair <KEY>'); process.exit(1); }

async function call(body) {
  const r = await fetch(`${SITE}/api/axis/exec`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-axis-device': key },
    body: JSON.stringify({ platform: `${os.platform()} ${os.release()}`, ...body }),
  });
  if (r.status === 401) { console.log('This PC was removed from Axis. Pair again.'); process.exit(1); }
  return r.json();
}

function run(file, args, opts = {}) {
  return new Promise((resolve) => {
    let out = '';
    const p = spawn(file, args, { cwd: WORK, shell: opts.shell || false, windowsHide: true });
    const t = setTimeout(() => { p.kill(); out += '\n[stopped after 15 minutes]'; }, 15 * 60e3);
    p.stdout?.on('data', (d) => { out += d; }); p.stderr?.on('data', (d) => { out += d; });
    p.on('error', (e) => { clearTimeout(t); resolve({ ok: false, out: e.message }); });
    p.on('close', (code) => { clearTimeout(t); resolve({ ok: code === 0, out: out.trim() || `exit ${code}` }); });
  });
}

function opener(target) {
  if (process.platform === 'win32') return run('cmd', ['/c', 'start', '""', target]);
  if (process.platform === 'darwin') return run('open', [target]);
  return run('xdg-open', [target]);
}

async function handle(job) {
  console.log(`→ ${job.kind}: ${job.title}`);
  if (job.kind === 'open') { const r = await opener(job.instructions.trim()); return { ok: r.ok, out: r.ok ? 'Opened.' : r.out }; }
  if (job.kind === 'command') return run(job.instructions, [], { shell: true }); // approved in Axis first
  // claude: real work in the AXIS workspace folder, with the model the task deserves.
  return run(CLAUDE, ['-p', `${job.instructions}\n\nWork only inside this folder. Save results as files here. Finish with a short summary of what you made.`,
    '--model', MODELS[job.tier] || 'sonnet', '--permission-mode', 'acceptEdits']);
}

console.log(`Axis Local is running. Workspace: ${WORK}`);
for (;;) {
  try {
    const r = await call({ action: 'local.poll' });
    if (r?.job) {
      const res = await handle(r.job);
      await call({ action: 'local.result', id: r.job.id, ok: res.ok, output: res.out });
      console.log(res.ok ? '  done' : '  needs attention');
      continue;
    }
  } catch (e) { console.log('Connection issue, retrying…', e.message); }
  await new Promise((s) => setTimeout(s, 4000));
}

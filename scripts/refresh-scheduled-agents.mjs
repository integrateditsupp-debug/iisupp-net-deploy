#!/usr/bin/env node
// refresh-scheduled-agents.mjs — RUN-CU (2026-10-08). Bring every Cowork DESKTOP scheduled agent up to today.
//
// The ~54 desktop automations each live in  C:\Users\Ahmad Wasee\Documents\Claude\Scheduled\<task>\SKILL.md
// (the same tree scripts/set-scheduled-models-opus.mjs swept on 2026-07-10/14). Nothing in the repo can
// change them; this script runs ON AHMAD'S MACHINE (one click: AHMAD-REFRESH-SCHEDULED-AGENTS.cmd) and
// applies, idempotently, to every SKILL.md:
//
//   1. BOOTSTRAP HEADER — a marked block at the top of the body that points the agent at the ONE
//      current-state file (docs/AGENT-BOOTSTRAP.md, tracked; senior-director-state/AGENT-BOOTSTRAP.md on
//      the operator machine), names the live branch and the dead ones, restates the six hard stops, adds
//      the catch-up rule ("if you missed runs, say so and catch up — never pretend yesterday ran") and the
//      truthfulness canary. Re-running replaces the block in place (markers), never duplicates it.
//   2. DEAD-LINE REWRITES — `cc/master-fix-2026-07-02`, `merge-v2-to-main`, `axis-command-center-v2`,
//      `cc/run-bh-2026-08-11` → `main`, with an inline "(retired; use main)" note the first time.
//   3. MODEL (optional) — `--model <name>` sets the frontmatter `model:`; without the flag the model is
//      left exactly as it is. The fleet was moved to `opus` on 2026-07-02 because the shared Fable model hit
//      the usage limit and paused everything for a day — flipping it back is Ahmad's call, hence the flag.
//
// Rule 15: additive only — the task's own prompt is never shortened, reordered or removed.
// Rule 14: prints an audit table of exactly what changed per task; `--dry` writes nothing.
//
//   node scripts/refresh-scheduled-agents.mjs                 # apply header + dead-line rewrites
//   node scripts/refresh-scheduled-agents.mjs --dry           # show what would change, write nothing
//   node scripts/refresh-scheduled-agents.mjs --model opus    # also pin the model
//   node scripts/refresh-scheduled-agents.mjs --root <dir>    # another Scheduled/ tree (tests use this)
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const modelIdx = argv.indexOf('--model');
const MODEL = modelIdx >= 0 ? String(argv[modelIdx + 1] || '').trim() : '';
const rootIdx = argv.indexOf('--root');
const ROOT = rootIdx >= 0 ? argv[rootIdx + 1] : defaultRoot();

export const HEADER_START = '<!-- iis-agent-bootstrap:start (RUN-CU 2026-10-08 — do not hand-edit; re-run scripts/refresh-scheduled-agents.mjs) -->';
export const HEADER_END = '<!-- iis-agent-bootstrap:end -->';
export const DEAD_LINES = ['cc/master-fix-2026-07-02', 'merge-v2-to-main', 'axis-command-center-v2', 'cc/run-bh-2026-08-11'];

export function bootstrapHeader(today = new Date().toISOString().slice(0, 10)) {
  return [
    HEADER_START,
    `> **Bootstrap (${today}).** Before anything else read \`senior-director-state/AGENT-BOOTSTRAP.md\` (operator machine) or \`docs/AGENT-BOOTSTRAP.md\` (any clone of the public repo) — date, live branch, retired branches, what shipped in RUN-CU, what is in progress, the paused list. Then run \`node scripts/agent-preflight.mjs\`.`,
    '> **Branch:** work on `main` (fetch it fresh). Dead lines — never build on, watch, or verify against: `cc/master-fix-2026-07-02`, `merge-v2-to-main`, `axis-command-center-v2`, `cc/run-bh-2026-08-11`. Build work goes on a fresh `cc/<topic>-<date>` branch; commits/pushes/publishes stay Ahmad\'s.',
    '> **Catch up, honestly:** if your last run failed, was paused, or a gap of days exists, say so in the first line of your result and cover the gap — never pretend yesterday ran. A reading you could not take is reported as "not taken", never as a number.',
    '> **Six hard stops (escalate, never do):** external send/submit/apply/sign · account or portal registration · payment, paid API, ads · production publish, push to `main`, deploy · deletion / history rewrite / Rule-15 removal of any tab, feature, section or content · legal, financial, medical, privacy or compliance claims and any fake proof. Never mention Raymond James. `**/Private pics and Vids/**` is off limits.',
    '> **New since your last instructions (RUN-CU, 2026-10-08):** ARIA Sentinel 0.2.0 — setup wizard (identity, contacts, autonomy level, approver, report recipients, maintenance window), approvals answerable in-app or from a signed email link, content-blind notifications, on-device multi-turn voice; `/aria` tap-to-speak is a real conversation; backend account actions need a magic-link token; `netlify/functions/lib/notify.mjs` is the one notification helper. All of it is on `cc/run-cu-2026-10-08` until Ahmad merges/publishes — do not claim it is live until `docs/AGENT-BOOTSTRAP.md` says so.',
    '> **End every result with the canary line that is TRUE:** `I have read obsidian Romean` (you opened the vision note / bootstrap) or `for this task I did not need to read obsidian romean`.',
    HEADER_END,
  ].join('\n');
}

function defaultRoot() {
  if (process.platform === 'win32') return 'C:\\Users\\Ahmad Wasee\\Documents\\Claude\\Scheduled';
  return join(os.homedir(), 'Documents', 'Claude', 'Scheduled');
}

/** Pure: apply the refresh to one SKILL.md text. Returns { text, changes[] }. */
export function refreshSkillText(text, { model = '', today } = {}) {
  const changes = [];
  const nl = /\r\n/.test(text) ? '\r\n' : '\n';
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  let head = '';
  let body = text;
  if (fm) { head = fm[0]; body = text.slice(fm[0].length); }

  // 1. header block — insert or replace in place
  const header = bootstrapHeader(today).split('\n').join(nl);
  const startIdx = body.indexOf(HEADER_START);
  if (startIdx >= 0) {
    const endIdx = body.indexOf(HEADER_END, startIdx);
    if (endIdx >= 0) {
      const old = body.slice(startIdx, endIdx + HEADER_END.length);
      if (old !== header) { body = body.slice(0, startIdx) + header + body.slice(endIdx + HEADER_END.length); changes.push('header refreshed'); }
      else changes.push('header current');
    } else { body = header + nl + nl + body; changes.push('header inserted (unterminated old marker left as text)'); }
  } else {
    body = header + nl + nl + body.replace(/^\s*\r?\n/, '');
    changes.push('header inserted');
  }

  // 2. dead-line rewrites (outside the header block, which names them on purpose)
  const hStart = body.indexOf(HEADER_START), hEnd = body.indexOf(HEADER_END) + HEADER_END.length;
  const before = body.slice(0, hStart), block = body.slice(hStart, hEnd); let after = body.slice(hEnd);
  let rewrites = 0;
  for (const dead of DEAD_LINES) {
    // (?<!\(was ) — an occurrence already inside our own "main (was <dead>, retired …)" note is left alone,
    // which is what makes a second pass a no-op.
    const re = new RegExp('(?<!\\(was )' + dead.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'g');
    let first = true;
    after = after.replace(re, () => { rewrites++; const r = first ? `main (was ${dead}, retired 2026-10-08)` : 'main'; first = false; return r; });
  }
  if (rewrites) changes.push(`${rewrites} dead-branch reference(s) → main`);
  body = before + block + after;

  // 3. model pin (optional)
  if (model) {
    if (head) {
      const modelLine = head.match(/^model:\s*(.+)$/m);
      if (modelLine && modelLine[1].trim() === model) changes.push(`model ${model} (already)`);
      else if (modelLine) { head = head.replace(modelLine[0], `model: ${model}`); changes.push(`model ${modelLine[1].trim()} → ${model}`); }
      else { head = head.replace(/^---\r?\n([\s\S]*?)(\r?\n)---/, (_, b, n) => `---${n}${b}${n}model: ${model}${n}---`); changes.push(`model none → ${model}`); }
    } else changes.push('no frontmatter — model not pinned');
  }
  return { text: head + body, changes };
}

export function refreshTree(root, opts = {}) {
  const rows = [];
  if (!existsSync(root)) return { rows, error: `not found: ${root}` };
  for (const dir of readdirSync(root)) {
    const f = join(root, dir, 'SKILL.md');
    if (!existsSync(f) || !statSync(f).isFile()) continue;
    const t = readFileSync(f, 'utf8');
    const { text, changes } = refreshSkillText(t, opts);
    const changed = text !== t;
    if (changed && !opts.dry) writeFileSync(f, text);
    rows.push({ task: dir, changed, changes });
  }
  return { rows };
}

const isMain = process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href.replace(/\/{3,}/, '///');
if (isMain || (process.argv[1] && process.argv[1].endsWith('refresh-scheduled-agents.mjs'))) {
  const { rows, error } = refreshTree(ROOT, { dry: DRY, model: MODEL });
  if (error) { console.error(error); process.exit(2); }
  for (const r of rows) console.log(r.task.padEnd(44), (r.changed ? (DRY ? 'WOULD CHANGE: ' : 'CHANGED: ') : 'unchanged: ') + r.changes.join(' · '));
  console.log('---');
  console.log(`${rows.length} task(s) · ${rows.filter((r) => r.changed).length} ${DRY ? 'would change' : 'changed'}${MODEL ? ` · model pin: ${MODEL}` : ' · model untouched (use --model <name>)'}${DRY ? ' · DRY RUN, nothing written' : ''}`);
}

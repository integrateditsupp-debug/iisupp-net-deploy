// tests/ceo-critical-items-ledger.test.mjs — RUN-CU / CU6 (2026-10-09).
// The CEO-critical ledger is parsed by ONE module and surfaced at the top of the hourly digest, red.
// Everything here reads a fixture in a scratch dir; the operator record root is never opened.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeScratchDir } from '../scripts/lib/scratch-dir.mjs';
import { STATE_DIR } from '../scripts/autonomy-supervisor-core.mjs';
import {
  CEO_CRITICAL_ITEMS_FILE, DUE_SOON_DAYS, parseDeadline, parseLedger, classify, sortByUrgency,
  loadCriticalItems, renderCriticalBlock, renderCriticalHtml,
} from '../scripts/lib/ceo-critical-items.mjs';

let n = 0; const ok = (name) => { n++; console.log(`  ok — ${name}`); };
const tmp = makeScratchDir('ceo-critical-');
const NOW = new Date('2026-10-09T17:00:00Z'); // 13:00 EDT on the day the fixture's first deadline passed

// 1. the default path is the ledger inside the operator record root (STATE_DIR), nowhere else
assert.equal(CEO_CRITICAL_ITEMS_FILE, path.join(STATE_DIR, 'CEO-CRITICAL-ITEMS.md'));
ok('default path is CEO-CRITICAL-ITEMS.md under the operator record root');

// 2. deadline parsing: bold ISO datetime with offset, bold date-only, none/not recorded (even with a date in brackets)
assert.equal(parseDeadline('**2026-10-09T12:00-04:00**').iso, '2026-10-09T12:00-04:00');
assert.equal(parseDeadline('**2026-10-09T12:00-04:00**').at.toISOString(), '2026-10-09T16:00:00.000Z');
assert.equal(parseDeadline('**2026-10-13**').dateOnly, true);
assert.equal(parseDeadline('none (CDIC 2026-10-29)'), null);
assert.equal(parseDeadline('not recorded (the source says "7-day")'), null);
assert.equal(parseDeadline(''), null);
ok('deadline cells: datetime+offset, date-only, and the undated spellings');

// 3. a fixture ledger in the real row format
const ledger = `# CEO-CRITICAL ITEMS

## Open

| # | what | who is waiting | deadline | category | source file | one-click | found by · on | status |
|---|---|---|---|---|---|---|---|---|
| 1 | Answer the agency RFP question | the agency's procurement desk | **2026-10-09T12:00-04:00** | deadline-14d | \`a.md\` | none | Cowork · 2026-10-09 | open |
| 2 | Run the merge one-click | every customer-facing fix | none (oldest 58 days) | credential | \`b.md\` | \`AHMAD-MERGE-RUN-CU.cmd\` | Cowork · 2026-10-09 | open |
| 3 | Ship the ESU page | inbound prospects | **2026-10-13** | deadline-14d | \`c.md\` | none | Cowork · 2026-10-09 | open |
| 4 | Two warm leads due a follow-up | two accepted contacts | not recorded | person-waiting | \`d.md\` | none — his send | Cowork · 2026-10-09 | open |
| 5 | Far-off close | the bid lane | **2026-12-20** | deadline | \`e.md\` | none | Cowork · 2026-10-09 | open |

## Watch — enters the window later
- 2026-10-15 → CDIC RFSA closes **2026-10-29**.

## Parked
(none)

## Closed
(none yet)
`;
const file = path.join(tmp, 'ledger.md');
fs.writeFileSync(file, ledger.replace(/\n/g, '\r\n')); // CRLF on purpose: the file lives on Windows
const parsed = parseLedger(fs.readFileSync(file, 'utf8'));
assert.equal(parsed.items.length, 5, 'five open rows');
assert.equal(parsed.watch.length, 1, 'one watch bullet');
assert.equal(parsed.items[1].oneClick, 'AHMAD-MERGE-RUN-CU.cmd');
assert.equal(parsed.items[0].deadline.iso, '2026-10-09T12:00-04:00');
assert.equal(parsed.items[1].deadline, null);
ok('ledger rows parsed (CRLF tolerated, backticks/bold stripped, only ## Open is a table)');

// 4. urgency: overdue / due-soon / person-waiting / open / dated, and the sort puts overdue first
const classed = sortByUrgency(classify(parsed.items, NOW));
assert.deepEqual(classed.map((i) => [i.n, i.urgency]), [[1, 'overdue'], [3, 'due-soon'], [4, 'person-waiting'], [2, 'open'], [5, 'dated']]);
assert.equal(classed[1].daysLeft, 4, 'Oct 13 is 4 days from Oct 9');
assert.ok(DUE_SOON_DAYS === 14, 'the policy window is 14 days');
ok('urgency classes + ordering: overdue → due-soon → person-waiting → open → dated');

// 5. the Markdown block: 🔴 on every row, OVERDUE named, one-click named, undated clicks omitted, watch list present
const loaded = loadCriticalItems(file, NOW);
const block = renderCriticalBlock(loaded, { now: NOW });
assert.ok(block.startsWith('## 🔴 CEO-CRITICAL — 5 open · 1 overdue · 1 due within 14 days · 1 with a person waiting'), block.split('\n')[0]);
assert.ok(/\[OVERDUE 2026-10-09T12:00-04:00\] #1/.test(block));
assert.ok(/\[due 2026-10-13 \(4d\)\] #3/.test(block));
assert.ok(/click: AHMAD-MERGE-RUN-CU\.cmd/.test(block));
assert.ok(!/click: none/.test(block), 'a "none" one-click is not printed as a click');
assert.equal((block.match(/🔴/g) || []).length, 6, 'heading + five rows');
assert.ok(/Watch \(not yet critical\): 2026-10-15/.test(block));
ok('Markdown block: red marker on every row, overdue/due labels, clicks, watch list');

// 6. the HTML block carries literal red
const html = renderCriticalHtml(loaded, { now: NOW });
assert.ok(/color:#c00000/.test(html) && /OVERDUE 2026-10-09T12:00-04:00/.test(html) && /&amp;|AHMAD-MERGE/.test(html));
ok('HTML block is red and escaped');

// 7. missing ledger → a red "missing" block, never silence
const missing = loadCriticalItems(path.join(tmp, 'nope.md'), NOW);
assert.equal(missing.missing, true);
assert.ok(/ledger not found/.test(renderCriticalBlock(missing, { now: NOW })));
ok('absent ledger is reported in red, not swallowed');

// 8. the hourly digest agent puts the block at the top and reports the counts
const agent = fs.readFileSync(new URL('../scripts/ceo-action-digest-agent.mjs', import.meta.url), 'utf8');
assert.ok(/loadCriticalItems\(\)/.test(agent) && /renderCriticalBlock\(critical\)/.test(agent), 'digest agent loads + renders the ledger');
assert.ok(/Updated: \$\{nowIso\}\n\n\$\{criticalBlock\}/.test(agent), 'the block is the first thing after the Updated line');
assert.ok(/criticalOverdue/.test(agent) && /criticalOpen: critical\.items\.length/.test(agent), 'counts reach the agent report');
ok('digest agent wiring: block first, counts in metrics');

// 9. the CLI exists, reads only, and exits 2 on a missing ledger
const cli = fs.readFileSync(new URL('../scripts/ceo-critical-items.mjs', import.meta.url), 'utf8');
assert.ok(/--json/.test(cli) && /--html/.test(cli) && /process\.exit\(loaded\.missing \? 2 : 0\)/.test(cli));
assert.ok(!/writeFile|appendFile/.test(cli), 'the CLI never writes');
ok('CLI: --json/--html, read-only, exit 2 when the ledger is missing');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`ceo-critical-items-ledger test passed (${n} groups).`);

// tests/refresh-scheduled-agents.test.mjs — RUN-CU (2026-10-08).
// The desktop-fleet refresh is idempotent, additive, and never rewrites the task's own prompt.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeScratchDir } from '../scripts/lib/scratch-dir.mjs';
import { refreshSkillText, refreshTree, bootstrapHeader, HEADER_START, HEADER_END, DEAD_LINES } from '../scripts/refresh-scheduled-agents.mjs';

let n = 0; const ok = (name) => { n++; console.log(`  ok — ${name}`); };

const original = `---
name: client-ready-flywheel
description: hourly Cowork↔CC flywheel
model: opus
---
# Flywheel

Check out cc/master-fix-2026-07-02 and verify the last CC run. If merge-v2-to-main moved, rebase.
Then release the next RUN.
`;

// 1. header inserted once, body preserved verbatim after it, model untouched without the flag
const r1 = refreshSkillText(original, { today: '2026-10-08' });
assert.ok(r1.text.includes(HEADER_START) && r1.text.includes(HEADER_END), 'markers present');
assert.ok(r1.text.startsWith('---\nname: client-ready-flywheel'), 'frontmatter untouched and first');
assert.ok(r1.text.includes('model: opus'), 'model untouched without --model');
assert.ok(r1.text.includes('Then release the next RUN.'), 'the task prompt is preserved');
assert.ok(r1.changes.includes('header inserted'), 'reports the insert');
ok('header inserted below the frontmatter; prompt + model preserved');

// 2. dead lines rewritten to main outside the header, named inside it
assert.ok(/Check out main \(was cc\/master-fix-2026-07-02, retired 2026-10-08\)/.test(r1.text), 'first mention rewritten with a note');
assert.ok(/If main \(was merge-v2-to-main, retired 2026-10-08\) moved/.test(r1.text), 'second dead line rewritten');
const headerOnly = r1.text.slice(r1.text.indexOf(HEADER_START), r1.text.indexOf(HEADER_END));
for (const d of DEAD_LINES) assert.ok(headerOnly.includes(d), `header still names ${d}`);
ok('dead branch references → main (noted), header keeps naming them');

// 3. idempotent: a second pass changes nothing
const r2 = refreshSkillText(r1.text, { today: '2026-10-08' });
assert.equal(r2.text, r1.text, 'second pass is a no-op');
assert.ok(r2.changes.includes('header current'), 'reports current');
ok('idempotent');

// 4. a newer header replaces the old block in place, never duplicates it
const r3 = refreshSkillText(r1.text.replace('Bootstrap (2026-10-08)', 'Bootstrap (2026-09-01)'), { today: '2026-10-08' });
assert.equal((r3.text.match(/iis-agent-bootstrap:start/g) || []).length, 1, 'exactly one header');
assert.ok(r3.changes.includes('header refreshed'), 'reports refresh');
ok('header replaced in place');

// 5. model pin only with the flag; CRLF files keep CRLF
const r4 = refreshSkillText(original.replace(/\n/g, '\r\n'), { today: '2026-10-08', model: 'opus' });
assert.ok(r4.changes.some((c) => /model opus \(already\)/.test(c)), 'already-pinned reported');
assert.ok(/\r\n/.test(r4.text), 'CRLF preserved');
const r5 = refreshSkillText(original.replace('model: opus\n', ''), { today: '2026-10-08', model: 'opus' });
assert.ok(/^model: opus$/m.test(r5.text) && r5.changes.some((c) => /none → opus/.test(c)), 'model added when absent');
ok('model pin is opt-in and honest');

// 6. tree sweep: dry run writes nothing, real run writes
const tmp = makeScratchDir('refresh-agents-');
fs.mkdirSync(path.join(tmp, 'task-a')); fs.writeFileSync(path.join(tmp, 'task-a', 'SKILL.md'), original);
fs.mkdirSync(path.join(tmp, 'task-b')); fs.writeFileSync(path.join(tmp, 'task-b', 'SKILL.md'), '---\nname: b\n---\nNo dead lines here.\n');
const dry = refreshTree(tmp, { dry: true, today: '2026-10-08' });
assert.equal(dry.rows.length, 2); assert.equal(fs.readFileSync(path.join(tmp, 'task-a', 'SKILL.md'), 'utf8'), original, 'dry run wrote nothing');
const real = refreshTree(tmp, { today: '2026-10-08' });
assert.ok(real.rows.every((r) => r.changed), 'both changed on the real pass');
assert.ok(fs.readFileSync(path.join(tmp, 'task-b', 'SKILL.md'), 'utf8').includes(HEADER_START), 'written');
assert.ok(refreshTree('/nonexistent/scheduled').error, 'missing root is an error, not a silent 0');
fs.rmSync(tmp, { recursive: true, force: true });
ok('tree sweep: dry vs real, missing root reported');

// 7. the header never carries a leak class the public feed would refuse (no SHA, no cc/ run names except the named dead lines)
const h = bootstrapHeader('2026-10-08');
assert.ok(!/\b[0-9a-f]{7,40}\b/i.test(h.replace(/2026-\d\d-\d\d/g, '')), 'no git SHA in the header');
ok('header carries no SHA');

console.log(`refresh-scheduled-agents test passed (${n} groups · insert · dead lines → main · idempotent · in-place refresh · opt-in model · tree sweep · no SHA).`);

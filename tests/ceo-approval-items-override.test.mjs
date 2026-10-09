// tests/ceo-approval-items-override.test.mjs — RUN-CU (2026-10-08).
// The hourly senior-director worker publishes "Immediate Ahmad Actions Still Open" from a MAINTAINED file,
// not from June-2026 literals in code. Absent/empty file → null (the worker keeps its built-in fallback).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeScratchDir } from '../scripts/lib/scratch-dir.mjs';
import { loadApprovalItemsOverride, CEO_APPROVAL_ITEMS_FILE } from '../scripts/autonomy-supervisor-core.mjs';

let n = 0; const ok = (name) => { n++; console.log(`  ok — ${name}`); };
const tmp = makeScratchDir('ceo-items-');

// 1. absent → null
assert.equal(await loadApprovalItemsOverride(path.join(tmp, 'missing.md')), null);
ok('absent file → null (worker falls back to its built-in list)');

// 2. empty / no bullets → null
const empty = path.join(tmp, 'empty.md'); fs.writeFileSync(empty, '# CEO approval items\n\nUpdated: today\n\nNo bullets here.\n');
assert.equal(await loadApprovalItemsOverride(empty), null);
ok('file without bullets → null');

// 3. bullets → items, CRLF tolerated, prose lines ignored, order kept
const f = path.join(tmp, 'items.md');
fs.writeFileSync(f, '# CEO approval items\r\n\r\n- Merge RUN-CU to `main` and push (one click: AHMAD-MERGE-RUN-CU.cmd).\r\n- Netlify publish.\r\n\r\nSome prose that is not an item.\r\n- Flip the GitHub repo private.\r\n');
const items = await loadApprovalItemsOverride(f);
assert.deepEqual(items, ['Merge RUN-CU to `main` and push (one click: AHMAD-MERGE-RUN-CU.cmd).', 'Netlify publish.', 'Flip the GitHub repo private.']);
ok('bullets parsed in order, prose ignored, CRLF tolerated');

// 4. the default path is the operator record under senior-director-state
assert.ok(/senior-director-state[\\/]ceo-approval-items\.md$/.test(CEO_APPROVAL_ITEMS_FILE), CEO_APPROVAL_ITEMS_FILE);
ok('default path is senior-director-state/ceo-approval-items.md');

// 5. the worker reads the override and no longer publishes the June literals when the file is present
const worker = fs.readFileSync(new URL('../scripts/senior-director-worker.mjs', import.meta.url), 'utf8');
assert.ok(/loadApprovalItemsOverride\(\)/.test(worker), 'worker calls the loader');
assert.ok(/approvalItemsOverride\.length \? \[/.test(worker), 'override wins when present');
assert.ok(/Jason Brown \/ Hines follow-up: approved for Friday, 2026-06-12/.test(worker), 'the old list is still there as the fallback (Rule 15)');
ok('worker wiring: override first, built-in list only as fallback');

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`ceo-approval-items-override test passed (${n} groups).`);

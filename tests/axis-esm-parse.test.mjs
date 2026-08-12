// axis-esm-parse.test.mjs — every browser module must actually PARSE as an ES module.
//
// Why this exists: on 2026-08-11 a raw newline landed inside a string literal in axis-app.js. The
// browser loads that file with <script type="module">, so it was completely dead — yet
// `node --check assets/axis-app.js` exited 0, because a bare .js with no "type" field in
// package.json is checked as CommonJS, and that path did not surface the error. Copying the same
// bytes to a .mjs failed instantly.
//
// The lesson: check the file the way the RUNTIME loads it, not the way that is convenient. These
// files are ES modules in a browser, so they get parsed as ES modules here.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'assets');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'axis-esm-'));

const mods = fs.readdirSync(ASSETS).filter((f) => f.startsWith('axis-') && f.endsWith('.js'));
assert.ok(mods.length >= 10, `expected the axis module set, found ${mods.length}`);

let failed = 0;
for (const m of mods) {
  const as_mjs = path.join(tmp, m.replace(/\.js$/, '.mjs'));
  fs.copyFileSync(path.join(ASSETS, m), as_mjs);
  try {
    execFileSync(process.execPath, ['--check', as_mjs], { stdio: 'pipe' });
  } catch (e) {
    failed++;
    console.error(`  BROKEN ${m}\n${String(e.stderr || '').split('\n').slice(0, 4).join('\n')}`);
  }
}
fs.rmSync(tmp, { recursive: true, force: true });
assert.equal(failed, 0, `${failed} asset module(s) do not parse as ES modules`);
console.log(`ok — all ${mods.length} axis modules parse as ES modules`);

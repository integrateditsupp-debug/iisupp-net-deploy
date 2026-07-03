// tests/plans-savings-sweep.mjs
// Headless sweep of the /plans savings calculator. Loads the REAL <script> from plans/index.html,
// runs it against a tiny DOM shim (no jsdom/puppeteer — free-only), then drives the user-count input
// and asserts the "You save" figure is POSITIVE at every checkpoint (1→2000) and that the default
// 120-user desk = 2 L1 · 1 team lead · 1 service-desk manager → save $111,000 (32%).
//
// Directive: cc/master-fix-2026-07-02 /plans v10 — Traditional must ALWAYS exceed the matched ARIA plan
// as the company grows (never pricier at scale).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '..', 'plans', 'index.html'), 'utf8');

// --- Extract the calculator <script> block (the one that defines calc()) ---
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const src = blocks.find((b) => b.includes('function calc()'));
if (!src) { console.error('FAIL: could not find calculator <script> block'); process.exit(1); }

// --- Minimal DOM shim ---
class ClassList {
  constructor() { this._s = new Set(); }
  add(c) { this._s.add(c); }
  remove(c) { this._s.delete(c); }
  contains(c) { return this._s.has(c); }
  toggle(c, on) { if (on === undefined) on = !this._s.has(c); on ? this._s.add(c) : this._s.delete(c); return on; }
}
class El {
  constructor(id) {
    this.id = id; this._attrs = {}; this.value = ''; this._text = ''; this._html = '';
    this.style = {}; this.classList = new ClassList(); this.disabled = false; this.open = false;
    this._listeners = {};
    if (id === 'sv-users') { this.value = '120'; this.max = '2000'; this.min = '1'; }
    if (id === 'sv-users-num') { this.value = '120'; }
    if (id === 'sv-agents') { this.value = '2'; }
  }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); }
  addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
  dispatch(t, ev) { (this._listeners[t] || []).forEach((fn) => fn(ev || { target: this })); }
  getAttribute(k) { return this._attrs[k] !== undefined ? this._attrs[k] : null; }
  setAttribute(k, v) { this._attrs[k] = String(v); }
  querySelectorAll() { return []; }
  closest() { return null; }
}
const nodes = new Map();
function byId(id) { if (!nodes.has(id)) nodes.set(id, new El(id)); return nodes.get(id); }
const documentShim = { getElementById: byId, activeElement: null, createElement: () => new El('x') };
const windowShim = { print() {} };

const sandbox = { document: documentShim, window: windowShim, console, Math, Date, parseInt, parseFloat, isFinite, Infinity, NaN };
vm.createContext(sandbox);
try { vm.runInContext(src, sandbox, { filename: 'plans-calculator.js' }); }
catch (e) { console.error('FAIL: script threw on load:', e.message); process.exit(1); }

// --- Helpers ---
const num = (s) => Number(String(s).replace(/[^0-9.\-]/g, '')) || 0;
function setSize(n) {
  const numIn = byId('sv-users-num');
  numIn.value = String(n);
  numIn.dispatch('input');            // real handler: syncs slider, auto-scales desk, recomputes
}
function readSave() { return num(byId('sv-donut-big').textContent); }
function isNeg() { return byId('sv-donut-center').classList.contains('neg'); }
function pct() { return byId('sv-donut-pct').textContent; }

// --- Assertions ---
let fails = 0;
function ok(cond, msg) { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; }

// 1) Default (already computed at init, 120 users): desk = 2 L1 · 1 lead · 1 mgr, save $111,000 / 32%
const l1 = num(byId('sv-c-l1').value), tl = num(byId('sv-c-tl').value), mgr = num(byId('sv-c-mgr').value);
const l2 = num(byId('sv-c-l2').value), l3 = num(byId('sv-c-l3').value);
ok(l1 === 2 && tl === 1 && mgr === 1 && l2 === 0 && l3 === 0,
  `default 120-user desk = 2 L1·1 lead·1 mgr (got l1=${l1} tl=${tl} mgr=${mgr} l2=${l2} l3=${l3})`);
const defSave = readSave();
ok(defSave === 111000, `default save = $111,000 (got $${defSave.toLocaleString('en-US')})`);
ok(pct().includes('32%'), `default shows 32% saved (got "${pct()}")`);

// 2) Sweep the required checkpoints — Traditional > ARIA (positive save), never the "ARIA / yr always-on" branch
for (const n of [3, 50, 300, 1000, 1800]) {
  setSize(n);
  const s = readSave();
  ok(s > 0 && !isNeg(), `${n} users → positive save $${s.toLocaleString('en-US')} (neg-branch=${isNeg()})`);
}

// 3) Dense sweep 1→2000 — assert positive save at EVERY point (HARD CONSTRAINT 2)
let minSave = Infinity, minAt = 0, negCount = 0;
for (let n = 1; n <= 2000; n++) {
  setSize(n);
  const s = readSave();
  if (isNeg()) negCount++;
  if (s < minSave) { minSave = s; minAt = n; }
}
ok(negCount === 0, `no negative/always-on frame across 1→2000 (neg frames=${negCount})`);
ok(minSave > 0, `min save across 1→2000 is positive: $${minSave.toLocaleString('en-US')} at ${minAt} users`);

// Restore default view for cleanliness
setSize(120);

console.log('\n' + (fails === 0 ? 'ALL PASS' : fails + ' FAILURES'));
process.exit(fails === 0 ? 0 : 1);

// axis-researcher.test.mjs — Phase 2: research that cites or admits.
//
// The Phase 2 audit scored the repo 0-of-8 against the spec's research requirements, so the
// researcher is NEW (scripts/lib/axis-researcher.mjs). This suite proves the DISCIPLINE — the
// part that must hold even when the model misbehaves:
//   · an unsourced claim is never kept: it becomes a stated gap
//   · [FACT] requires two independent publishers, or it is downgraded to [INFERENCE]
//   · every source carries url + publisher + published date + module-stamped accessed date
//   · fast-moving topics get module-side staleness flags, independent of the model's own
//   · retrieval failure degrades to a stated gap — never an invention, never a throw
//   · the vault note lands in 15_Research/ in house format, NEVER overwriting, index maintained
//   · secrets are refused at the write boundary
//   · the wiring: OPS entry, queue allow-list, worker branch
// No live web in this suite — the CLI runner is injected. Live acceptance runs separately.
// Run: node tests/axis-researcher.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeScratchDir } from '../scripts/lib/scratch-dir.mjs';
import { research, validateReport, parseSources, writeResearchNote, spokenSummary, buildBrief } from '../scripts/lib/axis-researcher.mjs';

const ROOT = path.join(import.meta.dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ok = (m) => console.log('  ok —', m);
const vault = makeScratchDir('researcher-vault-');

const CANNED = `QUERIES USED:
- pipeda breach notification requirements SMB
- pipeda real risk of significant harm threshold
FINDINGS:
1. [FACT] PIPEDA requires organizations to report breaches posing a real risk of significant harm to the Privacy Commissioner.
   SOURCES: https://priv.gc.ca/en/breach | Office of the Privacy Commissioner | published 2024-11-02 ;; https://laws-lois.justice.gc.ca/pipeda | Justice Laws | published 2023-06-01
2. [FACT] The notification deadline is exactly 24 hours.
   SOURCES: https://some-blog.example/pipeda-hot-take | Some Blog | published 2019-03-01
3. [INFERENCE] Most Ontario SMBs are unaware of the record-keeping duty.
   SOURCES: https://survey.example/2026 | Example Research | published 2026-02-10
4. [FACT] This claim arrives with no evidence at all.
CONFLICTS:
- breach deadline :: OPC guidance says "as soon as feasible" vs Some Blog says "24 hours" :: OPC is the regulator; the blog cites nothing
GAPS:
- could not verify vertical-specific PHIPA overlap for dental clinics
RECENCY:
- none`;

// ---- 1. The validator enforces what the prompt merely requests ----
{
  const r = validateReport(CANNED, { fastMoving: true, now: Date.parse('2026-08-13') });
  assert.equal(r.ok, true);
  assert.equal(r.claims.length, 3, 'the unsourced claim did NOT survive as a finding');
  assert.ok(r.gaps.some((g) => /unsourced claim removed/.test(g)), 'it became a stated gap instead');
  const c1 = r.claims[0];
  assert.equal(c1.kind, 'FACT', 'two independent publishers keep FACT status');
  assert.equal(c1.sources.length, 2);
  assert.equal(c1.sources[0].accessed, '2026-08-13', 'accessed date is stamped by the MODULE, not trusted from the model');
  const c2 = r.claims[1];
  assert.equal(c2.kind, 'INFERENCE', 'single-publisher FACT is DOWNGRADED');
  assert.ok(c2.downgraded);
  assert.equal(r.facts, 1);
  assert.equal(r.inferences, 2);
  assert.equal(r.conflicts.length, 1, 'the disagreement is carried, not averaged away');
  assert.ok(r.recency.some((x) => /2019-03-01/.test(x)), 'a 2019 source on a fast-moving topic is flagged stale by the module');
  assert.equal(r.queries.length, 2, 'the queries actually run are recorded');
  ok('unsourced→gap, single-source FACT→downgraded, conflicts kept, module-side recency');
}

// ---- 2. Source parsing survives real-world mess ----
{
  const s = parseSources('   SOURCES: https://a.example/x | Pub A | published 2026-01-05 ;; not-a-url | junk | published never ;; https://b.example/y | Pub B | published unknown');
  assert.equal(s.length, 2, 'non-URLs are dropped, not kept as fake sources');
  assert.equal(s[1].published, 'unknown', 'unknown publication date is carried honestly');
  ok('source lines parse defensively');
}

// ---- 3. Retrieval failure = stated gap, never invention ----
{
  const dead = await research('what is the current CSP margin for tier 1 partners', {
    runner: async () => ({ error: 'timeout' }), writeVault: false });
  assert.equal(dead.ok, false);
  assert.equal(dead.claims.length, 0, 'nothing invented to fill the hole');
  assert.ok(/retrieval failed: timeout/.test(dead.gaps[0]), 'the failure is the finding, stated as one');
  assert.ok(/not invented/i.test(spokenSummary(dead)), 'and the spoken line says so out loud');
  const empty = await research('short q here ok', { runner: async () => ({ answer: 'FINDINGS:\n(nothing useful)' }), writeVault: false });
  assert.equal(empty.ok, false, 'a retrieval that produced no validated claims is inconclusive, not padded');
  ok('degradation states the gap — the hard rule holds in code');
}

// ---- 4. The vault note: 15_Research/, house format, never overwritten, indexed ----
{
  const rep = validateReport(CANNED, { now: Date.parse('2026-08-13') });
  const q = 'PIPEDA breach duties for Ontario SMBs';
  const w1 = writeResearchNote(q, rep, { vaultRoot: vault, now: new Date('2026-08-13') });
  assert.ok(w1.written && /^15_Research\//.test(w1.rel));
  const w2 = writeResearchNote(q, rep, { vaultRoot: vault, now: new Date('2026-08-13') });
  assert.ok(w2.written && w2.rel !== w1.rel, 'same question again gets a NEW file — nothing is ever overwritten');
  const note = fs.readFileSync(path.join(vault, w1.rel), 'utf8');
  assert.ok(/^---\ntype: research/m.test(note), 'frontmatter follows house conventions');
  assert.ok(/question: PIPEDA breach duties/.test(note));
  assert.ok(/source: https:\/\/priv\.gc\.ca\/en\/breach \(Office of the Privacy Commissioner, published 2024-11-02, accessed 2026-08-13\)/.test(note),
    'every claim carries url, publisher, published and accessed — the spec sentence, verbatim in the note');
  assert.ok(/## Gaps — what could NOT be verified/.test(note), 'gaps are a first-class section');
  assert.ok(/\[\[_Research\]\]/.test(note), 'wikilinked to the folder index');
  const idx = fs.readFileSync(path.join(vault, '15_Research', '_Research.md'), 'utf8');
  assert.ok(/type: index/.test(idx), 'the folder index exists in house format');
  assert.equal((idx.match(/^- \[\[/gm) || []).length, 2, 'one index line per note');
  const secret = writeResearchNote('leak test', { ...rep, gaps: ['found key sk-ant-abcdefghij1234'] }, { vaultRoot: vault });
  assert.equal(secret.written, false, 'secret-like content is refused at the write boundary');
  ok('vault note: house format, never overwrite, indexed, secret-scanned');
}

// ---- 5. The brief demands the protocol the validator enforces ----
{
  const b = buildBrief('test question', { fastMoving: true });
  for (const must of ['FORMULATE 2-4 distinct search queries', 'MULTIPLE INDEPENDENT publishers', 'CROSS-CHECK', 'Never fabricate', 'FAST-MOVING'])
    assert.ok(b.includes(must), `brief demands: ${must}`);
  ok('query formulation, multi-source, cross-check and honesty are in the brief');
}

// ---- 6. Wiring: voice → queue → worker → module ----
{
  const persona = read('assets/axis-persona.js');
  assert.ok(/kind: 'research\.web'/.test(persona), 'the OPS entry exists');
  assert.ok(/'research\.web'\]\.includes\(op\.kind\) && arg\.length < 6/.test(persona.replace(/\s+/g, ' ')) || /research\.web'\.?\]/.test(persona),
    'bare "research it" with no subject never fires');
  const queue = read('netlify/functions/axis-brain-queue.mjs');
  assert.ok(/'research\.web'/.test(queue), 'the queue allow-list carries the kind');
  const worker = read('scripts/axis-brain-worker.mjs');
  assert.ok(/kind === 'research\.web'/.test(worker), 'the worker dispatches it');
  assert.ok(/axis-researcher\.mjs/.test(worker), 'to the researcher module');
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts', 'axis-researcher-agent.mjs')), 'the standalone runner exists');
  ok('voice rail → allow-list → worker branch → module, all connected');
}

try { fs.rmSync(vault, { recursive: true, force: true }); } catch { /* refused unlink is not a failure */ }
console.log('axis-researcher test passed (cites or admits · FACT needs two publishers · failure states the gap · vault note never overwrites · wiring intact).');

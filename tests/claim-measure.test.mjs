// tests/claim-measure.test.mjs — RUN-AM / AM1. The stamp the writer cannot type.
//
// The defect under test is not "a figure has no evidence" — RUN-AK closed that. It is subtler and it
// survived AK intact: the emit script TYPED the evidence. `measuredAt: NOW` was written by the same
// hand that copied the number off a terminal, so the stamp's only authority was the writer's.
//
// So every assertion below is about AUTHORSHIP, not presence:
//   G1  a measurable figure carrying a hand-typed stamp is REFUSED, by class name
//   G2  the same figure is accepted once a measurement function produced it
//   G3  a figure with nothing to read may still be hand-attested
//   G4  "declared unmeasurable" is honest ONLY with a reason
//   G5  a measurement must carry the read that produced it — a badge is not a measurement
//   G6  the real measurement functions perform a real read and return a stamp the caller never chose
//   G7  the emitter itself refuses the write, so this cannot be bypassed by not calling the audit
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PROVENANCE, MEASURE_CLASSES, MEASURABLE_FIGURES,
  auditProvenance, auditProvenances, requireMeasuredProvenance, unmeasuredFigures,
  measureCommand, measureFile, measureInProcess, declaredUnmeasurable,
  parseRegistryOutput, measureCommitsAhead, measureDraftedMessages,
} from '../scripts/lib/claim-measure.mjs';
import { stamp, auditClaim } from '../scripts/lib/claim-evidence.mjs';
import { emitAxisStatus } from '../scripts/lib/axis-status-emit.mjs';
import { makeScratchDir } from "../scripts/lib/scratch-dir.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const t = (name, fn) => test(name, fn);

// A name that is definitely in the measurable set, and one that definitely is not.
const MEASURABLE = 'testsPassedAfterWrites';
const NOT_MEASURABLE = 'revenueToDate';

/* ── G1 · a hand-typed stamp for a measurable figure is refused BY CLASS ────────────────────── */
t('G1 — a measurable figure carrying a hand-typed stamp is refused by class name', () => {
  assert.ok(MEASURABLE_FIGURES.has(MEASURABLE), 'fixture assumption: the figure is measurable here');
  const handTyped = stamp(563, { kind: 'test', source: 'exit code of the full registry run this cycle' });
  // It passes the OLD gate — that is the whole point. Evidence was never the missing property.
  assert.equal(auditClaim(MEASURABLE, handTyped).ok, true, 'AK-era evidence gate still passes it');
  const r = auditProvenance(MEASURABLE, handTyped);
  assert.equal(r.ok, false);
  assert.equal(r.class, MEASURE_CLASSES.HAND_TYPED_MEASURABLE);
  assert.match(r.detail, /read in this environment/);
});

t('G1b — explicitly ATTESTING a measurable figure is the same refusal, not a loophole', () => {
  const dressed = { ...stamp(563, { kind: 'test', source: 'the run' }), provenance: PROVENANCE.ATTESTED };
  const r = auditProvenance(MEASURABLE, dressed);
  assert.equal(r.ok, false);
  assert.equal(r.class, MEASURE_CLASSES.HAND_TYPED_MEASURABLE);
});

/* ── G2 · the same figure, produced by a measurement, is accepted ───────────────────────────── */
t('G2 — the same figure is accepted once a measurement produced it', () => {
  const measured = measureInProcess({
    value: 563, kind: 'test',
    source: 'exit code of the full registry run taken after every write this cycle',
    how: 'npm test (full registry) — parsed from the runner output',
  });
  const r = auditProvenance(MEASURABLE, measured);
  assert.equal(r.ok, true, r.detail || '');
  assert.equal(measured.provenance, PROVENANCE.MEASURED);
  assert.equal(measured.read.exitCode, 0);
  assert.ok(auditClaim(MEASURABLE, measured).ok, 'still satisfies the AK evidence gate');
});

/* ── G3 · a figure with nothing to read may be hand-attested ────────────────────────────────── */
t('G3 — a figure with nothing to read is allowed to be hand-attested', () => {
  assert.equal(MEASURABLE_FIGURES.has(NOT_MEASURABLE), false, 'fixture assumption');
  const r = auditProvenance(NOT_MEASURABLE, stamp('none', { kind: 'fact', source: 'no invoice has been issued' }));
  assert.equal(r.ok, true, r.detail || '');
});

/* ── G4 · unmeasurable is honest only with a reason ─────────────────────────────────────────── */
t('G4 — declared-unmeasurable without a reason is refused', () => {
  const bare = { value: null, measuredAt: new Date().toISOString(), source: 's', kind: 'count', provenance: PROVENANCE.UNMEASURABLE };
  const r = auditProvenance(MEASURABLE, bare);
  assert.equal(r.ok, false);
  assert.equal(r.class, MEASURE_CLASSES.NO_REASON);
});

t('G4b — declared-unmeasurable WITH a reason is accepted, and is reported as unmeasured', () => {
  const claims = {
    [MEASURABLE]: declaredUnmeasurable(MEASURABLE, {
      reason: 'the runner did not complete in this environment, so no exit code exists to read',
      lastKnown: 544,
    }),
  };
  assert.equal(auditProvenances(claims).ok, true);
  const un = unmeasuredFigures(claims);
  assert.equal(un.length, 1);
  assert.equal(un[0].name, MEASURABLE);
  assert.match(claims[MEASURABLE].note, /last known/i, 'a carried value is labelled, never presented as current');
});

t('G4c — declaredUnmeasurable refuses to be constructed without a reason', () => {
  assert.throws(() => declaredUnmeasurable('x', {}), /reason is required/);
});

/* ── G5 · a measurement must carry the read that produced it ────────────────────────────────── */
t('G5 — a "measured" badge with no command behind it is refused', () => {
  const badge = { ...stamp(563, { kind: 'test', source: 's' }), provenance: PROVENANCE.MEASURED };
  const r = auditProvenance(MEASURABLE, badge);
  assert.equal(r.ok, false);
  assert.equal(r.class, MEASURE_CLASSES.NO_READ);
});

t('G5b — a command with no exit code behind it is refused', () => {
  const half = { ...stamp(563, { kind: 'test', source: 's' }), provenance: PROVENANCE.MEASURED, read: { command: 'npm test' } };
  assert.equal(auditProvenance(MEASURABLE, half).class, MEASURE_CLASSES.NO_READ);
});

t('G5c — an undeclared provenance class is refused as its own failure', () => {
  const weird = { ...stamp(1, { kind: 'count', source: 's' }), provenance: 'vibes' };
  assert.equal(auditProvenance(NOT_MEASURABLE, weird).class, MEASURE_CLASSES.UNKNOWN_PROVENANCE);
});

/* ── G6 · the measurement functions actually read something ─────────────────────────────────── */
t('G6 — measureCommand takes its own stamp from a real process, and the caller supplies neither value nor time', () => {
  const before = Date.now();
  const m = measureCommand({
    command: process.execPath, args: ['-e', 'process.stdout.write("41\\n")'],
    parse: (out) => Number(out.trim()) + 1,
    source: 'a node process run during this test',
    kind: 'count',
  });
  assert.equal(m.value, 42, 'the value came out of the process, not out of the call site');
  assert.equal(m.provenance, PROVENANCE.MEASURED);
  assert.equal(m.read.exitCode, 0);
  assert.ok(m.read.command.includes('-e'));
  const at = new Date(m.measuredAt).getTime();
  assert.ok(at >= before && at <= Date.now() + 1000, 'the stamp is this function\'s clock, taken after the read');
});

t('G6b — a failed read does NOT silently produce a figure', () => {
  assert.throws(() => measureCommand({
    command: process.execPath, args: ['-e', 'process.exit(3)'],
    parse: () => 999, source: 'a deliberately failing process',
  }), /exited 3/);
});

t('G6c — a failure that IS the measurement is allowed, and records the non-zero code', () => {
  const m = measureCommand({
    command: process.execPath, args: ['-e', 'process.exit(7)'],
    parse: (_out, code) => code !== 0, source: 'a probe whose refusal is the finding',
    kind: 'blocker', allowNonZeroExit: true,
  });
  assert.equal(m.value, true);
  assert.equal(m.read.exitCode, 7);
});

t('G6d — measureFile reads the file itself and records the byte count', () => {
  const dir = makeScratchDir('claim-measure-');
  fs.writeFileSync(path.join(dir, 'sheet.md'), '1. a\n2. b\n3. c\n');
  const m = measureDraftedMessages({ root: dir, file: 'sheet.md' });
  assert.equal(m.value, 3, 'counted from the file, not asserted');
  assert.equal(m.read.exitCode, 0);
  assert.ok(m.read.bytes > 0);
  const missing = measureFile({ root: dir, file: 'nope.md', parse: () => 1, source: 's' });
  assert.equal(missing.value, null, 'an unreadable file yields no figure rather than a made-up one');
  assert.equal(missing.read.exitCode, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

t('G6e — parseRegistryOutput reads the runner\'s own numbers and returns null where they are absent', () => {
  const r = parseRegistryOutput('# tests 563\n# pass 563\n# fail 0\n334/334 suites green.\n');
  assert.deepEqual(r, { pass: 563, fail: 0, suites: 334, suitesTotal: 334 });
  const empty = parseRegistryOutput('nothing useful here');
  assert.deepEqual(empty, { pass: null, fail: null, suites: null, suitesTotal: null });
});

t('G6f — measureCommitsAhead runs a real revision count against this repository', () => {
  let m = null;
  try { m = measureCommitsAhead({ root: ROOT, ref: 'HEAD' }); } catch { m = null; }
  if (m === null) { console.log('    (skipped — no git in this environment)'); return; }
  assert.equal(m.value, 0, 'HEAD..HEAD is zero by definition — the count came from git, not from us');
  assert.equal(m.provenance, PROVENANCE.MEASURED);
  assert.match(m.read.command, /^git rev-list/);
});

/* ── G7 · the emitter refuses the write, so the audit cannot be skipped ─────────────────────── */
t('G7 — emitAxisStatus REFUSES a payload whose measurable figure was hand-typed, and writes nothing', () => {
  const dir = makeScratchDir('claim-measure-emit-');
  const publicFields = {
    status: 'active build', milestone: 'm', readiness: 'r', revenueToDate: 'none',
    headline: 'h', generatedAt: new Date().toISOString(),
  };
  assert.throws(
    () => emitAxisStatus({
      root: dir, publicFields,
      fullDetail: { claims: { [MEASURABLE]: stamp(563, { kind: 'test', source: 'a terminal I looked at' }) } },
    }),
    /claim provenance REFUSED/,
  );
  assert.equal(fs.existsSync(path.join(dir, 'public/.well-known/axis/status.json')), false, 'the refusal wrote nothing');
  assert.equal(fs.existsSync(path.join(dir, 'netlify/functions/_axis-status-full.json')), false);

  // ...and the identical payload goes through once the figure is measured.
  const ok = emitAxisStatus({
    root: dir, publicFields,
    fullDetail: {
      claims: {
        [MEASURABLE]: measureInProcess({ value: 563, kind: 'test', source: 'the registry exit code this cycle', how: 'npm test' }),
      },
    },
  });
  assert.equal(ok.written.public.length, 2);
  const full = JSON.parse(fs.readFileSync(path.join(dir, 'netlify/functions/_axis-status-full.json'), 'utf8'));
  assert.equal(full.claims[MEASURABLE].provenance, PROVENANCE.MEASURED);
  assert.deepEqual(full.unmeasuredFigures, [], 'nothing was declared unmeasurable in this payload');
  fs.rmSync(dir, { recursive: true, force: true });
});

t('G7b — requireMeasuredProvenance names every offending figure, not just the first', () => {
  assert.throws(() => requireMeasuredProvenance({
    testsPassedAfterWrites: stamp(1, { kind: 'test', source: 's' }),
    commitsAheadOfSharedLine: stamp(2, { kind: 'count', source: 's' }),
  }), (e) => /testsPassedAfterWrites/.test(e.message) && /commitsAheadOfSharedLine/.test(e.message) && /2 figure/.test(e.message));
});


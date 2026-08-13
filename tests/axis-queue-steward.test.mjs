// tests/axis-queue-steward.test.mjs — the duty nobody had (2026-08-12).
//
// Ahmad: "what type of tasks is it working on without my interaction... anything else we can have
// it do from our companies workflow?"
//
// The answer turned out to be a gap rather than a missing feature. The fleet was healthy: 23 Netlify
// crons, 8 Windows tasks, a supervisor refreshing every few minutes. What nobody owned was the
// QUEUE. On the day this was written the supervisor reported "Approval items still open: 31" and
// carried on — while 25 of those 31 were the identical decision, generated in a three-day burst in
// June, untouched for two months. Producing more of a jammed category is waste that looks like work.
//
// What this protects:
//   · identical decisions collapse, so 25 asks reach Ahmad as 1
//   · a jammed category tells producers to STOP, at 6 rather than at 25
//   · age is reported, not silently re-listed
//   · a log failing daily for weeks is surfaced, and the date regex that hid it stays fixed
//   · the steward stays READ-ONLY — it must never approve, send, park or delete
// Run: node tests/axis-queue-steward.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = await import(pathToFileURL(path.join(root, 'scripts', 'lib', 'axis-queue-steward.mjs')).href);
let n = 0; const ok = () => { n++; };

const NOW = new Date('2026-08-12T12:00:00Z').getTime();

// The real shape the supervisor writes: text + category + ownerAction.
const slice = (name, date) => ({
  text: `New local-only ${name} slice: \`senior-director-state/staged-${name.toLowerCase().replace(/\s+/g, '-')}-review-${date}.md\` is ready for Ahmad to approve publish or hold local only.`,
  category: 'publish',
  ownerAction: 'Approve publish or hold local only',
});

// ---- 1. Identical decisions collapse ----
{
  const items = [
    slice('Start Here route-guide', '2026-06-12'),
    slice('overflow conversion', '2026-06-11'),
    slice('Outlook Fix Guide', '2026-06-13'),
    { text: 'RBC supplier registration: CAPTCHA and final Register click remain.', category: 'portal submit', ownerAction: 'Complete portal submission' },
  ];
  const groups = S.collapse(items, { now: NOW });
  assert.equal(groups.length, 2, `expected 2 decisions, got ${groups.length}`);
  assert.equal(groups[0].count, 3, 'the three publish slices did not collapse into one decision');
  assert.equal(groups[0].category, 'publish');
  ok();

  // The subject must NOT distinguish them — that was the original bug. Deriving the shape from the
  // free text let "Start Here route-guide" and "overflow conversion" read as different decisions.
  assert.equal(S.fingerprint(items[0]), S.fingerprint(items[1]),
    'two identical decisions about different slices produced different fingerprints');
  assert.notEqual(S.fingerprint(items[0]), S.fingerprint(items[3]),
    'a publish decision and a portal submission must not collapse together');
  ok();
}

// ---- 2. Backpressure fires at 6, not at 25 ----
{
  const five = Array.from({ length: 5 }, (_, i) => slice(`slice ${i}`, '2026-06-12'));
  const six = Array.from({ length: 6 }, (_, i) => slice(`slice ${i}`, '2026-06-12'));
  const p5 = S.backpressure(five, { now: NOW });
  const p6 = S.backpressure(six, { now: NOW });
  assert.equal(p5[0].verdict, 'watch', 'five pending should be a warning, not a jam');
  assert.equal(p6[0].verdict, 'jammed', 'six pending is a jam — catching it at 25 is too late');
  assert.match(p6[0].advice, /stop producing/i, 'the advice must tell producers to stop');
  ok();
}

// ---- 3. Age is measured, including from a date buried in a filename ----
{
  // These items carry no timestamp field at all — their only date is inside the staged filename.
  const a = S.ageDays(slice('x', '2026-06-11'), NOW);
  assert.ok(a >= 61 && a <= 63, `expected ~62 days, got ${a}`);
  ok();
  assert.equal(S.ageDays({ text: 'no date anywhere' }, NOW), null, 'undated must be null, not 0');
  ok();
}

// ---- 4. The date regex that hid a 22-day outage ----
// `\b` fails between the "1" of 2026-07-21 and the "T" of the timestamp, because both are word
// characters. Every line in pull.log went undated, so the streak read as zero and the outage was
// invisible for three weeks.
{
  const log = [
    '[2026-08-08T20:35:56] ERROR: Export failed: 502',
    '[2026-08-10T09:00:01] ERROR: Export failed: 502',
    '[2026-08-11T09:00:01] ERROR: Export failed: 502',
    '[2026-08-12T09:00:01] ERROR: Export failed: 502',
  ].join('\n');
  const f = S.failureStreak(log, { now: NOW });
  assert.equal(f.failing, true, 'a log erroring today must read as a live failure');
  assert.ok(f.streakDays >= 4, `expected a streak of 4+, got ${f.streakDays} — the ISO date is not parsing`);
  assert.equal(f.lastSeen, '2026-08-12');
  assert.match(f.sample, /502/);
  ok();

  // History is not an incident.
  const old = '[2026-03-01T09:00:01] ERROR: Export failed: 502';
  assert.equal(S.failureStreak(old, { now: NOW }).failing, false, 'a months-old error is not a live failure');
  ok();

  // A clean log is clean.
  assert.equal(S.failureStreak('[2026-08-12T09:00:01] pulled 41 bits OK', { now: NOW }).failing, false);
  ok();

  // RECOVERED. A job fixed today still has today's error in its log, so a date-based check keeps
  // reporting it as broken for two more days. Anything logged after the last error means a later
  // run got further — this is the exact shape of pull.log after the 502 was fixed on 2026-08-12,
  // where the success line ("Done. Wrote 800 bits") carries no timestamp of its own.
  const fixed = [
    '[2026-08-11T09:00:01] ERROR: Export failed: 502',
    '[2026-08-12T09:00:01] ERROR: Export failed: 502',
    '[2026-08-12T11:50:29] Pulling live bit-KB from https://iisupp.net/...',
    'Done. Wrote 800 bits to aria_brain_pack/bits/ (manifest updated).',
  ].join('\n');
  const r = S.failureStreak(fixed, { now: NOW });
  assert.equal(r.failing, false, 'a job that ran successfully after its last error is not failing');
  assert.equal(r.recovered, true, 'recovery should be reported explicitly');
  ok();
}

// ---- 5. The whole report, and the spoken line ----
{
  const items = [
    ...Array.from({ length: 25 }, (_, i) => slice(`slice ${i}`, '2026-06-12')),
    { text: 'Send when ready', category: 'send', ownerAction: 'Send when ready' },
  ];
  const rep = S.steward({
    items,
    logs: { 'ARIA KB pull': '[2026-08-11T09:00:01] ERROR: Export failed: 502\n[2026-08-12T09:00:01] ERROR: Export failed: 502\n[2026-08-10T09:00:01] ERROR: Export failed: 502' },
    now: NOW,
  });
  assert.equal(rep.total, 26);
  assert.ok(rep.collapsedTo < rep.collapsedFrom, 'the report did not collapse anything');
  assert.equal(rep.jammed.length, 1, 'publish should be the one jammed category');
  assert.equal(rep.parkable, 25, '25 items 45+ days old should be flagged parkable');
  ok();

  const said = S.spokenSummary(rep);
  assert.ok(said.length < 200, 'the spoken line must stay short enough to say out loud');
  assert.match(said, /jammed/i);
  ok();
}

// ---- 6. The steward is READ-ONLY ----
// It reports on Ahmad's approval queue. If it ever gains the ability to approve, send, park or
// delete, the approval rules it exists to serve stop meaning anything.
{
  const src = fs.readFileSync(path.join(root, 'scripts', 'lib', 'axis-queue-steward.mjs'), 'utf8')
    + fs.readFileSync(path.join(root, 'scripts', 'axis-queue-steward.mjs'), 'utf8');
  const code = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  for (const forbidden of ['unlink', 'rmSync', 'rmdir', 'sendMail', 'fetch(', 'execSync', 'spawn(']) {
    assert.ok(!code.includes(forbidden),
      `the steward must stay read-only — found "${forbidden}"`);
  }
  // The only writes it may make are its own two digests.
  const writes = code.match(/writeFileSync\(/g) || [];
  assert.ok(writes.length <= 2, `the steward writes ${writes.length} files; it should write only its digests`);
  ok();
}

console.log(`axis-queue-steward: ${n} checks passed`);

// vision-log-triage.test.mjs — STAGE 2: a dropped LOG is read like a technician reads it.
// Offline, $0, no network, no model call.   node --test tests/vision-log-triage.test.mjs
//
// What this proves:
//   1. Realistic logs are triaged to the lines that actually indicate failure — NOT the first
//      4000 characters of banner text.
//   2. Repeats collapse into one finding with a real count; severity outranks volume.
//   3. Rule 14: a clean log ABSTAINS, a binary log ABSTAINS, and every finding shown is a
//      VERBATIM line that exists in the input.
//   4. Triage actually improves retrieval end-to-end against the real KB.
//   5. PII/secrets in a log are still redacted before the query is built.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  triageLog, detectLogFormat, lineSignature, extractLogSignals, isUnreadableBinary,
} from '../netlify/functions/lib/vision-log-triage.mjs';
import { buildProblemDescription, diagnoseInput } from '../netlify/functions/lib/vision-diagnose-core.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const KB = JSON.parse(readFileSync(join(__dir, '..', 'assets', 'aria-kb-chunks.json'), 'utf8'));
const CHUNKS = KB.chunks || KB;

// ── Fixtures: shaped like the real thing — long, noisy, failure buried well past char 4000 ──
function banner(lines, text) {
  const out = [];
  for (let i = 0; i < lines; i++) {
    out.push('"Information","7/2' + (i % 9) + '/2026 8:' + String(i % 60).padStart(2, '0')
      + ':11 AM","Service Control Manager","7036","None","' + text + ' ' + i + '"');
  }
  return out.join('\n');
}

// A Windows Event Log CSV export: header, 300 Information rows, then the actual repeated fault.
const EVENT_CSV = [
  '"Level","Date and Time","Source","Event ID","Task Category","Description"',
  banner(300, 'The Windows Modules Installer service entered the running state.'),
  ...Array.from({ length: 42 }, (_, i) =>
    '"Error","7/28/2026 9:' + String(i % 60).padStart(2, '0') + ':03 AM","Print-Spooler","372","None",'
    + '"The print spooler failed to load a plug-in module, error code 0x800706b9. '
    + 'Printing jobs are stuck in the print queue."'),
  '"Critical","7/28/2026 10:02:44 AM","Microsoft-Windows-Kernel-Power","41","(63)","The system has '
  + 'rebooted without cleanly shutting down first. Bugcheck CRITICAL_PROCESS_DIED 0x000000ef."',
].join('\n');

// A clean log — routine only. There is nothing to diagnose here and we must say so.
const CLEAN_LOG = [
  '2026-07-28T08:00:00Z INFO  boot: system started',
  banner(120, 'The Print Spooler service entered the running state.'),
  '2026-07-28T09:00:00Z INFO  backup: completed successfully with 0 errors',
].join('\n');

const APP_LOG = [
  '2026-07-28 08:00:01 INFO  Starting Outlook connectivity monitor',
  ...Array.from({ length: 15 }, () =>
    '2026-07-28 08:14:22 ERROR Outlook cannot send mail, messages stuck in the outbox, SMTP connection timed out'),
  '2026-07-28 08:15:00 WARN  retry scheduled',
].join('\n');

// ───────────────────────── 1. FORMAT DETECTION (honest, non-fatal) ─────────────────────────
test('detects a Windows Event Log CSV export', () => {
  assert.equal(detectLogFormat(EVENT_CSV, 'events.csv'), 'windows-event-csv');
});

test('detects a timestamped application log', () => {
  assert.equal(detectLogFormat(APP_LOG, 'app.log'), 'timestamped');
});

test('detects a syslog stream', () => {
  assert.equal(detectLogFormat('Jul 28 08:14:22 host01 sshd: error connection refused from peer', 'messages'), 'syslog');
});

test('unknown format is a valid answer, not a failure', () => {
  const r = triageLog('something broke\nerror the printer failed to respond', { filename: 'notes' });
  assert.equal(r.format, 'unknown');
  assert.equal(r.ok, true);
  assert.equal(r.hasFindings, true);
});

// ─────────────────── 2. THE POINT: the failure is found, not the banner ───────────────────
test('the top finding comes from the FAILURE, not the first 4000 characters', () => {
  // Guard the premise: the fault really is buried far past where the old code would have looked.
  const firstError = EVENT_CSV.indexOf('"Error"');
  assert.ok(firstError > 4000, 'fixture must bury the fault past char 4000 (was ' + firstError + ')');

  const r = triageLog(EVENT_CSV, { filename: 'events.csv' });
  assert.equal(r.hasFindings, true);
  assert.equal(r.findings[0].severity, 'critical');           // severity outranks 42 repeats
  assert.match(r.findings[0].line, /CRITICAL_PROCESS_DIED/);

  // The banner never reaches the query — that was the whole bug.
  assert.ok(!/entered the running state/i.test(r.query), 'routine Information rows must not reach the query');
  assert.match(r.query, /print spooler failed to load/i);
});

test('repeats collapse into one finding with a real count', () => {
  const r = triageLog(EVENT_CSV, { filename: 'events.csv' });
  const spooler = r.findings.find(f => /print spooler failed/i.test(f.line));
  assert.ok(spooler, 'the repeated spooler error must appear as a finding');
  assert.equal(spooler.count, 42);                             // exact, not approximate
  assert.equal(r.findings.filter(f => /print spooler failed/i.test(f.line)).length, 1);
});

test('counts are real totals across the whole file', () => {
  const r = triageLog(EVENT_CSV, { filename: 'events.csv' });
  assert.equal(r.counts.error, 42);
  assert.equal(r.counts.critical, 1);
  assert.equal(r.totalLines, EVENT_CSV.split('\n').length);
});

test('every reported finding is a VERBATIM line from the input (Rule 14 — nothing invented)', () => {
  const r = triageLog(EVENT_CSV, { filename: 'events.csv' });
  for (const f of r.findings) {
    assert.ok(EVENT_CSV.includes(f.line), 'finding not present verbatim in the log: ' + f.line.slice(0, 80));
  }
});

test('line numbers point at the real line', () => {
  const r = triageLog(APP_LOG, { filename: 'app.log' });
  const lines = APP_LOG.split('\n');
  for (const f of r.findings) assert.equal(lines[f.firstLine - 1].trim(), f.line);
});

test('signature collapses timestamps, ids and hex — same fault, one finding', () => {
  const a = lineSignature('2026-07-28T08:14:22Z ERROR job 4471 failed with 0x800706b9');
  const b = lineSignature('2026-07-29T11:02:03Z ERROR job 9912 failed with 0x800706b9');
  assert.equal(a, b);
});

test('one critical outranks thousands of warnings', () => {
  const spam = Array.from({ length: 3000 }, () => 'WARN disk usage above threshold').join('\n');
  const r = triageLog(spam + '\nCritical: bugcheck MEMORY_MANAGEMENT 0x0000001a', {});
  assert.equal(r.findings[0].severity, 'critical');
});

test('"0 errors" success lines are not promoted as the problem', () => {
  const r = triageLog('2026-07-28 INFO backup completed successfully with 0 errors\n'
    + '2026-07-28 ERROR vpn tunnel failed to establish', {});
  assert.match(r.findings[0].line, /vpn tunnel failed/i);
});

// ───────────────────────── 3. RULE 14 — ABSTAIN, NEVER GUESS ─────────────────────────
test('a clean log reports NO findings rather than inventing one', () => {
  const r = triageLog(CLEAN_LOG, { filename: 'clean.log' });
  assert.equal(r.ok, true);
  assert.equal(r.hasFindings, false);
  assert.equal(r.reason, 'no-error-lines');
  assert.equal(r.findings.length, 0);
  assert.match(r.summary, /no error, critical or warning/i);
});

test('a clean log ABSTAINS end-to-end — no diagnosis is produced', () => {
  const d = diagnoseInput({ kind: 'log', text: CLEAN_LOG, filename: 'clean.log', chunks: CHUNKS });
  assert.equal(d.abstain, true);
  assert.equal(d.match, false);
  assert.equal(d.reason, 'log-no-failure-lines');
  assert.equal(d.article, undefined);
  assert.equal(d.confidence, 0);
});

test('a binary log is refused honestly, not scored as mojibake', () => {
  const bin = 'Elf File'.repeat(60);
  assert.equal(isUnreadableBinary(bin, 'System.evtx'), true);
  const r = triageLog(bin, { filename: 'System.evtx' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'binary-not-text');
  assert.equal(r.hasFindings, false);
  assert.match(r.summary, /export it to csv or txt/i);

  const d = diagnoseInput({ kind: 'log', text: bin, filename: 'System.evtx', chunks: CHUNKS });
  assert.equal(d.abstain, true);
  assert.equal(d.reason, 'log-binary-not-text');
});

test('an empty log is empty, not a diagnosis', () => {
  const r = triageLog('   \n\n  ', {});
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'empty');
  assert.equal(r.hasFindings, false);
});

// ─────────────── 4. END-TO-END: triage actually improves the diagnosis ───────────────
test('the buried spooler/bugcheck log now retrieves a real KB article', () => {
  const d = diagnoseInput({ kind: 'log', text: EVENT_CSV, filename: 'events.csv', chunks: CHUNKS });
  assert.equal(d.abstain, false, 'a log with a clear repeated fault must produce a diagnosis');
  assert.ok(d.article && d.article.slug, 'a KB article must be matched');
  assert.ok(d.confidence >= 8, 'confidence should clear the threshold (got ' + d.confidence + ')');
});

test('an Outlook outbox log routes to the Outlook KB', () => {
  const d = diagnoseInput({ kind: 'log', text: APP_LOG, filename: 'outlook.log', chunks: CHUNKS });
  assert.equal(d.abstain, false);
  assert.match(d.article.slug, /outlook/i);
});

test('triage beats the old raw-text path on CORRECTNESS (the score was the lie)', () => {
  // Old behaviour, reproduced exactly: treat the log as plain text.
  const asText = diagnoseInput({ kind: 'text', text: EVENT_CSV, filename: 'events.csv', chunks: CHUNKS });
  const asLog = diagnoseInput({ kind: 'log', text: EVENT_CSV, filename: 'events.csv', chunks: CHUNKS });

  // The raw path scores HIGHER while being WRONG: token-overlap rewards a long repetitive blob,
  // so 300 rows of banner text pile up points on an unrelated article. Comparing scores across
  // the two paths is meaningless — correctness is the only honest measure, so that is what we
  // assert. (This is exactly the failure mode Rule 14 exists to catch: a confident wrong answer.)
  assert.ok(asText.confidence > asLog.confidence,
    'sanity: the raw blob inflates its own score — that inflation is why score is not the test');
  assert.ok(!/printer|spooler|windows-001/.test(String(asText.article && asText.article.slug)),
    'raw text should NOT land on the real fault (it matched ' + (asText.article && asText.article.slug) + ')');
  assert.match(asLog.article.slug, /printer|spooler|windows/,
    'triage must land on the actual fault (got ' + asLog.article.slug + ')');
});

test('buildProblemDescription attaches the triage report for the UI', () => {
  const built = buildProblemDescription({ kind: 'log', text: EVENT_CSV, filename: 'events.csv' });
  assert.ok(built.logTriage, 'logTriage must be attached');
  assert.equal(built.logTriage.hasFindings, true);
  assert.ok(built.logTriage.summary.length > 20);
  assert.equal(buildProblemDescription({ kind: 'text', text: 'printer jam' }).logTriage, null);
});

// ─────────────────── 5. PRIVACY — redaction still applies to logs ───────────────────
test('PII and secrets in a log are redacted before the query is built', () => {
  const dirty = [
    '2026-07-28 ERROR vpn auth failed for amy.chen@corp.example.com from 203.0.113.44',
    '2026-07-28 ERROR token=ghp_abcdefghijklmnopqrstuvwxyz0123456789 rejected by the gateway',
  ].join('\n');
  const built = buildProblemDescription({ kind: 'log', text: dirty, filename: 'vpn.log' });
  assert.ok(!/amy\.chen@corp\.example\.com/.test(built.query), 'email must not survive into the query');
  assert.ok(!/ghp_abcdefghijklmnopqrstuvwxyz/.test(built.query), 'secret must not survive into the query');
  assert.ok(!/203\.0\.113\.44/.test(built.query), 'IP must not survive into the query');
  assert.ok(built.redaction.count >= 3, 'the redaction receipt must report what was removed');
  // The technical signal survives redaction — that is what makes the diagnosis possible.
  assert.match(built.query, /vpn auth failed/i);
});

test('signal extraction pulls event IDs, hex codes and bugchecks', () => {
  const s = extractLogSignals('Event ID: 372 error 0x800706b9 bugcheck CRITICAL_PROCESS_DIED System.IO.IOException');
  assert.ok(s.eventIds.includes('372'));
  assert.ok(s.hex.includes('0x800706b9'));
  assert.ok(s.bugchecks.includes('CRITICAL_PROCESS_DIED'));
  assert.ok(s.exceptions.some(e => /IOException/.test(e)));
});

// ─────────────── 6. SCALE — a huge log stays fast and bounded ───────────────
test('a 200k-line log is bounded, keeps the newest failures, and stays fast', () => {
  const huge = Array.from({ length: 220000 }, (_, i) => '2026-07-28 INFO heartbeat ' + i).join('\n')
    + '\nCritical: bugcheck WHEA_UNCORRECTABLE_ERROR 0x00000124';
  const t0 = Date.now();
  const r = triageLog(huge, { filename: 'huge.log' });
  const ms = Date.now() - t0;
  assert.equal(r.truncated, true);
  assert.equal(r.hasFindings, true);
  assert.match(r.findings[0].line, /WHEA_UNCORRECTABLE_ERROR/);
  assert.ok(r.query.length <= 4000, 'query must stay bounded');
  assert.ok(ms < 8000, 'triage should stay fast (took ' + ms + 'ms)');
});

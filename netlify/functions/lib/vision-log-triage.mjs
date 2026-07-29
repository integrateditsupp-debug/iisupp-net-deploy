// vision-log-triage.mjs — STAGE 2: make a dropped LOG FILE a real input, not a text blob.
// ---------------------------------------------------------------------------------------------
// WHY THIS EXISTS
// Before this module, dropping a .log / event-log export took the same path as pasting a sentence:
// the first ~4000 characters were handed to the retriever. Real logs do not work that way. A
// Windows Event Log export, a CBS.log, or an application log opens with headers, banner lines and
// hours of routine Information rows — so the first 4000 characters are almost never the problem,
// and the retriever was scoring boilerplate. The user dropped the evidence and we read the wrong
// part of it.
//
// This module triages the log the way a technician does: find the lines that ACTUALLY indicate a
// failure, collapse the repeats, rank what matters, and hand the retriever a short, dense problem
// description built only from those lines.
//
// RULE 14 — this module NEVER invents a finding. Every signature it reports is a verbatim line
//    that exists in the file. If no error-like line is found, it says so (hasFindings:false) so
//    the caller abstains instead of diagnosing a healthy log.
// PRIVACY — pure, offline, $0. No network, no model call, no side effects. PII redaction still
//    happens in vision-diagnose-core.redactPII AFTER triage, so nothing sensitive is emitted here
//    that would not have been emitted before.
// COST — this runs on the free path and often REMOVES the need for any paid call.

// ---------------------------------------------------------------------------------------------
// Severity vocabulary. Ordered strongest-first; first match wins, so CRITICAL beats ERROR when a
// line contains both ("Critical ... error 0x...").
// ---------------------------------------------------------------------------------------------
const SEVERITY_RULES = [
  ['critical', /\b(critical|fatal|bugcheck|blue\s*screen|bsod|panic|corrupt(?:ed|ion)?|unrecoverable|catastrophic)\b/i],
  ['error', /\b(error|failed|failure|fault|exception|denied|refused|unable\s+to|cannot|can't|timed?\s*out|timeout|crash(?:ed)?|abort(?:ed)?|terminated\s+unexpectedly|stopped\s+working)\b/i],
  ['warning', /\b(warn(?:ing)?|deprecat|retry|retrying|degraded|slow|exhaust(?:ed)?|threshold|low\s+(?:disk|memory|space))\b/i],
];

const SEVERITY_WEIGHT = { critical: 100, error: 60, warning: 18 };

// Lines that look like a failure but are routine noise in Windows/Office logs. Excluding these
// from the top keeps the ranking honest — they are still counted, just not promoted.
const NOISE = [
  /\bno\s+error\b/i,
  /\berror\s*(?:code)?\s*[:=]?\s*0x0\b/i,
  /\berror\s*(?:code)?\s*[:=]?\s*0\b(?!x)/i,
  /\b(?:0\s+errors?|errors?\s*[:=]\s*0)\b/i,
  /\bsuccess(?:fully)?\b[^\n]*\b(?:no|0)\s+(?:errors?|failures?)\b/i,
];

// ---------------------------------------------------------------------------------------------
// Format detection — best-effort and honest. 'unknown' is a valid, non-fatal answer; triage still
// works line-by-line. We only claim a format when a distinctive marker is present.
// ---------------------------------------------------------------------------------------------
export function detectLogFormat(text, filename = '') {
  const head = String(text || '').slice(0, 4000);
  const name = String(filename || '').toLowerCase();

  if (name.endsWith('.evtx')) return 'evtx-binary';
  if (/^\s*"?(?:Level|Keywords)"?\s*,\s*"?Date and Time"?/im.test(head)) return 'windows-event-csv';
  if (/^\s*"?TimeCreated"?\s*,/im.test(head)) return 'windows-event-csv';
  if (/\b(?:ProviderName|TimeCreated|LevelDisplayName)\s*[:=]/i.test(head)) return 'windows-event-text';
  if (/Log Name:\s*\S+/i.test(head) || /\bEvent ID:\s*\d+/i.test(head)) return 'windows-event-text';
  if ((/\[SR\]|\bCSI\b|\bCBS\b/.test(head)) && /cbs/i.test(name + head)) return 'cbs';
  if (/^\s*\{[\s\S]{0,400}?"(?:level|severity|msg|message)"\s*:/im.test(head)) return 'json-lines';
  if (/^\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\S+\s+\S+:/m.test(head)) return 'syslog';
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/m.test(head)) return 'timestamped';
  return 'unknown';
}

// A binary .evtx cannot be read as text — say so plainly instead of scoring mojibake.
export function isUnreadableBinary(text, filename = '') {
  const s = String(text || '');
  if (String(filename || '').toLowerCase().endsWith('.evtx')) return true;
  if (!s) return false;
  const sample = s.slice(0, 2000);
  let ctrl = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    if (c === 0 || c < 9 || (c > 13 && c < 32)) ctrl++;
  }
  return sample.length > 0 && ctrl / sample.length > 0.05;
}

function classify(line) {
  for (const [sev, re] of SEVERITY_RULES) if (re.test(line)) return sev;
  return null;
}

function isNoise(line) {
  return NOISE.some(re => re.test(line));
}

// ---------------------------------------------------------------------------------------------
// Signature = the shape of a line with its variable parts removed, so 400 repeats of the same
// failure collapse into ONE finding with count:400. Repetition is the strongest real-world signal
// that a line is the actual problem, so the count feeds the ranking.
// ---------------------------------------------------------------------------------------------
export function lineSignature(line) {
  return String(line)
    .replace(/\b\d{4}-\d{2}-\d{2}[T ]?\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, '<TS>')
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}[, ]+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?/gi, '<TS>')
    .replace(/\b(?:0x)?[0-9A-Fa-f]{8,}\b/g, (m) => (/^0x/i.test(m) ? m.toLowerCase() : '<HEX>'))
    .replace(/\{[0-9A-Fa-f-]{30,}\}/g, '<GUID>')
    .replace(/\b\d+\b/g, '<N>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

// Event IDs, bugcheck names, hex codes, exception types and provider/service names are what the
// KB routing table keys on, so they are pulled out explicitly and appended to the query.
export function extractLogSignals(text) {
  const t = String(text || '');
  const eventIds = [...new Set((t.match(/\bEvent\s*ID[:=\s]*\(?(\d{1,5})\)?/gi) || [])
    .map((m) => (m.match(/(\d{1,5})/) || [])[1]).filter(Boolean))].slice(0, 10);
  const hex = [...new Set((t.match(/\b0x[0-9A-Fa-f]{4,16}\b/g) || []).map((s) => s.toLowerCase()))]
    .filter((h) => !/^0x0+$/.test(h)).slice(0, 10);
  const bugchecks = [...new Set((t.match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+){1,}\b/g) || [])
    .filter((w) => w.length >= 8 && w.length <= 44))].slice(0, 10);
  const exceptions = [...new Set((t.match(/\b(?:System\.)?[A-Z][A-Za-z0-9]*(?:Exception|Error)\b/g) || []))].slice(0, 8);
  const providers = [...new Set(
    (t.match(/(?:ProviderName|Source|Log Name)\s*[:=]\s*([A-Za-z0-9._-]{3,60})/gi) || [])
      .map((m) => (m.split(/[:=]/)[1] || '').trim()).filter(Boolean)
  )].slice(0, 8);
  // Service names only — a quoted name, or ONE bare token. Allowing spaces here used to swallow
  // whole sentences ("service entered the running state"), which dragged routine banner text into
  // the query and defeated the entire point of triage. A trailing verb is not a service name.
  const SERVICE_STOP = /^(entered|exited|started|stopped|is|was|has|had|will|did|does|failed|running|state|for|the|and|to|of|on|in|with|by|not|no)$/i;
  const services = [];
  const svcRe = /\bservice\s+(?:"([^"\n]{3,40})"|'([^'\n]{3,40})'|([A-Za-z0-9._-]{3,40}))/gi;
  for (let mm; (mm = svcRe.exec(t));) {
    const name = (mm[1] || mm[2] || mm[3] || '').trim();
    if (name && !SERVICE_STOP.test(name) && !services.includes(name)) services.push(name);
    if (services.length >= 6) break;
  }
  return { eventIds, hex, bugchecks, exceptions, providers, services };
}

/**
 * Triage a log into ranked, verbatim findings.
 * Returns { ok, format, hasFindings, reason, totalLines, scannedLines, truncated,
 *           counts, findings[], signals, query, summary }
 */
export function triageLog(text, opts = {}) {
  const filename = String(opts.filename || '');
  const maxFindings = Number.isFinite(opts.maxFindings) ? opts.maxFindings : 8;
  const maxLines = Number.isFinite(opts.maxLines) ? opts.maxLines : 200000;
  const raw = String(text || '');

  const empty = {
    ok: false, format: 'unknown', hasFindings: false, reason: 'empty',
    totalLines: 0, scannedLines: 0, truncated: false,
    counts: { critical: 0, error: 0, warning: 0 },
    findings: [], signals: extractLogSignals(''), query: '', summary: '',
  };

  if (!raw.trim()) return empty;

  if (isUnreadableBinary(raw, filename)) {
    return {
      ...empty,
      format: filename.toLowerCase().endsWith('.evtx') ? 'evtx-binary' : 'binary',
      reason: 'binary-not-text',
      summary: 'This looks like a binary log, not text. Export it to CSV or TXT (Event Viewer -> Save All Events As -> CSV) and drop that instead.',
    };
  }

  const format = detectLogFormat(raw, filename);
  const allLines = raw.split(/\r?\n/);
  const truncated = allLines.length > maxLines;
  const lines = truncated ? allLines.slice(-maxLines) : allLines; // keep the TAIL: newest failures
  const lineOffset = truncated ? allLines.length - maxLines : 0;

  const counts = { critical: 0, error: 0, warning: 0 };
  const bySig = new Map();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 6) continue;
    const sev = classify(line);
    if (!sev) continue;
    counts[sev]++;
    const noise = isNoise(line);
    const sig = lineSignature(line);
    const key = sev + '|' + sig;
    const prev = bySig.get(key);
    if (prev) {
      prev.count++;
      prev.lastLine = lineOffset + i + 1;
    } else {
      bySig.set(key, {
        severity: sev,
        count: 1,
        line: line.slice(0, 400),
        signature: sig,
        firstLine: lineOffset + i + 1,
        lastLine: lineOffset + i + 1,
        noise,
      });
    }
  }

  if (bySig.size === 0) {
    return {
      ok: true, format, hasFindings: false, reason: 'no-error-lines',
      totalLines: allLines.length, scannedLines: lines.length, truncated,
      counts, findings: [], signals: extractLogSignals(raw.slice(0, 20000)), query: '',
      summary: `Scanned ${allLines.length} lines and found no error, critical or warning entries. Nothing in this log points at a failure.`,
    };
  }

  // Rank the way a technician triages, in two stages:
  //   TIER (hard)  — every critical outranks every error, every error outranks every warning.
  //                  Volume must never bury a bugcheck: 500 repeats of a spooler error is still a
  //                  smaller event than one unclean reboot, and a human reads the criticals first.
  //   SCORE (soft) — WITHIN a tier, repetition (log-scaled) and recency decide, and lines that are
  //                  obvious success-noise ("completed with 0 errors") are demoted but never dropped.
  const lastLineNo = lineOffset + lines.length;
  const TIER = { critical: 2, error: 1, warning: 0 };
  const findings = [...bySig.values()].map((f) => {
    const recency = lastLineNo > 0 ? f.lastLine / lastLineNo : 0;
    const score = SEVERITY_WEIGHT[f.severity] * (1 + Math.log10(f.count) * 0.6)
      + recency * 8
      - (f.noise ? 55 : 0);
    return { ...f, score: Math.round(score * 100) / 100 };
  }).sort((a, b) => {
    // Noise is demoted across tiers too — a noisy "critical" banner must not outrank a real error.
    if (a.noise !== b.noise) return a.noise ? 1 : -1;
    if (TIER[a.severity] !== TIER[b.severity]) return TIER[b.severity] - TIER[a.severity];
    return b.score - a.score;
  }).slice(0, maxFindings);

  // The query the retriever actually sees: only the verbatim top findings + extracted signals.
  // This is the whole point — dense problem evidence instead of 4000 characters of banner text.
  const topText = findings.map((f) => f.line).join('\n');
  const signals = extractLogSignals(topText + '\n' + raw.slice(0, 8000));
  const signalTail = [
    ...signals.eventIds.map((id) => 'event id ' + id),
    ...signals.hex, ...signals.bugchecks, ...signals.exceptions,
    ...signals.providers, ...signals.services,
  ].join(' ');
  const query = (topText + ' ' + signalTail).trim().slice(0, 4000);

  const top = findings[0];
  const summary = `${allLines.length} lines - ${counts.critical} critical, ${counts.error} error, ${counts.warning} warning. `
    + `Top signal (${top.severity}${top.count > 1 ? `, seen ${top.count}x` : ''}, line ${top.firstLine}): ${top.line.slice(0, 160)}`;

  return {
    ok: true, format, hasFindings: true, reason: null,
    totalLines: allLines.length, scannedLines: lines.length, truncated,
    counts, findings, signals, query, summary,
  };
}

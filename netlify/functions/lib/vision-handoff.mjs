// vision-handoff.mjs — turn an HONEST ABSTAIN into a real handoff, not a dead link.
// ---------------------------------------------------------------------------------
// The spec's fallback is: "closest guidance + open a discussion / escalate to IIS (no bluffing)".
// The handler has always RETURNED those two options and the widget has always RENDERED them —
// but clicking them navigated to `/forums` and `/aria?escalate=1` and dropped every piece of
// evidence on the floor. The user then had to re-describe, from memory, the thing they had just
// shown us. "A human will help" was a promise with no mechanism behind it.
//
// This module builds the bridge. It is PURE, offline and $0 — no network, no model, no storage.
// It takes the abstain result the handler already produced and composes:
//   - a discussion draft (title + markdown body) for the EXISTING forums composer, and
//   - an escalation payload for the EXISTING `aria-escalation?action=escalate` endpoint,
// which already creates a real ticket id, a real ETA and real notification mail.
//
// THREE LAWS THIS FILE OBEYS
//
// 1. Rule 14 - nothing is invented. Every sentence in a draft is either (a) fixed, honest
//    scaffolding text, or (b) copied from `res`. If a field is missing it is OMITTED, never
//    filled with a plausible guess. `buildHandoff` returns `titleFromEvidence:false` when it
//    could not derive a title from real evidence, so the caller must ask the user rather than
//    posting something we made up. A draft NEVER claims a diagnosis - an abstain means we do
//    not have one, and the closest KB article is labelled unconfirmed everywhere it appears.
//
// 2. Privacy - a handoff crosses a trust boundary (a discussion is PUBLIC; a ticket reaches IIS
//    staff), so it is the strictest text path in Stage 2. Every field is re-run through
//    `redactPII` here even though the handler already redacted upstream: defence in depth, and a
//    future caller cannot bypass it. Image bytes, data: URLs and base64 blobs are stripped
//    unconditionally - a picture of a screen belongs to the person who took it, and a forum post
//    is forever.
//
// 3. Nothing is sent from here. This module composes text and a payload. The POST is made by the
//    user's own explicit click, on a screen that first shows them exactly what will travel.
//    No auto-post, no auto-escalate, no silent side effects.

import { redactPII } from './vision-diagnose-core.mjs';

export const HANDOFF_STORAGE_KEY = 'aria_vision_handoff';
export const HANDOFF_TTL_MS = 30 * 60 * 1000;   // a stale draft is worse than no draft
export const ESCALATE_ENDPOINT = '/.netlify/functions/aria-escalation?action=escalate';
export const FORUMS_COMPOSE_URL = '/forums?compose=vision#discussions';
export const ESCALATE_URL = '/aria?escalate=1';

const MAX_TITLE = 140;      // matches the forums composer's own maxlength
const MAX_LINE = 300;
const MAX_FINDINGS = 5;
const MAX_BODY = 6000;
const MAX_ISSUE = 240;      // matches aria-escalation's own slice

// -- sanitising ------------------------------------------------------------------

// Anything that could carry an image, a blob or raw binary. Applied to EVERY field, regardless of
// where the caller claims it came from. Two copies of each pattern on purpose: a /g regex carries
// lastIndex, so reusing one for both .replace() and .test() would make .test() answer differently
// on identical input depending on call order.
const CONTROL_G = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/g;
const CONTROL_1 = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/;
const DATA_URL_G = /data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/gi;
const DATA_URL_1 = /data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,/i;
const BASE64_BLOB_G = /[A-Za-z0-9+/]{200,}={0,2}/g;
const BASE64_BLOB_1 = /[A-Za-z0-9+/]{200,}={0,2}/;

/** clean(text) -> redacted, binary-free, whitespace-normalised, length-capped text. */
export function clean(text, max = MAX_LINE) {
  let s = String(text == null ? '' : text);
  s = s.replace(DATA_URL_G, ' ').replace(BASE64_BLOB_G, ' ').replace(CONTROL_G, ' ');
  s = redactPII(s).redacted;
  s = s.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
  if (s.length > max) s = s.slice(0, max - 1).trimEnd() + '…';
  return s;
}

/** True when a string still looks like it carries an image, a blob or raw binary. */
export function isUnsafeForHandoff(text) {
  const s = String(text == null ? '' : text);
  return DATA_URL_1.test(s) || BASE64_BLOB_1.test(s) || CONTROL_1.test(s);
}

// -- plain-English scaffolding (fixed strings - the only text NOT taken from `res`) -------------

const KIND_PHRASE = {
  image: 'a screenshot',
  'screen-capture': 'a capture of my screen',
  log: 'a log file',
  pdf: 'a PDF',
  text: 'the error text',
};

// Every abstain reason the engine can emit, in words a person can act on. An unknown reason is
// reported verbatim rather than smoothed over - a silent default would hide an engine change.
const REASON_PHRASE = {
  'no-match': 'ARIA found nothing in the knowledge base close enough to be confident about.',
  'low-confidence': 'ARIA found related material but was not confident enough to call it a fix.',
  'empty-input': 'ARIA had nothing readable to work from.',
  'log-no-failure-lines': 'ARIA read the whole log and found no error, critical or warning entries in it.',
  'log-binary-not-text': 'ARIA could not read that log as text.',
  'no-vision-model': 'ARIA could not read the image itself - image reading is not enabled on this account, so it refused to guess.',
  'vision-failed': 'ARIA could not make out a clear problem in the image.',
  'kb-unavailable': 'ARIA could not reach the knowledge base.',
};

function reasonSentence(reason) {
  if (!reason) return 'ARIA was not confident enough to give a fix, and would not guess.';
  return REASON_PHRASE[reason] || ('ARIA stopped with: ' + clean(reason, 120) + '.');
}

// -- title derivation (evidence only) --------------------------------------------

// Order of preference is order of evidential strength:
//   1. the most severe real log line (their file, verbatim),
//   2. a real error / hex / bugcheck signal ARIA extracted,
//   3. the first line of what they typed or pasted (their own words about their own machine),
//   4. the closest KB article's title (phrased as a QUESTION, never as a finding).
// If none exist -> no title, and `titleFromEvidence:false` so the caller must ask the user.
export function deriveTitle(res) {
  const lt = res && res.logTriage;
  if (lt && lt.findings && lt.findings.length) {
    const line = clean(lt.findings[0].line, MAX_TITLE);
    if (line) return { title: line, from: 'log-finding', evidence: true };
  }
  const sig = (res && res.signals) || {};
  const codes = []
    .concat(sig.errors || [], sig.hexCodes || [], sig.codes || [], sig.bugchecks || [])
    .map(c => clean(c, 40)).filter(Boolean);
  const apps = (sig.apps || []).map(a => clean(a, 40)).filter(Boolean);
  if (codes.length) {
    const t = clean((apps[0] ? apps[0] + ' - ' : '') + codes.slice(0, 2).join(' / '), MAX_TITLE);
    if (t) return { title: t, from: 'signal', evidence: true };
  }
  // The user's own words outrank our closest guess: they wrote it about their own machine, and a
  // discussion titled with an unrelated article we already said we were unsure about would send
  // every reader down the wrong path.
  const typed = res && res._userText;
  if (typed) {
    const first = clean(String(typed).split('\n')[0], MAX_TITLE);
    if (first.length >= 8) return { title: first, from: 'user-text', evidence: true };
  }
  const closest = res && res.closest;
  if (closest && closest.title) {
    const t = clean('Is this ' + closest.title + '? ARIA was not sure', MAX_TITLE);
    if (t) return { title: t, from: 'closest-kb', evidence: true };
  }
  return { title: '', from: 'none', evidence: false };
}

// -- body composition ------------------------------------------------------------

/**
 * buildHandoff(res, sent, opts) -> a draft the user reviews and submits themselves.
 *
 * `res`  - the abstain response from aria-vision-diagnose (public fields only).
 * `sent` - what the widget submitted { kind, surface, os, text? }. Image bytes are NEVER read.
 * opts.target - 'forums' | 'escalate' (changes only the closing line and the priority hint).
 *
 * Returns { ok, target, title, titleFromEvidence, body, evidence, priority, tags, createdAt, safe }.
 * `ok:false` means there is not enough real evidence to compose anything - the caller must ask the
 * user to describe it instead of shipping a hollow post.
 */
export function buildHandoff(res, sent = {}, opts = {}) {
  const target = opts.target === 'escalate' ? 'escalate' : 'forums';
  const empty = { ok: false, target, title: '', titleFromEvidence: false, body: '', evidence: [], safe: true };
  if (!res || typeof res !== 'object') return Object.assign({}, empty, { reason: 'no-result' });

  const kind = clean(sent.kind || res.kind || 'text', 30) || 'text';
  const surface = clean(sent.surface || res.surface || 'web', 20);
  const os = clean(sent.os || res.os || '', 20);
  // ONLY a typed/pasted description counts as "what I described". A log's or a PDF's contents
  // arrive in the same `text` field, but they are file contents, not the user's words: quoting a
  // whole log into a PUBLIC discussion would leak far more than the failure (the triage findings
  // already carry the relevant lines), and titling a thread with a log's FIRST line is actively
  // misleading — on a clean log that first line is routine "service started" noise, which would
  // advertise a problem that line does not describe. An image's bytes are never touched here.
  const userText = kind === 'text' ? clean(sent.text || '', 1200) : '';
  const withText = Object.assign({}, res, { _userText: userText });

  const t = deriveTitle(withText);
  const evidence = [];
  const parts = [];

  parts.push('**What I gave ARIA:** ' + (KIND_PHRASE[kind] || clean(kind, 30)) +
    (os ? ' (on ' + os + ')' : '') + '.');
  parts.push('**Why ARIA handed this over:** ' + reasonSentence(res.reason));

  // What ARIA actually read out of a log - verbatim lines from THEIR file, with real line numbers
  // and real repeat counts. This is the whole point: the evidence travels, so nobody has to take
  // our word for it or ask the user to paste it again.
  const lt = res.logTriage;
  if (lt && lt.findings && lt.findings.length) {
    const rows = [];
    for (const f of lt.findings.slice(0, MAX_FINDINGS)) {
      const line = clean(f.line, MAX_LINE);
      if (!line) continue;
      const bits = [clean(f.severity, 20)];
      if (f.count > 1) bits.push('x' + Math.max(1, Math.floor(Number(f.count) || 1)));
      if (f.firstLine) bits.push('line ' + Math.max(1, Math.floor(Number(f.firstLine) || 1)));
      rows.push('- `[' + bits.join(' - ') + ']` ' + line);
      evidence.push({ type: 'log-finding', severity: f.severity, count: f.count || 1, line });
    }
    if (rows.length) {
      const head = lt.counts
        ? ('**What ARIA read in the log** (' + (lt.counts.critical || 0) + ' critical, ' +
           (lt.counts.error || 0) + ' error, ' + (lt.counts.warning || 0) + ' warning' +
           (lt.totalLines ? ' across ' + lt.totalLines + ' lines' : '') + ')' +
           (lt.truncated ? ', most recent portion' : '') + ':')
        : '**What ARIA read in the log:**';
      parts.push(head + '\n' + rows.join('\n'));
    }
  } else if (lt && lt.summary && !lt.hasFindings) {
    const s = clean(lt.summary, 400);
    if (s) { parts.push('**What ARIA read in the log:** ' + s); evidence.push({ type: 'log-summary', line: s }); }
  }

  // Signals ARIA extracted - error codes, hex codes, app names. Search terms for whoever picks
  // this up, and they come out of the input rather than out of a model.
  const sig = res.signals || {};
  const sigRows = [];
  for (const pair of [['Error codes', 'errors'], ['Hex codes', 'hexCodes'], ['Codes', 'codes'],
                      ['Bugchecks', 'bugchecks'], ['Apps / services', 'apps'], ['Providers', 'providers']]) {
    const vals = (sig[pair[1]] || []).map(v => clean(v, 60)).filter(Boolean).slice(0, 6);
    if (vals.length) {
      sigRows.push('- ' + pair[0] + ': ' + vals.join(', '));
      evidence.push({ type: 'signal', key: pair[1], values: vals });
    }
  }
  if (sigRows.length) parts.push('**Details ARIA pulled out:**\n' + sigRows.join('\n'));

  if (userText) {
    parts.push('**What I described / pasted:**\n```\n' + userText + '\n```');
    evidence.push({ type: 'user-text', line: userText.slice(0, MAX_LINE) });
  }

  // Closest guidance - the spec's "closest guidance" half of the fallback. Labelled as a
  // candidate, never as an answer: ARIA abstained, so presenting it as the fix would be the exact
  // bluff Rule 14 forbids.
  const closest = res.closest;
  if (closest && closest.title) {
    parts.push('**Closest thing ARIA found - not confirmed, it was below the confidence bar:** ' +
      clean(closest.title, 160) + (closest.url ? ' (' + clean(closest.url, 200) + ')' : ''));
    evidence.push({ type: 'closest-kb', title: clean(closest.title, 160), url: clean(closest.url || '', 200) });
  }

  // What redaction removed. Told to the user AND written into the draft, so a reader knows the
  // gaps are deliberate and does not read `[REDACTED_EMAIL]` as corruption.
  const red = res.redaction;
  if (red && red.count > 0) {
    const kinds = (red.found || []).map(f => clean(f.type, 30) + (f.count > 1 ? ' x' + f.count : '')).filter(Boolean);
    parts.push('_Private details were removed before this draft was written' +
      (kinds.length ? ' (' + kinds.join(', ') + ')' : '') + '. Nothing was added._');
  }

  parts.push(target === 'escalate'
    ? '_Drafted by ARIA after it declined to guess. Sent to IIS only when I press send._'
    : '_Drafted by ARIA after it declined to guess. I am posting it myself - ARIA did not post anything._');

  let body = parts.join('\n\n');
  if (body.length > MAX_BODY) body = body.slice(0, MAX_BODY - 1).trimEnd() + '…';

  // A draft with nothing but scaffolding is not worth a post. The scaffolding lines are always
  // present, so real evidence is what makes it worth shipping.
  if (!evidence.length && !t.evidence) return Object.assign({}, empty, { reason: 'no-evidence' });

  const safe = !isUnsafeForHandoff(body) && !isUnsafeForHandoff(t.title);
  return {
    ok: safe,
    target,
    reason: safe ? null : 'unsafe-content',
    title: safe ? t.title : '',
    titleFromEvidence: safe ? t.evidence : false,
    titleFrom: t.from,
    body: safe ? body : '',
    evidence: safe ? evidence : [],
    priority: derivePriority(res),
    kind, surface, os,
    tags: deriveTags(res, kind),
    createdAt: new Date().toISOString(),
    safe,
  };
}

// Priority for the escalation ticket. Honest and conservative: only a real critical log entry
// earns 'high', and 'critical' is never assigned automatically - a person decides that, because on
// the IIS side it changes the ETA and who gets paged.
export function derivePriority(res) {
  const c = (res && res.logTriage && res.logTriage.counts) || null;
  if (c && (c.critical || 0) > 0) return 'high';
  return 'normal';
}

// Tags come from real extracted values only, lower-cased and slugged - never a guessed category.
export function deriveTags(res, kind) {
  const sig = (res && res.signals) || {};
  const out = [];
  const push = v => {
    const s = clean(v, 24).toLowerCase().replace(/[^a-z0-9+.-]+/g, '-').replace(/^-+|-+$/g, '');
    if (s && s.length >= 2 && out.indexOf(s) === -1 && out.length < 5) out.push(s);
  };
  if (kind === 'log') push('log');
  if (kind === 'image' || kind === 'screen-capture') push('screenshot');
  (sig.apps || []).slice(0, 3).forEach(push);
  (sig.errors || []).slice(0, 2).forEach(push);
  return out;
}

// -- escalation payload ----------------------------------------------------------

/**
 * escalationPayload(handoff, { userEmail, userName, sessionId }) -> the exact body
 * `aria-escalation?action=escalate` accepts. No new endpoint, no new schema.
 *
 * `ok:false` when there is no address to reply to - the endpoint tolerates a null email, but a
 * ticket nobody can be answered on is a worse outcome than an honest "we need your email".
 */
/**
 * escalationRequest(handoff) -> { endpoint, body } with `userEmail: null`.
 *
 * This is what the SERVER hands the client: the whole ticket body, composed here, minus the one
 * field only the browser knows. The client fills `userEmail` from what the user types and POSTs it.
 * Composing it server-side means the issue text, the priority and the abstain-labelled findings
 * exist in exactly one implementation — a browser file cannot quietly word it differently, and the
 * redaction in `clean()` cannot be skipped.
 */
export function escalationRequest(handoff) {
  const filled = escalationPayload(handoff, { userEmail: 'placeholder@example.com' });
  if (!filled.ok) return { ok: false, reason: filled.reason };
  const body = Object.assign({}, filled.body, { userEmail: null });
  return { ok: true, endpoint: filled.endpoint, body, needsEmail: true };
}

export function escalationPayload(handoff, who = {}) {
  if (!handoff || !handoff.ok) return { ok: false, reason: 'no-handoff' };
  // The reply address is the ONE piece of PII the user is deliberately handing over, so it must
  // NOT go through `clean()` — `redactPII` would turn it into `[REDACTED_EMAIL]` and every
  // escalation would then fail validation. (It did, first time. Recorded rather than quietly
  // fixed.) It is still sanitised: control bytes stripped, trimmed, capped, format-checked.
  const userEmail = String(who.userEmail == null ? '' : who.userEmail)
    .replace(CONTROL_G, '').trim().slice(0, 120);
  if (!userEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(userEmail)) {
    return { ok: false, reason: 'email-required' };
  }
  const issue = clean(handoff.title || ('Unresolved ' + (handoff.kind || 'issue') + ' ARIA could not diagnose'), MAX_ISSUE);
  return {
    ok: true,
    endpoint: ESCALATE_ENDPOINT,
    body: {
      issue,
      userEmail,
      userName: clean(who.userName || '', 80) || 'there',
      sessionId: clean(who.sessionId || '', 80) || null,
      priority: handoff.priority === 'high' ? 'high' : 'normal',
      // `ariaFindings` is interpolated into the internal notification email as a STRING by
      // aria-escalation (`${ariaFindings||'(none)'}`), so an object would arrive as
      // "[object Object]" and the technician would get a ticket with no evidence in it. It is
      // therefore sent as text, opening with the fact that ARIA ABSTAINED, so nobody downstream
      // can read the draft as a diagnosis ARIA stood behind.
      ariaFindings: 'ARIA ABSTAINED - it did not diagnose this and would not guess.\n\n' + (handoff.body || ''),
      conversation: [],
    },
  };
}

// -- same-origin transfer --------------------------------------------------------
//
// The draft moves between pages through sessionStorage, NOT the URL. A querystring ends up in
// server logs, in the Referer header of every asset the next page loads, and in browser history -
// three copies of somebody's error text we never needed to make. sessionStorage is same-origin,
// same-tab, and dies with the tab.

export function encodeHandoff(handoff) {
  return JSON.stringify({ v: 1, at: Date.now(), handoff });
}

/** decodeHandoff(raw) -> handoff | null. Rejects malformed, wrong-version, expired and unsafe. */
export function decodeHandoff(raw, now = Date.now()) {
  if (!raw) return null;
  let o;
  try { o = JSON.parse(raw); } catch { return null; }
  if (!o || o.v !== 1 || !o.handoff || typeof o.handoff !== 'object') return null;
  if (!Number.isFinite(o.at) || now - o.at > HANDOFF_TTL_MS || o.at > now + 60000) return null;
  const h = o.handoff;
  if (!h.ok || !h.body) return null;
  // Re-check on the way OUT as well. A draft that sat in storage is treated as untrusted input.
  if (isUnsafeForHandoff(h.body) || isUnsafeForHandoff(h.title || '')) return null;
  return h;
}

export default {
  buildHandoff, escalationPayload, escalationRequest, encodeHandoff, decodeHandoff,
  deriveTitle, derivePriority, deriveTags, clean, isUnsafeForHandoff,
};

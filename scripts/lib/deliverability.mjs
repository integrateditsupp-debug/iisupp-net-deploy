// deliverability.mjs — the Deliverability Guardian's engine. Verifies that SPF, DKIM and DMARC are LIVE
// for the outreach domain, diffs live DNS against a known-good baseline so a regression names its own cause,
// and exposes a HARD pre-send gate. WORKER-OWNED, read-only DNS. No secrets, no writes.
//
// Why this exists: the first ~201 sends drew 0 replies partly because DKIM was NOT published — mail landed
// in spam. This module makes that failure mode impossible to hit silently: every send is gated on a live
// check, and a daily 17:00 sweep catches drift and reports exactly what changed.
import dns from 'node:dns/promises';

export const OUTREACH_DOMAIN = 'iisupp.net';

// ── Known-good baseline, captured 2026-07-29 from live DNS. A live record that no longer matches its
//    baseline is how the guardian explains HOW deliverability went down (missing selector, SPF include
//    dropped, DMARC policy changed, MX repointed), not just THAT it went down. ──
export const BASELINE = {
  spf:   { type: 'TXT',  host: '@',                    must_match: /v=spf1\b/i,        must_include: 'include:_spf.google.com', value: 'v=spf1 include:_spf.google.com ~all' },
  dkim:  { type: 'TXT',  host: 'google._domainkey',    must_match: /v=DKIM1\b/i,       key_re: /p=[A-Za-z0-9+/]{40,}/, selector: 'google', value: 'v=DKIM1; k=rsa; p=<google-workspace-key>' },
  dmarc: { type: 'TXT',  host: '_dmarc',               must_match: /v=DMARC1\b/i,      must_include: 'rua=',                    value: 'v=DMARC1; p=none; rua=mailto:ahmad.wasee@iisupp.net; pct=100' },
  mx:    { type: 'MX',   host: '@',                     must_include: 'smtp.google.com', value: '1 smtp.google.com' },
};

async function txt(host, domain) {
  const name = host === '@' ? domain : `${host}.${domain}`;
  try { const recs = await dns.resolveTxt(name); return recs.map(r => r.join('')); } catch { return []; }
}
async function mx(domain) { try { return (await dns.resolveMx(domain)).map(m => `${m.priority} ${m.exchange}`); } catch { return []; } }

// Run the full check. Returns { ok, hard_ok, checkedAt, domain, checks:{spf,dkim,dmarc,mx}, diagnosis:[] }.
// hard_ok = SPF + DKIM + DMARC all live (the send-blocking set). mx is reported but advisory.
export async function checkDeliverability(domain = OUTREACH_DOMAIN) {
  const checkedAt = new Date().toISOString();
  const spfRecs = await txt(BASELINE.spf.host, domain);
  const dkimRecs = await txt(BASELINE.dkim.host, domain);
  const dmarcRecs = await txt(BASELINE.dmarc.host, domain);
  const mxRecs = await mx(domain);

  const spfVal = spfRecs.find(r => BASELINE.spf.must_match.test(r)) || null;
  const dkimVal = dkimRecs.find(r => BASELINE.dkim.must_match.test(r)) || null;
  const dmarcVal = dmarcRecs.find(r => BASELINE.dmarc.must_match.test(r)) || null;

  const checks = {
    spf:   verdict('SPF',   spfVal,   BASELINE.spf),
    dkim:  verdict('DKIM',  dkimVal,  BASELINE.dkim),
    dmarc: verdict('DMARC', dmarcVal, BASELINE.dmarc),
    mx:    { name: 'MX', live: mxRecs.some(r => /smtp\.google\.com/i.test(r)), value: mxRecs.join(' | ') || null, note: mxRecs.some(r => /smtp\.google\.com/i.test(r)) ? 'Google MX present' : 'Google MX MISSING — mail routing changed' },
  };
  const hard_ok = checks.spf.live && checks.dkim.live && checks.dmarc.live;
  const ok = hard_ok && checks.mx.live;

  const diagnosis = [];
  for (const key of ['spf', 'dkim', 'dmarc', 'mx']) {
    const c = checks[key];
    if (!c.live) diagnosis.push(diagnose(key, c));
  }
  return { ok, hard_ok, checkedAt, domain, checks, diagnosis };
}

function verdict(name, liveValue, base) {
  if (!liveValue) return { name, live: false, value: null, note: `${name} record NOT found at ${base.host === '@' ? '(root)' : base.host}` };
  // DKIM: require a real (non-empty) public key — "p=" with nothing after it is a REVOKED key, i.e. DKIM down.
  if (base.key_re && !base.key_re.test(liveValue)) return { name, live: false, value: liveValue, note: `${name} present but the public key is EMPTY/revoked ("p=" has no key) — DKIM is not signing` };
  const includeOk = !base.must_include || liveValue.toLowerCase().includes(base.must_include.toLowerCase());
  return { name, live: includeOk, value: liveValue, note: includeOk ? `${name} live` : `${name} present but missing "${base.must_include}" — record was altered` };
}

// Turn a down check into an actionable cause + fix, so a regression is self-explaining.
function diagnose(key, c) {
  const map = {
    spf:   `SPF DOWN — ${c.note}. Cause: the root TXT record was removed or edited (registrar migration, a competing TXT, or a manual change). Fix: restore TXT @ ${OUTREACH_DOMAIN} = "${BASELINE.spf.value}".`,
    dkim:  `DKIM DOWN — ${c.note}. Cause: the Google Workspace DKIM key was unpublished or the google._domainkey record was deleted. Fix: Google Admin → Apps → Google Workspace → Gmail → Authenticate email → generate + START authentication, then re-add the google._domainkey TXT. This is the exact failure that put the first 201 sends in spam.`,
    dmarc: `DMARC DOWN — ${c.note}. Cause: the _dmarc TXT was removed or its policy changed. Fix: restore TXT _dmarc.${OUTREACH_DOMAIN} = "${BASELINE.dmarc.value}".`,
    mx:    `MX changed — ${c.note}. Cause: mail routing was repointed away from Google. Verify MX = smtp.google.com before sending.`,
  };
  return map[key];
}

// One-line summary for logs/notifications.
export function summarize(result) {
  const s = (c) => `${c.name}:${c.live ? 'LIVE' : 'DOWN'}`;
  return `${result.hard_ok ? 'OK' : 'BLOCKED'} — ${['spf', 'dkim', 'dmarc', 'mx'].map(k => s(result.checks[k])).join(' · ')} @ ${result.checkedAt}`;
}

// ── HARD PRE-SEND GATE ──
// Throws DELIVERABILITY_DOWN unless SPF + DKIM + DMARC are all live. Memoized for TTL_MS so a batch does one
// DNS round trip, but a DOWN result is NEVER cached — it re-checks until it clears. Call before every send.
let _cache = null;
const TTL_MS = 10 * 60 * 1000;
export async function assertDeliverabilityOrThrow(domain = OUTREACH_DOMAIN) {
  const now = Date.now();
  if (_cache && _cache.hard_ok && _cache.domain === domain && (now - _cache.at) < TTL_MS) return _cache.result;
  const result = await checkDeliverability(domain);
  if (!result.hard_ok) {
    _cache = null;
    const err = new Error(`DELIVERABILITY DOWN — refusing to send. ${summarize(result)}\n  ${result.diagnosis.join('\n  ')}`);
    err.code = 'DELIVERABILITY_DOWN';
    err.result = result;
    throw err;
  }
  _cache = { hard_ok: true, domain, at: now, result };
  return result;
}

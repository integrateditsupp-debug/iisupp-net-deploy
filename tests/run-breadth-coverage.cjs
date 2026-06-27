'use strict';
/* FULL-SCALE breadth + taxonomy-coverage test of the ARIA web classifier.
   RULE 14: it extracts classify()/looksLikeResolution() DIRECTLY from ../aria.html (the production source)
   by line-range, so there is zero mirror drift — it measures exactly what ships. Part A runs the full
   332K mega-corpus; Part B runs curated natural-phrasing probes per call category → coverage map. */
const fs = require('fs');
const path = require('path');

// --- extract a top-level function body from aria.html by line range (function start -> first column-0 '}') ---
function extractFn(html, signature) {
  const lines = html.split('\n');
  const start = lines.findIndex((l) => l.includes(signature));
  if (start < 0) throw new Error('not found: ' + signature);
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) { if (/^}/.test(lines[i])) { end = i; break; } }
  if (end < 0) throw new Error('no end brace for ' + signature);
  return lines.slice(start, end + 1).join('\n');
}
const html = fs.readFileSync(path.join(__dirname, '..', 'aria.html'), 'utf8');
const classifySrc = extractFn(html, 'function classify(text){');
const resolutionSrc = extractFn(html, 'function looksLikeResolution(');
// Build a sandbox module from the real source (no other aria.html globals are referenced by these two fns).
const factory = new Function(`${classifySrc}\n${resolutionSrc}\nreturn { classify, looksLikeResolution };`);
const { classify, looksLikeResolution } = factory();

const corpus = require('./scenario-corpus-mega.js');

const NON_DEFLECT = new Set(['default', 'escalation', 'voice', 'shopping', 'news', 'weather', 'trade', 'quote']);
const FALLTHROUGH_EXPECT = new Set(['default', 'weather', 'news', 'weather/news', 'trade', 'quote', 'shopping', 'voice']);
const NON_IT_DEFLECT = new Set(['resolution', 'not-resolution']);

function scoreItem(item) {
  const q = item.q;
  if (item.expect === 'resolution') { const r = looksLikeResolution(q); return { ok: r, got: r ? 'resolution' : classify(q) }; }
  if (item.expect === 'not-resolution') { const r = looksLikeResolution(q); return { ok: !r, got: r ? 'resolution(FP)' : '(correct)' }; }
  const g = classify(q);
  if (item.expect === 'weather/news') return { ok: g === 'weather' || g === 'news', got: g };
  return { ok: g === item.expect, got: g };
}

// ---------- Part A — SCALE ----------
const byExpect = {};
let total = 0, correct = 0, itTotal = 0, itDeflected = 0;
for (const item of corpus) {
  if (item.expect === 'edge') continue;
  total++;
  const { ok } = scoreItem(item);
  const e = (byExpect[item.expect] ||= { t: 0, correct: 0 });
  e.t++; if (ok) { correct++; e.correct++; }
  if (!FALLTHROUGH_EXPECT.has(item.expect) && !NON_IT_DEFLECT.has(item.expect)) { itTotal++; if (!NON_DEFLECT.has(classify(item.q))) itDeflected++; }
}

// ---------- Part B — taxonomy probes ----------
const TAXONOMY = [
  { cat: 'break/fix · BSOD/boot', accept: ['kb:windows'], probes: ['blue screen of death', 'my pc wont boot', 'stuck on a boot loop', 'windows wont start up', 'bsod stop code on startup', 'computer keeps restarting'] },
  { cat: 'break/fix · performance', accept: ['kb:performance'], probes: ['my computer is really slow', 'laptop running hot and slow', 'high cpu usage all the time', 'disk at 100 percent', 'everything takes forever to load', 'machine is sluggish'] },
  { cat: 'break/fix · hardware', accept: ['kb:hardware', 'kb:windows', 'kb:macos', 'escalation'], probes: ['my laptop wont turn on', 'screen is black', 'keyboard stopped working', 'laptop wont charge', 'docking station not working'] },
  { cat: 'permissions', accept: ['kb:permissions'], probes: ['i cant access the shared folder', 'access denied to the file share', 'permission denied on the network drive', 'i lost access to a folder', 'cant open the shared drive', 'user cant open the team folder'] },
  { cat: 'account unlock', accept: ['password', 'kb:active-directory'], probes: ['my account is locked', 'im locked out of my account', 'please unlock my account', 'account locked out after too many attempts', 'unlock my domain account', 'locked out in the domain'] },
  { cat: 'password reset', accept: ['password'], probes: ['reset my password', 'i forgot my password', 'need a password reset', 'change my expired password', 'password reset please', 'cant log in wrong password'] },
  { cat: 'MFA', accept: ['kb:mfa'], probes: ['im not getting my mfa code', 'authenticator app not working', 'set up mfa on my new phone', '2fa code never arrives', 'need to register for multi factor', 'verification code not coming'] },
  { cat: 'app repair', accept: ['mail', 'kb:teams', 'kb:m365', 'kb:browser', 'kb:onedrive', 'kb:office'], probes: ['outlook wont open', 'teams keeps crashing', 'repair my office installation', 'reinstall office', 'my office apps wont launch', 'word keeps freezing'] },
  { cat: 'printer add', accept: ['printer'], probes: ['add a printer', 'install a new printer', 'set up the office printer', 'how do i connect to the printer', 'need to add the network printer', 'map me to the 3rd floor printer'] },
  { cat: 'mobile iOS/Android setup', accept: ['kb:mobile', 'mail', 'kb:m365', 'kb:mfa'], probes: ['set up email on my iphone', 'configure outlook on my android', 'set up my work phone', 'add my work account to my ipad', 'how do i set up company email on my personal phone', 'enroll my android phone for work'] },
  { cat: 'RSA token setup', accept: ['kb:rsa', 'vpn'], probes: ['set up my rsa token', 'rsa securid not working', 'my rsa token is out of sync', 'import my rsa soft token', 'rsa securid app setup', 'need a new rsa token issued'] },
  { cat: 'Ivanti Secure VPN', accept: ['vpn'], probes: ['ivanti secure access wont connect', 'set up ivanti vpn', 'ivanti pulse vpn error', 'cant connect with ivanti secure', 'ivanti secure access keeps disconnecting', 'install ivanti secure access'] },
  { cat: 'Intune enrollment', accept: ['kb:m365'], probes: ['enroll my device in intune', 'intune enrollment failed', 'company portal wont enroll my device', 'register my laptop in intune', 'my device isnt compliant in intune', 'intune company portal setup'] },
  { cat: 'VPN', accept: ['vpn'], probes: ['vpn wont connect', 'globalprotect keeps dropping', 'anyconnect error', 'cant connect to the vpn', 'vpn disconnects every few minutes', 'forticlient wont connect'] },
  { cat: 'email', accept: ['mail', 'outlook_ooo'], probes: ['i cant send email', 'outlook not receiving mail', 'my inbox isnt updating', 'emails stuck in outbox', 'set an out of office', 'exchange mailbox full'] },
  { cat: 'BitLocker', accept: ['kb:bitlocker'], probes: ['bitlocker is asking for a recovery key', 'my laptop wants a bitlocker key', 'bitlocker recovery screen on boot', 'bitlocker locked me out', 'enter bitlocker recovery key', 'bitlocker prompt after update'] },
  { cat: 'onboarding/offboarding', accept: ['kb:onboarding'], probes: ['new hire setup', 'offboard a departing employee', 'deactivate a user account', 'set up a new starter', 'provision a new employee', 'employee leaving need to disable access'] },
];
const coverage = [];
for (const t of TAXONOMY) {
  const rows = t.probes.map((q) => ({ q, got: classify(q), ok: t.accept.includes(classify(q)) }));
  const hit = rows.filter((r) => r.ok).length;
  const pct = Math.round((hit / rows.length) * 100);
  coverage.push({ cat: t.cat, accept: t.accept, pct, band: pct >= 85 ? 'STRONG' : pct === 0 ? 'NONE' : 'WEAK', hit, n: rows.length, misroutes: rows.filter((r) => !r.ok) });
}

const report = {
  source: 'aria.html (extracted classify) · ' + new Date().toISOString().slice(0, 10),
  scale: { total, correct, accuracyPct: +((correct / total) * 100).toFixed(2), itTotal, itDeflected, deflectionPct: +((itDeflected / itTotal) * 100).toFixed(2) },
  coverageBands: coverage.map((c) => ({ cat: c.cat, pct: c.pct, band: c.band })),
  coverage,
};
fs.writeFileSync(path.join(__dirname, 'breadth-results.json'), JSON.stringify(report, null, 2));

console.log(`\n=========== ARIA CLASSIFIER BREADTH (extracted from aria.html) ===========`);
console.log(`Part A · SCALE: ${total.toLocaleString()} scenarios · accuracy ${report.scale.accuracyPct}% (${correct.toLocaleString()}/${total.toLocaleString()}) · IT deflection ${report.scale.deflectionPct}%`);
console.log(`Part B · TAXONOMY COVERAGE:`);
let strong = 0, weak = 0, none = 0;
for (const c of coverage) {
  const tag = c.band === 'STRONG' ? '✅ STRONG' : c.band === 'WEAK' ? '⚠️  WEAK ' : '❌ NONE  ';
  if (c.band === 'STRONG') strong++; else if (c.band === 'WEAK') weak++; else none++;
  console.log(`  ${tag} ${String(c.pct + '%').padStart(4)} ${c.cat.padEnd(26)} (${c.hit}/${c.n})`);
  for (const m of c.misroutes) console.log(`           ↳ "${m.q}" → ${m.got}`);
}
console.log(`\nBANDS: ${strong} STRONG · ${weak} WEAK · ${none} NONE   → breadth-results.json`);

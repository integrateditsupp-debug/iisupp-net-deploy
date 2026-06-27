'use strict';
/* FULL-SCALE breadth test of the ARIA classifier (offline mirror of production aria.html classify()).
   Part A — SCALE: run the entire 332K mega-corpus through classify()/looksLikeResolution(); report routing
   accuracy vs the corpus's own labels + deflection. Part B — TAXONOMY COVERAGE: curated probes for every
   call category named in the goal → coverage map (strong/weak/NONE) + every misroute. RULE 14: real numbers. */
const fs = require('fs');
const { classify, looksLikeResolution } = require('./aria-classifier-mirror.js');
const corpus = require('./scenario-corpus-mega.js');

// Intents that mean "no confident IT KB route" (a non-deflection / fallthrough bucket).
const NON_DEFLECT = new Set(['default', 'escalation', 'voice', 'shopping', 'news', 'weather', 'trade', 'quote']);
// Corpus expect-labels that are intentionally NOT IT (should NOT get a confident KB route).
const FALLTHROUGH_EXPECT = new Set(['default', 'weather', 'news', 'weather/news', 'trade', 'quote', 'shopping', 'voice']);
// Labels handled by the resolution classifier (not classify()) or with a combined form.
const NON_IT_DEFLECT = new Set(['resolution', 'not-resolution']);

// Honest per-item scorer. Handles resolution / not-resolution (looksLikeResolution) and the combined
// 'weather/news' label (classify returns 'weather' OR 'news') — so the headline isn't a label-format artifact.
function scoreItem(item) {
  const q = item.q;
  if (item.expect === 'resolution') { const r = looksLikeResolution(q); return { ok: r, got: r ? 'resolution' : classify(q) }; }
  if (item.expect === 'not-resolution') { const r = looksLikeResolution(q); return { ok: !r, got: r ? 'resolution(FP)' : '(correct:not-resolution)' }; }
  const g = classify(q);
  if (item.expect === 'weather/news') return { ok: g === 'weather' || g === 'news', got: g };
  return { ok: g === item.expect, got: g };
}

// ---------- Part A — SCALE run over the full corpus ----------
const byExpect = {};            // expect -> {t, correct, deflected}
let total = 0, correct = 0, itTotal = 0, itDeflected = 0;
const misExamples = {};         // expect -> [{q, got}] (cap a few per category)
for (const item of corpus) {
  if (item.expect === 'edge') continue;
  total++;
  const { ok, got } = scoreItem(item);
  const e = (byExpect[item.expect] ||= { t: 0, correct: 0, deflected: 0 });
  e.t++;
  if (ok) { correct++; e.correct++; }
  else { (misExamples[item.expect] ||= []); if (misExamples[item.expect].length < 4) misExamples[item.expect].push({ q: item.q.slice(0, 70), got }); }
  // Deflection: among IT-intent items, did it get a confident (non-fallthrough) route?
  if (!FALLTHROUGH_EXPECT.has(item.expect) && !NON_IT_DEFLECT.has(item.expect)) {
    itTotal++;
    if (!NON_DEFLECT.has(classify(item.q))) { e.deflected++; itDeflected++; }
  }
}

// ---------- Part B — Taxonomy coverage probes ----------
const TAXONOMY = [
  { cat: 'break/fix · BSOD/boot', accept: ['kb:windows'], probes: ['blue screen of death', 'my pc wont boot', 'stuck on a boot loop', 'windows wont start up', 'bsod stop code on startup', 'computer keeps restarting'] },
  { cat: 'break/fix · performance', accept: ['kb:performance'], probes: ['my computer is really slow', 'laptop running hot and slow', 'high cpu usage all the time', 'disk at 100 percent', 'everything takes forever to load', 'machine is sluggish'] },
  { cat: 'break/fix · hardware', accept: ['kb:hardware', 'kb:windows', 'kb:macos', 'kb:usb', 'kb:bluetooth', 'escalation'], probes: ['my laptop wont turn on', 'screen is black', 'keyboard stopped working', 'laptop wont charge', 'docking station not working'] },
  { cat: 'permissions', accept: ['kb:permissions'], probes: ['i cant access the shared folder', 'access denied to the file share', 'permission denied on the network drive', 'i lost access to a folder', 'cant open the shared drive', 'user cant open the team folder'] },
  { cat: 'account unlock', accept: ['password', 'kb:active-directory'], probes: ['my account is locked', 'im locked out of my account', 'please unlock my account', 'account locked out after too many attempts', 'unlock my domain account', 'locked out in the domain'] },
  { cat: 'password reset', accept: ['password'], probes: ['reset my password', 'i forgot my password', 'need a password reset', 'change my expired password', 'password reset please', 'cant log in wrong password'] },
  { cat: 'MFA', accept: ['kb:mfa'], probes: ['im not getting my mfa code', 'authenticator app not working', 'set up mfa on my new phone', '2fa code never arrives', 'need to register for multi factor', 'verification code not coming'] },
  { cat: 'app repair', accept: ['kb:office', 'mail', 'kb:teams', 'kb:m365', 'kb:browser', 'kb:onedrive'], probes: ['outlook wont open', 'teams keeps crashing', 'repair my office installation', 'reinstall office', 'my office apps wont launch', 'word keeps freezing'] },
  { cat: 'printer add', accept: ['printer'], probes: ['add a printer', 'install a new printer', 'set up the office printer', 'how do i connect to the printer', 'need to add the network printer', 'map me to the 3rd floor printer'] },
  { cat: 'mobile iOS/Android setup', accept: ['kb:mobile', 'mail', 'kb:m365', 'kb:onboarding', 'kb:mfa'], probes: ['set up email on my iphone', 'configure outlook on my android', 'set up my work phone', 'add my work account to my ipad', 'how do i set up company email on my personal phone', 'enroll my android phone for work'] },
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
  const band = pct >= 85 ? 'STRONG' : pct === 0 ? 'NONE' : 'WEAK';
  coverage.push({ cat: t.cat, accept: t.accept, pct, band, hit, n: rows.length, misroutes: rows.filter((r) => !r.ok) });
}

const report = {
  scale: {
    total, correct, accuracyPct: +((correct / total) * 100).toFixed(2),
    itTotal, itDeflected, deflectionPct: +((itDeflected / itTotal) * 100).toFixed(2),
    distinctExpectCategories: Object.keys(byExpect).length,
  },
  byExpect: Object.fromEntries(Object.entries(byExpect).sort((a, b) => b[1].t - a[1].t).map(([k, v]) => [k, { n: v.t, acc: +((v.correct / v.t) * 100).toFixed(1) }])),
  worstCorpusCategories: Object.entries(byExpect).map(([k, v]) => ({ k, n: v.t, acc: +((v.correct / v.t) * 100).toFixed(1) })).filter((x) => x.n >= 50).sort((a, b) => a.acc - b.acc).slice(0, 12),
  coverage,
};
fs.writeFileSync(__dirname + '/breadth-results.json', JSON.stringify(report, null, 2));

// ---------- Console summary ----------
console.log(`\n================ ARIA CLASSIFIER — FULL-SCALE BREADTH TEST ================`);
console.log(`Part A · SCALE (offline mirror of production classify()):`);
console.log(`  Scenarios run     : ${total.toLocaleString()}`);
console.log(`  Routing accuracy  : ${correct.toLocaleString()}/${total.toLocaleString()} = ${report.scale.accuracyPct}% (classify == corpus label)`);
console.log(`  Deflection (IT)   : ${itDeflected.toLocaleString()}/${itTotal.toLocaleString()} = ${report.scale.deflectionPct}% IT queries got a confident KB route`);
console.log(`  Distinct intents  : ${report.scale.distinctExpectCategories}`);
console.log(`\n  Weakest corpus categories (n>=50):`);
for (const c of report.worstCorpusCategories) console.log(`    ${String(c.acc + '%').padStart(6)}  ${c.k.padEnd(20)} (n=${c.n.toLocaleString()})`);

console.log(`\nPart B · TAXONOMY COVERAGE MAP (curated probes per goal category):`);
for (const c of coverage) {
  const tag = c.band === 'STRONG' ? '✅ STRONG' : c.band === 'WEAK' ? '⚠️  WEAK ' : '❌ NONE  ';
  console.log(`  ${tag}  ${String(c.pct + '%').padStart(4)}  ${c.cat.padEnd(26)} (${c.hit}/${c.n})`);
  for (const m of c.misroutes) console.log(`            ↳ misroute: "${m.q}"  →  ${m.got}  (wanted ${c.accept.join('|')})`);
}
console.log(`\nreport JSON → breadth-results.json`);

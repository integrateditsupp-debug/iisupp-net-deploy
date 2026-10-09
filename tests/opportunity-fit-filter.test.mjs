// tests/opportunity-fit-filter.test.mjs — RUN-CV / CV5 (2026-10-09), missed request A22.
//
// The opportunity engine's hourly quality gate ranked "Flight Deck Lighting", "Water Supply",
// "Tree Inventory", "Lightning Protection" and "LiDAR (deadline 2040)" as priority 10/10 revenue
// items, so the CEO digest was noise. This suite is the contract for the IT/MSP fit filter that
// now sits in front of the score: the five noise notices are parked with a written reason, the
// MSP's real work is untouched, IT-adjacent work (cameras, VoIP) is kept but capped and labelled,
// a human verdict beats every keyword, and the filter never throws on a malformed item.
//
// Everything here is a fixture in memory. Importing the worker runs nothing (its entry is guarded),
// so no state file is created and no record root is opened.
//   node tests/opportunity-fit-filter.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  itFit, gateDecision, quality, newStatus, rankItems, collectHits, humanWhyRelevant, findOverride,
  IT_FIT_TERMS, IT_ADJACENT_TERMS, NON_IT_TERMS, ADJACENT_QUALITY_CAP,
} from '../scripts/opportunity-quality-gate-agent.mjs';

let n = 0;
const ok = (name) => { n++; console.log(`  ok — ${name}`); };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// A CanadaBuys-shaped tender exactly as the research + review agents hand it to the gate: the
// derived whyRelevant carries "IT support fit" (written for ANY notice containing "support"), the
// priority is the maximum, and the summary is the standard notice line. The feed name is a plain
// tender feed so the OLD gate promotes every one of these (tender +3, canadabuys +1, priority 10 →
// needs_review) — which is exactly how the noise reached the digest, and what this filter changes.
const tender = (title, extra = {}) => ({
  id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  title,
  organization: 'Town of Example',
  sourceName: 'CanadaBuys tender notices',
  sourceLink: `https://canadabuys.canada.ca/en/tender-opportunities/tender-notice/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  type: 'tender',
  deadline: '2040-01-01',
  priorityScore: 10,
  difficultyScore: 6,
  status: 'new',
  whyRelevant: 'public-sector credibility and contract potential, IT support fit',
  summary: 'CanadaBuys notice. Category: not listed. Closing date: 2040-01-01.',
  tags: ['tender'],
  ...extra,
});

// ---------------------------------------------------------------- 1. the five noise notices are parked
const NOISE = ['Flight Deck Lighting', 'Water Supply', 'Tree Inventory', 'Lightning Protection', 'LiDAR (deadline 2040)'];
for (const title of NOISE) {
  const item = tender(title);
  assert.equal(newStatus(item, quality(item, null), null), 'needs_review', `${title}: the old gate promoted this to the revenue list — the defect`);
  const fit = itFit(item);
  assert.equal(fit.fit, 'non-it', `${title}: expected non-it, got ${fit.fit} (${fit.reason})`);
  assert.ok(fit.hits.some((h) => h.side === 'non-it'), `${title}: a non-IT hit is named`);
  assert.match(fit.reason, /Parked by the IT\/MSP fit filter/);
  assert.match(fit.reason, /non-IT domain/);
  const d = gateDecision(item, []);
  assert.equal(d.status, 'ignored', `${title}: parked with the status the file already uses`);
  assert.equal(d.parkedByFilter, true);
  assert.ok(d.q <= 0, `${title}: quality ${d.q} can never clear the needs_review line`);
  assert.equal(d.fields.manualReason, fit.reason, `${title}: manualReason carries the filter's reason`);
  assert.equal(d.fields.itFit, 'non-it');
  assert.equal(d.fields.fitFilterApplied, true);
  assert.notEqual(d.status, 'needs_review');
}
ok('the five noise notices (lighting, water, trees, lightning protection, LiDAR) are non-it → ignored, reason recorded, never needs_review');

// The derived "IT support fit" label was the rescue path: it must not count, a human note must.
assert.equal(humanWhyRelevant('public-sector credibility and contract potential, IT support fit'), '');
assert.equal(humanWhyRelevant('AI automation fit, remote-friendly'), '');
assert.match(humanWhyRelevant('IT support fit; Ahmad: they asked for an M365 tenant migration'), /M365 tenant migration/);
assert.equal(itFit(tender('Water Supply', { whyRelevant: 'IT support fit, cybersecurity fit, AI automation fit' })).fit, 'non-it');
ok('the research agent\'s derived whyRelevant labels are stripped; a human-written note survives');

// -------------------------------------------------------------------- 2. the MSP's own work is untouched
const IT_WORK = ['IT Managed Services RFP', 'Microsoft 365 migration', 'Help desk support services', 'IT assessment (Keystone CYFS)', 'cybersecurity awareness program'];
for (const title of IT_WORK) {
  const item = tender(title, { organization: title.includes('Keystone') ? 'Keystone Child, Youth and Family Services' : 'Town of Example' });
  const fit = itFit(item);
  assert.equal(fit.fit, 'it', `${title}: expected it, got ${fit.fit} (${fit.reason})`);
  assert.ok(fit.hits.some((h) => h.side === 'it'), `${title}: an IT hit is named`);
  const d = gateDecision(item, []);
  assert.equal(d.q, quality(item, null), `${title}: the score is exactly what the scorer gave before the filter existed`);
  assert.equal(d.status, newStatus(item, quality(item, null), null), `${title}: the status is exactly what the gate gave before`);
  assert.notEqual(d.status, 'ignored');
  assert.equal(d.fields.manualReason, null, `${title}: no reason is written on an untouched item`);
  assert.equal(d.fields.itFit, 'it');
}
ok('managed IT / M365 / help desk / IT assessment / cybersecurity awareness are it → score and status untouched');

// The two older noise heuristics could not see "IT managed services" or "IT assessment" (their word
// list has no such terms) and docked −6 on a feed named "IT opportunities". An `it` verdict now exempts
// them; a non-IT notice on the same feed keeps the penalty (and is parked by the filter anyway).
{
  const onFeed = (title) => tender(title, { sourceName: 'CanadaBuys IT opportunities' });
  for (const title of ['IT Managed Services RFP', 'IT assessment (Keystone CYFS)', 'Microsoft 365 migration']) {
    assert.equal(quality(onFeed(title), null), quality(tender(title), null), `${title}: the category-feed penalty no longer docks IT work`);
    assert.equal(gateDecision(onFeed(title), []).status, 'needs_review', `${title}: promoted from the category feed as it should be`);
  }
  assert.ok(quality(onFeed('Flight Deck Lighting'), null) < quality(tender('Flight Deck Lighting'), null), 'the penalty still applies to non-IT work on that feed');
}
ok('an `it` verdict exempts IT work from the category-feed and goods-noise penalties; non-IT work keeps them');

// ----------------------------------------------------- 3. adjacent work is kept, capped and labelled
for (const title of ['Security camera system install', 'VoIP phone system']) {
  const item = tender(title);
  const fit = itFit(item);
  assert.equal(fit.fit, 'adjacent', `${title}: expected adjacent, got ${fit.fit} (${fit.reason})`);
  assert.match(fit.reason, /sub-prime or scope down/);
  const d = gateDecision(item, []);
  assert.notEqual(d.status, 'ignored', `${title}: adjacent is kept, not parked`);
  assert.notEqual(d.status, 'needs_review', `${title}: adjacent is never promoted over a strong fit`);
  assert.ok(d.q <= ADJACENT_QUALITY_CAP, `${title}: quality ${d.q} is capped at ${ADJACENT_QUALITY_CAP}`);
  assert.ok(quality(item, null) > d.q, `${title}: the cap actually bit (uncapped ${quality(item, null)})`);
  assert.equal(d.fields.itFit, 'adjacent');
  assert.equal(d.fields.manualReason, null, 'the label lives in itFit/itFitReason, manualReason stays the human\'s');
  assert.match(d.fields.itFitReason, /IT-adjacent/);
}
assert.ok(ADJACENT_QUALITY_CAP < 3, 'the cap sits under the needs_review line (q >= 3)');
ok('security cameras and VoIP are adjacent → kept, queued, capped below the needs_review line, labelled');

// The ranking: every strong fit ahead of every adjacent item of the same type, whatever the scores.
{
  const strong = { ...tender('Help desk support services'), ...gateDecision(tender('Help desk support services'), []).fields };
  const adj = { ...tender('VoIP phone system'), ...gateDecision(tender('VoIP phone system'), []).fields };
  const weakStrong = { ...strong, qualityScore: 1, priorityScore: 1 };
  const sorted = [adj, weakStrong, strong].sort(rankItems);
  assert.deepEqual(sorted.map((i) => i.title), ['Help desk support services', 'Help desk support services', 'VoIP phone system']);
  assert.equal(sorted[0].qualityScore, strong.qualityScore, 'among strong fits the score still orders');
  // a job never outranks a tender, exactly as before
  const job = { ...tender('AI Engineer', { type: 'job', priorityScore: 10 }), ...gateDecision(tender('AI Engineer', { type: 'job' }), []).fields };
  assert.equal([job, adj].sort(rankItems)[0].title, 'VoIP phone system');
}
ok('rankItems puts every strong fit ahead of every adjacent item; type weight still comes first');

// --------------------------------------------------- 4. a human verdict beats the keyword filter
{
  const water = tender('Water Supply');
  const keep = [{ match: { titleIncludes: 'Water Supply' }, action: 'keep', disposition: 'partner_path_only', reason: 'Ahmad: partner path with the water-systems integrator; IT scope only', reference: 'grounding/water-supply.md' }];
  assert.ok(findOverride(water, keep), 'the override matches');
  const d = gateDecision(water, keep);
  assert.notEqual(d.status, 'ignored', 'a kept item is not parked by a keyword');
  assert.equal(d.q, quality(water, null), 'the score is the plain score, no fit penalty');
  assert.equal(d.fields.manualReason, keep[0].reason, 'manualReason is the human\'s, never the filter\'s');
  assert.equal(d.fields.manualDisposition, 'partner_path_only');
  assert.equal(d.fields.manualReference, 'grounding/water-supply.md');
  assert.equal(d.fields.itFit, 'non-it', 'the label is still recorded for transparency');
  assert.equal(d.fields.fitFilterApplied, false, '...but marked as not applied');
  assert.equal(d.parkedByFilter, false);
  // an override that parks still parks — the human's call, reported as a manual park
  const park = [{ match: { titleIncludes: 'Help desk' }, action: 'ignore', reason: 'Ahmad: no-bid, incumbent locked in' }];
  const d2 = gateDecision(tender('Help desk support services'), park);
  assert.equal(d2.status, 'ignored');
  assert.equal(d2.fields.manualReason, park[0].reason);
  assert.equal(d2.parkedByFilter, false, 'a manual park is never counted as a filter park');
  // a disposition already on the item (set by a human elsewhere) is a verdict too
  const d3 = gateDecision(tender('Tree Inventory', { manualDisposition: 'partner_path_only' }), []);
  assert.notEqual(d3.status, 'ignored');
  assert.equal(d3.fields.fitFilterApplied, false);
}
ok('a manual override (keep or ignore) and an existing manualDisposition beat the filter');

// ------------------------------------------------------------- 5. the filter is total: never throws
{
  const weird = [
    undefined, null, 0, '', 'Water Supply', [], {}, { title: null }, { title: 42, organization: {}, summary: ['a', 'b'] },
    { title: 'Tree Inventory', whyRelevant: 12, summary: { nested: true }, tags: 'not-an-array', description: Symbol.for('x') },
    { title: 'x'.repeat(5000) + ' lighting' }, { title: 'Help desk', organization: undefined, summary: undefined },
  ];
  for (const item of weird) {
    const fit = itFit(item);
    assert.ok(['it', 'adjacent', 'non-it', 'unknown'].includes(fit.fit), `fit is one of the four verdicts for ${String(item)}`);
    assert.ok(Array.isArray(fit.hits) && typeof fit.reason === 'string' && fit.reason.length > 0);
    const d = gateDecision(item, undefined);
    assert.ok(typeof d.status === 'string' && typeof d.q === 'number', `gateDecision is total for ${String(item)}`);
  }
  assert.equal(itFit({}).fit, 'unknown', 'no signal at all is an abstention, not a verdict');
  assert.equal(itFit(null).fit, 'unknown');
  assert.equal(itFit({ title: 42, tags: 'x', summary: { a: 1 } }).fit, 'unknown');
  assert.equal(itFit({ title: 'Tree Inventory', whyRelevant: 12, summary: { nested: true } }).fit, 'non-it');
  assert.equal(gateDecision({ title: 'Request for Proposal 2026-44', type: 'tender', priorityScore: 10, status: 'new' }, []).fields.itFit, 'unknown');
  assert.deepEqual(collectHits(IT_FIT_TERMS, null), []);
  assert.deepEqual(collectHits(NON_IT_TERMS, 12), []);
  assert.equal(humanWhyRelevant(undefined), '');
}
ok('itFit / gateDecision / collectHits never throw on a missing, null or malformed field');

// ------------------------------------------- 6. the edges the keyword lists were tuned against
{
  const v = (title, extra) => itFit(tender(title, extra)).fit;
  assert.equal(v('Water Utility Cybersecurity Assessment'), 'it', 'the buyer\'s industry in the title does not outweigh two IT terms');
  assert.equal(v('Backup Generator Replacement'), 'non-it', '"backup" alone is not an IT term');
  assert.equal(v('Tree Inventory Management Software'), 'adjacent', 'a non-IT trade paired with software is a scope-down path, not a park');
  assert.equal(v('LiDAR Acquisition and GIS Data Processing'), 'adjacent', 'LiDAR with GIS data work is sub-primeable, LiDAR alone is not');
  assert.equal(v('RFP for Services', { organization: 'Ontario Clean Water Agency' }), 'unknown', 'the buyer\'s name is never evidence of a non-IT domain');
  assert.equal(v('RFP for Services', { organization: 'Ontario Clean Water Agency', summary: 'Supply of water treatment chemicals and chlorine' }), 'non-it', '...but the notice body is');
  assert.equal(v('Office relocation — IT readiness and move'), 'it');
  assert.equal(v('Audio visual upgrade for council chambers'), 'adjacent');
  assert.equal(v('Digital Signage Network'), 'adjacent', '"digital signage" is adjacent even though "signage" is a goods term');
  assert.equal(v('Snow Removal and Winter Maintenance'), 'non-it');
  assert.equal(v('Security Guard Services'), 'non-it', 'guards are not cybersecurity');
  assert.equal(v('Website redesign with AI intake'), 'it');
  assert.equal(v('External Financial Audit Services'), 'non-it', 'a financial audit is not an IT audit');
  assert.equal(v('Compliance audit — financial statements'), 'unknown', 'no term either way → abstain, the scorer decides as before');
  assert.equal(v('IT Audit and Technology Roadmap'), 'it');
  // domain only: a compliance/cert demand is the smart qualifier's call, never the filter's
  const certHeavy = tender('Managed IT Services — ISO 27001 certification and $5M insurance mandatory, security clearance required');
  assert.equal(itFit(certHeavy).fit, 'it');
  assert.notEqual(gateDecision(certHeavy, []).status, 'ignored', 'the filter never parks for a certification, bond or clearance reason');
}
ok('tuned edges hold: industry-in-title, backup generator, mixed trades, buyer name, certification demands');

// --------------------------------------------- 7. the term tables are well-formed and non-overlapping
{
  for (const [name, table] of [['IT_FIT_TERMS', IT_FIT_TERMS], ['IT_ADJACENT_TERMS', IT_ADJACENT_TERMS], ['NON_IT_TERMS', NON_IT_TERMS]]) {
    assert.ok(Object.isFrozen(table) && table.length > 0, `${name} is a frozen, non-empty table`);
    for (const [re, label] of table) {
      assert.ok(re instanceof RegExp && re.global && re.ignoreCase, `${name}: ${label} is a /gi regex`);
      assert.ok(typeof label === 'string' && label.length > 2, `${name}: every entry is labelled`);
    }
  }
  // each of the fixture titles lights exactly one side, so no title is both IT and non-IT by table design
  for (const title of [...NOISE, ...IT_WORK]) {
    const sides = new Set(itFit(tender(title)).hits.map((h) => h.side));
    assert.equal(sides.size, 1, `${title}: one side only (${[...sides].join(',')})`);
  }
}
ok('the three term tables are frozen /gi tables and the fixture titles each light exactly one side');

// ------------------------------------------------ 8. the worker file wires the filter, guarded entry
{
  const src = fs.readFileSync(path.join(ROOT, 'scripts', 'opportunity-quality-gate-agent.mjs'), 'utf8');
  assert.match(src, /const decision = gateDecision\(item, overrides\)/, 'main() routes every item through gateDecision');
  assert.match(src, /\.sort\(rankItems\)/, 'main() sorts with the fit-aware comparator');
  assert.match(src, /if \(isMain\) \{/, 'the worker only runs as an entry point');
  assert.match(src, /Parked by the IT\/MSP fit filter this run/, 'the report counts filter parks separately from manual parks');
  assert.match(src, /smart qualifier/i, 'the file states that the filter is domain-only and the smart qualifier stays with the human');
}
ok('the worker routes through gateDecision, sorts with rankItems, counts filter parks, and guards its entry');

console.log(`\nopportunity-fit-filter: ${n} checks passed`);

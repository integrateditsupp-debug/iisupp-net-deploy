// axis-researcher.mjs — AXIS Phase 2: the researcher that never existed.
//
// The Phase 2 audit (2026-08-13) scored every candidate against the spec's eight requirements:
// 0 of 8 fully satisfied. aria-research is a whitelisted single-hop vendor scraper (first URL
// wins, :580); the opportunity/global-bid agents are feed HARVESTERS whose unit of work is a
// posting, not a claim; nothing formulates queries, nothing cross-checks, nothing writes research
// to the vault. So this is CREATE-NEW, harvesting the audit's named patterns: per-source
// isolation and stated gaps (opportunity-research:398-424), the vault note conventions
// (axis-vault-brain learn():420-439), and degrade-never-die (global-bid:374-382).
//
// Retrieval channel: the local Claude CLI on the Max plan with WebSearch/WebFetch enabled —
// proven live before this file was written ("26 SOURCED nodejs.org", $0, no API key). The CLI is
// the retriever; THIS module is the discipline:
//   · a claim is [FACT] only with ≥2 independent sources — else it is DOWNGRADED to [INFERENCE]
//   · a claim with no source at all is MOVED TO GAPS — never kept, never invented
//   · every source carries url + publisher + published date (or "unknown") from the model, and
//     an accessed-at stamp from THIS module (it knows when it ran; the model need not be trusted)
//   · recency: sources older than the fast-moving threshold are flagged, not hidden
//   · failure degrades to a partial result with the gap STATED (ok:false, gaps:[why])
//   · the hard rule, enforced in code: inconclusive says inconclusive.
//
// Vault write-back: 15_Research/ (new folder, existing note conventions, never overwrites —
// unique slug + collision suffix) plus one line in _Research.md, mirroring _Learned.md.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VAULT = () => process.env.AXIS_VAULT || path.join(os.homedir(), 'Documents', 'AXIS-Brain');
const RESEARCH_DIR = '15_Research';
const MODEL = () => process.env.AXIS_MODEL_RESEARCH || 'claude-sonnet-4-6';
export const CLI_TIMEOUT_MS = 300000;         // real research takes minutes; a guess takes seconds
export const STALE_FAST_MOVING_DAYS = 365;    // for fast-moving topics, a year-old source is stale

// Never write a secret into the vault — same bar as the learn() writer this format mirrors.
const SECRETISH = /\b(?:sk-[a-z0-9-]{8,}|nfp_[A-Za-z0-9]{8,}|AKIA[A-Z0-9]{12,}|ghp_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{16,}|password\s*[:=]\s*\S+)/i;

// ── The brief: query formulation is part of the protocol, not left to chance ─
export function buildBrief(question, { fastMoving = false } = {}) {
  return [
    `RESEARCH BRIEF: ${question}`,
    '',
    'You are a research agent with WebSearch and WebFetch. Work the question, do not answer from memory:',
    '1. FORMULATE 2-4 distinct search queries attacking the question from different angles',
    '   (definition/spec, competitor/market, recent-news, primary-source). Run each.',
    '2. Retrieve from MULTIPLE INDEPENDENT publishers. One publisher is one vote, however many of',
    '   its pages you read.',
    '3. CROSS-CHECK: where sources disagree, say so explicitly — never average a disagreement away.',
    '4. Never fabricate. A hole in the evidence is reported as a hole.',
    '',
    'OUTPUT EXACTLY THIS FORMAT (plain text, no markdown fences):',
    'QUERIES USED:',
    '- <each search query you actually ran>',
    'FINDINGS:',
    '1. [FACT|INFERENCE] <one claim per numbered item>',
    '   SOURCES: <url> | <publisher> | published <YYYY-MM-DD or unknown> ;; <url2> | <publisher2> | published <...>',
    'CONFLICTS:',
    '- <claim> :: <source A says X> vs <source B says Y> :: <which is better supported and why>',
    '(or the single word none)',
    'GAPS:',
    '- <what you could NOT verify, and why>',
    '(or the single word none)',
    'RECENCY:',
    '- <source or claim that may be stale for this topic, and why>',
    '(or the single word none)',
    '',
    'Mark [FACT] only when at least two independent publishers agree. Everything else is',
    '[INFERENCE], including your own synthesis.' + (fastMoving ? ' This is a FAST-MOVING topic: treat anything older than a year as suspect and say so under RECENCY.' : ''),
  ].join('\n');
}

// ── The CLI call: Max plan, web tools on, prompt over stdin (never argv) ─────
function askCli(prompt, { timeoutMs = CLI_TIMEOUT_MS, model = MODEL(), runner = null } = {}) {
  if (runner) return runner(prompt);
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;              // the metered-account trap, same scrub as the worker
    delete env.ANTHROPIC_AUTH_TOKEN;
    const args = ['--print', '--strict-mcp-config', '--no-session-persistence',
      '--allowedTools', 'WebSearch,WebFetch', '--model', model];
    let out = '', err = '', done = false;
    const c = spawn('claude', args, { shell: process.platform === 'win32', env });
    const t = setTimeout(() => { if (!done) { done = true; try { c.kill(); } catch {} resolve({ error: 'timeout' }); } }, timeoutMs);
    c.stdout.on('data', (d) => { out += d; });
    c.stderr.on('data', (d) => { err += d; });
    c.on('error', (e) => { if (!done) { done = true; clearTimeout(t); resolve({ error: 'spawn: ' + e.message }); } });
    c.on('close', (code) => {
      if (done) return; done = true; clearTimeout(t);
      const text = out.trim();
      if (code === 0 && text) resolve({ answer: text });
      else resolve({ error: err.trim().slice(0, 300) || `exit ${code}` });
    });
    try { c.stdin.write(prompt); c.stdin.end(); }
    catch (e) { if (!done) { done = true; clearTimeout(t); resolve({ error: 'stdin: ' + e.message }); } }
  });
}

// ── Parse + ENFORCE the protocol ─────────────────────────────────────────────
// The model reports; this module judges. Parsing failures degrade to a stated gap, never a throw.
export function parseSources(line) {
  return String(line || '').replace(/^\s*SOURCES?:\s*/i, '').split(';;').map((s) => {
    const [url, publisher, pub] = s.split('|').map((x) => String(x || '').trim());
    const m = /published\s+(\S.*)$/i.exec(pub || '');
    return { url: url || '', publisher: publisher || '', published: m ? m[1].trim() : 'unknown' };
  }).filter((s) => /^https?:\/\//i.test(s.url));
}

export function validateReport(raw, { fastMoving = false, now = Date.now() } = {}) {
  const text = String(raw || '');
  const section = (name, next) => {
    const re = new RegExp(name + ':\\s*\\n?([\\s\\S]*?)(?=\\n(?:' + next + '):|$)', 'i');
    const m = re.exec(text);
    return m ? m[1].trim() : '';
  };
  const findingsBlock = section('FINDINGS', 'CONFLICTS|GAPS|RECENCY');
  const conflictsBlock = section('CONFLICTS', 'GAPS|RECENCY');
  const gapsBlock = section('GAPS', 'RECENCY');
  const recencyBlock = section('RECENCY', '$ never');
  const queriesBlock = section('QUERIES USED', 'FINDINGS');

  const accessedAt = new Date(now).toISOString().slice(0, 10);
  const claims = [];
  const gaps = gapsBlock && !/^\s*none\s*$/i.test(gapsBlock)
    ? gapsBlock.split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean) : [];

  // A numbered claim, then its SOURCES line(s) until the next number.
  const items = findingsBlock.split(/\n(?=\d+\.\s)/).map((x) => x.trim()).filter(Boolean);
  for (const item of items) {
    const head = item.split('\n')[0];
    const m = /^\d+\.\s*\[(FACT|INFERENCE)\]\s*(.+)$/i.exec(head);
    if (!m) continue;
    let kind = m[1].toUpperCase();
    const claim = m[2].trim();
    const srcLines = item.split('\n').slice(1).filter((l) => /SOURCES?:/i.test(l));
    const sources = srcLines.flatMap(parseSources).map((s) => ({ ...s, accessed: accessedAt }));
    if (!sources.length) {
      // The hard rule, in code: an unsourced claim is not a finding, it is a gap.
      gaps.push(`unsourced claim removed from findings: "${claim.slice(0, 140)}"`);
      continue;
    }
    const publishers = new Set(sources.map((s) => s.publisher.toLowerCase() || new URL(s.url).hostname));
    let downgraded = false;
    if (kind === 'FACT' && publishers.size < 2) { kind = 'INFERENCE'; downgraded = true; }
    claims.push({ kind, claim, sources, downgraded });
  }

  const recency = recencyBlock && !/^\s*none\s*$/i.test(recencyBlock)
    ? recencyBlock.split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean) : [];
  // Module-side recency check, independent of what the model volunteered.
  if (fastMoving) {
    for (const c of claims) for (const s of c.sources) {
      const d = Date.parse(s.published);
      if (!isNaN(d) && now - d > STALE_FAST_MOVING_DAYS * 86400000) {
        recency.push(`stale for a fast-moving topic: ${s.url} (published ${s.published})`);
      }
    }
  }
  const conflicts = conflictsBlock && !/^\s*none\s*$/i.test(conflictsBlock)
    ? conflictsBlock.split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean) : [];
  const queries = queriesBlock ? queriesBlock.split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean) : [];

  return {
    ok: claims.length > 0,
    claims, conflicts, gaps, recency: [...new Set(recency)], queries,
    facts: claims.filter((c) => c.kind === 'FACT').length,
    inferences: claims.filter((c) => c.kind === 'INFERENCE').length,
  };
}

// ── The vault note: 15_Research/, never overwriting, index maintained ────────
export function writeResearchNote(question, report, { vaultRoot = VAULT(), model = MODEL(), now = new Date() } = {}) {
  const dir = path.join(vaultRoot, RESEARCH_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const date = now.toISOString().slice(0, 10);
  const slug = String(question).toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'research';
  let rel = `${slug}.md`;
  // NEVER overwrite: a same-slug note gets a timestamp suffix, exactly the never-overwrite rule.
  if (fs.existsSync(path.join(dir, rel))) rel = `${slug}-${Date.now().toString(36)}.md`;

  const claimLines = report.claims.map((c) =>
    `- [${c.kind}]${c.downgraded ? ' (downgraded: fewer than two independent publishers)' : ''} ${c.claim}\n`
    + c.sources.map((s) => `  - source: ${s.url} (${s.publisher || 'publisher unknown'}, published ${s.published}, accessed ${s.accessed})`).join('\n')
  ).join('\n');
  const list = (arr, empty) => arr.length ? arr.map((x) => `- ${x}`).join('\n') : `- ${empty}`;

  const body = [
    '---',
    'type: research',
    'brain_region: research',
    'source: axis-researcher',
    `model: ${model}`,
    `confidence: ${report.facts > 0 ? 'medium' : 'low'}`,
    `created: ${date}`,
    `question: ${String(question).slice(0, 300).replace(/\n/g, ' ')}`,
    '---',
    '',
    `# ${String(question).slice(0, 200)}`,
    '',
    `## Findings (${report.facts} fact${report.facts === 1 ? '' : 's'}, ${report.inferences} inference${report.inferences === 1 ? '' : 's'})`,
    claimLines || '- none survived source validation',
    '',
    '## Conflicts between sources',
    list(report.conflicts, 'none found'),
    '',
    '## Gaps — what could NOT be verified',
    list(report.gaps, 'none stated'),
    '',
    '## Recency flags',
    list(report.recency, 'none'),
    '',
    `Researched ${date} by axis-researcher (${report.queries.length} quer${report.queries.length === 1 ? 'y' : 'ies'} run). Related: [[_Research]] [[_HOME]]`,
    '',
  ].join('\n');

  if (SECRETISH.test(body)) return { written: false, reason: 'secret-like content refused' };
  fs.writeFileSync(path.join(dir, rel), body, 'utf8');

  // Folder index, mirroring _Learned.md: one line per note, created if absent, appended otherwise.
  const idx = path.join(dir, '_Research.md');
  if (!fs.existsSync(idx)) {
    fs.writeFileSync(idx, ['---', 'type: index', 'brain_region: research', `created: ${date}`, '---', '',
      '# Research — sourced findings, one note per question', '',
      '> Written by axis-researcher. Every claim carries its sources; facts needed two independent publishers.', ''].join('\n'), 'utf8');
  }
  fs.appendFileSync(idx, `- [[${rel.replace(/\.md$/, '')}]] — ${date}, ${report.facts}F/${report.inferences}I, ${report.gaps.length} gap${report.gaps.length === 1 ? '' : 's'}\n`);
  return { written: true, rel: `${RESEARCH_DIR}/${rel}` };
}

// ── The agent ────────────────────────────────────────────────────────────────
export async function research(question, opts = {}) {
  const q = String(question || '').trim();
  if (q.length < 8) return { ok: false, gaps: ['question too short to research'], claims: [], conflicts: [], recency: [], queries: [] };
  const brief = buildBrief(q, opts);
  const r = await askCli(brief, opts);
  if (r.error) {
    // Degradation, not invention: the failure IS the finding.
    return { ok: false, claims: [], conflicts: [], recency: [], queries: [],
      gaps: [`retrieval failed: ${r.error} — nothing was verified, nothing is claimed`] };
  }
  const report = validateReport(r.answer, opts);
  if (!report.ok) report.gaps.push('the retrieval ran but produced no claims that survived source validation');
  let note = { written: false, reason: 'skipped' };
  if (opts.writeVault !== false) {
    try { note = writeResearchNote(q, report, opts); } catch (e) { note = { written: false, reason: e.message }; }
  }
  return { ...report, note, raw: opts.keepRaw ? r.answer : undefined };
}

// One spoken line for AXIS: counts and the note, never a wall of text.
export function spokenSummary(result) {
  if (!result.ok) return `Research came back empty — ${result.gaps[0] || 'no verified findings'}. I have not invented anything to fill the hole.`;
  const bits = [`${result.facts} verified fact${result.facts === 1 ? '' : 's'}`, `${result.inferences} inference${result.inferences === 1 ? '' : 's'}`];
  if (result.conflicts.length) bits.push(`${result.conflicts.length} source conflict${result.conflicts.length === 1 ? '' : 's'} flagged`);
  if (result.gaps.length) bits.push(`${result.gaps.length} stated gap${result.gaps.length === 1 ? '' : 's'}`);
  return `Research done: ${bits.join(', ')}.` + (result.note && result.note.written ? ` Full sourced note in the vault at ${result.note.rel}.` : '');
}

export default { research, buildBrief, validateReport, parseSources, writeResearchNote, spokenSummary, CLI_TIMEOUT_MS, STALE_FAST_MOVING_DAYS };

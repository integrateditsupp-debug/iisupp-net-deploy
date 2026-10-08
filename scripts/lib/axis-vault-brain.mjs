// axis-vault-brain.mjs — brain #1: the AXIS Obsidian vault, read first and written back to.
//
// Ahmad, 2026-08-12: "ensure the Axis brain is saved as a vault in obsidian and Axis looks at both
// brains starting with obsidian. Future info and learning will be saved in obsidian axis vault."
//
// WHY THIS LIVES IN THE WORKER AND NOT IN THE NETLIFY FUNCTION (the same honest constraint as the
// Max plan): the vault is a folder of markdown on Ahmad's machine. A cloud function cannot read it,
// and syncing 164 notes into Blobs on every edit would make the vault a cache rather than the brain.
// The worker already runs locally for exactly this reason, so the vault tier sits in front of the
// CLI call there: a vault hit answers in single-digit milliseconds and costs zero tokens.
//
//   question → VAULT (here, ~5ms, $0) → ARIA brain (Blobs KB) → Claude Max CLI (~2-17s)
//                    ↑                                                    │
//                    └──────────── learned note written back ─────────────┘
//
// The vault is the durable brain: Blobs is a cache that a redeploy or a store wipe can lose, while
// the vault is a git-able folder Ahmad can read, edit, and search in Obsidian himself.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const VAULT_ROOT = process.env.AXIS_VAULT
  || path.join(os.homedir(), 'Documents', 'AXIS-Brain');

// Region folders, in the order a general question should be searched. Hippocampus (rules, stack,
// voice) and Cortex (people, agents) answer the majority of "what's the rule on…" / "who is…"
// questions, so they are scored ahead of the bulk folders rather than after them.
export const REGION_ORDER = [
  '13_Learned', '02_Hippocampus', '07_Cortex', '00_Index', '09_Decisions',
  '01_Frontal', '04_ShortTerm', '03_BasalGanglia', '10_Brainstem',
  '08_Amygdala', '11_CorpusCallosum', '06_Cerebellum', '05_Thalamus', '12_Glia', '14_Sources',
];
const REGION_BOOST = Object.fromEntries(REGION_ORDER.map((r, i) => [r, (REGION_ORDER.length - i) * 0.6]));

// Words that carry no topical signal. Kept small on purpose: an over-eager stop list drops the very
// terms that distinguish two notes ("spend cap" → "cap").
const STOP = new Set(('a an and are as at be but by can do does for from has have how i if in is it its'
  + ' me my of on or our so than that the their them then there these they this to was we what when'
  + ' where which who why will with you your').split(' '));

// Plural folding, applied identically to notes and to questions so the two always agree. Without it
// "refunds" misses a note that says "refund" and "agents" misses "agent" — the commonest way a
// vault lookup silently fails. Deliberately just the -s rule: a real stemmer would fold "billing"
// into "bill" and start matching notes that are about something else.
function fold(w) {
  return (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) ? w.slice(0, -1) : w;
}

// Hyphens SPLIT. Vault note names are hyphenated by convention — "Leads-agent", "feedback-spend-cap",
// "D-20260619-bake-stripe-price-ids-in-code" — and keeping the hyphen inside the token made
// "Leads-agent" a single term that the question "who is the leads agent" could never match. Measured
// 2026-08-12: Leads-agent.md did not appear in the top 4 for its own subject.
function tokenize(s) {
  return String(s || '').toLowerCase().match(/[a-z0-9][a-z0-9']*/g)
    ?.filter(w => w.length > 1 && !STOP.has(w)).map(fold) || [];
}

// ── Index ────────────────────────────────────────────────────────────────────
// Built once and reused. Rebuilt when any note's mtime moves, so Ahmad editing a note in Obsidian
// is picked up on the next question without restarting the worker.
let _index = null;
let _builtAt = 0;
let _stamp = '';

// AXIS-SYSTEM.md is configuration, not knowledge. It quotes the hard rules verbatim so the model
// obeys them, which made it outrank RULES.md on rule questions — the brain answering from its own
// prompt instead of from the vault. Measured 2026-08-12 on "what is the rule about money back
// guarantees": AXIS-SYSTEM.md scored 20.03 against RULES.md's 18.80.
const NOT_KNOWLEDGE = new Set(['00_Index/AXIS-SYSTEM.md']);

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;              // .obsidian, .git
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.md')) {
      const rel = path.relative(VAULT_ROOT, p).replace(/\\/g, '/');
      if (!NOT_KNOWLEDGE.has(rel)) out.push(p);
    }
  }
  return out;
}

// A cheap fingerprint of the vault: count + newest mtime. Full re-read only when it changes.
function vaultStamp(files) {
  let newest = 0;
  for (const f of files) { try { const m = fs.statSync(f).mtimeMs; if (m > newest) newest = m; } catch {} }
  return `${files.length}:${Math.round(newest)}`;
}

// The auto-generated [[link]] blocks at the foot of most notes are 90+ lines of every note title in
// the vault. Left in, every note matches every query and scoring collapses. Strip them before
// indexing — they are navigation, not content.
export function stripLinkWeb(text) {
  return String(text || '')
    .replace(/<!--\s*LINK-WEB:auto\s*-->[\s\S]*?(?:<!--\s*\/LINK-WEB:auto\s*-->|$)/gi, '')
    .replace(/^##\s*Related\s*$/gim, '');
}

function parseNote(file) {
  let raw;
  try { raw = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const rel = path.relative(VAULT_ROOT, file).replace(/\\/g, '/');
  const region = rel.split('/')[0];
  const name = path.basename(file, '.md');

  let front = {};
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fm) {
    for (const line of fm[1].split(/\r?\n/)) {
      const m = line.match(/^([a-z_]+):\s*(.*)$/i);
      if (m) front[m[1].toLowerCase()] = m[2].trim();
    }
  }
  const body = stripLinkWeb(fm ? raw.slice(fm[0].length) : raw).trim();
  // Headings are the note's own table of contents. A big note like RULES.md is not "about" any one
  // thing, but its "## R1 · Spend cap" heading says precisely what that section is about — which is
  // the level a question is usually pitched at.
  const headings = (body.match(/^#{1,6}\s+.+$/gm) || []).join(' ');
  // Paragraphs, kept for passage-level scoring. A heading line is glued to the block beneath it so
  // "## R1 · Spend cap" and its bullets are scored — and later quoted — as one answer.
  const paragraphs = [];
  {
    const blocks = body.split(/\r?\n\s*\r?\n/).map(b => b.trim()).filter(Boolean);
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (/^#{1,6}\s/.test(b) && b.split(/\r?\n/).length === 1 && blocks[i + 1]) {
        paragraphs.push(b + '\n' + blocks[i + 1]); i++;
      } else paragraphs.push(b);
    }
  }
  // link-web.mjs generated ~30 placeholder notes whose title is perfect and whose body is one line
  // of boilerplate. They are the worst possible search result: they rank highly on topic and then
  // answer nothing. Measured 2026-08-12: "what is the monthly spend cap" matched the stub
  // feedback-spend-cap-20-70-per-month.md and returned "Stub created by link-web.mjs".
  const prose = body.replace(/^#{1,6}\s+.*$/gm, '').replace(/^>.*$/gm, '').replace(/\[\[[^\]]*\]\]/g, '').trim();
  const isStub = front.type === 'stub' || /stub created by/i.test(body) || prose.length < 80;

  return {
    file, rel, region, name, front, body, headings, paragraphs, isStub,
    terms: tokenize(name + ' ' + body),
    paraTerms: paragraphs.map(p => new Set(tokenize(p))),
    titleTerms: new Set(tokenize(name)),
    headingTerms: new Set(tokenize(headings)),
  };
}

export function buildIndex(force = false) {
  const files = walk(VAULT_ROOT);
  const stamp = vaultStamp(files);
  if (!force && _index && stamp === _stamp) return _index;
  const notes = [];
  for (const f of files) { const n = parseNote(f); if (n && !n.isStub) notes.push(n); }
  // Document frequency, so a term in every note (e.g. "axis") counts for far less than a rare one.
  const df = new Map();
  for (const n of notes) for (const t of new Set(n.terms)) df.set(t, (df.get(t) || 0) + 1);
  // Average length, for BM25's length normalisation. Without it the longest notes win every query:
  // measured 2026-08-12 against the real 167-note vault, "how many years of IT experience" returned
  // a 400-line sales playbook and "the Netlify site id" returned a SAM.gov page, purely because
  // those notes are big enough to contain a few of the query's words somewhere.
  const avgLen = notes.length ? notes.reduce((s, n) => s + n.terms.length, 0) / notes.length : 1;
  _index = { notes, df, size: notes.length, avgLen };
  _stamp = stamp;
  _builtAt = Date.now();
  return _index;
}

export function vaultAvailable() {
  try { return fs.statSync(VAULT_ROOT).isDirectory(); } catch { return false; }
}

export function vaultStats() {
  if (!vaultAvailable()) return { available: false, root: VAULT_ROOT, notes: 0 };
  const idx = buildIndex();
  return { available: true, root: VAULT_ROOT, notes: idx.size, builtAt: _builtAt };
}

// ── Search ───────────────────────────────────────────────────────────────────
// tf-idf with a title bonus and a region bonus. Deliberately plain: no embeddings, no network, no
// model call. It runs in a few milliseconds over ~170 notes and its job is to be *right about
// obvious things* (rules, people, prices, stack) rather than clever about vague ones.
// `minCoverage` is a floor on how much of the question a note has to account for. It is a parameter
// rather than a constant because answering and context-gathering want different bars: answering
// alone must be strict (a wrong vault answer pre-empts the plan and then gets banked), while
// gathering context is cheap and a partial match is still worth handing to the model.
export function search(query, { limit = 5, minCoverage = 0.34 } = {}) {
  if (!vaultAvailable()) return [];
  const idx = buildIndex();
  const qTerms = tokenize(query);
  if (!qTerms.length) return [];
  const N = Math.max(idx.size, 1);

  // BM25. k1 caps how much a repeated term can keep adding; b controls how hard long notes are
  // penalised. b=0.75 is the standard setting and is what stops Ahmad.md (180 lines) and the
  // strategy playbooks from winning every query on sheer mass.
  const K1 = 1.2, B = 0.75;

  const uniq = [...new Set(qTerms)];
  const idfOf = new Map(uniq.map(q => {
    const d = idx.df.get(q) || 0;
    return [q, Math.log(1 + (N - d + 0.5) / (d + 0.5))];
  }));
  // Total "meaning" in the question, so passage coverage can be weighted by how distinctive each
  // term is: matching "netlify" and "site" matters far more than matching "the" and "for".
  const queryMass = uniq.reduce((s, q) => s + idfOf.get(q), 0) || 1;

  const scored = [];
  for (const n of idx.notes) {
    if (!n.terms.length) continue;
    const tf = new Map();
    for (const t of n.terms) tf.set(t, (tf.get(t) || 0) + 1);
    const norm = 1 - B + B * (n.terms.length / (idx.avgLen || 1));

    let score = 0, matched = 0, titleHits = 0;
    for (const q of uniq) {
      const f = tf.get(q) || 0;
      const inTitle = n.titleTerms.has(q);
      const inHeading = n.headingTerms.has(q);
      if (!f && !inTitle) continue;
      matched++;
      const idf = idfOf.get(q);
      if (f) score += idf * (f * (K1 + 1)) / (f + K1 * norm);
      // A term in the note's title, or in one of its section headings, says the note is *about*
      // that term rather than merely mentioning it. Length-independent on purpose: this is what
      // lets short STACK.md beat a 400-line playbook that happens to contain the same words.
      if (inTitle) { score += 4.5 * idf; titleHits++; }
      else if (inHeading) { score += 2.2 * idf; }
    }
    if (!matched) continue;

    // Passage level: find the single block that best answers the question, and measure how much of
    // the question's meaning it accounts for. This is the check that makes a vault answer safe —
    // a note can contain every query word scattered across 400 lines and still answer nothing.
    let bestPara = -1, bestMass = 0;
    for (let i = 0; i < n.paraTerms.length; i++) {
      let m = 0;
      for (const q of uniq) if (n.paraTerms[i].has(q)) m += idfOf.get(q);
      if (m > bestMass) { bestMass = m; bestPara = i; }
    }
    const passageCoverage = bestMass / queryMass;
    // Require real overlap on multi-word questions; a single incidental term is noise.
    const coverage = matched / new Set(qTerms).size;
    if (qTerms.length >= 3 && coverage < minCoverage) continue;
    score *= 0.6 + 0.4 * coverage;
    // A note whose best single passage actually addresses the question is worth more than one whose
    // matches are scattered. Multiplicative so it reorders rather than merely nudges.
    score *= 0.7 + 0.6 * passageCoverage;
    // The boost RANKS regions against each other; it is not evidence the note matches. Carried
    // separately so vaultTier can gate on what the note actually earned — measured 2026-08-12,
    // 13_Learned's +9.0 boost alone cleared the answer bar of 9, so a stale digest could answer a
    // question it barely matched, and Ahmad.md (+7.8) answered "show me where" with a feedback list.
    const boost = REGION_BOOST[n.region] || 0;
    score += boost;
    scored.push({ note: n, score, boost, coverage, matched, titleHits, passageCoverage, bestPara });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s, i) => ({
    name: s.note.name, rel: s.note.rel, region: s.note.region, file: s.note.file,
    front: s.note.front, body: s.note.body, score: Number(s.score.toFixed(2)),
    boost: Number(s.boost.toFixed(2)),
    coverage: s.coverage, titleHits: s.titleHits,
    passageCoverage: Number(s.passageCoverage.toFixed(2)),
    passage: s.bestPara >= 0 ? s.note.paragraphs[s.bestPara] : null,
    // How far clear of the runner-up this hit is. A vault answer is only safe when one note is
    // clearly the right one; two notes neck-and-neck means the question is ambiguous to the vault.
    margin: i === 0 && scored[1] ? Number((s.score - scored[1].score).toFixed(2)) : null,
  }));
}

// The bar for answering from the vault ALONE, with no model call. Set high on purpose: a wrong
// vault answer is worse than a slow correct one, because it pre-empts the plan and gets banked.
// Mirrors the reasoning behind KB_MIN_CONFIDENCE=15 in axis-brain.cjs.
export const VAULT_ANSWER_SCORE = 9;
export const VAULT_ANSWER_COVERAGE = 0.6;
// The top hit must be ahead of the runner-up. When two notes score within about a point of each
// other the vault is guessing between them, and the wrong one gets banked as truth. Set at 1.5
// rather than higher because near-ties are often two notes that *agree* — "what is the spend cap"
// legitimately matches both feedback-spend-cap-20-70-per-month and RULES R1, and declining that
// question to protect against a tie costs more than it saves.
export const VAULT_ANSWER_MARGIN = 1.5;
// Share of the question's idf-weighted meaning that the single best passage must account for.
// 0.5 = "half of what makes this question distinctive is in this one paragraph".
export const VAULT_ANSWER_PASSAGE = 0.5;
// A one-word question has trivially perfect coverage (1 of 1 terms matched), so coverage alone lets
// a bare term like "spend" answer with whatever note happens to score highest — "spend cap",
// "feedback-spend", and "spending approvals" are indistinguishable at that length. Requiring two
// distinct terms is what makes coverage meaningful. Caught by tests/axis-vault-brain.test.mjs.
export const VAULT_ANSWER_MIN_TERMS = 2;

// Pull the passage that actually answers the question rather than the whole note. Notes here run to
// hundreds of lines (Ahmad.md is 180); shipping all of it as "the answer" would be unreadable aloud
// and would blow the spoken-reply budget.
export function excerpt(hit, query, maxChars = 700) {
  // search() already located the best-matching block while scoring; reuse it rather than repeating
  // the work with a weaker unweighted heuristic that can pick a different passage than the one the
  // note was ranked on.
  let text = hit.passage;
  if (!text) {
    const qTerms = new Set(tokenize(query));
    const paras = String(hit.body || '').split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(Boolean);
    let best = null, bestHits = 0;
    for (const p of paras) {
      const hits = tokenize(p).filter(t => qTerms.has(t)).length;
      if (hits > bestHits) { bestHits = hits; best = p; }
    }
    text = best || paras.slice(0, 2).join('\n\n');
  }
  text = text.length > maxChars ? text.slice(0, maxChars).replace(/\s+\S*$/, '') + '…' : text;
  return speakable(text);
}

// Notes are written in markdown; answers are SPOKEN. Measured 2026-08-12: "show me where" was
// answered with a raw bullet list — "**Director autonomy** — Cowork auto-delegates… ([[feedback-
// director-autonomy]])" — wikilinks, bold markers and all, read aloud. The vault's own system
// prompt forbids speaking paths and markup (AXIS-SYSTEM.md "Speaking vs writing"); the excerpt
// path was the one place that rule was not enforced in code.
export function speakable(text) {
  return String(text || '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')   // [[target|label]] → label
    .replace(/\[\[([^\]]+)\]\]/g, '$1')              // [[target]] → target
    .replace(/\(\s*\)/g, '')                         // empties left by stripped links
    .replace(/^#{1,6}\s+/gm, '')                     // heading markers
    .replace(/^\s*[-*•·]\s+/gm, '')                  // bullet markers
    .replace(/\*\*([^*]+)\*\*/g, '$1')               // bold
    .replace(/\*([^*]+)\*/g, '$1')                   // italics
    .replace(/`([^`]+)`/g, '$1')                     // inline code
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── The tier ─────────────────────────────────────────────────────────────────
// Returns an answer only when the vault is confidently right; otherwise null so the caller falls
// through to the ARIA brain and then the plan. Same contract as the tiers in axis-brain.cjs.
export function vaultTier(query, {
  minScore = VAULT_ANSWER_SCORE,
  minCoverage = VAULT_ANSWER_COVERAGE,
  minTerms = VAULT_ANSWER_MIN_TERMS,
  minMargin = VAULT_ANSWER_MARGIN,
} = {}) {
  if (new Set(tokenize(query)).size < minTerms) return null;
  const hits = search(query, { limit: 3 });
  if (!hits.length) return null;
  const top = hits[0];
  // Gate on EVIDENCE — what the note earned by matching — not on score-with-region-boost. The
  // boost exists to order 13_Learned above 14_Sources when both genuinely match; at +9.0 against a
  // bar of 9 it also let a note answer with almost no match at all ("show me where" → Ahmad.md at
  // 0.67 coverage). Ranking keeps the boost; answering must be earned. The one exemption is an
  // AIRTIGHT match — every query term present AND one passage carrying ~all of the question's
  // weight — because short questions in small corpora ("who is Ahmad") earn little idf mass while
  // being unambiguously right, and junk turns never reach full coverage.
  const evidence = top.score - (top.boost || 0);
  const airtight = top.coverage >= 0.99 && top.passageCoverage >= 0.9;
  if (!airtight && evidence < minScore) return null;
  if (top.coverage < minCoverage) return null;
  // One passage has to actually answer the question. This is the check that separates "this note
  // contains your words somewhere across 400 lines" from "this paragraph is the answer" — measured
  // on the real vault, it is what stopped a SAM.gov procurement page being returned for "the
  // Netlify site id" while still allowing RULES.md to answer "what is the spend cap", where the
  // topic lives in a section heading rather than the note title.
  if (top.passageCoverage < VAULT_ANSWER_PASSAGE) return null;
  // Two notes neck-and-neck means the vault cannot tell which one is meant. Hand it to the plan.
  if (top.margin !== null && top.margin < minMargin) return null;
  return {
    text: excerpt(top, query),
    tier: 'vault',
    source: `axis-vault:${top.rel}`,
    confidence: top.score,
    cost: 0,
    note: top.rel,
  };
}

// Context handed to the model when the vault could NOT answer on its own. This is the other half of
// the vault's value: even a partial match makes the plan's answer specific to Ahmad's operation
// instead of generic, and it costs nothing to include.
export function vaultContext(query, { maxNotes = 3, maxChars = 2200, minCoverage = 0.15 } = {}) {
  const hits = search(query, { limit: maxNotes, minCoverage });
  if (!hits.length) return '';
  let out = '', used = 0;
  for (const h of hits) {
    const piece = `### ${h.name}  (${h.rel})\n${excerpt(h, query, 700)}\n\n`;
    if (used + piece.length > maxChars) break;
    out += piece; used += piece.length;
  }
  return out.trim();
}

// ── Write-back ───────────────────────────────────────────────────────────────
// "Future info and learning will be saved in obsidian axis vault (brain)."
// One fact per file, per 13_Learned/_Learned.md. Never overwrites blind: an existing note on the
// same slug is updated in place so re-asking a question does not litter the vault with duplicates.
const SECRET = /\b(sk-ant-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|AKIA[0-9A-Z]{12,})/;

export function slugify(s, max = 60) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max) || 'note';
}

/**
 * Write a learned fact into the vault.
 * Returns { written:boolean, file?, reason? }. Never throws — a failed write must not lose an answer
 * the caller already has in hand.
 */
export function learn({ question, answer, source = 'claude-max', model = null, region = '13_Learned', confidence = 'medium' }) {
  if (!vaultAvailable()) return { written: false, reason: 'no-vault' };
  const q = String(question || '').trim();
  const a = String(answer || '').trim();
  if (q.length < 12) return { written: false, reason: 'question-too-thin' };
  if (a.length < 60) return { written: false, reason: 'answer-too-thin' };
  // A secret must never be written to a folder that syncs, gets screenshotted, or opens in a demo.
  if (SECRET.test(a) || SECRET.test(q)) return { written: false, reason: 'contains-secret' };

  const dir = path.join(VAULT_ROOT, region);
  const slug = slugify(q);
  const file = path.join(dir, `${slug}.md`);
  const today = new Date().toISOString().slice(0, 10);
  const body = [
    '---',
    'type: learned',
    'brain_region: hippocampus',
    `source: ${source}`,
    ...(model ? [`model: ${model}`] : []),
    `confidence: ${confidence}`,
    `created: ${today}`,
    `question: ${q.replace(/\n/g, ' ').slice(0, 200)}`,
    '---',
    '',
    `# ${q.replace(/\n/g, ' ').slice(0, 120)}`,
    '',
    a,
    '',
    `Learned ${today} from ${source}${model ? ` (${model})` : ''}.`,
    '',
    'Related: [[_Learned]] [[_HOME]]',
    '',
  ].join('\n');

  try {
    fs.mkdirSync(dir, { recursive: true });
    // Updating in place rather than appending a second note keeps "one fact per file" true.
    fs.writeFileSync(file, body, 'utf8');
    _stamp = '';                       // force the next search to see this note
    return { written: true, file, rel: path.relative(VAULT_ROOT, file).replace(/\\/g, '/') };
  } catch (e) {
    return { written: false, reason: e.message };
  }
}

// The system prompt lives in the vault so Ahmad can edit AXIS's character in Obsidian without
// touching code. Everything under the `---` fence after the frontmatter is the prompt.
export function loadSystemPrompt() {
  const f = path.join(VAULT_ROOT, '00_Index', 'AXIS-SYSTEM.md');
  let raw;
  try { raw = fs.readFileSync(f, 'utf8'); } catch { return null; }
  const noFront = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  const split = noFront.split(/\r?\n---\r?\n/);
  const prompt = (split.length > 1 ? split.slice(1).join('\n---\n') : noFront).trim();
  return prompt.length > 200 ? prompt : null;
}

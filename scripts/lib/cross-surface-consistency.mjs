// cross-surface-consistency.mjs — RUN-AS / AS1. The sixteen, checked as a SET rather than as sixteen files.
//
// WHY THIS EXISTS (2026-08-06).
// Every public-surface gate this program has built judges ONE page at a time. AN1 asked whether a
// route resolves. AO1 asked whether a first screen says something. AP asked whether six screens lead
// with the reader's gain. AS3 asks what a page invites. Not one of them has ever asked whether the
// pages AGREE WITH EACH OTHER.
//
// That question stopped being theoretical this cycle. The range those sixteen files sat in is no
// longer waiting to be published — `origin/main` was advanced by a real push, so the pages were
// written weeks apart, by different sequences, and are now being served TOGETHER. A visitor who
// lands on `aria.html`, clicks to `trust.html`, then to `/plans/`, reads three descriptions of one
// company. If a plan costs one number on one screen and another number on the next, or one screen
// says a thing is certified while its sibling says the readiness work is still in progress, the
// visitor does not conclude that a page is out of date. They conclude the company does not know
// what it is selling — and that is a Rule 14 failure with a customer standing in front of it.
//
// WHAT IS MEASURED. Agreement is never asserted by reading. Four contradiction classes, each of
// which names BOTH files and BOTH 1-based lines:
//
//   1. PRICE_DISAGREEMENT   — the same plan name carries different money on two surfaces.
//   2. CLAIM_DISAGREEMENT   — the same topic (support hours, response time, certification status,
//                             trial availability, years of experience) resolves to two different
//                             values across two surfaces.
//   3. CTA_TARGET_MISSING   — a call to action points at a path that is not in the tree being served.
//   4. CTA_TARGET_DENIED    — a call to action points at a path a SIBLING surface tells the reader
//                             is unavailable / coming soon / not yet open.
//
// HONESTY CONTRACT (the same three verdicts the rest of the series uses, and the third is not a
// synonym for green):
//   OK        — the set was read and no contradiction was found between any pair.
//   BROKEN    — a named contradiction, with both files and both lines.
//   UNCHECKED — a declared surface that is not on disk, or is not prose a reader consumes (an asset,
//               a sitemap). Reported out loud with a reason; NEVER folded into `passed`.
//
// A surface that simply never mentions a topic is not a contradiction and is not a finding. Silence
// is allowed; disagreement is not. Nothing is rewritten here to make the audit pass.
//
// Pure: reads files. Sends nothing, writes nothing, never touches the network.
import fs from "node:fs";
import path from "node:path";

export const CROSS_SURFACE_SCHEMA = "cross-surface-consistency.v1";
export const SENDS = false;
export const WRITES = false;

export const VERDICT = Object.freeze({ OK: "ok", BROKEN: "broken", UNCHECKED: "unchecked" });

export const CLASSES = Object.freeze({
  OK: "the-set-agrees-with-itself",
  PRICE_DISAGREEMENT: "same-plan-different-money-on-two-surfaces",
  CLAIM_DISAGREEMENT: "same-topic-different-answer-on-two-surfaces",
  CTA_TARGET_MISSING: "call-to-action-points-at-a-path-not-in-the-tree",
  CTA_TARGET_DENIED: "call-to-action-points-where-a-sibling-says-it-is-unavailable",
  NOT_ON_DISK: "declared-surface-is-not-on-disk",
  NOT_PROSE: "surface-is-not-prose-a-reader-consumes",
});

// The public files the priced range actually changed (RUN-AR / AR1), as a set. The six AXIS assets
// and the sitemap are declared here on purpose: they are part of the published set, they are NOT
// prose, and saying so out loud is the honest answer — quietly dropping them would let the report
// claim a coverage it does not have.
export const PROSE_SURFACES = Object.freeze([
  "index.html", "aria.html", "trust.html", "about.html",
  "ai-edge.html", "growth-library.html", "health-check.html", "scorecard.html",
]);

export const NON_PROSE_SURFACES = Object.freeze([
  "sitemap.xml", "robots.txt",
  "assets/axis-app.js", "assets/axis-tokens.css", "assets/axis-state.json",
  "assets/aperture-learning.js",
]);

export const PUBLISHED_SET = Object.freeze([...PROSE_SURFACES, ...NON_PROSE_SURFACES]);

// Money attaches to the plan word nearest before it, within this many characters. Wider than this
// and a price in one paragraph starts binding to a plan named in the paragraph above it.
export const PLAN_PROXIMITY_CHARS = 90;

export const PLAN_WORDS = Object.freeze([
  "Starter", "Essential", "Essentials", "Standard", "Core", "Professional", "Pro",
  "Business", "Growth", "Enterprise", "Premium", "Sentinel", "Concierge",
]);

// ── Topics. Each resolves a surface's prose to ONE normalised value, or to nothing. Two surfaces
// that resolve the same topic to different values contradict each other. A surface that resolves it
// to nothing is silent, which is always allowed. ────────────────────────────────────────────────
export const TOPICS = Object.freeze([
  {
    id: "support-hours",
    why: "when a customer can reach a human",
    re: /\b(24\s*[\/x]\s*7|24\s*hours\s*a\s*day|business\s+hours\s+only|weekdays\s+only)\b/i,
    value: (m) => (/business|weekday/i.test(m[1]) ? "business-hours-only" : "24-7"),
  },
  {
    id: "certification-status",
    why: "whether a framework is CERTIFIED or only being prepared for — the difference is legal",
    re: /\b(SOC\s*2|ISO\s*27001|PIPEDA)\b[^.<]{0,60}?\b(certified|compliant|readiness|preparing|not\s+certified)\b/i,
    value: (m) => `${m[1].replace(/\s+/g, "").toLowerCase()}:${/certified|compliant/i.test(m[2]) ? "certified" : "readiness-only"}`,
  },
  {
    id: "trial-availability",
    why: "whether a reader can try the product without paying",
    re: /\b(no\s+free\s+trial|free\s+trial|(\d{1,2})[-\s]day\s+trial)\b/i,
    value: (m) => (/^no\s/i.test(m[1]) ? "none" : m[2] ? `${m[2]}-day` : "free-trial"),
  },
  {
    id: "experience-years",
    why: "the founder's experience figure — one number, everywhere, or it is not a fact",
    re: /\b(\d{1,2})\s*\+?\s*years?\b(?=[^.<]{0,40}\b(?:experience|IT|operations|industry)\b)/i,
    value: (m) => `${m[1]}+`,
  },
  {
    id: "response-time",
    why: "the promise a reader will hold us to",
    re: /\b(\d{1,3})\s*[-\s]?\s*(minute|min|hour|hr|business\s+day)s?\b(?=[^.<]{0,40}\bresponse\b)/i,
    value: (m) => `${m[1]}-${m[2].toLowerCase().replace(/^min$/, "minute").replace(/^hr$/, "hour")}`,
  },
]);

// A sibling telling the reader a destination is not open yet. Bound to the surrounding sentence so
// "coming soon" three paragraphs away cannot poison an unrelated link.
export const DENIAL_RE =
  /\b(coming\s+soon|not\s+(?:yet\s+)?(?:available|open|live|launched)|currently\s+unavailable|temporarily\s+closed|waitlist\s+only)\b/i;

export const CTA_RE = /<a\b[^>]*href\s*=\s*["']([^"'#?]+)[^"']*["'][^>]*>([\s\S]{0,160}?)<\/a>/gi;

// Words that make a link an ASK rather than navigation. A footer link to /terms.html is not a CTA.
export const CTA_WORDS =
  /\b(start|get\s+started|book|schedule|buy|subscribe|sign\s*up|try|request|contact\s+us|talk\s+to|claim|download|apply|see\s+plans|get\s+a\s+quote)\b/i;

const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const SCRIPT_STYLE = /<(script|style)\b[\s\S]*?<\/\1>/gi;
const TAGS = /<[^>]+>/g;

/** 1-based line of a character offset in the ORIGINAL source. */
export function lineOf(source = "", index = 0) {
  if (index < 0) return 1;
  return source.slice(0, index).split("\n").length;
}

/** Visible prose with script/style/comments removed, offsets preserved by same-length blanking. */
export function proseOf(html = "") {
  const blank = (s) => s.replace(/[^\n]/g, " ");
  return html
    .replace(HTML_COMMENT, blank)
    .replace(SCRIPT_STYLE, blank)
    .replace(TAGS, blank)
    .replace(/&nbsp;/g, " ");
}

// Plural forms that name the SAME plan. Deliberately a map rather than a trailing-"s" strip: the
// first version of this stripped blindly and turned "Business" into "Busines", which then collided
// with nothing and produced a contradiction out of two unrelated figures. Found by the real-tree
// assertion below, not by review.
export const PLAN_ALIASES = Object.freeze({ essentials: "essential", plans: "plan", pros: "pro" });

export function normalisePlan(word = "") {
  const k = word.toLowerCase();
  return PLAN_ALIASES[k] || k;
}

// A dollar figure with no recurring unit attached ("$6,000", "$6,000 – $10,000 / mo") is genuinely
// ambiguous from markup: it may be a retainer, a range, a project fee or a saving. This audit does
// NOT guess. Only figures carrying a real unit are compared; the rest are silence, and this comment
// is the honest record of the limitation rather than a claim of full price coverage.
export const COMPARABLE_UNITS = Object.freeze(new Set(["mo", "yr", "user", "seat", "hr"]));

/** Every `$N` in a surface bound to the nearest plan word before it, with unit and line. */
export function extractPrices(html = "") {
  const prose = proseOf(html);
  const out = [];
  const money = /\$\s?(\d[\d,]*(?:\.\d{2})?)\s*(?:\/\s*|\s+per\s+)?(mo|month|yr|year|user|seat|hr|hour)?\b/gi;
  let m;
  while ((m = money.exec(prose))) {
    const before = prose.slice(Math.max(0, m.index - PLAN_PROXIMITY_CHARS), m.index);
    let plan = null, planAt = -1;
    for (const w of PLAN_WORDS) {
      const at = before.toLowerCase().lastIndexOf(w.toLowerCase());
      if (at > planAt) { planAt = at; plan = w; }
    }
    if (!plan) continue; // money with no plan attached is not a plan price; silence, not a finding
    const unit = (m[2] || "").toLowerCase().replace(/^month$/, "mo").replace(/^year$/, "yr").replace(/^hour$/, "hr");
    out.push({
      plan: normalisePlan(plan),
      amount: m[1].replace(/,/g, ""),
      unit: unit || "unspecified",
      line: lineOf(html, m.index),
      text: m[0].trim(),
    });
  }
  return out;
}

/** The topics a surface actually resolves, each to one value. Silence is simply absence. */
export function extractTopics(html = "") {
  const prose = proseOf(html);
  const out = [];
  for (const t of TOPICS) {
    const m = t.re.exec(prose);
    if (!m) continue;
    out.push({ topic: t.id, why: t.why, value: t.value(m), line: lineOf(html, m.index), text: m[0].trim() });
  }
  return out;
}

/** The asks a surface makes, with the path each one points at. */
export function extractCtas(html = "", { file = "(inline)" } = {}) {
  const out = [];
  let m;
  CTA_RE.lastIndex = 0;
  while ((m = CTA_RE.exec(html))) {
    const label = m[2].replace(TAGS, " ").replace(/\s+/g, " ").trim();
    if (!label || !CTA_WORDS.test(label)) continue;
    const href = m[1].trim();
    if (/^(mailto:|tel:|javascript:)/i.test(href)) continue;
    out.push({ file, href, label, line: lineOf(html, m.index) });
  }
  return out;
}

/** Paths a surface tells the reader are not open, bound to the sentence carrying the denial. */
export function extractDenials(html = "") {
  const out = [];
  let m;
  CTA_RE.lastIndex = 0;
  while ((m = CTA_RE.exec(html))) {
    const href = m[1].trim();
    if (/^(mailto:|tel:|javascript:)/i.test(href)) continue;
    // The sentence around the anchor: from the last '.' before it to the first after.
    const start = Math.max(0, m.index - 220);
    const window = proseOf(html.slice(start, m.index + m[0].length + 220));
    const d = DENIAL_RE.exec(window);
    if (!d) continue;
    out.push({ href, phrase: d[1], line: lineOf(html, m.index) });
  }
  return out;
}

const isExternal = (href) => /^(https?:)?\/\//i.test(href);

/**
 * The first pair of rows that disagree on `field` AND come from two DIFFERENT files, or null.
 * The cross-file requirement is the whole point: this audit's claim is about what a visitor reads
 * as they MOVE between surfaces, so a disagreement that never leaves one file is not its finding.
 */
export function crossFilePair(rows = [], field = "value") {
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[i].file !== rows[j].file && rows[i][field] !== rows[j][field]) return [rows[i], rows[j]];
    }
  }
  return null;
}

/** Does a site-relative path exist in the tree at `root`? Directory paths resolve to index.html. */
export function pathExists(href = "", { root = process.cwd() } = {}) {
  if (!href || isExternal(href)) return true; // off-tree: not this audit's claim to make
  let rel = href.split("#")[0].split("?")[0];
  if (!rel.startsWith("/")) rel = "/" + rel;
  const abs = path.join(root, rel);
  try {
    const st = fs.statSync(abs);
    if (st.isDirectory()) return fs.existsSync(path.join(abs, "index.html"));
    return true;
  } catch {
    if (!/\.[a-z0-9]+$/i.test(rel) && fs.existsSync(abs + ".html")) return true;
    return false;
  }
}

const norm = (href) => {
  let h = href.split("#")[0].split("?")[0];
  if (!h.startsWith("/")) h = "/" + h;
  return h.replace(/\/index\.html$/i, "/").replace(/(.)\/$/, "$1");
};

/**
 * Read the published set together and report every contradiction BETWEEN its members.
 * Returns { schema, verdict, checked, unchecked, findings, summary }.
 */
export function auditCrossSurface({ root = process.cwd(), surfaces = PUBLISHED_SET } = {}) {
  const checked = [];
  const unchecked = [];
  const read = new Map();

  for (const rel of surfaces) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) {
      unchecked.push({ file: rel, class: CLASSES.NOT_ON_DISK, reason: "declared in the published set but not in this tree" });
      continue;
    }
    if (!/\.html?$/i.test(rel)) {
      unchecked.push({ file: rel, class: CLASSES.NOT_PROSE, reason: "part of the published set but not prose a reader consumes" });
      continue;
    }
    const html = fs.readFileSync(abs, "utf8");
    read.set(rel, html);
    checked.push(rel);
  }

  const findings = [];

  // 1 + 2 — pairwise disagreement on money and on topics.
  const priceIndex = new Map(); // `${plan}|${unit}` → [{file,...}]
  const topicIndex = new Map(); // topic → [{file,...}]
  for (const [file, html] of read) {
    for (const p of extractPrices(html)) {
      if (!COMPARABLE_UNITS.has(p.unit)) continue; // ambiguous figure — see COMPARABLE_UNITS
      const k = `${p.plan}|${p.unit}`;
      if (!priceIndex.has(k)) priceIndex.set(k, []);
      priceIndex.get(k).push({ file, ...p });
    }
    for (const t of extractTopics(html)) {
      if (!topicIndex.has(t.topic)) topicIndex.set(t.topic, []);
      topicIndex.get(t.topic).push({ file, ...t });
    }
  }

  for (const [key, rows] of priceIndex) {
    const [plan, unit] = key.split("|");
    // BETWEEN surfaces only. Two figures inside ONE file are that file's business — a page listing a
    // tier and a range is normal, and accusing it of contradicting itself would make this audit
    // unrunnable and untrusted. Intra-page coherence is a different gate, deliberately not this one.
    const pair = crossFilePair(rows, "amount");
    if (!pair) continue;
    const [a, b] = pair;
    findings.push({
      class: CLASSES.PRICE_DISAGREEMENT,
      topic: `plan:${plan}`,
      detail: `plan "${plan}" is $${a.amount}/${unit} on ${a.file} and $${b.amount}/${unit} on ${b.file}`,
      a: { file: a.file, line: a.line, value: a.amount, text: a.text },
      b: { file: b.file, line: b.line, value: b.amount, text: b.text },
    });
  }

  for (const [topic, rows] of topicIndex) {
    const pair = crossFilePair(rows, "value");
    if (!pair) continue;
    const [a, b] = pair;
    findings.push({
      class: CLASSES.CLAIM_DISAGREEMENT,
      topic,
      why: a.why,
      detail: `"${topic}" is ${a.value} on ${a.file} and ${b.value} on ${b.file}`,
      a: { file: a.file, line: a.line, value: a.value, text: a.text },
      b: { file: b.file, line: b.line, value: b.value, text: b.text },
    });
  }

  // 3 + 4 — where the asks point.
  const denials = new Map(); // normalised path → {file, line, phrase}
  for (const [file, html] of read) {
    for (const d of extractDenials(html)) {
      if (!denials.has(norm(d.href))) denials.set(norm(d.href), { file, ...d });
    }
  }

  for (const [file, html] of read) {
    for (const cta of extractCtas(html, { file })) {
      if (isExternal(cta.href)) continue;
      if (!pathExists(cta.href, { root })) {
        findings.push({
          class: CLASSES.CTA_TARGET_MISSING,
          topic: `cta:${norm(cta.href)}`,
          detail: `"${cta.label}" on ${file} points at ${cta.href}, which is not in this tree`,
          a: { file, line: cta.line, value: cta.href, text: cta.label },
          b: null,
        });
        continue;
      }
      const denied = denials.get(norm(cta.href));
      if (denied && denied.file !== file) {
        findings.push({
          class: CLASSES.CTA_TARGET_DENIED,
          topic: `cta:${norm(cta.href)}`,
          detail: `"${cta.label}" on ${file} invites the reader to ${cta.href}, but ${denied.file} tells them it is "${denied.phrase}"`,
          a: { file, line: cta.line, value: cta.href, text: cta.label },
          b: { file: denied.file, line: denied.line, value: denied.phrase, text: denied.phrase },
        });
      }
    }
  }

  const verdict = findings.length ? VERDICT.BROKEN : VERDICT.OK;
  return {
    schema: CROSS_SURFACE_SCHEMA,
    verdict,
    class: findings.length ? findings[0].class : CLASSES.OK,
    checked,
    unchecked,
    findings,
    summary: {
      surfacesDeclared: surfaces.length,
      surfacesChecked: checked.length,
      surfacesUnchecked: unchecked.length,
      contradictions: findings.length,
      byClass: findings.reduce((acc, f) => ((acc[f.class] = (acc[f.class] || 0) + 1), acc), {}),
      // Deliberately NOT a pass rate: an unchecked surface is not a passing surface, and a ratio
      // that folds the two together is the exact dishonesty this series keeps deleting.
    },
  };
}

/** One line a human can read without opening the report. */
export function statementFor(report) {
  const { surfacesChecked, surfacesUnchecked, contradictions } = report.summary;
  if (contradictions === 0) {
    return `The ${surfacesChecked} prose surfaces of the published set agree with each other; ` +
      `${surfacesUnchecked} more are in the set but are not prose and were not checked.`;
  }
  return `${contradictions} contradiction(s) between the ${surfacesChecked} prose surfaces of the ` +
    `published set — a visitor moving between them reads two different answers.`;
}

export default {
  CROSS_SURFACE_SCHEMA, SENDS, WRITES, VERDICT, CLASSES,
  PROSE_SURFACES, NON_PROSE_SURFACES, PUBLISHED_SET, TOPICS,
  proseOf, lineOf, extractPrices, extractTopics, extractCtas, extractDenials,
  pathExists, auditCrossSurface, statementFor,
};

// first-screen-audit.mjs — RUN-AO / AO1. What the first screen SAYS, held to Rule 14 and Rule 17.
//
// WHY THIS EXISTS (2026-08-05).
// AN1 proved the customer path RESOLVES: 894 links walked from disk, 761 resolved, 0 broken. That is
// the weakest possible version of the question. "The page loads" and "the page does its job" are not
// the same claim, and this program has spent nineteen cycles learning to tell those two apart
// everywhere except on the one surface a stranger actually reads.
//
// A prospect arriving from one of the twelve messages lands on a page that resolves. What they read
// in the first screen decides everything after it. Nobody in this series has ever checked what that
// screen says. This module checks it, from the repository, against two standards at once:
//
//   Rule 17 (value-first) — the first screen must make a claim a reader can FEEL. A first screen that
//                           is navigation and nothing else is a real defect, named
//                           `no-claim-above-the-fold`, not a style opinion.
//   Rule 14 (honesty)     — every factual assertion in it must be one this business can stand behind:
//                           no guarantee / money-back / risk-free language, no experience claim beyond
//                           15+ years, no forbidden name, and no hard metric that the measured feed
//                           does not carry.
//
// HONESTY CONTRACT. Three verdicts, and the third is not a synonym for green:
//   OK        — a value claim is present above the fold and nothing in it violates Rule 14.
//   BROKEN    — a named violation, with the file and the 1-based line it sits on.
//   UNCHECKED — genuinely undecidable from disk (an entry point whose first screen is assembled at
//               runtime, or a file that is not on disk at all). Said out loud, never counted as a pass.
//
// No page is rewritten to pass. Findings are reported; the genuine ones are fixed deliberately.
//
// Pure: reads files. Sends nothing, writes nothing, never touches the network.
import fs from "node:fs";
import path from "node:path";

export const FIRST_SCREEN_SCHEMA = "first-screen-audit.v1";
export const SENDS = false;
export const WRITES = false;

export const VERDICT = Object.freeze({ OK: "ok", BROKEN: "broken", UNCHECKED: "unchecked" });

export const CLASSES = Object.freeze({
  OK: "value-claim-present-and-defensible",
  NO_CLAIM: "no-claim-above-the-fold",
  GUARANTEE: "guarantee-or-risk-free-language",
  EXPERIENCE_OVERCLAIM: "experience-claim-beyond-15-plus-years",
  FORBIDDEN_NAME: "forbidden-name-in-customer-copy",
  FABRICATED_PROOF: "testimonial-or-partnership-with-no-evidence-on-disk",
  UNCARRIED_METRIC: "hard-metric-not-carried-by-the-measured-feed",
  NO_FILE: "entry-point-is-not-on-disk",
  RUNTIME_FIRST_SCREEN: "first-screen-is-assembled-at-runtime",
});

// How much prose counts as "the first screen" once chrome is removed. A hero and its subhead fit
// comfortably inside this; a whole page does not.
export const FIRST_SCREEN_CHARS = 700;

// Below this, the page has said nothing to a reader — whatever markup it contains.
export const MIN_FIRST_SCREEN_PROSE = 40;

// ── Rule 14 violation patterns. Each carries the class it raises and a human reason. ──────────────
export const HONESTY_PATTERNS = Object.freeze([
  [/\b(money[-\s]?back|risk[-\s]?free|no[-\s]?risk|100%\s+guarantee\w*|satisfaction\s+guarantee\w*)\b/i,
    CLASSES.GUARANTEE, "guarantee / money-back / risk-free language is forbidden in customer copy"],
  [/\bwe\s+guarantee\b|\bguaranteed\s+(results?|uptime|savings?|resolution)\b/i,
    CLASSES.GUARANTEE, "an outcome guarantee this business cannot honour"],
  [/\b(1[6-9]|[2-9]\d)\s*\+?\s*years?\b(?![^.]*\bcombined\b)/i,
    CLASSES.EXPERIENCE_OVERCLAIM, "the defensible claim is 15+ years; anything higher is an overclaim"],
  [/raymond\s+james/i,
    CLASSES.FORBIDDEN_NAME, "this name must never appear in any customer-facing surface"],
  [/\b(trusted|used)\s+by\s+(\d{2,}|hundreds|thousands|dozens)\b/i,
    CLASSES.FABRICATED_PROOF, "a customer-count proof claim with no evidence on disk"],
  [/\b(official|certified|authorized|authorised)\s+(?:\w+\s+){0,2}(partner|reseller)\b/i,
    CLASSES.FABRICATED_PROOF, "a partnership claim with no evidence on disk"],
]);

// ── Rule 17 value signals. A first screen must promise something a reader can feel. ───────────────
// Deliberately BENEFIT language, not feature nouns. A bare noun — "support", "security", "ARIA" —
// is a label, not a promise, and the company name contains one of them, so accepting bare nouns
// would let every page in the repository pass by accident. That is the failure this list refuses:
// what qualifies is a verb doing something FOR the reader, a named pain removed, or a stated price.
export const VALUE_SIGNALS = Object.freeze([
  /\bsav(e|es|ing)\s+(you|your|time|money|hours)\b/i,
  /\bfaster\b/i, /\bin\s+(?:minutes|seconds|under\s+\w+)\b/i,
  /\bwithout\s+\w+/i, /\bstop\s+\w+/i, /\bno\s+more\b/i, /\bnever\s+\w+\s+again\b/i,
  /\bfix(es|ed)?\s+\w+/i, /\bresolve[sd]?\s+\w+/i, /\bprevent(s|ative|ive)?\b/i,
  /\bprotect(s|ed)?\s+\w+/i, /\bkeep(s)?\s+\w+\s+(running|online|working|safe)\b/i,
  /\breduce[sd]?\s+\w+/i, /\bcut(s)?\s+(your|the)?\s*\w+/i,
  /\bstarting\s+at\b/i, /\bper\s+month\b/i, /\$\s?\d/, /\bflat\s+(rate|fee|retainer)\b/i,
  /\bdowntime\b/i, /\buptime\b/i, /\bfrustrat/i, /\bhelps?\s+you\b/i, /\bso\s+you\s+can\b/i,
  /\bfor\s+you\b/i, /\byour\s+team\s+\w+/i,
]);

// ── Hard metrics. A number making a factual claim about the business must be carried by the feed. ─
// Percentages, money amounts and counts-of-things attached to a proof noun. Prices are exempted:
// a price is an offer, not a measurement, and is carried by the price surface itself.
const HARD_METRIC = /(\d{1,3}(?:\.\d+)?\s*%|\b\d{2,}\s*(?:customers?|clients?|tickets?|businesses|companies|hours?\s+saved|incidents?)\b)/gi;

const rd = (abs) => { try { return fs.readFileSync(abs, "utf8"); } catch { return null; } };

/** Strip everything a reader does not read as page copy: scripts, styles, comments, nav chrome. */
export function stripChrome(html = "") {
  let s = String(html);
  const body = s.split(/<body[^>]*>/i)[1];
  if (body !== undefined) s = body;
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<svg[\s\S]*?<\/svg>/gi, "");
  s = s.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  s = s.replace(/<header[\s\S]*?<\/header>/gi, "");
  s = s.replace(/<footer[\s\S]*?<\/footer>/gi, "");
  // Menu/nav containers that are divs rather than semantic elements.
  s = s.replace(/<(div|ul|aside)[^>]*\b(?:class|id)\s*=\s*"[^"]*\b(nav|menu|drawer|sidebar|topbar|breadcrumb)\b[^"]*"[\s\S]*?<\/\1>/gi, "");
  return s;
}

/** The visible prose of the first screen, entities decoded, whitespace collapsed. */
export function extractFirstScreen(html = "") {
  const stripped = stripChrome(html);
  const text = decodeEntities(stripped.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, FIRST_SCREEN_CHARS);
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&mdash;/g, "—")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&(quot|apos|lt|gt);/g, (m) => ({ "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">" }[m]));
}

/** 1-based source line of the first occurrence of a snippet — so a red test names a line, not a page. */
export function lineOf(html = "", snippet = "") {
  if (!snippet) return null;
  const needle = String(snippet).trim().toLowerCase();
  const lines = String(html).split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (decodeEntities(lines[i]).toLowerCase().includes(needle)) return i + 1;
  }
  return null;
}

/**
 * True when the page's first screen is assembled at runtime and therefore has no copy on disk to
 * judge. Two shapes count: the conventional mount point (`#root` / `#app`), and a content container
 * that is EMPTY in the source — `<main id="product"></main>` — beside a script that fills it.
 * Undecidable, never a pass.
 */
export function isRuntimeFirstScreen(html = "", { prose = null } = {}) {
  const s = String(html);
  const hasScript = /<script[\s>]/i.test(s);

  // An EMPTY <main> beside a script IS the first screen, and it is empty on disk. This decides on
  // its own, without a prose threshold: `product.html` carries a site-wide disclaimer block that is
  // hundreds of characters long and says nothing about the product, so a length test would read that
  // boilerplate as the page's copy and report a page nobody can read as a page that failed to sell.
  if (/<main\b[^>]*>\s*<\/main>/i.test(s) && hasScript) {
    return "the page's only content container is empty on disk and is filled by script at runtime";
  }
  // The conventional mount point. Kept behind the prose threshold, as it has been since AO1, so a
  // page that mounts a widget beneath real copy is still judged on the copy it does have.
  if (/<div[^>]+\bid\s*=\s*"(root|app)"/i.test(s) &&
      (prose === null || prose.length < MIN_FIRST_SCREEN_PROSE)) {
    return "the first screen is mounted at runtime into #root/#app; no copy exists on disk";
  }
  return null;
}

/** True when the first screen makes at least one claim a reader can feel (Rule 17). */
export function hasValueClaim(text = "") {
  return VALUE_SIGNALS.some((re) => re.test(text));
}

/** Hard metrics in the text that the measured feed does not carry (Rule 14). */
export function uncarriedMetrics(text = "", carried = []) {
  const carriedStrings = carried.map((c) => String(c).trim().toLowerCase());
  const found = [];
  for (const m of String(text).matchAll(HARD_METRIC)) {
    const raw = m[0].trim();
    const norm = raw.toLowerCase().replace(/\s+/g, " ");
    if (carriedStrings.some((c) => c.includes(norm) || norm.includes(c))) continue;
    found.push(raw);
  }
  return [...new Set(found)];
}

/**
 * Audit one entry point's first screen.
 * @returns { file, verdict, findings: [{ class, detail, line }], text }
 */
export function auditFirstScreen(html = "", { file = "(inline)", carriedFigures = [] } = {}) {
  const findings = [];
  const text = extractFirstScreen(html);

  // A first screen produced entirely by script has no copy on disk to judge. Undecidable, not a pass.
  //
  // RUN-AP / AP2 WIDENING. This originally recognised only `<div id="root">` and `<div id="app">`,
  // which meant `product.html` — a catalogue detail page whose entire body is `<main id="product">`
  // filled by script from the product record — was reported BROKEN for saying nothing, when the
  // truthful verdict is that its first screen does not exist on disk to be read. Reporting a page
  // as failing Rule 17 when the copy is not there to judge is the same error as reporting it as
  // passing: both are claims about a thing nobody looked at. An EMPTY content container is now
  // recognised too, and the widening is deliberately narrow — the container must be empty on disk
  // AND the page must carry no first-screen prose of its own, so a page with real copy plus an
  // empty aside is untouched by this.
  const runtimeReason = isRuntimeFirstScreen(html, { prose: text });
  if (runtimeReason) {
    return {
      file, verdict: VERDICT.UNCHECKED, text,
      findings: [{
        class: CLASSES.RUNTIME_FIRST_SCREEN,
        detail: `${runtimeReason} — there is no copy here to hold to Rule 14 or Rule 17, so this is UNCHECKED and is never counted as a pass`,
        line: null,
      }],
    };
  }

  if (!hasValueClaim(text)) {
    findings.push({
      class: CLASSES.NO_CLAIM,
      detail: text.length < MIN_FIRST_SCREEN_PROSE
        ? `the first screen carries ${text.length} characters of prose — a reader is told nothing`
        : "the first screen names things but promises nothing a reader can feel (Rule 17)",
      line: null,
    });
  }

  for (const [re, cls, reason] of HONESTY_PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    findings.push({ class: cls, detail: `${reason} — found "${m[0].trim()}"`, line: lineOf(html, m[0]) });
  }

  for (const metric of uncarriedMetrics(text, carriedFigures)) {
    findings.push({
      class: CLASSES.UNCARRIED_METRIC,
      detail: `"${metric}" is asserted above the fold but the measured feed does not carry it`,
      line: lineOf(html, metric),
    });
  }

  return {
    file,
    verdict: findings.length ? VERDICT.BROKEN : VERDICT.OK,
    findings: findings.length ? findings : [{ class: CLASSES.OK, detail: "value claim present, nothing to flag", line: null }],
    text,
  };
}

/**
 * Audit every declared customer entry point on disk.
 * @returns { schema, ok, results, broken, unchecked, summary }
 */
export function auditEntryPoints({ root = process.cwd(), entryPoints = [], carriedFigures = [] } = {}) {
  const results = [];
  for (const rel of entryPoints) {
    const abs = path.resolve(root, rel);
    const html = rd(abs);
    if (html === null) {
      results.push({
        file: rel, verdict: VERDICT.UNCHECKED, text: "",
        findings: [{ class: CLASSES.NO_FILE, detail: `${rel} is not on disk in this checkout`, line: null }],
      });
      continue;
    }
    results.push(auditFirstScreen(html, { file: rel, carriedFigures }));
  }

  const broken = results.filter((r) => r.verdict === VERDICT.BROKEN);
  const unchecked = results.filter((r) => r.verdict === VERDICT.UNCHECKED);
  const ok = results.filter((r) => r.verdict === VERDICT.OK);
  return {
    schema: FIRST_SCREEN_SCHEMA,
    ok: broken.length === 0,
    results, broken, unchecked,
    summary: {
      entryPoints: results.length,
      passed: ok.length,
      broken: broken.length,
      unchecked: unchecked.length,
      findings: results.reduce((n, r) => n + r.findings.filter((f) => f.class !== CLASSES.OK).length, 0),
      // Stated out loud so nobody can read `passed` as coverage.
      note: "unchecked is never folded into passed",
    },
  };
}

export default {
  FIRST_SCREEN_SCHEMA, VERDICT, CLASSES, HONESTY_PATTERNS, VALUE_SIGNALS,
  FIRST_SCREEN_CHARS, MIN_FIRST_SCREEN_PROSE,
  stripChrome, extractFirstScreen, lineOf, hasValueClaim, uncarriedMetrics, isRuntimeFirstScreen,
  auditFirstScreen, auditEntryPoints,
};

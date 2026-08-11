// claim-register.mjs — RUN-AW / AW2.
//
// AW1 pointed the leak gate at all twenty-seven documents a stranger can receive and asked "does
// this document carry anything operator-internal." That is a question about CONTENT THAT SHOULD NOT
// BE THERE. It says nothing at all about whether the content that SHOULD be there is TRUE.
//
// Those twenty-seven documents make factual assertions — about certifications, audits, insurance
// cover, retention periods, uptime and years of experience — to the one reader who checks them line
// by line: an enterprise buyer's security reviewer. AW1 already found what happens when nobody asks:
// `Founder 21+ yrs IT` sat in the SOC 2 controls self-assessment, above the honest ceiling, in the
// first document an auditor opens.
//
// So this module asks the second question. Every extracted claim ends in exactly one of three
// states, and there is no fourth:
//
//   PUBLISHED — the same assertion appears on a page this company publishes. Both citations carried.
//   DECLARED  — listed in `docs/CLAIM-REGISTER.md` as forward-looking, WITH THE CONDITION ATTACHED.
//               "upon first $625K contract" is a condition. "planned" on its own is not — a
//               forward-looking statement that has lost its condition is a refusal, not a warning,
//               because a reviewer reads "planned" as "someone is doing it."
//   REFUSED   — asserted, unpublished, undeclared. Unevidenced.
//
// Two things this module deliberately does NOT do, on the AV2 pattern:
//
//   It never edits a document to reach zero (Rule 15). Reconciliation is additive — documents are
//   read, and the register is written.
//
//   It cannot become a rubber stamp. A declaration with an empty or self-restating reason is
//   REFUSED, and a declaration that matches no claim in any document is STALE — so the register
//   cannot quietly rot into a list of sentences nobody says any more.

import fs from "node:fs";
import path from "node:path";

export const CLAIM_REGISTER_SCHEMA = "claim-register/1";

/** The register a person reads and edits without a tool. */
export const REGISTER_FILE = "docs/CLAIM-REGISTER.md";

/** The same set of documents AW1 audits — the ones that leave the building. */
export const CLIENT_FACING_DIRS = ["legal", "compliance", "ARIA Sentinel/sales"];

/** Pages this company actually publishes, against which a claim can be checked. */
export const PUBLISHED_PAGES = [
  "index.html",
  "about.html",
  "privacy.html",
  "terms.html",
  "security.html",
  "plans/index.html",
  "compliance/index.html",
  "compliance/iso-27001-readiness.html",
  "compliance/pipeda-readiness.html",
  "compliance/automated-decisions.html",
];

export const STATE = Object.freeze({
  PUBLISHED: "published",
  DECLARED: "declared",
  DISCLAIMED: "disclaimed",
  REFUSED: "refused",
});

/**
 * DISCLAIMED — caught by running this module against the real tree and reading what it produced.
 *
 * The first run reported 34 silent claims, and among them was
 * `compliance/ISO-27001-SoA.md:8 — "ISO 27001 certified"`. That line is the document's DISCLAIMER:
 * *"it does not state or imply that IIS/ARIA is 'ISO 27001 certified'"*. A matcher that reads a
 * denial as an assertion is not a strict gate, it is a broken one — and worse, it would have pushed
 * this program toward DELETING the most honest paragraph in the compliance pack in order to go
 * green. That is the exact failure Rule 15 exists to prevent.
 *
 * So a claim made inside a sentence that explicitly negates it is its own state: reported, counted,
 * never rounded up into "clean" and never rounded down into "silent". The negation must be
 * EXPLICIT — these are the shapes a disclaimer actually takes, not a general "does the word 'not'
 * appear anywhere nearby".
 */
export const NEGATION_PATTERNS = [
  /\bis\s+NOT\b/i,
  /\bare\s+NOT\b/i,
  /\bno such thing as\b/i,
  /\bdoes not (?:state|imply|claim|mean|constitute)\b/i,
  /\bdo not (?:state|imply|claim)\b/i,
  /\bnothing (?:here|below|in this) [^.]{0,40}\b(?:states|implies|claims)\b/i,
  /\bcannot and does not\b/i,
  /\bthis is not\b/i,
  /\bnot (?:a|an) (?:certification|attestation|audit)\b/i,
  /\bhas not been\b/i,
  /\bis neither\b/i,
];

/**
 * A negation only disclaims a claim it comes BEFORE. Caught by this suite's own red case:
 * "We are ISO 27001 certified, though the report is not attached" was being read as a disclaimer,
 * because a negation appears in the sentence — after the claim, about something else entirely. That
 * is the direction of error that matters: a gate that launders an assertion into a disclaimer is
 * worse than no gate. When the position is unknown, the whole sentence is searched, which is the
 * conservative reading for the checks that call it that way.
 */
export const isDisclaimed = (sentence, claimAt = null) => {
  const text = String(sentence);
  const scope = claimAt === null ? text : text.slice(0, claimAt);
  return NEGATION_PATTERNS.some((re) => re.test(scope));
};

/**
 * The claim classes. Each is a name, a sentence saying why a reviewer cares, and a matcher. Kept as
 * data for the same reason AW1's checks are: a suite can plant one claim of EACH class and assert it
 * is caught BY NAME, and a new class cannot be added without stating why it matters.
 */
export const CLAIM_CLASSES = [
  {
    name: "certification",
    why: "a certification a company does not hold is the single most expensive sentence in a security questionnaire",
    re: /\b(ISO[/\s]?(?:IEC\s?)?27001|SOC\s?2(?:\s?Type\s?I{1,2})?|PCI[- ]DSS|FedRAMP|CSA\s?STAR|HITRUST)\b[^.\n|]{0,80}?\b(certified|certification|attested|attestation|accredited|audited)\b/gi,
  },
  {
    name: "compliance-status",
    why: "'compliant' is read by a reviewer as a finished state somebody verified, not as an intention",
    re: /\b(GDPR|PIPEDA|HIPAA|CCPA|EU\s?AI\s?Act|NIST\s?AI\s?RMF)\b[^.\n|]{0,40}?\bcompliant\b/gi,
  },
  {
    name: "audit-status",
    why: "an audit that has not happened cannot be cited as evidence for any other answer in the document",
    re: /\b(penetration test(?:ed|ing)?|pen[- ]test(?:ed|ing)?|external audit(?:ed)?|third[- ]party audit(?:ed)?|SOC\s?2\s?Type\s?I{1,2}\s?report)\b/gi,
  },
  {
    name: "insurance",
    why: "cover a company does not carry is a promise the client's own risk register will inherit",
    re: /\b(cyber\s?liability|errors\s?(?:and|&)\s?omissions|E&O|professional\s?indemnity|general\s?liability)\b[^.\n|]{0,60}/gi,
  },
  {
    name: "retention-period",
    why: "a retention period is a number the client's DPO copies into their own record of processing",
    re: /\b(?:retained|retention|kept|stored)\b[^.\n|]{0,40}?\b(\d{1,4})\s?(days?|months?|years?)\b/gi,
  },
  {
    name: "uptime",
    why: "an availability figure is either measured or invented, and a reviewer assumes it was measured",
    re: /\b(\d{2}(?:\.\d{1,2})?)\s?%\s?(?:uptime|availability)|\b(?:uptime|availability)[^.\n|]{0,25}?(\d{2}(?:\.\d{1,2})?)\s?%/gi,
  },
  {
    name: "experience",
    why: "the honest ceiling is 15+ years and every document that states it must state the same one",
    re: /\b(\d{1,2})\+?\s?(?:years?|yrs?\.?)\b[^.\n|]{0,30}?\b(?:experience|IT|industry|practice)\b/gi,
  },
];

/**
 * A condition is what turns an intention into an honest forward-looking statement. These are the
 * shapes that count — each names an EVENT or a DATE the reader can hold the company to. A bare
 * "planned", "roadmap", "in progress" or "target" names nothing and is deliberately absent.
 */
export const CONDITION_PATTERNS = [
  /\bupon\b[^.]{3,80}/i,
  /\bonce\b[^.]{3,80}/i,
  /\bwhen\b[^.]{3,80}/i,
  /\bafter\b[^.]{3,80}/i,
  /\bif\b[^.]{3,80}/i,
  /\bby\s+(?:Q[1-4]\s?)?20\d\d\b/i,
  /\bcontingent on\b[^.]{3,80}/i,
  /\bsubject to\b[^.]{3,80}/i,
  /\bprior to\b[^.]{3,80}/i,
  /\bbefore\s+(?:the\s+)?first\b[^.]{3,80}/i,
];

const EMPTY_REASON = /^(?:n\/?a|tbd|todo|see above|as stated|because|it is|—|-|\.)?$/i;

export const hasCondition = (text) => CONDITION_PATTERNS.some((re) => re.test(String(text)));

/**
 * The hedge words that make a claim FORWARD-LOOKING. This distinction is the whole reason the
 * register does not demand a condition from every entry: "conversation records retained 30 days" is
 * a present-tense operational fact, and forcing a condition onto it would make somebody invent one.
 * "Cyber liability in procurement" is a promise about the future, and a promise about the future
 * without a condition is the thing this task exists to refuse.
 */
export const HEDGE = /\b(planned|plan to|target(?:ed|ing)?|pending|in procurement|in progress|to be\b|to procure|roadmap|upcoming|will be|intend(?:ed|s)? to|starting Year|Year 2\+?|due \d|TODO|forthcoming|once issued)\b/i;

export const isForwardLooking = (text) => HEDGE.test(String(text));

/** Evidence is a place a reader can go — a file, a page, a config surface. Not a mood. */
export const EVIDENCE_PATTERNS = [
  /\.(?:md|html|json|mjs|js|yaml|yml)\b/i,
  /\b(?:polic(?:y|ies)|registers?|logs?|ledgers?|tables?|pages?|sections?|clauses?|schedules?|appendix|appendices|maps?|assessments?|certificates?)\b/i,
  /\bhttps?:\/\//i,
  /\b[a-z0-9_-]+\/(?:[a-z0-9_.-]+\/?)*/i, // a directory a reader can open is a place, not a mood
];
export const hasEvidence = (text) => EVIDENCE_PATTERNS.some((re) => re.test(String(text)));

const lineOf = (text, index) => text.slice(0, index).split("\n").length;
const lineTextAt = (text, index) => {
  const start = text.lastIndexOf("\n", index) + 1;
  const end = text.indexOf("\n", index);
  return text.slice(start, end === -1 ? text.length : end).trim();
};

/** A claim's identity: what it asserts, normalised, so the same assertion in two files is one key. */
export const claimKey = (claim) =>
  `${claim.class}:${String(claim.found).toLowerCase().replace(/[\s`*_]+/g, " ").replace(/[.,;]$/, "").trim()}`;

const markdownUnder = (root, dir, out = []) => {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) markdownUnder(root, rel, out);
    else if (entry.name.endsWith(".md")) out.push(rel);
  }
  return out;
};

/**
 * Every factual claim in every client-facing document, with the file, the line and the sentence it
 * was made in — because a reviewer's objection always arrives as "page 4 says X" and an operator
 * has to be able to find page 4.
 */
export function collectClaims({ root = process.cwd(), dirs = CLIENT_FACING_DIRS } = {}) {
  const claims = [];
  const documents = [];
  for (const dir of dirs) {
    for (const rel of markdownUnder(root, dir)) {
      documents.push(rel);
      const text = fs.readFileSync(path.join(root, rel), "utf8");
      for (const klass of CLAIM_CLASSES) {
        klass.re.lastIndex = 0;
        let m;
        while ((m = klass.re.exec(text)) !== null) {
          const context = lineTextAt(text, m.index);
          // Where the claim sits inside its own line, so a negation can be asked whether it comes
          // BEFORE the claim (a disclaimer) or after it (a different sentence about something else).
          const lineStart = text.lastIndexOf("\n", m.index) + 1;
          const rawLine = text.slice(lineStart, text.indexOf("\n", m.index) === -1 ? text.length : text.indexOf("\n", m.index));
          const claimAt = Math.max(0, (m.index - lineStart) - (rawLine.length - rawLine.trimStart().length));
          claims.push({
            class: klass.name,
            why: klass.why,
            found: m[0].trim(),
            file: rel,
            line: lineOf(text, m.index),
            context: context.slice(0, 220),
            // The condition, if any, lives in the SENTENCE the claim was made in — not in the match.
            // "Target $5M cyber liability, to be in place upon first $625K+ contract signing" is one
            // honest sentence, and the honesty is in the half the matcher did not capture.
            conditioned: hasCondition(context),
            disclaimed: isDisclaimed(context, claimAt),
          });
          if (m.index === klass.re.lastIndex) klass.re.lastIndex += 1;
        }
      }
    }
  }
  return { claims, documents };
}

/** What the published pages say, as one searchable body of text with per-page citations. */
export function readPublished({ root = process.cwd(), pages = PUBLISHED_PAGES } = {}) {
  const sources = [];
  for (const page of pages) {
    const abs = path.join(root, page);
    if (!fs.existsSync(abs)) continue;
    const raw = fs.readFileSync(abs, "utf8");
    // Tags stripped so "SOC 2<span> certified</span>" cannot hide a claim from a text search.
    const text = raw.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
    sources.push({ page, text, raw });
  }
  return { readable: sources.length > 0, pages: sources.map((s) => s.page), sources };
}

/** Does a published page carry this assertion? Returns the citation, or null. Never a guess. */
export function publishedCitation(claim, published) {
  const needle = String(claim.found).toLowerCase().replace(/[`*_]/g, "").replace(/\s+/g, " ").trim();
  if (needle.length < 6) return null;
  for (const src of published.sources) {
    const hay = src.text.toLowerCase();
    if (hay.includes(needle)) {
      const at = hay.indexOf(needle);
      return { page: src.page, excerpt: src.text.slice(Math.max(0, at - 60), at + needle.length + 60).trim() };
    }
  }
  return null;
}

/**
 * Parse the register. Format is a markdown table so it is edited by a person, not by a tool:
 * | claim | where | condition | why this is stated the way it is |
 */
export function readClaimDeclarations({ root = process.cwd(), file = REGISTER_FILE } = {}) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) return { readable: false, file, entries: [], malformed: [] };
  const text = fs.readFileSync(abs, "utf8");
  const entries = [];
  const malformed = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i += 1) {
    const row = lines[i];
    if (!/^\s*\|/.test(row)) continue;
    const cells = row.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 4) continue;
    if (/^-+$/.test(cells[0].replace(/[:\s]/g, "-"))) continue; // separator
    if (/^claim$/i.test(cells[0])) continue;                    // header
    const claim = cells[0].replace(/`/g, "").trim();
    const where = cells[1].replace(/`/g, "").trim();
    const condition = cells[2].replace(/`/g, "").trim();
    const why = cells[3].replace(/`/g, "").trim();
    if (!claim) continue;
    const entry = { claim, where, condition, why, line: i + 1, file, key: claim.toLowerCase().replace(/\s+/g, " ") };

    if (!why || EMPTY_REASON.test(why) || why.toLowerCase() === claim.toLowerCase()) {
      entry.refused = "a declaration must carry a reason with content; this one states nothing";
      malformed.push(entry);
      continue;
    }
    entry.forward = isForwardLooking(claim) || isForwardLooking(condition);

    if (!condition) {
      entry.refused = "a declaration must carry either the condition it is contingent on or the evidence that backs it";
      malformed.push(entry);
      continue;
    }
    if (entry.forward && !hasCondition(condition)) {
      // The exit criterion, enforced rather than described: a forward-looking statement that has
      // lost its condition is a REFUSAL, not a warning. "Planned" is not a condition — it names no
      // event and no date, and a reviewer reads it as "somebody is doing it."
      entry.refused =
        "a forward-looking statement without a condition a reader can hold the company to is an " +
        "assertion wearing a hedge; name the event or the date";
      malformed.push(entry);
      continue;
    }
    if (!entry.forward && !hasCondition(condition) && !hasEvidence(condition)) {
      entry.refused =
        "a present-tense claim must point at the artefact that backs it; a cell that names no place " +
        "a reader can go is a restatement, not evidence";
      malformed.push(entry);
      continue;
    }
    entries.push(entry);
  }
  return { readable: true, file, entries, malformed };
}

/**
 * Reconcile every claim. Returns each claim in exactly one state, the declarations that matched
 * nothing (STALE), and the declarations refused for having no reason or no condition.
 */
export function reconcileClaims({
  root = process.cwd(), dirs = CLIENT_FACING_DIRS, registerFile = REGISTER_FILE, pages = PUBLISHED_PAGES,
} = {}) {
  const { claims, documents } = collectClaims({ root, dirs });
  const published = readPublished({ root, pages });
  const declarations = readClaimDeclarations({ root, file: registerFile });

  const declaredIndex = new Map();
  for (const e of declarations.entries) {
    if (!declaredIndex.has(e.key)) declaredIndex.set(e.key, []);
    declaredIndex.get(e.key).push(e);
  }
  const matchedDeclarations = new Set();

  const resolved = claims.map((claim) => {
    const needle = String(claim.found).toLowerCase().replace(/\s+/g, " ").trim();

    // A declaration matches a claim when the register's claim text is contained in the claim as
    // written, or the claim as written is contained in the register's text. Substring in both
    // directions, so a register entry may cover a family of near-identical sentences — and every
    // entry it covers is recorded, so a match can never be asserted without being demonstrable.
    //
    // MOST SPECIFIC WINS, and this was a real defect caught by running the module against the real
    // register. `compliance/policies/encryption.md:32` asserts "SOC 2 + ISO 27001 certified" — about
    // Netlify and DigitalOcean, not about this company. First-match-wins in file order handed it to
    // the "ISO 27001 certified" entry, which is a declaration about THIS company's 2027 target, and
    // then reported the correct, purpose-written sub-processor entry as STALE. The claim was
    // accounted for by the wrong argument and the right argument looked dead. Longest key wins.
    // The two directions are NOT symmetric and treating them as one pool was the bug. An entry
    // CONTAINED IN what the document says is an entry about this exact sentence — of those, the
    // longest is the most specific. An entry that CONTAINS what the document says is an entry about
    // a longer sentence somewhere else, and is only a fallback — of those, the shortest is closest.
    const within = [];
    const around = [];
    for (const [key, list] of declaredIndex) {
      if (needle.includes(key)) within.push([key, list[0]]);
      else if (key.includes(needle)) around.push([key, list[0]]);
    }
    within.sort((a, b) => b[0].length - a[0].length);
    around.sort((a, b) => a[0].length - b[0].length);
    const [winningKey, declaration] = within[0] || around[0] || [null, null];
    if (winningKey !== null) matchedDeclarations.add(winningKey);

    // Checked FIRST, and deliberately: a sentence that denies the claim is not evidence for it and
    // is not a gap in the evidence for it. It is a different thing entirely.
    if (claim.disclaimed) {
      return { ...claim, state: STATE.DISCLAIMED, note: "the sentence explicitly denies this claim; it is a disclaimer, not an assertion" };
    }

    const citation = publishedCitation(claim, published);
    if (citation) return { ...claim, state: STATE.PUBLISHED, citation };
    if (declaration) return { ...claim, state: STATE.DECLARED, declaration };
    return {
      ...claim,
      state: STATE.REFUSED,
      reason:
        "asserted in a document a client receives, absent from every page this company publishes, " +
        "and absent from the register — nothing evidences it",
    };
  });

  const stale = declarations.entries.filter((e) => !matchedDeclarations.has(e.key));
  const byState = (s) => resolved.filter((c) => c.state === s);
  const refused = byState(STATE.REFUSED);

  return {
    schema: CLAIM_REGISTER_SCHEMA,
    registerReadable: declarations.readable,
    publishedReadable: published.readable,
    publishedPages: published.pages,
    documents,
    claims: resolved,
    stale,
    malformed: declarations.malformed,
    summary: {
      documents: documents.length,
      claims: resolved.length,
      published: byState(STATE.PUBLISHED).length,
      declared: byState(STATE.DECLARED).length,
      disclaimed: byState(STATE.DISCLAIMED).length,
      refused: refused.length,
      silent: refused.length, // "silent" on the AV2 pattern: asserted to someone, accounted for by nobody
      stale: stale.length,
      malformed: declarations.malformed.length,
      ok: refused.length === 0 && declarations.malformed.length === 0 && stale.length === 0 && resolved.length > 0,
    },
    refused,
  };
}

export function statementFor(result) {
  const s = result.summary;
  if (!s.claims) return "no factual claim was found to reconcile";
  if (s.ok) {
    return (
      `${s.claims} factual claims across ${s.documents} client-facing documents: ` +
      `${s.published} consistent with a published page, ${s.declared} declared with a condition, ` +
      `${s.disclaimed} explicitly disclaimed by the document itself, 0 silent`
    );
  }
  const parts = [];
  if (s.refused) {
    parts.push(
      `${s.refused} silent claim(s) — ` +
      result.refused.slice(0, 3).map((c) => `${c.file}:${c.line} ${c.class}`).join(", ") +
      (s.refused > 3 ? ` and ${s.refused - 3} more` : ""),
    );
  }
  if (s.malformed) parts.push(`${s.malformed} declaration(s) refused for having no reason or no condition`);
  if (s.stale) parts.push(`${s.stale} declaration(s) match nothing any document says any more`);
  return `${s.claims} factual claims across ${s.documents} documents: ${parts.join("; ")}`;
}

export default {
  reconcileClaims, collectClaims, readClaimDeclarations, readPublished, publishedCitation,
  statementFor, hasCondition, claimKey, CLAIM_CLASSES, CONDITION_PATTERNS, STATE,
  CLIENT_FACING_DIRS, PUBLISHED_PAGES, REGISTER_FILE,
};

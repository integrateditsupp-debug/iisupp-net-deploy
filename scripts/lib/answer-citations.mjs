// answer-citations.mjs — RUN-AX / AX2. EVERY CITATION AN ANSWER MAKES, RESOLVED AGAINST HEAD'S TREE.
//
// The pack does not answer most questions. It POINTS. "Documented in `legal/DPA-template.md`". "See
// the access control policy". "Per BAA Section 6." Dozens of the answers a security reviewer reads
// are not statements at all — they are promises that something else exists.
//
// A citation that does not resolve is worse than a blank. A blank is honest: the reviewer sees it,
// asks about it, and we answer. A broken citation is a promise the reviewer discovers is empty AFTER
// they have started trusting the document — and they discover it by asking for the thing, which
// means we find out at the worst possible moment, in front of the buyer, with no answer ready.
//
// THE DISCIPLINE:
//
//   1. HEAD'S TREE IS THE SOURCE, exactly as in AW3. Not the working copy, not `git ls-files`. A
//      file present on the operator's disk and absent from the shared line is precisely the failure
//      being looked for, and reading the working copy would hide it. AU3 recorded why the index is
//      not the source either: it froze behind a stale lock and ran 27 entries behind HEAD.
//
//   2. A citation to a SECTION resolves only if that section exists in that document. `BAA Section 6`
//      pointing at a document with five sections is a broken citation even though the file is there,
//      and it is the harder one to find by hand.
//
//   3. `documents/`-scoped citations are THEIR OWN CLASS with their reason. The security lockdown
//      excludes that directory and the exclusion is correct. Such a citation is never rounded up to
//      resolved (a clone cannot produce it) and never rounded down to broken (the document exists
//      and the operator can hand it over). Three different facts, three different words.
//
//   4. Nothing is edited to make a count green. A broken citation is reported with the file and the
//      line that makes the promise, and fixing it is a decision about what we meant to point at.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function fsReadIfPresent(abs) {
  try { return fs.readFileSync(abs, "utf8"); } catch { return null; }
}

export const CITATION_SCHEMA = "answer-citations/1";

export const STATE = Object.freeze({
  RESOLVED: "resolved",             // the cited artefact is in HEAD's tree and a clone receives it
  MISDIRECTED: "misdirected",       // the artefact EXISTS — under a path the citation does not name
  BROKEN: "broken",                 // nothing in the shared line carries it: the promise is empty
  SECTION_BROKEN: "section-broken", // the document resolves; the section the answer cites does not exist in it
  EXCLUDED: "excluded",             // deliberately outside the shared line — its own class, with its reason
});

/**
 * MISDIRECTED and BROKEN are kept apart because they are different repairs, and collapsing them
 * would make the count bigger and the report less useful. A citation naming `network-capture.mjs`
 * when the file lives at `ARIA Sentinel/src/shared/network-capture.mjs` is a naming error software
 * can correct. A citation naming a risk register that has never been written is a DECISION: write
 * the artefact, or stop promising it. Software may do the first and must not do the second.
 */
export const CITATION_GAPS = "docs/CITATION-GAPS.md";

/** Directories the security lockdown deliberately keeps out of the shared line. */
export const EXCLUDED_PREFIXES = ["documents/", "senior-director-state/", "outputs/"];

/** Where the pack lives. The same documents AW1 gates and AW3 assembles — wired, not re-listed. */
export const PACK_GLOBS = [
  /^compliance\/[^/]+\.md$/,
  /^compliance\/policies\/[^/]+\.md$/,
  /^legal\/[^/]+\.md$/,
  /^ARIA Sentinel\/sales\/.+\.md$/,
];

/**
 * The shapes an answer uses to point at something. Each carries WHY it is a citation rather than
 * prose, so a pattern cannot be added without somebody stating what promise it represents.
 */
export const SHAPES = [
  {
    kind: "backtick-path",
    why: "the commonest form in this pack: an answer naming the artefact that backs it",
    // A backticked token that looks like a repository path with an extension.
    re: /`([A-Za-z0-9][A-Za-z0-9 _./-]*\.(?:md|html|json|mjs|js|cjs|yaml|yml|xlsx|pdf))`/g,
  },
  {
    kind: "rooted-url",
    why: "a served page an answer sends the reviewer to; a 404 here is the same broken promise with a worse audience",
    re: /`(\/[A-Za-z0-9][A-Za-z0-9 _./-]*\.html)`/g,
  },
];

/** A citation to a section of a named document — the class a file-existence check can never catch. */
export const SECTION_SHAPE = {
  kind: "section-of-document",
  why: "an answer that points at a clause; the file existing proves nothing about the clause",
  // e.g. "`legal/BAA-template.md` Section 6" / "per `...SOC2...md` Section CC3"
  re: /`([A-Za-z0-9][A-Za-z0-9 _./-]*\.md)`\s*,?\s*(?:Section|§)\s*([A-Za-z]{0,4}[0-9][0-9.]*)/g,
};

/**
 * The site's own redirect table, read out of `netlify.toml`.
 *
 * Without this the check is confidently wrong in both directions: it calls a served URL broken
 * because no file sits at that path, and it would call `/privacy.html` fine because `/privacy` is
 * redirected — which it is NOT, the redirect covers the extensionless form only. A link check that
 * does not read the redirect table is guessing.
 */
export function readRedirects({ root = process.cwd(), file = "netlify.toml" } = {}) {
  const map = new Map();
  let text;
  try {
    text = fsReadIfPresent(path.join(root, file));
  } catch {
    return { present: false, map };
  }
  if (text === null) return { present: false, map };
  let from = null;
  for (const line of text.split(/\r?\n/)) {
    const f = line.match(/^\s*from\s*=\s*"([^"]+)"/);
    if (f) { from = f[1]; continue; }
    const t = line.match(/^\s*to\s*=\s*"([^"]+)"/);
    if (t && from) { map.set(from, t[1]); from = null; }
  }
  return { present: true, map };
}

/** HEAD's tree, read once. Unreadable is reported, never guessed. */
export function headTree({ root = process.cwd() } = {}) {
  try {
    const out = execFileSync("git", ["ls-tree", "-r", "-z", "--name-only", "HEAD"], {
      cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return { readable: true, files: new Set(out.split("\0").filter(Boolean)) };
  } catch (err) {
    return { readable: false, files: new Set(), error: String(err && err.message).slice(0, 200) };
  }
}

/** The bytes HEAD carries for one path — what a clone receives, never what is on this disk. */
function headBytes(root, rel) {
  try {
    return execFileSync("git", ["show", `HEAD:${rel}`], {
      cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  } catch {
    return null;
  }
}

/** Which documents in HEAD's tree are part of the pack a stranger receives. */
export function packDocuments(tree, globs = PACK_GLOBS) {
  return [...tree.files].filter((f) => globs.some((g) => g.test(f))).sort();
}

/**
 * Resolve one cited path. Relative citations are tried against the citing document's directory AND
 * against the repository root, because the pack uses both and neither is wrong — what would be wrong
 * is calling a citation broken because we only looked in one place.
 */
function resolvePath(raw, fromFile, tree, redirects = new Map()) {
  const candidates = [];
  if (raw.startsWith("/")) {
    candidates.push(raw.slice(1));
    // A rooted URL is served if the redirect table sends it somewhere real — looked up in the EXACT
    // form the answer cites, and only that form. The first version of this consulted the table with
    // the extension stripped as well, on the reasoning that this repository writes its redirects
    // extensionless. That reasoning is wrong and it is the whole bug: `from = "/privacy"` matches
    // `/privacy` and does not match `/privacy.html`, so the stripped lookup made a citation that
    // 404s report as served. A link checker that normalises the thing it is checking is checking
    // something else.
    const to = redirects.get(raw);
    if (to) candidates.push(to.replace(/^\//, ""));
  } else {
    candidates.push(raw);
    candidates.push(path.posix.join(path.posix.dirname(fromFile), raw));
  }
  for (const c of candidates) {
    const norm = path.posix.normalize(c);
    if (tree.files.has(norm)) return { hit: norm, tried: candidates };
  }
  return { hit: null, tried: candidates };
}

/** Does a document actually contain the section an answer cites? */
function hasSection(text, rawSection) {
  if (text === null) return null;
  // "Section CC3." and "Section 5.2." arrive with the sentence's full stop attached. Escaping that
  // dot turns a correct citation into a reported defect — a check confidently wrong about a
  // punctuation mark, which is the family of bug this series keeps finding in its own modules.
  const section = String(rawSection).replace(/[.,;:)]+$/, "");
  if (!section) return null;
  const esc = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // A heading that opens with the number, or an explicit "Section N" / "§N" anywhere in the body.
  const heading = new RegExp(`^#{1,6}\\s*(?:Section\\s*)?${esc}[.)\\s]`, "mi");
  const table = new RegExp(`^\\|\\s*${esc}\\s*\\|`, "mi");
  const inline = new RegExp(`(?:Section|§)\\s*${esc}\\b`, "i");
  return heading.test(text) || table.test(text) || inline.test(text);
}

function classify(hit, raw, tree) {
  if (hit) return { state: STATE.RESOLVED, reason: null, nearest: [] };
  const excluded = EXCLUDED_PREFIXES.find((p) => raw.replace(/^\//, "").startsWith(p));
  if (excluded) {
    return {
      nearest: [],
      state: STATE.EXCLUDED,
      reason:
        `cited from an answer and deliberately outside the shared line: the security lockdown ` +
        `excludes \`${excluded}\` and that exclusion is correct — a clone cannot produce this, and ` +
        `the operator can, which are two different facts and neither is "resolved"`,
    };
  }
  // Does the artefact exist under a path this citation does not name? Basename-matched against
  // HEAD's tree, so the answer is about what a clone receives rather than what is on this disk.
  const base = path.posix.basename(raw.replace(/^\//, ""));
  const nearest = base ? [...tree.files].filter((f) => path.posix.basename(f) === base).slice(0, 5) : [];
  if (nearest.length) {
    return {
      state: STATE.MISDIRECTED,
      nearest,
      reason:
        "the artefact is in the shared line under a path this answer does not name — a reviewer " +
        "following the citation finds nothing, and the repair is to say where it actually is",
    };
  }
  return {
    state: STATE.BROKEN,
    nearest: [],
    reason:
      "an answer in a document a reviewer reads promises this artefact, and HEAD's tree does not " +
      "carry it under any path — the reviewer finds out by asking for it, which is the worst " +
      "possible moment, and whether to write it or stop promising it is a decision",
  };
}

/** Every citation every answer in the pack makes, resolved. */
/**
 * Read the gaps register. Same shape and same refusals as the AX1 conflict register: a declaration
 * with no reason, a reason too short to be one, or no named decider is REFUSED — that is how a
 * register becomes a rubber stamp.
 */
export function readGapDeclarations({ root = process.cwd(), file = CITATION_GAPS } = {}) {
  const out = new Map();
  const refused = [];
  const text = fsReadIfPresent(path.join(root, file));
  if (text === null) return { present: false, declarations: out, refused };
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim().startsWith("|")) return;
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 6) return;
    const [, artefact, state, reason, who] = cells;
    const bare = artefact.replace(/^`|`$/g, "");
    if (!bare || /^-+$/.test(bare) || bare.toLowerCase() === "artefact") return;
    if (!reason || reason.split(/\s+/).filter(Boolean).length < 6) {
      refused.push({ artefact: bare, line: i + 1, why: "a declaration with no reason, or a reason too short to be one, is a rubber stamp" });
      return;
    }
    if (!who) {
      refused.push({ artefact: bare, line: i + 1, why: "a declaration that does not say who decides is not staged, it is parked" });
      return;
    }
    out.set(bare, { artefact: bare, state, reason, whoDecides: who, file, line: i + 1 });
  });
  return { present: true, declarations: out, refused };
}

export function auditCitations({ root = process.cwd(), globs = PACK_GLOBS, tree = null, gapsFile = CITATION_GAPS } = {}) {
  const head = tree || headTree({ root });
  if (!head.readable) {
    return {
      schema: CITATION_SCHEMA, headReadable: false, error: head.error,
      citations: [], summary: { total: 0, resolved: 0, broken: 0, sectionBroken: 0, excluded: 0, documents: 0, ok: false },
    };
  }

  const redirects = readRedirects({ root });
  const docs = packDocuments(head, globs);
  const bodies = new Map();
  const bodyOf = (f) => {
    if (!bodies.has(f)) bodies.set(f, headBytes(root, f));
    return bodies.get(f);
  };

  const citations = [];

  for (const doc of docs) {
    const text = bodyOf(doc);
    if (text === null) continue;
    const lines = text.split(/\r?\n/);

    // Section citations are collected FIRST so the same backticked path is not also counted as a
    // bare path citation — one promise, one row.
    const sectionKeys = new Set();
    lines.forEach((line, i) => {
      for (const m of line.matchAll(SECTION_SHAPE.re)) {
        const raw = m[1];
        const section = m[2];
        const { hit, tried } = resolvePath(raw, doc, head, redirects.map);
        const base = classify(hit, raw, head);
        let state = base.state;
        let reason = base.reason;
        if (state === STATE.RESOLVED) {
          const present = hasSection(bodyOf(hit), section);
          if (present === false) {
            state = STATE.SECTION_BROKEN;
            reason =
              `the document is in the shared line and the clause is not: an answer cites ` +
              `Section ${section} of \`${hit}\`, which has no such section — a file-existence check ` +
              `passes this and a reviewer opening the document does not`;
          }
        }
        sectionKeys.add(`${i + 1}::${raw}`);
        citations.push({
          from: doc, line: i + 1, kind: SECTION_SHAPE.kind, why: SECTION_SHAPE.why,
          raw, section, resolvedTo: hit, tried, state, reason, nearest: base.nearest,
          source: line.trim().slice(0, 220),
        });
      }
    });

    lines.forEach((line, i) => {
      for (const shape of SHAPES) {
        for (const m of line.matchAll(shape.re)) {
          const raw = m[1];
          if (sectionKeys.has(`${i + 1}::${raw}`)) continue;
          const { hit, tried } = resolvePath(raw, doc, head, redirects.map);
          const { state, reason, nearest } = classify(hit, raw, head);
          citations.push({
            from: doc, line: i + 1, kind: shape.kind, why: shape.why,
            raw, section: null, resolvedTo: hit, tried, state, reason, nearest,
            source: line.trim().slice(0, 220),
          });
        }
      }
    });
  }

  const by = (s) => citations.filter((c) => c.state === s);
  const broken = by(STATE.BROKEN);
  const misdirected = by(STATE.MISDIRECTED);
  const sectionBroken = by(STATE.SECTION_BROKEN);

  // A promise to an artefact nobody has written is a decision, not a typo. It may be DECLARED — with
  // a reason a person wrote and a named decider — and then it is reported on every run rather than
  // silently carried. Undeclared, it goes red. A declaration matching nothing is STALE and also red,
  // so the register cannot rot into a list of things that used to be missing.
  const declared = readGapDeclarations({ root, file: gapsFile });
  const brokenKeys = new Set(broken.map((c) => c.raw));
  const undeclaredBroken = broken.filter((c) => !declared.declarations.has(c.raw));
  const staleGapDeclarations = [...declared.declarations.values()].filter((d) => !brokenKeys.has(d.artefact));

  return {
    schema: CITATION_SCHEMA,
    source: "HEAD's tree — never the working copy, never the index",
    headReadable: true,
    documents: docs,
    citations,
    broken,
    misdirected,
    sectionBroken,
    excluded: by(STATE.EXCLUDED),
    gaps: { file: gapsFile, present: declared.present, refused: declared.refused, stale: staleGapDeclarations, undeclared: undeclaredBroken },
    redirectsRead: redirects.present,
    summary: {
      documents: docs.length,
      total: citations.length,
      resolved: by(STATE.RESOLVED).length,
      misdirected: misdirected.length,
      broken: broken.length,
      brokenUndeclared: undeclaredBroken.length,
      brokenDeclared: broken.length - undeclaredBroken.length,
      sectionBroken: sectionBroken.length,
      excluded: by(STATE.EXCLUDED).length,
      staleGapDeclarations: staleGapDeclarations.length,
      refusedGapDeclarations: declared.refused.length,
      // EXCLUDED does not fail: the lockdown is right, and rounding it into broken would push this
      // program toward weakening the lockdown to make a number green. MISDIRECTED and SECTION_BROKEN
      // do fail — both are repairs software can make without deciding anything. A BROKEN promise
      // fails only while it is SILENT; once somebody has written down why the artefact does not
      // exist and who decides whether it should, it is staged rather than hidden.
      ok: misdirected.length === 0 && sectionBroken.length === 0 &&
        undeclaredBroken.length === 0 && staleGapDeclarations.length === 0 &&
        declared.refused.length === 0,
    },
  };
}

export function statementFor(result) {
  const s = result.summary;
  if (!result.headReadable) return `HEAD's tree could not be read, so no citation in the pack can be resolved: ${result.error}`;
  if (s.ok) {
    return `${s.resolved}/${s.total} citations across ${s.documents} client-facing documents resolve against HEAD's tree; ${s.excluded} point deliberately outside the shared line and are counted as neither; ${s.brokenDeclared} promise an artefact that does not exist and are declared open, 0 silent`;
  }
  const first = [...result.misdirected, ...result.sectionBroken, ...result.gaps.undeclared].slice(0, 3)
    .map((c) => `${c.from}:${c.line} → ${c.raw}${c.section ? ` Section ${c.section}` : ""}`);
  const bad = s.misdirected + s.sectionBroken + s.brokenUndeclared;
  return `${bad} citation(s) in the pack promise something a reviewer cannot follow — ${first.join("; ")}${bad > 3 ? ` and ${bad - 3} more` : ""}`;
}

export default { auditCitations, headTree, packDocuments, readRedirects, readGapDeclarations, statementFor, STATE, SHAPES, SECTION_SHAPE, PACK_GLOBS, EXCLUDED_PREFIXES, CITATION_GAPS, CITATION_SCHEMA };

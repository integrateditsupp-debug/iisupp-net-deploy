// client-facing-leak.mjs — RUN-AU / AU1.
//
// AT1 walked the hour after someone says yes and found five of six steps carried. The sixth was the
// one that decides whether the other five ever produce money: the agreement a client signs lives
// under `documents/`, which the 2026-07-01 security lockdown excludes from git — so a clone of this
// repository cannot produce the document a client signs.
//
// Two things were true at once and the cycle that pretends otherwise ships either a leak or a lie:
// the gap is real, AND the exclusion is right (`publish = "."` serves anything tracked at root to
// the anonymous web, and `documents/` holds operator-internal material).
//
// So the lockdown is not weakened here. What moves into the tree is a document WRITTEN TO BE READ BY
// A CLIENT — not a copy of an internal one — and this gate is what makes that claim checkable rather
// than asserted. It reads every client-facing document on disk and refuses the ones that carry
// operator-internal content.
//
// The rule that shapes the classes below: **a refusal must be something a document can be fixed OUT
// of, not something it has to be gutted of.** So the hard refusals are content that has no business
// in a client's hands at any price — a credential, an internal path, an internal codename, the
// forbidden name, Rule-7 language, an experience claim past the honest ceiling, a contact detail
// that contradicts what the company publishes. A price a client is quoted that the company does not
// publish anywhere is a REAL risk and it is counted and named with its file and line — but it is a
// DECISION (publish the figure, or stop quoting it), not a leak, and a gate that conflates the two
// would force this program to delete working documents to go green. Rule 15.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const LEAK_SCHEMA = "client-facing-leak/1";

/** Where client-facing documents live in the tracked tree. Discovered, never enumerated by hand. */
export const CLIENT_FACING_DIRS = ["legal"];

export const SEVERITY = {
  REFUSE: "refuse", // must never reach a client; the document fails
  DECIDE: "decide", // real risk, real finding, but the fix is a decision and not a deletion
};

/**
 * Every check, as data. A check is a name, a severity, a sentence explaining why a client must never
 * read this, and a matcher. Keeping them as data is what lets the suite plant a leak of EACH class
 * and assert it fails BY NAME rather than merely "something failed".
 */
export const CHECKS = [
  {
    name: "forbidden-name",
    severity: SEVERITY.REFUSE,
    why: "a standing hard rule; this name appears in no artefact this company produces",
    re: /raymond\s*james/gi,
  },
  {
    name: "credential",
    severity: SEVERITY.REFUSE,
    why: "a secret in a document a stranger receives is a secret that is gone",
    re: /(sk_live_[A-Za-z0-9]{6,}|pk_live_[A-Za-z0-9]{6,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bbearer\s+[A-Za-z0-9._-]{20,}|\b(api[_ -]?key|access[_ -]?token|client[_ -]?secret|auth[_ -]?token)\b\s*[:=]\s*\S+|\bpassword\s*[:=]\s*\S+)/gi,
  },
  {
    name: "internal-path",
    severity: SEVERITY.REFUSE,
    why: "an operator's filesystem is not part of what a client bought",
    re: /(senior-director-state\/|aria-vault\/|documents\/|\.codex-observer\/|_incoming-patches\/|_branch-src\/|[A-Za-z]:\\Users\\|AppData\\Roaming)/gi,
  },
  {
    name: "internal-codename",
    severity: SEVERITY.REFUSE,
    why: "internal process vocabulary tells a client how the sausage is made and dates the document",
    re: /\b(NEEDS-AHMAD|kill-?switch|operator-internal|Cowork|Codex|Claude Code|RUN-[A-Z]{1,2}\d?\b|flywheel cycle|PROGRESS-LEDGER)\b/g,
  },
  {
    name: "rule-7-language",
    severity: SEVERITY.REFUSE,
    why: "guarantee/money-back/risk-free language is a promise this company has not earned the right to make",
    // "Uptime guarantee" in an SLA table is a measured service level, not a marketing promise, and is
    // deliberately NOT matched: the refusal is for the promise, not for the word.
    re: /\b(money[- ]back|risk[- ]free|no[- ]risk|satisfaction guaranteed|100%\s*guarantee\w*|guaranteed\s+(results|savings|roi|outcomes?|success))\b/gi,
  },
  {
    name: "experience-claim",
    severity: SEVERITY.REFUSE,
    why: "the honest ceiling is 15+ years; anything above it is a fabricated credential (Rule 14)",
    re: /\b(1[6-9]|[2-9]\d)\+?\s*years?\b(?=[^.\n]{0,40}\b(experience|in IT|serving|industry|practice)\b)/gi,
  },
  {
    name: "unpublished-price",
    severity: SEVERITY.DECIDE,
    why: "a figure a client is quoted but cannot verify anywhere the company publishes",
    re: /\$\s?\d[\d,]*(?:\.\d{2})?/g,
    // Resolved against the published plan table rather than judged in isolation — see auditDocument.
    resolver: "publishedMoney",
  },
];

/** The money figures the company actually publishes, read out of the plan table (never typed). */
export function publishedMoney({ root, file = "plans/index.html" } = {}) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) return { readable: false, file, figures: new Set() };
  const text = fs.readFileSync(abs, "utf8");
  const figures = new Set((text.match(/\$\s?\d[\d,]*(?:\.\d{2})?/g) || []).map(normalizeMoney));
  return { readable: true, file, figures };
}

const normalizeMoney = (s) => String(s).replace(/\s+/g, "").replace(/,/g, "").toLowerCase();

/** The contact facts the company publishes, read out of the public pages (never typed). */
export function publishedContact({ root } = {}) {
  const out = { domain: null, postal: null, phone: null, sources: [] };
  for (const file of ["index.html", "about.html", "contact.html"]) {
    const abs = path.join(root, file);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, "utf8");
    const domain = text.match(/\b(iisupp\.net)\b/i);
    const postal = text.match(/\bL1P\s?([0-9][A-Z][0-9])\b/i);
    const phone = text.match(/\(?647\)?[-. ]?581[-. ]?3182/);
    if (domain && !out.domain) out.domain = domain[1].toLowerCase();
    if (postal && !out.postal) out.postal = `L1P ${postal[1].toUpperCase()}`;
    if (phone && !out.phone) out.phone = "647-581-3182";
    out.sources.push(file);
  }
  return out;
}

/** Contact details printed in a document that contradict what the company publishes. */
export function contactContradictions(text, contact) {
  const found = [];
  if (contact.domain) {
    const stem = contact.domain.replace(/\.net$/i, "");
    for (const hit of new Set(String(text).match(new RegExp(`\\b${stem}[a-z0-9-]*\\.(?:net|com|ca)\\b`, "gi")) || [])) {
      if (hit.toLowerCase() !== contact.domain) found.push({ kind: "domain", found: hit, expected: contact.domain });
    }
  }
  if (contact.postal) {
    for (const hit of new Set(String(text).match(/\bL1P\s?[0-9][A-Z][0-9]\b/gi) || [])) {
      const norm = hit.toUpperCase().replace(/L1P\s?/, "L1P ");
      if (norm !== contact.postal) found.push({ kind: "postal-code", found: hit, expected: contact.postal });
    }
  }
  if (contact.phone) {
    for (const hit of new Set(String(text).match(/\(?647\)?[-. ]?\d{3}[-. ]?\d{4}/g) || [])) {
      if (hit.replace(/\D/g, "") !== "6475813182") found.push({ kind: "phone", found: hit, expected: contact.phone });
    }
  }
  return found;
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/**
 * Audit ONE document. Every finding carries the check that produced it, the exact string, and the
 * line — because "this file has a problem" is not something an operator can act on at 11pm.
 */
export function auditDocument({ text, file, published, contact }) {
  const findings = [];

  for (const check of CHECKS) {
    check.re.lastIndex = 0;
    let m;
    while ((m = check.re.exec(text)) !== null) {
      if (check.resolver === "publishedMoney") {
        if (published.figures.has(normalizeMoney(m[0]))) continue;
      }
      findings.push({
        check: check.name, severity: check.severity, why: check.why,
        found: m[0], line: lineOf(text, m.index), file,
      });
      if (m.index === check.re.lastIndex) check.re.lastIndex += 1;
    }
  }

  for (const c of contactContradictions(text, contact)) {
    findings.push({
      check: "contact-contradiction", severity: SEVERITY.REFUSE,
      why: "a client who checks the detail finds the company does not match its own document",
      found: c.found, expected: c.expected, kind: c.kind,
      line: lineOf(text, text.indexOf(c.found)), file,
    });
  }

  const refusals = findings.filter((f) => f.severity === SEVERITY.REFUSE);
  return {
    file,
    ok: refusals.length === 0,
    findings,
    refusals,
    decisions: findings.filter((f) => f.severity === SEVERITY.DECIDE),
  };
}

/**
 * What the SHARED LINE carries.
 *
 * AU1 found this the hard way. Every earlier gate asked `git ls-files`, which reads the INDEX — and
 * this environment's index has been frozen since a stale `.git/index.lock` that the sandbox cannot
 * unlink (AR3's recorded boundary). The index is 27 entries behind HEAD, so `ls-files` reports files
 * that a clone demonstrably DOES receive as absent from the shared line.
 *
 * The question this gate actually asks is "can a clone of this repository produce the document a
 * client signs", and the answer to that lives in HEAD's TREE, not in one machine's index. So HEAD is
 * the source and the index is a union on top of it (a staged-but-uncommitted file is on its way in).
 * If neither can be read, that is reported as unreadable and never guessed.
 */
function trackedSet(root) {
  const read = (args) => {
    try {
      return execFileSync("git", args, {
        cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      }).split("\0").filter(Boolean);
    } catch {
      return null;
    }
  };
  const head = read(["ls-tree", "-r", "-z", "--name-only", "HEAD"]);
  const index = read(["ls-files", "-z"]);
  if (head === null && index === null) return null;
  return new Set([...(head || []), ...(index || [])]);
}

/** Every client-facing document in the tree, audited together. */
export function auditClientFacing({ root, dirs = CLIENT_FACING_DIRS } = {}) {
  const base = root || process.cwd();
  const published = publishedMoney({ root: base });
  const contact = publishedContact({ root: base });
  const tracked = trackedSet(base);

  const documents = [];
  for (const dir of dirs) {
    const abs = path.join(base, dir);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs).sort()) {
      if (!name.endsWith(".md")) continue;
      const rel = `${dir}/${name}`;
      const text = fs.readFileSync(path.join(abs, name), "utf8");
      const audited = auditDocument({ text, file: rel, published, contact });
      audited.tracked = tracked ? tracked.has(rel) : null;
      audited.bytes = Buffer.byteLength(text);
      documents.push(audited);
    }
  }

  const refusals = documents.flatMap((d) => d.refusals);
  const decisions = documents.flatMap((d) => d.decisions);

  return {
    schema: LEAK_SCHEMA,
    trackedReadable: tracked !== null,
    published: { moneyFile: published.file, moneyReadable: published.readable, contact },
    documents,
    summary: {
      documents: documents.length,
      clean: documents.filter((d) => d.ok).length,
      refused: documents.filter((d) => !d.ok).length,
      untracked: documents.filter((d) => d.tracked === false).length,
      refusals: refusals.length,
      decisions: decisions.length,
      ok: refusals.length === 0 && documents.length > 0,
    },
    refusals,
    decisions,
  };
}

export function statementFor(result) {
  const s = result.summary;
  if (!s.documents) return "no client-facing document was found to audit";
  if (s.ok) {
    return (
      `${s.clean}/${s.documents} client-facing documents carry nothing operator-internal` +
      (s.decisions ? `; ${s.decisions} quoted figure(s) are not published anywhere a client can check them` : "")
    );
  }
  return (
    `${s.refused}/${s.documents} client-facing documents are refused — ` +
    result.refusals.slice(0, 3).map((f) => `${f.file}:${f.line} ${f.check}`).join(", ") +
    (s.refusals > 3 ? ` and ${s.refusals - 3} more` : "")
  );
}

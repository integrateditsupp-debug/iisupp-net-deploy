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

/**
 * Where client-facing documents live in the tracked tree. Discovered, never enumerated by hand.
 *
 * RUN-AW / AW1 widened this from `["legal"]` — four documents — to the set a client, a prospect, or
 * a client's own security reviewer can actually receive: the contracts, the compliance pack (the
 * SIG-Lite and CAIQ-Lite questionnaires an enterprise reviewer works through line by line, the
 * eleven written policies, the readiness maps, the SOC 2 self-assessment) and the two sales sheets.
 * Twenty-seven documents. It is the same set AV2's money audit already reads, and it was chosen
 * there for the same reason: these are the files that leave the building.
 *
 * The walk is RECURSIVE as of AW1, because `compliance/policies/` is a directory and a
 * non-recursive walk had been silently reporting eleven policies as "not found" rather than as
 * "not clean" — the difference between an unasked question and an answered one.
 */
export const CLIENT_FACING_DIRS = ["legal", "compliance", "ARIA Sentinel/sales"];

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
    // AW1 STRENGTHENED this, and the strengthening is the finding. The old pattern required the
    // word `years` spelled out and a qualifying noun within 40 characters. The SOC 2 controls
    // self-assessment — the document an enterprise buyer's auditor reads first — carried
    // `Founder 21+ yrs IT` and sailed through every cycle since the check was written, because it
    // abbreviates and because `IT` is two characters, not the word "experience". A check that only
    // catches the careful spelling of a claim catches nothing an overclaim would ever be written in.
    re: /\b(1[6-9]|[2-9]\d)\+?\s*(?:years?|yrs?\.?)\b(?=[^.\n]{0,40}\b(experience|in IT|IT\b|serving|industry|practice)\b)/gi,
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

/**
 * EXEMPTIONS — the only way a check may be narrowed, and the price of using one is that it is
 * declared here in code with an argument a person wrote, scoped to the directories where the
 * argument holds, and COUNTED AND REPORTED on every run. An exemption is never silent: it appears
 * in `result.exemptions` with its file, its line and its reason, so widening the walk can never be
 * made to look green by quietly turning a check off (AW1's standing constraint).
 *
 * There is exactly one, and it exists because the check is right about the vocabulary and wrong
 * about this particular word.
 */
export const EXEMPTIONS = [
  {
    check: "internal-codename",
    term: "kill-switch",
    dirs: ["compliance", "ARIA Sentinel/sales"],
    why:
      "a kill switch is a PRODUCT CONTROL a buyer is entitled to be told about, not internal process " +
      "vocabulary. EU AI Act Article 14 human-oversight answers and the NIST AI RMF map are the exact " +
      "places a reviewer looks for a stop control, and naming it anything else to satisfy a regex would " +
      "make the answer worse for the reader it is written for. The codename check stays at full strength " +
      "everywhere else, including in `legal/`, where a contract has no reason to name it at all.",
  },
];

const dirScope = (file, dirs) => dirs.some((d) => file === d || file.startsWith(`${d}/`));

/** Does a declared exemption cover this finding? Returns the exemption, or null. */
export function exemptionFor(finding) {
  return (
    EXEMPTIONS.find(
      (e) =>
        e.check === finding.check &&
        dirScope(finding.file, e.dirs) &&
        String(finding.found).toLowerCase().replace(/\s+/g, "-") === e.term,
    ) || null
  );
}

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

  // A declared exemption moves a finding OUT of the refusal set and INTO its own reported set. It
  // never removes it from `findings`, because the thing an exemption must never do is make the
  // occurrence invisible to the next person who reads the report.
  const exempted = [];
  const live = [];
  for (const f of findings) {
    const e = exemptionFor(f);
    if (e) exempted.push({ ...f, exempt: true, exemption: e.why });
    else live.push(f);
  }

  const refusals = live.filter((f) => f.severity === SEVERITY.REFUSE);
  return {
    file,
    ok: refusals.length === 0,
    findings,
    refusals,
    exempted,
    decisions: live.filter((f) => f.severity === SEVERITY.DECIDE),
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

  // RECURSIVE as of AW1 — `compliance/policies/` is a directory of eleven documents a reviewer
  // reads, and a flat readdir had been skipping every one of them without saying so.
  const markdownUnder = (dir, out = []) => {
    const abs = path.join(base, dir);
    if (!fs.existsSync(abs)) return out;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) markdownUnder(rel, out);
      else if (entry.name.endsWith(".md")) out.push(rel);
    }
    return out;
  };

  const documents = [];
  for (const dir of dirs) {
    for (const rel of markdownUnder(dir)) {
      const text = fs.readFileSync(path.join(base, rel), "utf8");
      const audited = auditDocument({ text, file: rel, published, contact });
      audited.tracked = tracked ? tracked.has(rel) : null;
      audited.bytes = Buffer.byteLength(text);
      documents.push(audited);
    }
  }

  const refusals = documents.flatMap((d) => d.refusals);
  const decisions = documents.flatMap((d) => d.decisions);
  const exempted = documents.flatMap((d) => d.exempted);

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
      exempted: exempted.length,
      ok: refusals.length === 0 && documents.length > 0,
    },
    refusals,
    decisions,
    exempted,
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

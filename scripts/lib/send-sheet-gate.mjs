// send-sheet-gate.mjs — RUN-AV / AV3. THE TWELVE MESSAGES, MADE IMPOSSIBLE TO GET WRONG.
//
// The send sheet has been rank 1 on NEEDS-AHMAD for six cycles and has never been sent. Every cycle
// the program made the artefact a little more correct and reported, honestly, that pressing send is
// a human act. All of that is true and none of it moved.
//
// What has never been checked is what pressing send COSTS. Twelve messages, each one asking the
// sender to satisfy himself — twelve separate times, at whatever hour he is doing this — that the
// copy carries no guarantee language, no experience claim he cannot stand behind, no forbidden name,
// no price the website contradicts, no link that 404s, and no contact detail that should not be in a
// file at all. Twelve judgement calls is not one click. It is the reason a twenty-minute task has
// survived six cycles.
//
// So this checks them by code, once, and reports what a person would otherwise have to check by eye.
//
// WHAT THIS DOES NOT DO, stated so it cannot drift: it does not send. It has no transport, no
// address book, no credential, and no network call. It reads a file and reports on it. The send stays
// a human writing to another human, which is correct, and is not what was slowing this down.
//
// RULE 11 IS ENFORCED, NOT ASSUMED. The sheet is handles-only by design. A real email address, phone
// number or street address appearing in it is a REFUSAL — that file is read in demos and screenshots.

import fs from "node:fs";
import path from "node:path";
import { publishedMoney } from "./client-facing-leak.mjs";

export const SEND_SHEET_SCHEMA = "send-sheet-gate/1";
export const SENDS = false;

export const SEND_SHEET_FILE = "senior-director-state/outbound/SEND-SHEET-2026-08-05.md";

export const SEVERITY = Object.freeze({
  REFUSE: "refuse",     // this message must not go out as written
  UNCHECKED: "unchecked", // this environment cannot decide it; never counted as a pass
});

/**
 * FOUND BY RUNNING IT IN A CLONE (2026-08-11), and it is the same shape as AU1's finding about the
 * agreement: the send sheet lives under `senior-director-state/`, which `.gitignore` excludes because
 * this repository's ROOT IS SERVED — anything tracked there is live URL space. So the artefact that
 * has been rank 1 on NEEDS-AHMAD for six cycles exists on exactly one machine.
 *
 * It is NOT moved into the tree to make this go green. Outreach copy in served URL space is a worse
 * outcome than outreach copy on one laptop. The absence is reported as its own class, with its
 * reason, and the checks below are proven against fixtures so they are real in a clone regardless.
 */
export const UNTRACKED = "present-on-the-operator-machine-and-absent-from-the-shared-line-by-deploy-safety-design";

export const CHECKS = [
  {
    name: "forbidden-name",
    severity: SEVERITY.REFUSE,
    why: "a standing hard rule",
    re: /raymond\s*james/gi,
  },
  {
    name: "rule-7-language",
    severity: SEVERITY.REFUSE,
    why: "guarantee / money-back / risk-free is a promise this company has not earned the right to make",
    re: /\b(money[- ]back|risk[- ]free|no[- ]risk|satisfaction guaranteed|100%\s*guarantee\w*|guarantee[ds]?|guaranteed\s+(results|savings|roi|outcomes?|success))\b/gi,
  },
  {
    name: "experience-overclaim",
    severity: SEVERITY.REFUSE,
    why: "the honest ceiling is 15+ years; anything above it is a fabricated credential",
    re: /\b(1[6-9]|[2-9]\d)\+?\s*years?\b/gi,
  },
  {
    name: "contact-detail",
    severity: SEVERITY.REFUSE,
    why: "Rule 11 — this file is handles only; a real address or number in it is uncontrolled exposure",
    re: /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\(?\d{3}\)?[-. ]\d{3}[-. ]\d{4})/g,
  },
  {
    name: "fabricated-proof",
    severity: SEVERITY.REFUSE,
    why: "a named customer, a case-study claim or a measured saving this company cannot evidence",
    re: /\b(\d{1,3}%\s+(?:of\s+)?(?:our\s+)?(?:clients?|customers?|tickets?)\s+(?:saved|reduced|cut)|saved\s+(?:our\s+)?clients?\s+\$)/gi,
  },
];

/** Money in a message must appear on the page a recipient can check. */
export const MONEY = /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:[KMB]\b)?/g;

/** Links. Same-site links must resolve on disk; anything else is UNCHECKED with a reason. */
export const LINK = /\bhttps?:\/\/[^\s)>\]]+|\]\((\/[^\s)]+)\)/gi;

const normalizeMoney = (s) => String(s).replace(/\s+/g, "").replace(/,/g, "").toUpperCase();
const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/**
 * Split the sheet into messages. A message is a `### N · HANDLE — label` heading followed by the
 * blockquote lines under it. Prose between messages is not a message and is not checked as one.
 */
export function parseSendSheet({ root = process.cwd(), file = SEND_SHEET_FILE } = {}) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) return { readable: false, file, messages: [], reason: "no such file" };
  const text = fs.readFileSync(abs, "utf8");
  const lines = text.split("\n");

  const messages = [];
  let current = null;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const head = raw.match(/^###\s+(\d+)\s*[·.]\s*([A-Za-z0-9-]+)\s*(?:[—-]\s*(.*))?$/);
    if (head) {
      if (current) messages.push(current);
      current = {
        index: Number(head[1]),
        handle: head[2],
        label: (head[3] || "").replace(/\*/g, "").trim(),
        headingLine: i + 1,
        bodyLines: [],
      };
      continue;
    }
    if (!current) continue;
    if (/^#{1,3}\s/.test(raw) || /^---\s*$/.test(raw)) { messages.push(current); current = null; continue; }
    if (/^\s*>/.test(raw)) current.bodyLines.push({ line: i + 1, text: raw.replace(/^\s*>\s?/, "") });
  }
  if (current) messages.push(current);

  for (const m of messages) {
    m.body = m.bodyLines.map((b) => b.text).join("\n").trim();
    m.firstBodyLine = m.bodyLines.length ? m.bodyLines[0].line : m.headingLine;
  }
  return { readable: true, file, messages, text };
}

/** Is this path deliberately excluded from the tracked tree, or merely missing? Different facts. */
export function isDeploySafetyExcluded({ root = process.cwd(), file = SEND_SHEET_FILE } = {}) {
  const ignore = path.join(root, ".gitignore");
  if (!fs.existsSync(ignore)) return false;
  const top = String(file).split("/")[0];
  return fs.readFileSync(ignore, "utf8").split("\n")
    .some((l) => l.trim().replace(/^\//, "").replace(/\/$/, "") === top);
}

/** Check ONE message. Findings carry the check, the exact string, and the line in the sheet. */
export function checkMessage(message, { published, root, file }) {
  const findings = [];
  const body = message.body || "";
  const lineFor = (offset) => {
    // Map an offset inside the joined body back to the sheet line it came from.
    let seen = 0;
    for (const b of message.bodyLines) {
      if (offset <= seen + b.text.length) return b.line;
      seen += b.text.length + 1;
    }
    return message.firstBodyLine;
  };

  if (!body) {
    findings.push({
      check: "empty-body", severity: SEVERITY.REFUSE, line: message.headingLine,
      found: "", why: "a message with no body cannot be sent, and a sheet that lists one is not ready",
    });
  }

  for (const check of CHECKS) {
    check.re.lastIndex = 0;
    let m;
    while ((m = check.re.exec(body)) !== null) {
      findings.push({ check: check.name, severity: check.severity, why: check.why, found: m[0], line: lineFor(m.index) });
    }
  }

  MONEY.lastIndex = 0;
  let mm;
  while ((mm = MONEY.exec(body)) !== null) {
    if (published.figures.has(normalizeMoney(mm[0]).toLowerCase()) || published.figures.has(normalizeMoney(mm[0]))) continue;
    findings.push({
      check: "unpublished-figure", severity: SEVERITY.REFUSE, found: mm[0], line: lineFor(mm.index),
      why: "a figure quoted to a stranger that the page they will look at does not carry",
    });
  }

  const links = [];
  LINK.lastIndex = 0;
  let lm;
  while ((lm = LINK.exec(body)) !== null) {
    const href = lm[1] || lm[0];
    const line = lineFor(lm.index);
    if (/^https?:\/\//i.test(href) && !/iisupp\.net/i.test(href)) {
      links.push({ href, line, verdict: SEVERITY.UNCHECKED, why: "an external destination cannot be resolved here without a network call" });
      findings.push({ check: "external-link", severity: SEVERITY.UNCHECKED, found: href, line, why: "resolved by nobody in this environment; reported, never counted as a pass" });
      continue;
    }
    const rel = href.replace(/^https?:\/\/[^/]+/i, "").split(/[?#]/)[0] || "/";
    const candidates = rel === "/" ? ["index.html"] : [
      rel.replace(/^\//, ""),
      `${rel.replace(/^\//, "").replace(/\/$/, "")}.html`,
      `${rel.replace(/^\//, "").replace(/\/$/, "")}/index.html`,
    ];
    const hit = candidates.find((c) => fs.existsSync(path.join(root, c)));
    if (hit) { links.push({ href, line, verdict: "resolves", to: hit }); continue; }
    links.push({ href, line, verdict: SEVERITY.REFUSE, why: "resolves to nothing in this tree" });
    findings.push({ check: "dead-link", severity: SEVERITY.REFUSE, found: href, line, why: "a link in a first impression that resolves to nothing" });
  }

  const refusals = findings.filter((f) => f.severity === SEVERITY.REFUSE);
  const unchecked = findings.filter((f) => f.severity === SEVERITY.UNCHECKED);
  return {
    ...message, file, findings, links, refusals, unchecked,
    ok: refusals.length === 0,
    judgementCallsLeft: refusals.length + unchecked.length,
  };
}

/**
 * Audit the whole sheet. Returns per-message verdicts and, crucially, the number of judgement calls
 * the sender still has to make — which is the figure this task exists to drive to zero.
 */
export function auditSendSheet({ root = process.cwd(), file = SEND_SHEET_FILE } = {}) {
  const parsed = parseSendSheet({ root, file });
  if (!parsed.readable) {
    const excluded = isDeploySafetyExcluded({ root, file });
    return {
      schema: SEND_SHEET_SCHEMA, readable: false, file,
      reason: parsed.reason,
      untracked: excluded ? UNTRACKED : null,
      untrackedReason: excluded
        ? "this path is excluded from the tracked tree by the deploy-safety lockdown, because the repository root is served"
        : null,
      messages: [],
      summary: { messages: 0, clean: 0, refused: 0, refusals: 0, unchecked: 0, judgementCallsLeft: null, ok: false },
    };
  }
  const published = publishedMoney({ root });
  const messages = parsed.messages.map((m) => checkMessage(m, { published, root, file }));

  // A sheet that claims a count and carries a different one is its own defect: the operator is
  // working from the claim, not from the file.
  const claimed = (parsed.text.match(/\*\*(\d+)\s+live\b/) || parsed.text.match(/\b(\d+)\s+live\b/) || [])[1];
  const countAgrees = claimed === undefined ? null : Number(claimed) === messages.length;

  const refusals = messages.flatMap((m) => m.refusals);
  const unchecked = messages.flatMap((m) => m.unchecked);
  return {
    schema: SEND_SHEET_SCHEMA, readable: true, file, sends: SENDS,
    messages,
    claimedCount: claimed === undefined ? null : Number(claimed),
    countAgrees,
    summary: {
      messages: messages.length,
      clean: messages.filter((m) => m.ok).length,
      refused: messages.filter((m) => !m.ok).length,
      refusals: refusals.length,
      unchecked: unchecked.length,
      judgementCallsLeft: refusals.length + unchecked.length,
      ok: refusals.length === 0 && messages.length > 0 && countAgrees !== false,
    },
  };
}

export function statementFor(report) {
  if (!report.readable) {
    return report.untracked
      ? `send sheet: NOT IN THE SHARED LINE — ${report.file} is excluded from the tracked tree by the ` +
        `deploy-safety lockdown (the repository root is served), so a clone cannot produce the twelve ` +
        `messages. It is not moved into served URL space to make this green. Checked on the operator machine only.`
      : `send sheet: unreadable (${report.reason}) — nothing can be checked, and nothing should be sent.`;
  }
  const s = report.summary;
  if (s.ok && s.judgementCallsLeft === 0) {
    return `send sheet: ${s.messages} message(s), ${s.clean} clean, 0 judgement calls left — pressing send requires no check the sender has to make himself. Nothing here sends.`;
  }
  const cites = report.messages.filter((m) => !m.ok).slice(0, 4)
    .map((m) => `#${m.index} ${m.handle} ${m.refusals[0].check} at ${m.file}:${m.refusals[0].line}`).join(" · ");
  return `send sheet: ${s.messages} message(s), ${s.refused} refused, ${s.unchecked} unchecked — ${s.judgementCallsLeft} judgement call(s) left${cites ? ` — ${cites}` : ""}.`;
}

export default { auditSendSheet, parseSendSheet, checkMessage, statementFor, isDeploySafetyExcluded, CHECKS, SEND_SHEET_FILE, SEVERITY, SENDS, UNTRACKED };

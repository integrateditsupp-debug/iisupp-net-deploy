// yes-path.mjs — RUN-AT / AT1.
//
// Twenty-five cycles have made the FRONT of the funnel true: the routes resolve, the first screens
// lead with the reader's gain, the sixteen public files agree, the publish is rehearsed. Nobody has
// ever asked what happens in the hour AFTER someone answers.
//
// This walks that path the way AN1 walked the customer routes: as ARTEFACTS on disk, not as
// intentions. Reply received → call booked → scope agreed → agreement signed → invoice raised →
// payment received. Every step is resolved against a real file, and a step with nothing behind it
// is MISSING and names what it blocks.
//
// The rule that makes this worth running: **"handled manually" is not a resolution.** That phrase is
// exactly how a gap hides. A step is manual-BY-DESIGN only when it is declared here with a reason
// (the send, the signature, the payment are irreversible acts a person must perform) — and even a
// by-design step still has to point at the artefact the person uses, or it is missing like any other.
//
// The second rule, learned by running it: **an artefact the shared line does not carry is not
// present.** `documents/` is excluded from git by the 2026-07-01 security lockdown, so a proposal or
// an agreement living there exists for one operator on one machine and for nobody else. That is a
// real state with real consequences at 2am when the founder is on a different computer, so it gets
// its own class — UNTRACKED — instead of being rounded up to present or down to missing.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const YES_PATH_SCHEMA = "yes-path/1";

export const CLASSES = {
  PRESENT: "present",     // tracked, non-empty, and passes its own usability check
  UNTRACKED: "untracked", // real on this disk, absent from the shared line
  UNUSABLE: "unusable",   // there, carried, and wrong in a way that would be met by the client
  MISSING: "missing",     // nothing at all
};

// Worst-to-best, so a step takes the BEST artefact it has and no better.
const RANK = [CLASSES.MISSING, CLASSES.UNUSABLE, CLASSES.UNTRACKED, CLASSES.PRESENT];
const better = (a, b) => (RANK.indexOf(a) >= RANK.indexOf(b) ? a : b);

/** The canonical contact facts, read out of the tree rather than typed here (Rule 14 / AM1). */
export function canonicalContact({ root }) {
  const out = { domain: null, phone: null, source: null };
  for (const file of ["index.html", "about.html"]) {
    const p = path.join(root, file);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    const domain = text.match(/\b(iisupp\.net)\b/i);
    const phone = text.match(/(?:\+1[- ]?)?\(?(647)\)?[- ]?(581)[- ]?(3182)/);
    if (domain && !out.domain) { out.domain = domain[1].toLowerCase(); out.source = file; }
    if (phone && !out.phone) out.phone = "647-581-3182";
    if (out.domain && out.phone) break;
  }
  return out;
}

/**
 * A usability check every client-facing artefact has to pass: it must not print a contact detail
 * that contradicts the tree. Found by running this — the only agreement template in the building
 * signs off with a domain the company does not own.
 */
export function contactFindings(text, contact) {
  const findings = [];
  if (!contact.domain) return findings;
  const stem = contact.domain.replace(/\.net$/i, "");           // iisupp
  const re = new RegExp(`\\b${stem}[a-z0-9-]+\\.(?:net|com|ca)\\b`, "gi");
  for (const hit of new Set(String(text).match(re) || [])) {
    if (hit.toLowerCase() === contact.domain) continue;
    findings.push({ kind: "contact-domain", found: hit, expected: contact.domain });
  }
  return findings;
}

/** Counts the blanks a human has to fill by hand before the artefact can be sent. Used by AT3. */
export function handInputs(text, kind) {
  const s = String(text);
  if (kind === "form") return (s.match(/\sid="b-[a-z0-9]+"/gi) || []).length;
  const blanks = (s.match(/_{4,}/g) || []).length;
  const braced = (s.match(/\{\{[^}]{1,60}\}\}/g) || []).length;
  const bracket = (s.match(/\[(?:CLIENT|NAME|DATE|COMPANY|AMOUNT|TERM)[^\]]{0,30}\]/gi) || []).length;
  const emptyCells = (s.match(/^\|[^|\n]*\|(?:\s*\|)+\s*$/gm) || []).length;
  return blanks + braced + bracket + emptyCells;
}

/**
 * The path itself. Order matters: each step's failure blocks everything below it, and that is the
 * sentence the operator needs — not a count of green ticks.
 */
export const STEPS = [
  {
    id: "reply-received",
    name: "a reply arrives and is seen",
    manual: null,
    artefacts: [
      { path: "netlify/functions/aria-lead-capture.js", kind: "code", must: ["nonEmpty"] },
      { path: "netlify/functions/aria-lead-capture.mjs", kind: "code", must: ["nonEmpty"] },
    ],
  },
  {
    id: "call-booked",
    name: "a call is booked without a second email",
    manual: null,
    artefacts: [
      { path: "book.html", kind: "form", must: ["nonEmpty", "submits", "contact"] },
    ],
  },
  {
    id: "scope-agreed",
    name: "scope and price are put in writing",
    manual: null,
    artefacts: [
      { path: "documents/sales-marketing/Pilot-Program-Offer-2026-06-27.md", kind: "doc", must: ["nonEmpty", "contact"] },
      { path: "documents/sales-marketing/ARIA-Sentinel-Pilot-One-Pager.md", kind: "doc", must: ["nonEmpty", "contact"] },
      { path: "plans/index.html", kind: "page", must: ["nonEmpty", "money"] },
    ],
  },
  {
    id: "agreement-signed",
    name: "an agreement exists to sign",
    manual: { because: "a signature is an irreversible act by a named person; software must never forge it" },
    artefacts: [
      { path: "documents/sales-marketing/ARIA-Sentinel-14-Day-Pilot-Agreement-TEMPLATE.md", kind: "doc", must: ["nonEmpty", "contact"] },
    ],
  },
  {
    id: "invoice-raised",
    name: "a first invoice can be raised",
    manual: null,
    artefacts: [
      { path: "netlify/functions/stripe-checkout.js", kind: "code", must: ["nonEmpty"] },
      { path: "netlify/functions/aria-invoice-download.js", kind: "code", must: ["nonEmpty"] },
    ],
  },
  {
    id: "payment-received",
    name: "money lands and is confirmed",
    manual: { because: "the client authorises the payment; no agent in this repository may move money" },
    artefacts: [
      { path: "netlify/functions/stripe-webhook.js", kind: "code", must: ["nonEmpty"] },
      { path: "netlify/functions/sentinel-stripe-webhook.mjs", kind: "code", must: ["nonEmpty"] },
    ],
  },
];

function trackedSet(root) {
  try {
    const out = execFileSync("git", ["ls-files", "-z"], {
      cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return new Set(out.split("\0").filter(Boolean));
  } catch {
    return null; // not a repository, or git refused — reported, never guessed
  }
}

function judgeArtefact({ root, spec, tracked, contact }) {
  const abs = path.join(root, spec.path);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    return { path: spec.path, class: CLASSES.MISSING, detail: "no such file", findings: [], handInputs: null };
  }
  const text = fs.readFileSync(abs, "utf8");
  const findings = [];

  if (spec.must.includes("nonEmpty") && text.trim().length === 0) findings.push({ kind: "empty" });
  if (spec.must.includes("submits") && !/fetch\(|action\s*=|onsubmit|addEventListener\(\s*['"]submit/i.test(text)) {
    findings.push({ kind: "no-submit", detail: "a form a visitor fills that sends nowhere" });
  }
  if (spec.must.includes("money") && !/\$\s?\d/.test(text)) findings.push({ kind: "no-figure" });
  if (spec.must.includes("contact")) findings.push(...contactFindings(text, contact));

  const inputs = handInputs(text, spec.kind);
  const isTracked = tracked ? tracked.has(spec.path.split(path.sep).join("/")) : null;

  if (findings.length) {
    return { path: spec.path, class: CLASSES.UNUSABLE, detail: findings.map((f) => f.kind).join(", "), findings, handInputs: inputs, tracked: isTracked };
  }
  if (isTracked === false) {
    return {
      path: spec.path, class: CLASSES.UNTRACKED, findings, handInputs: inputs, tracked: false,
      detail: "real on this disk, absent from the shared line — a clone of this repository cannot produce it",
    };
  }
  return { path: spec.path, class: CLASSES.PRESENT, detail: "", findings, handInputs: inputs, tracked: isTracked };
}

export function resolveYesPath({ root, steps = STEPS } = {}) {
  const base = root || process.cwd();
  const tracked = trackedSet(base);
  const contact = canonicalContact({ root: base });

  const resolved = steps.map((step) => {
    const artefacts = step.artefacts.map((spec) => judgeArtefact({ root: base, spec, tracked, contact }));
    const cls = artefacts.reduce((acc, a) => better(acc, a.class), CLASSES.MISSING);
    return {
      id: step.id, name: step.name,
      class: cls,
      manualByDesign: Boolean(step.manual),
      manualBecause: step.manual ? step.manual.because : null,
      artefacts,
      blocks: null, // filled below, once the whole path is known
    };
  });

  // What a broken step actually costs is the steps BELOW it, so say those.
  for (let i = 0; i < resolved.length; i += 1) {
    if (resolved[i].class === CLASSES.PRESENT) continue;
    resolved[i].blocks = resolved.slice(i + 1).map((s) => s.id);
  }

  const count = (c) => resolved.filter((s) => s.class === c).length;
  const firstGap = resolved.find((s) => s.class !== CLASSES.PRESENT) || null;

  return {
    schema: YES_PATH_SCHEMA,
    trackedReadable: tracked !== null,
    contact,
    steps: resolved,
    summary: {
      total: resolved.length,
      present: count(CLASSES.PRESENT),
      untracked: count(CLASSES.UNTRACKED),
      unusable: count(CLASSES.UNUSABLE),
      missing: count(CLASSES.MISSING),
      manualByDesign: resolved.filter((s) => s.manualByDesign).length,
      firstGap: firstGap ? firstGap.id : null,
      complete: resolved.every((s) => s.class === CLASSES.PRESENT),
    },
  };
}

export function statementFor(result) {
  const s = result.summary;
  if (s.complete) return `the yes-path resolves end to end: ${s.total} steps, every one backed by a carried artefact`;
  const gap = result.steps.find((x) => x.id === s.firstGap);
  return (
    `the yes-path breaks at "${gap.name}" (${gap.class}) — ${s.present}/${s.total} steps carried, ` +
    `${s.untracked} on one machine only, ${s.unusable} carried but wrong, ${s.missing} absent; ` +
    `it blocks ${gap.blocks.length} step(s) below it`
  );
}

// ARIA Forums — MODERATOR: local, $0, reversible content classifier.
// -----------------------------------------------------------------------------------------------
// No external toxicity API. Wordlist + regex + leetspeak/obfuscation normalization + severity tiers,
// all driven by the admin-editable assets/forums-wordlist.json. Everything the moderator does is
// REVERSIBLE and audited — it never hard-deletes:
//   Tier 1 (slurs / hate / explicit / targeted harassment / spam) -> action "soft_remove"
//           (the store hides the body behind a placeholder; original is retained for appeal + reversal).
//   Tier 2 (profanity / insults / anger)                          -> action "flag" (human-review queue).
//           A curse INSIDE a genuine help post ("my damn printer won't print") is venting, not abuse —
//           mild words in `allowContext` are never flagged, and profanity is FLAGGED, never removed,
//           so we never destroy the question.
//   Tier 3 (doxxing / personal data)                              -> action "redact" (mask the PII, keep the post).
//
// Pure + dependency-free: runs in the browser, in Node tests, and (via dynamic import) inside the
// CommonJS forums-threads handler and the concierge cron. Rule 14: transparent + honest — removed
// content shows a placeholder, never a silent deletion.

import { createRequire } from "node:module";
// createRequire loads JSON in every Node version (no version-fragile import attributes) and esbuild
// bundles it fine. The wordlist stays the single editable source of truth (assets/forums-wordlist.json).
const WORDLIST = createRequire(import.meta.url)("./forums-wordlist.json");

// ---- normalization -----------------------------------------------------------------------------
// Map common leetspeak / homoglyph substitutions back to letters so f0ck, sh!t, n1gger are caught.
const LEET = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i", "|": "l", "€": "e" };
function deleet(s) { return s.replace(/[013457@$!|€]/g, (c) => LEET[c] || c); }

/** Lowercased, leetspeak-folded copy for word matching. */
function normalize(text) {
  return deleet(String(text || "").toLowerCase());
}
/** A second copy with letter separators collapsed so "f u c k" / "f.u.c.k" / "f-u-c-k" match too. */
function collapse(text) {
  // remove separators sitting BETWEEN single letters (spaces, dots, dashes, underscores, stars)
  return normalize(text).replace(/([a-z])[\s._*\-]+(?=[a-z]\b|[a-z][\s._*\-])/g, "$1");
}

function anyMatch(patterns, haystacks) {
  const hits = [];
  for (const p of patterns || []) {
    let re;
    try { re = new RegExp(p, "i"); } catch { continue; }
    if (haystacks.some((h) => re.test(h))) hits.push(p);
  }
  return hits;
}

// ---- doxxing / personal-data patterns (Tier 3) -------------------------------------------------
const DOX = [
  { re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, label: "email" },
  { re: /\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, label: "phone" },
  { re: /\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/g, label: "ssn/sin" },
  { re: /\b\d{1,5}\s+[A-Za-z0-9.\s]{2,40}\s(street|st|ave|avenue|road|rd|blvd|boulevard|drive|dr|court|crt|lane|ln|way|crescent|cres)\b/gi, label: "address" },
  { re: /\b(?:\d[ -]?){13,16}\b/g, label: "card" }
];

/** Redact any personal data found; returns { text, labels[] }. Never throws.
 *  NOTE: build a FRESH regex per call — the module-level DOX patterns carry the `g` flag, so reusing
 *  them with .test()/.replace() would leak `lastIndex` state across invocations (a warm serverless
 *  function would then miss PII on the 2nd+ post). Fresh regex = lastIndex 0 every time. */
export function redactDoxxing(text) {
  let out = String(text == null ? "" : text);
  const labels = [];
  for (const d of DOX) {
    const re = new RegExp(d.re.source, d.re.flags);
    if (re.test(out)) {
      labels.push(d.label);
      out = out.replace(new RegExp(d.re.source, d.re.flags), "[redacted]");
    }
  }
  return { text: out, labels: [...new Set(labels)] };
}

export const PLACEHOLDER = "Removed by ARIA moderator — this post violated the community guidelines. The original is retained for review and the action is reversible.";

/**
 * Classify a piece of user content. Pure — no I/O, no store writes.
 * @param {string} text   the post/thread body
 * @param {object} [opts] { list } to inject a custom wordlist (defaults to forums-wordlist.json)
 * @returns {{tier:0|1|2|3, action:'allow'|'soft_remove'|'flag'|'redact', reasons:string[], matched:string[], redactedText:(string|null), placeholder:(string|null)}}
 */
export function moderate(text, opts = {}) {
  const list = opts.list || WORDLIST;
  const raw = String(text == null ? "" : text);
  const norm = normalize(raw);
  const coll = collapse(raw);
  const hay = [norm, coll];
  const t1 = list.tier1 || {};
  const t2 = list.tier2 || {};

  // Tier 1 — soft-remove (reversible). Slurs / hate / explicit / targeted harassment / spam.
  const t1hits = [
    ...anyMatch(t1.slurs, hay).map((m) => `slur:${m}`),
    ...anyMatch(t1.hate, hay).map((m) => `hate:${m}`),
    ...anyMatch(t1.explicit, hay).map((m) => `explicit:${m}`),
    ...anyMatch(t1.spam, [raw.toLowerCase(), norm]).map((m) => `spam:${m}`)
  ];
  if (t1hits.length) {
    return { tier: 1, action: "soft_remove", reasons: ["tier-1 content — soft-removed for review"], matched: t1hits, redactedText: null, placeholder: PLACEHOLDER };
  }

  // Tier 3 — doxxing / personal data -> redact, keep the post.
  const dox = redactDoxxing(raw);
  if (dox.labels.length) {
    return { tier: 3, action: "redact", reasons: dox.labels.map((l) => `personal-data:${l}`), matched: dox.labels, redactedText: dox.text, placeholder: null };
  }

  // allowContext — mild venting inside a real help post is NOT abuse. Never flag these.
  const allow = anyMatch(list.allowContext, hay);

  // Tier 2 — flag (human review). Profanity / insults / anger. KEEP the post — never remove.
  const t2hits = [
    ...anyMatch(t2.profanity, hay).map((m) => `profanity:${m}`),
    ...anyMatch(t2.insults, hay).map((m) => `insult:${m}`)
  ];
  if (t2hits.length) {
    return { tier: 2, action: "flag", reasons: ["tier-2 content — flagged for a human to review (post kept)"], matched: t2hits, redactedText: null, placeholder: null };
  }

  // Nothing actionable (mild venting or clean) -> allow.
  return { tier: 0, action: "allow", reasons: allow.length ? ["mild venting — allowed (kept)"] : ["clean"], matched: allow, redactedText: null, placeholder: null };
}

// Convenience for the audit trail — a compact, PII-free reason string.
export function auditReason(verdict) {
  return `tier-${verdict.tier} ${verdict.action}: ${(verdict.matched || []).slice(0, 4).join(", ") || "n/a"}`;
}

/**
 * Apply a verdict to a stored post IN PLACE (single source of truth for both the post-create hook and
 * the cron sweep). Reversible by design: tier-1 keeps the original body (the store hides it behind a
 * placeholder), tier-3 redacts the PII, tier-2 only flags. `cfg` gates each tier via an admin toggle
 * (a tier set to false is skipped). NEVER hard-deletes. Returns the action actually applied.
 * @param {object} post    stored post { body, ts, ... }
 * @param {object} verdict result of moderate()
 * @param {object} [cfg]   { tier1?:boolean, tier2?:boolean, tier3?:boolean } — default: all enabled
 * @returns {'allow'|'soft_remove'|'flag'|'redact'}
 */
export function applyVerdict(post, verdict, cfg = {}) {
  const on = (t) => cfg[t] !== false; // default: every tier enabled
  if (!post || !verdict || verdict.action === "allow") return "allow";
  if (verdict.action === "soft_remove" && on("tier1")) {
    post.removed = true;
    post.removedReason = verdict.placeholder || PLACEHOLDER;
    post.moderation = { tier: 1, action: "soft_remove", at: post.ts };
    return "soft_remove";
  }
  if (verdict.action === "redact" && on("tier3")) {
    if (verdict.redactedText != null) post.body = verdict.redactedText;
    post.moderation = { tier: 3, action: "redact", at: post.ts };
    return "redact";
  }
  if (verdict.action === "flag" && on("tier2")) {
    post.flagged = true;
    post.moderation = { tier: 2, action: "flag", at: post.ts };
    return "flag";
  }
  return "allow";
}

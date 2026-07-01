// RUN-B B3 — HONEST TRUST/SECURITY SURFACE (the moat, $0).
// Single source of truth for what ARIA IS and is NOT. Consumed by the in-app Compliance tab, the web
// Trust Center, and the buyer-facing "How ARIA measures itself" explainer. Pure + node-safe (no electron).
//
// Rule 14: every claim here is TRUE and verifiable against a shipped module/test. We publish what we are
// NOT (no cert we don't hold) and how each buyer metric is really computed (real-or-empty). The honesty
// itself is the moat — nothing here is seeded, inflated, or aspirational. An over-claim guard
// (findOverclaims/assertNoOverclaim) lets tests LOCK the surface so a future edit can't silently claim a
// certification we don't have.

import { DEFAULT_HOURLY_RATE, DEFAULT_MINUTES_PER_FIX, computeRoi } from "./roi.mjs";
import { deflectionStats } from "./resolution-outcome.mjs";

export const TRUST_POSTURE_SCHEMA = "trust-posture.v1";

// --- R11 / privacy scrub: never let a private path leak into a buyer-facing surface. ---
export function scrubField(value) {
  if (value == null) return value;
  return String(value)
    .replace(/([A-Za-z]:\\|\/)[^\s"']*[Pp]rivate\s+pics\s+and\s+[Vv]ids[^\s"']*/g, "[private]")
    .replace(/[A-Za-z]:\\Users\\[^\\/\s"']+/g, "[user]")
    .replace(/\/(?:home|Users)\/[^/\s"']+/g, "[user]");
}

// --- Over-claim guard. Banned = AFFIRMATIVE certification/absolute-security claims. Negation-aware so an
// honest "not SOC 2 certified" never trips it. ---
export const OVERCLAIM_PHRASES = [
  "soc 2 certified", "soc2 certified", "iso 27001 certified", "iso27001 certified",
  "hipaa certified", "hipaa compliant", "pci certified", "pci-dss certified", "pci dss certified",
  "fedramp certified", "fedramp authorized", "gdpr certified", "independently audited",
  "third-party audited", "third party audited", "100% secure", "completely secure", "unhackable",
  "fully compliant", "government-certified", "government certified", "bank-grade certified"
];
const NEGATION_CUES = ["not ", "never", "no ", "n't", "without", "isn", "aren", "non-", "not-", "no-"];

export function findOverclaims(text = "") {
  const low = String(text || "").toLowerCase();
  const hits = [];
  for (const phrase of OVERCLAIM_PHRASES) {
    let i = low.indexOf(phrase);
    while (i !== -1) {
      const before = low.slice(Math.max(0, i - 28), i);
      const negated = NEGATION_CUES.some((n) => before.includes(n));
      if (!negated) hits.push(phrase);
      i = low.indexOf(phrase, i + phrase.length);
    }
  }
  return [...new Set(hits)];
}
export function assertNoOverclaim(text = "") {
  const hits = findOverclaims(text);
  if (hits.length) throw new Error("trust-posture over-claim(s) found: " + hits.join(" | "));
  return true;
}

// --- Certifications held: NONE. Real-or-empty — the empty list IS the honest answer. ---
export const HELD_CERTIFICATIONS = []; // never add one we don't independently, currently hold
export const SELF_ASSESSED_FRAMEWORKS = ["SOC 2", "HIPAA", "PIPEDA", "GDPR"];

export function certificationPosture() {
  return {
    heldCertifications: HELD_CERTIFICATIONS.slice(),
    independentlyCertified: HELD_CERTIFICATIONS.length > 0, // false — and we say so plainly
    selfAssessedFrameworks: SELF_ASSESSED_FRAMEWORKS.slice(),
    are: [
      "Local-first: diagnostics, fixes, outcomes, and the audit log stay on the device.",
      "Read-only first — never autonomous on a write; every change is dry-run then human-confirmed.",
      "Self-assessed against SOC 2, HIPAA, PIPEDA, and GDPR control sets, gaps published."
    ],
    areNot: [
      "Independently certified: no — not SOC 2, ISO 27001, HIPAA, PCI-DSS, or FedRAMP.",
      "Audited by a third party: no.",
      "A claim of legal compliance on your behalf: no — you own your regulatory posture."
    ],
    statement:
      "Integrated IT Support Inc. / ARIA holds no independent security certification. We are not SOC 2-, " +
      "ISO 27001-, HIPAA-, PCI-DSS-, or FedRAMP-certified. We self-assess against SOC 2, HIPAA, PIPEDA, and " +
      "GDPR control sets and publish the gaps. Self-assessment is not an audit — and we say so on every surface."
  };
}

// --- Data residency: what stays local vs the ONLY things that leave (all content-blind). ---
export function dataResidency() {
  return {
    staysLocal: [
      "Knowledge base + diagnostics",
      "Applied fixes, recipes, and dry-run previews",
      "Hash-chained, tamper-evident audit log",
      "\"Was this fixed?\" outcomes + ROI counts",
      "Settings and preferences"
    ],
    leavesDevice: [
      { what: "License validation", why: "activate/verify your license", contains: "license key only (no content)", verifiableBy: "6-host allowlist" },
      { what: "Resolution / session email (opt-in)", why: "email a resolution or session report to you + integrateditsupp@gmail.com", contains: "issue title + ticket ref (path-scrubbed) — no file contents", verifiableBy: "content-leak.test.mjs" },
      { what: "Update check", why: "check for a signed app update", contains: "version only", verifiableBy: "update-manifest.test.mjs" },
      { what: "Heartbeat (content-blind)", why: "liveness only", contains: "status flags only — never file contents", verifiableBy: "heartbeat-payload-content-blind.test.mjs" }
    ]
  };
}

// --- Security controls: each maps to a REAL shipped module/test (the test asserts the file exists). ---
export function securityControls() {
  return [
    { id: "kill-switch", claim: "Instant human kill-switch halts every ARIA action (hotkey + tray).", verifiableBy: "tests/kill-switch.test.mjs" },
    { id: "dry-run-first", claim: "Every fix is dry-run then human-confirmed — never autonomous on a write.", verifiableBy: "tests/dry-run-policy.test.mjs" },
    { id: "tamper-evident-audit", claim: "Actions are recorded in a hash-chained, tamper-evident log you can export.", verifiableBy: "src/shared/audit-integrity.mjs" },
    { id: "no-external-ai", claim: "Answers come from a local knowledge-base brain — no external/cloud LLM call; no prompt leaves the device.", verifiableBy: "tests/heartbeat-payload-content-blind.test.mjs" },
    { id: "content-blind-telemetry", claim: "Telemetry is content-blind — file contents never leave the device.", verifiableBy: "tests/content-leak.test.mjs" },
    { id: "r11-private-folder", claim: "A hard rule blocks ARIA from ever reading your private folder (enforced at 0 accesses).", verifiableBy: "tests/private-folder-never-touched.test.mjs" },
    { id: "least-privilege-admin", claim: "Admin actions require an environment-only token; no elevation is baked into the build.", verifiableBy: "tests/admin-build-gate.test.mjs" },
    { id: "destructive-triple-confirm", claim: "Destructive / delete actions require an explicit triple confirmation.", verifiableBy: "tests/delete-triple-confirm.test.mjs" }
  ];
}

// --- "How ARIA measures itself": each buyer metric's REAL formula + its real-or-empty rule. The ROI line
// literally interpolates the real roi.mjs constants so the copy can never drift from the code. ---
export function howAriaMeasuresItself() {
  return [
    {
      metric: "Deflection % (first-touch resolution)",
      formula: "resolved ÷ conversations",
      countsOnlyFrom: "real \"Was this fixed? (yes / not yet)\" outcomes",
      emptyState: "shows \"—\" until a real conversation exists",
      gameProof: "deduped per session; the numerator moves only on a real resolved outcome",
      source: "resolution-outcome.mjs → deflectionStats (local audit log)"
    },
    {
      metric: "ROI — hours & dollars saved",
      formula: "fixes × " + DEFAULT_MINUTES_PER_FIX + " min ÷ 60 × $" + DEFAULT_HOURLY_RATE + "/hr",
      countsOnlyFrom: "real applied + verified fixes (audit-log RUN count)",
      emptyState: "$0 / 0h until a real fix",
      gameProof: "fix count floored ≥ 0; no seeded values; rate & minutes are configurable",
      source: "roi.mjs → computeRoi (local audit count)"
    },
    {
      metric: "AI accuracy",
      formula: "correct ÷ evaluated on the real test corpus",
      countsOnlyFrom: "real classifier evaluation",
      emptyState: "shows \"—\" until measured — never a vanity 99.x%",
      gameProof: "nulled at source (RUN-A A1) so no hardcoded accuracy can appear",
      source: "classifier tests + real KB matches"
    },
    {
      metric: "Uptime / MTTR",
      formula: "measured from real SLA detections + downtime windows",
      countsOnlyFrom: "real SLA events",
      emptyState: "real-or-empty — no fabricated 100%",
      gameProof: "RUN-A A1 removed the hardcoded 100s",
      source: "sla.mjs (local SLA state)"
    }
  ];
}

// --- CAIQ/SIG-style self-assessment: the questions a security-conscious SMB buyer actually asks. ---
export function selfAssessment() {
  return [
    { id: "data-location", q: "Where does my data live?", a: "On the device. Diagnostics, fixes, outcomes, and the audit log are stored locally (~/.aria-sentinel). Only four things ever leave (see Data residency) — all content-blind." },
    { id: "external-ai", q: "Do you send my data to a cloud AI or train models on it?", a: "No. ARIA answers from a local knowledge-base brain. No external/cloud LLM call is made and no prompt or file content leaves the device." },
    { id: "file-access", q: "Can ARIA read my personal files?", a: "No. ARIA is content-blind by design, dry-runs first, and a hard rule (R11) blocks the private folder entirely — enforced at 0 accesses." },
    { id: "stop-it", q: "Can I stop it instantly?", a: "Yes. A human kill-switch (hotkey + tray) halts every ARIA action immediately." },
    { id: "audit-trail", q: "Is there an audit trail?", a: "Yes — a tamper-evident, hash-chained log of every action, exportable for your own review or an auditor." },
    { id: "certifications", q: "What are you certified for?", a: "Nothing independently — we hold no third-party certification. We self-assess against SOC 2, HIPAA, PIPEDA, and GDPR controls and publish the gaps. We tell you this plainly rather than imply a cert we don't have." },
    { id: "uninstall", q: "What happens to my data if I uninstall?", a: "Local data is removed with the app. There is no server-side copy to delete because we never collected your content." }
  ];
}

export const MEASUREMENT_PRINCIPLE =
  "Real-or-empty: every metric is null until a real event produces it. A blank “—” is deliberate " +
  "— we would rather show nothing than a number we cannot defend. That honesty is the moat.";

// --- Assemble the buyer-facing summary. Real-or-empty: live numbers stay null until real events feed them. ---
export function buildTrustSummary({ resolutionEvents = [], fixes = null } = {}) {
  const stats = deflectionStats(Array.isArray(resolutionEvents) ? resolutionEvents : []);
  const hasFixes = Number.isFinite(fixes) && fixes > 0;
  const roi = computeRoi({ fixes: hasFixes ? fixes : 0 });
  return {
    schema: TRUST_POSTURE_SCHEMA,
    certification: certificationPosture(),
    dataResidency: dataResidency(),
    securityControls: securityControls(),
    howMeasured: howAriaMeasuresItself(),
    selfAssessment: selfAssessment(),
    principle: MEASUREMENT_PRINCIPLE,
    live: {
      deflectionPct: stats.deflectionPct,          // null until a real conversation
      conversations: stats.sample,                 // "out of how many?"
      hoursSaved: hasFixes ? roi.hoursSaved : null, // real-or-empty
      dollarsSaved: hasFixes ? roi.dollarsSaved : null
    },
    verify: "In-app: Settings → Compliance → Export audit log (tamper-evident hash chain). Every number here traces to a local event."
  };
}

// --- One flat text blob of every human-readable string — so a single over-claim scan covers the whole
// surface regardless of how any given UI renders it. ---
export function trustPostureText(summary = buildTrustSummary()) {
  const parts = [];
  const c = summary.certification || {};
  parts.push(c.statement || "");
  (c.are || []).forEach((s) => parts.push(s));
  (c.areNot || []).forEach((s) => parts.push(s));
  (summary.dataResidency?.staysLocal || []).forEach((s) => parts.push(s));
  (summary.dataResidency?.leavesDevice || []).forEach((o) => parts.push([o.what, o.why, o.contains].join(" ")));
  (summary.securityControls || []).forEach((o) => parts.push(o.claim));
  (summary.howMeasured || []).forEach((o) => parts.push([o.metric, o.formula, o.countsOnlyFrom, o.emptyState, o.gameProof].join(" ")));
  (summary.selfAssessment || []).forEach((o) => parts.push(o.q + " " + o.a));
  parts.push(summary.principle || "");
  return scrubField(parts.join("\n"));
}

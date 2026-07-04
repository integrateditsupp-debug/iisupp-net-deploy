import { deflectionStats } from "./resolution-outcome.mjs";

export function buildTrustSummary({ resolutionEvents = [], fixes = 0, auditOk = null, privacyOk = true } = {}) {
  const stats = deflectionStats(resolutionEvents);
  const realFixes = Math.max(0, Math.floor(Number(fixes) || 0));
  return {
    measured: true,
    auditIntegrity: auditOk === null ? "not-checked" : auditOk ? "ok" : "attention",
    privacy: privacyOk ? "local-first" : "attention",
    claims: [
      "No fabricated success metrics.",
      "Resolution proof is real-or-empty.",
      "Automation remains gated by policy and supervisor checks."
    ],
    metrics: {
      fixes: realFixes,
      conversations: stats.conversations,
      deflectionPct: stats.deflectionPct
    },
    caveats: stats.conversations || realFixes ? [] : ["No measured customer outcomes yet."]
  };
}

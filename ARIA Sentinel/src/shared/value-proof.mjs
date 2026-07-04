import { deflectionStats } from "./resolution-outcome.mjs";

export const L1_MINUTES_PER_FIX = 47;
export const L1_DOLLARS_PER_FIX = 50;

function money(fixes) {
  return fixes > 0 ? fixes * L1_DOLLARS_PER_FIX : null;
}

function hours(fixes) {
  return fixes > 0 ? Math.round(((fixes * L1_MINUTES_PER_FIX) / 60) * 10) / 10 : null;
}

export function valueProof({ fixes = 0, outcomeEvents = [] } = {}) {
  const realFixes = Math.max(0, Math.floor(Number(fixes) || 0));
  const stats = deflectionStats(outcomeEvents);
  return {
    measured: true,
    fixes: realFixes,
    resolved: stats.resolved,
    conversations: stats.conversations,
    deflectionPct: stats.deflectionPct,
    hoursSaved: hours(realFixes),
    dollarsSaved: money(realFixes),
    note: realFixes || stats.conversations ? "Measured from local audit and outcome records." : "No measured outcomes yet."
  };
}

export function valueProofKpis(input = {}) {
  const proof = valueProof(input);
  return {
    hoursSaved: proof.hoursSaved,
    dollarsSaved: proof.dollarsSaved,
    deflectionPct: proof.deflectionPct,
    resolved: proof.resolved,
    conversations: proof.conversations
  };
}

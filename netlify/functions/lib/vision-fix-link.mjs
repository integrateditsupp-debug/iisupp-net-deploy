// vision-fix-link.mjs — bridge a diagnosis to the EXISTING gated one-click fix flow.
// ---------------------------------------------------------------------------------
// We do NOT execute anything here. We only match the diagnosis to a vetted recipe and hand the
// client the coordinates to request a signed audit token from aria-guided-fix (?action=audit).
// That flow already enforces: restore point / kill-switch / risk gate (black+red blocked) / HMAC
// audit token / append-only session log. Reusing it keeps STAGE-2 inside the proven safety rails.
//
// riskOverall vocabulary (from aria-recipes-data.mjs): green=safe info, yellow=safe diagnostic,
// orange=repair w/ consent+log, red=admin only, black=never.

const AUDIT_ENDPOINT = '/.netlify/functions/aria-guided-fix?action=audit';
const MATCH_ENDPOINT = '/.netlify/functions/aria-guided-fix?action=match';

// matchFix(issueText, os, RECIPES) → best recipe descriptor (no command text, no execution) or null.
// RECIPES is injected so this stays a pure function that tests can exercise with the real library.
export function matchFix(issueText, os = 'windows', RECIPES = []) {
  const issue = String(issueText || '').toLowerCase().trim();
  if (issue.length < 3 || !Array.isArray(RECIPES) || !RECIPES.length) return null;
  os = String(os || 'windows').toLowerCase();

  const matches = [];
  for (const r of RECIPES) {
    if (!Array.isArray(r.os) || !r.os.includes(os)) continue;
    let score = 0;
    for (const kw of (r.matchKeywords || [])) {
      if (issue.includes(String(kw).toLowerCase())) { score += 10; break; }
    }
    for (const pat of (r.matchPatterns || [])) {
      try { if (new RegExp(pat, 'i').test(issue)) score += 5; } catch { /* ignore bad pattern */ }
    }
    const issueTokens = new Set(issue.split(/\W+/).filter(t => t.length > 2));
    for (const t of String(r.title || '').toLowerCase().split(/\W+/).filter(t => t.length > 2)) {
      if (issueTokens.has(t)) score += 1;
    }
    if (score > 0) matches.push({ r, score });
  }
  if (!matches.length) return null;
  matches.sort((a, b) => b.score - a.score);
  const best = matches[0].r;

  return {
    recipeId: best.id,
    title: best.title,
    category: best.category,
    riskOverall: best.riskOverall || 'yellow',
    // Anything above a safe diagnostic requires explicit confirm in the client before the token
    // request; red/black are never offered as one-click (the audit endpoint also blocks them).
    requiresConsent: !['green', 'yellow'].includes(best.riskOverall),
    oneClickEligible: !['red', 'black'].includes(best.riskOverall),
    firstStepId: (best.fixSteps && best.fixSteps[0] && best.fixSteps[0].id) || null,
    auditEndpoint: AUDIT_ENDPOINT,
    matchEndpoint: MATCH_ENDPOINT,
    // Spec Stage-3 / B5 tie-in. The confirmation SENTENCE is NOT built here and NOT built by the
    // widget — it comes from the shared B5 builder (globe-confirmation / ariaGlobeConfirmation),
    // which enforces real-or-empty: it renders only on a genuinely completed AND verified resolve
    // that carries a REAL ticket ref, and never claims an email was sent unless one really was.
    // We only declare the contract the client must satisfy before it may show anything (Rule 14).
    resolvedConfirmation: {
      builder: 'ariaGlobeConfirmation.build',
      clientApi: 'ARIAVisionDiagnose.mount(...).reportResolved',
      requires: ['completed', 'verified', 'ticketRef'],
      neverFabricated: true,
    },
  };
}

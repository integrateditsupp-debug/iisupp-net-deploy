// autonomous — the opt-in gate + the runtime safety guards for Autonomous mode. PURE so the rules
// are unit-testable and identical wherever they run. Autonomous lets ARIA auto-apply GREEN recipes
// without asking; yellow always confirms (enforced in recipe-runner) and these guards add three more
// brakes so an autonomous endpoint can never run away:
//   • per-recipe cap: the SAME recipe auto-fires at most 3× / 24h / endpoint (4th → fall back to confirm)
//   • cooldown: at least 30 min between ANY two auto-fires on one endpoint
//   • fleet rate-limit: if >5% of the fleet attempted a recipe in 60 min, the control plane disables it

export const PER_RECIPE_CAP = 3;
export const CAP_WINDOW_MS = 24 * 60 * 60 * 1000;
export const COOLDOWN_MS = 30 * 60 * 1000;
export const FLEET_PCT_LIMIT = 5;       // percent
export const FLEET_WINDOW_MS = 60 * 60 * 1000;

// Opt-in: Autonomous can NEVER be enabled silently. The modal must return understood === true
// (the "I understand" checkbox). Anything else is refused.
export function canEnableAutonomous(optIn = {}) {
  return optIn.understood === true;
}

/**
 * Decide whether a green recipe may auto-fire right now on an endpoint.
 * @param {object} args {
 *   recipeId, tier ('green'|'yellow'|...), mode, now,
 *   history: [{recipeId, ts}]   recent auto-fires on THIS endpoint,
 *   fleet:   {attempts, total}  fleet attempts for THIS recipe in the last hour
 * }
 * @returns {{allow:boolean, reason:string, fallback:string}}
 */
export function evaluateAutoFire(args = {}) {
  const { recipeId, tier, mode, now = Date.now() } = args;
  const history = Array.isArray(args.history) ? args.history : [];
  const fleet = args.fleet || null;

  if (mode !== "autonomous") return deny("not-autonomous", "manual");
  if (tier !== "green") return deny("non-green-needs-confirm", "confirmed"); // yellow/red never auto-fire

  // Cooldown: any auto-fire on this endpoint within COOLDOWN_MS blocks the next.
  const lastAny = history.reduce((m, h) => Math.max(m, Number(h.ts) || 0), 0);
  if (lastAny && now - lastAny < COOLDOWN_MS) return deny("cooldown", "confirmed");

  // Per-recipe cap in the rolling 24h window.
  const recent = history.filter((h) => h.recipeId === recipeId && now - (Number(h.ts) || 0) < CAP_WINDOW_MS);
  if (recent.length >= PER_RECIPE_CAP) return deny("per-recipe-cap", "confirmed");

  // Fleet rate-limit (control-plane signal).
  if (fleetRateLimited(fleet)) return deny("fleet-rate-limit", "confirmed");

  return { allow: true, reason: "ok", fallback: null };
}

function deny(reason, fallback) {
  return { allow: false, reason, fallback };
}

// True when more than FLEET_PCT_LIMIT % of the fleet attempted the recipe in the window.
export function fleetRateLimited(fleet) {
  if (!fleet) return false;
  const total = Number(fleet.total) || 0;
  const attempts = Number(fleet.attempts) || 0;
  if (total <= 0) return false;
  return (attempts / total) * 100 > FLEET_PCT_LIMIT;
}

// Append an auto-fire to an endpoint's history, pruning anything older than the cap window.
export function recordAutoFire(history, entry, now = Date.now()) {
  const next = (Array.isArray(history) ? history : []).filter((h) => now - (Number(h.ts) || 0) < CAP_WINDOW_MS);
  next.push({ recipeId: entry.recipeId, ts: Number(entry.ts) || now });
  return next;
}

// Parse a pause request from the UI ([1h / 24h / until I re-enable]) into an epoch ms (0 = until re-enable).
export function autonomousPauseUntil(choice, now = Date.now()) {
  if (choice === "1h") return now + 60 * 60 * 1000;
  if (choice === "24h") return now + 24 * 60 * 60 * 1000;
  return Number.MAX_SAFE_INTEGER; // "until I re-enable" — paused indefinitely
}

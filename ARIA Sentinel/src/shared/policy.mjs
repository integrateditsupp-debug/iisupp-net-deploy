// policy — strict parser for a customer policy overlay.
//
// THE PARSER IS THE GATE. A customer KB / policy file is DATA, never INSTRUCTIONS. It can
// only ever narrow behaviour (disable recipes, tighten thresholds, set hours/contacts).
// It can NEVER widen the allow-list: any key outside the fixed schema is silently dropped,
// so an injected {exec_command}, {ALLOWED_ACTIONS}, <script>, or prototype-pollution
// payload simply does not exist in the parsed result. Allowed actions stay code-defined.
import { RECIPES } from "./recipes.mjs";
import { recipes as TIER0_CATALOG } from "../main/recipes/tier-0/catalog.mjs";

// PROD 2026-10-14 (audit M25) — the Tier-0 catalog ids + the 5 executor bindings (and their aliases) can be disabled by
// policy too; they used to be silently dropped because only the registry ids were "real" here.
const TIER0_EXECUTOR_BINDINGS = ["restart-print-spooler", "restart-windows-update", "flush-dns-cache", "restart-bluetooth", "restart-audio", "restart-audio-service", "flush-dns"];
export const VALID_RECIPE_IDS = new Set([...RECIPES.map((r) => r.id), ...Object.keys(TIER0_CATALOG), ...TIER0_EXECUTOR_BINDINGS]);
const CONTACT_RE = /^[A-Za-z0-9 .,'_@+\-]{1,80}$/; // escalation contacts are short labels, not free text

const EMPTY_OVERLAY = Object.freeze({
  recipes_disabled: [],
  business_hours: null,
  confirmation_threshold: null,
  escalation_contacts: []
});

/**
 * Parse a JSON string (or object) into a PolicyOverlay. Never throws; on any problem it
 * returns the empty (no-op) overlay. The output is a fresh, prototype-clean object
 * containing ONLY the four whitelisted fields.
 */
export function parsePolicyOverlay(input) {
  let raw;
  try {
    raw = typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    return clone(EMPTY_OVERLAY);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return clone(EMPTY_OVERLAY);

  return {
    // Only ids that match a real, code-defined recipe survive. Unknown ids (e.g. a
    // smuggled "rm -rf" or "*" wildcard) are dropped — you cannot disable what isn't real,
    // and you certainly cannot ENABLE anything here.
    recipes_disabled: toArray(raw.recipes_disabled)
      .map((v) => String(v))
      .filter((id) => VALID_RECIPE_IDS.has(id)),
    business_hours: parseBusinessHours(raw.business_hours),
    confirmation_threshold: parseThreshold(raw.confirmation_threshold),
    escalation_contacts: toArray(raw.escalation_contacts)
      .map((v) => String(v).trim())
      .filter((v) => CONTACT_RE.test(v))
      .slice(0, 12)
  };
}

function parseBusinessHours(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const start = clampHour(value.start);
  const end = clampHour(value.end);
  const tz = typeof value.tz === "string" ? value.tz.replace(/[^A-Za-z0-9_/+\-]/g, "").slice(0, 40) : "";
  if (start == null || end == null) return null;
  return { start, end, tz };
}

function parseThreshold(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  // Confidence threshold is a 0..1 fraction. Clamp hard.
  return Math.min(1, Math.max(0, n));
}

function clampHour(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 23) return null;
  return n;
}

function toArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Returns true if a recipe is permitted under the overlay. The code-defined allow-list is
 * the floor; the overlay can only subtract from it.
 */
export function isRecipeAllowedByPolicy(overlay, recipeId) {
  if (!overlay) return true;
  return !overlay.recipes_disabled.includes(recipeId);
}

/**
 * PROD 2026-10-14 (audit M25) — the on-disk policy file an IT lead / MDM drops beside the app data
 * (~/.aria-sentinel/policy.json). Pure loader over an injected fs facade: unreadable / absent → the empty overlay
 * (no-op), with `source:"none"`; parsed through the same strict gate as the control-plane overlay.
 */
export const POLICY_FILE_NAME = "policy.json";
export function loadPolicyFile(filePath, fsFacade) {
  try {
    const raw = fsFacade.readFileSync(filePath, "utf8");
    const overlay = parsePolicyOverlay(raw);
    return { overlay, source: "file", present: true };
  } catch {
    return { overlay: parsePolicyOverlay(null), source: "none", present: false };
  }
}

// RUN 19 §4 — triple-confirm delete: the pure decision layer for irreversible-action gating.
// ANY delete (file, folder, recipe revert, KB entry purge) must clear a 3-step modal — UNLESS the user
// has opted out for that file-type, in which case it drops to a SINGLE confirmation (never silent).
//
// Side-effect free so it can be unit-tested without Electron; main.mjs persists the opt-outs to
// userData/delete-prefs.json and the renderer drives the modal from requiredSteps().

export const TRIPLE_STEPS = [
  { title: "Delete", confirm: "Delete", body: (name) => `Delete ${name}?` },
  { title: "Confirm", confirm: "Yes, delete", body: (name) => `Confirm: ${name} will be removed.` },
  { title: "Last chance", confirm: "Permanently delete", body: () => "Last chance — permanent removal." }
];

/** Lower-cased extension incl. the dot (".pdf"); "" when there is no extension (e.g. a folder). */
export function extOf(name) {
  const base = String(name || "").split(/[\\/]/).pop() || "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot).toLowerCase();
}

/** Normalize an opt-out key so ".PDF", "pdf" and ".pdf" all collapse to ".pdf". */
export function normalizeExt(ext) {
  let e = String(ext || "").trim().toLowerCase();
  if (!e) return "";
  if (!e.startsWith(".")) e = "." + e;
  return e;
}

/** Has the user opted this ext out of triple-confirm? */
export function isOptedOut(ext, prefs) {
  const key = normalizeExt(ext);
  if (!key) return false;
  const list = (prefs && Array.isArray(prefs.skipTripleFor)) ? prefs.skipTripleFor : [];
  return list.map(normalizeExt).includes(key);
}

/**
 * How many confirmation steps a delete needs.
 *  - opted-out ext  → 1 (single click of safety, never silent)
 *  - everything else → 3
 */
export function requiredSteps(name, prefs) {
  return isOptedOut(extOf(name), prefs) ? 1 : 3;
}

/** The step descriptor (1-based index into the active sequence) for a given delete. */
export function stepFor(name, prefs, index) {
  const total = requiredSteps(name, prefs);
  const seq = total === 1 ? [TRIPLE_STEPS[0]] : TRIPLE_STEPS;
  const i = Math.max(0, Math.min(index, seq.length - 1));
  return { ...seq[i], index: i, total: seq.length, last: i === seq.length - 1 };
}

/** Add an ext to the opt-out list (returns a new prefs object; never mutates the input). */
export function addOptOut(prefs, ext) {
  const key = normalizeExt(ext);
  const base = (prefs && Array.isArray(prefs.skipTripleFor)) ? prefs.skipTripleFor.map(normalizeExt) : [];
  if (!key || base.includes(key)) return { ...(prefs || {}), skipTripleFor: base };
  return { ...(prefs || {}), skipTripleFor: [...base, key] };
}

/** Empty the opt-out list ("Reset all delete confirmations"). */
export function resetOptOuts(prefs) {
  return { ...(prefs || {}), skipTripleFor: [] };
}

/** A safe default prefs object. */
export function emptyPrefs() {
  return { skipTripleFor: [] };
}

/** Coerce arbitrary disk JSON into a valid prefs shape (drops junk, dedupes, normalizes). */
export function normalizePrefs(raw) {
  const list = (raw && Array.isArray(raw.skipTripleFor)) ? raw.skipTripleFor : [];
  const seen = [];
  for (const e of list) {
    const k = normalizeExt(e);
    if (k && !seen.includes(k)) seen.push(k);
  }
  return { skipTripleFor: seen };
}

// audit-integrity — RUN 16 §H. Tamper-evident hash chain over the audit log so a session can detect
// if the on-disk log was edited, truncated, or had rows inserted, and alert the admin. PURE +
// dependency-free (node:crypto). Hashes only the symbolic audit fields — never raw user content.
import crypto from "node:crypto";

const GENESIS = "aria-audit-genesis-v1";

// Stable, field-ordered serialization of one entry (only the content-blind audit fields).
function serialize(entry) {
  return JSON.stringify({
    ts: entry && entry.ts ? String(entry.ts) : "",
    tag: entry && entry.tag ? String(entry.tag) : "",
    recipeId: entry && entry.recipeId ? String(entry.recipeId) : "",
    text: entry && entry.text ? String(entry.text) : ""
  });
}

export function entryHash(prevHash, entry) {
  return crypto.createHash("sha256").update(String(prevHash || GENESIS) + "|" + serialize(entry)).digest("hex");
}

// Seal a log: returns the per-entry chain + the final seal hash. Persist this alongside the log.
// `meta.appVersion` stamps the build that sealed it, so a later session can tell a legitimate version
// upgrade (re-seal, not tampering) apart from an off-app edit of the SAME version's log.
export function sealAudit(entries = [], meta = {}) {
  let h = GENESIS;
  const chain = [];
  for (const e of (Array.isArray(entries) ? entries : [])) { h = entryHash(h, e); chain.push(h); }
  return {
    v: "audit-seal-v2",
    count: chain.length,
    chain,
    seal: h,
    appVersion: meta.appVersion != null ? String(meta.appVersion) : null,
    sealedAt: meta.sealedAt != null ? String(meta.sealedAt) : null
  };
}

/**
 * Classify a session-start integrity check, distinguishing a benign VERSION UPGRADE (or a legacy
 * version-less seal) from a real SAME-VERSION tamper. Pure — main wires the store + alerts.
 *   no seal            → "baseline"        (first run; just seal)
 *   no/changed version → "version-changed" (an install/upgrade re-sealed the chain — NOT tampering)
 *   same version, ok   → "intact"
 *   same version, diff → "tampered"        (off-app edit of this build's log → alert)
 * Real tamper detection is preserved: a divergent chain under the SAME app version still alerts.
 */
export function classifyIntegrity(entries = [], sealed, currentVersion) {
  if (!sealed || !Array.isArray(sealed.chain)) return { status: "baseline", alertAdmin: false };
  const sealedVersion = sealed.appVersion != null ? String(sealed.appVersion) : null;
  const current = currentVersion != null ? String(currentVersion) : null;
  if (sealedVersion == null || (current != null && sealedVersion !== current)) {
    return { status: "version-changed", from: sealedVersion, to: current, alertAdmin: false };
  }
  const result = verifyAudit(entries, sealed);
  if (result.ok) return { status: "intact", alertAdmin: false };
  return { status: "tampered", reason: result.reason, brokenAt: result.brokenAt, alertAdmin: true };
}

// Verify a log against a prior seal. Detects modification (brokenAt = first divergent index),
// truncation / insertion (count mismatch), and a fully intact log (ok:true).
export function verifyAudit(entries = [], sealed = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const priorChain = Array.isArray(sealed.chain) ? sealed.chain : [];
  let h = GENESIS, brokenAt = -1;
  for (let i = 0; i < list.length; i++) {
    h = entryHash(h, list[i]);
    if (brokenAt === -1 && (i >= priorChain.length || h !== priorChain[i])) brokenAt = i;
  }
  const countMismatch = list.length !== (Number.isFinite(sealed.count) ? sealed.count : priorChain.length);
  const ok = brokenAt === -1 && !countMismatch;
  return {
    ok,
    tampered: !ok,
    brokenAt: ok ? -1 : (brokenAt === -1 ? Math.min(list.length, priorChain.length) : brokenAt),
    reason: ok ? "intact" : (countMismatch ? "row-count-changed" : "entry-modified"),
    alertAdmin: !ok
  };
}

export function assertIsoTimestamps(entries = []) {
  for (const e of (Array.isArray(entries) ? entries : [])) {
    const t = Date.parse(e && e.ts);
    if (!Number.isFinite(t)) return false;
    // ISO-8601 (not epoch-ms) — content-blind audit contract.
    if (!/^\d{4}-\d{2}-\d{2}T/.test(String(e.ts))) return false;
  }
  return true;
}

// Time-window query: entries with ts in [fromIso, toIso] inclusive.
export function entriesInWindow(entries = [], fromIso, toIso) {
  const from = Date.parse(fromIso), to = Date.parse(toIso);
  return (Array.isArray(entries) ? entries : []).filter((e) => {
    const t = Date.parse(e && e.ts);
    return Number.isFinite(t) && t >= from && t <= to;
  });
}

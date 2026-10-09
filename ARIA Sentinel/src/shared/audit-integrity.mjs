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
export function sealAudit(entries = []) {
  let h = GENESIS;
  const chain = [];
  for (const e of (Array.isArray(entries) ? entries : [])) { h = entryHash(h, e); chain.push(h); }
  return { v: "audit-seal-v1", count: chain.length, chain, seal: h };
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

// ── RUN-CU / CU4 (2026-10-08) — KEYED seal (audit P1 #9) ──────────────────────────────────────────────────
// The v1 seal above is an unkeyed SHA-256 chain with a public genesis, stored in the SAME electron-store file
// as the log: whoever can edit the log can recompute the seal. v2 is an HMAC chain under the per-install
// appHmacKey() (the same key that already seals update-state / sla-state), persisted in a SEPARATE file
// (userData/audit-seal.json). Both are kept: v1 for compatibility (and the existing tests), v2 as the one
// the startup verifier trusts. A non-empty log with NO seal at all is reported as tampered ("seal-missing"),
// never silently re-baselined.
const KEYED_GENESIS = "aria-audit-genesis-v2";

export function entryHmac(key, prevHash, entry) {
  return crypto.createHmac("sha256", String(key || "")).update(String(prevHash || KEYED_GENESIS) + "|" + serialize(entry)).digest("hex");
}

/** Seal a log under a key. Returns { v:"audit-seal-v2", count, chain, seal, keyId } — persist in its own file. */
export function sealAuditKeyed(entries = [], key) {
  let h = KEYED_GENESIS;
  const chain = [];
  for (const e of (Array.isArray(entries) ? entries : [])) { h = entryHmac(key, h, e); chain.push(h); }
  const keyId = crypto.createHash("sha256").update(String(key || "")).digest("hex").slice(0, 8);
  return { v: "audit-seal-v2", count: chain.length, chain, seal: h, keyId };
}

/**
 * Verify a log against a keyed seal. A missing seal with a NON-EMPTY log is tampered ("seal-missing");
 * an empty log with no seal is a fresh install (ok). A seal made under another key is "key-mismatch".
 */
export function verifyAuditKeyed(entries = [], sealed, key) {
  const list = Array.isArray(entries) ? entries : [];
  if (!sealed || !Array.isArray(sealed.chain)) {
    if (list.length === 0) return { ok: true, tampered: false, brokenAt: -1, reason: "fresh", alertAdmin: false };
    return { ok: false, tampered: true, brokenAt: 0, reason: "seal-missing", alertAdmin: true };
  }
  const keyId = crypto.createHash("sha256").update(String(key || "")).digest("hex").slice(0, 8);
  if (sealed.keyId && sealed.keyId !== keyId) return { ok: false, tampered: true, brokenAt: 0, reason: "key-mismatch", alertAdmin: true };
  let h = KEYED_GENESIS, brokenAt = -1;
  for (let i = 0; i < list.length; i++) {
    h = entryHmac(key, h, list[i]);
    if (brokenAt === -1 && (i >= sealed.chain.length || h !== sealed.chain[i])) brokenAt = i;
  }
  const countMismatch = list.length !== (Number.isFinite(sealed.count) ? sealed.count : sealed.chain.length);
  const ok = brokenAt === -1 && !countMismatch;
  return {
    ok,
    tampered: !ok,
    brokenAt: ok ? -1 : (brokenAt === -1 ? Math.min(list.length, sealed.chain.length) : brokenAt),
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

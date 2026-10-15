// Netlify function: aria-stop-codes — the live Windows stop-code (BSOD) index for ARIA Guided Fix and the
// ARIA Sentinel desktop agent (STOP_CODES_ENDPOINT).
//
// Content-blind: returns ONLY the public stop-code reference (code/hex/family/likelyCauses/firstSteps/
// escalation). { privacy.uploadToIisupp:false } makes that explicit, and the x-aria-stop-codes-sha256 header
// lets clients detect tampering of the index in transit. Source of truth: aria-stop-codes-data.mjs.
//
// Optional ?q= filters by stop-code or hex (case-insensitive substring). Omitted → the full index returns.
//
// SENTINEL-BACKEND 2026-10-14 (audit B8): served at BOTH /aria-stop-codes and the /.netlify/functions path the
// desktop declares (ARIA Sentinel/src/shared/recipes.mjs STOP_CODES_ENDPOINT) — the latter answered 404 live.
// (audit B18) x-aria-stop-codes-sha256 is an integrity checksum of the body, not a signature.
import crypto from "node:crypto";
import { STOP_CODES } from "./aria-stop-codes-data.mjs";

export const STOP_CODES_PATHS = Object.freeze(["/aria-stop-codes", "/.netlify/functions/aria-stop-codes"]);

function matchesQuery(entry, needle) {
  return String(entry.code || "").toLowerCase().includes(needle) ||
         String(entry.hex || "").toLowerCase().includes(needle);
}

export function buildStopCodeIndex(q = "") {
  const query = String(q || "").trim();
  const needle = query.toLowerCase();
  const stopCodes = query ? STOP_CODES.filter((entry) => matchesQuery(entry, needle)) : STOP_CODES.slice();
  return {
    ok: true,
    schema: "aria-stop-codes/v1",
    privacy: { uploadToIisupp: false },
    query,
    counts: { total: stopCodes.length },
    stopCodes
  };
}

export default async function handler(request) {
  let q = "";
  try { q = new URL(request.url).searchParams.get("q") || ""; } catch { /* no query string */ }
  const body = JSON.stringify(buildStopCodeIndex(q));
  const sha256 = crypto.createHash("sha256").update(body).digest("hex");
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=300",
      "x-aria-stop-codes-sha256": sha256
    }
  });
}

// Netlify's bundler reads this export STATICALLY (an object literal of literals) — a spread of STOP_CODES_PATHS broke the
// 2026-10-15 production build ("configuration error on 'path': Must be a string or array of strings"). Keep the
// two literals in lockstep with STOP_CODES_PATHS; tests/netlify-function-config-static.test.mjs pins both.
export const config = { path: ["/aria-stop-codes", "/.netlify/functions/aria-stop-codes"] };

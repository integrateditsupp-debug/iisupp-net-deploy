// Netlify function: aria-stop-codes — the live Windows stop-code (BSOD) index for ARIA Guided Fix and the
// ARIA Sentinel desktop agent (STOP_CODES_ENDPOINT).
//
// Content-blind: returns ONLY the public stop-code reference (code/hex/family/likelyCauses/firstSteps/
// escalation). { privacy.uploadToIisupp:false } makes that explicit, and the x-aria-stop-codes-sha256 header
// lets clients detect tampering of the index in transit. Source of truth: aria-stop-codes-data.mjs.
//
// Optional ?q= filters by stop-code or hex (case-insensitive substring). Omitted → the full index returns.
import crypto from "node:crypto";
import { STOP_CODES } from "./aria-stop-codes-data.mjs";

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

export const config = { path: "/aria-stop-codes" };

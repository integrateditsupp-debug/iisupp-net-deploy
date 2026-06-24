// Netlify function: GET /aria-sentinel/buy → 302 redirect to the latest Windows .exe GitHub Release.
// The "Download for Windows" button targets this. Project-local until wired into the live deploy.
import { parseUpdateManifest } from "../../src/shared/auto-update.mjs";

const RELEASES_API = "https://api.github.com/repos/integrated-it-support/aria-sentinel/releases";
const FALLBACK = "https://iisupp.net/aria-sentinel/";

export async function handler() {
  let url = FALLBACK;
  try {
    const res = await fetch(RELEASES_API, { headers: { "user-agent": "aria-sentinel" } });
    const latest = parseUpdateManifest(await res.json());
    if (latest && latest.downloadUrl) url = latest.downloadUrl;
  } catch {
    // fall back to the product page if the releases API is unavailable
  }
  return { statusCode: 302, headers: { location: url, "cache-control": "no-cache" }, body: "" };
}

export const config = { path: "/aria-sentinel/buy" };

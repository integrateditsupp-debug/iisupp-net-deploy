// Netlify function: GET /aria-binary-update → latest Windows build {version, downloadUrl}.
// Reads the GitHub Releases listing for the repo and resolves the newest non-draft .exe.
// Project-local until wired into the live deploy. No secrets required (public releases).
import { parseUpdateManifest } from "../../src/shared/auto-update.mjs";

const RELEASES_API = "https://api.github.com/repos/integrated-it-support/aria-sentinel/releases";

export async function handler() {
  try {
    const res = await fetch(RELEASES_API, { headers: { "user-agent": "aria-sentinel" } });
    const latest = parseUpdateManifest(await res.json());
    return { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify(latest || { version: null }) };
  } catch {
    return { statusCode: 200, headers: { "content-type": "application/json" }, body: JSON.stringify({ version: null, error: "unavailable" }) };
  }
}

export const config = { path: "/aria-binary-update" };

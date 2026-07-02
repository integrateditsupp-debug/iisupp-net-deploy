#!/usr/bin/env node
// SERVING-LAYER LOCKDOWN 2026-07-02 — live deploy-safety probe.
// The 2026-07-02 incident proved git-state tests CANNOT catch serving-layer leaks: the tree was
// clean and the force-404 rules were present, yet /CLAUDE.md was observed served. This script
// probes the LIVE site with cache-busted GETs and PASSES a path only when the serving layer
// actually refuses it (404 + HTML rewrite body, never markdown/json/plaintext internals).
//
// Wiring:
//   npm run probe:deploy-safety                    — one shot against https://iisupp.net
//   node scripts/probe-deploy-safety.mjs --json    — machine-readable report (flywheel gate)
//   node scripts/probe-deploy-safety.mjs --watch 30 — watchdog loop, every 30 minutes
// On FAIL it writes a content-blind alert file (senior-director-state/serving-layer-alert-<ts>.json)
// and appends an entry to senior-director-state/ceo-approval-required.md. Auto-republish of the
// last-known-good deploy via the Netlify API is deliberately NOT implemented — production is
// LOCKED (incident control 2026-07-02) and any republish is Ahmad's one-click.
//
// Lessons encoded: ALWAYS cache-bust (?cb=<ts> + Cache-Control: no-cache) — an unbusted probe can
// replay a tool/CDN cache and both mask a live leak and fake one (the 00:35 incident observation
// was an unbusted fetch). Alerts are content-blind: status/content-type/marker booleans only,
// never response bodies.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_BASE_URL = "https://iisupp.net";

// Cache-busted probe paths: every class the denylist protects, plus the exact incident path first.
export const DENYLIST_PROBES = Object.freeze([
  "/CLAUDE.md",
  "/aria-vault/01_Frontal/VISION-AND-GOAL-STANDING.md",
  "/aria-vault/CLAUDE.md",
  "/senior-director-state/PROGRESS-LEDGER.md",
  "/senior-director-state/codex-claude-queue.md",
  "/documents/product-engineering/SECURITY-LOCKDOWN-PACKET-CC-2026-07-01.md",
  "/AGENT_EXECUTION_NOTES.md",
  "/ARIA-Vault-Backups/latest/index.md",
  "/backups/README.md",
  "/COLLAB-CLAUDE-CODEX.md",
  "/scripts/probe-deploy-safety.mjs"
]);

// Sensitive marker phrases are assembled from char codes at RUNTIME so this tracked file never
// contains them literally — if this script were itself ever served (it is on the denylist above
// and /scripts/* is force-404'd), it would leak nothing.
const cc = (...codes) => String.fromCharCode(...codes);
const R11_PHRASE = [cc(112, 114, 105, 118, 97, 116, 101), cc(112, 105, 99, 115), cc(97, 110, 100), cc(118, 105, 100, 115)]; // r11 folder words
const FORBIDDEN_NAME = [cc(82, 97, 121, 109, 111, 110, 100), cc(74, 97, 109, 101, 115)]; // the never-mention name

// Body markers that mean "internal document escaped" even if headers lie. Content-blind: the
// classifier reports the marker's LABEL, never the matched text or the pattern source.
const INTERNAL_MARKERS = [
  { label: "vault-frontmatter", re: /brain_region/i },
  { label: "agent-rules-header", re: /HARD\sRULES/i },
  { label: "r11-folder-name", re: new RegExp(R11_PHRASE.join("\\s+"), "i") },
  { label: "sds-path", re: /senior-director-state/i },
  { label: "forbidden-name", re: new RegExp(FORBIDDEN_NAME.join("\\s+"), "i") },
  { label: "markdown-heading", re: /^#\s/m }
];

/**
 * Classify one probe response. PASS only when the serving layer refused the path:
 * status 404 with an HTML rewrite body (the force-404 → /index.html shape) and zero internal
 * markers. Any 2xx, any markdown/json/plain content-type, or any marker → FAIL.
 */
export function classifyProbe({ status, contentType, body }) {
  const ct = String(contentType || "").toLowerCase();
  const text = String(body || "");
  const marker = INTERNAL_MARKERS.find((m) => m.re.test(text));
  if (marker) return { ok: false, reason: `internal-marker:${marker.label}` };
  if (/markdown|json|text\/plain/.test(ct)) return { ok: false, reason: `internal-content-type:${ct.split(";")[0]}` };
  if (status >= 200 && status < 300) return { ok: false, reason: `served-2xx:${status}` };
  if (status === 404) return { ok: true, reason: "refused-404" };
  if (status === 403 || status === 410) return { ok: true, reason: `refused-${status}` };
  // 3xx/5xx/0: not a confirmed leak, but not a confirmed refusal either — surface honestly.
  return { ok: false, reason: `unexpected-status:${status}` };
}

/** Run every probe (cache-busted). fetchFn/now injectable — tests never hit the network. */
export async function runProbes({ baseUrl = DEFAULT_BASE_URL, fetchFn = fetch, now = Date.now, paths = DENYLIST_PROBES } = {}) {
  const ts = now();
  const results = [];
  for (const p of paths) {
    const url = `${baseUrl}${p}?cb=${ts}`;
    let entry;
    try {
      const res = await fetchFn(url, { headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }, redirect: "manual" });
      const body = await res.text();
      const verdict = classifyProbe({ status: res.status, contentType: res.headers.get("content-type"), body });
      entry = { path: p, status: res.status, contentType: String(res.headers.get("content-type") || "").split(";")[0], ...verdict };
    } catch (e) {
      // Network failure ≠ leak. Report honestly as unreachable; the caller decides severity.
      entry = { path: p, status: 0, contentType: "", ok: false, reason: `unreachable:${(e && e.message ? e.message : "error").slice(0, 60)}` };
    }
    results.push(entry);
  }
  const failures = results.filter((r) => !r.ok);
  const leaks = failures.filter((r) => r.reason.startsWith("internal-") || r.reason.startsWith("served-2xx"));
  return {
    v: "serving-probe-v1",
    ts,
    tsIso: new Date(ts).toISOString(),
    baseUrl,
    ok: failures.length === 0,
    leak: leaks.length > 0, // true = confirmed serving of a denylisted path (page Ahmad)
    pass: results.length - failures.length,
    fail: failures.length,
    results
  };
}

/** Content-blind alert artifacts for a failed report (no bodies, ever). */
export function alertArtifacts(report) {
  const failed = report.results.filter((r) => !r.ok).map(({ path: p, status, contentType, reason }) => ({ path: p, status, contentType, reason }));
  const alertJson = { v: "serving-layer-alert-v1", tsIso: report.tsIso, baseUrl: report.baseUrl, leak: report.leak, failed };
  const ceoLine = `\n## 🔴 SERVING-LAYER ${report.leak ? "LEAK" : "PROBE FAILURE"} — ${report.tsIso}\n` +
    `- probe-deploy-safety: ${report.fail}/${report.results.length} paths failed on ${report.baseUrl} (${failed.map((f) => `${f.path}→${f.reason}`).join(" · ")})\n` +
    `- ACTION (Ahmad one-click): Netlify → Deploys → publish last-known-good, keep auto-publish LOCKED. Production stays pinned until a clean probe.\n`;
  return { alertJson, ceoLine };
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────────────
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  const flag = (name) => { const i = args.indexOf(name); return i === -1 ? null : (args[i + 1] || true); };
  const baseUrl = typeof flag("--base") === "string" ? flag("--base") : DEFAULT_BASE_URL;
  const asJson = args.includes("--json");
  const watchMin = Number(flag("--watch")) || 0;
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const alertDir = typeof flag("--alert-dir") === "string" ? flag("--alert-dir") : path.join(repoRoot, "senior-director-state");

  const once = async () => {
    const report = await runProbes({ baseUrl });
    if (asJson) console.log(JSON.stringify(report, null, 2));
    else {
      for (const r of report.results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.path}  (${r.status || "n/a"} ${r.contentType || ""} ${r.reason})`);
      console.log(report.ok ? `\nServing layer clean: ${report.pass}/${report.results.length} refused.` : `\n🔴 ${report.fail}/${report.results.length} probes FAILED${report.leak ? " — CONFIRMED LEAK" : ""}.`);
    }
    if (!report.ok) {
      try {
        const { alertJson, ceoLine } = alertArtifacts(report);
        fs.mkdirSync(alertDir, { recursive: true });
        fs.writeFileSync(path.join(alertDir, `serving-layer-alert-${report.ts}.json`), JSON.stringify(alertJson, null, 2));
        fs.appendFileSync(path.join(alertDir, "ceo-approval-required.md"), ceoLine);
      } catch (e) { console.error("alert write failed:", e && e.message); }
    }
    return report.ok;
  };

  if (watchMin > 0) {
    console.log(`probe-deploy-safety watchdog: every ${watchMin} min against ${baseUrl} (Ctrl+C to stop)`);
    // Sequential loop (never overlapping probes).
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await once();
      await new Promise((r) => setTimeout(r, watchMin * 60 * 1000));
    }
  } else {
    process.exitCode = (await once()) ? 0 : 1;
  }
}

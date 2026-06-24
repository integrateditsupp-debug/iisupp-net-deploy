// status-badge — renders the embeddable single-iframe health badge a customer drops on their own
// intranet. PURE: returns a self-contained HTML string (inline CSS only, NO inline script) so it is
// CSP-safe and cannot execute anything in the embedding page. Consumes the telemetry-event health view.
import { healthLabel } from "./health-score.mjs";

const PALETTE = {
  Healthy: "#7afbff",
  Watch: "#f2c14e",
  Degraded: "#f2a73b",
  Critical: "#ff5247"
};

export const BADGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; frame-ancestors *";

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function clampScore(score) {
  const n = Math.round(Number(score));
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
}

/**
 * Render the badge HTML.
 * @param {object} data { tenant, score, fixes }
 * @returns {string} complete <!doctype html> document (220×64 by design)
 */
export function renderStatusBadge(data = {}) {
  const score = clampScore(data.score);
  const label = healthLabel(score);
  const color = PALETTE[label] || PALETTE.Critical;
  const tenant = esc(String(data.tenant || "this site").slice(0, 40));
  const fixes = Math.max(0, Number(data.fixes) || 0);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="${BADGE_CSP}" />
<style>
  html,body{margin:0;height:100%;font-family:system-ui,Segoe UI,Inter,sans-serif;background:#0a0a0a;color:#f5f5f5;}
  .badge{display:flex;align-items:center;gap:12px;height:64px;width:220px;box-sizing:border-box;padding:0 14px;background:linear-gradient(135deg,#0d0d0d,#161616);border:1px solid rgba(197,160,89,.35);border-radius:10px;}
  .ring{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid ${color};font-weight:700;font-size:14px;color:${color};}
  .txt{display:flex;flex-direction:column;line-height:1.25;}
  .txt b{font-size:13px;}
  .txt span{font-size:11px;color:rgba(255,255,255,.6);}
  .dot{color:${color};}
</style></head>
<body><div class="badge" role="img" aria-label="ARIA Sentinel health ${score} of 100, ${esc(label)}">
  <div class="ring">${score}</div>
  <div class="txt"><b>ARIA Sentinel</b><span><span class="dot">&#9679;</span> ${esc(label)} &middot; ${fixes} fixes &middot; ${tenant}</span></div>
</div></body></html>`;
}

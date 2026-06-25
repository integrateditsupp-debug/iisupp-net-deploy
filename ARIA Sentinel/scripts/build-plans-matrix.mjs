// RUN 23e — build-time generator for the public iisupp.net/plans ARIA Sentinel matrix. Sources the
// cards + 12×6 comparison grid straight from pricing-tiers.mjs so the website and the desktop app can
// never drift. Netlify runs this at build to inject the fragment between the
// <!-- SENTINEL_MATRIX:START --> / <!-- SENTINEL_MATRIX:END --> markers in plans/index.html.
// 🔒 R11 — emits prices/feature labels only. Stripe is wired by data-tier (server-side price map), never a URL.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TIERS, CLIENT_PLANS, planComparisonTable, monthlyDisplay, visitsLabel, SEPARATE_HUMAN_SUPPORT_NOTE } from "../src/shared/pricing-tiers.mjs";

// data-tier checkout key per plan (matches stripe-checkout.js PRICE_MAP).
export const CHECKOUT_TIER = {
  personal: "sentinel_personal_m",
  pro: "sentinel_pro_m",
  smb: "sentinel_business_y",
  midsize: "sentinel_midsize_y",
  enterprise: "sentinel_enterprise_y"
};
// The Netlify env var holding each plan's Stripe price ID. A button renders as a live SUBSCRIBE only when
// its price env is set; otherwise it falls back to Contact sales — so newly-priced tiers go live the
// moment Ahmad runs setup-stripe-sentinel.mjs (which sets these), with zero further code changes.
export const SENTINEL_PRICE_ENV = {
  personal: "STRIPE_PRICE_SENTINEL_PERSONAL_M",
  pro: "STRIPE_PRICE_SENTINEL_PRO_M",
  smb: "STRIPE_PRICE_SENTINEL_BUSINESS_Y",
  midsize: "STRIPE_PRICE_SENTINEL_MIDSIZE_Y",
  enterprise: "STRIPE_PRICE_SENTINEL_ENTERPRISE_Y"
};

export function isWired(plan, env = process.env) {
  return Boolean(env[SENTINEL_PRICE_ENV[plan]]);
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderPlansCards(env = process.env) {
  return `<div class="sentinel-cards">\n` + CLIENT_PLANS.map((p) => {
    const t = TIERS[p];
    const cta = isWired(p, env)
      ? `<button class="pf-cta" data-tier="${CHECKOUT_TIER[p]}" data-name="ARIA Sentinel ${esc(t.label)}">SUBSCRIBE</button>`
      : `<a class="pf-cta contact" href="mailto:ahmad.wasee@iisupp.net?subject=ARIA%20Sentinel%20${encodeURIComponent(t.label)}">CONTACT SALES</a>`;
    const visits = visitsLabel(p) ? `\n    <div class="pf-visits">Includes ${esc(visitsLabel(p))}</div>` : "";
    return `  <article class="sentinel-card">
    <h3>${esc(t.label)}</h3>
    <div class="pf-price">${esc(monthlyDisplay(p))}</div>
    <div class="pf-seats">${esc(t.seats)}</div>
    <p class="pf-blurb">${esc(t.blurb)}</p>${visits}
    ${cta}
  </article>`;
  }).join("\n") + `\n</div>`;
}

export function renderPlansMatrix() {
  const { plans, rows } = planComparisonTable();
  const yes = `<span class="yes">✓</span>`, no = `<span class="no">—</span>`;
  const cell = (v) => v === true ? yes : v === false ? no : `<span>${esc(v)}</span>`;
  const head = `<tr><th>Feature</th>${plans.map((p) => `<th>${esc(p.label)}</th>`).join("")}</tr>`;
  const priceRow = `<tr class="price-row"><td>Price</td>${plans.map((p) => `<td>${esc(monthlyDisplay(p.plan))}</td>`).join("")}</tr>`;
  const visitsRow = `<tr><td>Bundled human visits</td>${plans.map((p) => `<td>${esc(visitsLabel(p.plan) || "—")}</td>`).join("")}</tr>`;
  const seatRow = `<tr><td>Seats</td>${plans.map((p) => `<td>${esc(p.seats)}</td>`).join("")}</tr>`;
  const body = rows.map((r) => `<tr><td>${esc(r.label)}</td>${plans.map((p) => `<td>${cell(r.values[p.plan])}</td>`).join("")}</tr>`).join("\n");
  return `<table class="sentinel-matrix">\n<thead>${head}${priceRow}${seatRow}${visitsRow}</thead>\n<tbody>\n${body}\n</tbody>\n</table>`;
}

/** The full fragment Netlify injects between the SENTINEL_MATRIX markers. */
export function renderPlansFragment(env = process.env) {
  const note = `<p class="sentinel-human-note">${esc(SEPARATE_HUMAN_SUPPORT_NOTE)} <a href="/contact.html?subject=Human%20Support%20quote">Request a Human Support quote →</a></p>`;
  return `${renderPlansCards(env)}\n<div class="sentinel-matrix-wrap">\n${renderPlansMatrix()}\n</div>\n${note}`;
}

// An env where every Sentinel price is "set" — used to preview the final all-SUBSCRIBE state.
const PREVIEW_ENV = Object.fromEntries(Object.values(SENTINEL_PRICE_ENV).map((k) => [k, "price_preview"]));

export const MARKER_START = "<!-- SENTINEL_MATRIX:START -->";
export const MARKER_END = "<!-- SENTINEL_MATRIX:END -->";

/** Replace the content between the SENTINEL_MATRIX markers in `html` with the freshly-rendered fragment. */
export function injectFragment(html, env = process.env) {
  const s = html.indexOf(MARKER_START);
  const e = html.indexOf(MARKER_END);
  if (s === -1 || e === -1 || e < s) throw new Error("SENTINEL_MATRIX markers not found in target HTML");
  const fragment = `${MARKER_START}\n${renderPlansFragment(env)}\n      ${MARKER_END}`;
  return html.slice(0, s) + fragment + html.slice(e + MARKER_END.length);
}

// `--inject <file>` → env-aware injection into the live page at Netlify build time (idempotent).
if (process.argv.includes("--inject")) {
  const target = process.argv[process.argv.indexOf("--inject") + 1];
  if (!target) { console.error("usage: build-plans-matrix.mjs --inject <plans/index.html>"); process.exit(1); }
  const abs = path.resolve(target);
  const html = fs.readFileSync(abs, "utf8");
  fs.writeFileSync(abs, injectFragment(html), "utf8");
  const wired = CLIENT_PLANS.filter((p) => isWired(p)).map((p) => p);
  console.log(`Injected Sentinel matrix → ${abs} (live SUBSCRIBE: ${wired.join(", ") || "none yet"}; others → Contact sales)`);
  process.exit(0);
}

// Run directly → write a standalone, brand-styled PREVIEW for Ahmad's approval (NOT the live page).
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const out = process.argv[2] || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "design-review", "run-23e-plans-matrix-preview.html");
  const page = `<!doctype html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>RUN 23e — iisupp.net/plans ARIA Sentinel matrix (PREVIEW)</title>
<style>
:root{--gold:#c5a059;--gold-l:#f1dca7;--bg:#070b16;--card:#0e1424;--bd:#1e2740;--tint:#15110a;--tintbd:#38301d;--text:#fff;--t2:#aeb6c8;--mut:#6b7488;--cyan:#7afbff;}
*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#070b16,#04060d);color:var(--text);font-family:Inter,system-ui,sans-serif;}
.pv{position:sticky;top:0;background:linear-gradient(180deg,#15110a,#0a0a0a);border-bottom:1px solid var(--tintbd);padding:8px 18px;font-size:12px;color:var(--gold-l);display:flex;gap:14px;flex-wrap:wrap;align-items:center;z-index:9}
.pv b{color:var(--gold);font-family:Cinzel,Georgia,serif;letter-spacing:.06em}.pv .flag{color:#ffcb6b}
.wrap{max-width:1180px;margin:0 auto;padding:30px 22px 60px}
.eyebrow{color:var(--gold);font-family:Cinzel,Georgia,serif;font-size:11px;letter-spacing:.22em;text-transform:uppercase;margin:0 0 8px}
h1{font-family:Cinzel,Georgia,serif;font-size:32px;margin:0}h2{font-family:Cinzel,Georgia,serif;font-size:20px;margin:34px 0 14px}
.lead{color:var(--t2);font-size:15px;max-width:720px}
.sentinel-cards{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-top:24px}
@media(max-width:980px){.sentinel-cards{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.sentinel-cards{grid-template-columns:1fr}}
.sentinel-card{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:18px 16px;display:flex;flex-direction:column;gap:8px}
.sentinel-card h3{font-family:Cinzel,Georgia,serif;font-size:17px;margin:0}
.pf-price{font-family:Cinzel,Georgia,serif;font-size:27px;color:var(--gold-l)}.pf-unit{font-size:13px;color:var(--mut)}
.pf-seats{color:var(--mut);font-size:11.5px;font-family:ui-monospace,Menlo,monospace}
.pf-blurb{color:var(--t2);font-size:12px;line-height:1.45;flex:1}
.pf-cta{margin-top:6px;border:0;border-radius:8px;background:linear-gradient(90deg,#c5a059,#f1dca7);color:#1a1410;font-family:Cinzel,Georgia,serif;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:11px;cursor:pointer;text-align:center;text-decoration:none;display:block}
.pf-cta.contact{background:transparent;border:1px solid var(--gold);color:var(--gold-l)}
.sentinel-matrix-wrap{overflow-x:auto;border:1px solid var(--bd);border-radius:12px;margin-top:14px}
.sentinel-matrix{width:100%;border-collapse:collapse;font-size:12.5px;min-width:720px}
.sentinel-matrix th,.sentinel-matrix td{padding:10px 12px;text-align:center;border-bottom:1px solid var(--bd)}
.sentinel-matrix th:first-child,.sentinel-matrix td:first-child{text-align:left;color:var(--t2)}
.sentinel-matrix thead th{color:var(--gold-l);font-family:Cinzel,Georgia,serif;font-size:13px}
.sentinel-matrix .price-row td{color:var(--gold-l);font-family:Cinzel,Georgia,serif}
.yes{color:var(--cyan)}.no{color:var(--mut)}
.foot{color:var(--mut);font-size:11.5px;margin-top:12px}
</style></head><body>
<div class="pv"><b>RUN 23e PREVIEW</b><span>iisupp.net/plans — ARIA Sentinel tier matrix, generated from pricing-tiers.mjs</span><span class="flag">⚑ Buttons shown live; each auto-falls-back to Contact-sales until its Stripe price env is set</span></div>
<div class="wrap">
  <p class="eyebrow">ARIA Sentinel</p>
  <h1>License the tier that fits</h1>
  <p class="lead">Same app for everyone — your license key unlocks the matching features instantly. Personal is Manual-mode guided support; Pro adds Confirmed &amp; Autonomous auto-fix and the full recipe library; business tiers add fleet view, compliance evidence and custom recipes.</p>
  ${renderPlansFragment(PREVIEW_ENV)}
  <p class="foot">Prices in USD. Business tiers (Small Business · Mid Size · Enterprise) share the same feature set and differ in seats + price. Seat counts confirmed at checkout. Generated at build time from <code>pricing-tiers.mjs</code> so this page and the app never drift.</p>
  <h2>Stripe wiring (turnkey)</h2>
  <p class="lead">Each Subscribe button is env-aware: it renders live only when that tier's <code>STRIPE_PRICE_SENTINEL_*</code> env is set, otherwise it shows <b>Contact sales</b> — so nothing is ever a broken checkout. Running <code>scripts/setup-stripe-sentinel.mjs</code> (with your Stripe key) creates the Pro / Mid / Enterprise prices and sets those envs; the buttons then go live on the next Netlify build with no code change.</p>
</div></body></html>`;
  fs.writeFileSync(out, page, "utf8");
  console.log(`Wrote plans matrix preview → ${out}`);
}

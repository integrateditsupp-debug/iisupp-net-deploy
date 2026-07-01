// RUN 22 §4 — Compliance tab: pure HTML builders for the 5 framework composites + R11 enforcement.
import { esc } from "./dashboard.mjs";
import { buildTrustSummary } from "../../shared/trust-posture.mjs"; // RUN-B B3 — honest trust/security surface

function row(label, value, em = "") { return `<div class="health-row"><span>${esc(label)}</span><strong>${esc(value)}</strong><em>${esc(em)}</em></div>`; }

export function auditRowsHtml(a = {}) {
  return row("hash chain", a.ok ? "verified" : "BROKEN", a.lastVerified || "") + row("entries (30d)", a.entries ?? 0, "");
}
export function privacyRowsHtml(p = {}) {
  return row("last result", p.pass ? "PASS" : "REVIEW", p.ts || "") + row("6-host allowlist", p.allowlistOk ? "intact" : "WIDENED") + row("sanitization rate", `${p.sanitization ?? 100}%`, "must be 100%");
}
export function tier0RowsHtml(t = {}) {
  return row("risky actions blocked (30d)", t.blocked ?? 0, "") + row("categories", (t.categories || []).join(", ") || "none");
}
/** R11 — the counter must always read 0 attempted accesses. */
export function r11RowsHtml(r = {}) {
  return row("private folder", r.touched ? "ACCESS ATTEMPTED" : "never touched", r.folder || "Private pics and Vids")
    + row("attempted accesses", r.attempts ?? 0, r.ok ? "✓ always 0" : "⚠ must be 0")
    + row("last verified", r.lastVerified || "—", "");
}

export function frameworkTilesHtml(scores = {}) {
  return Object.entries(scores).map(([fw, s]) =>
    `<div class="kpi-tile" data-fw="${esc(fw)}"><div class="kpi-value">${esc(s.score ?? 0)}<span style="font-size:13px">/100</span></div><div class="kpi-label">${esc(fw.toUpperCase())} <span class="framework-badge ${esc(s.badge || "gap")}">${esc(s.badge || "gap")}</span></div><div class="kpi-foot"><span>${esc(s.met ?? 0)}/${esc(s.total ?? 0)} controls</span></div></div>`
  ).join("");
}

// RUN-B B3 — HONEST TRUST/SECURITY SURFACE, rendered from the single source of truth (trust-posture.mjs).
// Buyer-facing: what we ARE / are NOT (no cert we don't hold), what stays local, security controls each
// independently verifiable, "how ARIA measures itself" (real-or-empty), and straight answers. esc-safe.
export function trustPostureHtml(summary) {
  const s = (summary && summary.certification) ? summary : buildTrustSummary();
  const cert = s.certification || {};
  const dr = s.dataResidency || {};
  const liArr = (arr = []) => (arr || []).map((x) => `<li>${esc(x)}</li>`).join("");
  const are = liArr(cert.are);
  const areNot = liArr(cert.areNot);
  const local = liArr(dr.staysLocal);
  const leaves = (dr.leavesDevice || []).map((o) => `<li><strong>${esc(o.what)}</strong> — ${esc(o.contains)} <em>(${esc(o.verifiableBy)})</em></li>`).join("");
  const controls = (s.securityControls || []).map((c) => `<div class="health-row"><span>${esc(c.claim)}</span><em>${esc(c.verifiableBy)}</em></div>`).join("");
  const measured = (s.howMeasured || []).map((m) => `<div class="health-row"><span><strong>${esc(m.metric)}</strong> = ${esc(m.formula)}</span><em>${esc(m.emptyState)}</em></div>`).join("");
  const qa = (s.selfAssessment || []).map((x) => `<div class="trust-qa"><p class="term">${esc(x.q)}</p><p class="desc">${esc(x.a)}</p></div>`).join("");
  const live = s.live || {};
  const pct = (live.deflectionPct == null) ? "—" : `${esc(String(live.deflectionPct))}%`;
  const hrs = (live.hoursSaved == null) ? "—" : esc(String(live.hoursSaved));
  const usd = (live.dollarsSaved == null) ? "—" : `$${esc(String(live.dollarsSaved))}`;
  return `<div class="trust-posture-inner">`
    + `<p class="eyebrow">What we ARE</p><ul class="trust-list">${are}</ul>`
    + `<p class="eyebrow">What we are NOT — no cert we don't hold</p><ul class="trust-list">${areNot}</ul>`
    + `<p class="trust-statement">${esc(cert.statement || "")}</p>`
    + `<p class="eyebrow">Stays on your device</p><ul class="trust-list">${local}</ul>`
    + `<p class="eyebrow">The only things that leave — content-blind</p><ul class="trust-list">${leaves}</ul>`
    + `<p class="eyebrow">Security controls — each independently verifiable</p>${controls}`
    + `<p class="eyebrow">How ARIA measures itself — real-or-empty</p>${measured}`
    + `<div class="health-row"><span>Live: deflection ${pct} · saved ${hrs}h · ${usd}</span><em>traces to the local audit log</em></div>`
    + `<p class="eyebrow">Straight answers</p>${qa}`
    + `<p class="trust-principle">${esc(s.principle || "")}</p>`
    + `</div>`;
}

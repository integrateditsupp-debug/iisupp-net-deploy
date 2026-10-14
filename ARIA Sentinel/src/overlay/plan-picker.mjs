// RUN 23e — plan-picker overlay. Renders the tier cards + comparison matrix straight from the shared
// pricing-tiers source of truth (never a hardcoded price/URL), highlights the current plan, and routes
// Subscribe through the existing wiring (window.sentinel.choosePlan → main opens the checkout, or the live
// /plans/?from=app&tier=… page when no checkout link is configured on this machine).
// PROD 2026-10-14 (audit R5) — the Yearly tab shows REAL yearly totals (12× monthly, or the stated annual price)
// with "billed annually"; annual-only tiers always say so; the billing period travels with choosePlan.
import { TIERS, CLIENT_PLANS, normalizePlan, planComparisonTable, priceLine, visitsLabel, SEPARATE_HUMAN_SUPPORT_NOTE } from "../shared/pricing-tiers.mjs";

const bridge = (typeof window !== "undefined" && window.sentinel) || null;
let billing = "monthly";
let currentPlan = null;

function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

function cell(value) {
  if (value === true) return `<span class="yes">✓</span>`;
  if (value === false) return `<span class="no">—</span>`;
  return `<span>${esc(value)}</span>`;
}

function renderCards() {
  const host = document.getElementById("cards");
  if (!host) return;
  host.innerHTML = CLIENT_PLANS.map((p) => {
    const t = TIERS[p];
    const isCurrent = currentPlan === p;
    const pl = priceLine(p, billing);
    const visits = visitsLabel(p);
    return `<article class="plan-card${isCurrent ? " current" : ""}" data-plan="${p}">
      ${isCurrent ? `<span class="current-badge">Current</span>` : ""}
      <h3>${esc(t.label)}</h3>
      <div class="plan-price">${esc(pl.amount)}<em>${esc(pl.unit)}</em></div>
      <div class="plan-note">${esc([pl.note, visits].filter(Boolean).join(" · "))}</div>
      <div class="plan-seats">${esc(t.seats)}</div>
      <p class="plan-blurb">${esc(t.blurb)}</p>
      <button class="subscribe${isCurrent ? " is-current" : ""}" data-subscribe="${p}" ${isCurrent ? "disabled" : ""}>${isCurrent ? "Your plan" : "Subscribe"}</button>
    </article>`;
  }).join("");
  host.querySelectorAll("[data-subscribe]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const plan = btn.dataset.subscribe;
      // The chosen billing period travels with the request; main resolves the checkout (or the live plans page).
      bridge?.choosePlan?.(plan, { billing: billing === "yearly" ? "yearly" : "monthly" });
    });
  });
}

function renderMatrix() {
  const table = document.getElementById("matrix");
  if (!table) return;
  const { plans, rows } = planComparisonTable();
  const head = `<thead><tr><th>Feature</th>${plans.map((p) => `<th${currentPlan === p.plan ? ' class="cur"' : ""}>${esc(p.label)}</th>`).join("")}</tr>
    <tr><td>Price</td>${plans.map((p) => { const pl = priceLine(p.plan, billing); return `<td>${esc(pl.amount)}<small>${esc(pl.unit)}</small>${pl.note ? `<br/><small>${esc(pl.note)}</small>` : ""}</td>`; }).join("")}</tr>
    <tr><td>Seats</td>${plans.map((p) => `<td>${esc(p.seats)}</td>`).join("")}</tr></thead>`;
  const body = `<tbody>${rows.map((r) => `<tr><td>${esc(r.label)}</td>${plans.map((p) => `<td>${cell(r.values[p.plan])}</td>`).join("")}</tr>`).join("")}</tbody>`;
  table.innerHTML = head + body;
  const foot = document.getElementById("pickerSupportNote");
  if (foot) foot.textContent = SEPARATE_HUMAN_SUPPORT_NOTE;
}

function render() { renderCards(); renderMatrix(); }

function wireBilling() {
  document.querySelectorAll(".bt-opt").forEach((btn) => {
    btn.addEventListener("click", () => {
      billing = btn.dataset.billing;
      document.querySelectorAll(".bt-opt").forEach((b) => b.classList.toggle("active", b === btn));
      render();
    });
  });
}

async function init() {
  try {
    const state = await bridge?.getState?.();
    const plan = state?.license?.plan;
    if (plan) currentPlan = normalizePlan(plan);
  } catch { /* standalone preview: no current plan */ }
  wireBilling();
  render();
}

init();

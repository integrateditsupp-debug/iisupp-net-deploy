// RUN 23e — plan-picker overlay. Renders the tier cards + comparison matrix straight from the shared
// pricing-tiers source of truth (never a hardcoded price/URL), highlights the current plan, and routes
// Subscribe through the existing Stripe wiring (window.sentinel.choosePlan → env-resolved checkout URL).
import { TIERS, CLIENT_PLANS, normalizePlan, planComparisonTable } from "../shared/pricing-tiers.mjs";

const bridge = (typeof window !== "undefined" && window.sentinel) || null;
let billing = "monthly";
let currentPlan = null;

function cell(value) {
  if (value === true) return `<span class="yes">✓</span>`;
  if (value === false) return `<span class="no">—</span>`;
  return `<span>${String(value)}</span>`;
}

function renderCards() {
  const host = document.getElementById("cards");
  if (!host) return;
  host.innerHTML = CLIENT_PLANS.map((p) => {
    const t = TIERS[p];
    const isCurrent = currentPlan === p;
    const unit = t.billing === "year" ? "/yr" : (billing === "yearly" ? "/yr" : "/mo");
    return `<article class="plan-card${isCurrent ? " current" : ""}" data-plan="${p}">
      ${isCurrent ? `<span class="current-badge">Current</span>` : ""}
      <h3>${t.label}</h3>
      <div class="plan-price">${t.priceDisplay}<em>${unit}</em></div>
      <div class="plan-seats">${t.seats}</div>
      <p class="plan-blurb">${t.blurb}</p>
      <button class="subscribe${isCurrent ? " is-current" : ""}" data-subscribe="${p}" ${isCurrent ? "disabled" : ""}>${isCurrent ? "Your plan" : "Subscribe"}</button>
    </article>`;
  }).join("");
  host.querySelectorAll("[data-subscribe]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const plan = btn.dataset.subscribe;
      // Yearly toggle routes monthly-billed tiers to their yearly checkout; main resolves the env→URL.
      const tier = TIERS[plan];
      const useYearly = billing === "yearly" && tier.stripeYearlyEnv;
      bridge?.choosePlan?.(plan, { billing: useYearly ? "yearly" : "monthly" });
    });
  });
}

function renderMatrix() {
  const table = document.getElementById("matrix");
  if (!table) return;
  const { plans, rows } = planComparisonTable();
  const head = `<thead><tr><th>Feature</th>${plans.map((p) => `<th${currentPlan === p.plan ? ' class="cur"' : ""}>${p.label}</th>`).join("")}</tr>
    <tr><td>Price</td>${plans.map((p) => `<td>${p.priceDisplay}<small>/${p.billing === "year" ? "yr" : "mo"}</small></td>`).join("")}</tr>
    <tr><td>Seats</td>${plans.map((p) => `<td>${p.seats}</td>`).join("")}</tr></thead>`;
  const body = `<tbody>${rows.map((r) => `<tr><td>${r.label}</td>${plans.map((p) => `<td>${cell(r.values[p.plan])}</td>`).join("")}</tr>`).join("")}</tbody>`;
  table.innerHTML = head + body;
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

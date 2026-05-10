// aria-vs-act2.jsx — savings by company size (45–95s)
// Three tier cards: Small / Mid / Enterprise. Numbers count up.

window.VS_TIERS = [
  {
    key: "small",
    label: "SMALL BUSINESS",
    detail: "Under 250 employees · single site",
    aria: 156000,
    agents: { count: 4, salary: 75000, label: "4 agents × $75k" },
    note: "One agent absent = 25% of the desk goes dark.",
  },
  {
    key: "mid",
    label: "MID-SIZE",
    detail: "250–2,000 employees · 2–4 sites",
    aria: 312000,
    agents: { count: 11, salary: 80000, label: "9–14 agents × $80k", min: 9 * 80000, max: 14 * 80000 },
    note: "Coverage gaps every shift change · weekend rota burns mood.",
  },
  {
    key: "ent",
    label: "ENTERPRISE",
    detail: "2,000+ employees · global · 24/7",
    aria: 625000,
    agents: { count: 20, salary: 95000, label: "20+ agents × $95k · multi-region", min: 10 * 90000, max: 25 * 100000 },
    note: "Headcount climbs with every new region. ARIA does not.",
  },
];

window.VsAct2 = function VsAct2({ t, localT }) {
  // Stagger reveal: tier 0 at 0.5s, tier 1 at 1.5s, tier 2 at 2.5s
  // Count-up duration: 3.0s
  const fmt = (n) => "$" + Math.round(n).toLocaleString();
  const ease = (p) => p < 0.5 ? 2*p*p : 1 - Math.pow(-2*p+2, 2)/2;

  const tierProg = (i) => {
    const start = 0.5 + i * 1.0;
    return Math.min(1, Math.max(0, (localT - start) / 3.0));
  };

  // Total savings counter
  let totalSavings = 0;
  VS_TIERS.forEach(t => totalSavings += (t.agents.count * t.agents.salary) - t.aria);

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "0 32px" }}>
      <div style={{ marginBottom: 6, opacity: vsRamp(localT, 0.1, 0.6) }}>
        <div className="aria-mono" style={{ fontSize: 11, color: "var(--aria-gold-bright)", letterSpacing: "0.30em", textAlign: "center" }}>
          ACT II · WHAT IT COSTS YOU · BY COMPANY SIZE
        </div>
        <div className="aria-serif" style={{ fontSize: 26, color: "var(--aria-cream)", textAlign: "center", marginTop: 6, fontStyle: "italic", lineHeight: 1.2 }}>
          ARIA at iisupp.net pricing — versus an in-house desk operating at <span style={{ color: "var(--aria-gold-bright)" }}>100% capacity</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--aria-cream-faint)", textAlign: "center", marginTop: 4 }}>
          Salaries only. Training, coaching, benefits, attrition not yet added.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, flex: 1, minHeight: 0, paddingTop: 14 }}>
        {VS_TIERS.map((tier, i) => {
          const p = tierProg(i);
          const e = ease(p);
          const human = tier.agents.count * tier.agents.salary;
          const savings = human - tier.aria;
          const ratio = (human / tier.aria).toFixed(1);
          const ariaShown = Math.round(tier.aria * e);
          const humanShown = Math.round(human * e);
          const savShown = Math.round(savings * e);
          const reveal = Math.min(1, Math.max(0, (localT - (0.5 + i * 1.0)) / 0.6));
          return (
            <div key={tier.key} className="vs-card" style={{
              opacity: reveal,
              transform: `translateY(${(1-reveal) * 24}px)`,
              transition: "none",
              border: "1px solid rgba(232,201,136,0.18)",
              background: "linear-gradient(180deg, rgba(20,16,11,0.7), rgba(11,9,7,0.92))",
              display: "flex", flexDirection: "column", gap: 14, padding: "20px 22px",
            }}>
              {/* Tier header */}
              <div>
                <div className="aria-mono" style={{ fontSize: 10, color: "var(--aria-gold)", letterSpacing: "0.26em" }}>{tier.label}</div>
                <div style={{ fontSize: 11.5, color: "var(--aria-cream-faint)", marginTop: 4 }}>{tier.detail}</div>
              </div>

              <div className="aria-hr"/>

              {/* ARIA cost */}
              <div>
                <div className="aria-mono" style={{ fontSize: 9, color: "var(--aria-cream-faint)", letterSpacing: "0.22em" }}>ARIA · ALL-IN · YEAR</div>
                <div className="aria-serif" style={{ fontSize: 44, color: "var(--aria-gold-bright)", lineHeight: 1, marginTop: 4, fontVariantNumeric: "tabular-nums", textShadow: "0 0 20px rgba(232,201,136,0.25)" }}>
                  {fmt(ariaShown)}
                </div>
                <div style={{ fontSize: 11, color: "var(--aria-cream-dim)", marginTop: 4 }}>Unlimited concurrency · 24/7/365 · 47 languages</div>
              </div>

              <div style={{ textAlign: "center", color: "var(--aria-cream-faint)", fontSize: 11, fontStyle: "italic", fontFamily: "Cormorant Garamond" }}>versus</div>

              {/* Human team cost */}
              <div>
                <div className="aria-mono" style={{ fontSize: 9, color: "var(--aria-cream-faint)", letterSpacing: "0.22em" }}>IN-HOUSE TEAM · YEAR</div>
                <div className="aria-serif" style={{ fontSize: 38, color: "var(--aria-cream)", lineHeight: 1, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
                  {fmt(humanShown)}
                </div>
                <div style={{ fontSize: 11, color: "var(--aria-cream-dim)", marginTop: 4 }}>{tier.agents.label}</div>
                {tier.agents.min ? (
                  <div className="aria-mono" style={{ fontSize: 9, color: "var(--aria-cream-faint)", letterSpacing: "0.16em", marginTop: 6 }}>
                    RANGE · {fmt(tier.agents.min)} – {fmt(tier.agents.max)}
                  </div>
                ) : null}
              </div>

              <div style={{ flex: 1 }}/>

              {/* Savings */}
              <div style={{ borderTop: "1px solid rgba(232,201,136,0.25)", paddingTop: 12 }}>
                <div className="aria-mono" style={{ fontSize: 9, color: "var(--aria-gold)", letterSpacing: "0.26em" }}>YOU SAVE</div>
                <div className="aria-serif" style={{ fontSize: 52, color: "var(--aria-gold-bright)", lineHeight: 1, marginTop: 4, fontVariantNumeric: "tabular-nums", textShadow: "0 0 28px rgba(232,201,136,0.4)" }}>
                  {fmt(savShown)}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                  <span className="aria-chip" style={{ borderColor: "var(--aria-gold)", color: "var(--aria-gold-bright)" }}>{ratio}× LOWER</span>
                  <span style={{ fontSize: 10.5, color: "var(--aria-cream-faint)", fontStyle: "italic" }}>{tier.note}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer caveat */}
      <div style={{
        marginTop: 14, marginBottom: 18, padding: "12px 18px",
        border: "1px dashed rgba(232,201,136,0.25)", borderRadius: 8,
        background: "rgba(20,16,11,0.4)",
        opacity: vsRamp(localT, 6.0, 1.2),
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
      }}>
        <div style={{ fontSize: 12, color: "var(--aria-cream-dim)", lineHeight: 1.5 }}>
          <span className="aria-mono" style={{ fontSize: 9.5, color: "var(--aria-gold-bright)", letterSpacing: "0.20em" }}>NOTE · </span>
          Numbers above are <span style={{ color: "var(--aria-cream)" }}>salaries only</span>, assuming every agent performs at 100% every day. Real cost adds training, coaching, benefits, software seats, attrition (≈28% / yr), and after-hours coverage gaps. Act III shows the impact you can't put on a spreadsheet.
        </div>
        <div className="aria-serif" style={{ fontSize: 28, color: "var(--aria-gold-bright)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
          + {fmt(Math.round(totalSavings * vsRamp(localT, 4.0, 3.5)))}
          <div className="aria-mono" style={{ fontSize: 9, color: "var(--aria-cream-faint)", letterSpacing: "0.20em", marginTop: 2, textAlign: "right" }}>COMBINED ANNUAL SAVINGS</div>
        </div>
      </div>
    </div>
  );
};

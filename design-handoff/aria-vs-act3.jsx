// aria-vs-act3.jsx — Beyond the savings (95–150s)
// Productivity, user impact, sick days, single-agent absence, knowledge consistency.

window.VsAct3 = function VsAct3({ t, localT }) {
  const reveal = (start, dur=0.6) => Math.min(1, Math.max(0, (localT - start) / dur));

  const benefits = [
    {
      start: 0.4,
      tag: "PRODUCTIVITY",
      stat: "+34%",
      statLabel: "EMPLOYEE OUTPUT WHEN IT FRICTION REMOVED",
      title: "Hours back, instantly.",
      body: "Every minute an employee waits on IT is a minute they're not doing the work you hired them for. ARIA answers in under 9 seconds, 24/7. The hour a developer used to lose to a printer queue, a license reset, or a VPN issue stays inside the work day. Multiply that across the company and you've effectively added a quarter of your workforce — without hiring.",
    },
    {
      start: 1.4,
      tag: "USER EXPERIENCE",
      stat: "98% CSAT",
      statLabel: "CONSISTENT · EVERY USER · EVERY HOUR",
      title: "The same calm, every time.",
      body: "Human agents have good days and bad days. They get short with frustrated callers, lose patience with repeat questions, take it personally when escalated. ARIA does not. She greets the angry CFO and the timid intern with identical warmth, in their language, at 3 a.m. or 3 p.m. Frustration, ego, communication style — none of it leaks into the support experience.",
    },
    {
      start: 2.4,
      tag: "SICK DAYS · BURNOUT · ATTRITION",
      stat: "0 / YEAR",
      statLabel: "ARIA · NO SICK DAYS · NO BURNOUT · NO ATTRITION",
      title: "One absent agent. Whole desk slows.",
      body: "U.S. average: 8.2 sick days per agent, per year. On a 4-person desk, that's 33 days a year your team is operating short-handed — every absence pushes queue depth, response time, and CSAT in the wrong direction. Add holidays, PTO, training, parental leave and the math gets brutal. ARIA never calls in sick, never burns out, never quits two weeks before your busiest month.",
    },
    {
      start: 3.4,
      tag: "KNOWLEDGE & CONSISTENCY",
      stat: "1 SOURCE",
      statLabel: "ONE BRAIN · ALWAYS CURRENT · NEVER FORGOTTEN",
      title: "What she learns once, she knows forever.",
      body: "Every onboarded agent is six weeks of training and a year of seasoning before they're good. They leave. The knowledge leaves with them. ARIA is trained once and is instantly fluent across the entire knowledge base — a new policy, a new product, a new acquisition's stack — every instance of her knows it within minutes. No tribal knowledge. No stale runbooks.",
    },
  ];

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", padding: "0 32px 24px" }}>
      <div style={{ marginBottom: 8, opacity: reveal(0, 0.6) }}>
        <div className="aria-mono" style={{ fontSize: 11, color: "var(--aria-gold-bright)", letterSpacing: "0.30em", textAlign: "center" }}>
          ACT III · WHAT MONEY DOESN'T MEASURE
        </div>
        <div className="aria-serif" style={{ fontSize: 26, color: "var(--aria-cream)", textAlign: "center", marginTop: 6, fontStyle: "italic", lineHeight: 1.2 }}>
          The cost you can't put on a spreadsheet
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, flex: 1, minHeight: 0, paddingTop: 6 }}>
        {benefits.map((b, i) => {
          const r = reveal(b.start, 0.6);
          return (
            <div key={b.tag} className="vs-card" style={{
              opacity: r,
              transform: `translateY(${(1 - r) * 18}px)`,
              border: "1px solid rgba(232,201,136,0.18)",
              background: "linear-gradient(180deg, rgba(20,16,11,0.65), rgba(11,9,7,0.88))",
              padding: "20px 22px",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div className="aria-mono" style={{ fontSize: 9.5, color: "var(--aria-gold)", letterSpacing: "0.26em" }}>{b.tag}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                <div className="aria-serif" style={{ fontSize: 52, color: "var(--aria-gold-bright)", lineHeight: 1, fontVariantNumeric: "tabular-nums", textShadow: "0 0 22px rgba(232,201,136,0.3)" }}>
                  {b.stat}
                </div>
                <div className="aria-mono" style={{ fontSize: 8.5, color: "var(--aria-cream-faint)", letterSpacing: "0.18em", lineHeight: 1.5 }}>{b.statLabel}</div>
              </div>
              <div className="aria-serif" style={{ fontSize: 22, color: "var(--aria-cream)", lineHeight: 1.2, marginTop: 2 }}>{b.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--aria-cream-dim)", lineHeight: 1.55, textWrap: "pretty" }}>{b.body}</div>
            </div>
          );
        })}
      </div>

      {/* Closing line */}
      <div style={{ textAlign: "center", marginTop: 14, opacity: reveal(5.0, 1.0) }}>
        <div className="aria-serif" style={{ fontSize: 30, fontStyle: "italic", color: "var(--aria-cream)", letterSpacing: "0.01em" }}>
          ARIA never has a bad day.
        </div>
        <div className="aria-mono" style={{ fontSize: 11, color: "var(--aria-gold-bright)", letterSpacing: "0.30em", marginTop: 8 }}>
          IISUPP.NET
        </div>
      </div>
    </div>
  );
};

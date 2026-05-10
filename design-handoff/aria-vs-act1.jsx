// aria-vs-act1.jsx — KPI / SLA side-by-side (0–45s)
// Renders: ARIA card vs Human Team card with live KPIs and roster.

window.VsAct1 = function VsAct1({ t }) {
  // ARIA stats
  const aTickets = Math.floor(2 + t * 4.6);
  const aQueue = Math.max(0, Math.floor(2 + 3 * Math.sin(t * 0.4)));
  const aAht = (8.4 + 0.4 * Math.sin(t * 0.8)).toFixed(1);
  const aCsat = (98 + 1.2 * Math.sin(t * 0.5)).toFixed(1);
  const aSla  = (99.6 + 0.3 * Math.sin(t * 0.6)).toFixed(1);

  // Human team stats
  const productive = vsProductiveCount(t);
  const hTickets = Math.floor(t * 0.42);
  const hQueue = Math.max(0, 38 + Math.floor(8 * Math.sin(t * 0.4)) + Math.max(0, 4 - productive) * 8);
  const hAht = (14.2 + 1.2 * Math.sin(t * 0.7)).toFixed(1);
  const hCsat = (78 + 4 * Math.sin(t * 0.45)).toFixed(1);
  const hSla  = (62 + 6 * Math.sin(t * 0.55)).toFixed(1);

  // Team mood
  let moodSum = 0, moodN = 0;
  for (let i = 0; i < VS_TEAM.length; i++) {
    const { state, mood } = vsAgentAt(i, t);
    if (state !== "pto") { moodSum += mood; moodN++; }
  }
  const teamMood = moodN ? Math.round((moodSum / moodN) * 100) : 0;

  // Cycling tagline within act
  const callouts = [
    { t: 0,  text: "ACT I · LIVE OPERATIONS · KPI & SLA" },
    { t: 12, text: "SAME TICKET LOAD · TWO TEAMS" },
    { t: 24, text: "MOOD · TRAINING · BREAKS · PTO ALL VISIBLE" },
    { t: 36, text: "AT 9 PM · ARIA STILL ANSWERS" },
  ];
  let active = callouts[0];
  for (const c of callouts) if (t >= c.t) active = c;

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "0 32px 8px" }}>
        <div className="aria-mono" style={{ fontSize: 11, color: "var(--aria-gold-bright)", letterSpacing: "0.30em", textAlign: "center" }}>{active.text}</div>
      </div>
      <div style={{ padding: "8px 32px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, flex: 1, minHeight: 0 }}>
        {/* ============================================================ ARIA SIDE */}
        <div className="vs-card aria" style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <AnimatedGlobe size={56} letter="A" energy={1.2} t={t}/>
              <div>
                <div className="aria-serif" style={{ fontSize: 26, lineHeight: 1 }}>ARIA</div>
                <div className="aria-mono" style={{ fontSize: 9, color: "var(--aria-gold)", letterSpacing: "0.20em", marginTop: 4 }}>SERVICE INTELLIGENCE · INSTANCE 01</div>
              </div>
            </div>
            <span className="aria-chip" style={{ borderColor: "rgba(127,179,122,0.5)", color: "var(--aria-success)" }}>● ALWAYS ON</span>
          </div>
          <div className="aria-hr"/>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[["TICKETS RESOLVED · TODAY", aTickets.toLocaleString()], ["AVG HANDLE TIME", `${aAht}s`], ["LIVE QUEUE", String(aQueue)]].map(([k,v]) => (
              <div key={k}>
                <div className="aria-mono" style={{ fontSize: 8.5, color: "var(--aria-cream-faint)", letterSpacing: "0.20em" }}>{k}</div>
                <div className="vs-kpi-num gold" style={{ marginTop: 6 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div className="aria-mono" style={{ fontSize: 8.5, color: "var(--aria-cream-faint)", letterSpacing: "0.20em" }}>CSAT</div>
              <div className="vs-kpi-num gold" style={{ marginTop: 6, fontSize: 28 }}>{aCsat}%</div>
              <div className="vs-bar" style={{ marginTop: 6 }}><span className="gold" style={{ width: `${aCsat}%` }}/></div>
            </div>
            <div>
              <div className="aria-mono" style={{ fontSize: 8.5, color: "var(--aria-cream-faint)", letterSpacing: "0.20em" }}>SLA · FIRST RESPONSE</div>
              <div className="vs-kpi-num gold" style={{ marginTop: 6, fontSize: 28 }}>{aSla}%</div>
              <div className="vs-bar" style={{ marginTop: 6 }}><span className="gold" style={{ width: `${aSla}%` }}/></div>
            </div>
          </div>
          <div className="aria-hr"/>
          <div>
            <div className="aria-mono" style={{ fontSize: 8.5, color: "var(--aria-cream-faint)", letterSpacing: "0.20em", marginBottom: 8 }}>OPERATIONAL STATE</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[["Patience","INFINITE"],["Mood","STABLE"],["Communication","CONSISTENT"],["Tone","CALM · WARM"],["Languages","47 LIVE"],["Knowledge base","REAL-TIME"],["Coffee breaks","0 / DAY"],["Sick days","0 / YEAR"]].map(([k,v])=>(
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px dashed var(--aria-line-soft)" }}>
                  <span style={{ fontSize: 11.5, color: "var(--aria-cream-dim)" }}>{k}</span>
                  <span className="aria-mono" style={{ fontSize: 9.5, color: "var(--aria-gold-bright)", letterSpacing: "0.16em" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto" }}>
            <div style={{ flex: 1 }}>
              <div className="aria-mono" style={{ fontSize: 8.5, color: "var(--aria-cream-faint)", letterSpacing: "0.20em" }}>TEAM MOOD INDEX</div>
              <div className="mood-bar" style={{ marginTop: 6 }}>
                <span className="gold" style={{ background: "linear-gradient(90deg, var(--aria-gold), var(--aria-gold-bright))", width: `${96 + 0.5 * Math.sin(t)}%`, boxShadow: "0 0 8px rgba(232,201,136,0.4)" }}/>
              </div>
            </div>
            <div className="aria-mono" style={{ fontSize: 11, color: "var(--aria-gold-bright)", letterSpacing: "0.14em" }}>96 / 100</div>
          </div>
        </div>

        {/* ============================================================ HUMAN TEAM */}
        <div className="vs-card team" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: 999, border: "1px solid var(--aria-line)", display: "grid", placeItems: "center", color: "var(--aria-cream-dim)", fontFamily: "Cormorant Garamond", fontSize: 22, background: "rgba(237,230,214,0.04)" }}>7</div>
              <div>
                <div className="aria-serif" style={{ fontSize: 26, lineHeight: 1 }}>Service Desk</div>
                <div className="aria-mono" style={{ fontSize: 9, color: "var(--aria-cream-faint)", letterSpacing: "0.20em", marginTop: 4 }}>HUMAN TEAM · 7 AGENTS · 9–6 PT</div>
              </div>
            </div>
            <span className="aria-chip">{productive} / 7 ACTIVE NOW</span>
          </div>
          <div className="aria-hr"/>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[["TICKETS RESOLVED · TODAY", hTickets.toLocaleString()], ["AVG HANDLE TIME", `${hAht}m`], ["LIVE QUEUE", String(hQueue)]].map(([k,v]) => (
              <div key={k}>
                <div className="aria-mono" style={{ fontSize: 8.5, color: "var(--aria-cream-faint)", letterSpacing: "0.20em" }}>{k}</div>
                <div className="vs-kpi-num cream" style={{ marginTop: 6 }}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div className="aria-mono" style={{ fontSize: 8.5, color: "var(--aria-cream-faint)", letterSpacing: "0.20em" }}>CSAT</div>
              <div className="vs-kpi-num cream" style={{ marginTop: 6, fontSize: 28 }}>{hCsat}%</div>
              <div className="vs-bar" style={{ marginTop: 6 }}><span className="cream" style={{ width: `${hCsat}%` }}/></div>
            </div>
            <div>
              <div className="aria-mono" style={{ fontSize: 8.5, color: "var(--aria-cream-faint)", letterSpacing: "0.20em" }}>SLA · FIRST RESPONSE</div>
              <div className="vs-kpi-num cream" style={{ marginTop: 6, fontSize: 28 }}>{hSla}%</div>
              <div className="vs-bar" style={{ marginTop: 6 }}><span className="cream" style={{ width: `${hSla}%` }}/></div>
            </div>
          </div>
          <div className="aria-hr"/>
          <div>
            <div className="aria-mono" style={{ fontSize: 8.5, color: "var(--aria-cream-faint)", letterSpacing: "0.20em", marginBottom: 6 }}>AGENT ROSTER · LIVE STATE</div>
            <div>
              {VS_TEAM.map((a, i) => {
                const { state, mood } = vsAgentAt(i, t);
                const lbl = VS_STATE_LABELS[state];
                const moodPct = Math.round(mood * 100);
                return (
                  <div key={i} className="agent-row">
                    <div style={{ width: 28, height: 28, borderRadius: 999, border: "1px solid var(--aria-line)", fontSize: 10, fontFamily: "JetBrains Mono", letterSpacing: "0.10em", display: "grid", placeItems: "center", color: "var(--aria-cream-dim)", background: "rgba(237,230,214,0.04)" }}>{a.name.split(" ").map(n => n[0]).join("")}</div>
                    <div>
                      <div className="agent-name">{a.name}</div>
                      <div className="aria-mono" style={{ fontSize: 8.5, color: "var(--aria-cream-faint)", letterSpacing: "0.16em" }}>{a.role}</div>
                    </div>
                    <div className={`agent-state state-${state}`}>{lbl}</div>
                    <div>
                      <div className="mood-bar"><span style={{ width: `${moodPct}%`, background: state === "pto" ? "var(--aria-cream-faint)" : state === "frust" ? "var(--aria-danger)" : state === "active" ? "var(--aria-success)" : "rgba(237,230,214,0.45)" }}/></div>
                      <div className="aria-mono" style={{ fontSize: 8, color: "var(--aria-cream-faint)", letterSpacing: "0.14em", marginTop: 3, textAlign: "right" }}>MOOD · {moodPct}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto" }}>
            <div style={{ flex: 1 }}>
              <div className="aria-mono" style={{ fontSize: 8.5, color: "var(--aria-cream-faint)", letterSpacing: "0.20em" }}>TEAM MOOD INDEX</div>
              <div className="mood-bar" style={{ marginTop: 6 }}>
                <span style={{ width: `${teamMood}%`, background: teamMood > 70 ? "var(--aria-success)" : teamMood > 50 ? "#D9C272" : "var(--aria-danger)" }}/>
              </div>
            </div>
            <div className="aria-mono" style={{ fontSize: 11, color: "var(--aria-cream)", letterSpacing: "0.14em" }}>{teamMood} / 100</div>
          </div>
        </div>
      </div>
    </div>
  );
};

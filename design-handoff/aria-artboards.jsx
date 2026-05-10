// ARIA artboards — each scene is a self-contained design frame
const { useState: useStateAB } = React;

// ============================================================
// SCENE 1 — Main Dashboard (Research Mode, mirrors reference)
// ============================================================
window.SceneDashboard = function SceneDashboard() {
  return (
    <div className="aria-frame">
      <AriaTagline>AND SHE GOES EVERYWHERE WITH YOU</AriaTagline>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 440px", height: "calc(100% - 64px)", gap: 0, padding: "0 28px 28px" }}>
        <AriaBrowser url="research.iisupport.net/q/enterprise-saas-comparison">
          <div style={{ padding: "44px 56px" }}>
            <div className="aria-serif" style={{ fontSize: 38, lineHeight: 1.1, letterSpacing: "-0.005em" }}>
              Top 10 Enterprise SaaS Platforms — 2026 Comparison
            </div>
            <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div className="aria-placeholder" style={{ height: 150 }}>HERO IMAGERY</div>
              <div className="aria-placeholder" style={{ height: 150 }}>MARKET CHART</div>
            </div>
            <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="skel" style={{ width: "92%" }}/>
              <div className="skel" style={{ width: "78%" }}/>
              <div className="skel" style={{ width: "85%" }}/>
              <div className="skel" style={{ width: "60%" }}/>
            </div>
            <div style={{ marginTop: 28, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              <div className="aria-placeholder" style={{ height: 110 }}>VENDOR · A</div>
              <div className="aria-placeholder" style={{ height: 110 }}>VENDOR · B</div>
              <div className="aria-placeholder" style={{ height: 110 }}>VENDOR · C</div>
            </div>
          </div>
        </AriaBrowser>
        <AriaPanel/>
      </div>
    </div>
  );
};

// ============================================================
// SCENE 2 — Luxury Product Research (generic watchmaker)
// ============================================================
window.SceneLuxuryResearch = function SceneLuxuryResearch() {
  const watches = [
    { name: "Aurelian Marine", ref: "REF. 14260-AU", price: "$28,400", tag: "NEW · 2026" },
    { name: "Régent Perpetual", ref: "REF. 31330-RG", price: "$36,900", tag: "LIMITED" },
    { name: "Sovereign GMT", ref: "REF. 22810-SV", price: "$19,200", tag: "NEW · 2026" },
    { name: "Nocturne Tourbillon", ref: "REF. 99001-NC", price: "$184,000", tag: "MAISON" },
  ];
  return (
    <div className="aria-frame">
      <AriaTagline>EVERY QUERY · ANSWERED · BEAUTIFULLY</AriaTagline>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 440px", height: "calc(100% - 64px)", padding: "0 28px 28px" }}>
        <AriaBrowser url="maison-horloge.com/collections/2026">
          <div style={{ padding: "32px 44px", display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <div className="aria-mono" style={{ fontSize: 10, letterSpacing: "0.30em", color: "var(--aria-gold)" }}>MAISON HORLOGE · GENÈVE 1847</div>
              <div className="aria-mono" style={{ fontSize: 9.5, color: "var(--aria-cream-faint)", letterSpacing: "0.18em" }}>COLLECTION · 2026</div>
            </div>
            <div className="aria-serif" style={{ fontSize: 42, lineHeight: 1.05, letterSpacing: "-0.005em", marginTop: 6 }}>
              The newest <span style={{ fontStyle: "italic", color: "var(--aria-gold-bright)" }}>chronographs</span>, curated.
            </div>
            <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, flex: 1 }}>
              {watches.map((w, i) => (
                <div key={i} className="aria-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, position: "relative" }}>
                  <div style={{ position: "absolute", top: 12, right: 12 }} className="aria-chip">{w.tag}</div>
                  <div className="aria-placeholder" style={{ height: 140 }}>WATCH · PRODUCT SHOT</div>
                  <div>
                    <div className="aria-serif" style={{ fontSize: 22, lineHeight: 1.1 }}>{w.name}</div>
                    <div className="aria-mono" style={{ fontSize: 9.5, color: "var(--aria-cream-faint)", letterSpacing: "0.18em", marginTop: 4 }}>{w.ref}</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--aria-line-soft)", paddingTop: 10 }}>
                    <span style={{ fontSize: 14, color: "var(--aria-gold-bright)" }}>{w.price}</span>
                    <AriaIcon name="arrow" size={14} color="var(--aria-gold)"/>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <AriaBubble kind="suggestion">
                Would you like me to compare <em>pricing</em>, <em>availability</em>, or <em>investment value</em> across the four references?
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <span className="aria-chip" style={{ borderColor: "var(--aria-line-strong)", color: "var(--aria-gold-bright)" }}>+ Pricing</span>
                  <span className="aria-chip">+ Availability</span>
                  <span className="aria-chip">+ Investment</span>
                </div>
              </AriaBubble>
              <AriaBubble kind="note">
                I found the newest collections directly from Maison Horloge's official catalogue, filtered to in-stock European boutiques.
              </AriaBubble>
            </div>
          </div>
        </AriaBrowser>
        <AriaPanel globeLetter="A"/>
      </div>
    </div>
  );
};

// ============================================================
// SCENE 3 — IT Support, Choice screen
// ============================================================
window.SceneSupportChoice = function SceneSupportChoice() {
  return (
    <div className="aria-frame">
      <AriaTagline>SUPPORT · ENTERPRISE · TIER ONE</AriaTagline>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 440px", height: "calc(100% - 64px)", padding: "0 28px 28px" }}>
        <AriaBrowser url="aria.iisupport.net/session/2861">
          <div style={{ padding: "44px 56px", display: "flex", flexDirection: "column", height: "100%", gap: 26 }}>
            <div>
              <div className="section-label" style={{ marginBottom: 14 }}>SESSION · #2861 · {`L1 · INCIDENT`}</div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
                <div className="aria-mono" style={{ fontSize: 10, letterSpacing: "0.20em", color: "var(--aria-cream-faint)", paddingTop: 4 }}>YOU</div>
                <div className="aria-card" style={{ padding: 14, fontSize: 15, color: "var(--aria-cream)", maxWidth: 520 }}>
                  My Mail app is not opening.
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div className="aria-mono" style={{ fontSize: 10, letterSpacing: "0.20em", color: "var(--aria-gold)", paddingTop: 4 }}>ARIA</div>
                <div style={{ maxWidth: 580 }}>
                  <div className="aria-serif" style={{ fontSize: 26, lineHeight: 1.25 }}>
                    I can either guide you step-by-step,<br/>or resolve the issue for you remotely.
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--aria-cream-dim)", marginTop: 8 }}>
                    Both options are safe and reversible. Which would you prefer?
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="choice-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span className="num">01</span>
                  <span className="aria-chip">GUIDED</span>
                </div>
                <div className="aria-serif" style={{ fontSize: 26, marginTop: 24 }}>Walk me through it</div>
                <div style={{ fontSize: 13, color: "var(--aria-cream-dim)", marginTop: 8, lineHeight: 1.5 }}>
                  ARIA narrates each step with on-screen markers. You stay in control of the keyboard and mouse.
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
                  <span className="aria-chip">EST. 2 MIN</span>
                  <span className="aria-chip">YOU IN CONTROL</span>
                </div>
              </div>
              <div className="choice-card featured">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <span className="num">02</span>
                  <span className="aria-chip" style={{ borderColor: "var(--aria-line-strong)", color: "var(--aria-gold-bright)" }}>RECOMMENDED</span>
                </div>
                <div className="aria-serif" style={{ fontSize: 26, marginTop: 24 }}>Resolve it for me</div>
                <div style={{ fontSize: 13, color: "var(--aria-cream-dim)", marginTop: 8, lineHeight: 1.5 }}>
                  ARIA performs the fix remotely under audited permissions. You'll see every action and can intervene anytime.
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
                  <span className="aria-chip">EST. 18 SEC</span>
                  <span className="aria-chip">FULL AUDIT TRAIL</span>
                </div>
              </div>
            </div>

            <AriaBubble kind="note" style={{ marginTop: "auto" }}>
              <em>Don't worry</em> — I'll help you through this step by step. You can switch modes at any time, and nothing is changed without your consent.
            </AriaBubble>
          </div>
        </AriaBrowser>
        <AriaPanel globeLetter="A" micState="speaking"/>
      </div>
    </div>
  );
};

// ============================================================
// SCENE 4 — Walk-me-through flow
// ============================================================
window.SceneWalkthrough = function SceneWalkthrough() {
  const steps = [
    { n: "01", title: "Open the Process Manager", body: "Press Ctrl + Shift + Esc. ARIA will spotlight the window when it appears.", state: "done" },
    { n: "02", title: "Locate the Mail process", body: "Sort by 'Memory' — ARIA has highlighted the row consuming 412 MB but not responding.", state: "active" },
    { n: "03", title: "End the unresponsive task", body: "Click 'End Task'. The icon will pulse gold once it's safe to proceed.", state: "next" },
    { n: "04", title: "Relaunch Mail", body: "ARIA will reopen the app from the dock and verify it loads cleanly.", state: "next" },
  ];
  return (
    <div className="aria-frame">
      <AriaTagline>GUIDED RESOLUTION · 02 OF 04</AriaTagline>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 440px", height: "calc(100% - 64px)", padding: "0 28px 28px" }}>
        <AriaBrowser url="aria.iisupport.net/session/2861/guided">
          <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", height: "100%" }}>
            {/* Step rail */}
            <div style={{ borderRight: "1px solid var(--aria-line-soft)", padding: "30px 22px", display: "flex", flexDirection: "column", gap: 18 }}>
              <div className="section-label">RESOLUTION PATH</div>
              {steps.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 12, opacity: s.state === "next" ? 0.45 : 1 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    border: s.state === "active" ? "1px solid var(--aria-gold-bright)" : "1px solid var(--aria-line)",
                    background: s.state === "done" ? "linear-gradient(180deg, #C9A567, #8C6F3F)" : "transparent",
                    color: s.state === "done" ? "#0B0907" : "var(--aria-gold)",
                    display: "grid", placeItems: "center",
                    fontFamily: "JetBrains Mono", fontSize: 10, flexShrink: 0,
                    boxShadow: s.state === "active" ? "0 0 12px rgba(232,201,136,0.35)" : "none",
                  }}>
                    {s.state === "done" ? <AriaIcon name="check" size={12}/> : s.n}
                  </div>
                  <div>
                    <div className="aria-serif" style={{ fontSize: 16, lineHeight: 1.2 }}>{s.title}</div>
                    {s.state === "active" && <div style={{ fontSize: 11.5, color: "var(--aria-cream-dim)", marginTop: 4, lineHeight: 1.5 }}>{s.body}</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Stage — fake task manager */}
            <div style={{ padding: 26, position: "relative" }}>
              <div className="aria-serif" style={{ fontSize: 28, marginBottom: 4 }}>Let's check if Mail is stuck in the background.</div>
              <div style={{ fontSize: 13, color: "var(--aria-cream-dim)", marginBottom: 22 }}>ARIA voice guidance — listen for the chime when each cue is ready.</div>

              <div className="aria-card-elev" style={{ padding: 0, overflow: "hidden", position: "relative" }}>
                <div style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--aria-line-soft)", alignItems: "center" }}>
                  <AriaIcon name="cpu" size={14} color="var(--aria-gold)"/>
                  <span className="aria-mono" style={{ fontSize: 10.5, letterSpacing: "0.18em", color: "var(--aria-cream)" }}>PROCESS MANAGER · LIVE</span>
                  <span style={{ flex: 1 }}/>
                  <span className="aria-mono" style={{ fontSize: 9.5, color: "var(--aria-cream-faint)", letterSpacing: "0.16em" }}>27 PROCESSES</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 80px 80px 90px", padding: "8px 14px", borderBottom: "1px solid var(--aria-line-soft)" }}>
                  {["NAME", "CPU", "MEM", "STATUS"].map(h => (
                    <span key={h} className="aria-mono" style={{ fontSize: 9, letterSpacing: "0.20em", color: "var(--aria-cream-faint)" }}>{h}</span>
                  ))}
                </div>
                {[
                  ["System Helper", "1.2%", "62 MB", "OK"],
                  ["Mail", "0.0%", "412 MB", "NOT RESPONDING", true],
                  ["Browser Tab Group", "3.8%", "204 MB", "OK"],
                  ["Background Sync", "0.4%", "44 MB", "OK"],
                  ["Audio Service", "0.2%", "12 MB", "OK"],
                ].map(([n, c, m, s, hl], i) => (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "1.5fr 80px 80px 90px",
                    padding: "10px 14px",
                    background: hl ? "linear-gradient(90deg, rgba(232,201,136,0.10), transparent 60%)" : "transparent",
                    borderBottom: "1px solid var(--aria-line-soft)",
                    position: "relative",
                  }}>
                    {hl && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: "var(--aria-gold-bright)", boxShadow: "0 0 12px var(--aria-gold-bright)" }}/>}
                    <span style={{ fontSize: 12, color: hl ? "var(--aria-gold-bright)" : "var(--aria-cream)" }}>{n}</span>
                    <span className="aria-mono" style={{ fontSize: 11, color: "var(--aria-cream-dim)" }}>{c}</span>
                    <span className="aria-mono" style={{ fontSize: 11, color: "var(--aria-cream-dim)" }}>{m}</span>
                    <span className="aria-mono" style={{ fontSize: 9.5, color: hl ? "var(--aria-danger)" : "var(--aria-success)", letterSpacing: "0.14em" }}>{s}</span>
                  </div>
                ))}
                <div style={{ padding: "12px 14px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <span className="aria-btn">Details</span>
                  <span className="aria-btn aria-btn-primary"><AriaIcon name="bolt" size={11}/> End Task</span>
                </div>

                {/* ARIA pointer arrow */}
                <div style={{
                  position: "absolute", left: -14, top: 156,
                  display: "flex", alignItems: "center", gap: 8,
                  background: "rgba(11,9,7,0.9)", border: "1px solid var(--aria-gold)", borderRadius: 8, padding: "6px 10px",
                  boxShadow: "0 0 22px rgba(232,201,136,0.35)",
                  transform: "translateX(-100%)"
                }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: "linear-gradient(180deg, #C9A567, #8C6F3F)", display: "grid", placeItems: "center", color: "#0B0907", fontSize: 9, fontWeight: 700 }}>A</span>
                  <span className="aria-mono" style={{ fontSize: 10, letterSpacing: "0.14em" }}>SELECT THIS ROW →</span>
                </div>
              </div>

              <AriaBubble kind="note" style={{ marginTop: 18 }}>
                Once the unresponsive task is closed, I'll relaunch Mail and confirm your inbox loads. Say <em>"pause"</em> to stop at any time.
              </AriaBubble>
            </div>
          </div>
        </AriaBrowser>
        <AriaPanel globeLetter="A" micState="speaking"/>
      </div>
    </div>
  );
};

// ============================================================
// SCENE 5 — Resolve-it-for-me (autonomous)
// ============================================================
window.SceneResolve = function SceneResolve() {
  return (
    <div className="aria-frame">
      <AriaTagline>AUTONOMOUS RESOLUTION · COMPLETE</AriaTagline>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 440px", height: "calc(100% - 64px)", padding: "0 28px 28px" }}>
        <AriaBrowser url="aria.iisupport.net/session/2861/resolved">
          <div style={{ padding: "30px 38px", display: "flex", flexDirection: "column", height: "100%", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="section-label">REMOTE EXECUTION · SESSION #2861</div>
                <div className="aria-serif" style={{ fontSize: 30, marginTop: 6 }}>Mail has been restored successfully.</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", border: "1px solid rgba(127,179,122,0.4)", borderRadius: 999, background: "rgba(127,179,122,0.08)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--aria-success)", boxShadow: "0 0 10px var(--aria-success)" }}/>
                <span className="aria-mono" style={{ fontSize: 10, letterSpacing: "0.20em", color: "var(--aria-success)" }}>RESOLVED · 17.4s</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, flex: 1 }}>
              {/* Audit log */}
              <div className="aria-card-elev" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--aria-line-soft)" }}>
                  <AriaIcon name="cursor" size={12} color="var(--aria-gold)"/>
                  <span className="section-label">AUDIT TRAIL</span>
                  <span style={{ flex: 1 }}/>
                  <span className="aria-mono" style={{ fontSize: 9.5, color: "var(--aria-cream-faint)", letterSpacing: "0.16em" }}>5 ACTIONS</span>
                </div>
                <div style={{ flex: 1 }}>
                  {[
                    ["14:42:08", "info", "Permission token validated · device-2861-MX"],
                    ["14:42:09", "info", "Process Manager opened by ARIA cursor"],
                    ["14:42:11", "warn", "Mail.exe → Not Responding (412 MB / 0% CPU)"],
                    ["14:42:14", "ok",   "Mail.exe terminated · safe-state confirmed"],
                    ["14:42:25", "ok",   "Mail relaunched · inbox synced (1,204 messages)"],
                  ].map(([ts, lvl, msg], i) => (
                    <div key={i} className="console-row">
                      <span className="ts">{ts}</span>
                      <span className={"lvl " + lvl}>{lvl.toUpperCase()}</span>
                      <span className="msg">{msg}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding: "12px 16px", borderTop: "1px solid var(--aria-line-soft)", display: "flex", gap: 10, alignItems: "center" }}>
                  <AriaIcon name="lock" size={12} color="var(--aria-gold)"/>
                  <span className="aria-mono" style={{ fontSize: 10, color: "var(--aria-cream-dim)", letterSpacing: "0.14em" }}>SIGNED · ARIA-CORE · CHECKSUM 0x9F3A…E1</span>
                </div>
              </div>

              {/* Outcome */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="aria-card-elev" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="section-label">SUMMARY</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                      ["TIME TO FIX", "17.4 s"],
                      ["ACTIONS TAKEN", "5"],
                      ["DOWNTIME SAVED", "≈ 22 min"],
                      ["TICKET COST", "$0.00"],
                    ].map(([k, v]) => (
                      <div key={k} style={{ padding: "10px 12px", border: "1px solid var(--aria-line-soft)", borderRadius: 6 }}>
                        <div className="aria-mono" style={{ fontSize: 8.5, color: "var(--aria-cream-faint)", letterSpacing: "0.18em" }}>{k}</div>
                        <div className="aria-serif" style={{ fontSize: 22, color: "var(--aria-gold-bright)", marginTop: 4 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="aria-card-elev" style={{ padding: 18, flex: 1 }}>
                  <div className="section-label" style={{ marginBottom: 10 }}>MAIL · LIVE PREVIEW</div>
                  <div className="aria-placeholder" style={{ height: 130 }}>RELAUNCHED · INBOX SYNCED</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
                    <AriaIcon name="check" size={12} color="var(--aria-success)"/>
                    <span style={{ fontSize: 12, color: "var(--aria-cream)" }}>1,204 messages · last sync 2 sec ago</span>
                  </div>
                </div>
              </div>
            </div>

            <AriaBubble kind="note">
              I've stored a recipe of this fix as <em>"Mail · Unresponsive"</em>. Next time, I can resolve it in under five seconds without asking again — say the word.
            </AriaBubble>
          </div>
        </AriaBrowser>
        <AriaPanel globeLetter="A"/>
      </div>
    </div>
  );
};

// ============================================================
// SCENE 6 — Voice assistant close-up
// ============================================================
window.SceneVoice = function SceneVoice() {
  const bars = [22, 38, 58, 32, 46, 70, 50, 28, 60, 42, 36, 54, 30, 48, 62, 38, 24, 44, 56, 32, 48, 28, 36, 52, 30, 22];
  return (
    <div className="aria-frame">
      <AriaTagline>VOICE INTERACTION · SUITE 14</AriaTagline>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", height: "calc(100% - 64px)", padding: "0 28px 28px", gap: 22 }}>
        {/* Left — large globe */}
        <div className="aria-card-elev" style={{ position: "relative", display: "grid", placeItems: "center", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 22, left: 22, display: "flex", alignItems: "center", gap: 10 }}>
            <span className="pulse-dot"/>
            <span className="section-label">LIVE · SPEAKING WITH SARAH</span>
          </div>
          <div style={{ position: "absolute", top: 22, right: 22 }}>
            <div className="aria-mono" style={{ fontSize: 9.5, color: "var(--aria-cream-faint)", letterSpacing: "0.18em" }}>SESSION 03:14</div>
          </div>

          <div style={{ position: "relative" }}>
            <div className="aria-globe-ring dashed" style={{ width: 460, height: 460, position: "absolute", left: -60, top: -60 }}/>
            <div className="aria-globe-ring" style={{ width: 400, height: 400, position: "absolute", left: -30, top: -30 }}/>
            <AriaGlobe size={340} letter="A"/>
          </div>

          <div style={{ position: "absolute", bottom: 26, left: 22, right: 22 }}>
            <div className="wave" style={{ marginBottom: 16 }}>
              {bars.map((h, i) => <span key={i} style={{ height: h }}/>)}
            </div>
            <div className="aria-serif" style={{ fontSize: 26, lineHeight: 1.3, color: "var(--aria-cream)" }}>
              <span style={{ color: "var(--aria-gold-bright)" }}>"</span>
              Don't worry, Sarah — I'll help you through this step by step.
              <span style={{ color: "var(--aria-gold-bright)" }}>"</span>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 14, alignItems: "center" }}>
              <span className="aria-chip">VOICE · ARIA · CALM</span>
              <span className="aria-chip">TONE · WARM</span>
              <span className="aria-chip">PACE · 92 WPM</span>
            </div>
          </div>
        </div>

        {/* Right — transcript + caller card */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="aria-card-elev" style={{ padding: 18 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>CALLER</div>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div className="aria-placeholder" style={{ width: 64, height: 64, borderRadius: 999, fontSize: 9 }}>SH</div>
              <div>
                <div className="aria-serif" style={{ fontSize: 22 }}>Sarah Hadley</div>
                <div className="aria-mono" style={{ fontSize: 10, color: "var(--aria-cream-faint)", letterSpacing: "0.18em", marginTop: 2 }}>VP OPERATIONS · MERIDIAN GROUP</div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <span className="aria-chip">PRIORITY · GOLD</span>
                  <span className="aria-chip">EN-GB</span>
                </div>
              </div>
            </div>
          </div>

          <div className="aria-card-elev" style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column" }}>
            <div className="section-label" style={{ marginBottom: 14 }}>LIVE TRANSCRIPT</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
              {[
                { who: "SARAH", t: "I'm trying to send the Q3 report but my inbox just won't open this morning.", ts: "00:04" },
                { who: "ARIA", t: "I see your Mail client is unresponsive on your work laptop. May I take a quick look on your behalf?", ts: "00:11" },
                { who: "SARAH", t: "Yes please — I have a board call in ten minutes.", ts: "00:18" },
                { who: "ARIA", t: "Don't worry, I'll help you through this step by step. I'll have you back in under twenty seconds.", ts: "00:24", active: true },
              ].map((m, i) => (
                <div key={i} style={{ display: "flex", gap: 12, opacity: m.active ? 1 : 0.7 }}>
                  <div style={{ width: 60, flexShrink: 0 }}>
                    <div className="aria-mono" style={{ fontSize: 9.5, letterSpacing: "0.20em", color: m.who === "ARIA" ? "var(--aria-gold)" : "var(--aria-cream-dim)" }}>{m.who}</div>
                    <div className="aria-mono" style={{ fontSize: 8.5, color: "var(--aria-cream-faint)", letterSpacing: "0.14em", marginTop: 2 }}>{m.ts}</div>
                  </div>
                  <div style={{ fontSize: 14, color: m.active ? "var(--aria-cream)" : "var(--aria-cream-dim)", lineHeight: 1.55, fontStyle: m.who === "ARIA" ? "italic" : "normal" }}>
                    {m.t}
                  </div>
                </div>
              ))}
            </div>
            <div className="aria-hr" style={{ margin: "16px 0 12px" }}/>
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 6 }}>
                <span className="aria-chip">SENTIMENT · CALM ↑</span>
                <span className="aria-chip">CLARITY · 98%</span>
              </div>
              <span className="aria-btn"><AriaIcon name="mic" size={11}/> Mute</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// SCENE 7 — Enterprise Operations Grid (L1 / L2 / L3)
// ============================================================
window.SceneOpsGrid = function SceneOpsGrid() {
  const tiers = [
    {
      label: "TIER 01 · FOUNDATION",
      tagline: "First-touch resolutions in seconds",
      items: [
        { icon: "key",   title: "Password reset",        meta: "AVG · 4.2s",   trend: "+18%" },
        { icon: "print", title: "Printer reconnect",     meta: "AVG · 9.0s",   trend: "+11%" },
        { icon: "wifi",  title: "Wi-Fi troubleshooting", meta: "AVG · 12.4s",  trend: "+22%" },
      ],
    },
    {
      label: "TIER 02 · OPERATIONS",
      tagline: "Network and desktop fleet at scale",
      items: [
        { icon: "lock",  title: "VPN troubleshooting",     meta: "AVG · 24.1s", trend: "+9%" },
        { icon: "mail",  title: "Mailbox sync repair",     meta: "AVG · 31.0s", trend: "+14%" },
        { icon: "wifi",  title: "Network mapping",          meta: "AVG · 46.2s", trend: "+6%" },
        { icon: "cube",  title: "Driver repair",            meta: "AVG · 38.4s", trend: "+19%" },
      ],
    },
    {
      label: "TIER 03 · INFRASTRUCTURE",
      tagline: "Server, security and recovery class incidents",
      items: [
        { icon: "server", title: "Server monitoring",         meta: "24/7 ACTIVE", trend: "STABLE" },
        { icon: "shield", title: "Threat isolation",          meta: "AVG · 1.8s",  trend: "0 INCIDENTS" },
        { icon: "key",    title: "Directory repair",          meta: "AVG · 02:14", trend: "+4%" },
        { icon: "cpu",    title: "Infrastructure diagnostics", meta: "AVG · 03:48", trend: "+12%" },
        { icon: "bolt",   title: "Remote system recovery",     meta: "AVG · 08:21", trend: "+7%" },
      ],
    },
  ];
  return (
    <div className="aria-frame">
      <AriaTagline>ENTERPRISE OPERATIONS · LIVE</AriaTagline>
      <div style={{ padding: "0 28px 28px", height: "calc(100% - 64px)", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Header strip */}
        <div className="aria-card-elev" style={{ padding: "18px 22px", display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: 22, alignItems: "center" }}>
          <div>
            <div className="section-label">GLOBAL OPERATIONS CENTER</div>
            <div className="aria-serif" style={{ fontSize: 24, marginTop: 4 }}>
              <span style={{ fontStyle: "italic", color: "var(--aria-gold-bright)" }}>4,218</span> incidents resolved in the last 24 hours.
            </div>
          </div>
          {[
            ["UPTIME", "99.998%"],
            ["MEAN RESOLVE", "11.4s"],
            ["AGENTS LIVE", "184"],
            ["REGIONS", "27"],
          ].map(([k, v]) => (
            <div key={k} style={{ textAlign: "right", paddingLeft: 22, borderLeft: "1px solid var(--aria-line-soft)" }}>
              <div className="aria-mono" style={{ fontSize: 9, color: "var(--aria-cream-faint)", letterSpacing: "0.20em" }}>{k}</div>
              <div className="aria-serif" style={{ fontSize: 22, color: "var(--aria-gold-bright)", marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, flex: 1 }}>
          {tiers.map((tier, ti) => (
            <div key={ti} className="aria-card-elev" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div className="section-label">{tier.label}</div>
                <div className="aria-serif" style={{ fontSize: 22, marginTop: 6, lineHeight: 1.2 }}>{tier.tagline}</div>
              </div>
              <div className="aria-hr"/>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                {tier.items.map((it, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 12px", border: "1px solid var(--aria-line-soft)", borderRadius: 8, background: "rgba(255,255,255,0.012)" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid var(--aria-line)", display: "grid", placeItems: "center", color: "var(--aria-gold)" }}>
                      <AriaIcon name={it.icon} size={14}/>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: "var(--aria-cream)" }}>{it.title}</div>
                      <div className="aria-mono" style={{ fontSize: 9, letterSpacing: "0.18em", color: "var(--aria-cream-faint)", marginTop: 2 }}>{it.meta}</div>
                    </div>
                    <div className="aria-mono" style={{ fontSize: 10, color: "var(--aria-gold-bright)", letterSpacing: "0.14em" }}>{it.trend}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <span className="aria-chip">AUDIT</span>
                <span className="aria-chip" style={{ borderColor: "var(--aria-line-strong)", color: "var(--aria-gold-bright)" }}>+ DEPLOY</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

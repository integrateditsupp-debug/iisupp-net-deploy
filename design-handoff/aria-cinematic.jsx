// ARIA cinematic demo — scene compositions
// Total runtime ~150s (2:30). Times in seconds.
// Scene boundaries: 0 · 11 · 30 · 47 · 76 · 100 · 130 · 150

const { useMemo: useMemoCS } = React;

window.SceneTagline = function SceneTagline({ t, start, end, text, fadeIn = 0.4, fadeOut = 0.4 }) {
  if (t < start - fadeIn || t > end + fadeOut) return null;
  let opacity = 1;
  if (t < start) opacity = (t - (start - fadeIn)) / fadeIn;
  else if (t > end) opacity = 1 - (t - end) / fadeOut;
  opacity = Math.max(0, Math.min(1, opacity));
  return (
    <div style={{ position: "absolute", top: 22, left: 0, right: 0, textAlign: "center", opacity, transition: "opacity 0.25s" }}>
      <span className="aria-tagline">{text}</span>
    </div>
  );
};

// ============================================================
// SCENE 0 — INTRO (0–11s)
// ============================================================
window.IntroScene = function IntroScene({ t, start = 0, end = 11 }) {
  if (t < start || t > end + 1) return null;
  const localT = t - start;
  const globeProg = Math.min(1, Math.max(0, (localT - 0.4) / 2.4));
  const tagProg   = Math.min(1, Math.max(0, (localT - 2.4) / 1.0));
  const titleProg = Math.min(1, Math.max(0, (localT - 3.8) / 1.0));
  const subProg   = Math.min(1, Math.max(0, (localT - 5.0) / 1.0));
  const exitProg  = Math.max(0, (localT - 9.6) / 1.4);
  const opacity = 1 - exitProg;

  return (
    <div style={{
      position: "absolute", inset: 0,
      background: "radial-gradient(ellipse at 50% 45%, #1a140d 0%, #0B0907 50%, #050402 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      opacity,
    }}>
      <div style={{ transform: `scale(${0.5 + globeProg * 0.5})`, opacity: globeProg }}>
        <AnimatedGlobe size={360} letter="A" energy={globeProg} t={t}/>
      </div>
      <div style={{ marginTop: 56, textAlign: "center", opacity: tagProg }}>
        <div className="aria-tagline" style={{ fontSize: 13 }}>AND SHE GOES EVERYWHERE WITH YOU</div>
      </div>
      <div className="aria-serif" style={{
        marginTop: 20, fontSize: 72, letterSpacing: "0.06em",
        color: "var(--aria-cream)", opacity: titleProg,
        transform: `translateY(${(1 - titleProg) * 20}px)`,
      }}>ARIA</div>
      <div style={{
        marginTop: 8, fontSize: 16, color: "var(--aria-cream-dim)", letterSpacing: "0.18em",
        fontFamily: "JetBrains Mono", opacity: subProg,
      }}>ENTERPRISE AI ASSISTANT</div>
    </div>
  );
};

// ============================================================
// SCENE 1 — PRODUCT RESEARCH (11–30s, 19s)
// User types in right-panel input → browser loads → cards stagger → suggestion
// ============================================================
window.SearchScene = function SearchScene({ t, start = 11, end = 30 }) {
  if (t < start || t > end + 1) return null;
  const localT = t - start;
  const fadeIn = Math.min(1, localT / 0.5);
  const fadeOut = Math.max(0, (localT - (end - start - 0.7)) / 0.7);
  const opacity = fadeIn * (1 - fadeOut);

  const watches = [
    { name: "Aurelian Marine",   ref: "REF. 14260-AU", price: "$28,400",  tag: "NEW · 2026" },
    { name: "Régent Perpetual",  ref: "REF. 31330-RG", price: "$36,900",  tag: "LIMITED" },
    { name: "Sovereign GMT",     ref: "REF. 22810-SV", price: "$19,200",  tag: "NEW · 2026" },
    { name: "Nocturne Tourbillon", ref: "REF. 99001-NC", price: "$184,000", tag: "MAISON" },
  ];

  // 0.0–2.0  user types in RIGHT panel input
  // 2.2–3.6  browser navigates / loads
  // 3.6–6.6  cards stagger in (4 cards × 0.4s + 0.7s settle)
  // 6.6–end  suggestion bubble appears (BELOW results)
  const queryText = "Show me the latest luxury watch collections";
  const queryProg = Math.min(1, Math.max(0, localT / 2.0));
  const queryChars = Math.floor(queryProg * queryText.length);
  const typing = localT < 2.0;
  const pageReady = localT > 2.2;
  const suggestionT = Math.max(0, localT - 6.6);

  return (
    <div className="aria-frame" style={{ position: "absolute", inset: 0, opacity }}>
      <SceneTagline t={t} start={start + 0.3} end={end - 0.5} text="SCENE · 01 · LUXURY PRODUCT RESEARCH"/>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 440px", height: "calc(100% - 60px)", padding: "60px 28px 28px" }}>
        <AriaBrowser url={pageReady ? "maison-horloge.com/collection/2026" : "—"}>
          <div style={{ padding: "24px 40px", height: "100%", display: "flex", flexDirection: "column" }}>
            {!pageReady ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, opacity: typing ? 0.35 : 0.5 + 0.5 * Math.sin(localT * 4) }}>
                <div className="aria-mono" style={{ fontSize: 10, color: "var(--aria-cream-faint)", letterSpacing: "0.20em" }}>
                  {typing ? "WAITING FOR INPUT…" : "LOADING MAISON HORLOGE…"}
                </div>
                <div className="skel" style={{ width: "60%", height: 14 }}/>
                <div className="skel" style={{ width: "85%" }}/>
                <div className="skel" style={{ width: "70%" }}/>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }}>
                  {[1,2,3,4].map(i => <div key={i} className="aria-placeholder" style={{ height: 140 }}>…</div>)}
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <div className="aria-mono" style={{ fontSize: 10, letterSpacing: "0.30em", color: "var(--aria-gold)" }}>MAISON HORLOGE · GENÈVE 1847</div>
                  <div className="aria-mono" style={{ fontSize: 9.5, color: "var(--aria-cream-faint)", letterSpacing: "0.18em" }}>COLLECTION · 2026</div>
                </div>
                <div className="aria-serif" style={{ fontSize: 36, lineHeight: 1.05, marginTop: 4 }}>
                  The newest <span style={{ fontStyle: "italic", color: "var(--aria-gold-bright)" }}>chronographs</span>, curated.
                </div>
                <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                  {watches.map((w, i) => {
                    const delay = 2.4 + i * 0.4;
                    const cardT = Math.min(1, Math.max(0, (localT - delay) / 0.5));
                    return (
                      <div key={i} className="aria-card" style={{
                        padding: 14, display: "flex", flexDirection: "column", gap: 10, position: "relative",
                        opacity: cardT,
                        transform: `translateY(${(1 - cardT) * 16}px) scale(${0.98 + 0.02 * cardT})`,
                      }}>
                        <div style={{ position: "absolute", top: 10, right: 10 }} className="aria-chip">{w.tag}</div>
                        <div className="aria-placeholder" style={{ height: 110 }}>WATCH · PRODUCT SHOT</div>
                        <div>
                          <div className="aria-serif" style={{ fontSize: 19, lineHeight: 1.1 }}>{w.name}</div>
                          <div className="aria-mono" style={{ fontSize: 9, color: "var(--aria-cream-faint)", letterSpacing: "0.18em", marginTop: 3 }}>{w.ref}</div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--aria-line-soft)", paddingTop: 8 }}>
                          <span style={{ fontSize: 13, color: "var(--aria-gold-bright)" }}>{w.price}</span>
                          <AriaIcon name="arrow" size={13} color="var(--aria-gold)"/>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {suggestionT > 0 && (
                  <div style={{
                    marginTop: 14,
                    opacity: Math.min(1, suggestionT / 0.5),
                    transform: `translateY(${Math.max(0, (1 - suggestionT) * 12)}px)`,
                  }}>
                    <AriaBubble kind="suggestion">
                      Would you like me to compare <em>pricing</em>, <em>availability</em>, or <em>investment value</em>?
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        {["Pricing", "Availability", "Investment"].map((c, i) => {
                          const hl = (Math.floor(suggestionT * 1.6) % 3) === i;
                          return <span key={c} className="aria-chip" style={{
                            borderColor: hl ? "var(--aria-gold-bright)" : "var(--aria-line)",
                            color: hl ? "var(--aria-gold-bright)" : "var(--aria-cream-dim)",
                            transition: "all 0.3s",
                          }}>+ {c}</span>;
                        })}
                      </div>
                    </AriaBubble>
                  </div>
                )}
              </>
            )}
          </div>
        </AriaBrowser>
        <AriaPanelLive
          t={t}
          energy={pageReady ? 1.0 : 0.7}
          micState={typing ? "listening" : "idle"}
          micPulse={typing}
          typedQuery={typing ? queryText.slice(0, queryChars) : null}
          typeCursor={typing && Math.floor(t * 2) % 2 === 0}
        />
      </div>
    </div>
  );
};

// ============================================================
// SCENE 2 — SUPPORT CHOICE (30–47s, 17s)
// ============================================================
window.ChoiceScene = function ChoiceScene({ t, start = 30, end = 47 }) {
  if (t < start || t > end + 1) return null;
  const localT = t - start;
  const fadeIn = Math.min(1, localT / 0.5);
  const fadeOut = Math.max(0, (localT - (end - start - 0.7)) / 0.7);
  const opacity = fadeIn * (1 - fadeOut);

  const userText = "My Mail app is not opening.";
  // User types into RIGHT panel input first, then message appears in chat
  const userTypeProg = Math.min(1, Math.max(0, localT / 1.4));
  const userTypeChars = Math.floor(userTypeProg * userText.length);
  const userTyping = localT < 1.4;
  const messageInChat = localT >= 1.5;

  const ariaShown = localT > 2.0;
  const ariaProg  = Math.min(1, Math.max(0, (localT - 2.0) / 0.8));
  const cardsShown = localT > 3.4;
  const card1T = Math.min(1, Math.max(0, (localT - 3.4) / 0.5));
  const card2T = Math.min(1, Math.max(0, (localT - 3.9) / 0.5));
  const featureT = Math.max(0, localT - 5.5);

  return (
    <div className="aria-frame" style={{ position: "absolute", inset: 0, opacity }}>
      <SceneTagline t={t} start={start + 0.3} end={end - 0.5} text="SCENE · 02 · ENTERPRISE IT SUPPORT"/>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 440px", height: "calc(100% - 60px)", padding: "60px 28px 28px" }}>
        <AriaBrowser url="aria.iisupport.net/session/2861">
          <div style={{ padding: "30px 50px", display: "flex", flexDirection: "column", height: "100%", gap: 18 }}>
            <div className="section-label">SESSION · #2861 · L1 · INCIDENT</div>

            {messageInChat ? (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div className="aria-mono" style={{ fontSize: 10, letterSpacing: "0.20em", color: "var(--aria-cream-faint)", paddingTop: 4, width: 50 }}>YOU</div>
                <div className="aria-card" style={{ padding: 14, fontSize: 15, color: "var(--aria-cream)", maxWidth: 520 }}>
                  {userText}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 12, opacity: 0.4 }}>
                <div className="aria-mono" style={{ fontSize: 10, letterSpacing: "0.20em", color: "var(--aria-cream-faint)", paddingTop: 4, width: 50 }}>YOU</div>
                <div className="aria-mono" style={{ fontSize: 11, color: "var(--aria-cream-faint)", letterSpacing: "0.16em", paddingTop: 4 }}>· typing in panel ·</div>
              </div>
            )}

            {ariaShown && (
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", opacity: ariaProg, transform: `translateY(${(1 - ariaProg) * 12}px)` }}>
                <div className="aria-mono" style={{ fontSize: 10, letterSpacing: "0.20em", color: "var(--aria-gold)", paddingTop: 4, width: 50 }}>ARIA</div>
                <div style={{ maxWidth: 580 }}>
                  <div className="aria-serif" style={{ fontSize: 24, lineHeight: 1.25 }}>
                    I can either guide you step-by-step,<br/>or resolve the issue for you remotely.
                  </div>
                  <div style={{ fontSize: 13, color: "var(--aria-cream-dim)", marginTop: 6 }}>
                    Both options are safe and reversible. Which would you prefer?
                  </div>
                </div>
              </div>
            )}

            {cardsShown && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 4 }}>
                <div className="choice-card" style={{
                  opacity: card1T, transform: `translateY(${(1 - card1T) * 14}px)`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span className="num">01</span>
                    <span className="aria-chip">GUIDED</span>
                  </div>
                  <div className="aria-serif" style={{ fontSize: 24, marginTop: 22 }}>Walk me through it</div>
                  <div style={{ fontSize: 12.5, color: "var(--aria-cream-dim)", marginTop: 8, lineHeight: 1.5 }}>
                    ARIA narrates each step with on-screen markers. You stay in control of the keyboard and mouse.
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
                    <span className="aria-chip">EST. 2 MIN</span>
                    <span className="aria-chip">YOU IN CONTROL</span>
                  </div>
                </div>
                <div className="choice-card featured" style={{
                  opacity: card2T,
                  transform: `translateY(${(1 - card2T) * 14}px) scale(${1 + 0.012 * Math.sin(localT * 3) * Math.min(1, featureT)})`,
                  boxShadow: `0 0 ${24 + 14 * Math.min(1, featureT) * (0.6 + 0.4 * Math.sin(localT * 3))}px rgba(232,201,136,0.30), inset 0 0 0 1px rgba(232,201,136,0.30)`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <span className="num">02</span>
                    <span className="aria-chip" style={{ borderColor: "var(--aria-line-strong)", color: "var(--aria-gold-bright)" }}>RECOMMENDED</span>
                  </div>
                  <div className="aria-serif" style={{ fontSize: 24, marginTop: 22 }}>Resolve it for me</div>
                  <div style={{ fontSize: 12.5, color: "var(--aria-cream-dim)", marginTop: 8, lineHeight: 1.5 }}>
                    ARIA performs the fix remotely under audited permissions. You'll see every action and can intervene anytime.
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
                    <span className="aria-chip">EST. 18 SEC</span>
                    <span className="aria-chip">FULL AUDIT TRAIL</span>
                  </div>
                  {/* AI cursor selecting card — comes in faster */}
                  {localT > 9 && localT < 14 && (() => {
                    const cT = (localT - 9) / 1.0; // 0..1 over 1.0s
                    const settled = Math.min(1, cT);
                    return (
                      <div style={{
                        position: "absolute", left: "55%", top: `${65 - settled * 8}%`,
                        transform: `translate(-50%, 0)`,
                        color: "var(--aria-gold-bright)",
                        filter: "drop-shadow(0 0 8px var(--aria-gold-bright))",
                        opacity: Math.min(1, cT * 2),
                      }}>
                        <AriaIcon name="cursor" size={22}/>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {localT > 7.5 && (
              <div style={{ marginTop: "auto", opacity: Math.min(1, (localT - 7.5) / 0.6) }}>
                <AriaBubble kind="note">
                  <em>Don't worry</em> — I'll help you through this step by step. You can switch modes at any time, and nothing is changed without your consent.
                </AriaBubble>
              </div>
            )}
          </div>
        </AriaBrowser>
        <AriaPanelLive
          t={t}
          energy={1.1}
          micState={userTyping ? "listening" : "speaking"}
          micPulse
          typedQuery={userTyping ? userText.slice(0, userTypeChars) : null}
          typeCursor={userTyping && Math.floor(t * 2) % 2 === 0}
        />
      </div>
    </div>
  );
};

// ============================================================
// SCENE 3 — RESOLVE (47–76s, 29s) — faster, more natural cursor
// ============================================================
window.ResolveScene = function ResolveScene({ t, start = 47, end = 76 }) {
  if (t < start || t > end + 1) return null;
  const localT = t - start;
  const fadeIn = Math.min(1, localT / 0.5);
  const fadeOut = Math.max(0, (localT - (end - start - 0.7)) / 0.7);
  const opacity = fadeIn * (1 - fadeOut);

  // Tighter log timing
  const logEntries = [
    { t: 0.6,  ts: "14:42:08", lvl: "info", msg: "Permission token validated · device-2861-MX" },
    { t: 2.4,  ts: "14:42:09", lvl: "info", msg: "Process Manager opened by ARIA cursor" },
    { t: 5.2,  ts: "14:42:11", lvl: "warn", msg: "Mail.exe → Not Responding (412 MB / 0% CPU)" },
    { t: 9.0,  ts: "14:42:14", lvl: "ok",   msg: "Mail.exe terminated · safe-state confirmed" },
    { t: 14.5, ts: "14:42:25", lvl: "ok",   msg: "Mail relaunched · inbox synced (1,204 messages)" },
  ];
  const successT = localT > 18 ? Math.min(1, (localT - 18) / 0.8) : 0;

  // Cursor: brisk, natural motion (~5s total)
  const kf = [
    [0.0,  220, 80,  ""],
    [0.7,  340, 250, "hover"],
    [2.0,  340, 250, "select"],
    [3.0,  560, 380, "→ End Task"],
    [3.6,  560, 380, "click"],
    [4.6,  480, 200, ""],
    [6.0,  480, 200, ""],
  ];
  function lerpCursor(time) {
    if (time <= kf[0][0]) return { x: kf[0][1], y: kf[0][2], label: kf[0][3] };
    for (let i = 0; i < kf.length - 1; i++) {
      const [t0, x0, y0, l0] = kf[i];
      const [t1, x1, y1, l1] = kf[i + 1];
      if (time >= t0 && time <= t1) {
        const u = (time - t0) / Math.max(0.0001, t1 - t0);
        // ease-in-out
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        return { x: x0 + (x1 - x0) * e, y: y0 + (y1 - y0) * e, label: u > 0.5 ? l1 : l0 };
      }
    }
    const last = kf[kf.length - 1];
    return { x: last[1], y: last[2], label: last[3] };
  }
  const cur = lerpCursor(localT);
  const cursorVisible = localT > 0.2 && localT < 7;

  return (
    <div className="aria-frame" style={{ position: "absolute", inset: 0, opacity }}>
      <SceneTagline t={t} start={start + 0.3} end={end - 0.5} text="SCENE · 03 · AUTONOMOUS RESOLUTION"/>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 440px", height: "calc(100% - 60px)", padding: "60px 28px 28px" }}>
        <AriaBrowser url="aria.iisupport.net/session/2861/resolved">
          <div style={{ padding: "24px 32px", display: "flex", flexDirection: "column", height: "100%", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="section-label">REMOTE EXECUTION · SESSION #2861</div>
                <div className="aria-serif" style={{ fontSize: 26, marginTop: 4 }}>
                  {successT > 0
                    ? <>Mail has been <span style={{ color: "var(--aria-gold-bright)" }}>restored</span> successfully.</>
                    : <>ARIA is resolving your incident…</>}
                </div>
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 14px",
                border: `1px solid ${successT > 0 ? "rgba(127,179,122,0.5)" : "var(--aria-line-strong)"}`,
                borderRadius: 999,
                background: successT > 0 ? "rgba(127,179,122,0.1)" : "rgba(201,165,103,0.08)",
                transition: "all 0.5s",
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: successT > 0 ? "var(--aria-success)" : "var(--aria-gold-bright)",
                  boxShadow: `0 0 10px ${successT > 0 ? "var(--aria-success)" : "var(--aria-gold-bright)"}`,
                  opacity: 0.6 + 0.4 * Math.sin(localT * 4),
                }}/>
                <span className="aria-mono" style={{ fontSize: 10, letterSpacing: "0.20em", color: successT > 0 ? "var(--aria-success)" : "var(--aria-gold-bright)" }}>
                  {successT > 0 ? `RESOLVED · 17.4s` : `WORKING · ${localT.toFixed(1)}s`}
                </span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14, flex: 1 }}>
              <div className="aria-card-elev" style={{ overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--aria-line-soft)", alignItems: "center" }}>
                  <AriaIcon name="cpu" size={14} color="var(--aria-gold)"/>
                  <span className="aria-mono" style={{ fontSize: 10.5, letterSpacing: "0.18em", color: "var(--aria-cream)" }}>PROCESS MANAGER · LIVE</span>
                  <span style={{ flex: 1 }}/>
                  <span className="aria-mono" style={{ fontSize: 9.5, color: "var(--aria-cream-faint)", letterSpacing: "0.16em" }}>27 PROCESSES</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 70px 70px 100px", padding: "8px 14px", borderBottom: "1px solid var(--aria-line-soft)" }}>
                  {["NAME", "CPU", "MEM", "STATUS"].map(h => (
                    <span key={h} className="aria-mono" style={{ fontSize: 9, letterSpacing: "0.20em", color: "var(--aria-cream-faint)" }}>{h}</span>
                  ))}
                </div>
                {[
                  ["System Helper", "1.2%", "62 MB", "OK", false],
                  ["Mail", "0.0%", "412 MB", localT > 9 ? "TERMINATED" : "NOT RESPONDING", true],
                  ["Browser Tab Group", `${(3.2 + Math.sin(localT) * 0.6).toFixed(1)}%`, "204 MB", "OK", false],
                  ["Background Sync", "0.4%", "44 MB", "OK", false],
                  ["Audio Service", "0.2%", "12 MB", "OK", false],
                ].map(([n, c, m, s, hl], i) => (
                  <div key={i} style={{
                    display: "grid", gridTemplateColumns: "1.5fr 70px 70px 100px",
                    padding: "9px 14px",
                    background: hl ? `linear-gradient(90deg, rgba(232,201,136,${0.08 + 0.06 * Math.sin(localT * 3)}), transparent 60%)` : "transparent",
                    borderBottom: "1px solid var(--aria-line-soft)",
                    position: "relative",
                    opacity: hl && localT > 9 ? 0.4 : 1,
                  }}>
                    {hl && <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: "var(--aria-gold-bright)", boxShadow: "0 0 12px var(--aria-gold-bright)" }}/>}
                    <span style={{ fontSize: 12, color: hl ? "var(--aria-gold-bright)" : "var(--aria-cream)" }}>{n}</span>
                    <span className="aria-mono" style={{ fontSize: 11, color: "var(--aria-cream-dim)" }}>{c}</span>
                    <span className="aria-mono" style={{ fontSize: 11, color: "var(--aria-cream-dim)" }}>{m}</span>
                    <span className="aria-mono" style={{
                      fontSize: 9.5,
                      color: hl ? (localT > 9 ? "var(--aria-success)" : "var(--aria-danger)") : "var(--aria-success)",
                      letterSpacing: "0.14em",
                    }}>{s}</span>
                  </div>
                ))}
                <div style={{ padding: "12px 14px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <span className="aria-btn">Details</span>
                  <span className="aria-btn aria-btn-primary" style={{
                    boxShadow: localT > 3.0 && localT < 4.0 ? `0 0 ${20 + 14 * Math.sin(localT * 8)}px rgba(232,201,136,0.7), inset 0 1px 0 rgba(255,255,255,0.5)` : undefined,
                  }}><AriaIcon name="bolt" size={11}/> End Task</span>
                </div>

                {cursorVisible && (
                  <div style={{
                    position: "absolute",
                    left: cur.x, top: cur.y,
                    color: "var(--aria-gold-bright)",
                    filter: "drop-shadow(0 0 10px var(--aria-gold-bright))",
                    pointerEvents: "none",
                    transform: `scale(${localT > 3.5 && localT < 3.85 ? 0.85 : 1})`,
                    transition: "transform 0.1s",
                  }}>
                    <AriaIcon name="cursor" size={20}/>
                    <div style={{
                      marginTop: 4, padding: "3px 7px",
                      fontSize: 9, fontFamily: "JetBrains Mono",
                      letterSpacing: "0.14em", color: "#0B0907",
                      background: "var(--aria-gold-bright)",
                      borderRadius: 3, whiteSpace: "nowrap",
                    }}>ARIA{cur.label ? ` · ${cur.label}` : ""}</div>
                  </div>
                )}
              </div>

              <div className="aria-card-elev" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--aria-line-soft)" }}>
                  <AriaIcon name="cursor" size={12} color="var(--aria-gold)"/>
                  <span className="section-label">AUDIT TRAIL</span>
                  <span style={{ flex: 1 }}/>
                  <span className="aria-mono" style={{ fontSize: 9.5, color: "var(--aria-cream-faint)", letterSpacing: "0.16em" }}>{logEntries.filter(e => localT > e.t).length} / 5</span>
                </div>
                <div style={{ flex: 1 }}>
                  {logEntries.map((e, i) => {
                    if (localT < e.t) return null;
                    const eT = Math.min(1, (localT - e.t) / 0.3);
                    return (
                      <div key={i} className="console-row" style={{
                        opacity: eT, transform: `translateY(${(1 - eT) * 6}px)`,
                      }}>
                        <span className="ts">{e.ts}</span>
                        <span className={"lvl " + e.lvl}>{e.lvl.toUpperCase()}</span>
                        <span className="msg">{e.msg}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: "10px 14px", borderTop: "1px solid var(--aria-line-soft)", display: "flex", gap: 10, alignItems: "center" }}>
                  <AriaIcon name="lock" size={12} color="var(--aria-gold)"/>
                  <span className="aria-mono" style={{ fontSize: 9.5, color: "var(--aria-cream-dim)", letterSpacing: "0.14em" }}>SIGNED · ARIA-CORE · 0x9F3A…E1</span>
                </div>
              </div>
            </div>

            {successT > 0 && (
              <div className="aria-card-elev" style={{
                padding: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10,
                opacity: successT, transform: `translateY(${(1 - successT) * 10}px)`,
              }}>
                {[
                  ["TIME TO FIX", "17.4 s"],
                  ["ACTIONS TAKEN", "5"],
                  ["DOWNTIME SAVED", "≈ 22 min"],
                  ["TICKET COST", "$0.00"],
                ].map(([k, v]) => (
                  <div key={k} style={{ padding: "8px 12px", border: "1px solid var(--aria-line-soft)", borderRadius: 6 }}>
                    <div className="aria-mono" style={{ fontSize: 8.5, color: "var(--aria-cream-faint)", letterSpacing: "0.18em" }}>{k}</div>
                    <div className="aria-serif" style={{ fontSize: 22, color: "var(--aria-gold-bright)", marginTop: 4 }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </AriaBrowser>
        <AriaPanelLive t={t} energy={1.3} micState="speaking" micPulse/>
      </div>
    </div>
  );
};

// ============================================================
// SCENE 4 — VOICE SUPPORT (76–100s, 24s)
// ============================================================
window.VoiceScene = function VoiceScene({ t, start = 76, end = 100 }) {
  if (t < start || t > end + 1) return null;
  const localT = t - start;
  const fadeIn = Math.min(1, localT / 0.5);
  const fadeOut = Math.max(0, (localT - (end - start - 0.7)) / 0.7);
  const opacity = fadeIn * (1 - fadeOut);

  const sessionTime = `00:${String(Math.floor(localT)).padStart(2, "0")}`;

  const transcript = [
    { who: "SARAH", t: 0.6,  text: "ARIA, my printer just stopped working before a board meeting." },
    { who: "ARIA",  t: 4.5,  text: "Of course, Sarah. Let's solve this together — give me a moment." },
    { who: "SARAH", t: 9.0,  text: "It says it's offline. I've tried turning it off and on twice." },
    { who: "ARIA",  t: 13.0, text: "I see it. The print spooler stalled — restarting it now. Fifteen seconds." },
  ];

  return (
    <div className="aria-frame" style={{ position: "absolute", inset: 0, opacity }}>
      <SceneTagline t={t} start={start + 0.3} end={end - 0.5} text="SCENE · 04 · VOICE INTERACTION"/>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", height: "calc(100% - 60px)", padding: "60px 28px 28px", gap: 22 }}>
        <div className="aria-card-elev" style={{ position: "relative", display: "grid", placeItems: "center", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 22, left: 22, display: "flex", alignItems: "center", gap: 10 }}>
            <span className="pulse-dot" style={{ opacity: 0.6 + 0.4 * Math.sin(localT * 4) }}/>
            <span className="section-label">LIVE · SPEAKING WITH SARAH</span>
          </div>
          <div style={{ position: "absolute", top: 22, right: 22 }}>
            <div className="aria-mono" style={{ fontSize: 9.5, color: "var(--aria-cream-faint)", letterSpacing: "0.18em" }}>SESSION {sessionTime}</div>
          </div>

          <div style={{ position: "relative" }}>
            <AnimatedGlobe size={340} letter="A" energy={1.3 + 0.3 * Math.sin(localT * 1.5)} t={t}/>
          </div>

          <div style={{ position: "absolute", bottom: 26, left: 22, right: 22 }}>
            <div style={{ marginBottom: 16 }}>
              <LiveWave t={localT} bars={36} energy={1.2} height={70}/>
            </div>
            <div className="aria-serif" style={{ fontSize: 24, lineHeight: 1.3, color: "var(--aria-cream)", minHeight: 72 }}>
              <span style={{ color: "var(--aria-gold-bright)" }}>"</span>
              {localT >= 4.5 && localT < 9 && "Of course, Sarah. Let's solve this together."}
              {localT >= 13 && localT < 19 && "I see it. Your print spooler has stalled."}
              {localT >= 19 && "I'll have you printing again in fifteen seconds."}
              {localT < 4.5 && "…"}
              {localT >= 9 && localT < 13 && "Listening…"}
              <span style={{ color: "var(--aria-gold-bright)" }}>"</span>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
              <span className="aria-chip">VOICE · ARIA · CALM</span>
              <span className="aria-chip">TONE · WARM</span>
              <span className="aria-chip">PACE · 92 WPM</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="aria-card-elev" style={{ padding: 18 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>CALLER</div>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div className="aria-placeholder" style={{ width: 60, height: 60, borderRadius: 999, fontSize: 9 }}>SH</div>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
              {transcript.map((m, i) => {
                if (localT < m.t) return null;
                const mProg = Math.min(1, (localT - m.t) / 0.35);
                const isLast = i === transcript.length - 1
                  || (i < transcript.length - 1 && localT < transcript[i+1].t);
                return (
                  <div key={i} style={{
                    display: "flex", gap: 12,
                    opacity: isLast ? mProg : 0.55,
                    transform: `translateY(${(1 - mProg) * 8}px)`,
                  }}>
                    <div style={{ width: 60, flexShrink: 0 }}>
                      <div className="aria-mono" style={{ fontSize: 9.5, letterSpacing: "0.20em", color: m.who === "ARIA" ? "var(--aria-gold)" : "var(--aria-cream-dim)" }}>{m.who}</div>
                      <div className="aria-mono" style={{ fontSize: 8.5, color: "var(--aria-cream-faint)", letterSpacing: "0.14em", marginTop: 2 }}>00:{String(Math.floor(m.t)).padStart(2, "0")}</div>
                    </div>
                    <div style={{ fontSize: 13.5, color: isLast ? "var(--aria-cream)" : "var(--aria-cream-dim)", lineHeight: 1.55, fontStyle: m.who === "ARIA" ? "italic" : "normal" }}>
                      {m.text}
                    </div>
                  </div>
                );
              })}
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
// SCENE 5 — ENTERPRISE OPS (100–130s, 30s)
// ============================================================
window.OpsScene = function OpsScene({ t, start = 100, end = 130 }) {
  if (t < start || t > end + 1) return null;
  const localT = t - start;
  const fadeIn = Math.min(1, localT / 0.5);
  const fadeOut = Math.max(0, (localT - (end - start - 0.7)) / 0.7);
  const opacity = fadeIn * (1 - fadeOut);

  const tiers = [
    { label: "TIER 01 · FOUNDATION", tagline: "First-touch resolutions in seconds",
      items: [
        { icon: "key",   title: "Password reset",          meta: "AVG · 4.2s",  trend: "+18%" },
        { icon: "print", title: "Printer reconnect",       meta: "AVG · 9.0s",  trend: "+11%" },
        { icon: "wifi",  title: "Wi-Fi troubleshooting",   meta: "AVG · 12.4s", trend: "+22%" },
      ],
    },
    { label: "TIER 02 · OPERATIONS", tagline: "Network and desktop fleet at scale",
      items: [
        { icon: "lock", title: "VPN troubleshooting", meta: "AVG · 24.1s", trend: "+9%" },
        { icon: "mail", title: "Mailbox sync repair", meta: "AVG · 31.0s", trend: "+14%" },
        { icon: "wifi", title: "Network mapping",     meta: "AVG · 46.2s", trend: "+6%" },
        { icon: "cube", title: "Driver repair",       meta: "AVG · 38.4s", trend: "+19%" },
      ],
    },
    { label: "TIER 03 · INFRASTRUCTURE", tagline: "Server, security and recovery",
      items: [
        { icon: "server", title: "Server monitoring",         meta: "24/7 ACTIVE",  trend: "STABLE" },
        { icon: "shield", title: "Threat isolation",          meta: "AVG · 1.8s",   trend: "0 INCIDENTS" },
        { icon: "key",    title: "Directory repair",          meta: "AVG · 02:14",  trend: "+4%" },
        { icon: "cpu",    title: "Infrastructure diagnostics", meta: "AVG · 03:48", trend: "+12%" },
        { icon: "bolt",   title: "Remote system recovery",    meta: "AVG · 08:21",  trend: "+7%" },
      ],
    },
  ];

  return (
    <div className="aria-frame" style={{ position: "absolute", inset: 0, opacity }}>
      <SceneTagline t={t} start={start + 0.3} end={end - 0.5} text="SCENE · 05 · GLOBAL OPERATIONS · LIVE"/>
      <div style={{ padding: "60px 28px 28px", height: "100%", display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="aria-card-elev" style={{ padding: "18px 22px", display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: 22, alignItems: "center" }}>
          <div>
            <div className="section-label">GLOBAL OPERATIONS CENTER</div>
            <div className="aria-serif" style={{ fontSize: 24, marginTop: 4 }}>
              <span style={{ fontStyle: "italic", color: "var(--aria-gold-bright)" }}>
                <LiveCounter start={4218} perSec={3.6} t={localT}/>
              </span> incidents resolved in the last 24 hours.
            </div>
          </div>
          {[
            ["UPTIME", "99.998%"],
            ["MEAN RESOLVE", `${(11.4 + 0.2 * Math.sin(localT * 0.6)).toFixed(1)}s`],
            ["AGENTS LIVE", String(184 + Math.floor(Math.sin(localT * 0.4) * 3))],
            ["REGIONS", "27"],
          ].map(([k, v]) => (
            <div key={k} style={{ textAlign: "right", paddingLeft: 22, borderLeft: "1px solid var(--aria-line-soft)" }}>
              <div className="aria-mono" style={{ fontSize: 9, color: "var(--aria-cream-faint)", letterSpacing: "0.20em" }}>{k}</div>
              <div className="aria-serif" style={{ fontSize: 22, color: "var(--aria-gold-bright)", marginTop: 4 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, flex: 1 }}>
          {tiers.map((tier, ti) => {
            const tierT = Math.max(0, localT - 0.6 - ti * 0.9);
            const tierOpacity = Math.min(1, tierT / 0.5);
            return (
              <div key={ti} className="aria-card-elev" style={{
                padding: 20, display: "flex", flexDirection: "column", gap: 12,
                opacity: tierOpacity,
                transform: `translateY(${(1 - tierOpacity) * 20}px)`,
              }}>
                <div>
                  <div className="section-label">{tier.label}</div>
                  <div className="aria-serif" style={{ fontSize: 20, marginTop: 6, lineHeight: 1.2 }}>{tier.tagline}</div>
                </div>
                <div className="aria-hr"/>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                  {tier.items.map((it, i) => {
                    const itemT = Math.max(0, tierT - 0.4 - i * 0.25);
                    const itOpacity = Math.min(1, itemT / 0.3);
                    const traveler = (localT * 0.8) % (tier.items.length + 2);
                    const isHot = Math.abs(traveler - i) < 0.7 && tierT > 1.2;
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "9px 12px",
                        border: "1px solid var(--aria-line-soft)",
                        borderRadius: 8,
                        background: isHot
                          ? `linear-gradient(90deg, rgba(232,201,136,${0.10 + 0.06 * Math.sin(localT * 4)}), transparent 70%)`
                          : "rgba(255,255,255,0.012)",
                        opacity: itOpacity,
                        transform: `translateX(${(1 - itOpacity) * -8}px)`,
                        transition: "background 0.4s",
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 6,
                          border: `1px solid ${isHot ? "var(--aria-gold-bright)" : "var(--aria-line)"}`,
                          display: "grid", placeItems: "center",
                          color: isHot ? "var(--aria-gold-bright)" : "var(--aria-gold)",
                        }}>
                          <AriaIcon name={it.icon} size={13}/>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, color: "var(--aria-cream)" }}>{it.title}</div>
                          <div className="aria-mono" style={{ fontSize: 9, letterSpacing: "0.18em", color: "var(--aria-cream-faint)", marginTop: 2 }}>{it.meta}</div>
                        </div>
                        <div className="aria-mono" style={{ fontSize: 10, color: "var(--aria-gold-bright)", letterSpacing: "0.14em" }}>{it.trend}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// SCENE 6 — OUTRO (130–150s, 20s)
// ============================================================
window.OutroScene = function OutroScene({ t, start = 130, end = 150 }) {
  if (t < start || t > end + 1) return null;
  const localT = t - start;
  const fadeIn = Math.min(1, localT / 0.7);
  const opacity = fadeIn;

  const globeProg = Math.min(1, localT / 1.6);
  const titleProg = Math.min(1, Math.max(0, (localT - 1.8) / 1.0));
  const tagProg   = Math.min(1, Math.max(0, (localT - 4.0) / 1.0));
  const brandProg = Math.min(1, Math.max(0, (localT - 7.5) / 1.0));
  const finalFade = Math.max(0, (localT - 17) / 2.5);

  return (
    <div className="aria-frame" style={{
      position: "absolute", inset: 0,
      background: "radial-gradient(ellipse at 50% 45%, #1a140d 0%, #0B0907 50%, #050402 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      opacity: opacity * (1 - finalFade),
    }}>
      <div style={{
        transform: `scale(${0.6 + globeProg * 0.4})`,
        opacity: globeProg * (1 - Math.max(0, (localT - 13) / 4)),
      }}>
        <AnimatedGlobe size={300} letter="A" energy={1.4} t={t}/>
      </div>
      <div className="aria-serif" style={{
        marginTop: 50, fontSize: 88, letterSpacing: "0.08em",
        color: "var(--aria-cream)", opacity: titleProg,
        transform: `translateY(${(1 - titleProg) * 14}px)`,
        textShadow: `0 0 ${20 * titleProg}px rgba(232,201,136,${0.3 * titleProg})`,
      }}>ARIA</div>
      <div style={{
        marginTop: 18, fontSize: 18, color: "var(--aria-gold-bright)",
        letterSpacing: "0.30em", fontFamily: "JetBrains Mono",
        opacity: tagProg, fontStyle: "italic",
      }}>THE FUTURE OF ENTERPRISE INTELLIGENCE</div>
      <div style={{
        marginTop: 46, opacity: brandProg, textAlign: "center",
        transform: `translateY(${(1 - brandProg) * 14}px)`,
      }}>
        <div className="aria-hr" style={{ width: 200, margin: "0 auto 18px" }}/>
        <div style={{ fontSize: 14, color: "var(--aria-cream-dim)", letterSpacing: "0.20em", fontFamily: "JetBrains Mono" }}>
          INTEGRATED IT SUPPORT, INC.
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--aria-gold)", letterSpacing: "0.18em", fontFamily: "JetBrains Mono" }}>
          IISUPPORT.NET
        </div>
      </div>
    </div>
  );
};

// ============================================================
// MASTER COMPOSITION — total 150s (2:30)
// ============================================================
window.AriaDemo = function AriaDemo() {
  const t = useTime();
  return (
    <div style={{ position: "absolute", inset: 0, background: "#050402", overflow: "hidden" }}>
      <IntroScene  t={t} start={0}    end={11}/>
      <SearchScene t={t} start={11}   end={30}/>
      <ChoiceScene t={t} start={30}   end={47}/>
      <ResolveScene t={t} start={47}  end={76}/>
      <VoiceScene  t={t} start={76}   end={100}/>
      <OpsScene    t={t} start={100}  end={130}/>
      <OutroScene  t={t} start={130}  end={150}/>

      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 8, background: "linear-gradient(180deg, #000, transparent)", pointerEvents: "none" }}/>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 8, background: "linear-gradient(0deg, #000, transparent)", pointerEvents: "none" }}/>
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04,
        backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0 1px, transparent 1px 3px)",
        mixBlendMode: "overlay",
      }}/>

      {window.AudioConductor ? <AudioConductor/> : null}
    </div>
  );
};

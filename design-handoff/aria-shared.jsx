// ARIA shared components — globe, panel chrome, buttons
const { useState, useEffect, useMemo } = React;

// ---------- Browser chrome ----------
window.AriaBrowser = function AriaBrowser({ url = "research.iisupport.net", children, style }) {
  return (
    <div className="aria-browser" style={{ display: "flex", flexDirection: "column", height: "100%", ...style }}>
      <div className="aria-browser-bar">
        <div className="aria-traffic"><span/><span/><span/></div>
        <div className="aria-url">
          <span className="lock">⌬</span>
          {url}
        </div>
        <div className="aria-aria-pill">
          <span className="a-mark">A</span>
          <span>ARIA</span>
        </div>
      </div>
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
};

// ---------- Globe ----------
window.AriaGlobe = function AriaGlobe({ size = 230, letter = "A" }) {
  // Geometric wireframe globe — concentric ring + dotted longitude pattern + glowing letter
  const dots = useMemo(() => {
    const arr = [];
    // a few highlighted dots
    [
      [0.30, 0.42], [0.70, 0.55], [0.55, 0.30],
      [0.42, 0.66], [0.78, 0.38], [0.22, 0.58],
    ].forEach(([x, y], i) => arr.push({ x, y, i }));
    return arr;
  }, []);

  return (
    <div className="aria-globe-wrap" style={{ width: size, height: size }}>
      <div className="aria-globe-ring dashed" style={{ inset: -28 }} />
      <div className="aria-globe-ring" style={{ inset: -10 }} />
      <div className="aria-globe" style={{ width: size, height: size }}>
        {/* longitude ellipses for 3D feel */}
        <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} preserveAspectRatio="none">
          <defs>
            <radialGradient id="globeFade" cx="0.5" cy="0.5" r="0.6">
              <stop offset="0%" stopColor="rgba(201,165,103,0.55)"/>
              <stop offset="80%" stopColor="rgba(201,165,103,0.10)"/>
              <stop offset="100%" stopColor="rgba(201,165,103,0)"/>
            </radialGradient>
          </defs>
          {/* longitudes */}
          {[15, 30, 45, 50].map((rx, i) => (
            <ellipse key={"lng"+i} cx="50" cy="50" rx={rx} ry="48"
              stroke="rgba(201,165,103,0.18)" strokeWidth="0.3" fill="none" />
          ))}
          {/* latitudes */}
          {[8, 18, 30, 40].map((ry, i) => (
            <ellipse key={"lat"+i} cx="50" cy="50" rx="48" ry={ry}
              stroke="rgba(201,165,103,0.16)" strokeWidth="0.3" fill="none" />
          ))}
          {/* equator stronger */}
          <ellipse cx="50" cy="50" rx="48" ry="14" stroke="rgba(232,201,136,0.35)" strokeWidth="0.4" fill="none"/>
          {/* dotted noise */}
          {Array.from({ length: 80 }).map((_, i) => {
            const a = (i / 80) * Math.PI * 2;
            const r = 30 + (i % 7) * 2.5;
            const x = 50 + Math.cos(a) * r;
            const y = 50 + Math.sin(a) * r * 0.7;
            return <circle key={"d"+i} cx={x} cy={y} r="0.4" fill="rgba(201,165,103,0.45)"/>;
          })}
          {/* highlighted activity points */}
          {dots.map(d => (
            <g key={d.i}>
              <circle cx={d.x*100} cy={d.y*100} r="1" fill="#E8C988"/>
              <circle cx={d.x*100} cy={d.y*100} r="2.2" fill="none" stroke="#E8C988" strokeWidth="0.3" opacity="0.5"/>
            </g>
          ))}
        </svg>

        {letter && (
          <div className="aria-globe-letter" style={{ fontSize: size * 0.45 }}>
            {letter}
          </div>
        )}
      </div>
      {/* sun marker */}
      <div className="aria-sun" style={{ top: -4, right: 18 }} />
      <div className="aria-mono" style={{
        position: "absolute", top: 12, right: -8, fontSize: 8, color: "var(--aria-cream-faint)", letterSpacing: "0.18em"
      }}>SUN · 170° N17°</div>
    </div>
  );
};

// ---------- Tiny icon set (geometric SVGs) ----------
window.AriaIcon = function AriaIcon({ name, size = 12, color = "currentColor" }) {
  const s = size;
  const stroke = { stroke: color, strokeWidth: 1.4, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    globe: <g {...stroke}><circle cx="8" cy="8" r="6"/><ellipse cx="8" cy="8" rx="3" ry="6"/><line x1="2" y1="8" x2="14" y2="8"/></g>,
    cube:  <g {...stroke}><path d="M8 2 L13 5 V11 L8 14 L3 11 V5 Z"/><path d="M8 2 V8"/><path d="M3 5 L8 8 L13 5"/></g>,
    bolt:  <g {...stroke}><path d="M9 2 L4 9 H8 L7 14 L12 7 H8 Z"/></g>,
    chart: <g {...stroke}><path d="M2 12 L6 8 L9 11 L14 4"/><circle cx="14" cy="4" r="1.2"/></g>,
    play:  <g {...stroke}><path d="M5 3 L13 8 L5 13 Z"/></g>,
    chat:  <g {...stroke}><path d="M3 4 H13 V11 H8 L5 13 V11 H3 Z"/></g>,
    cart:  <g {...stroke}><path d="M2 3 H4 L6 11 H13 L14 5 H5"/><circle cx="6" cy="13.5" r="0.8"/><circle cx="12" cy="13.5" r="0.8"/></g>,
    music: <g {...stroke}><path d="M6 12 V4 L13 3 V11"/><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="11" r="1.5"/></g>,
    cam:   <g {...stroke}><rect x="2" y="5" width="9" height="7"/><path d="M11 7 L14 5 V12 L11 10"/></g>,
    search:<g {...stroke}><circle cx="7" cy="7" r="4"/><line x1="10" y1="10" x2="13" y2="13"/></g>,
    shield:<g {...stroke}><path d="M8 2 L13 4 V8 C13 11 11 13 8 14 C5 13 3 11 3 8 V4 Z"/></g>,
    server:<g {...stroke}><rect x="2" y="3" width="12" height="4"/><rect x="2" y="9" width="12" height="4"/><circle cx="4" cy="5" r="0.5" fill={color}/><circle cx="4" cy="11" r="0.5" fill={color}/></g>,
    wifi:  <g {...stroke}><path d="M2 6 C5 3 11 3 14 6"/><path d="M4 9 C6 7 10 7 12 9"/><circle cx="8" cy="12" r="0.6" fill={color}/></g>,
    lock:  <g {...stroke}><rect x="3" y="7" width="10" height="7"/><path d="M5 7 V4 C5 2.5 6.5 1.5 8 1.5 C9.5 1.5 11 2.5 11 4 V7"/></g>,
    print: <g {...stroke}><rect x="4" y="2" width="8" height="4"/><path d="M2 6 H14 V11 H12 V14 H4 V11 H2 Z"/></g>,
    mail:  <g {...stroke}><rect x="2" y="3" width="12" height="10"/><path d="M2 4 L8 9 L14 4"/></g>,
    key:   <g {...stroke}><circle cx="5" cy="8" r="3"/><path d="M8 8 H14 M12 8 V11 M14 8 V10"/></g>,
    mic:   <g {...stroke}><rect x="6" y="2" width="4" height="8" rx="2"/><path d="M3 8 C3 11 5 13 8 13 C11 13 13 11 13 8"/><line x1="8" y1="13" x2="8" y2="15"/></g>,
    clock: <g {...stroke}><circle cx="8" cy="8" r="6"/><path d="M8 5 V8 L10 9.5"/></g>,
    arrow: <g {...stroke}><path d="M3 8 H13 M9 4 L13 8 L9 12"/></g>,
    plus:  <g {...stroke}><path d="M8 3 V13 M3 8 H13"/></g>,
    sparkle: <g {...stroke}><path d="M8 2 V6 M8 10 V14 M2 8 H6 M10 8 H14 M4 4 L6 6 M10 10 L12 12 M12 4 L10 6 M6 10 L4 12"/></g>,
    cursor: <g {...stroke}><path d="M3 2 L13 7 L8 8 L7 13 Z"/></g>,
    check: <g {...stroke}><path d="M3 8 L7 12 L13 4"/></g>,
    cpu:   <g {...stroke}><rect x="3" y="3" width="10" height="10"/><rect x="6" y="6" width="4" height="4"/><path d="M5 1 V3 M8 1 V3 M11 1 V3 M5 13 V15 M8 13 V15 M11 13 V15 M1 5 H3 M1 8 H3 M1 11 H3 M13 5 H15 M13 8 H15 M13 11 H15"/></g>,
  };
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" style={{ display: "block" }}>
      {paths[name] || paths.cube}
    </svg>
  );
};

// ---------- Stat card ----------
window.AriaStat = function AriaStat({ icon = "globe", num, label, style }) {
  return (
    <div className="stat-card" style={style}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span className="icon"><AriaIcon name={icon} size={10}/></span>
        <span className="num">{num}</span>
      </div>
      <div className="lbl">{label}</div>
    </div>
  );
};

// ---------- ARIA panel header ----------
window.AriaPanelHeader = function AriaPanelHeader({ time = "14:42:08" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          border: "1px solid var(--aria-line-strong)",
          display: "grid", placeItems: "center",
          background: "linear-gradient(180deg, rgba(201,165,103,0.20), rgba(201,165,103,0.05))",
        }}>
          <span className="aria-serif" style={{ color: "var(--aria-gold-bright)", fontSize: 18, lineHeight: 1, fontStyle: "italic" }}>A</span>
        </div>
        <div style={{ lineHeight: 1.15 }}>
          <div className="aria-serif" style={{ fontSize: 18, letterSpacing: "0.18em" }}>ARIA</div>
          <div className="aria-mono" style={{ fontSize: 8.5, letterSpacing: "0.22em", color: "var(--aria-cream-faint)" }}>AI VOICE ASSISTANT</div>
        </div>
      </div>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        border: "1px solid var(--aria-line)",
        display: "grid", placeItems: "center", color: "var(--aria-gold)"
      }}>
        <AriaIcon name="clock" size={12} />
      </div>
    </div>
  );
};

// ---------- ARIA panel — full right rail ----------
window.AriaPanel = function AriaPanel({ globeLetter = "A", time = "14:42:08", showInput = true, micState = "idle", customStats }) {
  const stats = customStats || [
    { icon: "globe", num: "202.2M", label: "ONLINE GLOBALLY" },
    { icon: "sparkle", num: "28.3M", label: "USING AI TOOLS" },
    { icon: "search", num: "70.0K/s", label: "ENTERPRISE QUERIES" },
    { icon: "cam", num: "364.5M", label: "STREAMING VIDEO" },
  ];
  const sideLeft = [
    { icon: "chat", num: "11.8M", label: "ON CHAT AI" },
    { icon: "cube", num: "505.3K", label: "ON DEV PLATFORMS" },
    { icon: "cart", num: "80.6M", label: "SHOPPING ONLINE" },
    { icon: "chart", num: "17.6M", label: "TRADING MARKETS" },
  ];
  const sideRight = [
    { icon: "play", num: "134.9M", label: "GAMING NOW" },
    { icon: "music", num: "137.2M", label: "ON SHORT VIDEO" },
    { icon: "cam", num: "150.2M", label: "ON SOCIAL FEEDS" },
    { icon: "bolt", num: "40.1M", label: "TRADING CRYPTO" },
  ];

  return (
    <div style={{
      width: "100%", height: "100%", position: "relative",
      borderLeft: "1px solid var(--aria-line-soft)",
      background: "linear-gradient(180deg, rgba(20,16,11,0.6), rgba(11,9,7,0.8))",
      display: "flex", flexDirection: "column",
    }}>
      <AriaPanelHeader time={time}/>

      {/* Live activity row */}
      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="pulse-dot"/>
            <span className="section-label">LIVE ACTIVITY</span>
          </div>
          <div className="aria-mono" style={{ fontSize: 9, color: "var(--aria-cream-faint)", letterSpacing: "0.12em" }}>
            Worldwide · Updated every sec
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {stats.map((s, i) => <AriaStat key={i} {...s}/>)}
        </div>
      </div>

      {/* Globe + side stats */}
      <div style={{ flex: 1, padding: "20px 14px 0", display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10, alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sideLeft.map((s, i) => <AriaStat key={i} {...s}/>)}
        </div>
        <div style={{ position: "relative", padding: "20px 0" }}>
          <AriaGlobe size={210} letter={globeLetter}/>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sideRight.map((s, i) => <AriaStat key={i} {...s}/>)}
        </div>
      </div>

      {/* Tap to speak */}
      <div style={{ padding: "10px 20px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div className="aria-serif" style={{ fontSize: 22, letterSpacing: "0.02em" }}>
          {micState === "listening" ? "Listening…" : micState === "speaking" ? "ARIA is speaking" : "Tap to speak"}
        </div>
        <div className="aria-mic">
          <AriaIcon name="mic" size={22}/>
        </div>
        {showInput && (
          <div className="aria-chat-input" style={{ width: "100%", marginTop: 6 }}>
            <span style={{ flex: 1 }}>Ask ARIA anything…</span>
            <div className="aria-chat-send"><AriaIcon name="arrow" size={12}/></div>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- Tagline ----------
window.AriaTagline = function AriaTagline({ children = "AND SHE GOES EVERYWHERE WITH YOU" }) {
  return (
    <div style={{ textAlign: "center", padding: "20px 0 14px" }}>
      <span className="aria-tagline">{children}</span>
    </div>
  );
};

// ---------- Aria suggestion bubble ----------
window.AriaBubble = function AriaBubble({ kind = "suggestion", children, style }) {
  return (
    <div className="aria-bubble" style={style}>
      <div style={{ display: "flex", gap: 10, marginBottom: 6, alignItems: "center" }}>
        <span style={{
          width: 18, height: 18, borderRadius: 4,
          background: "linear-gradient(180deg, #C9A567, #8C6F3F)",
          display: "grid", placeItems: "center",
          color: "#0B0907", fontFamily: "Cormorant Garamond, serif", fontSize: 12, fontWeight: 600
        }}>A</span>
        <span className="section-label">{kind === "note" ? "ARIA · NOTE" : "ARIA · SUGGESTION"}</span>
      </div>
      <div style={{ fontSize: 13.5, color: "var(--aria-cream)", lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  );
};

// Scene 5 (48–58s): Beyond IT — browser companion
// Generic browser shell. ARIA sidebar helps with multiple tasks.

function Scene5Browser({ start = 48, end = 58 }) {
  return (
    <Sprite start={start} end={end}>
      <Scene5Inner sceneStart={start} />
    </Sprite>
  );
}

function Scene5Inner({ sceneStart }) {
  const time = useTime();
  const t = time - sceneStart; // 0..10

  return (
    <div style={{ position: 'absolute', inset: 0, background: ARIA_BLACK, overflow: 'hidden' }}>
      <GrainOverlay opacity={0.04} />

      {/* Eyebrow */}
      <Sprite start={sceneStart + 0.2} end={sceneStart + 9.5}>
        <FadeBlock fadeIn={0.4} fadeOut={0.4}>
          <Eyebrow text="And she goes everywhere with you" x="50%" y={70} />
        </FadeBlock>
      </Sprite>

      {/* Browser frame */}
      <Sprite start={sceneStart + 0.5} end={sceneStart + 9.6}>
        <BrowserFrame t={t} />
      </Sprite>

      {/* Caption */}
      <Sprite start={sceneStart + 7.6} end={sceneStart + 9.8}>
        <FadeBlock fadeIn={0.4} fadeOut={0.4}>
          <div style={{
            position: 'absolute',
            left: '50%', top: 990,
            transform: 'translateX(-50%)',
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontSize: 36,
            color: ARIA_CREAM,
            letterSpacing: '0.01em',
          }}>
            Research. Shop. Plan. Fix. <span style={{ color: ARIA_GOLD }}>One assistant.</span>
          </div>
        </FadeBlock>
      </Sprite>
    </div>
  );
}

function BrowserFrame({ t }) {
  const { localTime } = useSprite();
  // Frame slides up
  const frameT = Easing.easeOutCubic(clamp(localTime / 0.6, 0, 1));

  // Tab cycles through three views
  // 0..2.6s: research, 2.6..5.0s: shopping, 5.0..7.4s: troubleshooting
  const phaseT = localTime;
  let phase = 0;
  if (phaseT > 2.4) phase = 1;
  if (phaseT > 4.8) phase = 2;

  return (
    <div style={{
      position: 'absolute',
      left: '50%',
      top: 130,
      transform: `translateX(-50%) translateY(${(1 - frameT) * 30}px)`,
      opacity: frameT,
      width: 1660,
      height: 820,
      background: '#1a1714',
      borderRadius: 14,
      boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 120px rgba(212, 166, 90, 0.06)',
      border: `1px solid rgba(212, 166, 90, 0.2)`,
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Browser chrome */}
      <div style={{
        height: 48,
        background: '#13110e',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 18px',
      }}>
        <div style={{ display: 'flex', gap: 7 }}>
          <div style={{ width: 11, height: 11, borderRadius: 6, background: '#3a342c' }} />
          <div style={{ width: 11, height: 11, borderRadius: 6, background: '#3a342c' }} />
          <div style={{ width: 11, height: 11, borderRadius: 6, background: '#3a342c' }} />
        </div>
        <div style={{ flex: 1, height: 28, background: '#0a0908', borderRadius: 6, display: 'flex', alignItems: 'center', padding: '0 14px', marginLeft: 24 }}>
          <span style={{ fontFamily: MONO, fontSize: 12, color: ARIA_DIM }}>
            {phase === 0 && '🔒  research.iisupport.net/q/enterprise-saas-comparison'}
            {phase === 1 && '🔒  marketplace.business-supplies.com/standing-desks'}
            {phase === 2 && '🔒  workspace.iisupport.net/team/dashboard'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'linear-gradient(135deg, #EBC882 0%, #D4A65A 60%, #A87E36 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: SERIF, fontWeight: 600, fontSize: 16, color: ARIA_BLACK,
            boxShadow: '0 0 16px rgba(212, 166, 90, 0.6)',
          }}>A</div>
          <span style={{ fontFamily: MONO, fontSize: 11, color: ARIA_GOLD, letterSpacing: '0.15em' }}>ARIA</span>
        </div>
      </div>

      {/* Body — page placeholder + sidebar */}
      <div style={{ flex: 1, display: 'flex' }}>
        {/* Page content placeholder */}
        <div style={{ flex: 1, padding: 36, position: 'relative', overflow: 'hidden' }}>
          <PagePhase phase={phase} />
        </div>

        {/* ARIA sidebar */}
        <div style={{
          width: 460,
          background: 'linear-gradient(180deg, #14110d 0%, #0e0c09 100%)',
          borderLeft: '1px solid rgba(212, 166, 90, 0.18)',
          padding: 28,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'radial-gradient(circle, #F5DCA0 0%, #D4A65A 50%, #A87E36 100%)',
              boxShadow: '0 0 24px rgba(212, 166, 90, 0.6)',
            }} />
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 22, color: ARIA_CREAM, lineHeight: 1 }}>ARIA</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: ARIA_GOLD, letterSpacing: '0.2em' }}>● ALWAYS ON</div>
            </div>
          </div>

          <AriaConversation phase={phase} localTime={localTime} />
        </div>
      </div>
    </div>
  );
}

function PagePhase({ phase }) {
  const titles = [
    'Top 10 Enterprise SaaS Platforms — 2026 Comparison',
    'Standing Desks · Office Outfitting',
    'Team Workspace · IT Health Dashboard',
  ];
  return (
    <div>
      <div style={{
        fontFamily: SERIF, fontSize: 38, color: ARIA_CREAM,
        marginBottom: 24, fontWeight: 400, letterSpacing: '-0.01em',
      }}>
        {titles[phase]}
      </div>
      {/* faux content blocks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[0,1,2,3,4,5].map(i => (
          <div key={i} style={{
            height: i === 0 ? 120 : 18,
            background: i === 0 ? 'repeating-linear-gradient(135deg, rgba(212,166,90,0.06) 0 12px, rgba(212,166,90,0.02) 12px 24px)' : 'rgba(255,255,255,0.04)',
            borderRadius: 4,
            width: i === 0 ? '100%' : `${95 - i * 7}%`,
          }} />
        ))}
        <div style={{
          marginTop: 12,
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14,
        }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              height: 130,
              background: 'repeating-linear-gradient(135deg, rgba(212,166,90,0.06) 0 12px, rgba(212,166,90,0.02) 12px 24px)',
              borderRadius: 4,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AriaConversation({ phase, localTime }) {
  const conversations = [
    [
      { from: 'user', text: 'Compare top 3 for our team of 80.' },
      { from: 'aria', text: "Pulled pricing, security posture, and integration depth across all 10. Top 3 for your size: shortlist with side-by-side. Want me to draft an internal memo?" },
      { from: 'user', text: 'Yes — and book demos for next week.' },
    ],
    [
      { from: 'user', text: 'Need 12 desks under $24k delivered by Friday.' },
      { from: 'aria', text: 'Found 4 vendors meeting your budget and SLA. Cheapest in-stock option: $1,840/unit. Shall I add to cart and route to procurement?' },
    ],
    [
      { from: 'user', text: 'Why is the design team\'s VPN slow?' },
      { from: 'aria', text: 'Detected packet loss on the West gateway since 09:12. Rerouting traffic now. ETA to full speed: 90 seconds. Logged for your records.' },
    ],
  ];
  const conv = conversations[phase];
  const phaseStartAt = phase === 0 ? 0.6 : phase === 1 ? 3.0 : 5.4;
  const localPhase = localTime - phaseStartAt;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflow: 'hidden' }}>
      {conv.map((m, i) => {
        const appear = i * 0.7;
        const lt = clamp((localPhase - appear) / 0.5, 0, 1);
        return (
          <div key={`${phase}-${i}`} style={{
            alignSelf: m.from === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '90%',
            opacity: lt,
            transform: `translateY(${(1 - lt) * 8}px)`,
            background: m.from === 'user' ? 'rgba(212, 166, 90, 0.12)' : 'rgba(255,255,255,0.04)',
            border: m.from === 'user' ? '1px solid rgba(212, 166, 90, 0.3)' : '1px solid rgba(255,255,255,0.06)',
            color: ARIA_CREAM,
            padding: '12px 16px',
            borderRadius: 10,
            fontFamily: SANS,
            fontSize: 14,
            lineHeight: 1.5,
            fontWeight: m.from === 'user' ? 400 : 300,
          }}>
            {m.from === 'aria' && (
              <div style={{ fontFamily: MONO, fontSize: 9, color: ARIA_GOLD, letterSpacing: '0.25em', marginBottom: 6 }}>ARIA</div>
            )}
            {m.text}
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, { Scene5Browser });

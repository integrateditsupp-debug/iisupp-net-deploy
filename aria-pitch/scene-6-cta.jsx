// Scene 6 (58–68s): Stats slam — three big numbers
// Scene 7 (68–80s): CTA + Integrated IT Support sign-off

function Scene6Stats({ start = 58, end = 68 }) {
  return (
    <Sprite start={start} end={end}>
      <Scene6Inner sceneStart={start} />
    </Sprite>
  );
}

function Scene6Inner({ sceneStart }) {
  const time = useTime();
  const t = time - sceneStart;

  return (
    <div style={{ position: 'absolute', inset: 0, background: ARIA_BLACK, overflow: 'hidden' }}>
      <GrainOverlay opacity={0.04} />

      {/* Subtle gold gradient pulse bg */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 50%, rgba(212, 166, 90, ${0.08 + 0.04 * Math.sin(t * 1.5)}) 0%, transparent 60%)`,
      }} />

      <Sprite start={sceneStart + 0.2} end={sceneStart + 9.5}>
        <FadeBlock fadeIn={0.4} fadeOut={0.4}>
          <Eyebrow text="The math is brutal" x="50%" y={140} />
        </FadeBlock>
      </Sprite>

      {/* Three stats, staggered */}
      <Sprite start={sceneStart + 0.8} end={sceneStart + 9.7}>
        <StatsBlock />
      </Sprite>

      {/* Footer line */}
      <Sprite start={sceneStart + 6.5} end={sceneStart + 9.8}>
        <FadeBlock fadeIn={0.5} fadeOut={0.4}>
          <div style={{
            position: 'absolute',
            left: '50%', top: 870,
            transform: 'translateX(-50%)',
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontSize: 38,
            color: ARIA_CREAM,
            letterSpacing: '0.01em',
            textAlign: 'center',
            maxWidth: 1400,
          }}>
            Where tech becomes a problem, <span style={{ color: ARIA_GOLD }}>ARIA is the solution.</span>
          </div>
        </FadeBlock>
      </Sprite>

      <Vignette />
    </div>
  );
}

function StatsBlock() {
  const { localTime } = useSprite();

  const stats = [
    { value: '5×', label: 'LOWER STAFFING COST', sub: 'Replaces a multi-tier support team.' },
    { value: '24/7', label: 'NEVER OFF THE CLOCK', sub: 'Weekends. Holidays. 3 AM crises.' },
    { value: '0', label: 'TICKETS IN QUEUE', sub: 'First response in seconds, not hours.' },
  ];

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 60,
      paddingTop: 30,
    }}>
      {stats.map((s, i) => {
        const appear = 0.3 + i * 0.55;
        const lt = clamp((localTime - appear) / 0.7, 0, 1);
        const eased = Easing.easeOutBack(lt);
        return (
          <div key={i} style={{
            opacity: lt,
            transform: `translateY(${(1 - eased) * 30}px) scale(${0.92 + 0.08 * eased})`,
            textAlign: 'center',
            width: 480,
            padding: '40px 0',
            borderTop: `1px solid rgba(212, 166, 90, ${0.4 * lt})`,
            borderBottom: `1px solid rgba(212, 166, 90, ${0.4 * lt})`,
          }}>
            <div style={{
              fontFamily: SERIF,
              fontSize: 280,
              fontWeight: 400,
              color: ARIA_GOLD_BRIGHT,
              letterSpacing: '-0.04em',
              lineHeight: 0.85,
              textShadow: '0 0 80px rgba(212, 166, 90, 0.35)',
            }}>
              {s.value}
            </div>
            <div style={{
              marginTop: 28,
              fontFamily: MONO,
              fontSize: 14,
              color: ARIA_GOLD,
              letterSpacing: '0.32em',
              fontWeight: 500,
            }}>
              {s.label}
            </div>
            <div style={{
              marginTop: 12,
              fontFamily: SANS,
              fontSize: 18,
              color: ARIA_CREAM,
              fontWeight: 300,
              opacity: 0.8,
            }}>
              {s.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function Scene7CTA({ start = 68, end = 80 }) {
  return (
    <Sprite start={start} end={end}>
      <Scene7Inner sceneStart={start} />
    </Sprite>
  );
}

function Scene7Inner({ sceneStart }) {
  const time = useTime();
  const t = time - sceneStart;

  // Background transitions black → marble cream over 0..2s
  const bgT = Easing.easeInOutCubic(clamp(t / 1.6, 0, 1));

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Black underlay */}
      <div style={{ position: 'absolute', inset: 0, background: ARIA_BLACK }} />
      {/* Marble overlay fades in */}
      <div style={{ position: 'absolute', inset: 0, opacity: bgT }}>
        <MarbleBackground />
      </div>

      <GrainOverlay opacity={0.04} />

      {/* Logo composition */}
      <Sprite start={sceneStart + 0.6} end={sceneStart + 11.8}>
        <LogoComp t={t} />
      </Sprite>

      {/* CTA */}
      <Sprite start={sceneStart + 4.8} end={sceneStart + 11.8}>
        <CtaBlock />
      </Sprite>
    </div>
  );
}

function LogoComp({ t }) {
  const { localTime } = useSprite();

  // Gold "I" bar — grows from 0 to full height
  const barT = Easing.easeOutCubic(clamp(localTime / 1.4, 0, 1));
  const barH = 280 * barT;

  // Glow pulse
  const glow = 0.7 + 0.3 * Math.sin(localTime * 1.8);

  // Wordmark fade in
  const wordmarkT = Easing.easeOutCubic(clamp((localTime - 1.0) / 0.8, 0, 1));

  return (
    <div style={{
      position: 'absolute',
      left: '50%', top: 280,
      transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Gold I bar */}
      <div style={{
        width: 56,
        height: barH,
        background: 'linear-gradient(180deg, #F5DCA0 0%, #D4A65A 50%, #A87E36 100%)',
        borderRadius: 4,
        boxShadow: `0 0 ${60 * glow}px rgba(212, 166, 90, ${0.5 * glow}), 0 0 ${20 * glow}px rgba(235, 200, 130, ${0.6 * glow})`,
        marginBottom: 50,
      }} />

      {/* Wordmark */}
      <div style={{
        opacity: wordmarkT,
        transform: `translateY(${(1 - wordmarkT) * 16}px)`,
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: SERIF,
          fontSize: 60,
          fontWeight: 500,
          color: ARIA_GOLD_DEEP,
          letterSpacing: '0.12em',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          INTEGRATED IT SUPPORT INC.
        </div>
        <div style={{
          marginTop: 18,
          fontFamily: SERIF,
          fontStyle: 'italic',
          fontSize: 26,
          fontWeight: 400,
          color: ARIA_GOLD_DEEP,
          letterSpacing: '0.42em',
          opacity: 0.85,
        }}>
          PREVENTATIVE&nbsp;&nbsp;&nbsp;AID
        </div>
      </div>
    </div>
  );
}

function CtaBlock() {
  const { localTime } = useSprite();
  const ctaT = Easing.easeOutCubic(clamp(localTime / 0.7, 0, 1));
  const lineT = Easing.easeOutCubic(clamp((localTime - 0.5) / 0.7, 0, 1));
  const urlT = Easing.easeOutCubic(clamp((localTime - 1.0) / 0.7, 0, 1));

  return (
    <div style={{
      position: 'absolute',
      left: '50%', top: 760,
      transform: 'translateX(-50%)',
      textAlign: 'center',
    }}>
      <div style={{
        opacity: ctaT,
        transform: `translateY(${(1 - ctaT) * 14}px)`,
        fontFamily: MONO,
        fontSize: 16,
        color: ARIA_GOLD_DEEP,
        letterSpacing: '0.4em',
        marginBottom: 24,
      }}>
        BOOK A DEMO
      </div>
      <div style={{
        opacity: lineT,
        transform: `translateY(${(1 - lineT) * 14}px)`,
        fontFamily: SERIF,
        fontStyle: 'italic',
        fontSize: 50,
        fontWeight: 400,
        color: '#3a2c14',
        letterSpacing: '-0.005em',
        marginBottom: 28,
        maxWidth: 1300,
      }}>
        See ARIA cut your support costs by 5×.
      </div>
      <div style={{
        opacity: urlT,
        transform: `translateY(${(1 - urlT) * 10}px)`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 22,
        padding: '20px 44px',
        background: 'linear-gradient(180deg, #1a1410 0%, #0a0908 100%)',
        border: `1.5px solid ${ARIA_GOLD}`,
        borderRadius: 4,
        fontFamily: SERIF,
        fontSize: 38,
        color: ARIA_GOLD_BRIGHT,
        letterSpacing: '0.04em',
        boxShadow: '0 14px 40px rgba(0,0,0,0.25), 0 0 60px rgba(212, 166, 90, 0.2)',
      }}>
        <span>iisupport.net</span>
        <svg width="28" height="28" viewBox="0 0 28 28">
          <path d="M6 14 L22 14 M16 8 L22 14 L16 20" stroke={ARIA_GOLD_BRIGHT} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

Object.assign(window, { Scene6Stats, Scene7CTA });

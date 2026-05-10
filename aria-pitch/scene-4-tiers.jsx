// Scene 4 (32–48s): L1/L2/L3 capability montage
// Three ticket cards animate in. Each "RESOLVED BY ARIA" with timestamp.

function Scene4Tiers({ start = 32, end = 48 }) {
  return (
    <Sprite start={start} end={end}>
      <Scene4Inner sceneStart={start} />
    </Sprite>
  );
}

function Scene4Inner({ sceneStart }) {
  const time = useTime();
  const t = time - sceneStart; // 0..16

  return (
    <div style={{ position: 'absolute', inset: 0, background: ARIA_BLACK, overflow: 'hidden' }}>
      <GrainOverlay opacity={0.04} />

      {/* Eyebrow */}
      <Sprite start={sceneStart + 0.3} end={sceneStart + 15.5}>
        <FadeBlock fadeIn={0.4} fadeOut={0.4}>
          <Eyebrow text="Replaces Tier 1, Tier 2, and Tier 3 — instantly" x="50%" y={90} />
        </FadeBlock>
      </Sprite>

      {/* Three tickets, each gets a focused beat then settles into a row */}

      {/* Beat 1: L1 — password reset */}
      <Sprite start={sceneStart + 0.8} end={sceneStart + 5.5}>
        <TicketBeat
          tier="L1"
          tierLabel="TIER 1 · USER REQUEST"
          subject="Reset password — locked out of CRM"
          user="P. Kumar"
          submittedAt="09:38"
          steps={[
            'Verify identity via SSO token',
            'Reset password through Active Directory',
            'Send temporary credentials over secure channel',
            'Confirm successful re-authentication',
          ]}
          resolveTime="2 seconds"
          before="Avg. queue time: 47 minutes"
        />
      </Sprite>

      {/* Beat 2: L2 — Outlook config */}
      <Sprite start={sceneStart + 5.5} end={sceneStart + 10.3}>
        <TicketBeat
          tier="L2"
          tierLabel="TIER 2 · TROUBLESHOOTING"
          subject="Outlook crashing on launch"
          user="L. Garcia"
          submittedAt="08:42"
          steps={[
            'Inspect crash logs across affected machines',
            'Identify corrupted PST file in user profile',
            'Repair and rebuild profile remotely',
            'Verify mail flow restored on all endpoints',
          ]}
          resolveTime="11 seconds"
          before="Avg. queue time: 2.3 hours"
        />
      </Sprite>

      {/* Beat 3: L3 — CRM sync escalation */}
      <Sprite start={sceneStart + 10.3} end={sceneStart + 15.5}>
        <TicketBeat
          tier="L3"
          tierLabel="TIER 3 · DEEP TECHNICAL"
          subject="CRM sync down — leads not loading"
          user="K. Olsen"
          submittedAt="09:11"
          steps={[
            'Trace API failures across 14 integration endpoints',
            'Identify rate-limit on third-party webhook',
            'Apply backoff strategy and re-queue 1,247 records',
            'Patch integration; monitor sync at full throughput',
          ]}
          resolveTime="38 seconds"
          before="Avg. escalation time: 1–2 days"
        />
      </Sprite>
    </div>
  );
}

function TicketBeat({ tier, tierLabel, subject, user, submittedAt, steps, resolveTime, before }) {
  const { localTime, duration } = useSprite();
  // Stagger reveal: card → steps tick on → resolution badge slams in
  const cardT = Easing.easeOutCubic(clamp(localTime / 0.5, 0, 1));
  const stepsStartAt = 0.7;
  const stepDur = 0.35;

  // Resolution lands when steps complete
  const resolutionAt = stepsStartAt + steps.length * stepDur + 0.2;
  const resolutionT = Easing.easeOutBack(clamp((localTime - resolutionAt) / 0.5, 0, 1));

  // Exit
  const exitStart = duration - 0.45;
  let exitOp = 1;
  let exitX = 0;
  if (localTime > exitStart) {
    const e = clamp((localTime - exitStart) / 0.45, 0, 1);
    exitOp = 1 - e;
    exitX = -e * 80;
  }

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: exitOp,
      transform: `translateX(${exitX}px)`,
    }}>
      <div style={{
        opacity: cardT,
        transform: `translateY(${(1 - cardT) * 30}px)`,
        width: 1280,
        background: 'rgba(20, 18, 14, 0.85)',
        border: `1px solid rgba(212, 166, 90, 0.25)`,
        borderRadius: 8,
        padding: '40px 56px',
        position: 'relative',
        boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 120px rgba(212, 166, 90, 0.08)',
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 32, marginBottom: 28 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 12, color: ARIA_GOLD, letterSpacing: '0.3em', marginBottom: 14 }}>
              {tierLabel}
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 36, color: ARIA_CREAM, fontWeight: 400, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
              {subject}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 13, color: ARIA_DIM, marginTop: 16, letterSpacing: '0.05em' }}>
              FROM {user.toUpperCase()} · SUBMITTED {submittedAt} · {before.toUpperCase()}
            </div>
          </div>
          <div style={{
            fontFamily: SERIF,
            fontSize: 110,
            fontWeight: 400,
            color: ARIA_GOLD,
            letterSpacing: '-0.02em',
            lineHeight: 0.9,
          }}>
            {tier}
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(212, 166, 90, 0.2)', margin: '0 0 28px' }} />

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {steps.map((s, i) => {
            const appear = stepsStartAt + i * stepDur;
            const lt = clamp((localTime - appear) / 0.4, 0, 1);
            return (
              <div key={i} style={{
                opacity: lt,
                transform: `translateX(${(1 - lt) * -16}px)`,
                display: 'flex', alignItems: 'center', gap: 18,
                fontFamily: SANS,
                fontSize: 21,
                fontWeight: 300,
                color: ARIA_CREAM,
                letterSpacing: '0.005em',
              }}>
                <Checkmark progress={lt} />
                <span>{s}</span>
              </div>
            );
          })}
        </div>

        {/* Resolution badge slams in */}
        <div style={{
          marginTop: 36,
          paddingTop: 28,
          borderTop: '1px solid rgba(212, 166, 90, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 32,
          opacity: resolutionT,
          transform: `translateY(${(1 - resolutionT) * 12}px) scale(${0.95 + 0.05 * resolutionT})`,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 12, color: ARIA_GOLD, letterSpacing: '0.3em', marginBottom: 8 }}>
              RESOLVED BY ARIA
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 56, color: ARIA_GOLD_BRIGHT, fontWeight: 400, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
              {resolveTime}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 12, color: ARIA_DIM, letterSpacing: '0.3em', marginBottom: 8 }}>
              HUMAN AGENT TIME
            </div>
            <div style={{ fontFamily: SERIF, fontSize: 28, color: ARIA_DIM, fontStyle: 'italic', textDecoration: 'line-through', textDecorationColor: 'rgba(232, 93, 93, 0.6)', whiteSpace: 'nowrap' }}>
              0.0 minutes
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Checkmark({ progress }) {
  // SVG check that draws on with progress
  const dash = 28;
  const offset = (1 - progress) * dash;
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" style={{ flexShrink: 0 }}>
      <circle cx="14" cy="14" r="13" fill="none" stroke={ARIA_GOLD} strokeWidth="1" opacity={progress * 0.6} />
      <path d="M8 14.5 L12.5 19 L20 11" fill="none" stroke={ARIA_GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={dash} strokeDashoffset={offset} />
    </svg>
  );
}

Object.assign(window, { Scene4Tiers });

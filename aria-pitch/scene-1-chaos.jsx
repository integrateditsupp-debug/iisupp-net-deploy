// Scene 1 (0–10s): Cold open — the chaos
// A clock ticks. Tickets pile up faster than they can be resolved.
// "9:47 AM. 47 tickets. 0 resolved." → "Sound familiar?"

function Scene1Chaos({ start = 0, end = 10 }) {
  return (
    <Sprite start={start} end={end}>
      <Scene1Inner sceneStart={start} sceneEnd={end} />
    </Sprite>
  );
}

function Scene1Inner({ sceneStart, sceneEnd }) {
  const time = useTime();
  const t = time - sceneStart; // 0..10

  // Ticket count animation: starts at 12, climbs to 47 over 0..6s
  const ticketCount = Math.floor(animate({ from: 12, to: 47, start: 0, end: 6, ease: Easing.linear })(t));

  // Resolved counter: stuck at 0
  const resolved = 0;

  // Camera shake/zoom on chaos
  const cameraScale = 1 + 0.04 * Math.sin(t * 6) * Math.max(0, (t - 4) / 2);

  return (
    <div style={{ position: 'absolute', inset: 0, background: ARIA_BLACK, overflow: 'hidden' }}>
      <GrainOverlay opacity={0.06} />

      {/* Tickets piling up — generated rows */}
      <div style={{
        position: 'absolute',
        inset: 0,
        transform: `scale(${cameraScale})`,
        transformOrigin: 'center',
      }}>
        <TicketStream t={t} />
      </div>

      <Vignette />

      {/* Top-left: TIME */}
      <Sprite start={sceneStart + 0.3} end={sceneStart + 9.5}>
        <FadeBlock fadeIn={0.4} fadeOut={0.4} style={{
          position: 'absolute', left: 80, top: 70,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 14, color: ARIA_DIM, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 8 }}>
            MONDAY · 9:47 AM
          </div>
          <div style={{ fontFamily: MONO, fontSize: 64, color: ARIA_CREAM, fontWeight: 300, letterSpacing: '-0.02em' }}>
            <ClockDisplay t={t} />
          </div>
        </FadeBlock>
      </Sprite>

      {/* Counters */}
      <Sprite start={sceneStart + 1.0} end={sceneStart + 9.5}>
        <FadeBlock fadeIn={0.5} fadeOut={0.4} style={{
          position: 'absolute', right: 80, top: 70, textAlign: 'right',
        }}>
          <div style={{ display: 'flex', gap: 64, justifyContent: 'flex-end' }}>
            <CounterBlock label="OPEN TICKETS" value={ticketCount} color="#E85D5D" />
            <CounterBlock label="RESOLVED" value={resolved} color={ARIA_DIM} />
          </div>
        </FadeBlock>
      </Sprite>

      {/* Center text */}
      <Sprite start={sceneStart + 6.2} end={sceneStart + 9.8}>
        <CenterMessage />
      </Sprite>
    </div>
  );
}

function ClockDisplay({ t }) {
  // Tick seconds rapidly to evoke time pressure
  const sec = Math.floor((9 * 3600 + 47 * 60 + 12) + t * 8);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return <span>{String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</span>;
}

function CounterBlock({ label, value, color }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 12, color: ARIA_DIM, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 64, color, fontWeight: 300, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {String(value).padStart(2, '0')}
      </div>
    </div>
  );
}

// Stream of ticket rows piling on
function TicketStream({ t }) {
  const tickets = [
    { time: '08:14', user: 'M. Chen', subj: 'Cannot login to VPN — Sales call in 20 min', urgent: true, age: '1h 33m' },
    { time: '08:31', user: 'R. Patel', subj: 'Printer offline — invoices waiting', urgent: false, age: '1h 16m' },
    { time: '08:42', user: 'L. Garcia', subj: 'Outlook keeps crashing on launch', urgent: false, age: '1h 05m' },
    { time: '08:55', user: 'D. Brooks', subj: 'Two-factor auth not sending codes', urgent: true, age: '52m' },
    { time: '09:03', user: 'A. Novak', subj: 'Shared drive permissions broken', urgent: false, age: '44m' },
    { time: '09:11', user: 'K. Olsen', subj: 'CRM sync down — leads not loading', urgent: true, age: '36m' },
    { time: '09:18', user: 'J. Rivera', subj: 'New laptop setup pending — Day 3', urgent: false, age: '29m' },
    { time: '09:24', user: 'B. Cohen', subj: 'Slack notifications stuck', urgent: false, age: '23m' },
    { time: '09:31', user: 'T. Zhao', subj: 'Quarterly report file corrupted', urgent: true, age: '16m' },
    { time: '09:38', user: 'P. Kumar', subj: 'Email attachments failing to send', urgent: false, age: '09m' },
    { time: '09:42', user: 'S. Walker', subj: 'Cannot access client portal — demo at 10', urgent: true, age: '05m' },
    { time: '09:45', user: 'E. Hart', subj: 'Password reset request', urgent: false, age: '02m' },
  ];

  // Each ticket appears at staggered times in window 1.0..6.0s
  const inStart = 1.0;
  const inEnd = 5.8;
  const span = inEnd - inStart;
  const stagger = span / tickets.length;

  return (
    <div style={{
      position: 'absolute',
      left: 80, right: 80,
      top: 220,
      display: 'flex', flexDirection: 'column',
      gap: 8,
    }}>
      {tickets.map((tk, i) => {
        const appearAt = inStart + i * stagger;
        const local = t - appearAt;
        if (local < 0) return null;
        const opacity = clamp(local / 0.25, 0, 1);
        const ty = (1 - clamp(local / 0.4, 0, 1)) * 12;
        // subtle red flash on urgent tickets
        const flash = tk.urgent ? Math.max(0, 0.5 - (local % 1.5)) * 0.3 : 0;
        return (
          <div key={i} style={{
            opacity,
            transform: `translateY(${ty}px)`,
            display: 'grid',
            gridTemplateColumns: '90px 160px 1fr 90px 24px',
            gap: 24,
            alignItems: 'center',
            padding: '10px 16px',
            background: tk.urgent ? `rgba(232, 93, 93, ${0.04 + flash})` : 'rgba(255,255,255,0.02)',
            border: `1px solid ${tk.urgent ? 'rgba(232, 93, 93, 0.25)' : 'rgba(255,255,255,0.06)'}`,
            borderLeft: tk.urgent ? '2px solid #E85D5D' : '2px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            fontFamily: MONO,
            fontSize: 13,
            color: ARIA_CREAM,
          }}>
            <span style={{ color: ARIA_DIM }}>{tk.time}</span>
            <span style={{ color: ARIA_CREAM }}>{tk.user}</span>
            <span style={{ color: tk.urgent ? '#F08080' : ARIA_CREAM, opacity: 0.92 }}>{tk.subj}</span>
            <span style={{ color: tk.urgent ? '#E85D5D' : ARIA_DIM, textAlign: 'right' }}>{tk.age}</span>
            <span style={{ color: ARIA_DIM, fontSize: 10, textAlign: 'right' }}>●●●</span>
          </div>
        );
      })}
    </div>
  );
}

function CenterMessage() {
  const { localTime, duration } = useSprite();
  // Letter-by-letter reveal of "Sound familiar?"
  const text = 'Sound familiar?';
  const charDur = 0.05;
  const reveal = Math.floor(localTime / charDur);

  let opacity = 1;
  const exitStart = duration - 0.6;
  if (localTime > exitStart) opacity = 1 - clamp((localTime - exitStart) / 0.6, 0, 1);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, rgba(10,9,8,0.85) 0%, rgba(10,9,8,0.5) 60%, transparent 100%)',
      opacity,
    }}>
      <div style={{
        fontFamily: SERIF,
        fontSize: 120,
        fontWeight: 400,
        fontStyle: 'italic',
        color: ARIA_CREAM,
        letterSpacing: '-0.02em',
        textAlign: 'center',
      }}>
        {text.split('').map((c, i) => (
          <span key={i} style={{
            opacity: i < reveal ? 1 : 0,
            transition: 'opacity 200ms',
            display: 'inline-block',
            whiteSpace: 'pre',
          }}>{c}</span>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Scene1Chaos });

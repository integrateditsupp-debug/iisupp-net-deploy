// axis-unify.js — one Axis. The globe is the single face; the executive panel is the console.
// The old dock console and its separate mic retire into the unified panel (same brain, same
// login, nothing lost — the dock code stays dormant, its data untouched).
(() => {
  const TOKEN_KEY = 'aperture_jwt';
  const css = document.createElement('style');
  css.textContent = `
    #axisDock,#axisFab,#axisQuickWake,#axisMic,#axisDirectorMic{display:none!important}
    #axisOrbGlobe{cursor:pointer;width:220px;height:220px}
    #axisOrbGlobe:focus-visible{outline:2px solid var(--gold);outline-offset:4px;border-radius:50%}
    #axisLiveGlobe{color:var(--gold-2);border-color:var(--gold);width:36px;height:36px;flex:none}
    #axisLiveGlobe[aria-pressed="true"]{background:var(--gold);color:var(--gold-ink)}
    @media(max-width:720px){#axisOrbGlobe{width:154px;height:154px}}
  `;
  document.head.appendChild(css);

  const signedIn = () => !!localStorage.getItem(TOKEN_KEY);
  const openAxis = (tab, say) => {
    if (!signedIn()) return;
    window.dispatchEvent(new CustomEvent('axis:open', { detail: { tab, say } }));
  };

  // Replace a node with a clean clone so earlier click wiring (the old console) is gone.
  const rewire = (id, fn) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const c = el.cloneNode(true);
    el.replaceWith(c);
    c.addEventListener('click', (e) => { e.preventDefault(); fn(e); });
    return c;
  };

  const boot = async () => {
    const globe = rewire('axisOrbGlobe', () => openAxis('work'));
    // Canvas pixels and renderer ownership cannot survive cloneNode. Mount a fresh face after
    // retiring only the old click handlers; snapshots, memories and the shared brain stay intact.
    if (globe) {
      globe.replaceChildren();
      delete globe.dataset.globeLive;
      const { mountGlobe } = await import('/assets/axis-globe.js?v=20261010c');
      mountGlobe(globe, { size: 220 });
      globe.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAxis('work'); }
      });
    }
    rewire('axisQuickOpen', () => openAxis('work'));
    rewire('axisQuickHolo', () => openAxis('work'));
    // Double-click the globe starts the live voice call (Aria's voice, as Axis).
    globe?.addEventListener('dblclick', () => window.axisLiveToggle?.());
    const bar = document.querySelector('#axisOrbit .axis-bar');
    if (bar && !document.getElementById('axisLiveGlobe')) {
      const mic = document.createElement('button');
      mic.id = 'axisLiveGlobe'; mic.className = 'chip'; mic.type = 'button';
      mic.title = 'Talk to Axis'; mic.setAttribute('aria-label', 'Talk to Axis');
      mic.setAttribute('aria-pressed', 'false');
      mic.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg>';
      mic.addEventListener('click', () => { if (signedIn()) { openAxis('work'); window.axisLiveToggle?.(); } });
      bar.insertBefore(mic, document.getElementById('axisQuickOpen'));
      const sync = () => {
        const active = Boolean(window.axisLiveActive);
        mic.setAttribute('aria-pressed', String(active));
        mic.title = active ? 'End Axis call' : 'Talk to Axis';
        mic.setAttribute('aria-label', mic.title);
      };
      setInterval(sync, 500);
    }

    // Quick bar: Enter talks to Axis through the same brain; the reply appears in the panel.
    document.addEventListener('keydown', async (e) => {
      if (e.key !== 'Enter' || e.target?.id !== 'axisQuick') return;
      e.stopImmediatePropagation();
      e.preventDefault();
      const q = e.target.value.trim();
      if (!q || !signedIn()) return;
      e.target.value = '';
      openAxis('work', 'Working on it…');
      try {
        const r = await fetch('/.netlify/functions/axis-director', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem(TOKEN_KEY) },
          body: JSON.stringify({ action: 'chat', messages: [{ role: 'user', content: q }] }),
        });
        const j = await r.json().catch(() => null);
        window.dispatchEvent(new CustomEvent('axis:say', { detail: { text: j?.text || j?.error || 'I could not reach my brain just now.' } }));
      } catch {
        window.dispatchEvent(new CustomEvent('axis:say', { detail: { text: 'Connection trouble — try again in a moment.' } }));
      }
    }, true);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 800));
  else setTimeout(boot, 800);
})();

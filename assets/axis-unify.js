// axis-unify.js — one Axis. The globe is the single face; the executive panel is the console.
// The old dock console and its separate mic retire into the unified panel (same brain, same
// login, nothing lost — the dock code stays dormant, its data untouched).
(() => {
  const TOKEN_KEY = 'aperture_jwt';
  const css = document.createElement('style');
  css.textContent = `
    #axisDock,#axisFab,#axisQuickWake,#axisMic,#axisDirectorMic{display:none!important}
    #axisOrbGlobe{cursor:pointer}
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

  const boot = () => {
    const globe = rewire('axisOrbGlobe', () => openAxis('work'));
    rewire('axisQuickOpen', () => openAxis('work'));
    rewire('axisQuickHolo', () => openAxis('work'));
    // Double-click the globe starts the live voice call (Aria's voice, as Axis).
    globe?.addEventListener('dblclick', () => window.axisLiveToggle?.());

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

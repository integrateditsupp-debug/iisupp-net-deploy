/*!
 * health-check-modal.js — IIS · 2026-06-18
 * Opens the 60-second IT Health Check as an in-page overlay popup.
 * Intercepts any <a href="/health-check"> click and renders the quiz inline.
 * Backend posts to /.netlify/functions/aria-health-lead (same as standalone page).
 * No page navigation. Close returns to the underlying page with state preserved.
 */
(function(){
  'use strict';
  if (window.__iisHealthCheckModal) return; // single-instance
  window.__iisHealthCheckModal = true;

  // ---- Questions mirror /health-check.html exactly (same scoring weights) ----
  var QUESTIONS = [
    { id:'support', w:18, q:"When something breaks, who fixes your IT?", opts:[
      {t:"A dedicated IT provider / MSP", v:1},
      {t:"One internal person who's stretched thin", v:0.6, risk:["Single point of failure for support","If your one IT person is sick or leaves, response time and knowledge walk out the door. A backed-up provider keeps coverage continuous."]},
      {t:"Whoever happens to be free", v:0.3, risk:["No clear owner for IT issues","Ad-hoc fixes mean problems recur and small issues become outages. A defined support path resolves tickets faster and cheaper."]},
      {t:"Honestly, nobody", v:0, risk:["No reliable way to resolve IT problems","You're absorbing downtime as a hidden cost. Even light managed support pays for itself by preventing one bad day."]}
    ]},
    { id:'backup', w:20, q:"How is your business data backed up?", opts:[
      {t:"Automated, offsite, and tested", v:1},
      {t:"Cloud sync only (OneDrive / Drive)", v:0.5, risk:["Sync is not a backup","File sync copies mistakes and ransomware instantly to the cloud too. A true versioned backup lets you roll back to before the damage."]},
      {t:"Occasional manual copies", v:0.25, risk:["Backups are inconsistent and unverified","Manual backups are usually out of date and rarely tested. The first time you find out they failed should not be during a real loss."]},
      {t:"Not sure / none", v:0, risk:["No recoverable backup in place","This is the single biggest risk on this list. One drive failure, theft, or ransomware event could be unrecoverable."]}
    ]},
    { id:'mfa', w:18, q:"Is multi-factor authentication (MFA) on email and key apps?", opts:[
      {t:"Yes — on for everyone", v:1},
      {t:"On for some people / apps", v:0.5, risk:["MFA coverage has gaps","Attackers find the one account without MFA. Coverage needs to be everyone, everywhere it matters — especially email and admin accounts."]},
      {t:"No", v:0, risk:["Accounts protected by passwords alone","Stolen or guessed passwords are the #1 way businesses get breached. MFA blocks the vast majority of account takeovers and is free to enable."]},
      {t:"Don't know", v:0.2, risk:["MFA status is unknown","If you can't confirm MFA is on, assume there are gaps. A 15-minute audit tells you exactly who's exposed."]}
    ]},
    { id:'access', w:14, q:"When did you last review who has access to what?", opts:[
      {t:"Within the last 6 months", v:1},
      {t:"Sometime this year", v:0.6, risk:["Access reviews are infrequent","Permissions drift as people join, move, and leave. Stale access is how ex-staff and forgotten accounts become a breach path."]},
      {t:"Over a year ago", v:0.25, risk:["Access hasn't been reviewed recently","Former employees or vendors may still have live access. A quick review usually finds accounts that should've been closed long ago."]},
      {t:"Never / not sure", v:0, risk:["No access governance","Nobody knows who can reach sensitive data. This is both a security and a compliance gap that's quick to start fixing."]}
    ]},
    { id:'licenses', w:12, q:"Microsoft 365 / Google licenses — confident you're not over-paying?", opts:[
      {t:"Yes, reviewed recently", v:1},
      {t:"Roughly, but not audited", v:0.5, risk:["License spend may be leaking","Most teams pay for unused seats, duplicate tools, or wrong tiers. A license audit commonly trims 10–30% with zero loss of capability."]},
      {t:"No idea", v:0.1, risk:["Likely paying for licenses you don't use","Unmanaged subscriptions quietly add up. A one-time audit often pays for a year of support out of the savings alone."]}
    ]},
    { id:'recovery', w:18, q:"If your main system went down right now, how long to recover?", opts:[
      {t:"Under an hour — we have a plan", v:1},
      {t:"A few hours", v:0.6, risk:["Recovery time is unclear","'A few hours' is a guess until it's tested. A simple recovery plan turns an outage from a crisis into a known, bounded event."]},
      {t:"Days", v:0.2, risk:["Extended downtime risk","Days offline can cost more than a year of IT support. A basic continuity plan dramatically shortens that window."]},
      {t:"We have no plan", v:0, risk:["No disaster-recovery plan","Without a plan, recovery is improvised and slow. The good news: a starter continuity plan is fast and inexpensive to put in place."]}
    ]}
  ];

  var POST_URL = '/.netlify/functions/aria-health-lead';
  var state = { i:0, answers:{}, score:0, grade:'', risks:[] };

  // ---- Inject CSS once ----
  var css = ''
    + '#iisHcOverlay{position:fixed;inset:0;background:rgba(5,5,5,0.20);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);display:none;align-items:center;justify-content:center;z-index:2147483600;padding:20px;animation:iisHcFade 0.25s ease}'
    + '#iisHcOverlay.iis-hc-open{display:flex}'
    + '@keyframes iisHcFade{from{opacity:0}to{opacity:1}}'
    + '#iisHcModal{background:#0a0a0a;border:1px solid rgba(197,160,89,0.45);border-radius:18px;width:100%;max-width:540px;max-height:88vh;overflow-y:auto;padding:34px 32px 28px;box-shadow:0 30px 80px rgba(0,0,0,0.65), 0 0 60px rgba(197,160,89,0.12);position:relative;animation:iisHcSlide 0.3s cubic-bezier(0.16, 1, 0.3, 1);color:#fff;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif}'
    + '@keyframes iisHcSlide{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}'
    + '#iisHcModal *{box-sizing:border-box}'
    + '.iis-hc-close{position:absolute;top:14px;right:18px;background:transparent;border:none;color:rgba(255,255,255,0.5);font-size:28px;cursor:pointer;line-height:1;padding:6px;transition:color 0.15s;font-weight:300}'
    + '.iis-hc-close:hover{color:#fff}'
    + '.iis-hc-crown{font-size:11px;letter-spacing:0.18em;color:#c5a059;text-transform:uppercase;margin-bottom:6px;font-weight:600}'
    + '.iis-hc-q{font-size:22px;font-weight:600;line-height:1.3;margin-bottom:8px;color:#fff}'
    + '.iis-hc-progress{display:flex;justify-content:space-between;align-items:center;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;letter-spacing:0.14em;color:rgba(255,255,255,0.45);text-transform:uppercase;margin:18px 0 10px}'
    + '.iis-hc-bar{height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;margin-bottom:24px}'
    + '.iis-hc-bar-fill{height:100%;background:linear-gradient(90deg, #c5a059, #f1dca7);transition:width 0.4s cubic-bezier(0.16, 1, 0.3, 1)}'
    + '.iis-hc-opts{display:flex;flex-direction:column;gap:8px;margin-top:14px}'
    + '.iis-hc-opt{display:flex;align-items:center;gap:11px;padding:14px 16px;background:#141414;border:1px solid #2a2a2a;border-radius:10px;cursor:pointer;color:#ddd;text-align:left;font-size:14.5px;line-height:1.4;transition:all 0.15s ease;font-family:inherit;width:100%}'
    + '.iis-hc-opt:hover{border-color:#c5a059;background:#1a1606;transform:translateX(2px)}'
    + '.iis-hc-pip{width:10px;height:10px;border:1.5px solid rgba(197,160,89,0.55);border-radius:50%;flex-shrink:0;transition:all 0.15s;display:inline-block}'
    + '.iis-hc-opt:hover .iis-hc-pip{border-color:#c5a059;background:#c5a059;box-shadow:0 0 8px rgba(197,160,89,0.6)}'
    + '.iis-hc-foot{margin-top:18px;text-align:center;font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:0.05em}'
    + '.iis-hc-score-block{text-align:center;padding:14px 0}'
    + '.iis-hc-dial{font-size:84px;font-weight:700;background:linear-gradient(135deg,#c5a059,#f1dca7);-webkit-background-clip:text;background-clip:text;color:transparent;line-height:1;margin-bottom:4px}'
    + '.iis-hc-grade{color:#c5a059;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0.22em;font-size:12px;text-transform:uppercase;margin-bottom:14px}'
    + '.iis-hc-verdict{color:#ddd;font-size:14px;line-height:1.5;max-width:420px;margin:0 auto 18px}'
    + '.iis-hc-risks{background:#141414;border-radius:10px;padding:18px;margin:18px 0;text-align:left}'
    + '.iis-hc-risks h3{color:#c5a059;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:600}'
    + '.iis-hc-risk{display:flex;gap:10px;margin-bottom:12px;font-size:13.5px;color:#ddd;line-height:1.5}'
    + '.iis-hc-risk:last-child{margin-bottom:0}'
    + '.iis-hc-risk .iis-hc-x{color:#f87171;font-weight:700;flex-shrink:0;margin-top:2px}'
    + '.iis-hc-risk .iis-hc-ok{color:#2dd4bf;font-weight:700;flex-shrink:0;margin-top:2px}'
    + '.iis-hc-risk small{display:block;color:#888;font-size:12px;margin-top:3px}'
    + '.iis-hc-form{display:flex;flex-direction:column;gap:8px;margin-top:18px}'
    + '.iis-hc-form input{padding:11px 13px;background:#050505;border:1px solid #2a2a2a;border-radius:8px;color:#fff;font-size:14px;font-family:inherit;width:100%}'
    + '.iis-hc-form input:focus{outline:none;border-color:#c5a059}'
    + '.iis-hc-actions{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}'
    + '.iis-hc-btn-primary{flex:1;min-width:200px;padding:13px;background:linear-gradient(135deg,#c5a059,#f1dca7);color:#050505;border:none;border-radius:8px;font-weight:700;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;cursor:pointer;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;transition:all 0.15s}'
    + '.iis-hc-btn-primary:hover{transform:translateY(-1px);box-shadow:0 10px 24px rgba(197,160,89,0.3)}'
    + '.iis-hc-btn-primary:disabled{opacity:0.5;cursor:wait;transform:none}'
    + '.iis-hc-btn-close{padding:13px 24px;background:transparent;color:rgba(255,255,255,0.7);border:1px solid #2a2a2a;border-radius:8px;cursor:pointer;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;transition:all 0.15s}'
    + '.iis-hc-btn-close:hover{background:#1a1a1a;color:#fff;border-color:#444}'
    + '.iis-hc-err{color:#f87171;font-size:13px;margin-top:8px;min-height:18px}'
    + '.iis-hc-blur-target{filter:blur(5px) brightness(0.75);transition:filter 0.3s ease}'
    + 'body.iis-hc-open{overflow:hidden}'
    + '@media(max-width:560px){#iisHcModal{padding:24px 20px 20px;max-height:92vh}.iis-hc-q{font-size:18px}.iis-hc-dial{font-size:64px}}';

  var style = document.createElement('style');
  style.id = 'iisHcStyles';
  style.textContent = css;
  document.head.appendChild(style);

  // ---- Build overlay shell ----
  var overlay = document.createElement('div');
  overlay.id = 'iisHcOverlay';
  overlay.innerHTML = '<div id="iisHcModal"><button class="iis-hc-close" aria-label="Close">&times;</button><div id="iisHcBody"></div></div>';
  document.body.appendChild(overlay);

  function $(id){ return document.getElementById(id); }
  function blurBg(on){
    // Blur the main page content (everything except our overlay)
    var nodes = document.body.children;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n === overlay) continue;
      if (on) n.classList.add('iis-hc-blur-target'); else n.classList.remove('iis-hc-blur-target');
    }
  }
  function open(){
    state = { i:0, answers:{}, score:0, grade:'', risks:[] };
    overlay.classList.add('iis-hc-open');
    document.body.classList.add('iis-hc-open');
    blurBg(true);
    renderQ();
    setTimeout(function(){ var first = overlay.querySelector('.iis-hc-opt'); if (first) first.focus(); }, 50);
  }
  function close(){
    overlay.classList.remove('iis-hc-open');
    document.body.classList.remove('iis-hc-open');
    blurBg(false);
  }
  window.iisOpenHealthCheck = open;
  window.iisCloseHealthCheck = close;

  overlay.querySelector('.iis-hc-close').addEventListener('click', close);
  overlay.addEventListener('click', function(e){ if (e.target === overlay) close(); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && overlay.classList.contains('iis-hc-open')) close(); });

  // Intercept any /health-check link
  document.addEventListener('click', function(e){
    var t = e.target;
    while (t && t !== document.body) {
      if (t.tagName === 'A' && t.getAttribute('href')) {
        var h = t.getAttribute('href').replace(/[?#].*$/, '');
        if (h === '/health-check' || h === '/health-check.html' || h === 'health-check' || h === '/health-check/') {
          e.preventDefault();
          open();
          return;
        }
      }
      t = t.parentNode;
    }
  }, true);

  // ---- Render functions ----
  function renderQ(){
    var q = QUESTIONS[state.i];
    var pct = Math.round((state.i / QUESTIONS.length) * 100);
    $('iisHcBody').innerHTML =
      '<div class="iis-hc-crown">60-second IT Health Check</div>' +
      '<h2 class="iis-hc-q">' + q.q + '</h2>' +
      '<div class="iis-hc-progress"><span>Question ' + (state.i+1) + ' of ' + QUESTIONS.length + '</span><span>' + pct + '% complete</span></div>' +
      '<div class="iis-hc-bar"><div class="iis-hc-bar-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="iis-hc-opts" id="iisHcOpts"></div>' +
      '<div class="iis-hc-foot">Free &middot; No signup to see your score &middot; Press ESC to close</div>';
    var box = $('iisHcOpts');
    q.opts.forEach(function(o){
      var b = document.createElement('button');
      b.className = 'iis-hc-opt';
      b.type = 'button';
      b.innerHTML = '<span class="iis-hc-pip"></span><span>' + escapeHtml(o.t) + '</span>';
      b.addEventListener('click', function(){ pick(q, o); });
      box.appendChild(b);
    });
  }

  function pick(q, o){
    state.answers[q.id] = o.t;
    if (o.risk) state.risks.push({ key:q.id, title:o.risk[0], detail:o.risk[1] });
    if (state.i < QUESTIONS.length - 1){ state.i++; renderQ(); }
    else finish();
  }

  function finish(){
    var total=0, max=0;
    QUESTIONS.forEach(function(q){
      max += q.w;
      var chosen = q.opts.find(function(o){ return o.t === state.answers[q.id]; });
      total += q.w * (chosen ? chosen.v : 0);
    });
    var score = Math.round(total / max * 100);
    state.score = score;
    state.grade = score>=90?'A':score>=80?'B':score>=70?'C':score>=55?'D':'F';
    var wmap = {}; QUESTIONS.forEach(function(q){ wmap[q.id]=q.w; });
    state.risks.sort(function(a,b){ return (wmap[b.key]||0) - (wmap[a.key]||0); });
    var top = state.risks.slice(0,3);
    var verdict = verdictText(score);

    var risksHtml = '';
    if (!top.length) {
      risksHtml = '<div class="iis-hc-risk"><span class="iis-hc-ok">&#10003;</span><div><b>Your fundamentals look strong.</b><small>No major red flags surfaced. A periodic review keeps it that way.</small></div></div>';
    } else {
      top.forEach(function(r){
        risksHtml += '<div class="iis-hc-risk"><span class="iis-hc-x">&times;</span><div><b>' + escapeHtml(r.title) + '</b><small>' + escapeHtml(r.detail) + '</small></div></div>';
      });
    }

    $('iisHcBody').innerHTML =
      '<div class="iis-hc-crown">Your IT Health Score</div>' +
      '<div class="iis-hc-score-block">' +
        '<div class="iis-hc-dial">' + score + '</div>' +
        '<div class="iis-hc-grade">Grade ' + state.grade + ' &middot; ' + tierLabel(score) + '</div>' +
        '<p class="iis-hc-verdict">' + verdict + '</p>' +
      '</div>' +
      '<div class="iis-hc-risks"><h3>Your top ' + (top.length || 0) + ' risk' + (top.length === 1 ? '' : 's') + '</h3>' + risksHtml + '</div>' +
      '<form class="iis-hc-form" id="iisHcLeadForm">' +
        '<input type="text" id="iisHcName" placeholder="Your name (optional)">' +
        '<input type="email" id="iisHcEmail" placeholder="Email — get the full report" required>' +
        '<input type="text" id="iisHcCompany" placeholder="Company (optional)">' +
        '<input type="tel" id="iisHcPhone" placeholder="Phone (optional)">' +
        '<div class="iis-hc-err" id="iisHcErr"></div>' +
      '</form>' +
      '<div class="iis-hc-actions">' +
        '<button class="iis-hc-btn-primary" id="iisHcSend">Email me the full report &rarr;</button>' +
        '<button class="iis-hc-btn-close" id="iisHcCloseFinal">Close</button>' +
      '</div>' +
      '<div class="iis-hc-foot" id="iisHcThanks" style="display:none">Check your inbox &mdash; your full report is on its way. We will reach out within one business day. Close returns you to the page.</div>';

    $('iisHcSend').addEventListener('click', submitLead);
    $('iisHcCloseFinal').addEventListener('click', close);
  }

  function tierLabel(s){
    if (s>=90) return 'Excellent';
    if (s>=80) return 'Good';
    if (s>=70) return 'Fair';
    if (s>=55) return 'At risk';
    return 'Exposed';
  }
  function verdictText(s){
    if (s>=90) return 'Your IT foundation is in strong shape -- you are managing risk like a much larger team.';
    if (s>=80) return 'The basics are mostly covered, with a few worthwhile tune-ups to close the gaps below.';
    if (s>=70) return 'You are functional, but a few of these gaps could turn a small problem into an expensive one.';
    if (s>=55) return 'Several important safeguards are missing -- the items below are where one bad day usually starts.';
    return 'Core protections are not in place yet. The good news: every item below is fixable, and the first ones are quick.';
  }

  function submitLead(){
    var email = ($('iisHcEmail').value || '').trim();
    var err = $('iisHcErr');
    err.textContent = '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ err.textContent = 'Please enter a valid email so we can send your report.'; return; }
    var btn = $('iisHcSend'); btn.disabled = true; btn.textContent = 'Sending...';
    var payload = {
      name: ($('iisHcName').value || '').trim(),
      email: email,
      company: ($('iisHcCompany').value || '').trim(),
      phone: ($('iisHcPhone').value || '').trim(),
      score: state.score, grade: state.grade,
      answers: state.answers,
      risks: state.risks.slice(0,3).map(function(r){ return r.title; }),
      source: 'health-check-modal'
    };
    fetch(POST_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      .then(function(r){
        if (!r.ok) throw new Error('send_failed');
        $('iisHcLeadForm').style.display = 'none';
        btn.style.display = 'none';
        $('iisHcThanks').style.display = 'block';
        $('iisHcCloseFinal').textContent = 'Close';
      })
      .catch(function(){
        err.textContent = 'Could not send -- try again or email ahmad.wasee@iisupp.net directly.';
        btn.disabled = false;
        btn.textContent = 'Email me the full report →';
      });
  }

  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, function(c){
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
})();

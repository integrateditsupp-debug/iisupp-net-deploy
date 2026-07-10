/* ARIA orb-transform visualization — additive, namespaced (aex-), self-contained.
   Ships as one file + one <script> line in aria.html. Safe + reversible.
   - The REAL ARIA orb (#globeWrap .globe-stage) morphs in place when a query is sent:
       A  ->  app icon (by detected issue)  ->  fault-path dive  ->  diagnosis check  ->  A
   - A compact, clearly-labeled VISUALIZATION box is added in the chat showing what ARIA is checking.
   - The "Resolve it for me" auto-fix card is grayed out as COMING SOON (future feature).
   Honesty: this is an illustrative visualization of ARIA's reasoning. It does NOT claim ARIA
   executed anything on the user's device. No fabricated "resolved / downtime saved" metrics.
*/
(function(){
  if(window.__AEX_ORB)return; window.__AEX_ORB=true;

  var CSS=''
  +'.aexo{position:absolute;inset:0;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;z-index:40;pointer-events:none}'
  +'.aexo .lay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:0;transform:scale(.8);transition:opacity .4s,transform .55s cubic-bezier(.2,.8,.2,1)}'
  +'.aexo .lay.on{opacity:1;transform:scale(1)}.aexo .lay.zoom{opacity:0;transform:scale(5)}'
  +'.aextile{width:140px;height:140px;border-radius:28px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 44px rgba(40,130,230,.5),inset 0 3px 14px rgba(255,255,255,.22);position:relative}'
  +'.aextile svg{width:74px;height:74px}'
  +'.aexapp{width:140px;height:140px;border-radius:28px;background:linear-gradient(155deg,#1b8df0,#0a5bd0);display:flex;align-items:center;justify-content:center;box-shadow:0 0 44px rgba(40,130,230,.55),inset 0 3px 14px rgba(255,255,255,.25);position:relative}'
  +'.aexapp .cd{width:92px;height:70px;background:#fff;border-radius:9px;position:relative;overflow:hidden;box-shadow:0 6px 16px rgba(0,0,0,.25)}'
  +'.aexapp .cd:before{content:"";position:absolute;left:7px;top:7px;width:60px;height:34px;background:#bcd8ff;clip-path:polygon(0 0,100% 0,50% 100%)}'
  +'.aexapp .o{position:absolute;right:14px;top:50%;transform:translateY(-50%);width:60px;height:60px;border-radius:50%;background:#0a5bd0;border:10px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.3)}'
  +'.aexapp .o:after{content:"";position:absolute;inset:9px;border:7px solid #fff;border-radius:50%}'
  +'.aexcv{position:absolute;inset:0;width:100%;height:100%}'
  +'.aexml{font:600 12px ui-monospace,monospace;letter-spacing:.06em;color:#ff6f67;text-shadow:0 0 12px rgba(255,80,70,.7);border:1px solid rgba(255,90,80,.5);background:rgba(30,8,6,.6);padding:6px 9px;border-radius:7px;text-align:center;max-width:80%}'
  +'.aexck{width:96px;height:96px;border-radius:50%;border:3px solid #7fe0a0;display:flex;align-items:center;justify-content:center;box-shadow:0 0 44px rgba(120,220,160,.45)}'
  +'.aexexec{margin:10px 0;border:1px solid #2a2516;border-radius:12px;background:#100e08;overflow:hidden;max-width:340px}'
  +'.aexeh{display:flex;align-items:center;gap:8px;padding:8px 12px;font:600 11px ui-monospace,monospace;letter-spacing:.06em;color:#cda85c;border-bottom:1px solid #221d12}'
  +'.aexeh span{margin-left:auto;font-weight:500;color:#0e0a04;background:#cda85c;border-radius:5px;padding:2px 7px;font-size:9px}'
  +'.aexes{padding:9px 12px;font:12px ui-monospace,monospace;line-height:1.7;color:#bdb49c}'
  +'.aexes .l{opacity:0;transform:translateY(3px);transition:.3s}.aexes .l.in{opacity:1;transform:none}'
  +'.aexes .ok{color:#86e3a6}.aexes .e{color:#ff9a90}.aexes .a{color:#cda85c}'
  +'.aexcs{position:absolute;right:8px;top:8px;z-index:5;font:600 9px ui-monospace,monospace;letter-spacing:.08em;color:#0e0a04;background:#cda85c;border-radius:5px;padding:3px 7px}';

  function svgGlyph(name){
    if(name==='printer')return '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6"/><rect x="6" y="13" width="12" height="8" rx="1"/><path d="M6 17H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/></svg>';
    if(name==='wifi')return '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/></svg>';
    if(name==='lock')return '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
    if(name==='disk')return '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
  }
  function tile(grad,glyph){return '<div class="aextile" style="background:linear-gradient(155deg,'+grad+')">'+svgGlyph(glyph)+'</div>';}
  var OUTLOOK_ICON='<div class="aexapp"><div class="cd"></div><div class="o"></div></div>';

  var SC={
    outlook:{kw:['outlook','email','mail'],icon:OUTLOOK_ICON,mlbl:'OUTLOOK',steps:[['a','recognized: Microsoft Outlook'],['','checking process tree + add-ins'],['e','likely: hung process or bad add-in'],['ok','diagnosis ready — fix steps below']]},
    printer:{kw:['printer','print','spooler','queue'],icon:tile('#3b82f6,#1e40af','printer'),mlbl:'SPOOLER',steps:[['a','recognized: printer / spooler'],['','checking print queue + spooler service'],['e','likely: stuck spooler or queue'],['ok','diagnosis ready — fix steps below']]},
    wifi:{kw:['wifi','wi-fi','wireless','internet','network','dropping'],icon:tile('#14b8a6,#0f766e','wifi'),mlbl:'WI-FI ADAPTER',steps:[['a','recognized: Wi-Fi / network'],['','checking adapter + DHCP lease'],['e','likely: adapter drop or lease issue'],['ok','diagnosis ready — fix steps below']]},
    password:{kw:['password','locked','lock','account','sign in','sign-in','login','reset'],icon:tile('#f59e0b,#b45309','lock'),mlbl:'ACCOUNT',steps:[['a','recognized: account / sign-in'],['','checking lockout + sign-in logs'],['e','likely: lockout from failed sign-ins'],['ok','diagnosis ready — fix steps below']]},
    disk:{kw:['disk','storage','space','full','c drive','cleanup'],icon:tile('#8b5cf6,#5b21b6','disk'),mlbl:'DRIVE C:',steps:[['a','recognized: disk / storage'],['','checking drive usage + temp files'],['e','likely: low free space'],['ok','diagnosis ready — fix steps below']]},
    generic:{kw:[],icon:tile('#475569,#1e293b','search'),mlbl:'DIAGNOSING',steps:[['a','analyzing your request'],['','mapping to the right fix path'],['','preparing guided steps'],['ok','steps ready below']]}
  };
  function pick(t){t=(t||'').toLowerCase();for(var id in SC){if(id!=='generic'&&SC[id].kw.some(function(k){return t.indexOf(k)>=0;}))return id;}return 'generic';}

  function ready(fn){if(document.readyState!=='loading')fn();else document.addEventListener('DOMContentLoaded',fn);}
  ready(function(){
    var style=document.createElement('style');style.id='aex-orb-style';style.textContent=CSS;document.head.appendChild(style);

<<<<<<< HEAD
    // HARD RULE 14 (2026-06-26): "Resolve it for me" is now ACTIVE. It hands the issue to the ARIA Sentinel
    // desktop app (openResolveModal → aria-sentinel://) which runs the gated fix on-device (approve + 10s
    // countdown + System Restore point + Ctrl+Alt+K kill-switch). It is no longer grayed as COMING SOON.
    // ungray() also strips any stale COMING SOON gray a cached build may have left on the card.
    function ungray(){document.querySelectorAll('.choice.recommended').forEach(function(o2){o2.style.opacity='';o2.style.filter='';o2.style.pointerEvents='';o2.__aexg=0;var b=o2.querySelector('.aexcs');if(b)b.remove();});}
    ungray();
    try{new MutationObserver(ungray).observe(document.body,{childList:true,subtree:true});}catch(e){}
=======
    // gray out the "Resolve it for me" auto-fix card whenever it appears (it is added dynamically)
    function gray(){document.querySelectorAll('.choice.recommended').forEach(function(o2){if(o2.__aexg)return;o2.__aexg=1;o2.style.position='relative';o2.style.opacity='.5';o2.style.filter='grayscale(1)';o2.style.pointerEvents='none';var b=document.createElement('div');b.className='aexcs';b.textContent='COMING SOON';o2.appendChild(b);});}
    gray();
    try{new MutationObserver(gray).observe(document.body,{childList:true,subtree:true});}catch(e){}
>>>>>>> 6a5244d1 (Lanes 30-32 [A/B + testimonial + image audit])

    var ovBuilt=false,letterEl=null,stageEl=null;
    function buildOverlay(){
      stageEl=document.querySelector('#globeWrap .globe-stage')||document.querySelector('.globe-stage');
      letterEl=document.querySelector('#globeWrap .globe-letter')||document.querySelector('.globe-letter');
      if(!stageEl)return false;
      if(getComputedStyle(stageEl).position==='static')stageEl.style.position='relative';
      var ov=document.createElement('div');ov.className='aexo';ov.id='aexOv';
      ov.innerHTML='<div class="lay" id="aexIcon"></div>'
        +'<div class="lay" id="aexDive"><canvas class="aexcv" id="aexCv"></canvas></div>'
        +'<div class="lay" id="aexFault"><div class="aexml" id="aexMl"></div></div>'
        +'<div class="lay" id="aexCheck"><div class="aexck"><svg width="46" height="46" viewBox="0 0 24 24"><path d="M4 12 L10 18 L20 6" fill="none" stroke="#7fe0a0" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div>';
      stageEl.appendChild(ov);ovBuilt=true;return true;
    }
    function lay(id){['aexIcon','aexDive','aexFault','aexCheck'].forEach(function(k){var e=document.getElementById(k);if(!e)return;e.classList.toggle('on',k===id);if(k!=='aexDive')e.classList.remove('zoom');});}

    function dive(){
      var c=document.getElementById('aexCv');if(!c)return;var x=c.getContext('2d'),dpr=Math.min(2,window.devicePixelRatio||1);
      var w=c.clientWidth||320,h=c.clientHeight||320;c.width=w*dpr;c.height=h*dpr;x.setTransform(dpr,0,0,dpr,0,0);
      var GAP=46,VW=w*2.2,VH=h*2.2,fx=w*1.05,fy=h*1.05,t0=performance.now();
      var pk=[];for(var k=0;k<12;k++){var hz=Math.random()<.5;pk.push({hz:hz,line:Math.round(Math.random()*(hz?VH:VW)/GAP)*GAP,p:Math.random()*(hz?VW:VH),sp:60+Math.random()*110,col:Math.random()<.3?'#5dd6b0':'#ffd98a'});}
      window.__aexDiving=true;
      function fr(now){if(!window.__aexDiving){return;}var el=(now-t0)/1000,z=1+Math.min(el/1.8,1)*1.9,dt=1/60;
        x.clearRect(0,0,w,h);x.save();x.translate(w/2,h/2);x.scale(z,z);x.translate(-fx,-fy);
        x.lineWidth=1;x.strokeStyle='rgba(201,163,90,.18)';
        for(var gx=0;gx<VW;gx+=GAP){x.beginPath();x.moveTo(gx,0);x.lineTo(gx,VH);x.stroke();}
        for(var gy=0;gy<VH;gy+=GAP){x.beginPath();x.moveTo(0,gy);x.lineTo(VW,gy);x.stroke();}
        x.shadowBlur=8;pk.forEach(function(o){o.p+=o.sp*dt;var len=o.hz?VW:VH;if(o.p>len)o.p=0;var px=o.hz?o.p:o.line,py=o.hz?o.line:o.p;x.shadowColor=o.col;x.strokeStyle=o.col;x.lineWidth=2;x.beginPath();if(o.hz){x.moveTo(px-13,py);x.lineTo(px,py);}else{x.moveTo(px,py-13);x.lineTo(px,py);}x.stroke();});
        if(el>1.1){var pr=5+Math.sin(el*7)*2.5;x.shadowColor='#ff5a4e';x.shadowBlur=18;x.fillStyle='#ff5a4e';x.beginPath();x.arc(fx,fy,pr,0,7);x.fill();}
        x.shadowBlur=0;x.restore();requestAnimationFrame(fr);}
      requestAnimationFrame(fr);
    }

    var running=false,timers=[];
    function clearTimers(){timers.forEach(clearTimeout);timers=[];}
    function execBox(S){
      var cm=document.getElementById('chatMessages');if(!cm)return;
      var box=document.createElement('div');box.className='aexexec';
      box.innerHTML='<div class="aexeh">ARIA · diagnostic <span>VISUALIZATION</span></div><div class="aexes"></div>';
      cm.appendChild(box);cm.scrollTop=cm.scrollHeight;
      var es=box.querySelector('.aexes'),i=0;
      (function nx(){if(i>=S.steps.length)return;var d=document.createElement('div');d.className='l '+S.steps[i][0];d.innerHTML='&rsaquo; '+S.steps[i][1];es.appendChild(d);cm.scrollTop=cm.scrollHeight;requestAnimationFrame(function(){d.classList.add('in');});i++;timers.push(setTimeout(nx,650));})();
    }
    window.aexRun=function(text){
      if(running)return;if(!ovBuilt&&!buildOverlay())return;running=true;clearTimers();
      var S=SC[pick(text)];
      document.getElementById('aexIcon').innerHTML=S.icon;
      var ml=document.getElementById('aexMl');if(ml)ml.textContent=S.mlbl;
      void 0; /* in-chat diagnostic box removed; orb morph is the cue */
      var lo=letterEl?letterEl.style.opacity:'';if(letterEl){letterEl.style.transition='opacity .4s';letterEl.style.opacity='.08';}
      lay('aexIcon');
      function at(ms,f){timers.push(setTimeout(f,ms));}
      at(1300,function(){var ic=document.getElementById('aexIcon');ic.classList.add('zoom');lay('aexDive');dive();});
      at(3000,function(){window.__aexDiving=false;lay('aexFault');});
      at(4100,function(){lay('aexCheck');});
      at(5300,function(){lay('');if(letterEl)letterEl.style.opacity=(lo||'');running=false;});
    };

    // trigger the visualization when the user submits a question (does not interfere with ARIA's own handling)
    var inp=document.getElementById('askInput');
    if(inp){inp.addEventListener('keydown',function(e){if(e.key==='Enter'){var v=inp.value;if(v&&v.trim().length>1)setTimeout(function(){window.aexRun(v);},120);}},true);}
  });
})();

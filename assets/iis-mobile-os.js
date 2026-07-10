/*! ==========================================================================
   IIS MOBILE OS v1.0 — the phone-native home for iisupp.net (m.html only)
   --------------------------------------------------------------------------
   Direction: "Globe OS + Concierge" (Ahmad, 2026-07-10) — ruthless declutter.
   · Screen one: a living gold globe with four orbiting doors, one serif
     promise, a single ASK ARIA action, and a quiet scroll cue.
   · Screen two: four concierge doors (Services · Library · Shop · Book).
   · Everything m.html used to stack inline folds into THE INDEX — the same
     chapter drawers used across the site (Rule 15: collapsed, never deleted).
   Runs ONLY when its own script tag carries data-page="m". If this script
   never runs, m.html renders exactly as before.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__IIS_MOBILE_OS__) return;
  var doc = document;
  var tag = doc.currentScript;
  if (!tag || tag.getAttribute('data-page') !== 'm') return;
  window.__IIS_MOBILE_OS__ = 1;

  var ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];

  function onReady(fn) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function el(tag2, cls, parent) {
    var n = doc.createElement(tag2);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }

  /* ---------------- screen one: the living globe ---------------- */
  function buildHome() {
    var home = doc.createElement('section');
    home.id = 'ios-home';
    home.innerHTML =
      '<p class="ios-eyebrow">A Distinguished Network</p>' +
      '<div class="ios-stage">' +
        '<div class="ios-halo" aria-hidden="true"></div>' +
        '<div class="ios-ring" aria-hidden="true"></div>' +
        '<div class="ios-globe" aria-hidden="true">' +
          '<span class="ios-mono">A</span>' +
          '<i class="ios-lat"></i><i class="ios-lat ios-lat2"></i><i class="ios-lon"></i>' +
        '</div>' +
        '<div class="ios-orbit" aria-hidden="false">' +
          '<a class="ios-chip ios-chip-n" href="/services.html"><span>Services</span></a>' +
          '<a class="ios-chip ios-chip-e" href="/shop.html"><span>Shop</span></a>' +
          '<a class="ios-chip ios-chip-s" href="/book.html?lane=general-fit&source=mobile-os-orbit&subject=Book%20a%20scoping%20call"><span>Book</span></a>' +
          '<a class="ios-chip ios-chip-w" href="/growth-library.html"><span>Library</span></a>' +
        '</div>' +
      '</div>' +
      '<h1 class="ios-title">Distinguished IT,<br><em>in your pocket</em></h1>' +
      '<p class="ios-sub">A senior technician in seconds — voice or text. It tries first, and only then escalates.</p>' +
      '<a class="ios-cta" href="/aria.html"><span>Ask ARIA</span></a>' +
      '<button type="button" class="ios-cue" id="ios-cue">The Index<i></i></button>';
    return home;
  }

  /* ---------------- screen two: the concierge doors ---------------- */
  function buildDoors() {
    var doors = doc.createElement('section');
    doors.id = 'ios-doors';
    doors.innerHTML =
      '<p class="ios-doors-head">Four doors. Everything behind them.</p>' +
      '<a class="ios-door" href="/services.html" style="--i:0">' +
        '<span class="ios-door-glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/></svg></span>' +
        '<span class="ios-door-copy"><b>Services and retainers</b><small>Managed IT, from lean teams to enterprise</small></span>' +
        '<span class="ios-door-arrow">→</span></a>' +
      '<a class="ios-door" href="/growth-library.html" style="--i:1">' +
        '<span class="ios-door-glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5V5a2 2 0 012-2h13v18H6a2 2 0 01-2-1.5z"/><path d="M9 7h7M9 11h7"/></svg></span>' +
        '<span class="ios-door-copy"><b>The Growth Library</b><small>Guides, packs, and the reading room</small></span>' +
        '<span class="ios-door-arrow">→</span></a>' +
      '<a class="ios-door" href="/shop.html" style="--i:2">' +
        '<span class="ios-door-glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7h16l-1.5 12.5a2 2 0 01-2 1.5h-9a2 2 0 01-2-1.5L4 7z"/><path d="M8 10V5a4 4 0 018 0v5"/></svg></span>' +
        '<span class="ios-door-copy"><b>Shop and marketplace</b><small>Devices, concierge sourcing, digital packs</small></span>' +
        '<span class="ios-door-arrow">→</span></a>' +
      '<a class="ios-door" href="/book.html?lane=general-fit&source=mobile-os-door&subject=Book%20a%20scoping%20call" style="--i:3">' +
        '<span class="ios-door-glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg></span>' +
        '<span class="ios-door-copy"><b>Book a scoping call</b><small>A short human conversation, staged right</small></span>' +
        '<span class="ios-door-arrow">→</span></a>';
    return doors;
  }

  /* ---------------- the index: fold the old page into chapters -------- */
  function summarize(section) {
    var p = section.querySelector('p');
    if (p && p.textContent.trim()) return p.textContent.replace(/\s+/g, ' ').trim().slice(0, 80);
    return '';
  }

  function foldSections() {
    var sections = [];
    var all = doc.querySelectorAll('body > section, main > section');
    for (var i = 0; i < all.length; i++) {
      var s = all[i];
      if (s.id === 'ios-home' || s.id === 'ios-doors') continue;
      if (s.getBoundingClientRect && s.getBoundingClientRect().height < 4 && s.offsetHeight < 4) { /* keep hidden helpers out */ }
      sections.push(s);
    }
    if (!sections.length) return null;
    doc.body.classList.add('iis-chapters');

    var indexWrap = doc.createElement('section');
    indexWrap.id = 'ios-index';
    var note = el('p', 'ios-index-note', indexWrap);
    note.textContent = 'The Index — the whole story, one chapter at a time';

    for (var j = 0; j < sections.length; j++) {
      (function (section, idx) {
        var h = section.querySelector('h1,h2,h3');
        var title = h ? h.textContent.replace(/\s+/g, ' ').trim() : 'Chapter';
        var sub = summarize(section);

        var chapter = el('div', 'gl-chapter', indexWrap);
        if (section.id) chapter.setAttribute('data-for', section.id);

        var head = doc.createElement('button');
        head.type = 'button';
        head.className = 'gl-chapter-head';
        head.setAttribute('aria-expanded', 'false');
        head.innerHTML =
          '<span class="gl-chapter-num">' + (ROMANS[idx] || (idx + 1)) + '</span>' +
          '<span class="gl-chapter-titles"><span class="gl-chapter-title"></span>' +
          '<span class="gl-chapter-sub"></span></span>' +
          '<svg class="gl-chapter-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';
        head.querySelector('.gl-chapter-title').textContent = title;
        head.querySelector('.gl-chapter-sub').textContent = sub;

        var body = el('div', 'gl-chapter-body');
        chapter.appendChild(head);
        chapter.appendChild(body);
        body.appendChild(section);
        section.classList.remove('iism-reveal', 'iism-in');

        function setOpen(open) {
          chapter.classList.toggle('open', open);
          head.setAttribute('aria-expanded', open ? 'true' : 'false');
          if (open) {
            body.style.maxHeight = body.scrollHeight + 'px';
            window.setTimeout(function () {
              if (chapter.classList.contains('open')) body.style.maxHeight = 'none';
            }, 750);
          } else {
            body.style.maxHeight = body.scrollHeight + 'px';
            void body.offsetHeight;
            body.style.maxHeight = '0px';
          }
        }
        setOpen(false);
        body.style.maxHeight = '0px';
        head.addEventListener('click', function () { setOpen(!chapter.classList.contains('open')); });
        chapter.__glOpen = setOpen;
      })(sections[j], j);
    }
    return indexWrap;
  }

  /* ---------------- boot ---------------- */
  onReady(function () {
    try {
      if (window.matchMedia && window.matchMedia('(min-width: 981px)').matches) return; /* phones + small tablets only */
      doc.body.classList.add('ios-on');

      var home = buildHome();
      var doors = buildDoors();
      var first = doc.body.querySelector('section, main, header');
      doc.body.insertBefore(home, first || doc.body.firstChild);
      home.after(doors);

      var index = foldSections();
      if (index) doors.after(index);

      var cue = doc.getElementById('ios-cue');
      if (cue && index) cue.addEventListener('click', function () {
        index.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      /* deep links: open the matching chapter */
      function expandFor(id) {
        if (!id) return;
        var target = doc.getElementById(id);
        var ch = target && target.closest ? target.closest('.gl-chapter') : null;
        if (ch && ch.__glOpen) {
          ch.__glOpen(true);
          window.setTimeout(function () { ch.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 140);
        }
      }
      if (window.location.hash) expandFor(window.location.hash.slice(1));
      window.addEventListener('hashchange', function () { expandFor(window.location.hash.slice(1)); });

      /* staggered entrance for the doors */
      window.setTimeout(function () { doc.body.classList.add('ios-in'); }, 80);
    } catch (e) { /* never break the page */ }
  });
})();

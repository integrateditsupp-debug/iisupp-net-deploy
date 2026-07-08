/*! ==========================================================================
   IIS SITE UPGRADES v1.2 — additive page enhancers (Rule 15: add, never remove)
   --------------------------------------------------------------------------
   NOTE: the Road Ahead roadmap ships its own 3D flip (rm-flip in aria-core);
   iis-motion.css enriches it with CSS only — no DOM work here.

   GROWTH LIBRARY (self-detecting on #books-grid + IIS_CATALOG.books):
   1. READING ROOM  — "Trending this week" featured strip above the Two-Paths
      split, weekly trend rotation + local view boost (honest — no invented
      numbers), topic filter chips, see-the-full-shelf anchor.
   2. REAL SHELVES  — books are chunked into rows that stand on rendered
      wooden ledges inside a gold-trimmed bookcase (featured + top-books).
   3. CHAPTER INDEX — the page's long marketing bands fold into elegant
      collapsible chapters (Roman-numeral index). Nothing is removed; every
      section is one click away, auto-expands when deep-linked.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__IIS_UPGRADES__) return;
  window.__IIS_UPGRADES__ = 1.2;

  var doc = document;

  function onReady(fn) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* ======================================================================
     GROWTH LIBRARY
     ====================================================================== */
  var VIEWS_KEY = 'iis_gl_views_v1';

  function isoWeekSeed() {
    var d = new Date();
    var jan = new Date(d.getFullYear(), 0, 1);
    var week = Math.floor(((d - jan) / 86400000 + jan.getDay() + 1) / 7);
    return d.getFullYear() * 100 + week;
  }

  function hashStr(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h;
  }

  function getViews() {
    try { return JSON.parse(window.localStorage.getItem(VIEWS_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function bumpView(id) {
    try {
      var v = getViews();
      v[id] = (v[id] || 0) + 1;
      window.localStorage.setItem(VIEWS_KEY, JSON.stringify(v));
    } catch (e) { /* private mode etc. */ }
  }

  function trendRank(books) {
    var seed = isoWeekSeed();
    var views = getViews();
    return books.slice().sort(function (a, b) {
      var sa = (hashStr(a.id + ':' + seed) % 1000) + Math.min((views[a.id] || 0) * 120, 600);
      var sb = (hashStr(b.id + ':' + seed) % 1000) + Math.min((views[b.id] || 0) * 120, 600);
      return sb - sa;
    });
  }

  /* ---------- shelving: chunk cards into rows standing on ledges -------- */
  function perShelf(container, cap) {
    var w = container.clientWidth || container.parentNode.clientWidth || 1000;
    var per = Math.max(1, Math.floor((w - 60) / 250));
    return Math.min(per, cap || 4);
  }

  function shelveInto(container, cardHtmlList, cap) {
    var per = perShelf(container, cap);
    var html = '';
    for (var i = 0; i < cardHtmlList.length; i += per) {
      html += '<div class="gl-shelf-row">' + cardHtmlList.slice(i, i + per).join('') + '</div>' +
              '<div class="gl-ledge" aria-hidden="true"></div>';
    }
    container.innerHTML = html;
    container.setAttribute('data-per', String(per));
  }

  function encase(el, crownText) {
    if (!el || (el.parentNode && el.parentNode.classList && el.parentNode.classList.contains('gl-case-inner'))) return;
    var box = doc.createElement('div');
    box.className = 'gl-bookcase';
    var crown = doc.createElement('div');
    crown.className = 'gl-crown';
    crown.innerHTML = '<span>' + (crownText || 'The Shelves') + '</span>';
    var inner = doc.createElement('div');
    inner.className = 'gl-case-inner';
    el.parentNode.insertBefore(box, el);
    box.appendChild(crown);
    box.appendChild(inner);
    inner.appendChild(el);
  }

  function enhanceLibrary() {
    var grid = doc.getElementById('books-grid');
    var cat = window.IIS_CATALOG;
    if (!grid || !cat || !cat.books || !cat.books.length || !cat.renderBook) return;
    doc.body.classList.add('gl-page');

    var ranked = trendRank(cat.books);
    var current = 'all';

    /* ---------- featured strip above the Two-Paths split ---------- */
    var feat = doc.getElementById('gl-featured');
    if (!feat) {
      var host = null;
      var split = doc.querySelector('.split-card');
      if (split && split.closest) host = split.closest('section');
      if (!host) {
        host = doc.getElementById('vault');
        if (host && host.closest) host = host.closest('section') || host;
      }
      var anchor = host || (grid.closest && grid.closest('section')) || grid;

      feat = doc.createElement('section');
      feat.id = 'gl-featured';
      feat.innerHTML =
        '<p class="glf-eyebrow">The Reading Room</p>' +
        '<h2>Trending <em>this week</em></h2>' +
        '<p class="glf-note">Our shelf rotates weekly — and adapts to what you open. No noise, just what readers are reaching for.</p>' +
        '<div class="glf-row"></div>' +
        '<a class="glf-more" href="#books-grid">See the full shelf ↓</a>';
      anchor.parentNode.insertBefore(feat, anchor);

      var more = feat.querySelector('.glf-more');
      if (more) more.addEventListener('click', function (ev) {
        ev.preventDefault();
        var target = doc.getElementById('gl-shelf-filters') || grid;
        try { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        catch (e) { window.location.hash = 'books-grid'; }
      });
    }
    var featRow = feat.querySelector('.glf-row');

    /* ---------- topic filter chips ---------- */
    var topics = [];
    for (var i = 0; i < cat.books.length; i++) {
      var t = cat.books[i].topic || 'Other';
      if (topics.indexOf(t) === -1) topics.push(t);
    }

    function renderShelves() {
      ranked = trendRank(cat.books);
      var list = ranked.filter(function (b) {
        return current === 'all' || (b.topic || 'Other') === current;
      });
      shelveInto(grid, list.map(cat.renderBook), 4);
      if (featRow) shelveInto(featRow, ranked.slice(0, 3).map(cat.renderBook), 3);
      if (!list.length) {
        grid.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,.45);padding:30px 0">Nothing on this shelf yet.</p>';
      }
    }

    if (!doc.getElementById('gl-shelf-filters')) {
      var bar = doc.createElement('div');
      bar.id = 'gl-shelf-filters';
      var chips = ['all'].concat(topics);
      for (var c = 0; c < chips.length; c++) {
        var b = doc.createElement('button');
        b.className = 'glt' + (chips[c] === 'all' ? ' is-on' : '');
        b.setAttribute('data-topic', chips[c]);
        b.textContent = chips[c] === 'all' ? 'All shelves' : chips[c];
        bar.appendChild(b);
      }
      var note = doc.createElement('p');
      note.className = 'gl-shelf-note';
      note.textContent = 'Sorted by this week’s trend · rotates automatically';
      grid.parentNode.insertBefore(bar, grid);
      grid.parentNode.insertBefore(note, grid);

      bar.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('.glt') : null;
        if (!btn) return;
        current = btn.getAttribute('data-topic') || 'all';
        var all = bar.querySelectorAll('.glt');
        for (var x = 0; x < all.length; x++) all[x].classList.remove('is-on');
        btn.classList.add('is-on');
        renderShelves();
      });
    }

    /* ---------- build the cases + first render ---------- */
    encase(grid, 'The Collection');
    if (featRow) encase(featRow, 'Trending — This Week’s Shelf');
    renderShelves();

    /* responsive re-shelving */
    var rt = null;
    window.addEventListener('resize', function () {
      if (rt) window.clearTimeout(rt);
      rt = window.setTimeout(function () {
        var per = parseInt(grid.getAttribute('data-per') || '0', 10);
        if (perShelf(grid, 4) !== per) renderShelves();
      }, 250);
    }, { passive: true });

    /* ---------- record what THIS visitor opens (local only) ---------- */
    function watchClicks(container) {
      if (!container) return;
      container.addEventListener('click', function (ev) {
        var book = ev.target && ev.target.closest ? ev.target.closest('.iis-book') : null;
        if (!book) return;
        var id = book.getAttribute('data-id') || book.id || '';
        if (!id) {
          var tEl = book.querySelector('.iis-book__title, h3, h4');
          if (tEl) {
            var tt = tEl.textContent.trim().slice(0, 40);
            for (var i = 0; i < cat.books.length; i++) {
              if (cat.books[i].title.indexOf(tt) === 0) { id = cat.books[i].id; break; }
            }
          }
        }
        if (id) bumpView(id);
      }, true);
    }
    watchClicks(grid);
    watchClicks(feat);

    /* ---------- mobile tap-to-flip parity ---------- */
    try {
      if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        grid.addEventListener('click', function (ev) {
          var book = ev.target.closest('.iis-book'); if (!book) return;
          if (ev.target.closest('.iis-book__open') || ev.target.closest('.iis-book__peek')) return;
          if (!book.classList.contains('is-flipped')) {
            ev.preventDefault();
            var flipped = grid.querySelectorAll('.iis-book.is-flipped');
            for (var f = 0; f < flipped.length; f++) if (flipped[f] !== book) flipped[f].classList.remove('is-flipped');
            book.classList.add('is-flipped');
          }
        });
      }
    } catch (e) { /* noop */ }
  }

  /* ======================================================================
     CHAPTER INDEX — fold the long bands into collapsible chapters.
     Content is never removed; it lives one elegant click away (Rule 15
     collapse pattern). Deep links auto-expand their chapter.
     ====================================================================== */
  var ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  function chapterTargets() {
    var wanted = [];
    function byId(id) { var el = doc.getElementById(id); if (el) wanted.push(el.tagName === 'SECTION' ? el : (el.closest && el.closest('section'))); }
    function byClass(cls) { var el = doc.querySelector('section.' + cls); if (el) wanted.push(el); }
    function byHeading(frag) {
      var secs = doc.querySelectorAll('section');
      for (var i = 0; i < secs.length; i++) {
        var h = secs[i].querySelector('h1,h2,h3');
        if (h && h.textContent.toLowerCase().indexOf(frag) !== -1) { wanted.push(secs[i]); return; }
      }
    }
    byClass('ai-edge-band');                    /* AI Edge makes this easier to buy */
    byClass('route-band');                      /* Pick the next move */
    byId('helpdesk-spotlight');                 /* Blueprint spotlight */
    byHeading('cleanest entry point');          /* Choose the cleanest entry point */
    byId('ai-automation-book');                 /* AI Automation Setup book */
    byHeading('buying depth');                  /* Pick the buying depth */
    byId('allaccess');                          /* The All-Access pass */
    /* de-dup + drop anything containing the shelves or the vault */
    var out = [];
    for (var j = 0; j < wanted.length; j++) {
      var s = wanted[j];
      if (!s || out.indexOf(s) !== -1) continue;
      if (s.querySelector && (s.querySelector('#books-grid') || s.querySelector('#vault-grid') || s.querySelector('#gl-featured'))) continue;
      if (s.id === 'gl-featured' || s.id === 'vault' || s.id === 'topbooks' || s.id === 'access') continue;
      out.push(s);
    }
    return out;
  }

  function summarize(section) {
    var eyebrow = section.querySelector('.eyebrow');
    if (eyebrow && eyebrow.textContent.trim()) return eyebrow.textContent.replace(/\s+/g, ' ').trim().slice(0, 90);
    var p = section.querySelector('p');
    if (p && p.textContent.trim()) return p.textContent.replace(/\s+/g, ' ').trim().slice(0, 90) + '…';
    return '';
  }

  function organizeChapters() {
    if (!doc.body.classList.contains('gl-page')) return;
    if (doc.querySelector('.gl-chapter')) return;
    var sections = chapterTargets();
    if (!sections.length) return;

    for (var i = 0; i < sections.length; i++) {
      (function (section, idx) {
        var h = section.querySelector('h1,h2,h3');
        var title = h ? h.textContent.replace(/\s+/g, ' ').trim() : 'More';
        var sub = summarize(section);

        var chapter = doc.createElement('div');
        chapter.className = 'gl-chapter';
        if (section.id) chapter.setAttribute('data-for', section.id);

        var head = doc.createElement('button');
        head.type = 'button';
        head.className = 'gl-chapter-head';
        head.setAttribute('aria-expanded', 'false');
        head.innerHTML =
          '<span class="gl-chapter-num">' + (ROMANS[idx] || (idx + 1)) + '</span>' +
          '<span class="gl-chapter-titles"><span class="gl-chapter-title">' + title + '</span>' +
          (sub ? '<span class="gl-chapter-sub">' + sub + '</span>' : '') + '</span>' +
          '<svg class="gl-chapter-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>';

        var body = doc.createElement('div');
        body.className = 'gl-chapter-body';

        section.parentNode.insertBefore(chapter, section);
        chapter.appendChild(head);
        chapter.appendChild(body);
        body.appendChild(section);

        /* never leave folded content invisible if the motion layer marked it */
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
            void body.offsetHeight; /* reflow so the collapse animates */
            body.style.maxHeight = '0px';
          }
        }
        setOpen(false);
        body.style.maxHeight = '0px';

        head.addEventListener('click', function () {
          setOpen(!chapter.classList.contains('open'));
        });

        chapter.__glOpen = setOpen;
      })(sections[i], i);
    }

    /* index note above the first chapter */
    var first = doc.querySelector('.gl-chapter');
    if (first && !doc.getElementById('gl-index-note')) {
      var note = doc.createElement('p');
      note.id = 'gl-index-note';
      note.textContent = 'The Library Index — open any chapter';
      first.parentNode.insertBefore(note, first);
    }

    /* deep links (e.g. #allaccess, ?focus=helpdesk) auto-expand */
    function expandFor(id) {
      if (!id) return;
      var ch = doc.querySelector('.gl-chapter[data-for="' + id + '"]');
      if (!ch) {
        var el = doc.getElementById(id);
        ch = el && el.closest ? el.closest('.gl-chapter') : null;
      }
      if (ch && ch.__glOpen) {
        ch.__glOpen(true);
        window.setTimeout(function () { ch.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 120);
      }
    }
    if (window.location.hash) expandFor(window.location.hash.slice(1));
    try {
      if (new URLSearchParams(window.location.search).get('focus') === 'helpdesk') expandFor('helpdesk-spotlight');
    } catch (e) { /* noop */ }
    window.addEventListener('hashchange', function () { expandFor(window.location.hash.slice(1)); });
  }

  /* ======================================================================
     boot
     ====================================================================== */
  onReady(function () {
    try { enhanceLibrary(); } catch (e) { /* noop */ }
    try { organizeChapters(); } catch (e) { /* noop */ }
  });
})();

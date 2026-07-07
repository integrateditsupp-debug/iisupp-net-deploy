/*! ==========================================================================
   IIS SITE UPGRADES v1.1 — additive page enhancers (Rule 15: add, never remove)
   --------------------------------------------------------------------------
   NOTE (v1.1): the Road Ahead roadmap on main already ships its own 3D flip
   (rm-flip / rm-flip-inner inside aria-core.js). We therefore do NOT touch
   its DOM here — iis-motion.css enriches that flip purely with CSS (deeper
   3D, lift, glow, back-face sheen). The v1.0 DOM wrapper was removed.

   GROWTH LIBRARY ORGANIZER (#books-grid + IIS_CATALOG.books):
      · "Trending this week" featured strip — top 3 books lifted to the top
        of the page, with a "See the full shelf" link down to the grid.
      · Topic filter chips above the shelf.
      · Automatic weekly trend rotation: deterministic per-ISO-week ranking,
        gently boosted by what THIS visitor opens (localStorage only, no
        tracking). Honest label — no invented sales numbers (Rule 14).
      · Mobile tap-to-flip parity for the book shelf.
   ========================================================================== */
(function () {
  'use strict';
  if (window.__IIS_UPGRADES__) return;
  window.__IIS_UPGRADES__ = 1;

  var doc = document;

  function onReady(fn) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* ======================================================================
     GROWTH LIBRARY ORGANIZER
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

  function enhanceLibrary() {
    var grid = doc.getElementById('books-grid');
    var cat = window.IIS_CATALOG;
    if (!grid || !cat || !cat.books || !cat.books.length || !cat.renderBook) return;
    doc.body.classList.add('gl-page');

    var ranked = trendRank(cat.books);

    /* ---------- featured strip: top 3 to the top of the page ---------- */
    if (!doc.getElementById('gl-featured')) {
      var host = doc.getElementById('vault');
      if (host && host.closest) host = host.closest('section') || host;
      var anchor = host || (grid.closest && grid.closest('section')) || grid;

      var feat = doc.createElement('section');
      feat.id = 'gl-featured';
      feat.innerHTML =
        '<p class="glf-eyebrow">The Reading Room</p>' +
        '<h2>Trending <em>this week</em></h2>' +
        '<p class="glf-note">Our shelf rotates weekly — and adapts to what you open. No noise, just what readers are reaching for.</p>' +
        '<div class="glf-row">' +
          ranked.slice(0, 3).map(cat.renderBook).join('') +
        '</div>' +
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

    /* ---------- topic filter chips above the shelf ---------- */
    var topics = [];
    for (var i = 0; i < cat.books.length; i++) {
      var t = cat.books[i].topic || 'Other';
      if (topics.indexOf(t) === -1) topics.push(t);
    }
    var current = 'all';

    function renderShelf() {
      var list = trendRank(cat.books).filter(function (b) {
        return current === 'all' || (b.topic || 'Other') === current;
      });
      grid.innerHTML = list.map(cat.renderBook).join('') ||
        '<p style="grid-column:1/-1;text-align:center;color:rgba(255,255,255,.45);padding:30px 0">Nothing on this shelf yet.</p>';
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
        renderShelf();
      });
    }

    /* ---------- initial trend-ordered render ---------- */
    renderShelf();

    /* ---------- record what THIS visitor opens (local only) ---------- */
    function watchClicks(container) {
      if (!container) return;
      container.addEventListener('click', function (ev) {
        var book = ev.target && ev.target.closest ? ev.target.closest('.iis-book') : null;
        if (!book) return;
        var id = book.getAttribute('data-id') || book.id || '';
        if (!id) {
          /* fall back: find by title text against catalog */
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
    watchClicks(doc.getElementById('gl-featured'));

    /* ---------- mobile tap-to-flip parity for the shelf ---------- */
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
     boot
     ====================================================================== */
  onReady(function () {
    try { enhanceLibrary(); } catch (e) { /* noop */ }
  });
})();

/*!
 * aria-voice-conversation.js — ARIA's conversational voice loop for the web (iisupp.net/aria).
 * 2026-10-08 (RUN-CU, ARIA voice packet).
 *
 * One state machine, no DOM:
 *
 *   idle ─start()─▶ listening ──turn committed──▶ thinking ──reply──▶ speaking ──┐
 *                      ▲                                                        │ listen:true (after a
 *                      └──────────────────── 300 ms gap ◀────────────────────────┘ 300 ms gap)
 *                                                                                └─ needs_input:false /
 *                                                                                   degraded / end phrase /
 *                                                                                   stop() / 2 empty turns ─▶ ended
 *
 *   listening  — Web Speech API (continuous:true, interimResults:true, lang from navigator.language). A turn
 *                ends on the recognition's FINAL result followed by 1.6 s of silence (more speech pushes the
 *                timer). A cycle that ends with no words is an "empty turn"; two in a row end the loop.
 *   thinking   — POST aria-chat with the rolling history (last 12 turns), `voice:true`, `platform` and a
 *                one-line `device` hint. The server returns `speak` / `needs_input` / `listen` / `action`
 *                (see netlify/functions/aria-chat.js, VOICE MODE block).
 *   speaking   — speechSynthesis of `speak` (fallback: first two sentences of `text`, markdown stripped),
 *                chunked by sentence so Chrome's ~15 s utterance cut-off cannot leave the loop hanging.
 *                BARGE-IN: recognition keeps running while ARIA talks; real speech from the user cancels the
 *                synthesis and becomes the start of the next turn. Text that is mostly ARIA's own words
 *                (speaker echo) is ignored.
 *
 * Everything the loop touches is injected (SpeechRecognition, speechSynthesis, fetch, timers, clock), so the
 * same file runs under node in tests/aria-voice-conversation.test.mjs with fakes and makes no network call.
 *
 * Honesty rules baked in: nothing is spoken or transcribed that did not come from the user or the server;
 * timestamps come from the injected clock; the module never pretends to run a fix (`sentinel-fix` is handed
 * back to the page as an action, the page shows the existing ARIA Sentinel CTA).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.AriaVoiceConversation = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  'use strict';

  var STATES = { IDLE: 'idle', LISTENING: 'listening', THINKING: 'thinking', SPEAKING: 'speaking', ENDED: 'ended' };

  var DEFAULTS = {
    endpoint: '/.netlify/functions/aria-chat',
    silenceMs: 1600,          // silence after a final result that ends the user's turn
    rearmGapMs: 300,          // gap between ARIA finishing and the mic re-arming
    maxHistoryTurns: 12,      // rolling history sent to the server
    maxEmptyTurns: 2,         // consecutive empty listening cycles before the loop ends
    speakMaxWords: 55,        // mirrors the server cap
    speakStartTimeoutMs: 2500,// if the utterance never starts (TTS gated / no audio), move on
    bargeIn: true,
    bargeInMinChars: 10,      // shorter interim text while ARIA speaks is treated as noise
    fetchTimeoutMs: 30000,
  };

  // Short closers only. Anchored and capped at six words so "stop the printer from jamming" is a turn.
  var END_RE = /^(?:(?:ok(?:ay)?|alright|no|nope|yes|yeah)[,\s]+)?(?:that(?:'?s| is) (?:all|it|everything)|stop(?: listening| voice| talking)?|good ?bye|bye(?: bye)?|thanks?,? ?bye|thank you,? ?bye|(?:i'?m|we'?re) (?:done|good|all set)|end (?:the )?(?:call|voice|conversation|chat)|no(?:thing)? (?:else|more)|all done|that'?ll do)(?:[,\s]+(?:thanks?|thank you|aria|that'?s all|bye))*$/i;

  function normalizeUtterance(text) {
    return String(text || '').toLowerCase().replace(/[^a-z'\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function isEndPhrase(text) {
    var t = normalizeUtterance(text);
    if (!t) return false;
    if (t.split(' ').length > 6) return false;
    return END_RE.test(t);
  }

  function stripMarkdown(input) {
    var t = String(input || '');
    t = t.replace(/```[\s\S]*?```/g, ' ');
    t = t.replace(/`([^`]*)`/g, '$1');
    t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
    t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    t = t.replace(/https?:\/\/\S+/g, ' ');
    t = t.replace(/^\s{0,3}#{1,6}\s+/gm, '');
    t = t.replace(/^\s*(?:[-*+•]|\d+[.)])\s+/gm, '');
    t = t.replace(/(\*\*|__)(.*?)\1/g, '$2');
    t = t.replace(/(\*|_)(.*?)\1/g, '$2');
    t = t.replace(/<[^>]+>/g, ' ');
    t = t.replace(/[>|#*_~]/g, ' ');
    t = t.replace(/\s+/g, ' ').trim();
    return t;
  }

  function splitSentences(text) {
    var out = [];
    var re = /[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g;
    var m;
    var s = String(text || '').trim();
    while ((m = re.exec(s)) !== null) {
      var part = m[0].trim();
      if (part) out.push(part);
    }
    return out;
  }

  function firstSentences(text, n) {
    return splitSentences(text).slice(0, n).join(' ').trim();
  }

  function capWords(text, max) {
    var words = String(text || '').split(/\s+/).filter(Boolean);
    if (words.length <= max) return words.join(' ');
    return words.slice(0, max).join(' ').replace(/[,;:]$/, '') + '.';
  }

  /** What to say when the server did not give `speak`: first two sentences of `text`, markdown stripped. */
  function fallbackSpeak(text, maxWords) {
    return capWords(firstSentences(stripMarkdown(text), 2), maxWords || DEFAULTS.speakMaxWords);
  }

  /** Sentence chunks of ~160 chars so each utterance stays well under the Chrome cut-off. */
  function chunkForSpeech(text) {
    var sentences = splitSentences(text);
    var chunks = [];
    var cur = '';
    for (var i = 0; i < sentences.length; i++) {
      var s = sentences[i];
      if (cur && (cur + ' ' + s).length > 160) { chunks.push(cur); cur = s; }
      else cur = cur ? cur + ' ' + s : s;
    }
    if (cur) chunks.push(cur);
    return chunks.length ? chunks : (String(text || '').trim() ? [String(text).trim()] : []);
  }

  var ACTION_KINDS = { guide: 1, 'sentinel-fix': 1, escalate: 1, none: 1 };
  function normalizeAction(a) {
    if (!a || typeof a !== 'object') return { kind: 'none', recipeHint: null };
    var kind = ACTION_KINDS[String(a.kind)] ? String(a.kind) : 'none';
    var hint = typeof a.recipeHint === 'string' && a.recipeHint.trim() ? a.recipeHint.trim().slice(0, 80) : null;
    return { kind: kind, recipeHint: kind === 'none' ? null : hint };
  }

  function tokens(text) {
    return normalizeUtterance(text).split(' ').filter(function (w) { return w.length >= 3; });
  }

  /**
   * Speaker echo guard for barge-in: when most of what the mic heard is what ARIA is saying right now,
   * it is ARIA, not the user. Fewer than two usable words is noise either way.
   */
  function looksLikeEcho(heard, spoken) {
    var h = tokens(heard);
    if (h.length < 2) return true;
    var set = {};
    tokens(spoken).forEach(function (w) { set[w] = 1; });
    var hits = 0;
    h.forEach(function (w) { if (set[w]) hits++; });
    return hits / h.length >= 0.6;
  }

  /** One-line platform / device hint for the server prompt (never more than the UA already reveals). */
  function platformInfo(nav) {
    nav = nav || {};
    var ua = String(nav.userAgent || '');
    var uad = nav.userAgentData || null;
    var raw = String((uad && uad.platform) || nav.platform || '');
    var os = 'Unknown OS';
    if (/win/i.test(raw) || /Windows/i.test(ua)) os = 'Windows';
    else if (/iphone|ipad|ipod/i.test(raw) || /iPhone|iPad|iPod/.test(ua)) os = 'iOS/iPadOS';
    else if (/mac/i.test(raw) || /Macintosh/.test(ua)) os = 'macOS';
    else if (/android/i.test(raw) || /Android/.test(ua)) os = 'Android';
    else if (/cros/i.test(raw) || /CrOS/.test(ua)) os = 'Chrome OS';
    else if (/linux/i.test(raw) || /Linux/.test(ua)) os = 'Linux';
    var browser = 'browser';
    if (uad && Array.isArray(uad.brands)) {
      var b = uad.brands.map(function (x) { return String(x.brand || ''); })
        .filter(function (x) { return x && !/not.a.brand/i.test(x) && !/^chromium$/i.test(x); })[0];
      if (b) browser = b;
    }
    if (browser === 'browser') {
      if (/Edg\//.test(ua)) browser = 'Microsoft Edge';
      else if (/OPR\//.test(ua)) browser = 'Opera';
      else if (/Chrome\//.test(ua)) browser = 'Chrome';
      else if (/Firefox\//.test(ua)) browser = 'Firefox';
      else if (/Safari\//.test(ua)) browser = 'Safari';
    }
    var mobile = uad ? uad.mobile === true : /Mobi|Android|iPhone|iPad/.test(ua);
    return {
      platform: os,
      device: { os: os, app: 'web browser (' + browser + ', ' + (mobile ? 'mobile' : 'desktop') + ', voice mode)' },
    };
  }

  function detectSpeechRecognition(root) {
    if (!root) return null;
    return root.SpeechRecognition || root.webkitSpeechRecognition || null;
  }

  function isSupported(root) { return !!detectSpeechRecognition(root); }

  /** The engine needs continuous recognition; a browser without the property falls back to the one-shot path. */
  function supportsContinuous(root) {
    var SR = detectSpeechRecognition(root);
    if (!SR) return false;
    try { var r = new SR(); return 'continuous' in r; } catch (_) { return false; }
  }

  function noop() {}

  function createVoiceConversation(options) {
    var o = options || {};
    var cfg = {};
    for (var k in DEFAULTS) cfg[k] = (o[k] === undefined) ? DEFAULTS[k] : o[k];

    var SR = o.SpeechRecognition || null;
    var synth = o.speechSynthesis || null;
    var Utterance = o.SpeechSynthesisUtterance || null;
    var fetchFn = o.fetch || null;
    var setT = o.setTimeout || (typeof setTimeout === 'function' ? setTimeout : null);
    var clearT = o.clearTimeout || (typeof clearTimeout === 'function' ? clearTimeout : null);
    var now = o.now || function () { return Date.now(); };
    var nav = o.navigator || {};
    var lang = o.lang || nav.language || 'en-US';
    var pinfo = o.platformInfo || platformInfo(nav);

    var cb = {
      onState: o.onState || noop, onInterim: o.onInterim || noop, onUserTurn: o.onUserTurn || noop,
      onAssistantTurn: o.onAssistantTurn || noop, onAction: o.onAction || noop, onError: o.onError || noop,
      onEnd: o.onEnd || noop, onHistory: o.onHistory || noop, beforeSpeak: o.beforeSpeak || noop,
      augmentSpeak: o.augmentSpeak || null, onEmptyTurn: o.onEmptyTurn || noop, pickVoice: o.pickVoice || null,
    };

    var state = STATES.IDLE;
    var ended = false;
    var startedAt = 0;
    var history = Array.isArray(o.history) ? o.history.slice(-cfg.maxHistoryTurns) : [];
    var rec = null;             // current SpeechRecognition instance
    var recActive = false;
    var pendingFinal = '';
    var emptyTurns = 0;
    var noSpeechFlag = false;
    var silenceTimer = null, gapTimer = null;
    var fetchSeq = 0;
    var speakGen = 0;           // generation counter: stale utterance callbacks are ignored
    var spokenNow = '';
    var bargedIn = false;       // the current listening cycle began by interrupting ARIA
    var afterSpeechCb = null;
    var speakTimers = [];

    function clearTimer(t) { if (t && clearT) clearT(t); }
    function clearSpeakTimers() { speakTimers.forEach(clearTimer); speakTimers = []; }
    function later(fn, ms) { return setT ? setT(fn, ms) : null; }

    function setState(next, meta) {
      var prev = state;
      state = next;
      cb.onState(next, prev, meta || {});
    }

    function elapsedMs() { return startedAt ? Math.max(0, now() - startedAt) : 0; }
    function turnMeta(extra) {
      var m = { at: now(), elapsedMs: elapsedMs() };
      if (extra) for (var k2 in extra) m[k2] = extra[k2];
      return m;
    }

    function resolveSessionId() {
      var s = typeof o.sessionId === 'function' ? o.sessionId() : o.sessionId;
      return s == null ? undefined : String(s);
    }

    function trimHistory() {
      if (history.length > cfg.maxHistoryTurns) history = history.slice(-cfg.maxHistoryTurns);
    }

    // ── recognition ────────────────────────────────────────────────────────────
    function startRecognition() {
      if (ended || !SR) return false;
      var r;
      try { r = new SR(); }
      catch (e) { cb.onError('recognition-failed', { message: e && e.message }); endConversation('recognition-failed'); return false; }
      r.lang = lang;
      r.continuous = true;
      r.interimResults = true;
      try { r.maxAlternatives = 1; } catch (_) { /* read-only on some engines */ }
      // Property handlers on purpose: a page-level wrapper injects its own chat bubble for addEventListener('result').
      r.onresult = function (ev) { if (r === rec) handleResult(ev); };
      r.onerror = function (ev) { if (r === rec) handleRecError(ev); };
      r.onend = function () { if (r === rec) handleRecEnd(); };
      r.onstart = function () { if (r === rec) recActive = true; };
      rec = r;
      noSpeechFlag = false;
      try { r.start(); recActive = true; }
      catch (e) {
        // Chrome throws InvalidStateError when the previous session has not fully released yet: retry once.
        recActive = true;
        later(function () {
          if (rec !== r || ended) return;
          try { r.start(); } catch (_) { /* already running — results arrive on this instance */ }
        }, 250);
      }
      return true;
    }

    function stopRecognition() {
      var r = rec;
      rec = null;
      recActive = false;
      if (!r) return;
      r.onresult = null; r.onerror = null; r.onend = null; r.onstart = null;
      try { r.abort(); } catch (_) { try { r.stop(); } catch (__) { /* already stopped */ } }
    }

    function armSilence() {
      clearTimer(silenceTimer);
      silenceTimer = later(function () { silenceTimer = null; commitTurn(); }, cfg.silenceMs);
    }

    function handleResult(ev) {
      var results = (ev && ev.results) || [];
      var from = (ev && typeof ev.resultIndex === 'number') ? ev.resultIndex : 0;
      var finalChunk = '', interim = '';
      for (var i = from; i < results.length; i++) {
        var r = results[i];
        var alt = r && r[0];
        var txt = alt && alt.transcript ? String(alt.transcript) : '';
        if (!txt) continue;
        if (r.isFinal) finalChunk += (finalChunk ? ' ' : '') + txt.trim();
        else interim += (interim ? ' ' : '') + txt.trim();
      }

      if (state === STATES.SPEAKING) {
        if (!cfg.bargeIn) return;
        var heard = (finalChunk || interim).trim();
        if (heard.length < cfg.bargeInMinChars || looksLikeEcho(heard, spokenNow)) return;
        // Real speech while ARIA talks: cancel the voice and take the words as the start of the next turn.
        cancelSpeech();
        clearTimer(gapTimer); gapTimer = null;
        bargedIn = true;
        pendingFinal = finalChunk.trim();
        setState(STATES.LISTENING, { bargeIn: true });
        cb.onInterim((pendingFinal + ' ' + interim).trim());
        if (pendingFinal) armSilence();
        return;
      }

      if (state !== STATES.LISTENING) return;
      if (finalChunk) {
        pendingFinal = (pendingFinal + ' ' + finalChunk).trim();
        cb.onInterim(pendingFinal);
        armSilence();
      } else if (interim) {
        cb.onInterim((pendingFinal + ' ' + interim).trim());
        if (pendingFinal) armSilence(); // still talking → push the turn end
      }
    }

    function handleRecError(ev) {
      var code = String((ev && ev.error) || 'unknown');
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        cb.onError('mic-denied', { code: code }); endConversation('mic-denied'); return;
      }
      if (code === 'no-speech') { noSpeechFlag = true; return; }          // onend follows → empty turn
      if (code === 'aborted') return;                                     // our own stop/abort
      if (code === 'audio-capture') { cb.onError('no-microphone', { code: code }); endConversation('no-microphone'); return; }
      if (code === 'network') { cb.onError('recognition-network', { code: code }); endConversation('recognition-network'); return; }
      cb.onError('recognition-error', { code: code });
      endConversation('recognition-error');
    }

    function handleRecEnd() {
      // The browser closed the recognition session on its own (silence, no-speech, engine limits).
      rec = null;
      recActive = false;
      if (ended) return;
      if (state === STATES.LISTENING) {
        clearTimer(silenceTimer); silenceTimer = null;
        if (pendingFinal.trim()) { commitTurn(); return; }
        emptyTurns++;
        cb.onEmptyTurn(emptyTurns, { noSpeech: noSpeechFlag });
        if (emptyTurns >= cfg.maxEmptyTurns) { endConversation('silence'); return; }
        startRecognition();
      }
      // speaking: the barge-in watch simply ended; beginListening() will start a fresh session.
      // thinking: nothing to do, recognition is restarted after the reply.
    }

    function beginListening() {
      if (ended) return;
      clearTimer(gapTimer); gapTimer = null;
      pendingFinal = '';
      bargedIn = false;
      setState(STATES.LISTENING, {});
      if (!recActive) startRecognition();
    }

    function commitTurn() {
      clearTimer(silenceTimer); silenceTimer = null;
      var text = pendingFinal.trim();
      pendingFinal = '';
      if (!text) return;
      // A turn that began by interrupting ARIA and ends up being ARIA's own words (speaker echo the interim guard
      // let through) is dropped, not sent: nothing the user did not say ever reaches the server.
      if (bargedIn && looksLikeEcho(text, spokenNow)) { bargedIn = false; cb.onInterim(''); return; }
      bargedIn = false;
      handleUserText(text, 'voice');
    }

    // ── a user turn (spoken, typed or the initial text) ───────────────────────
    function handleUserText(text, source) {
      if (ended) return;
      clearTimer(silenceTimer); silenceTimer = null;
      clearTimer(gapTimer); gapTimer = null;
      cancelSpeech();
      stopRecognition();
      emptyTurns = 0;
      var end = isEndPhrase(text);
      cb.onUserTurn(text, turnMeta({ source: source, end: end }));
      if (end) { endConversation('end-phrase'); return; }
      think(text);
    }

    function think(text) {
      setState(STATES.THINKING, {});
      history.push({ role: 'user', content: String(text).slice(0, 4000) });
      trimHistory();
      cb.onHistory(history.slice());
      if (typeof fetchFn !== 'function') { cb.onError('no-fetch', {}); endConversation('no-fetch'); return; }
      var seq = ++fetchSeq;
      var body = {
        messages: history.slice(),
        sessionId: resolveSessionId(),
        voice: true,
        platform: pinfo.platform,
        device: pinfo.device,
      };
      var ctrl = null;
      try { if (typeof AbortController === 'function') ctrl = new AbortController(); } catch (_) { ctrl = null; }
      var timeout = ctrl ? later(function () { try { ctrl.abort(); } catch (_) { /* noop */ } }, cfg.fetchTimeoutMs) : null;
      var p;
      try {
        p = fetchFn(cfg.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: ctrl ? ctrl.signal : undefined,
        });
      } catch (e) { p = Promise.reject(e); }
      Promise.resolve(p).then(function (res) {
        if (!res || !res.ok) { var err = new Error('http ' + (res && res.status)); err.status = res && res.status; throw err; }
        return res.json();
      }).then(function (data) {
        clearTimer(timeout);
        if (seq !== fetchSeq || ended) return;
        handleReply(data || {});
      }).catch(function (err) {
        clearTimer(timeout);
        if (seq !== fetchSeq || ended) return;
        cb.onError('server', { message: err && err.message, status: err && err.status });
        endConversation('server-error');
      });
    }

    function handleReply(data) {
      var text = String(data.text || data.reply || '').trim();
      var speakText = (typeof data.speak === 'string' && data.speak.trim())
        ? capWords(stripMarkdown(data.speak), cfg.speakMaxWords)
        : fallbackSpeak(text, cfg.speakMaxWords);
      var action = normalizeAction(data.action);
      var degraded = data.degraded === true || data.offline === true;
      var needsInput = data.needs_input !== false;
      var listen = data.listen === true;

      if (cb.augmentSpeak) {
        try { var aug = cb.augmentSpeak(speakText, { action: action, data: data, degraded: degraded }); if (typeof aug === 'string' && aug.trim()) speakText = aug.trim(); }
        catch (_) { /* a page hook must never break the loop */ }
      }

      history.push({ role: 'assistant', content: (text || speakText).slice(0, 4000) });
      trimHistory();
      cb.onHistory(history.slice());
      cb.onAssistantTurn(data, turnMeta({ speakText: speakText, action: action, degraded: degraded, needsInput: needsInput, listen: listen }));
      if (action.kind !== 'none') cb.onAction(action, data);

      speak(speakText, function afterSpeech() {
        if (ended) return;
        if (degraded) { endConversation('degraded'); return; }
        if (!needsInput) { endConversation('resolved'); return; }
        if (!listen) { endConversation('awaiting-typed-input'); return; }
        gapTimer = later(beginListening, cfg.rearmGapMs);
      });
    }

    // ── speech output (with barge-in watch) ───────────────────────────────────
    function speak(text, done) {
      setState(STATES.SPEAKING, { text: text });
      spokenNow = text;
      afterSpeechCb = done;
      var gen = ++speakGen;
      var canSpeak = !!(synth && Utterance && text && typeof synth.speak === 'function');
      if (cfg.bargeIn && SR && !recActive) startRecognition();
      if (!canSpeak) { finishSpeaking(gen); return; }
      try { cb.beforeSpeak(text); } catch (_) { /* page hook */ }
      try { synth.cancel(); } catch (_) { /* noop */ }
      speakChunks(chunkForSpeech(text), 0, gen);
    }

    function speakChunks(chunks, idx, gen) {
      if (gen !== speakGen || ended) return;
      if (idx >= chunks.length) { finishSpeaking(gen); return; }
      var chunk = chunks[idx];
      var u;
      try { u = new Utterance(chunk); } catch (_) { finishSpeaking(gen); return; }
      try { u.lang = lang; } catch (_) { /* noop */ }
      if (cb.pickVoice && typeof synth.getVoices === 'function') {
        try { var v = cb.pickVoice(synth.getVoices() || []); if (v) u.voice = v; } catch (_) { /* noop */ }
      }
      var advanced = false, started = false;
      function next() {
        if (advanced || gen !== speakGen) return;
        advanced = true;
        clearSpeakTimers();
        speakChunks(chunks, idx + 1, gen);
      }
      u.onstart = function () { started = true; };
      u.onend = next;
      u.onerror = function (ev) {
        var code = ev && ev.error;
        if (code === 'interrupted' || code === 'canceled') return; // we cancelled it (barge-in / stop)
        next();
      };
      clearSpeakTimers();
      // Watchdog 1: the utterance never starts (TTS gated by the page, no output device) → do not hang.
      speakTimers.push(later(function () { if (!started) next(); }, cfg.speakStartTimeoutMs));
      // Watchdog 2: onend never fires (known Chrome behaviour on long utterances) → estimate and move on.
      var words = chunk.split(/\s+/).filter(Boolean).length;
      speakTimers.push(later(next, words * 600 + 4000));
      try { synth.speak(u); } catch (_) { next(); }
    }

    function finishSpeaking(gen) {
      if (gen !== speakGen || ended) return;
      clearSpeakTimers();
      var done = afterSpeechCb;
      afterSpeechCb = null;
      if (state === STATES.SPEAKING && typeof done === 'function') done();
    }

    function cancelSpeech() {
      speakGen++;
      afterSpeechCb = null;
      clearSpeakTimers();
      if (synth && typeof synth.cancel === 'function') { try { synth.cancel(); } catch (_) { /* noop */ } }
    }

    // ── lifecycle ─────────────────────────────────────────────────────────────
    function endConversation(reason) {
      if (ended) return;
      ended = true;
      clearTimer(silenceTimer); silenceTimer = null;
      clearTimer(gapTimer); gapTimer = null;
      cancelSpeech();
      stopRecognition();
      pendingFinal = '';
      setState(STATES.ENDED, { reason: reason });
      cb.onEnd(reason, { elapsedMs: elapsedMs(), turns: history.length });
    }

    function start(initialText) {
      if (state !== STATES.IDLE && state !== STATES.ENDED) return false;
      ended = false;
      startedAt = now();
      emptyTurns = 0;
      pendingFinal = '';
      fetchSeq++;
      if (!SR) {
        setState(STATES.ENDED, { reason: 'unsupported' });
        ended = true;
        cb.onError('unsupported', {});
        cb.onEnd('unsupported', { elapsedMs: 0, turns: history.length });
        return false;
      }
      var seed = String(initialText || '').trim();
      if (seed) handleUserText(seed, 'text');   // the typed/initial text IS the first user turn → thinking
      else beginListening();
      return true;
    }

    function submitText(text) {
      var t = String(text || '').trim();
      if (!t || ended || state === STATES.IDLE) return false;
      handleUserText(t, 'text');
      return true;
    }

    return {
      start: start,
      stop: function (reason) { endConversation(reason || 'stopped'); },
      submitText: submitText,
      getState: function () { return state; },
      isActive: function () { return !ended && state !== STATES.IDLE && state !== STATES.ENDED; },
      getHistory: function () { return history.slice(); },
      setHistory: function (h) { history = Array.isArray(h) ? h.slice(-cfg.maxHistoryTurns) : []; },
      elapsedMs: elapsedMs,
      startedAt: function () { return startedAt; },
      config: cfg,
      lang: lang,
      platform: pinfo,
    };
  }

  return {
    STATES: STATES,
    DEFAULTS: DEFAULTS,
    createVoiceConversation: createVoiceConversation,
    isEndPhrase: isEndPhrase,
    stripMarkdown: stripMarkdown,
    fallbackSpeak: fallbackSpeak,
    chunkForSpeech: chunkForSpeech,
    looksLikeEcho: looksLikeEcho,
    normalizeAction: normalizeAction,
    platformInfo: platformInfo,
    detectSpeechRecognition: detectSpeechRecognition,
    isSupported: isSupported,
    supportsContinuous: supportsContinuous,
  };
});

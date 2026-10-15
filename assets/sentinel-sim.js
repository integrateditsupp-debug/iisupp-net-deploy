/* sentinel-sim.js \u2014 "See ARIA Sentinel work" on /downloads/ (2026-10-14).
 *
 * A SCRIPTED simulation. It has no network code, loads no library, and nothing in it touches the visitor's computer:
 * it only adds cards to #sim-timeline on a timer. What it shows mirrors ARIA Sentinel 0.2.1 in Autonomous mode
 * ("advise three times, then act"):
 *   - every notice line is the app's own wording \u2014 src/shared/advisory-escalation.mjs advisoryCopy() for a record
 *     opened at +0 and ticked every 3 minutes (the default interval);
 *   - recipe titles and action labels are copied from src/shared/recipes.mjs;
 *   - outcomes follow docs/MODE-BEHAVIOUR-MATRIX.md (autonomous rows: stale-dns, spooler-stuck, system-files-corrupt /
 *     bitlocker-recovery).
 * tests/sentinel-downloads-page.test.mjs re-generates that copy from the app modules and fails if anything here drifts.
 * Node-requireable (module.exports) so the test can read SCENARIOS without a browser.
 */
(function () {
  "use strict";

  var INTERVAL_MINUTES = 3; // ADVISORY_INTERVAL_DEFAULT_MIN
  var INTERVAL_MS = 3000; // shown sped up: 3 minutes \u2192 3 seconds
  var BEAT_MS = 1100; // steps that follow one another straight away in the app
  var COUNTDOWN_SECONDS = 10; // ADVISORY_COUNTDOWN_SECONDS (src/main/action-countdown.mjs COUNTDOWN_SECONDS)
  var COUNTDOWN_TICK_MS = 300; // the 10-second countdown is shown in 3 seconds
  var SPEED_NOTE = "sped up: 3 minutes \u2192 3 seconds";

  function t(n) { return "+" + n + " min"; }

  var SCENARIOS = [
    {
      key: "dns",
      title: "Wi-Fi connected, no internet / stale DNS",
      tone: "green",
      kicker: "Green \u00b7 ARIA fixes it",
      badge: "Green \u00b7 user-level fix \u00b7 no administrator rights",
      intro: "Scripted with Autonomous mode and live fixes on. The DNS refresh is a vendor-vetted green fix: it ships with a check that must pass afterwards and has nothing to undo, so ARIA may run it on its own \u2014 but only after telling you three times.",
      recipe: { id: "dns-fail-v1", title: "DNS lookup failed", colour: "green", actions: ["Flush DNS cache", "Re-register DNS", "Clear DNS client cache"], success: "DNS cache cleared. Reload the page." },
      track: "auto-fix",
      kind: "green",
      choices: ["Fix now", "Not now (4 h)", "Never for this"],
      notices: [
        { line: "Notice 1 of 3", found: "I found a problem: DNS lookup failed.", willDo: "I can fix this myself \u2014 flush stale DNS cache and retry the current connection.", when: "If you don't choose, I'll fix it in about 9 minutes \u2014 I'll remind you before then." },
        { line: "Notice 2 of 3", found: "I found a problem: DNS lookup failed.", willDo: "I can fix this myself \u2014 flush stale DNS cache and retry the current connection.", when: "If you don't choose, I'll fix it in about 6 minutes \u2014 I'll remind you before then." },
        { line: "Notice 3 of 3", found: "I found a problem: DNS lookup failed.", willDo: "I can fix this myself \u2014 flush stale DNS cache and retry the current connection.", when: "Last notice: I'll fix it in about 3 minutes unless you choose \u2014 then a 10-second countdown you can cancel." }
      ],
      before: [
        { title: "Detected: DNS lookup failed", tone: "gold", texts: ["Wi-Fi still shows connected, but websites stop loading because name lookups fail. ARIA's network check notices and matches the recipe below."], chip: "recipe: DNS lookup failed \u00b7 green \u00b7 no administrator rights" }
      ],
      safety: {
        auto: ["Kill switch (Ctrl+Alt+K) not pressed", "Allowed by your organization's policy", "Vendor-vetted green fix: cleared to run unattended", "No administrator rights needed", "Restore point not needed: nothing to undo (yellow fixes require one first)", "Within the limits: at most 3 automatic fixes per problem a day, and 30 minutes between any two automatic fixes"],
        person: ["Kill switch (Ctrl+Alt+K) not pressed", "Allowed by your organization's policy", "No administrator rights needed", "Restore point not needed: nothing to undo (yellow fixes require one first)"]
      },
      verified: ["The check afterwards resolves a name through your normal DNS again.", "Had it failed \u2014 say the real cause was a stale DHCP lease \u2014 ARIA would mark this not resolved and tell your IT contact. It never reports a fix that did not take."],
      changed: { title: "What changed: DNS cache \u2014 nothing else.", texts: ["The resolver cache was flushed and this PC's own DNS records re-sent. Nothing to restore: the cache refills itself on the next lookup."] },
      noAnswer: { title: "No answer \u2014 fixing it now", texts: ["Nobody chose, so ARIA fixes it through the supervised pipeline. A countdown you can cancel runs first."] },
      never: "ARIA will not fix this on its own on this device again; it asks for your yes instead."
    },
    {
      key: "printer",
      title: "Printer stuck / queue frozen",
      tone: "amber",
      kicker: "Admin rights \u00b7 a person runs it",
      badge: "Needs administrator rights",
      intro: "Scripted with Autonomous mode and live fixes on. Restarting a Windows service needs administrator rights, and ARIA Sentinel runs on your normal user account, so it never does this on its own.",
      recipe: { id: "svc-spooler-stopped-v1", title: "Print Spooler service stopped", colour: "green", actions: ["Restart Print Spooler service"], success: "Print Spooler service restarted." },
      track: "tech-contact",
      kind: "needs-admin",
      choices: ["Fix now", "Not now (4 h)", "Never for this"],
      notices: [
        { line: "Notice 1 of 3", found: "I found a problem: Print Spooler service stopped.", willDo: "The fix needs administrator approval, so I won't change anything on my own. Fix now runs it with you here \u2014 Windows asks you first.", when: "If nobody answers, I'll tell your IT contact in about 9 minutes." },
        { line: "Notice 2 of 3", found: "I found a problem: Print Spooler service stopped.", willDo: "The fix needs administrator approval, so I won't change anything on my own. Fix now runs it with you here \u2014 Windows asks you first.", when: "If nobody answers, I'll tell your IT contact in about 6 minutes." },
        { line: "Notice 3 of 3", found: "I found a problem: Print Spooler service stopped.", willDo: "The fix needs administrator approval, so I won't change anything on my own. Fix now runs it with you here \u2014 Windows asks you first.", when: "If nobody answers, I'll tell your IT contact in about 3 minutes." }
      ],
      before: [
        { title: "Detected: Print Spooler service stopped", tone: "gold", texts: ["Print jobs pile up in the queue because the Print Spooler service has stopped. ARIA's service check notices and matches the recipe below."], chip: "recipe: Print Spooler service stopped \u00b7 needs administrator rights" }
      ],
      handoff: { title: "Nobody answered \u2014 your IT contact is told", texts: ["Needs administrator rights, so ARIA does not run this on its own: your IT contact is notified; Fix now runs it with you present (Windows asks for permission).", "Nothing was changed. The fix also waits as an approval until a person runs it."] },
      never: "ARIA will not fix this on its own on this device again; it asks for your yes instead."
    },
    {
      key: "critical",
      title: "Critical system files / BitLocker recovery",
      tone: "red",
      kicker: "Red \u00b7 never automatic",
      badge: "Red \u00b7 never automatic",
      intro: "Scripted with Autonomous mode and live fixes on. Damaged system files and a BitLocker recovery prompt are red problems: in every mode ARIA explains and hands over to a person \u2014 it never runs a fix for them.",
      recipe: { id: "bsod-critical-process-v1", title: "Blue screen detected", colour: "red", also: { id: "security-bitlocker-recovery-v1", title: "BitLocker recovery prompt" } },
      track: "tech-contact",
      kind: "red",
      choices: ["Get help now", "Not now (4 h)", "Never for this"],
      notices: [
        { line: "Notice 1 of 3", found: "I found a problem: Blue screen detected.", willDo: "This one needs a person, so I won't change anything.", when: "If nobody answers, I'll tell your IT contact in about 9 minutes." },
        { line: "Notice 2 of 3", found: "I found a problem: Blue screen detected.", willDo: "This one needs a person, so I won't change anything.", when: "If nobody answers, I'll tell your IT contact in about 6 minutes." },
        { line: "Notice 3 of 3", found: "I found a problem: Blue screen detected.", willDo: "This one needs a person, so I won't change anything.", when: "If nobody answers, I'll tell your IT contact in about 3 minutes." }
      ],
      before: [
        { title: "Detected: Blue screen detected (CRITICAL_PROCESS_DIED)", tone: "gold", texts: ["After a crash, Windows reports a stop code that points at damaged system files. A BitLocker recovery prompt (recipe: BitLocker recovery prompt) takes exactly the same path."], chip: "recipe: Blue screen detected \u00b7 red" },
        { title: "Never automatic. ARIA explains, collects evidence content-blind, and hands it to a person.", tone: "red", bodyTone: "red", texts: ["The hand-off carries what was detected, which recipe, when and on which device \u2014 never your documents, screen or files."] }
      ],
      handoff: { title: "Nobody answered \u2014 your IT contact is told", texts: ["Nothing was changed, and nothing waits to run: a red problem never turns into a fix for ARIA to execute."] },
      never: "ARIA stops raising this problem on this device. It never fixes red problems on its own either way."
    }
  ];

  var COMMON = {
    snoozed: "Not now \u2014 nothing runs for 4 hours. Then ARIA tells you again, starting from notice 1.",
    cancelled: "Countdown cancelled \u2014 nothing was changed, and ARIA will not retry on its own."
  };

  var api = { SCENARIOS: SCENARIOS, COMMON: COMMON, INTERVAL_MINUTES: INTERVAL_MINUTES, INTERVAL_MS: INTERVAL_MS, COUNTDOWN_SECONDS: COUNTDOWN_SECONDS, SPEED_NOTE: SPEED_NOTE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document === "undefined") return;

  // ------------------------------------------------------------------------------------------------ page wiring
  var root = document.getElementById("sentinel-sim");
  if (!root) return;
  var timeline = document.getElementById("sim-timeline");
  var playBtn = document.getElementById("sim-play");
  var statusEl = document.getElementById("sim-status");
  var badgeEl = document.getElementById("sim-badge");
  var titleEl = document.getElementById("sim-scn-title");
  var introEl = document.getElementById("sim-intro");
  var panel = document.getElementById("sim-panel");
  var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"][data-sim-scenario]'));
  if (!timeline || !playBtn || !tabs.length) return;
  var reduceMotion = Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  var sc = SCENARIOS[0];
  var queue = [];
  var timer = null;
  var dueAt = 0;
  var left = 0;
  var state = "idle"; // idle | playing | paused | done
  var focusNext = false;
  var activeNotice = null;
  var countdown = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function setStatus(s) { if (statusEl) statusEl.textContent = s; }
  function setPlay(label) { playBtn.textContent = label; }

  function addStep(o) {
    var li = el("li", "sim-step" + (reduceMotion ? "" : " sim-step--in"));
    li.tabIndex = -1;
    var time = el("span", "sim-time");
    time.appendChild(el("span", "sim-sr", "App time "));
    time.appendChild(document.createTextNode(o.at || ""));
    var dot = el("span", "sim-dot sim-tone-" + (o.tone || "gold"));
    dot.setAttribute("aria-hidden", "true");
    var body = el("div", "sim-body" + (o.bodyTone ? " sim-body--" + o.bodyTone : ""));
    if (o.title) body.appendChild(el("p", "sim-step-title", o.title));
    (o.texts || []).forEach(function (x) { body.appendChild(el("p", "sim-step-text", x)); });
    if (o.list) {
      var ul = el("ul", "sim-list");
      o.list.forEach(function (x) { ul.appendChild(el("li", null, x)); });
      body.appendChild(ul);
    }
    if (o.chip) body.appendChild(el("span", "sim-chip", o.chip));
    li.appendChild(time);
    li.appendChild(dot);
    li.appendChild(body);
    var empty = timeline.querySelector(".sim-empty");
    if (empty) empty.parentNode.removeChild(empty);
    // Follow along only while the reader is watching the end of the timeline; never pull them back up or down.
    var tb = timeline.getBoundingClientRect();
    var watching = tb.bottom <= (window.innerHeight || document.documentElement.clientHeight) + 40 && tb.bottom >= 0;
    timeline.appendChild(li);
    if (focusNext) { focusNext = false; try { li.focus({ preventScroll: false }); } catch (e) { li.focus(); } }
    else if (watching && li.scrollIntoView) { try { li.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" }); } catch (e) { li.scrollIntoView(false); } }
    return { li: li, body: body };
  }

  function retireNotice() {
    if (!activeNotice) return;
    activeNotice.forEach(function (b) { b.disabled = true; });
    activeNotice = null;
  }

  function addNotice(n, at) {
    retireNotice();
    var nc = sc.notices[n - 1];
    var s = addStep({ at: at, tone: sc.tone });
    s.body.classList.add("sim-notice");
    var eyebrow = el("p", "sim-notice-eyebrow");
    eyebrow.appendChild(el("span", null, nc.line));
    eyebrow.appendChild(el("span", null, "ARIA Sentinel"));
    s.body.appendChild(eyebrow);
    s.body.appendChild(el("p", "sim-notice-head", sc.recipe.title));
    [nc.found, nc.willDo, nc.when].forEach(function (x) { s.body.appendChild(el("p", "sim-step-text", x)); });
    var row = el("div", "sim-choices");
    var ids = ["fix", "later", "never"];
    var buttons = sc.choices.map(function (label, i) {
      var b = el("button", "sim-choice" + (i === 0 ? " sim-choice--main" : ""), label);
      b.type = "button";
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () { choose(ids[i], n, b); });
      row.appendChild(b);
      return b;
    });
    s.body.appendChild(row);
    activeNotice = buttons;
    setStatus("Playing \u2014 " + nc.line.toLowerCase());
  }

  function addCountdown(at) {
    var s = addStep({ at: at, tone: "gold", title: "Countdown \u2014 " + COUNTDOWN_SECONDS + " seconds you can cancel (sped up)" });
    var wrap = el("div", "sim-count");
    var num = el("span", "sim-count-n", String(COUNTDOWN_SECONDS));
    num.setAttribute("aria-hidden", "true");
    var bar = el("span", "sim-count-bar");
    var fill = el("span");
    bar.appendChild(fill);
    bar.setAttribute("aria-hidden", "true");
    var cancel = el("button", "sim-cancel", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", function () { choose("cancel", 0, cancel, at); });
    wrap.appendChild(num);
    wrap.appendChild(bar);
    wrap.appendChild(cancel);
    s.body.appendChild(wrap);
    countdown = { num: num, fill: fill, cancel: cancel };
    setStatus("Playing \u2014 countdown");
  }

  // Beats -------------------------------------------------------------------------------------------------------
  function step(delay, o) { return { delay: delay, run: function () { addStep(o); if (o.status) setStatus(o.status); } }; }
  function countdownBeats(at) {
    var beats = [{ delay: BEAT_MS, run: function () { addCountdown(at); } }];
    for (var i = COUNTDOWN_SECONDS - 1; i >= 0; i--) {
      (function (v) {
        beats.push({
          delay: COUNTDOWN_TICK_MS,
          run: function () {
            if (!countdown) return;
            countdown.num.textContent = String(v);
            countdown.fill.style.width = (v / COUNTDOWN_SECONDS * 100) + "%";
            if (v === 0) { countdown.cancel.disabled = true; countdown = null; }
          }
        });
      })(i);
    }
    return beats;
  }
  function endBeat(text) { return { delay: 400, run: function () { finish(text); } }; }

  function fixBeats(at, who) {
    var b = countdownBeats(at);
    if (sc.key === "dns") {
      b.push(step(BEAT_MS, { at: at, tone: "green", title: "Safety checks passed", list: who === "auto" ? sc.safety.auto : sc.safety.person, status: "Playing \u2014 safety checks" }));
      b.push(step(BEAT_MS, { at: at, tone: "green", title: "Applied", list: sc.recipe.actions, status: "Playing \u2014 fix applied" }));
      b.push(step(BEAT_MS, { at: at, tone: "green", bodyTone: "green", title: "Verified", texts: sc.verified, status: "Playing \u2014 verified" }));
      b.push(step(BEAT_MS, { at: at, tone: "green", bodyTone: "green", title: sc.changed.title, texts: sc.changed.texts, chip: sc.recipe.success }));
    } else if (sc.key === "printer") {
      b.push(step(BEAT_MS, { at: at, tone: "amber", title: "Windows asks for permission", texts: ["A UAC prompt appears. Only the person at the PC can answer it \u2014 ARIA cannot click it for you."], status: "Playing \u2014 waiting for Windows' permission prompt" }));
      b.push(step(BEAT_MS, { at: at, tone: "green", title: "Applied, with your yes", list: sc.recipe.actions, texts: [sc.recipe.success], status: "Playing \u2014 fix applied" }));
      b.push(step(BEAT_MS, { at: at, tone: "green", bodyTone: "green", title: "What changed: the Print Spooler service \u2014 nothing else.", texts: ["Your documents and other settings were not touched."] }));
    }
    b.push(endBeat("Finished \u2014 scripted; nothing ran on your computer."));
    return b;
  }

  function mainBeats() {
    var b = [];
    sc.before.forEach(function (o, i) { b.push(step(i === 0 ? 250 : BEAT_MS, { at: t(0), tone: o.tone, bodyTone: o.bodyTone, title: o.title, texts: o.texts, chip: o.chip })); });
    b.push({ delay: BEAT_MS, run: function () { addNotice(1, t(0)); } });
    b.push({ delay: INTERVAL_MS, run: function () { addNotice(2, t(INTERVAL_MINUTES)); } });
    b.push({ delay: INTERVAL_MS, run: function () { addNotice(3, t(INTERVAL_MINUTES * 2)); } });
    var end = t(INTERVAL_MINUTES * 3);
    if (sc.key === "dns") {
      b.push({ delay: INTERVAL_MS, run: function () { retireNotice(); addStep({ at: end, tone: "gold", title: sc.noAnswer.title, texts: sc.noAnswer.texts }); } });
      b = b.concat(fixBeats(end, "auto"));
    } else {
      b.push({ delay: INTERVAL_MS, run: function () { retireNotice(); addStep({ at: end, tone: sc.tone, bodyTone: sc.tone === "red" ? "red" : "amber", title: sc.handoff.title, texts: sc.handoff.texts }); } });
      b.push(endBeat("Finished \u2014 scripted; nothing ran on your computer."));
    }
    return b;
  }

  function branchBeats(kind, n, when) {
    var at = when || t(INTERVAL_MINUTES * Math.max(0, n - 1));
    if (kind === "cancel") return [step(150, { at: at, tone: "grey", title: "Countdown cancelled", texts: [COMMON.cancelled] }), endBeat("Finished \u2014 you cancelled; nothing changed.")];
    if (kind === "later") return [step(150, { at: at, tone: "grey", title: "You chose Not now (" + sc.notices[n - 1].line.toLowerCase() + ")", texts: [COMMON.snoozed] }), endBeat("Finished \u2014 snoozed; nothing changed.")];
    if (kind === "never") return [step(150, { at: at, tone: "grey", title: "You chose Never for this", texts: [sc.never] }), endBeat("Finished \u2014 nothing changed.")];
    // fix
    if (sc.key === "critical") return [step(150, { at: at, tone: "red", bodyTone: "red", title: "You chose Get help now (" + sc.notices[n - 1].line.toLowerCase() + ")", texts: ["Your IT contact is told now. Nothing was changed."] }), endBeat("Finished \u2014 handed to a person; nothing changed.")];
    var first = step(150, { at: at, tone: "gold", title: "You chose Fix now (" + sc.notices[n - 1].line.toLowerCase() + ")", texts: [sc.key === "dns" ? "It runs now through the same supervised pipeline \u2014 the countdown first." : "It runs now, with you present: the countdown first, then Windows asks for permission."] });
    return [first].concat(fixBeats(at, "person"));
  }

  // Scheduler ---------------------------------------------------------------------------------------------------
  function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }
  function schedule(ms) {
    clearTimer();
    dueAt = Date.now() + ms;
    timer = setTimeout(tick, ms);
  }
  function tick() {
    timer = null;
    var beat = queue.shift();
    if (!beat) return;
    beat.run();
    if (state !== "playing") return;
    if (queue.length) schedule(queue[0].delay);
  }
  function finish(text) {
    clearTimer();
    queue = [];
    retireNotice();
    if (countdown) { countdown.cancel.disabled = true; countdown = null; }
    state = "done";
    setPlay("Replay");
    setStatus(text);
  }
  function reset() {
    clearTimer();
    queue = [];
    activeNotice = null;
    countdown = null;
    state = "idle";
    while (timeline.firstChild) timeline.removeChild(timeline.firstChild);
    var empty = el("li", "sim-empty", "Press Play to run this scenario.");
    timeline.appendChild(empty);
    setPlay("Play");
    setStatus("Ready");
  }
  function start() {
    reset();
    var empty = timeline.querySelector(".sim-empty");
    if (empty) empty.parentNode.removeChild(empty);
    queue = mainBeats();
    state = "playing";
    setPlay("Pause");
    setStatus("Playing");
    schedule(queue[0].delay);
  }
  function pause() {
    if (state !== "playing") return;
    left = Math.max(0, dueAt - Date.now());
    clearTimer();
    state = "paused";
    setPlay("Resume");
    setStatus("Paused");
  }
  function resume() {
    if (state !== "paused") return;
    state = "playing";
    setPlay("Pause");
    setStatus("Playing");
    if (queue.length) schedule(left);
  }
  function choose(kind, n, btn, when) {
    if (state !== "playing" && state !== "paused") return;
    if (btn) btn.setAttribute("aria-pressed", "true");
    retireNotice();
    if (countdown) { countdown.cancel.disabled = true; countdown = null; }
    clearTimer();
    queue = branchBeats(kind, n, when);
    state = "playing";
    setPlay("Pause");
    focusNext = true;
    schedule(queue[0].delay);
  }

  playBtn.addEventListener("click", function () {
    if (state === "idle" || state === "done") start();
    else if (state === "playing") pause();
    else if (state === "paused") resume();
  });

  function select(i, focus) {
    var next = SCENARIOS[i];
    if (!next) return;
    sc = next;
    tabs.forEach(function (tab, j) {
      var on = j === i;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
      if (on && panel) panel.setAttribute("aria-labelledby", tab.id);
    });
    if (badgeEl) { badgeEl.textContent = sc.badge; badgeEl.className = "sim-badge sim-badge--" + sc.tone; }
    if (titleEl) titleEl.textContent = sc.title;
    if (introEl) introEl.textContent = sc.intro;
    reset();
    if (focus) tabs[i].focus();
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { if (sc !== SCENARIOS[i] || state !== "idle") select(i, false); });
    tab.addEventListener("keydown", function (e) {
      var k = e.key;
      if (k !== "ArrowRight" && k !== "ArrowLeft" && k !== "ArrowDown" && k !== "ArrowUp" && k !== "Home" && k !== "End") return;
      e.preventDefault();
      var j = k === "Home" ? 0 : k === "End" ? tabs.length - 1 : (i + ((k === "ArrowRight" || k === "ArrowDown") ? 1 : -1) + tabs.length) % tabs.length;
      select(j, true);
    });
  });

  // The page has to keep working at 390 px and without motion; nothing here needs more than the DOM.
  root.setAttribute("data-sim-ready", "true");
  select(0, false);
})();

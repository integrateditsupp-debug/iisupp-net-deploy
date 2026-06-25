/* ARIA → Sentinel web handoff — additive, namespaced (ash-), self-contained, reversible.
   Upgrades the "Resolve it for me" card from an inert COMING SOON into an honest "Open with ARIA Sentinel"
   button that hands the matched fix to the user's INSTALLED desktop ARIA Sentinel via the aria-sentinel://
   deep-link. The link only ever carries a recipe id + an intent STRING — never a system command. The desktop
   app re-validates the id against its local registry and still runs the fix through its full gated pipeline
   (supervisor + 10s countdown + System Restore point + Ctrl+Alt+K kill-switch + audit). Nothing executes here.

   HONESTY: this does NOT claim the website fixed anything. If no desktop app handles the link (most public
   visitors), the card shows a graceful "Requires the ARIA Sentinel desktop agent" fallback with a link to it.

   GATED OFF BY DEFAULT: live behavior is unchanged until `window.__ARIA_SENTINEL_HANDOFF__ = true` is set
   (or the flag is enabled at publish time). When off, aria-transform.js keeps the existing COMING SOON gray.
*/
(function(){
  if (window.__ASH_HANDOFF) return; window.__ASH_HANDOFF = true;

  // Mirror of buildSentinelResolveLink() in "ARIA Sentinel/src/shared/deep-link.mjs" — kept byte-identical;
  // the Sentinel contract test (tests/web-handoff-contract.test.mjs) asserts parse(build(...)) round-trips.
  var DEEP_LINK_SCHEME = "aria-sentinel";
  function buildSentinelResolveLink(recipeId, intent){
    var id = String(recipeId || "").trim();
    if (!id) return "";
    var link = DEEP_LINK_SCHEME + "://resolve?recipe=" + encodeURIComponent(id);
    var cleanIntent = String(intent || "").slice(0, 200);
    if (cleanIntent) link += "&intent=" + encodeURIComponent(cleanIntent);
    return link;
  }
  window.ashBuildResolveLink = buildSentinelResolveLink; // exposed so the contract test / console can verify

  // Web issue intent → a real, reversible Sentinel recipe id. Only intents with a genuine green/reversible
  // recipe are mapped; unmapped intents (outlook/mail/generic) keep the existing COMING SOON state — we never
  // point the handoff at a wrong id (the desktop would reject it anyway, but the UX must not over-promise).
  var INTENT_RECIPE = {
    printer:  "printer-spooler-v1",
    wifi:     "wifi-no-internet-v1",
    disk:     "disk-low-space-v1",
    password: "browser-password-loop-v1"
  };
  window.ashRecipeForIntent = function(intent){ return INTENT_RECIPE[String(intent||"").toLowerCase()] || ""; };

  var SENTINEL_INFO_URL = "/aria-sentinel/"; // product/download page for visitors without the desktop agent

  function enabled(){ return window.__ARIA_SENTINEL_HANDOFF__ === true; }

  function upgrade(card){
    if (!enabled()) return;            // flag off → leave the card as aria-transform.js styled it (COMING SOON)
    if (card.__ashDone) return; card.__ashDone = 1;
    var intent = card.getAttribute("data-intent") || "";
    var recipeId = window.ashRecipeForIntent(intent);
    if (!recipeId) return;             // no real recipe for this intent → keep COMING SOON, don't over-promise

    // undo the COMING SOON gray that aria-transform.js applied, re-enable interaction
    card.style.opacity = ""; card.style.filter = ""; card.style.pointerEvents = "";
    var badge = card.querySelector(".aexcs"); if (badge) badge.remove();

    // honest sub-note: this opens the installed desktop agent, which is what actually performs the fix
    if (!card.querySelector(".ash-note")) {
      var note = document.createElement("div");
      note.className = "ash-note";
      note.style.cssText = "margin-top:10px;font:600 10px ui-monospace,monospace;letter-spacing:.05em;color:#cda85c";
      note.textContent = "OPENS ARIA SENTINEL (DESKTOP) · GATED + REVERSIBLE";
      card.appendChild(note);
    }

    card.addEventListener("click", function(ev){
      ev.preventDefault(); ev.stopPropagation();
      handoff(recipeId, intent, card);
    }, true);
  }

  function handoff(recipeId, intent, card){
    var link = buildSentinelResolveLink(recipeId, intent);
    if (!link) return;
    var hadFocus = true;
    // If the OS has a handler, the page blurs/visibilitychange fires; if not, we show the fallback after a beat.
    var settled = false;
    function onLeave(){ settled = true; cleanup(); }
    function cleanup(){
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("visibilitychange", visLeave);
    }
    function visLeave(){ if (document.hidden) onLeave(); }
    window.addEventListener("blur", onLeave);
    document.addEventListener("visibilitychange", visLeave);

    try { window.location.href = link; } catch (e) { /* navigation to a custom scheme can throw if unregistered */ }

    setTimeout(function(){
      cleanup();
      if (settled) return;             // app took over → done, nothing to show
      showFallback(card);              // no handler → honest "install the desktop agent" path
    }, 1400);
  }

  function showFallback(card){
    if (card.querySelector(".ash-fallback")) return;
    var fb = document.createElement("div");
    fb.className = "ash-fallback";
    fb.style.cssText = "margin-top:10px;padding:9px 11px;border:1px solid #2a2516;border-radius:9px;background:#100e08;font:12px/1.6 ui-monospace,monospace;color:#bdb49c";
    fb.innerHTML = 'The ARIA Sentinel desktop agent isn’t installed on this device, so there’s nothing to hand the fix to. '
      + '<a href="' + SENTINEL_INFO_URL + '" style="color:#cda85c;font-weight:600">Get ARIA Sentinel</a> to enable one-click resolve, '
      + 'or use <strong>Walk me through it</strong> above.';
    card.appendChild(fb);
  }

  function scan(){ document.querySelectorAll(".choice.recommended").forEach(upgrade); }

  function ready(fn){ if (document.readyState !== "loading") fn(); else document.addEventListener("DOMContentLoaded", fn); }
  ready(function(){
    scan();
    try { new MutationObserver(scan).observe(document.body, { childList:true, subtree:true }); } catch (e) {}
  });
})();

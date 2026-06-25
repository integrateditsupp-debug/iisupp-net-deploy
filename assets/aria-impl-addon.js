/* R-ONE N2 — implementation add-on selector. Optional block on /plans: multi-select connectors to set up,
   org size + contact → submits a QUOTE REQUEST (no fixed price, NO Stripe charge; IIS quotes $10K–$60K per
   connector). Mounts into [data-aria-impl-addon]. Browser-global + node-requireable (for tests). */
(function () {
  "use strict";
  var CONNECTORS = ["AD/Entra", "On-prem AD", "RSA SecurID", "PingOne Verify", "Dynamics 365",
    "Outlook/Exchange", "Excel", "Word", "PowerPoint", "OneNote"];

  // Pure, testable: validate the form selection before any network call.
  function buildQuotePayload(sel) {
    sel = sel || {};
    var connectors = (sel.connectors || []).filter(function (c) { return CONNECTORS.indexOf(c) !== -1; });
    var email = String(sel.email || "").trim();
    var errors = [];
    if (!connectors.length) errors.push("select at least one connector");
    if (!email) errors.push("email is required");
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push("valid email is required");
    return {
      ok: errors.length === 0, errors,
      payload: { kind: "implementation", connectors: connectors, orgSize: String(sel.orgSize || ""), email: email,
        name: String(sel.name || ""), company: String(sel.company || ""), notes: String(sel.notes || "") },
    };
  }

  function submitQuote(payload) {
    return fetch("/.netlify/functions/aria-impl-quote", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); });
  }

  function render(mount) {
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]); }); };
    var boxes = CONNECTORS.map(function (c) {
      return '<label class="awa-conn"><input type="checkbox" value="' + esc(c) + '"> ' + esc(c) + "</label>";
    }).join("");
    mount.innerHTML =
      '<div class="aria-impl-addon">' +
      '<h3 class="awa-title">Add implementation (optional)</h3>' +
      '<p class="awa-sub">Pick the connectors you want us to set up. No charge now — we quote $10K–$60K per connector based on scope.</p>' +
      '<div class="awa-conns">' + boxes + "</div>" +
      '<input class="awa-org" placeholder="Org size (e.g. 50 staff)">' +
      '<input class="awa-email" type="email" placeholder="Work email *">' +
      '<button type="button" class="awa-submit">Request implementation quote</button>' +
      '<div class="awa-msg" role="status"></div>' +
      "</div>";
    var msg = mount.querySelector(".awa-msg");
    mount.querySelector(".awa-submit").addEventListener("click", function () {
      var connectors = Array.prototype.slice.call(mount.querySelectorAll(".awa-conn input:checked")).map(function (i) { return i.value; });
      var built = buildQuotePayload({ connectors: connectors, orgSize: mount.querySelector(".awa-org").value, email: mount.querySelector(".awa-email").value });
      if (!built.ok) { msg.textContent = built.errors.join("; "); return; }
      msg.textContent = "Submitting…";
      submitQuote(built.payload).then(function (res) {
        msg.textContent = res.ok ? "Thanks — we'll send your implementation quote shortly." : (res.data && res.data.error) || "Could not submit. Please call (647) 581-3182.";
      }).catch(function () { msg.textContent = "Could not submit. Please call (647) 581-3182."; });
    });
  }

  if (typeof document !== "undefined") {
    var mount = function () { var ns = document.querySelectorAll("[data-aria-impl-addon]"); for (var i = 0; i < ns.length; i++) render(ns[i]); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
  }
  var api = { buildQuotePayload: buildQuotePayload, CONNECTORS: CONNECTORS };
  if (typeof window !== "undefined") window.ariaImplAddon = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();

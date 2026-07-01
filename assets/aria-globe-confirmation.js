/* aria-globe-confirmation.js - RUN-B B5 web-ARIA equivalent of the desktop under-globe "issue resolved |
 * email sent | ticket reference" confirmation. Web ARIA never runs local FIXES; it confirms a REAL KB
 * resolution + email. The SENTENCE LOGIC is byte-identical to "ARIA Sentinel/src/shared/globe-confirmation.mjs"
 * (parity-locked by tests/b5-globe-confirmation.test.mjs) so desktop + web can never drift.
 *
 * Rule 14: renders ONLY on a real resolve (kbResolved===true); NEVER claims an email was sent unless a real
 * send returned success; the ticket reference is real (server/ServiceNow) or a recorded local ref - never fake.
 * Zero-misfire integration seam: the web funnel fires window CustomEvent('aria:resolved', {detail:{...}}). */
(function () {
  "use strict";

  var GLOBE_CONFIRM_SCHEMA = "globe-confirmation.v1";
  var CONFIRM_DISMISS_MS = 9000;

  // --- byte-identical sentence logic (mirror of the .mjs) ---
  function confirmationText(parts) {
    var issue = parts.issue, ticketRef = parts.ticketRef, emailState = parts.emailState;
    var head = issue + " issue has been resolved.";
    if (emailState === "sent") return head + " Email has been sent with ticket reference " + ticketRef + ".";
    if (emailState === "pending") return head + " Email pending. Ticket reference " + ticketRef + ".";
    return head + " Ticket reference " + ticketRef + ".";
  }
  function emailStateOf(email) {
    email = email || {};
    if (email.sent === true) return "sent";
    if (email.attempted === true) return "pending";
    return "none";
  }
  function scrubField(v) {
    return String(v == null ? "" : v)
      .replace(/[A-Za-z]:\\[^\s"']*/g, "[path]")
      .replace(/\/(?:Users|home|mnt|var|tmp)\/[^\s"']*/gi, "[path]")
      .replace(/\\\\[^\s"']+/g, "[path]")
      .trim();
  }
  function normalizeIssue(title) {
    var s = scrubField(title).replace(/\s+/g, " ").trim();
    if (!s) return "";
    return s.length > 80 ? s.slice(0, 77).replace(/\s+$/, "") + "..." : s;
  }
  // Web equivalent: requires a real KB resolution the user confirmed fixed it.
  function buildWebConfirmation(resolve, opts) {
    resolve = resolve || {}; opts = opts || {};
    if (resolve.kbResolved !== true) return { show: false, reason: "not-resolved" };
    var issue = normalizeIssue(resolve.issueTitle != null ? resolve.issueTitle : resolve.issue);
    if (!issue) return { show: false, reason: "no-issue" };
    var ref = scrubField(resolve.ticketRef || "").replace(/\s+/g, "");
    if (!ref) return { show: false, reason: "no-ticket" };  // web ref comes from the server/session; never faked here
    var emailState = emailStateOf(resolve.email);
    var email = resolve.email || {};
    var text = confirmationText({ issue: issue, ticketRef: ref, emailState: emailState });
    return {
      show: true, schema: GLOBE_CONFIRM_SCHEMA, source: "web", issue: issue, ticketRef: ref,
      email: { sent: emailState === "sent", pending: emailState === "pending", to: email.to ? scrubField(email.to) : null },
      text: text, ariaText: text, dismissMs: CONFIRM_DISMISS_MS
    };
  }

  // --- DOM render (browser only) ---
  function renderInto(container, conf) {
    if (!container || !conf || !conf.show || !conf.text || typeof document === "undefined") return null;
    var el = document.createElement("div");
    el.className = "aria-globe-confirm";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.textContent = conf.text;
    el.style.cssText = "margin:10px auto 0;max-width:340px;padding:9px 12px;border-radius:12px;text-align:center;" +
      "font:500 12.5px/1.4 -apple-system,Segoe UI,system-ui,sans-serif;color:#eafcff;background:rgba(14,20,28,.96);" +
      "border:1px solid rgba(122,251,255,.42);box-shadow:0 8px 24px rgba(0,0,0,.5);cursor:pointer;opacity:0;transition:opacity .3s ease;";
    container.appendChild(el);
    requestAnimationFrame ? requestAnimationFrame(function () { el.style.opacity = "1"; }) : (el.style.opacity = "1");
    var hide = function () { el.style.opacity = "0"; setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 340); };
    var t = setTimeout(hide, Math.max(6000, Number(conf.dismissMs) || CONFIRM_DISMISS_MS));
    el.addEventListener("click", function () { clearTimeout(t); hide(); });
    return el;
  }

  // Convenience for the web funnel: confirmResolved({issue, ticketRef, emailSent, emailAttempted, target})
  function confirmResolved(detail) {
    detail = detail || {};
    var conf = buildWebConfirmation({
      kbResolved: true, issueTitle: detail.issue, ticketRef: detail.ticketRef,
      email: { attempted: detail.emailAttempted === true || detail.emailSent === true, sent: detail.emailSent === true, to: detail.to }
    }, {});
    if (!conf.show) return conf;
    var target = detail.target || (typeof document !== "undefined" &&
      (document.getElementById("chatMessages") || document.getElementById("globeWrap")));
    renderInto(target, conf);
    return conf;
  }
  function onResolvedEvent(e) { try { confirmResolved((e && e.detail) || {}); } catch (_) {} }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { confirmationText: confirmationText, emailStateOf: emailStateOf, buildWebConfirmation: buildWebConfirmation, normalizeIssue: normalizeIssue, GLOBE_CONFIRM_SCHEMA: GLOBE_CONFIRM_SCHEMA, CONFIRM_DISMISS_MS: CONFIRM_DISMISS_MS };
  }
  if (typeof window !== "undefined") {
    window.ariaGlobeConfirmation = { build: buildWebConfirmation, text: confirmationText, emailStateOf: emailStateOf, render: renderInto, confirmResolved: confirmResolved };
    window.addEventListener("aria:resolved", onResolvedEvent);
  }
})();

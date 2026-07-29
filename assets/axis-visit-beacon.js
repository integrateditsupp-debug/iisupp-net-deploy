/* axis-visit-beacon.js — RUN-AC AC2. The site's own hit beacon. Free, first-party, identity-free.
 *
 * WHY: RUN-AB found that no passive signal in this program is measurable, and named this exact thing as
 * the free unblock. This is the smallest possible piece of it: one fire-and-forget request that tells our
 * own endpoint a page was opened. No third party, no account, no cost.
 *
 * WHAT IT SENDS, EXHAUSTIVELY (vault Rule 11): one allowlisted path bucket. Nothing else.
 *   - no cookie, no localStorage, no session id, no visitor id, no fingerprint
 *   - no referrer, no screen size, no timing, no user agent read
 *   - nothing is read back; the endpoint returns 204 and this file never sees a number
 *
 * It is deliberately incapable of distinguishing one visitor from another. That is the design, not a
 * limitation: a count of page opens is honest and Rule-11-clean; a count of PEOPLE would require state we
 * have decided never to keep.
 *
 * Fails silently and completely. A visit log must never be able to break a page.
 */
(function () {
  try {
    if (typeof navigator === "undefined" || typeof location === "undefined") return;
    if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return;

    var p = location.pathname || "/";
    var b = "other";
    var q = p.toLowerCase().replace(/\/+$/, "") || "/";
    if (q === "/" || q === "/index.html") b = "/";
    else if (q.indexOf("/aria") === 0) b = "/aria";
    else if (q.indexOf("/aperture") === 0) b = "/aperture";
    else if (q.indexOf("/services") === 0) b = "/services";
    else if (q.indexOf("/contact") === 0) b = "/contact";

    var url = "/api/axis-visit?p=" + encodeURIComponent(b);

    if (navigator.sendBeacon) navigator.sendBeacon(url);
    else fetch(url, { method: "GET", keepalive: true, credentials: "omit", cache: "no-store" }).catch(function () {});
  } catch (e) {}
})();

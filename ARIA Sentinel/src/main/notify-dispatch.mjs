// RUN-CU / CU4 (2026-10-08) — notification dispatch for the main process. NEVER throws; every channel
// reports what actually happened (Rule 14): desktop {shown}, email/sms {sent|dormant|failed|skipped},
// remote {attempted, status}. "dormant" means the server has no provider configured (e.g. Twilio unset) —
// it is reported as NOT sent, never as sent.
//
// Boundary rules enforced here, before anything leaves the process:
//   · the payload must pass mustBeTelemetrySafe() (no raw paths/URLs/log lines/document text/usernames)
//   · issue-detected is deduped per issue for 6h (ISSUE_DEDUPE_MS)
//   · channels follow the wizard toggles (notifyChannels) — desktop may still show when email/sms are off
//   · recipients are resolved by ROLE from the wizard prefs; the audit line carries hashed recipients only
//   · the POST goes through src/main/outbound.mjs (allowlist + privacy ring), never raw fetch
// Pure-ish + injectable: fetch (via outbound), the desktop notifier, the clock and the prefs reader are all
// passed in, so tests/notify-dispatch.test.mjs runs the whole thing with a mocked server.
import { createHash } from "node:crypto";
import { buildNotification, dedupeKey, ISSUE_DEDUPE_MS, NOTIFY_EVENTS } from "../shared/notify-channels.mjs";

export const NOTIFY_ENDPOINT = "https://iisupp.net/.netlify/functions/aria-sentinel-notify";

function hash16(v) { return createHash("sha256").update(String(v == null ? "" : v).toLowerCase().trim()).digest("hex").slice(0, 16); }

/** Recipients with addresses replaced by hashes — the only form that ever reaches the audit log. */
export function redactRecipients(recipients = []) {
  return (Array.isArray(recipients) ? recipients : []).map((r) => ({
    role: r && r.role ? String(r.role).slice(0, 20) : null,
    email: r && r.email ? `e:${hash16(r.email)}` : null,
    phone: r && r.phone ? `p:${hash16(r.phone)}` : null
  }));
}

/**
 * createNotifyDispatcher({ outbound, endpoint, deviceKeyHash, deviceId, prefs, desktopNotify, logEvent, now, dedupeMs })
 *   prefs()        → the sanitized setup prefs (app-config normalizeSetupPrefs)
 *   desktopNotify  → ({title, body}) => boolean   (Electron Notification; false when unsupported)
 *   deviceKeyHash  → () => sha256(licenseKey) hex or "" (auth header for the server; never the raw key)
 * Returns { dispatch(event, ctx, opts), lastResults(), resetDedupe() }.
 */
export function createNotifyDispatcher(deps = {}) {
  const now = typeof deps.now === "function" ? deps.now : () => Date.now();
  const endpoint = deps.endpoint || NOTIFY_ENDPOINT;
  const dedupeMs = Number.isFinite(deps.dedupeMs) ? deps.dedupeMs : ISSUE_DEDUPE_MS;
  const seen = new Map(); // dedupeKey → last sent ms
  const history = [];
  const log = typeof deps.logEvent === "function" ? deps.logEvent : () => {};
  const prefsOf = typeof deps.prefs === "function" ? deps.prefs : () => ({});

  function remember(result) { history.push(result); while (history.length > 50) history.shift(); return result; }

  async function dispatch(event, ctx = {}, opts = {}) {
    const ev = NOTIFY_EVENTS.includes(event) ? event : "issue-detected";
    const t = now();
    const base = { event: ev, ts: new Date(t).toISOString(), desktop: { shown: false, reason: "" }, email: { status: "skipped", reason: "" }, sms: { status: "skipped", reason: "" }, remote: { attempted: false, status: null, reason: "", approveUrl: null, denyUrl: null, approvalId: null }, deduped: false, safe: true };
    try {
      let prefs = {};
      try { prefs = prefsOf() || {}; } catch { prefs = {}; }
      const built = buildNotification(ev, { ...ctx, ts: base.ts }, prefs);

      // 1 — content-blind guard: refuse the whole send (every channel) if the payload is not catalog-shaped.
      if (!built.safe.ok) {
        base.safe = false;
        base.desktop.reason = base.email.reason = base.sms.reason = base.remote.reason = `unsafe-payload:${built.safe.reason}`;
        log("NOTIFY", `Notification refused (not content-blind: ${built.safe.reason}).`, { event: ev });
        return remember(base);
      }

      // 2 — per-issue dedupe (issue-detected only, 6h).
      if (ev === "issue-detected" && !opts.force) {
        const key = dedupeKey(ev, ctx);
        const last = seen.get(key) || 0;
        if (t - last < dedupeMs) { base.deduped = true; base.desktop.reason = base.email.reason = base.sms.reason = "deduped-6h"; return remember(base); }
        seen.set(key, t);
      }

      // 3 — desktop notification (always allowed when the toggle is on; local, free, honest).
      if (built.channels.desktop && typeof deps.desktopNotify === "function") {
        try { base.desktop.shown = Boolean(deps.desktopNotify(built.desktop)); if (!base.desktop.shown) base.desktop.reason = "unsupported"; }
        catch { base.desktop.shown = false; base.desktop.reason = "error"; }
      } else base.desktop.reason = built.channels.desktop ? "no-notifier" : "channel-off";

      // 4 — email / sms via the server (one POST; the server fans out and reports per channel).
      const wantEmail = built.channels.email && built.recipients.some((r) => r.email);
      const wantSms = built.channels.sms && built.recipients.some((r) => r.phone);
      if (!wantEmail) base.email.reason = built.channels.email ? "no-recipient" : "channel-off";
      if (!wantSms) base.sms.reason = built.channels.sms ? "no-recipient" : "channel-off";
      const needsServer = wantEmail || wantSms || ev === "approval-requested";
      if (needsServer) {
        if (!deps.outbound || typeof deps.outbound.fetch !== "function") {
          base.remote.reason = "no-outbound";
          if (wantEmail) base.email = { status: "failed", reason: "no-outbound" };
          if (wantSms) base.sms = { status: "failed", reason: "no-outbound" };
        } else {
          const body = {
            ...built.payload,
            subject: built.subject,
            text: built.text,
            sms: wantSms ? built.sms : null,
            channels: { email: wantEmail, sms: wantSms },
            recipients: built.recipients.map((r) => ({ role: r.role, name: r.name || null, email: wantEmail ? r.email || null : null, phone: wantSms ? r.phone || null : null })),
            device: deps.deviceId ? String(deps.deviceId()).slice(0, 64) : null
          };
          const headers = { "content-type": "application/json", "user-agent": "aria-sentinel" };
          const keyHash = typeof deps.deviceKeyHash === "function" ? String(deps.deviceKeyHash() || "") : "";
          if (keyHash) headers["x-sentinel-key"] = keyHash;
          base.remote.attempted = true;
          try {
            const res = await deps.outbound.fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body), signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(9000) : undefined });
            base.remote.status = res && typeof res.status === "number" ? res.status : null;
            const data = res && typeof res.json === "function" ? await res.json().catch(() => ({})) : {};
            if (res && res.ok && data && typeof data === "object") {
              const em = data.email || {}, sm = data.sms || {};
              if (wantEmail) base.email = { status: em.sent > 0 ? "sent" : em.dormant ? "dormant" : "failed", reason: em.sent > 0 ? "" : (em.error || (em.dormant ? "no-email-provider-configured" : "server-reported-failure")), sent: Number(em.sent) || 0 };
              if (wantSms) base.sms = { status: sm.sent > 0 ? "sent" : sm.dormant ? "dormant" : "failed", reason: sm.sent > 0 ? "" : (sm.error || (sm.dormant ? "twilio-not-configured" : "server-reported-failure")), sent: Number(sm.sent) || 0 };
              if (data.approval && typeof data.approval === "object") {
                base.remote.approvalId = data.approval.id ? String(data.approval.id).slice(0, 64) : null;
                base.remote.approveUrl = typeof data.approval.approveUrl === "string" && data.approval.approveUrl.startsWith("https://iisupp.net/") ? data.approval.approveUrl : null;
                base.remote.denyUrl = typeof data.approval.denyUrl === "string" && data.approval.denyUrl.startsWith("https://iisupp.net/") ? data.approval.denyUrl : null;
              }
            } else {
              base.remote.reason = `http-${base.remote.status || "error"}`;
              if (wantEmail) base.email = { status: "failed", reason: base.remote.reason };
              if (wantSms) base.sms = { status: "failed", reason: base.remote.reason };
            }
          } catch (err) {
            base.remote.reason = String((err && err.message) || "network").slice(0, 60);
            if (wantEmail) base.email = { status: "failed", reason: base.remote.reason };
            if (wantSms) base.sms = { status: "failed", reason: base.remote.reason };
          }
        }
      }

      log("NOTIFY", `${ev}: desktop ${base.desktop.shown ? "shown" : "not shown"} · email ${base.email.status} · sms ${base.sms.status}${base.sms.status === "dormant" ? " (not sent — provider not configured)" : ""}.`, {
        event: ev, recipeId: built.payload.recipeId || undefined, recipients: redactRecipients(built.recipients), approvalId: built.payload.approvalId || undefined
      });
      return remember(base);
    } catch (err) {
      base.desktop.reason = base.email.reason = base.sms.reason = `dispatch-error:${String((err && err.message) || err).slice(0, 40)}`;
      if (base.email.status === "skipped") base.email.status = "failed";
      if (base.sms.status === "skipped") base.sms.status = "failed";
      try { log("NOTIFY", `${ev}: dispatch error (nothing sent).`, { event: ev }); } catch { /* never throw */ }
      return remember(base);
    }
  }

  return { dispatch, lastResults: () => history.slice(), resetDedupe: () => seen.clear(), _seen: seen };
}

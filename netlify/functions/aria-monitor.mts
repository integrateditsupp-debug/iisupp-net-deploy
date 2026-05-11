import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

const HEALTH_URL = "https://iisupp.net/.netlify/functions/health";
const STATE_KEY = "monitor/state";
const HISTORY_PREFIX = "monitor/checks/";
const ALERT_THRESHOLD = 3;
const ALERT_EMAIL = "integrateditsupp@gmail.com";

interface MonitorState {
  consecutiveFailures: number;
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  inIncident: boolean;
  incidentStartedAt: string | null;
  lastAlertSentAt: string | null;
}

const DEFAULT_STATE: MonitorState = {
  consecutiveFailures: 0,
  lastFailureAt: null,
  lastSuccessAt: null,
  inIncident: false,
  incidentStartedAt: null,
  lastAlertSentAt: null,
};

async function sendAlert(subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM || "ARIA Monitor <noreply@iisupport.net>";
  if (!apiKey) {
    console.error("[aria-monitor] RESEND_API_KEY missing - alert NOT sent");
    return;
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: fromEmail, to: [ALERT_EMAIL], subject, html }),
    });
    if (!r.ok) console.error("[aria-monitor] alert email failed:", r.status);
  } catch (e: any) {
    console.error("[aria-monitor] alert email error:", e && e.message);
  }
}

export default async () => {
  const store = getStore({ name: "aria-monitor" });
  const startedAt = new Date().toISOString();

  let state: MonitorState;
  try {
    state = (await store.get(STATE_KEY, { type: "json" })) as MonitorState;
    if (!state || typeof state !== "object") state = Object.assign({}, DEFAULT_STATE);
  } catch {
    state = Object.assign({}, DEFAULT_STATE);
  }

  let ok = false;
  let httpStatus = 0;
  let latencyMs = 0;
  let bodyHealth: any = null;
  const t0 = Date.now();

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(HEALTH_URL, { signal: ctrl.signal, headers: { "cache-control": "no-store" } });
    clearTimeout(timer);
    latencyMs = Date.now() - t0;
    httpStatus = res.status;
    if (res.ok) {
      try {
        bodyHealth = await res.json();
        ok = bodyHealth && bodyHealth.status === "ok";
      } catch {
        ok = true;
      }
    }
  } catch (e: any) {
    latencyMs = Date.now() - t0;
    console.error("[aria-monitor] fetch error:", e && e.message);
  }

  const checkRecord = { at: startedAt, ok, httpStatus, latencyMs, health: bodyHealth || null };
  const today = startedAt.slice(0, 10);
  const checkKey = HISTORY_PREFIX + today + "/" + Date.now() + ".json";
  try {
    await store.setJSON(checkKey, checkRecord);
  } catch (e: any) {
    console.error("[aria-monitor] log write error:", e && e.message);
  }

  let triggerAlert = false;
  let triggerRecovery = false;

  if (ok) {
    state.lastSuccessAt = startedAt;
    if (state.inIncident) {
      triggerRecovery = true;
      state.inIncident = false;
      state.incidentStartedAt = null;
    }
    state.consecutiveFailures = 0;
  } else {
    state.lastFailureAt = startedAt;
    state.consecutiveFailures += 1;
    if (state.consecutiveFailures >= ALERT_THRESHOLD && !state.inIncident) {
      triggerAlert = true;
      state.inIncident = true;
      state.incidentStartedAt = startedAt;
      state.lastAlertSentAt = startedAt;
    }
  }

  try {
    await store.setJSON(STATE_KEY, state);
  } catch (e: any) {
    console.error("[aria-monitor] state write error:", e && e.message);
  }

  if (triggerAlert) {
    const html = "<h2>iisupp.net DOWN</h2><p><strong>" + state.consecutiveFailures + " consecutive failed checks.</strong></p><p>HTTP status: " + httpStatus + "</p><p>Latency: " + latencyMs + "ms</p><p>First failure: " + state.lastFailureAt + "</p><p>Netlify dashboard: https://app.netlify.com/projects/iisupp/deploys</p>";
    await sendAlert("[ARIA Monitor] iisupp.net DOWN - " + state.consecutiveFailures + " failures", html);
  }
  if (triggerRecovery) {
    const html = "<h2>iisupp.net BACK UP</h2><p>Service recovered at " + startedAt + ".</p><p>HTTP status: " + httpStatus + ", latency " + latencyMs + "ms.</p>";
    await sendAlert("[ARIA Monitor] iisupp.net RECOVERED", html);
  }

  return new Response(
    JSON.stringify({
      ok,
      httpStatus,
      latencyMs,
      consecutiveFailures: state.consecutiveFailures,
      inIncident: state.inIncident,
      alerted: triggerAlert,
      recovered: triggerRecovery,
      health: bodyHealth,
    }),
    { headers: { "content-type": "application/json" } }
  );
};

export const config: Config = {
  schedule: "*/5 * * * *",
};

// remote-control — scoped, time-boxed remote sessions via the existing Whereby integration. PURE:
// validates the room URL host + builds a session descriptor. Privacy stays intact (R7): NO screen
// recording, NO keystroke capture — it's a video/desktop assist room the customer ends with one click.
const WHEREBY_HOSTS = ["whereby.com", "subdomain.whereby.com"];
export const SESSION_MS = 10 * 60 * 1000; // 10-minute scoped session

export function isWherebyRoom(url) {
  let u;
  try { u = new URL(String(url)); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  return WHEREBY_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)) || host.endsWith(".whereby.com");
}

/**
 * Build a remote-control session from a Whereby room URL.
 * @returns {{ok, roomUrl?, expiresAt?, recording, keystrokeCapture, reason?}}
 */
export function buildRemoteSession({ roomUrl, now = Date.now() } = {}) {
  if (!isWherebyRoom(roomUrl)) return { ok: false, reason: "invalid-room", recording: false, keystrokeCapture: false };
  return {
    ok: true,
    roomUrl: String(roomUrl),
    startedAt: now,
    expiresAt: now + SESSION_MS,
    recording: false,        // privacy: never record
    keystrokeCapture: false  // privacy: never capture keystrokes
  };
}

export function sessionActive(session, now = Date.now()) {
  return Boolean(session && session.ok && now < session.expiresAt);
}

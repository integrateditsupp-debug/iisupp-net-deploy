// RUN 21 §6 — pure builder for the "update-events" publish log (kept out of the Netlify handler so it is
// testable without @netlify/blobs). Each successful admin publish appends one of these records.
export function buildUpdateEvent(record = {}, publishedBy = "admin") {
  return {
    version: record.version || null,
    sha512: record.sha512 || "",
    size: Number(record.size) || 0,
    releaseNotes: record.release_notes || record.releaseNotes || "",
    publishedAt: record.release_date || record.publishedAt || new Date().toISOString(),
    publishedBy: String(publishedBy || "admin"),
    mandatory: Boolean(record.mandatory)
  };
}

/** Append to the rolling event log (newest first, capped). */
export function appendUpdateEvent(log = [], event) {
  return [event, ...(Array.isArray(log) ? log : [])].slice(0, 200);
}

/** Mandatory updates compress the 3-strike window from 24h to 3h per strike. */
export function strikeHoursForEvent(event) {
  return event && event.mandatory ? 3 : 24;
}

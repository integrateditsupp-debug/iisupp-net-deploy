// Netlify function: receive sanitized self-heal escalation reports → Netlify Blobs `self-heal-reports`.
// Reports are content-blind (symbolic feature ids only). Routes each item to the code/design agent
// queue the admin console reads. PROJECT-LOCAL until Ahmad ships.
import { getStore } from "@netlify/blobs";
import { isHealReportSafe } from "../../src/shared/self-heal.mjs";

function json(status, body) {
  return { statusCode: status, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

export async function handler(event) {
  let report = {};
  try { report = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad-json" }); }
  // Reject anything that isn't content-blind (defense-in-depth; the client already sanitizes).
  if (!isHealReportSafe(report)) return json(422, { error: "report-not-content-blind" });
  try {
    const store = getStore("self-heal-reports");
    const key = `${report.ts || new Date().toISOString()}-${Math.abs((JSON.stringify(report).length * 2654435761) >>> 0).toString(36)}`;
    await store.setJSON(key, report);
    return json(202, { ok: true, queued: report.items ? report.items.length : 0 });
  } catch {
    return json(200, { ok: false, stored: false });
  }
}

export const config = { path: "/.netlify/functions/aria-self-heal-report" };

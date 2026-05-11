import { getStore } from "@netlify/blobs";
import { createHmac, timingSafeEqual } from "crypto";

export default async (req: Request) => {
  if (req.method !== "POST") return j(405, { error: "POST required" });

  const rawBody = await req.text();

  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers.get("x-elevenlabs-signature") || req.headers.get("X-ElevenLabs-Signature");
    if (!sig) return j(401, { error: "Missing signature" });
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(sig.replace(/^sha256=/, ""), "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return j(401, { error: "Invalid signature" });
    }
  }

  let body: any;
  try { body = JSON.parse(rawBody); } catch { return j(400, { error: "Invalid JSON" }); }

  const callId = String(body.conversation_id || body.call_id || body.call_sid || ("call-" + Date.now()));
  const phoneRaw = String(body.caller_phone || body.from || "").trim();
  const phone = normalizePhone(phoneRaw);

  const record = {
    id: callId,
    phone: phone,
    startedAt: body.started_at || null,
    endedAt: body.ended_at || new Date().toISOString(),
    durationSec: body.duration_seconds || null,
    summary: typeof body.summary === "string" ? body.summary.slice(0, 4000) : "",
    classification: body.classification || null,
    resolved: !!body.resolved,
    escalated: !!body.escalated,
    urgency: body.urgency || null,
    transcript: typeof body.transcript === "string"
      ? body.transcript.slice(0, 20000)
      : (Array.isArray(body.transcript) ? body.transcript.slice(0, 200) : null),
    toolCalls: Array.isArray(body.tool_calls) ? body.tool_calls.slice(0, 30) : [],
    recordedAt: new Date().toISOString()
  };

  try {
    const store = getStore({ name: "aria-calls" });
    await store.setJSON("call/" + callId, record);
    if (phone) {
      const idxKey = "by-phone/" + phone;
      let idx = (await store.get(idxKey, { type: "json" })) as { callIds: string[] } | null;
      if (!idx || !Array.isArray(idx.callIds)) idx = { callIds: [] };
      if (idx.callIds.indexOf(callId) === -1) {
        idx.callIds.push(callId);
        await store.setJSON(idxKey, idx);
      }
    }
  } catch (e: any) {
    console.error("[aria-call-summary] store error:", e && e.message);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM || "ARIA Calls <noreply@iisupport.net>";
  const salesTo = process.env.SALES_NOTIFY_EMAIL || "integrateditsupp@gmail.com";
  if (apiKey) {
    const tagBits: string[] = [];
    if (record.escalated) tagBits.push("ESCALATED");
    if (record.resolved) tagBits.push("RESOLVED");
    if (record.urgency) tagBits.push(String(record.urgency).toUpperCase());
    const tag = tagBits.length ? " [" + tagBits.join(" | ") + "]" : "";
    const subj = "ARIA call" + tag + " - " + (phone || "unknown caller");
    const html = renderHtml(record);
    try {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + apiKey, "content-type": "application/json" },
        body: JSON.stringify({ from: fromEmail, to: [salesTo], subject: subj, html }),
      });
    } catch (e: any) {
      console.error("[aria-call-summary] email error:", e && e.message);
    }
  }

  return j(200, { ok: true, callId: callId, phone: phone });
};

function renderHtml(r: any): string {
  function esc(s: any): string {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" } as any)[c];
    });
  }
  const transcriptHtml = typeof r.transcript === "string"
    ? "<pre style=\"white-space:pre-wrap;font-size:13px;\">" + esc(r.transcript) + "</pre>"
    : Array.isArray(r.transcript)
      ? r.transcript.map(function(t: any){ return "<p><b>" + esc(t.role) + ":</b> " + esc(t.message) + "</p>"; }).join("")
      : "<i>(no transcript)</i>";
  return "<h2>ARIA Call - " + esc(r.id) + "</h2>"
    + "<p><b>Phone:</b> " + esc(r.phone || "unknown") + "</p>"
    + "<p><b>Duration:</b> " + esc(r.durationSec) + "s</p>"
    + "<p><b>Resolved:</b> " + (r.resolved ? "yes" : "no")
    + " | <b>Escalated:</b> " + (r.escalated ? "yes" : "no")
    + " | <b>Urgency:</b> " + esc(r.urgency || "n/a") + "</p>"
    + "<h3>Summary</h3><p>" + esc(r.summary) + "</p>"
    + "<h3>Transcript</h3>" + transcriptHtml
    + (r.toolCalls && r.toolCalls.length
        ? "<h3>Tools used (" + r.toolCalls.length + ")</h3><ul>"
          + r.toolCalls.map(function(t: any){ return "<li>" + esc(t.name) + "</li>"; }).join("")
          + "</ul>"
        : "");
}

function normalizePhone(s: string): string | null {
  if (!s) return null;
  const digits = s.replace(/[^0-9+]/g, "");
  if (!digits) return null;
  if (digits.charAt(0) === "+") return digits;
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.charAt(0) === "1") return "+" + digits;
  return null;
}

function j(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

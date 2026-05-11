import { getStore } from "@netlify/blobs";

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  if (req.method !== "POST") return j(405, { error: "POST required" });

  const required = process.env.ARIA_TOOL_SECRET;
  if (required) {
    const provided = req.headers.get("x-aria-tool-secret");
    if (provided !== required) return j(401, { error: "Unauthorized" });
  }

  let body: any;
  try { body = await req.json(); } catch { return j(400, { error: "Invalid JSON" }); }
  const phone = String(body.phone || "").trim();
  if (!phone) return j(400, { error: "phone required" });

  const norm = normalizePhone(phone);
  if (!norm) return j(400, { error: "Invalid phone (use E.164 like +14165551234)" });

  try {
    const store = getStore({ name: "aria-calls" });
    const idxKey = "by-phone/" + norm;
    const idx = await store.get(idxKey, { type: "json" }) as { callIds: string[] } | null;
    if (!idx || !idx.callIds || idx.callIds.length === 0) {
      return j(200, { ok: true, phone: norm, priorCalls: 0, calls: [] });
    }

    const callIds = idx.callIds.slice(-5);
    const calls: any[] = [];
    for (const id of callIds) {
      const c = await store.get("call/" + id, { type: "json" }) as any;
      if (c) {
        calls.push({
          id: id,
          at: c.endedAt || c.startedAt || null,
          summary: (c.summary || "").slice(0, 200),
          resolved: !!c.resolved,
          escalated: !!c.escalated,
          urgency: c.urgency || null
        });
      }
    }
    return j(200, { ok: true, phone: norm, priorCalls: idx.callIds.length, calls });
  } catch (e: any) {
    console.error("[aria-caller-lookup]", e && e.message);
    return j(500, { error: "Lookup service error" });
  }
};

function normalizePhone(s: string): string | null {
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
    headers: Object.assign({ "content-type": "application/json" }, cors()),
  });
}
function cors() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type,x-aria-tool-secret",
  };
}

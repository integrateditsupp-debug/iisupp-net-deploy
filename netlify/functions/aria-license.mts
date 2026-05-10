/**
 * ARIA License — issue, verify, replace.
 * Stores licenses in Netlify Blobs; enforces 5-device-per-user cap.
 */
import { getStore } from "@netlify/blobs";

interface LicenseRecord {
  token: string;
  plan: string;
  email: string;
  company?: string;
  source: string;
  issuedAt: string;
  active: boolean;
  deviceFingerprints: string[];
  fiveYearCompany?: boolean;
}

const MAX_DEVICES_PER_USER = 5;

function generateToken(plan: string, fiveYr = false): string {
  const segs = (n: number) => Array.from({ length: n }, () =>
    Math.random().toString(36).slice(2, 6).toUpperCase()).join("-");
  const prefix = fiveYr ? "ARIA-CO5Y" : `ARIA-${plan.toUpperCase().slice(0, 4)}`;
  return `${prefix}-${segs(3)}`;
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  if (req.method !== "POST") return j(405, { error: "POST required" });

  let body: any;
  try { body = await req.json(); } catch { return j(400, { error: "Invalid JSON" }); }

  const action = (body.action || "issue").toLowerCase();
  const store = getStore({ name: "aria-licenses" });

  try {
    if (action === "issue") {
      if (!body.email || !body.plan) return j(400, { error: "email + plan required" });
      const token = generateToken(body.plan, !!body.fiveYearCompany);
      const record: LicenseRecord = {
        token, plan: body.plan, email: body.email,
        company: body.company, source: body.source || "manual",
        issuedAt: new Date().toISOString(), active: true,
        deviceFingerprints: body.device ? [body.device] : [],
        fiveYearCompany: !!body.fiveYearCompany,
      };
      await store.setJSON(token, record);
      await store.setJSON(`by-email/${body.email}`, { token, plan: body.plan });
      return j(200, { ok: true, token, plan: body.plan });
    }

    if (action === "verify") {
      if (!body.token) return j(400, { error: "token required" });
      const rec = await store.get(body.token, { type: "json" }) as LicenseRecord | null;
      if (!rec || !rec.active) return j(404, { ok: false, error: "License not found or inactive" });

      // Device cap check
      if (body.device && !rec.deviceFingerprints.includes(body.device)) {
        if (rec.deviceFingerprints.length >= MAX_DEVICES_PER_USER) {
          return j(409, { ok: false, error: `Device limit reached (${MAX_DEVICES_PER_USER}). Call (647) 581-3182 to swap a device.` });
        }
        rec.deviceFingerprints.push(body.device);
        await store.setJSON(body.token, rec);
      }
      return j(200, { ok: true, plan: rec.plan, email: rec.email, devices: rec.deviceFingerprints.length });
    }

    if (action === "replace") {
      if (!body.token || !body.oldDevice || !body.newDevice) return j(400, { error: "token + oldDevice + newDevice required" });
      const rec = await store.get(body.token, { type: "json" }) as LicenseRecord | null;
      if (!rec) return j(404, { error: "License not found" });
      rec.deviceFingerprints = rec.deviceFingerprints.filter(d => d !== body.oldDevice);
      if (!rec.deviceFingerprints.includes(body.newDevice)) rec.deviceFingerprints.push(body.newDevice);
      await store.setJSON(body.token, rec);
      return j(200, { ok: true, devices: rec.deviceFingerprints.length });
    }

    return j(400, { error: "Unknown action: " + action });
  } catch (err: any) {
    console.error("[aria-license]", err.message);
    return j(500, { error: "License service error" });
  }
};

function j(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json", ...cors() },
  });
}
function cors() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

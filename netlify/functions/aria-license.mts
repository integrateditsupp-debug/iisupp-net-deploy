/**
 * ARIA License — issue, verify, replace.
 * Stores licenses in Netlify Blobs; enforces 5-device-per-user cap.
 *
 * 2026-10-08 (audit top-10 #2):
 *  - `issue` is no longer public. It requires `x-internal-token` = INTERNAL_WEBHOOK_SECRET (what
 *    stripe-confirm.js now sends) or an admin token (ARIA_ADMIN_TOKEN) — constant-time, fail-closed
 *    (503 when neither env is configured). lib/admin-gate.cjs.
 *  - tokens come from crypto.randomBytes (was Math.random).
 *  - `verify` no longer echoes the holder's address: `email` is returned MASKED (local part hidden,
 *    domain kept — assets/aria-trial.js derives the company name from the domain) plus `email_domain`.
 *  - the by-email index key is normalised (lower-cased, charset-guarded) — audit §4 blob-key injection.
 */
import { getStore } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import adminGate from "./lib/admin-gate.cjs";

const { requireAdminToken, adminGateFetchResponse } = adminGate as any;

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
  revokedAt?: string | null;
  revokedReason?: string | null;
}

const MAX_DEVICES_PER_USER = 5;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 symbols, no 0/O/1/I ambiguity
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateToken(plan: string, fiveYr = false): string {
  const seg = () => {
    const b = randomBytes(4);
    let s = "";
    for (let i = 0; i < 4; i++) s += ALPHABET[b[i] % ALPHABET.length];
    return s;
  };
  const prefix = fiveYr ? "ARIA-CO5Y" : `ARIA-${String(plan || "PLAN").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4).padEnd(4, "X")}`;
  return `${prefix}-${seg()}-${seg()}-${seg()}`;
}

function maskEmail(email: string): string {
  const s = String(email || "");
  const at = s.indexOf("@");
  if (at <= 0) return "***";
  const local = s.slice(0, at);
  return (local.length > 2 ? local.slice(0, 1) + "***" + local.slice(-1) : "***") + s.slice(at);
}

function byEmailKey(email: string): string | null {
  const e = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(e) || e.length > 254) return null;
  return `by-email/${e}`;
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  if (req.method !== "POST") return j(405, { error: "POST required" });

  let body: any;
  try { body = await req.json(); } catch { return j(400, { error: "Invalid JSON" }); }

  const action = String(body.action || "issue").toLowerCase();

  // Internal/admin only — minting a license is a financial act. Checked BEFORE any storage work.
  let issueGate: any = null;
  if (action === "issue") {
    issueGate = requireAdminToken(req, { envNames: ["INTERNAL_WEBHOOK_SECRET", "ARIA_ADMIN_TOKEN"], allowBodyToken: false });
    if (!issueGate.ok) return adminGateFetchResponse(issueGate, cors());
  }

  try {
    const store = getStore({ name: "aria-licenses" });
    if (action === "issue") {
      const gate = issueGate;
      const email = String(body.email || "").trim().toLowerCase();
      const plan = String(body.plan || "").trim();
      if (!email || !plan) return j(400, { error: "email + plan required" });
      const beKey = byEmailKey(email);
      if (!beKey) return j(400, { error: "valid email required" });
      if (!/^[a-z0-9_-]{1,40}$/i.test(plan)) return j(400, { error: "plan must be a short slug" });

      const token = generateToken(plan, !!body.fiveYearCompany);
      const record: LicenseRecord = {
        token, plan, email,
        company: body.company ? String(body.company).slice(0, 120) : undefined,
        source: String(body.source || "manual").slice(0, 40),
        issuedAt: new Date().toISOString(), active: true,
        deviceFingerprints: body.device ? [String(body.device).slice(0, 128)] : [],
        fiveYearCompany: !!body.fiveYearCompany,
      };
      await store.setJSON(token, record);
      await store.setJSON(beKey, { token, plan, issuedAt: record.issuedAt, source: record.source });
      console.log("[aria-license] issued", { plan, source: record.source, via: gate.via });
      return j(200, { ok: true, token, plan });
    }

    if (action === "verify") {
      if (!body.token) return j(400, { error: "token required" });
      const tokenKey = String(body.token).trim();
      if (!/^[A-Z0-9-]{8,64}$/i.test(tokenKey)) return j(404, { ok: false, error: "License not found or inactive" });
      const rec = await store.get(tokenKey, { type: "json" }) as LicenseRecord | null;
      if (!rec || !rec.active) return j(404, { ok: false, error: "License not found or inactive" });

      // Device cap check
      const device = body.device ? String(body.device).slice(0, 128) : "";
      if (device && !rec.deviceFingerprints.includes(device)) {
        if (rec.deviceFingerprints.length >= MAX_DEVICES_PER_USER) {
          return j(409, { ok: false, error: `Device limit reached (${MAX_DEVICES_PER_USER}). Call (647) 581-3182 to swap a device.` });
        }
        rec.deviceFingerprints.push(device);
        await store.setJSON(tokenKey, rec);
      }
      const domain = String(rec.email || "").split("@")[1] || "";
      return j(200, {
        ok: true,
        plan: rec.plan,
        email: maskEmail(rec.email),   // masked — the holder's address is not echoed to the network
        email_domain: domain,
        company: rec.company || undefined,
        devices: rec.deviceFingerprints.length,
      });
    }

    if (action === "replace") {
      if (!body.token || !body.oldDevice || !body.newDevice) return j(400, { error: "token + oldDevice + newDevice required" });
      const tokenKey = String(body.token).trim();
      const rec = await store.get(tokenKey, { type: "json" }) as LicenseRecord | null;
      if (!rec) return j(404, { error: "License not found" });
      const oldDevice = String(body.oldDevice).slice(0, 128);
      const newDevice = String(body.newDevice).slice(0, 128);
      rec.deviceFingerprints = rec.deviceFingerprints.filter(d => d !== oldDevice);
      if (!rec.deviceFingerprints.includes(newDevice)) rec.deviceFingerprints.push(newDevice);
      await store.setJSON(tokenKey, rec);
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
    "access-control-allow-headers": "content-type,x-internal-token,x-admin-token",
  };
}

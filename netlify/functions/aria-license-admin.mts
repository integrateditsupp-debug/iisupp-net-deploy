/**
 * ARIA License Admin — list, revoke, reactivate.
 * Auth: ARIA_ADMIN_TOKEN header or query param.
 */
import { getStore } from "@netlify/blobs";

export default async (req: Request) => {
  const url = new URL(req.url);
  const adminToken = process.env.ARIA_ADMIN_TOKEN;
  const provided = req.headers.get("x-admin-token") || url.searchParams.get("token");

  if (!adminToken || provided !== adminToken) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { "content-type": "application/json" },
    });
  }

  const store = getStore({ name: "aria-licenses" });
  const action = url.searchParams.get("action") || "list";

  try {
    if (action === "list") {
      const { blobs } = await store.list();
      const out = [];
      for (const b of blobs.slice(0, 200)) {
        if (b.key.startsWith("by-email/")) continue;
        const r = await store.get(b.key, { type: "json" }).catch(() => null);
        if (r) out.push(r);
      }
      return j(200, { count: out.length, licenses: out });
    }

    if (action === "revoke" || action === "reactivate") {
      const token = url.searchParams.get("token") || (await req.json().catch(() => ({}))).token;
      if (!token) return j(400, { error: "token required" });
      const rec = await store.get(token, { type: "json" }) as any;
      if (!rec) return j(404, { error: "Not found" });
      rec.active = action === "reactivate";
      await store.setJSON(token, rec);
      return j(200, { ok: true, token, active: rec.active });
    }

    return j(400, { error: "Unknown action" });
  } catch (err: any) {
    return j(500, { error: err.message });
  }
};

function j(s: number, b: any) {
  return new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
}

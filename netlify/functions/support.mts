import type { Context, Config } from "@netlify/functions";

// Returns canonical contact information for IISupport.
// Used by ARIA and the Service Center for escalation flows.

export default async (_req: Request, _context: Context) => {
  return Response.json(
    {
      ok: true,
      company: "IISupport",
      phone: "(647) 581-3182",
      phone_e164: "+16475813182",
      tel_href: "tel:6475813182",
      hours: "24/7 escalation line",
      message:
        "Reach a real IISupport specialist any time at (647) 581-3182. For non-urgent issues, ARIA can guide you through the fix first.",
    },
    {
      headers: { "Cache-Control": "public, max-age=300" },
    }
  );
};

export const config: Config = {
  path: "/api/support",
};

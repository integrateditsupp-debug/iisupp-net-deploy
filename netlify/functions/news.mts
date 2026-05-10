import type { Context, Config } from "@netlify/functions";

// Placeholder news function — ready for an API key.
// When NEWS_API_KEY is set, plug a provider call into the marked section.

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url);
  const topic = url.searchParams.get("topic") || url.searchParams.get("q") || "top";

  const apiKey = Netlify.env.get("NEWS_API_KEY");

  if (!apiKey) {
    return Response.json(
      {
        ok: false,
        provider: null,
        topic,
        message:
          "News provider not configured yet. Set NEWS_API_KEY as a function-scoped environment variable to enable live data.",
        items: [],
      },
      { status: 200 }
    );
  }

  // TODO: live provider call goes here when a key is wired up.
  return Response.json(
    {
      ok: false,
      provider: "configured",
      topic,
      message: "News provider is configured but not yet wired to a live source.",
      items: [],
    },
    { status: 200 }
  );
};

export const config: Config = {
  path: "/api/news",
};

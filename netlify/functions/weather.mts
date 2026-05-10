import type { Context, Config } from "@netlify/functions";

// Placeholder weather function — ready for an API key.
// When WEATHER_API_KEY is set, plug a provider call into the marked section.

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url);
  const location =
    url.searchParams.get("location") ||
    url.searchParams.get("q") ||
    "Toronto";

  const apiKey = Netlify.env.get("WEATHER_API_KEY");

  if (!apiKey) {
    return Response.json(
      {
        ok: false,
        provider: null,
        location,
        message:
          "Weather provider not configured yet. Set WEATHER_API_KEY as a function-scoped environment variable to enable live data.",
        data: null,
      },
      { status: 200 }
    );
  }

  // TODO: live provider call goes here when a key is wired up.
  // Example: const r = await fetch(`https://api.example.com/weather?q=${encodeURIComponent(location)}&key=${apiKey}`);
  return Response.json(
    {
      ok: false,
      provider: "configured",
      location,
      message: "Weather provider is configured but not yet wired to a live source.",
      data: null,
    },
    { status: 200 }
  );
};

export const config: Config = {
  path: "/api/weather",
};

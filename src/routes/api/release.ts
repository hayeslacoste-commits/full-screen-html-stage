import { createServerFileRoute } from "@tanstack/react-start/server";

const ALLOWED_RELEASE_BASE =
  "https://github.com";

export const ServerRoute = createServerFileRoute("/api/release").methods({
  GET: async ({ request }) => {
    const reqUrl = new URL(request.url);
    const asset = reqUrl.searchParams.get("asset") || "";

    if (!asset || asset.includes("..")) {
      return new Response("Invalid asset", { status: 400 });
    }

    const upstream = await fetch(`${ALLOWED_RELEASE_BASE}${asset}`);
    if (!upstream.ok) {
      return new Response("Release asset not found", { status: upstream.status });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  },
});

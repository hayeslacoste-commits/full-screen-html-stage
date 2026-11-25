import { createFileRoute } from "@tanstack/react-router";

const OWNER = "hayeslacoste-commits";
const REPO = "full-screen-html-stage";

export const Route = createFileRoute("/api/release")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const asset = new URL(request.url).searchParams.get("asset") ?? "";
        if (!asset || asset.includes("..") || asset.startsWith("/")) {
          return new Response("Invalid release asset", { status: 400 });
        }

        const targetUrl = new URL(
          `/${OWNER}/${REPO}/releases/download/${asset}`,
          "https://github.com",
        );

        try {
          const upstream = await fetch(targetUrl, { redirect: "follow" });
          if (!upstream.ok) {
            return new Response("Release asset not found", { status: upstream.status });
          }

          return new Response(upstream.body, {
            status: 200,
            headers: {
              "content-type": "text/html; charset=utf-8",
              "cache-control": "public, max-age=3600",
            },
          });
        } catch {
          return new Response("Release server unavailable", { status: 502 });
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";

function requestedTarget(request: Request) {
  const value = new URL(request.url).searchParams.get("target");
  if (!value) return null;

  try {
    const target = new URL(value);
    const allowedHost = target.hostname === "www.fliplineads.com" || target.hostname === "fliplineads.com";
    if (!allowedHost || !target.pathname.startsWith("/serve/") || target.username || target.password) {
      return null;
    }
    target.protocol = "https:";
    target.port = "";
    return target;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/fliplineads")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const target = requestedTarget(request);
        if (!target) return new Response("Invalid game provider address", { status: 400 });

        try {
          const upstream = await fetch(target, {
            headers: { accept: request.headers.get("accept") ?? "*/*" },
            redirect: "follow",
          });
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              "content-type": upstream.headers.get("content-type") ?? "application/xml",
              "cache-control": "no-store",
              "access-control-allow-origin": "*",
            },
          });
        } catch {
          return new Response("The game provider is unavailable", { status: 502 });
        }
      },
    },
  },
});

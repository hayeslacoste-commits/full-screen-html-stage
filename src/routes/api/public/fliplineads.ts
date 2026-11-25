import { createFileRoute } from "@tanstack/react-router";

function requestedTarget(request: Request) {
  const value = new URL(request.url).searchParams.get("target");
  if (!value) return null;

  try {
    const target = new URL(value);
    const isFlipline =
      (target.hostname === "://fliplineads.com" || target.hostname === "fliplineads.com") &&
      target.pathname.startsWith("/serve/");
    const isMyRelease =
      target.hostname === "github.com" &&
      target.pathname.startsWith("/hayeslacoste-commits/full-screen-html-stage/releases/download/");

    if ((!isFlipline && !isMyRelease) || target.username || target.password) {
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
        if (!target) return new Response("Invalid address", { status: 400 });

        try {
          const upstream = await fetch(target, {
            headers: { accept: request.headers.get("accept") ?? "*/*" },
            redirect: "follow",
          });
          const isHtml = target.pathname.endsWith(".html");
          return new Response(upstream.body, {
            status: upstream.status,
            headers: {
              "content-type": isHtml
                ? "text/html; charset=utf-8"
                : (upstream.headers.get("content-type") ?? "application/xml"),
              "cache-control": "no-store",
              "access-control-allow-origin": "*",
            },
          });
        } catch {
          return new Response("Upstream unavailable", { status: 502 });
        }
      },
    },
  },
});

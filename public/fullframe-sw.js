/* FullFrame serves only uploaded preview files under /__fullframe/. */
const PREFIX = "/__fullframe/";
const sessions = new Map();
const MAX_SESSIONS = 4;

const MIME_TYPES = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  wasm: "application/wasm",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  mp4: "video/mp4",
  webm: "video/webm",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  swf: "application/x-shockwave-flash",
  zip: "application/zip"
};

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

function contentType(file) {
  const extension = file.path.toLowerCase().split(".").pop() ?? "";
  return MIME_TYPES[extension] || file.type || "application/octet-stream";
}

function storeSession(sessionId, files) {
  const fileMap = new Map();
  for (const file of files) {
    const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    fileMap.set(file.path, { path: file.path, data, type: file.type });
  }
  sessions.delete(sessionId);
  sessions.set(sessionId, fileMap);

  while (sessions.size > MAX_SESSIONS) {
    sessions.delete(sessions.keys().next().value);
  }
}

self.addEventListener("message", (event) => {
  const message = event.data;
  if (message?.type === "FULLFRAME_INSTALL") {
    storeSession(message.sessionId, message.files);
    const port = event.ports && event.ports.at(0);
    if (port) port.postMessage({ ok: true });
  }
  if (message?.type === "FULLFRAME_DISPOSE") {
    sessions.delete(message.sessionId);
  }
});

async function requestFileFromEditor(sessionId, path) {
  const availableClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const editor = availableClients.find((client) => {
    try {
      return !new URL(client.url).pathname.startsWith(PREFIX);
    } catch {
      return false;
    }
  });
  if (!editor) return null;

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => {
      channel.port1.close();
      resolve(null);
    }, 5000);

    channel.port1.onmessage = (event) => {
      clearTimeout(timeout);
      channel.port1.close();
      const file = event.data?.file;
      if (!file) {
        resolve(null);
        return;
      }
      const stored = {
        path: file.path,
        data: file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data),
        type: file.type,
      };
      if (!sessions.has(sessionId)) sessions.set(sessionId, new Map());
      sessions.get(sessionId).set(path, stored);
      resolve(stored);
    };

    editor.postMessage({ type: "FULLFRAME_FILE_REQUEST", sessionId, path }, [channel.port2]);
  });
}

function notFound(path) {
  return new Response(`FullFrame could not find “${path}” in the uploaded package.`, {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function rangeResponse(request, file) {
  const size = file.data.byteLength;
  let start = 0;
  let end = Math.max(0, size - 1);
  let status = 200;
  const range = request.headers.get("Range");

  if (range && size > 0) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    const startStr = match ? match.at(1) : "";
    const endStr = match ? match.at(2) : "";
    if (!match || (!startStr && !endStr)) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }

    if (!startStr) {
      start = Math.max(0, size - Number(endStr));
    } else {
      start = Number(startStr);
      if (endStr) end = Math.min(Number(endStr), size - 1);
    }

    if (start >= size || end < start) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    status = 206;
  }

  const body = request.method === "HEAD" ? null : file.data.subarray(start, size === 0 ? 0 : end + 1);
  const headers = {
    "Content-Type": contentType(file),
    "Content-Length": String(size === 0 ? 0 : end - start + 1),
    "Cache-Control": "no-store",
    "Accept-Ranges": "bytes",
  };
  if (status === 206) headers["Content-Range"] = `bytes ${start}-${end}/${size}`;

  return new Response(body, { status, headers });
}

async function handleRequest(request) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(request.url);
  const remainder = url.pathname.slice(PREFIX.length);
  const separator = remainder.indexOf("/");
  const sessionId = separator === -1 ? remainder : remainder.slice(0, separator);
  let path = separator === -1 ? "index.html" : remainder.slice(separator + 1);

  try {
    path = decodeURIComponent(path);
  } catch {
    return notFound(path);
  }
  if (!path || path.endsWith("/")) path += "index.html";

  let file = sessions.get(sessionId)?.get(path);
  if (!file) file = await requestFileFromEditor(sessionId, path);
  if (!file) return notFound(path);
  return rangeResponse(request, file);
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept local /ruffle/ or /games/ static files
  if (url.origin === self.location.origin && (url.pathname.startsWith("/ruffle/") || url.pathname.startsWith("/games/"))) {
    return;
  }

    if (
    (url.hostname === "www.fliplineads.com" || url.hostname === "fliplineads.com") &&
    url.pathname.startsWith("/serve/")
  ) {
    url.protocol = "https:";
    url.port = "";
    const proxy = new URL("/api/public/fliplineads", self.location.origin);
    proxy.searchParams.set("target", url.href);
    event.respondWith(fetch(proxy, { cache: "no-store" }));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith(PREFIX)) {
    event.respondWith(handleRequest(event.request));
  }
});

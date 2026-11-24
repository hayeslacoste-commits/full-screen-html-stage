import { prepareHtmlForPreview } from "@/lib/html-compatibility";
import type { HtmlPackage } from "@/lib/html-package";

const PREVIEW_PREFIX = "/__fullframe/";
const INSTALL_TIMEOUT_MS = 10_000;

export type PreviewSession =
  | { kind: "service-worker"; url: string; sessionId: string }
  | { kind: "blob"; url: string };

const sessions = new Map<string, HtmlPackage>();
let registrationPromise: Promise<ServiceWorkerRegistration> | null = null;
let providerInstalled = false;

function preparePackage(htmlPackage: HtmlPackage): HtmlPackage {
  return {
    ...htmlPackage,
    files: htmlPackage.files.map((file) => {
      if (!/\.(html?|xhtml)$/i.test(file.path)) return file;
      const code = prepareHtmlForPreview(new TextDecoder().decode(file.data));
      return { ...file, data: new TextEncoder().encode(code), type: "text/html" };
    }),
  };
}

function installProvider() {
  if (providerInstalled) return;
  providerInstalled = true;

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type !== "FULLFRAME_FILE_REQUEST") return;
    const port = event.ports[0];
    if (!port) return;

    const htmlPackage = sessions.get(event.data.sessionId);
    const file = htmlPackage?.files.find((candidate) => candidate.path === event.data.path);
    port.postMessage({ file: file ?? null });
    port.close();
  });
}

async function runtimeRegistration() {
  if (!("serviceWorker" in navigator)) throw new Error("Service workers are unavailable.");
  installProvider();

  if (!registrationPromise) {
    registrationPromise = (async () => {
      await navigator.serviceWorker.register("/fullframe-sw.js", { scope: "/" });
      return navigator.serviceWorker.ready;
    })();
    registrationPromise.catch(() => {
      registrationPromise = null;
    });
  }

  return registrationPromise;
}

function installSession(
  registration: ServiceWorkerRegistration,
  sessionId: string,
  htmlPackage: HtmlPackage,
) {
  return new Promise<void>((resolve, reject) => {
    const worker = registration.active;
    if (!worker) {
      reject(new Error("The file runner is not ready yet."));
      return;
    }

    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error("The file runner took too long to start."));
    }, INSTALL_TIMEOUT_MS);

    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout);
      channel.port1.close();
      if (event.data?.ok) resolve();
      else reject(new Error("The file runner could not open this package."));
    };

    worker.postMessage(
      { type: "FULLFRAME_INSTALL", sessionId, files: htmlPackage.files },
      [channel.port2],
    );
  });
}

function encodedPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function createServiceWorkerSession(htmlPackage: HtmlPackage): Promise<PreviewSession> {
  const registration = await runtimeRegistration();
  const prepared = preparePackage(htmlPackage);
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, prepared);

  try {
    await installSession(registration, sessionId, prepared);
  } catch (error) {
    sessions.delete(sessionId);
    throw error;
  }

  return {
    kind: "service-worker",
    sessionId,
    url: `${PREVIEW_PREFIX}${sessionId}/${encodedPath(prepared.entryPath)}`,
  };
}

export async function createPreviewSession(htmlPackage: HtmlPackage): Promise<PreviewSession> {
  try {
    return await createServiceWorkerSession(htmlPackage);
  } catch {
    if (htmlPackage.files.length > 1) {
      throw new Error(
        "This browser could not start the complete package. Try a current version of Chrome, Edge, Firefox, or Safari.",
      );
    }

    const code = prepareHtmlForPreview(new TextDecoder().decode(htmlPackage.files[0]?.data));
    return {
      kind: "blob",
      url: URL.createObjectURL(new Blob([code], { type: "text/html" })),
    };
  }
}

export function disposePreviewSession(session: PreviewSession) {
  if (session.kind === "blob") {
    URL.revokeObjectURL(session.url);
    return;
  }

  sessions.delete(session.sessionId);
  registrationPromise
    ?.then((registration) => {
      registration.active?.postMessage({ type: "FULLFRAME_DISPOSE", sessionId: session.sessionId });
    })
    .catch(() => {});
}
